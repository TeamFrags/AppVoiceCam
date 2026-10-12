//! Voice cloning: makes the voice heard by the microphone sound like a reference recording.
//!
//! Two models from OpenVoice V2 (MIT licence) do the work. The extractor turns a few seconds
//! of speech into a 256-number description of a voice. The converter redraws a stretch of
//! speech, given the description of the voice it has and of the voice it should have. Both
//! read a spectrogram at 22 050 Hz and need no training: one recording is enough.
//!
//! The converter is not built for live use, so the stream is cut into short blocks. Each block
//! is converted together with the sound around it, which the model needs to draw it well: what
//! it draws near the end of its input, without knowing what comes next, is rough. Far enough
//! from both ends, it draws the very same wave whatever it was given around: the blocks are
//! then simply put end to end, with a short cross-fade.

use std::{
    io::Cursor,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
};

use ort::{
    session::{builder::SessionBuilder, Session},
    value::Tensor,
};
use rustfft::{num_complex::Complex, Fft, FftPlanner};
use sha2::{Digest, Sha256};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, formats::FormatOptions, io::MediaSourceStream,
    meta::MetadataOptions, probe::Hint,
};

use crate::{
    error::AppError,
    face::{self, FaceError},
    studio::Studio,
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
/// A stretch of a reference recording this far below its loudest one is a pause, not a voice.
const REFERENCE_PAUSE: f32 = 0.06;

/// Sound given to the converter at each step: what came before the block, the block itself,
/// what came after it, and the mirror. The length never changes: the graphics card is set up
/// for the first length it is given, and runs any other five times slower (30 ms against 150,
/// measured on a mid-range card). Longer costs little: 24 ms for 48 frames, 36 for 128.
const WINDOW: usize = 112 * HOP;
/// The end of the sound heard so far, played backwards after it: it stands in for the sound
/// that is not there yet. The model draws the end of its input badly because nothing follows;
/// with this, what it draws 15 frames from the end is as good as 22 frames from it without.
const MIRROR: usize = 24 * HOP;
/// Real sound in a window. The same for every way of cutting the stream.
const HEARD: usize = WINDOW - MIRROR;
/// New sound converted at each step. Shorter means less delay and more runs of the model.
const BLOCK_FAST: usize = 12 * HOP;
/// In economy mode the model runs half as often, for a longer delay.
const BLOCK_ECONOMY: usize = 24 * HOP;
/// Sound after the block that is cross-faded with the start of the next one. Short: where the
/// blocks meet, both are the same wave.
const FADE: usize = HOP;
/// Real sound given after the block, cross-fade included. It is most of the delay, and what
/// makes the voice clean: the user chooses how much of it to give, as an effort from 0 to 3.
/// Measured on a man's voice turned into a woman's, as the likeness (1 is the same wave) of
/// each frame to a conversion of the whole recording at once, by distance from the end of the
/// real sound: 0.85 at 10 frames, 0.98 at 15, 0.99 at 19, 1.00 from 25.
const AHEAD: [usize; 5] = [11 * HOP, 16 * HOP, 20 * HOP, 26 * HOP, 44 * HOP];
pub const EFFORT_DEFAULT: u8 = 2;
pub const EFFORT_MAX: u8 = AHEAD.len() as u8 - 1;
/// The model needs this much sound before a block to draw it like the whole recording.
const CONTEXT_MIN: usize = 24 * HOP;

/// How the stream is cut: the length of the blocks and of the sound given after them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Layout {
    block: usize,
    ahead: usize,
}

impl Layout {
    /// More effort is a cleaner voice and more delay. Economy halves the runs of the model.
    pub fn new(effort: u8, economy: bool) -> Self {
        let block = if economy { BLOCK_ECONOMY } else { BLOCK_FAST };
        Self {
            block,
            // Never so much sound after the block that too little is left before it.
            ahead: AHEAD[usize::from(effort.min(EFFORT_MAX))].min(HEARD - block - CONTEXT_MIN),
        }
    }

    fn context(&self) -> usize {
        HEARD - self.block - self.ahead
    }

    /// Length of a block, in seconds: how often the model runs.
    pub fn block_seconds(&self) -> f32 {
        self.block as f32 / RATE as f32
    }

    /// Delay added by the cutting itself, before the time the model takes.
    pub fn delay_seconds(&self) -> f32 {
        (self.block + self.ahead) as f32 / RATE as f32
    }
}

impl Default for Layout {
    fn default() -> Self {
        Self::new(EFFORT_DEFAULT, false)
    }
}
/// The models were trained on speech at one loudness and draw anything quieter badly: measured
/// against the same speech at full level, 4.5 dB off at a third of it and 5.4 dB at a tenth. A
/// microphone is often quieter than that, so every voice is first brought to this level: the
/// loudness (RMS) of its speech, pauses left out.
const LEVEL_TARGET: f32 = 0.11;
/// Sound is weighed over stretches of this length.
const LEVEL_STRETCH: usize = 12 * HOP;
/// A stretch counts as speech when it is at least this loud, compared with the speech so far.
const LEVEL_SPEECH: f32 = 0.3;
/// How long it takes the live level to follow a voice that gets louder, and one that gets
/// quieter. Slow on the way down: a soft word is not a change of volume.
const LEVEL_RISE_SECONDS: f32 = 0.4;
const LEVEL_FALL_SECONDS: f32 = 30.0;
/// A soft word is brought up to the level of the rest for the models, by this much at most,
/// and brought back down once drawn: it is heard as softly as it was said. Left soft, it was
/// drawn badly (measured against the same speech at full level: 3.4 dB off at a third of the
/// level, 5.0 dB at a tenth) and, below a twentieth, taken for silence and not played at all.
const LIFT_MAX: f32 = 12.0;
/// Quieter than this, a microphone hears no one yet: its hiss is left as it is.
const LEVEL_FLOOR: f32 = 0.004;
/// Speech stands at least this far above the background of the room. Brought up as if it were
/// a voice, the background would be redrawn by the models as a crackling one.
const LEVEL_OVER_NOISE: f32 = 3.0;
/// The background is the quietest the microphone has been lately: it follows at once when the
/// sound gets quieter, and over this long when it gets louder.
const NOISE_RISE_SECONDS: f32 = 20.0;
const GAIN_RANGE: (f32, f32) = (0.25, 25.0);
/// No levelled sample may pass this: beyond 1 the sound is cut flat, which crackles.
const LEVEL_CEILING: f32 = 0.98;
/// Below this peak or this loudness, once levelled, a window is silence: nothing is played,
/// and it is not worth a run of the model.
const SILENCE_PEAK: f32 = 0.02;
const SILENCE_RMS: f32 = 0.006;
/// The converter must be told whose voice it hears, and what it draws depends a great deal on
/// that description: one made from a second or two of speech gives another timbre than one made
/// from half a minute, and each new one changes the voice heard. So the user's own voice is
/// described again only at these amounts of speech, in seconds, then kept for good.
const SOURCE_STEPS: [usize; 4] = [3, 8, 16, 30];
const SOURCE_MAX: usize = SOURCE_STEPS[SOURCE_STEPS.len() - 1] * RATE as usize;
const SOURCE_SPEECH_RMS: f32 = 0.03;

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

fn rms(samples: &[f32]) -> f32 {
    (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len().max(1) as f32).sqrt()
}

/// What to multiply a voice by to bring it to the level the models expect, given the loudness
/// of its speech.
fn gain_for(speech: f32) -> f32 {
    if speech < LEVEL_FLOOR {
        return 1.0;
    }
    (LEVEL_TARGET / speech).clamp(GAIN_RANGE.0, GAIN_RANGE.1)
}

/// Brings a whole recording to the level the models expect.
pub fn levelled(mut samples: Vec<f32>) -> Vec<f32> {
    let stretches: Vec<f32> = samples.chunks(LEVEL_STRETCH).map(rms).collect();
    let loudest = stretches.iter().copied().fold(0.0, f32::max);
    let speech: Vec<f32> =
        stretches.into_iter().filter(|level| *level >= loudest * LEVEL_SPEECH).collect();
    let energy = speech.iter().map(|level| level * level).sum::<f32>() / speech.len().max(1) as f32;
    let gain = gain_for(energy.sqrt());
    samples.iter_mut().for_each(|sample| *sample *= gain);
    samples
}

/// Keeps the speech of a reference recording and drops its pauses. A description is an average
/// over the whole recording: the silence before the first word, the breaths and the room would
/// be averaged into the voice.
pub fn speech_only(samples: &[f32]) -> Vec<f32> {
    let loudest = samples.chunks(LEVEL_STRETCH).map(rms).fold(0.0, f32::max);
    let speech: Vec<f32> = samples
        .chunks(LEVEL_STRETCH)
        .filter(|stretch| rms(stretch) >= loudest * REFERENCE_PAUSE)
        .flatten()
        .copied()
        .collect();
    // Too little left to describe anything: the recording is used as it is.
    if (speech.len() as f32) < RATE as f32 * REFERENCE_MIN_SECONDS {
        return samples.to_vec();
    }
    speech
}

/// Does the same for a live voice: follows the loudness of its speech and turns the gain
/// smoothly.
struct Leveller {
    speech: f32,
    /// Loudness of the room when no one speaks. None until something was heard.
    noise: Option<f32>,
    gain: f32,
    /// How much more the sound now going in is brought up, for being softer than the rest.
    lift: f32,
    /// Off: the sound is left as it is.
    on: bool,
}

impl Leveller {
    fn new() -> Self {
        Self { speech: 0.0, noise: None, gain: 1.0, lift: 1.0, on: true }
    }

    /// Levels a block in place, and adds to `lifts`, for each of its samples, how much it was
    /// brought up for being soft: what the models draw from it is to be divided by that. The
    /// gain glides over the block: a jump would be a click.
    fn apply(&mut self, block: &mut [f32], lifts: &mut Vec<f32>) {
        if !self.on {
            lifts.extend(std::iter::repeat(1.0).take(block.len()));
            return;
        }
        let level = rms(block);
        let glide = |seconds: f32| 1.0 - (-(block.len() as f32) / (RATE as f32 * seconds)).exp();
        // The room is what is left in the gaps of speech, which are shorter than a block: the
        // quietest moment of the block. Weighed over the whole block, a few seconds of speech
        // without a pause passed for a louder room, and a soft word after them for its noise.
        let low = block.chunks_exact(HOP).map(rms).fold(level, f32::min);
        let noise = match self.noise {
            Some(noise) if low > noise => noise + (low - noise) * glide(NOISE_RISE_SECONDS),
            _ => low,
        };
        self.noise = Some(noise);
        let voiced = level >= LEVEL_FLOOR && level >= noise * LEVEL_OVER_NOISE;
        if voiced {
            if self.speech < LEVEL_FLOOR {
                // The first speech heard is all there is to go by.
                self.speech = level;
            } else if level >= self.speech * LEVEL_SPEECH {
                let seconds =
                    if level > self.speech { LEVEL_RISE_SECONDS } else { LEVEL_FALL_SECONDS };
                self.speech += (level - self.speech) * glide(seconds);
            }
        }
        // A sound louder than the speech so far would be pushed beyond what a sample can hold.
        let peak = block.iter().fold(0.0f32, |peak, sample| peak.max(sample.abs()));
        let ceiling = LEVEL_CEILING / peak.max(1e-9);
        let (from, to) = (self.gain.min(ceiling), gain_for(self.speech).min(ceiling));
        // Only a voice is brought up: the room, between two soft words, is left where it is.
        let lift_max = std::env::var("APP_LIFT_MAX").ok().and_then(|v| v.parse().ok()).unwrap_or(LIFT_MAX); // TEMP
        let lift = if voiced { (self.speech / level).clamp(1.0, lift_max) } else { 1.0 };
        let (lifted_from, lifted_to) =
            ((self.gain * self.lift).min(ceiling).max(from), (to * lift).min(ceiling));
        let last = block.len().max(2) as f32 - 1.0;
        for (at, sample) in block.iter_mut().enumerate() {
            let turn = at as f32 / last;
            let (plain, lifted) =
                (from + (to - from) * turn, lifted_from + (lifted_to - lifted_from) * turn);
            *sample *= lifted;
            lifts.push(lifted / plain);
        }
        self.gain = to;
        self.lift = lifted_to / to;
    }
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
        let mut weight = 0.0;
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
            // A short last stretch says less about the voice than a full one.
            let share = count as f32;
            sum.iter_mut().zip(embedding).for_each(|(total, value)| *total += value * share);
            weight += share;
        }
        if weight == 0.0 {
            return Err(VoiceError::InvalidAudio);
        }
        sum.iter_mut().for_each(|value| *value /= weight);
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
/// rate; what comes out is what went in, later by the sound given after each block.
pub struct Stream {
    layout: Layout,
    window: Vec<f32>,
    /// For each sample of the window, how much it was brought up for being soft.
    lifts: Vec<f32>,
    waiting: Vec<f32>,
    /// Converted sound after the previous block: the start of this one, heard in advance.
    tail: Vec<f32>,
    /// Speech of the user, and the description of their voice made from it.
    speech: Vec<f32>,
    described: usize,
    source: Option<Vec<f32>>,
    leveller: Leveller,
}

impl Stream {
    pub fn new(layout: Layout) -> Self {
        Self {
            layout,
            window: vec![0.0; HEARD],
            lifts: vec![1.0; HEARD],
            waiting: Vec::new(),
            tail: vec![0.0; FADE],
            speech: Vec::new(),
            described: 0,
            source: None,
            leveller: Leveller::new(),
        }
    }

    pub fn layout(&self) -> Layout {
        self.layout
    }

    /// Whether the voice is brought to the models' level first. It is, unless told otherwise.
    pub fn set_levelling(&mut self, on: bool) {
        self.leveller.on = on;
    }

    /// Changes how the stream is cut, and with it the quality, the delay and the load.
    pub fn set_layout(&mut self, layout: Layout) {
        self.layout = layout;
        self.restart();
    }

    /// The description of the user's own voice, and how much speech it was made from.
    pub fn speaker(&self) -> Option<(&[f32], usize)> {
        self.source.as_deref().map(|source| (source, self.described))
    }

    /// Starts from a description made earlier from `speech` samples of speech. It is replaced
    /// only by one made from more.
    pub fn set_speaker(&mut self, source: Vec<f32>, speech: usize) {
        self.source = Some(source);
        self.described = speech;
    }

    /// Forgets the sound in progress, not the voice of the user.
    pub fn restart(&mut self) {
        self.window.fill(0.0);
        self.lifts.fill(1.0);
        self.waiting.clear();
        self.tail.fill(0.0);
    }

    /// Takes in new sound and adds to `output` every block that could be completed.
    pub fn push(&mut self, input: &[f32], converter: &mut impl Converter, output: &mut Vec<f32>) {
        self.waiting.extend_from_slice(input);
        let (block, context) = (self.layout.block, self.layout.context());
        while self.waiting.len() >= block {
            self.window.drain(..block);
            let fresh = self.window.len();
            self.window.extend(self.waiting.drain(..block));
            self.lifts.drain(..block);
            self.leveller.apply(&mut self.window[fresh..], &mut self.lifts);
            let mut converted = self.step(converter);
            // What was said softly is heard softly.
            converted.iter_mut().zip(&self.lifts).for_each(|(sample, lift)| *sample /= lift);
            // Both conversions of the start of the block are the same wave: no lining up.
            let start = context;
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

    /// Converts the current window. Silence stays silence: what a microphone hears when no one
    /// speaks is its own hiss, which is not played. What the models fail on becomes silence
    /// too: the user's real voice must never be heard in place of the chosen one.
    fn step(&mut self, converter: &mut impl Converter) -> Vec<f32> {
        let fresh = &self.window[HEARD - self.layout.block..];
        if rms(fresh) >= SOURCE_SPEECH_RMS && self.speech.len() < SOURCE_MAX {
            self.speech.extend_from_slice(fresh);
        }
        let recent = &self.window[self.layout.context()..];
        if rms(recent) < SILENCE_RMS || recent.iter().all(|sample| sample.abs() < SILENCE_PEAK) {
            // The model still runs, for nothing: a graphics card left alone for half a second
            // slows down, and the first words after a pause would come late (measured: 50 to
            // 200 ms for a run instead of 32), which is a gap in the sound.
            // Whose voice it is told to hear does not matter: nothing of it is kept.
            let mut padded = self.window.clone();
            padded.resize(WINDOW, 0.0);
            converter.convert(&padded, self.source.as_deref().unwrap_or(&[0.0; EMBEDDING]));
            return vec![0.0; HEARD];
        }

        // The user's own voice is described again when a step more of it has been heard.
        let heard = self.speech.len();
        let step = SOURCE_STEPS.iter().map(|seconds| seconds * RATE as usize);
        let due = self.source.is_none()
            || step.rev().any(|step| self.described < step && step <= heard);
        if due {
            let heard = if self.speech.len() >= HEARD { &self.speech } else { &self.window };
            if let Some(source) = converter.describe(heard) {
                self.source = Some(source);
                self.described = self.speech.len();
            }
        }
        // The mirror: the end of the sound, backwards, in place of what is not heard yet.
        let mut padded = self.window.clone();
        padded.extend(self.window[HEARD - MIRROR..].iter().rev());
        self.source
            .as_deref()
            .and_then(|source| converter.convert(&padded, source))
            .filter(|converted| converted.len() == WINDOW)
            .map(|mut converted| {
                converted.truncate(HEARD);
                converted
            })
            .unwrap_or_else(|| vec![0.0; HEARD])
    }
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
    /// one start of the microphone to the next, and in `memory` from one run of the application
    /// to the next: the first words are then converted as well as the rest.
    speaker: Mutex<Option<(Vec<f32>, usize)>>,
    /// Folder of the descriptions, one file per microphone: the same person sounds different
    /// through another one, and a description made on the wrong input spoils every voice.
    memory: Option<PathBuf>,
    file: Mutex<Option<PathBuf>>,
    /// Goes up each time the description held is no longer the one to use: whoever converts
    /// starts afresh.
    epoch: AtomicU32,
    /// The voices trained in advance, which another engine speaks with. One or the other is
    /// chosen, never both.
    pub studio: Studio,
}

impl VoiceClone {
    pub fn new(models: PathBuf) -> Self {
        Self {
            studio: Studio::new(models.join("studio")),
            models,
            engine: Mutex::new(None),
            target: Mutex::new(None),
            active: AtomicBool::new(false),
            speaker: Mutex::new(None),
            memory: None,
            file: Mutex::new(None),
            epoch: AtomicU32::new(0),
        }
    }

    /// Keeps the descriptions of the user's own voice in `folder`. Each is 256 numbers: no
    /// sound can be rebuilt from it.
    pub fn remembering(mut self, folder: PathBuf) -> Self {
        self.memory = Some(folder);
        self
    }

    /// Says which microphone the user speaks into from now on: the description made through
    /// it earlier is read back, or the voice is learnt again.
    pub fn listen_to(&self, microphone: &str) {
        let mut held = self.speaker.lock().unwrap();
        let file = self.memory.as_ref().map(|folder| {
            let name: String =
                Sha256::digest(microphone).iter().take(8).map(|byte| format!("{byte:02x}")).collect();
            folder.join(format!("{name}.bin"))
        });
        *held = file.as_ref().and_then(|file| std::fs::read(file).ok()).and_then(|bytes| {
            let (speech, numbers) = bytes.split_at(bytes.len().min(8));
            (numbers.len() == EMBEDDING * 4).then(|| {
                let source =
                    numbers.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]));
                let speech = u64::from_le_bytes(speech.try_into().unwrap_or_default()) as usize;
                (source.collect(), speech)
            })
        });
        *self.file.lock().unwrap() = file;
        self.epoch.fetch_add(1, Ordering::SeqCst);
    }

    /// Forgets the user's own voice as heard through the current microphone: it is learnt
    /// again from the next words. For another person, or a description gone wrong.
    pub fn forget_speaker(&self) {
        let mut held = self.speaker.lock().unwrap();
        *held = None;
        if let Some(file) = &*self.file.lock().unwrap() {
            let _ = std::fs::remove_file(file);
        }
        self.epoch.fetch_add(1, Ordering::SeqCst);
    }

    pub fn epoch(&self) -> u32 {
        self.epoch.load(Ordering::SeqCst)
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
        let samples = levelled(speech_only(&read_audio(audio, extension)?));
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
        self.studio.clear();
        Ok(())
    }

    /// Chooses a studio voice to speak with, in place of a cloned one.
    pub fn set_studio(&self, id: &str) -> Result<(), VoiceError> {
        self.studio.select(id)?;
        self.active.store(false, Ordering::SeqCst);
        *self.target.lock().unwrap() = None;
        Ok(())
    }

    pub fn clear_target(&self) {
        self.active.store(false, Ordering::SeqCst);
        *self.target.lock().unwrap() = None;
        self.studio.clear();
    }

    pub fn speaker(&self) -> Option<(Vec<f32>, usize)> {
        self.speaker.lock().unwrap().clone()
    }

    /// Keeps a description of the user's voice if it rests on more speech than the one held.
    /// `epoch` is the one read before the description was made: one made before the voice
    /// was forgotten, or through another microphone, is not kept.
    pub fn remember_speaker(&self, source: &[f32], speech: usize, epoch: u32) {
        let mut held = self.speaker.lock().unwrap();
        if epoch != self.epoch() || held.as_ref().is_some_and(|(_, known)| speech <= *known) {
            return;
        }
        *held = Some((source.to_vec(), speech));
        if let Some(file) = &*self.file.lock().unwrap() {
            if let Some(folder) = file.parent() {
                let _ = std::fs::create_dir_all(folder);
            }
            let mut bytes = (speech as u64).to_le_bytes().to_vec();
            bytes.extend(source.iter().flat_map(|value| value.to_le_bytes()));
            // Not being able to save it only means describing the voice again next time.
            let _ = std::fs::write(file, bytes);
        }
    }

    /// Whether a voice is chosen, cloned or from the studio.
    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed) || self.studio.is_active()
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
        let frames = spectrum.frames(&sine(1000.0, RATE, 2.0)[..WINDOW]);
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
        let layouts = (0..=EFFORT_MAX).flat_map(|effort| [false, true].map(|eco| Layout::new(effort, eco)));
        for layout in layouts {
            let (block, after) = (layout.block, layout.ahead);
            assert!(layout.context() >= CONTEXT_MIN, "the model keeps its bearings: {layout:?}");
            let mut stream = Stream::new(layout);
            stream.set_levelling(false);
            let (mut echo, mut output) = (Echo::default(), Vec::new());
            // Pushed in uneven pieces, as a microphone would.
            for piece in input.chunks(1000) {
                stream.push(piece, &mut echo, &mut output);
            }
            assert_eq!(output.len(), input.len() / block * block);
            assert!(output[..after].iter().all(|sample| *sample == 0.0));
            for (late, early) in output[after..].iter().zip(&input) {
                assert!((late - early).abs() < 1e-5);
            }
            assert_eq!(echo.converted, input.len() / block);
            assert_eq!(echo.described, 1, "two seconds of speech: one description so far");
        }
    }

    #[test]
    fn silence_is_played_as_nothing_and_so_is_a_failure() {
        let mut stream = Stream::new(Layout::default());
        let (mut echo, mut output) = (Echo::default(), Vec::new());
        // As quiet as the hiss of a microphone: not brought up, not taken for the user's voice,
        // not played. The model runs all the same, to stay ready.
        stream.push(&vec![0.001; 4 * BLOCK_FAST], &mut echo, &mut output);
        assert_eq!((echo.converted, echo.described), (4, 0));
        assert_eq!(output, vec![0.0; 4 * BLOCK_FAST]);
        echo.converted = 0;

        echo.broken = true;
        let input = sine(200.0, RATE, 1.0);
        output.clear();
        stream.restart();
        stream.push(&input, &mut echo, &mut output);
        assert!(echo.converted > 0);
        // Not the user's real voice: nothing.
        assert!(output.iter().all(|sample| *sample == 0.0));

        // More effort is more sound given after each block, so more delay.
        let delays: Vec<f32> = (0..=EFFORT_MAX).map(|e| Layout::new(e, false).delay_seconds()).collect();
        assert!(delays.windows(2).all(|pair| pair[1] > pair[0] + 0.04), "{delays:?}");
        assert!((Layout::default().delay_seconds() - 0.372).abs() < 0.001);
        assert_eq!(Layout::new(200, false), Layout::new(EFFORT_MAX, false));
        stream.set_layout(Layout::new(EFFORT_MAX, true));
        assert_eq!(stream.layout().block, BLOCK_ECONOMY);
    }

    #[test]
    fn a_quiet_voice_and_a_loud_one_reach_the_models_at_the_same_level() {
        for volume in [0.02, 0.2, 1.0] {
            // A moment of quiet first: a sound there from the start is taken for the room.
            let mut input = vec![0.0; BLOCK_FAST];
            input.extend(sine(200.0, RATE, 2.0).iter().map(|s| s * volume));
            let mut stream = Stream::new(Layout::default());
            let (mut echo, mut output) = (Echo::default(), Vec::new());
            stream.push(&input, &mut echo, &mut output);
            let settled = &output[output.len() / 2..];
            assert!((rms(settled) - LEVEL_TARGET).abs() < 0.01, "{volume}: {}", rms(settled));
            // No click where the gain turns: no sample jumps more than the note itself does.
            let steepest = output.windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max);
            assert!(steepest < 0.2, "{volume}: jump of {steepest}");
        }

        let quiet: Vec<f32> = sine(200.0, RATE, 3.0).iter().map(|s| s * 0.05).collect();
        assert!((rms(&levelled(quiet)) - LEVEL_TARGET).abs() < 0.01);
        assert_eq!(gain_for(0.001), 1.0, "hiss is not a voice");
        assert_eq!(gain_for(0.0041), GAIN_RANGE.1);
    }

    #[test]
    fn the_background_of_a_room_is_not_brought_up_as_if_it_were_a_voice() {
        let mut seed = 5u32;
        let mut hiss = |level: f32| {
            seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            ((seed >> 8) as f32 / (1 << 23) as f32 - 1.0) * level
        };
        // Two seconds of hiss alone, louder than the quietest voice the leveller accepts.
        let mut input: Vec<f32> = (0..2 * RATE).map(|_| hiss(0.012)).collect();
        let quiet = input.len();
        input.extend(sine(200.0, RATE, 2.0).iter().map(|s| s * 0.1 + hiss(0.012)));
        let mut stream = Stream::new(Layout::default());
        let (mut echo, mut output) = (Echo::default(), Vec::new());
        stream.push(&input, &mut echo, &mut output);
        // Nothing is played until the voice comes into view, and the voice reaches its level.
        assert!(output[..quiet - HEARD].iter().all(|sample| *sample == 0.0));
        let settled = &output[output.len() - RATE as usize / 2..];
        assert!((rms(settled) - LEVEL_TARGET).abs() < 0.02, "{}", rms(settled));

        // A shout after a whisper is turned down at once, not cut flat.
        let mut leveller = Leveller::new();
        let mut whisper: Vec<f32> = sine(200.0, RATE, 0.5).iter().map(|s| s * 0.02).collect();
        let mut lifts = Vec::new();
        leveller.apply(&mut vec![0.0; BLOCK_FAST], &mut lifts);
        leveller.apply(&mut whisper, &mut lifts);
        let mut shout = sine(200.0, RATE, 0.1).iter().map(|s| s * 1.6).collect::<Vec<f32>>();
        leveller.apply(&mut shout, &mut lifts);
        assert!(loudest(&shout) <= 1.0, "{}", loudest(&shout));
    }

    /// Gives the sound back, and keeps how loud the newest sound it was given has been.
    #[derive(Default)]
    struct Listener {
        heard: Vec<f32>,
    }

    impl Converter for Listener {
        fn describe(&mut self, _: &[f32]) -> Option<Vec<f32>> {
            Some(vec![0.0; EMBEDDING])
        }

        fn convert(&mut self, window: &[f32], _: &[f32]) -> Option<Vec<f32>> {
            self.heard.push(rms(&window[HEARD - BLOCK_FAST..HEARD]));
            Some(window.to_vec())
        }
    }

    #[test]
    fn a_soft_word_reaches_the_models_at_full_level_and_is_heard_as_softly_as_it_was_said() {
        for soft in [0.3, 0.1, 0.04] {
            let second = RATE as usize;
            let mut input = vec![0.0; BLOCK_FAST];
            // Words: a short pause every half second, as in speech.
            input.extend(sine(200.0, RATE, 6.0).iter().enumerate().map(|(n, sample)| {
                let word = if n % (second / 2) < second / 10 { 0.0 } else { 1.0 };
                sample * word * if (2 * second..4 * second).contains(&n) { soft } else { 1.0 }
            }));
            let mut stream = Stream::new(Layout::default());
            let (mut listener, mut output) = (Listener::default(), Vec::new());
            stream.push(&input, &mut listener, &mut output);
            let delay = BLOCK_FAST + Layout::default().ahead;
            let part = |from: f32, to: f32| {
                rms(&output[delay + (from * RATE as f32) as usize..delay + (to * RATE as f32) as usize])
            };
            let (loud, quiet, back) = (part(1.0, 1.9), part(2.6, 3.9), part(4.6, 5.5));
            assert!((quiet / loud - soft).abs() < soft * 0.1, "{soft}: heard at {}", quiet / loud);
            assert!((back / loud - 1.0).abs() < 0.05, "{soft}: back at {}", back / loud);
            // The models were given the soft stretch as loud as the rest, or near enough.
            let blocks = |seconds: f32| (seconds * RATE as f32) as usize / BLOCK_FAST;
            let given = &listener.heard[blocks(2.6)..blocks(3.9)];
            let most = given.iter().copied().fold(0.0, f32::max);
            assert!(most > LEVEL_TARGET * (soft * LIFT_MAX).min(1.0) * 0.8, "{soft}: given at {most}");
            // No click where the sound is brought up or back down.
            let steepest = output.windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max);
            assert!(steepest < 0.02, "{soft}: jump of {steepest}");
        }
    }

    #[test]
    fn the_users_voice_is_described_at_a_few_steps_only_and_remembered() {
        let speech = sine(200.0, RATE, 9.0);
        let mut stream = Stream::new(Layout::default());
        let (mut echo, mut output) = (Echo::default(), Vec::new());
        stream.push(&speech, &mut echo, &mut output);
        assert_eq!(echo.described, 3, "at the first sound, then after 3 and 8 seconds of speech");
        let (_, heard) = stream.speaker().unwrap();
        assert!(heard >= 8 * RATE as usize);

        // A description that rests on more speech is not replaced by a fresh, poorer one.
        let mut next = Stream::new(Layout::default());
        next.set_speaker(vec![1.0; EMBEDDING], heard);
        echo.described = 0;
        next.push(&speech[..5 * RATE as usize], &mut echo, &mut output);
        assert_eq!(echo.described, 0);

        let folder = std::env::temp_dir().join(format!("speaker-test-{}", rand::random::<u64>()));
        let clone = VoiceClone::new(PathBuf::new()).remembering(folder.clone());
        clone.listen_to("headset");
        assert!(clone.speaker().is_none());
        clone.remember_speaker(&[0.5; EMBEDDING], 1000, clone.epoch());
        clone.remember_speaker(&[0.1; EMBEDDING], 10, clone.epoch());
        let reopened = VoiceClone::new(PathBuf::new()).remembering(folder.clone());
        assert!(reopened.speaker().is_none(), "no microphone yet");
        reopened.listen_to("headset");
        assert_eq!(reopened.speaker(), Some((vec![0.5; EMBEDDING], 1000)));

        // Each microphone has its own description, and forgetting one leaves the others.
        let before = reopened.epoch();
        reopened.listen_to("webcam");
        assert!(reopened.speaker().is_none());
        // A description made while the other microphone was in use comes too late.
        reopened.remember_speaker(&[0.9; EMBEDDING], 5000, before);
        assert!(reopened.speaker().is_none());
        reopened.remember_speaker(&[0.2; EMBEDDING], 50, reopened.epoch());
        reopened.forget_speaker();
        assert!(reopened.speaker().is_none());
        reopened.listen_to("webcam");
        assert!(reopened.speaker().is_none(), "forgotten on disk too");
        reopened.listen_to("headset");
        assert_eq!(reopened.speaker(), Some((vec![0.5; EMBEDDING], 1000)));
        let _ = std::fs::remove_dir_all(folder);
    }

    #[test]
    fn the_pauses_of_a_reference_recording_are_left_out() {
        let word = sine(200.0, RATE, 2.0);
        let mut recording = vec![0.0; 3 * RATE as usize];
        recording.extend(&word);
        recording.extend(vec![0.0005; 2 * RATE as usize]);
        recording.extend(&word);
        let speech = speech_only(&recording);
        let kept = speech.len() as f32 / RATE as f32;
        assert!((kept - 4.0).abs() < 0.5, "{kept} s kept");
        assert!(rms(&speech) > 0.3);
        // A recording with next to nothing in it is left alone.
        let mut blip = vec![0.0; 2 * RATE as usize];
        blip[..2000].copy_from_slice(&word[..2000]);
        assert_eq!(speech_only(&blip).len(), blip.len());
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
