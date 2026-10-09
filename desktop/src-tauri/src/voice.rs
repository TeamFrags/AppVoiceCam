//! Voice cloning: makes the voice heard by the microphone sound like a reference recording.
//!
//! Two models from OpenVoice V2 (MIT licence) do the work. The extractor turns a few seconds
//! of speech into a 256-number description of a voice. The converter redraws a stretch of
//! speech, given the description of the voice it has and of the voice it should have. Both
//! read a spectrogram at 22 050 Hz and need no training: one recording is enough.
//!
//! The converter is not built for live use, so the stream is cut into short blocks. Each block
//! is converted together with the sound around it, which the model needs to draw it well: what
//! it draws near the end of its input, without knowing what comes next, is rough. The blocks
//! are then joined where their waves line up, with a short cross-fade.

use std::{
    io::Cursor,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

use ort::{
    session::{builder::SessionBuilder, Session},
    value::Tensor,
};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};

use crate::{
    error::AppError,
    face::{self, FaceError},
};

const EXTRACTOR_FILE: &str = "tone_extract.onnx";
const CONVERTER_FILE: &str = "tone_color.onnx";

/// Sample rate the models were trained at.
pub const RATE: u32 = 22_050;
const FFT_SIZE: usize = 1024;
const HOP: usize = 256;
const BINS: usize = FFT_SIZE / 2 + 1;
const EMBEDDING: usize = 256;
/// How much the converter improvises. None: the same sound is then drawn the same way in two
/// overlapping windows, which is what lets consecutive blocks be joined without a seam.
const TAU: f32 = 0.0;

/// A reference recording is described in stretches of this length, then averaged.
const SEGMENT_SECONDS: usize = 10;
const REFERENCE_MAX_SECONDS: usize = 60;
const REFERENCE_MIN_SECONDS: f32 = 1.0;

/// Sound given to the converter at each step: what came before the block, the block itself,
/// and what came after it. The length never changes: the graphics card runs a model much slower
/// after its input changes size.
const WINDOW: usize = 68 * HOP;
/// New sound converted at each step. Shorter means less delay and more runs of the model.
/// A run takes about 50 ms on a mid-range graphics card whatever the length, but now and then
/// twice that: played in real time, blocks of 10 frames left gaps, blocks of 12 did not.
pub const BLOCK_FAST: usize = 12 * HOP;
/// In economy mode the model runs half as often, for a longer delay.
pub const BLOCK_ECONOMY: usize = 24 * HOP;
/// Sound after the block that is cross-faded with the start of the next one.
const FADE: usize = 2 * HOP;
/// How far a block may be moved to line its wave up with the end of the previous one: one
/// period of a low voice.
const SEARCH: usize = HOP;
/// Sound after all that, given to the model and never played. Measured against a conversion
/// of the whole recording at once: 4.3 dB off without it, 2.5 dB with 8 frames, 0.9 dB with
/// 16, 0.5 dB with 24. It is the larger part of the delay, and what makes the voice clean.
const GUARD: usize = 16 * HOP;
const AFTER: usize = FADE + SEARCH + GUARD;
/// Below this peak a window is silence: it is not worth a run of the model.
const SILENCE_PEAK: f32 = 0.004;
/// Speech of the user kept to describe their own voice, and how often it is described again.
const SOURCE_MAX: usize = 8 * RATE as usize;
const SOURCE_REFRESH: usize = RATE as usize;
const SOURCE_SPEECH_RMS: f32 = 0.015;

#[derive(Debug)]
pub enum VoiceError {
    ModelsMissing,
    InvalidAudio,
    Engine(String),
}

impl From<ort::Error> for VoiceError {
    fn from(err: ort::Error) -> Self {
        VoiceError::Engine(err.to_string())
    }
}

impl From<ort::Error<SessionBuilder>> for VoiceError {
    fn from(err: ort::Error<SessionBuilder>) -> Self {
        VoiceError::Engine(err.to_string())
    }
}

impl From<FaceError> for VoiceError {
    fn from(err: FaceError) -> Self {
        match err {
            FaceError::Engine(reason) => VoiceError::Engine(reason),
            _ => VoiceError::ModelsMissing,
        }
    }
}

impl From<VoiceError> for AppError {
    fn from(err: VoiceError) -> Self {
        AppError::new(match err {
            VoiceError::ModelsMissing => "voice_models_missing",
            VoiceError::InvalidAudio => "invalid_audio",
            VoiceError::Engine(_) => "voice_engine_failed",
        })
    }
}

/// Changes the sample rate of a stream, block after block. Each output sample is a weighted
/// sum of the input samples around it; frequencies the new rate cannot carry are removed.
pub struct Resampler {
    /// Input samples per output sample.
    step: f64,
    cutoff: f32,
    position: f64,
    buffer: Vec<f32>,
}

impl Resampler {
    /// Input samples used on each side of an output sample.
    const REACH: usize = 16;

    pub fn new(from: u32, to: u32) -> Self {
        let (from, to) = (from.max(1), to.max(1));
        Self {
            step: f64::from(from) / f64::from(to),
            cutoff: (to as f32 / from as f32).min(1.0) * 0.94,
            position: Self::REACH as f64,
            buffer: vec![0.0; Self::REACH],
        }
    }

    /// Adds the resampled `input` to `output`. What cannot be computed yet waits for more.
    pub fn process(&mut self, input: &[f32], output: &mut Vec<f32>) {
        self.buffer.extend_from_slice(input);
        let reach = Self::REACH as isize;
        while self.position as usize + Self::REACH < self.buffer.len() {
            let centre = self.position.floor();
            let offset = (self.position - centre) as f32;
            let (mut sum, mut weights) = (0.0, 0.0);
            for tap in 1 - reach..=reach {
                let distance = tap as f32 - offset;
                let weight = sinc(distance * self.cutoff)
                    * (0.5 + 0.5 * (std::f32::consts::PI * distance / reach as f32).cos());
                sum += weight * self.buffer[(centre as isize + tap) as usize];
                weights += weight;
            }
            output.push(sum / weights);
            self.position += self.step;
        }
        let done = (self.position as usize).saturating_sub(Self::REACH);
        self.buffer.drain(..done);
        self.position -= done as f64;
    }
}

fn sinc(x: f32) -> f32 {
    if x.abs() < 1e-6 {
        return 1.0;
    }
    let angle = std::f32::consts::PI * x;
    angle.sin() / angle
}

/// Resamples a whole recording at once.
fn resample(samples: &[f32], from: u32, to: u32) -> Vec<f32> {
    if from == to {
        return samples.to_vec();
    }
    let mut resampler = Resampler::new(from, to);
    let mut output = Vec::with_capacity(samples.len() * to as usize / from as usize + 1);
    resampler.process(samples, &mut output);
    // Enough silence to push the last samples through.
    resampler.process(&[0.0; 2 * Resampler::REACH], &mut output);
    output
}

/// Turns sound into the spectrogram the models read: how loud each of 513 frequencies is,
/// every 256 samples. Same framing as OpenVoice: the ends are mirrored, the window is a Hann.
struct Spectrum {
    fft: Arc<dyn Fft<f32>>,
    window: Vec<f32>,
}

impl Spectrum {
    fn new() -> Self {
        let window = (0..FFT_SIZE)
            .map(|n| 0.5 - 0.5 * (std::f32::consts::TAU * n as f32 / FFT_SIZE as f32).cos())
            .collect();
        Self { fft: FftPlanner::new().plan_fft_forward(FFT_SIZE), window }
    }

    /// One row of `BINS` magnitudes per frame. Sound shorter than the mirror is no frame.
    fn frames(&self, samples: &[f32]) -> Vec<[f32; BINS]> {
        let margin = (FFT_SIZE - HOP) / 2;
        if samples.len() <= margin {
            return Vec::new();
        }
        let last = samples.len() - 1;
        let padded: Vec<f32> = (0..samples.len() + 2 * margin)
            .map(|at| match at.checked_sub(margin) {
                None => samples[margin - at],
                Some(inside) if inside <= last => samples[inside],
                Some(beyond) => samples[2 * last - beyond],
            })
            .collect();

        let mut buffer = vec![Complex::new(0.0, 0.0); FFT_SIZE];
        padded
            .windows(FFT_SIZE)
            .step_by(HOP)
            .map(|frame| {
                for ((slot, sample), weight) in buffer.iter_mut().zip(frame).zip(&self.window) {
                    *slot = Complex::new(sample * weight, 0.0);
                }
                self.fft.process(&mut buffer);
                let mut row = [0.0; BINS];
                for (magnitude, value) in row.iter_mut().zip(&buffer) {
                    *magnitude = (value.norm_sqr() + 1e-6).sqrt();
                }
                row
            })
            .collect()
    }
}

/// Reads an audio file (WAV, MP3, FLAC, OGG or M4A) as mono samples with their rate.
fn decode(bytes: Vec<u8>, extension: &str) -> Result<(Vec<f32>, u32), VoiceError> {
    let invalid = |_| VoiceError::InvalidAudio;
    let source = MediaSourceStream::new(Box::new(Cursor::new(bytes)), Default::default());
    let mut hint = Hint::new();
    hint.with_extension(extension);
    let mut format = symphonia::default::get_probe()
        .format(&hint, source, &FormatOptions::default(), &MetadataOptions::default())
        .map_err(invalid)?
        .format;
    let track = format.default_track().ok_or(VoiceError::InvalidAudio)?;
    let track_id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(invalid)?;

    let (mut mono, mut rate) = (Vec::new(), 0);
    // The end of the file is reported as an error: whatever was read by then is the recording.
    while let Ok(packet) = format.next_packet() {
        if packet.track_id() != track_id {
            continue;
        }
        // A damaged packet is skipped, like a player would.
        let Ok(decoded) = decoder.decode(&packet) else { continue };
        let spec = *decoded.spec();
        let channels = spec.channels.count().max(1);
        rate = spec.rate;
        let mut samples = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        samples.copy_interleaved_ref(decoded);
        mono.extend(
            samples.samples().chunks(channels).map(|frame| frame.iter().sum::<f32>() / channels as f32),
        );
        if mono.len() >= rate as usize * REFERENCE_MAX_SECONDS {
            break;
        }
    }
    if rate == 0 || (mono.len() as f32) < rate as f32 * REFERENCE_MIN_SECONDS {
        return Err(VoiceError::InvalidAudio);
    }
    Ok((mono, rate))
}

/// Reads an audio file as mono samples at the models' rate.
pub fn read_audio(audio: Vec<u8>, extension: &str) -> Result<Vec<f32>, VoiceError> {
    let (samples, rate) = decode(audio, extension)?;
    Ok(resample(&samples, rate, RATE))
}

/// Description of a voice by the extractor.
pub type Embedding = Arc<Vec<f32>>;

struct VoiceEngine {
    extractor: Session,
    converter: Session,
    spectrum: Spectrum,
}

impl VoiceEngine {
    fn load(dir: &std::path::Path) -> Result<Self, VoiceError> {
        let read = |file: &str| std::fs::read(dir.join(file)).map_err(|_| VoiceError::ModelsMissing);
        Ok(Self {
            // The extractor is small and its input changes length: it is faster on the
            // processor, and leaves the graphics card to the converter and the face.
            extractor: Session::builder()?.commit_from_memory(&read(EXTRACTOR_FILE)?)?,
            converter: face::session(&read(CONVERTER_FILE)?)?,
            spectrum: Spectrum::new(),
        })
    }

    /// Describes the voice heard in `samples`, which are at the models' rate.
    fn embedding(&mut self, samples: &[f32]) -> Result<Vec<f32>, VoiceError> {
        let mut sum = vec![0.0; EMBEDDING];
        let mut segments = 0;
        for segment in samples.chunks(SEGMENT_SECONDS * RATE as usize) {
            let frames = self.spectrum.frames(segment);
            // The end of a recording may be too short to say anything about the voice.
            if frames.len() < 16 {
                continue;
            }
            let count = frames.len();
            let input = Tensor::from_array(([1, count, BINS], frames.concat()))?;
            let outputs = self.extractor.run(ort::inputs!["input" => input])?;
            let embedding = outputs[0].try_extract_tensor::<f32>()?.1;
            if embedding.len() != EMBEDDING {
                return Err(VoiceError::Engine("unexpected embedding size".into()));
            }
            sum.iter_mut().zip(embedding).for_each(|(total, value)| *total += value);
            segments += 1;
        }
        if segments == 0 {
            return Err(VoiceError::InvalidAudio);
        }
        sum.iter_mut().for_each(|value| *value /= segments as f32);
        Ok(sum)
    }

    /// Redraws `samples`, spoken with the voice `from`, in the voice `to`. Same length back.
    fn convert(&mut self, samples: &[f32], from: &[f32], to: &[f32]) -> Result<Vec<f32>, VoiceError> {
        let frames = self.spectrum.frames(samples);
        let count = frames.len();
        // The converter wants one row per frequency, the extractor one row per frame.
        let mut planes = vec![0.0; BINS * count];
        for (frame, row) in frames.iter().enumerate() {
            for (bin, value) in row.iter().enumerate() {
                planes[bin * count + frame] = *value;
            }
        }
        let outputs = self.converter.run(ort::inputs![
            "audio" => Tensor::from_array(([1, BINS, count], planes))?,
            "audio_length" => Tensor::from_array(([1], vec![count as i64]))?,
            "src_tone" => Tensor::from_array(([1, EMBEDDING, 1], from.to_vec()))?,
            "dest_tone" => Tensor::from_array(([1, EMBEDDING, 1], to.to_vec()))?,
            "tau" => Tensor::from_array(([1], vec![TAU]))?,
        ])?;
        let mut audio = outputs[0].try_extract_tensor::<f32>()?.1.to_vec();
        audio.resize(samples.len(), 0.0);
        Ok(audio)
    }
}

/// What the block cutting needs from the models. Lets it be tested without them.
pub trait Converter {
    fn describe(&mut self, speech: &[f32]) -> Option<Vec<f32>>;
    fn convert(&mut self, window: &[f32], source: &[f32]) -> Option<Vec<f32>>;
}

/// Cuts a live voice into blocks, converts them and joins them back. Works at the models'
/// rate; what comes out is what went in, about `AFTER` samples later.
pub struct Stream {
    block: usize,
    window: Vec<f32>,
    waiting: Vec<f32>,
    /// Converted sound after the previous block: the start of this one, heard in advance.
    tail: Vec<f32>,
    /// Speech of the user, and the description of their voice made from it.
    speech: Vec<f32>,
    described: usize,
    source: Option<Vec<f32>>,
}

impl Stream {
    pub fn new(block: usize) -> Self {
        Self {
            block: block.clamp(HOP, WINDOW - AFTER - HOP),
            window: vec![0.0; WINDOW],
            waiting: Vec::new(),
            tail: vec![0.0; FADE],
            speech: Vec::new(),
            described: 0,
            source: None,
        }
    }

    pub fn block(&self) -> usize {
        self.block
    }

    /// Changes the length of the blocks, and with it the delay and the load.
    pub fn set_block(&mut self, block: usize) {
        self.block = block.clamp(HOP, WINDOW - AFTER - HOP);
        self.restart();
    }

    /// Delay added by the block cutting itself, before the time the model takes.
    pub fn delay_seconds(&self) -> f32 {
        (self.block + AFTER) as f32 / RATE as f32
    }

    /// The description of the user's own voice, and how much speech it was made from.
    pub fn speaker(&self) -> Option<(&[f32], usize)> {
        self.source.as_deref().map(|source| (source, self.described))
    }

    /// Starts from a description made earlier, until enough is heard to make a new one.
    pub fn set_speaker(&mut self, source: Vec<f32>) {
        self.source = Some(source);
    }

    /// Forgets the sound in progress, not the voice of the user.
    pub fn restart(&mut self) {
        self.window.fill(0.0);
        self.waiting.clear();
        self.tail.fill(0.0);
    }

    /// Takes in new sound and adds to `output` every block that could be completed.
    pub fn push(&mut self, input: &[f32], converter: &mut impl Converter, output: &mut Vec<f32>) {
        self.waiting.extend_from_slice(input);
        let (block, context) = (self.block, WINDOW - self.block - AFTER);
        while self.waiting.len() >= block {
            self.window.drain(..block);
            self.window.extend(self.waiting.drain(..block));
            let converted = self.step(converter);
            // The block starts where it best continues the end of the previous one.
            let start = context + best_shift(&converted[context..context + SEARCH + FADE], &self.tail);
            let fade = |at: usize| {
                (std::f32::consts::FRAC_PI_2 * (at as f32 + 0.5) / FADE as f32).sin().powi(2)
            };
            output.extend(converted[start..start + block].iter().enumerate().map(
                |(at, sample)| match self.tail.get(at) {
                    Some(early) => early + (sample - early) * fade(at),
                    None => *sample,
                },
            ));
            self.tail.copy_from_slice(&converted[start + block..start + block + FADE]);
        }
    }

    /// Converts the current window. Silence, and anything the models fail on, is left as it is.
    fn step(&mut self, converter: &mut impl Converter) -> Vec<f32> {
        let fresh = &self.window[WINDOW - self.block..];
        let energy = fresh.iter().map(|sample| sample * sample).sum::<f32>() / self.block as f32;
        if energy.sqrt() >= SOURCE_SPEECH_RMS && self.speech.len() < SOURCE_MAX {
            self.speech.extend_from_slice(fresh);
        }
        let context = WINDOW - self.block - AFTER;
        if self.window[context..].iter().all(|sample| sample.abs() < SILENCE_PEAK) {
            return self.window.clone();
        }

        // The user's own voice is described again as more of it is heard, up to a few seconds.
        let due = self.source.is_none() || self.speech.len() >= self.described + SOURCE_REFRESH;
        if due {
            let heard = if self.speech.len() >= WINDOW { &self.speech } else { &self.window };
            if let Some(source) = converter.describe(heard) {
                self.source = Some(source);
                self.described = self.speech.len();
            }
        }
        self.source
            .as_deref()
            .and_then(|source| converter.convert(&self.window, source))
            .filter(|converted| converted.len() == WINDOW)
            .unwrap_or_else(|| self.window.clone())
    }
}

/// Where in `sound` the stretch most like `tail` begins: 0 up to `sound.len() − tail.len()`.
/// Two conversions of the same instant are the same wave, a few samples apart at most; joining
/// them out of step would cancel part of the voice at every block.
fn best_shift(sound: &[f32], tail: &[f32]) -> usize {
    if tail.iter().all(|sample| sample.abs() < 1e-4) {
        return 0;
    }
    let mut best = (0, f32::MIN);
    for shift in 0..=sound.len() - tail.len() {
        let stretch = &sound[shift..shift + tail.len()];
        let alike: f32 = stretch.iter().zip(tail).map(|(a, b)| a * b).sum();
        let loudness = stretch.iter().map(|a| a * a).sum::<f32>().sqrt() + 1e-6;
        if alike / loudness > best.1 {
            best = (shift, alike / loudness);
        }
    }
    best.0
}

/// The voice chosen by the user and the engine that applies it. The engine is loaded on first
/// use, like the face one.
pub struct VoiceClone {
    models: PathBuf,
    engine: Mutex<Option<VoiceEngine>>,
    target: Mutex<Option<Embedding>>,
    /// Mirrors `target`, for the audio callback, which must not wait on a lock held by a model.
    active: AtomicBool,
    /// The user's own voice as last described, and the amount of speech behind it. Kept from
    /// one start of the microphone to the next: the first seconds are then converted well too.
    speaker: Mutex<Option<(Vec<f32>, usize)>>,
}

impl VoiceClone {
    pub fn new(models: PathBuf) -> Self {
        Self {
            models,
            engine: Mutex::new(None),
            target: Mutex::new(None),
            active: AtomicBool::new(false),
            speaker: Mutex::new(None),
        }
    }

    fn with_engine<T>(
        &self,
        run: impl FnOnce(&mut VoiceEngine) -> Result<T, VoiceError>,
    ) -> Result<T, VoiceError> {
        let mut engine = self.engine.lock().unwrap();
        if engine.is_none() {
            *engine = Some(VoiceEngine::load(&self.models)?);
        }
        run(engine.as_mut().unwrap())
    }

    /// Describes the voice of a recording, given as an audio file.
    pub fn describe_file(&self, audio: Vec<u8>, extension: &str) -> Result<Vec<f32>, VoiceError> {
        let samples = read_audio(audio, extension)?;
        self.with_engine(|engine| engine.embedding(&samples))
    }

    /// Chooses the voice to speak with, from its reference recording.
    pub fn set_target(&self, audio: Vec<u8>, extension: &str) -> Result<(), VoiceError> {
        let embedding = self.describe_file(audio, extension)?;
        // The first run of the converter sets the graphics card up and takes seconds: better
        // now, while the interface shows the voice as loading, than on the first words spoken.
        let warm_up: Vec<f32> = (0..WINDOW).map(|n| ((n % 97) as f32 / 97.0 - 0.5) * 0.1).collect();
        self.with_engine(|engine| engine.convert(&warm_up, &embedding, &embedding))?;
        *self.target.lock().unwrap() = Some(Arc::new(embedding));
        self.active.store(true, Ordering::SeqCst);
        Ok(())
    }

    pub fn clear_target(&self) {
        self.active.store(false, Ordering::SeqCst);
        *self.target.lock().unwrap() = None;
    }

    pub fn speaker(&self) -> Option<Vec<f32>> {
        self.speaker.lock().unwrap().as_ref().map(|(source, _)| source.clone())
    }

    /// Keeps a description of the user's voice if it rests on more speech than the one held.
    pub fn remember_speaker(&self, source: &[f32], speech: usize) {
        let mut held = self.speaker.lock().unwrap();
        if held.as_ref().is_none_or(|(_, known)| speech > *known) {
            *held = Some((source.to_vec(), speech));
        }
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    pub fn target(&self) -> Option<Embedding> {
        self.target.lock().unwrap().clone()
    }

    /// The models, set to convert towards `target`.
    pub fn converter(&self, target: Embedding) -> impl Converter + '_ {
        Live { clone: self, target }
    }
}

struct Live<'a> {
    clone: &'a VoiceClone,
    target: Embedding,
}

impl Converter for Live<'_> {
    fn describe(&mut self, speech: &[f32]) -> Option<Vec<f32>> {
        self.clone.with_engine(|engine| engine.embedding(speech)).ok()
    }

    fn convert(&mut self, window: &[f32], source: &[f32]) -> Option<Vec<f32>> {
        self.clone.with_engine(|engine| engine.convert(window, source, &self.target)).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::TAU as TURN;

    fn sine(hz: f32, rate: u32, seconds: f32) -> Vec<f32> {
        (0..(seconds * rate as f32) as usize)
            .map(|n| (TURN * hz * n as f32 / rate as f32).sin() * 0.5)
            .collect()
    }

    fn loudest(samples: &[f32]) -> f32 {
        samples.iter().fold(0.0, |peak, sample| peak.max(sample.abs()))
    }

    #[test]
    fn resampling_keeps_pitch_and_level_and_removes_what_the_new_rate_cannot_carry() {
        let low = resample(&sine(440.0, 48_000, 1.0), 48_000, RATE);
        assert!((low.len() as i64 - i64::from(RATE)).abs() < 40, "{} samples", low.len());
        let middle = &low[2000..20_000];
        let rising = middle.windows(2).filter(|pair| pair[0] < 0.0 && pair[1] >= 0.0).count();
        let heard = rising as f32 * RATE as f32 / middle.len() as f32;
        assert!((heard - 440.0).abs() < 3.0, "{heard} Hz");
        assert!((loudest(middle) - 0.5).abs() < 0.01);

        // 15 kHz does not fit in 22 050 samples a second: it must not come back as another note.
        let high = resample(&sine(15_000.0, 48_000, 0.5), 48_000, RATE);
        assert!(loudest(&high[2000..8000]) < 0.02);

        // Going up changes nothing audible either.
        let up = resample(&sine(440.0, RATE, 0.5), RATE, 48_000);
        assert!((loudest(&up[4000..20_000]) - 0.5).abs() < 0.01);
    }

    #[test]
    fn resampling_block_by_block_is_the_same_as_all_at_once() {
        let input = sine(300.0, 44_100, 0.3);
        let mut whole = Vec::new();
        Resampler::new(44_100, RATE).process(&input, &mut whole);
        let mut pieces = Vec::new();
        let mut resampler = Resampler::new(44_100, RATE);
        for block in input.chunks(441) {
            resampler.process(block, &mut pieces);
        }
        assert_eq!(whole.len(), pieces.len());
        assert!(whole.iter().zip(&pieces).all(|(a, b)| (a - b).abs() < 1e-4));
    }

    #[test]
    fn a_spectrogram_has_one_frame_per_hop_and_peaks_at_the_note_played() {
        let spectrum = Spectrum::new();
        let frames = spectrum.frames(&sine(1000.0, RATE, 1.0)[..WINDOW]);
        assert_eq!(frames.len(), WINDOW / HOP);
        let row = &frames[frames.len() / 2];
        let peak = (0..BINS).max_by(|a, b| row[*a].total_cmp(&row[*b])).unwrap();
        let expected = (1000.0 * FFT_SIZE as f32 / RATE as f32).round() as usize;
        assert_eq!(peak, expected);
        assert!(spectrum.frames(&[0.0; 100]).is_empty());
    }

    /// Stands in for the models: gives the sound back, and counts what it was asked.
    #[derive(Default)]
    struct Echo {
        described: usize,
        converted: usize,
        broken: bool,
    }

    impl Converter for Echo {
        fn describe(&mut self, _: &[f32]) -> Option<Vec<f32>> {
            self.described += 1;
            Some(vec![0.0; EMBEDDING])
        }

        fn convert(&mut self, window: &[f32], _: &[f32]) -> Option<Vec<f32>> {
            self.converted += 1;
            (!self.broken).then(|| window.to_vec())
        }
    }

    #[test]
    fn blocks_are_joined_into_the_same_sound_a_little_later() {
        // Noise: unlike a steady note, it lines up with itself in one place only.
        let mut seed = 1u32;
        let input: Vec<f32> = (0..2 * RATE)
            .map(|_| {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                (seed >> 8) as f32 / (1 << 24) as f32 - 0.5
            })
            .collect();
        for block in [BLOCK_FAST, BLOCK_ECONOMY] {
            let mut stream = Stream::new(block);
            let (mut echo, mut output) = (Echo::default(), Vec::new());
            // Pushed in uneven pieces, as a microphone would.
            for piece in input.chunks(1000) {
                stream.push(piece, &mut echo, &mut output);
            }
            assert_eq!(output.len(), input.len() / block * block);
            assert!(output[..AFTER].iter().all(|sample| *sample == 0.0));
            for (late, early) in output[AFTER..].iter().zip(&input) {
                assert!((late - early).abs() < 1e-5);
            }
            assert_eq!(echo.converted, input.len() / block);
            assert!(echo.described >= 2, "the user's voice is described again as more is heard");
        }
    }

    #[test]
    fn silence_is_not_sent_to_the_models_and_a_failure_leaves_the_voice_as_it_is() {
        let mut stream = Stream::new(BLOCK_FAST);
        let (mut echo, mut output) = (Echo::default(), Vec::new());
        stream.push(&vec![0.001; 4 * BLOCK_FAST], &mut echo, &mut output);
        assert_eq!((echo.converted, echo.described), (0, 0));
        assert_eq!(output.len(), 4 * BLOCK_FAST);

        echo.broken = true;
        let input = sine(200.0, RATE, 1.0);
        output.clear();
        stream.restart();
        stream.push(&input, &mut echo, &mut output);
        assert!(echo.converted > 0);
        assert!((loudest(&output[BLOCK_FAST..]) - 0.5).abs() < 0.01);

        stream.set_block(BLOCK_ECONOMY);
        assert!((stream.delay_seconds() - 0.499).abs() < 0.001);
    }

    #[test]
    fn a_block_is_moved_to_where_its_wave_continues_the_previous_one() {
        let wave = sine(110.0, RATE, 0.2);
        let tail = &wave[300..300 + FADE];
        // The same wave, starting 37 samples earlier: the tail is found 37 samples in.
        assert_eq!(best_shift(&wave[263..263 + SEARCH + FADE], tail), 37);
        assert_eq!(best_shift(&wave[..SEARCH + FADE], &[0.0; FADE]), 0, "nothing to line up with");
    }

    #[test]
    fn a_file_that_is_not_audio_is_refused_and_a_wav_file_is_read() {
        assert!(matches!(decode(b"not audio".to_vec(), "wav"), Err(VoiceError::InvalidAudio)));
        let wav = crate::library::encode_wav(&sine(440.0, 16_000, 1.5), 16_000);
        let (samples, rate) = decode(wav, "wav").unwrap();
        assert_eq!((samples.len(), rate), (24_000, 16_000));
        assert!((loudest(&samples) - 0.5).abs() < 0.01);
        let short = crate::library::encode_wav(&[0.1; 4000], 16_000);
        assert!(matches!(decode(short, "wav"), Err(VoiceError::InvalidAudio)));
    }
}
