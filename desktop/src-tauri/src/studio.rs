//! Studio voices: voices trained in advance, one model each (RVC).
//!
//! A cloned voice (`voice.rs`) is described by a few seconds of recording and redrawn by one
//! general model. A studio voice is a model that was trained for hours on that one voice: it
//! is not made by the user, it comes with the application. The sound is fuller, at 48 kHz
//! instead of 22, and it needs less of the sound that follows.
//!
//! Three models work in turn on each window of sound: one hears what is said (ContentVec),
//! one hears at what pitch (RMVPE), and the voice itself says it again at the pitch asked. The
//! pitch is moved by itself to where the voice naturally speaks, whoever speaks to it.

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
};

use ort::{session::Session, value::Tensor};

use crate::{face, library::Profile, voice::VoiceError};

const CONTENT_FILE: &str = "content.onnx";
const PITCH_FILE: &str = "pitch.onnx";

/// Identifier of each voice, which is also the name of its model file, the name shown, and the
/// pitch it naturally speaks at, in hertz (the geometric mean of its training recordings).
const VOICES: [(&str, &str, f32); 1] = [("studio-serena", "Serena", 243.0)];

/// The models hear sound at this rate, and the voice speaks at that one.
pub const RATE_IN: u32 = 16_000;
pub const RATE_OUT: u32 = 48_000;
const UP: usize = (RATE_OUT / RATE_IN) as usize;

/// What the models are given each time: always the same length, as a graphics card is fast for
/// the first length it sees and several times slower for any other. The pitch model was
/// exported for this length exactly.
const WINDOW: usize = 20_480;
/// New sound converted each time: 200 ms.
const BLOCK: usize = 3_200;
/// Sound heard after the block before it is converted: 80 ms. The end of what a model draws
/// is the least well drawn, so the block is never the end.
const AHEAD: usize = 1_280;
/// Sound before the block, which the models only read: one second.
const CONTEXT: usize = WINDOW - BLOCK - AHEAD;

/// One row of content for 20 ms; the voice wants two, and so one pitch, for each.
const CONTENT_HOP: usize = 320;
const CONTENT_FIRST: usize = 400;
const CONTENT_SIZE: usize = 768;
const FRAMES: usize = ((WINDOW - CONTENT_FIRST) / CONTENT_HOP + 1) * 2;
/// The voice draws this many samples for each frame.
const FRAME_OUT: usize = RATE_OUT as usize / 100;
const BLOCK_OUT: usize = BLOCK * UP;
/// Two blocks are joined over 10 ms.
const FADE: usize = FRAME_OUT;
/// The same sound is not drawn with the same wave from one block to the next: a new block is
/// slid by up to 12 ms to where it best continues the last one.
const SEARCH: usize = 576;
const SEARCH_STEP: usize = 4;

/// The pitch model gives, for each 10 ms, how present each of these pitches is, 20 cents apart.
const PITCH_BINS: usize = 360;
const PITCH_FIRST_CENTS: f32 = 1_997.379_4;
/// Under this, no pitch: a consonant, a breath, silence.
const PITCH_PRESENT: f32 = 0.03;
/// The voice knows pitches between these, in 255 steps.
const PITCH_RANGE: (f32, f32) = (50.0, 1_100.0);
/// How far the pitch may be moved, either way: two octaves.
const SHIFT_MAX: f32 = 4.0;
/// The pitch of whoever speaks is averaged over this many frames with a pitch (30 s), then
/// follows slowly: one sentence said higher must not move the whole voice.
const SPEAKER_FRAMES: f32 = 3_000.0;

/// The level the models are given a voice at, and how far a microphone is brought to it.
const LEVEL_TARGET: f32 = 0.1;
const LEVEL_SPEECH: f32 = 0.004;
const GAIN_RANGE: (f32, f32) = (0.5, 25.0);
/// Under these, in the block and what follows it, no one speaks: nothing is played.
const SILENCE_RMS: f32 = 0.0015;
const SILENCE_PEAK: f32 = 0.006;

fn rms(samples: &[f32]) -> f32 {
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt()
}

/// The pitch of each frame, in hertz, from what the pitch model answers. 0 where there is none.
fn pitches(salience: &[f32]) -> Vec<f32> {
    salience
        .chunks_exact(PITCH_BINS)
        .map(|row| {
            let (centre, peak) = row
                .iter()
                .enumerate()
                .fold((0, f32::MIN), |best, (at, value)| if *value > best.1 { (at, *value) } else { best });
            if peak <= PITCH_PRESENT {
                return 0.0;
            }
            // The pitch lies between the bins: the weighted middle of those around the peak.
            let around = centre.saturating_sub(4)..(centre + 5).min(PITCH_BINS);
            let (mut cents, mut weight) = (0.0, 0.0);
            for bin in around {
                cents += row[bin] * (PITCH_FIRST_CENTS + 20.0 * bin as f32);
                weight += row[bin];
            }
            10.0 * 2f32.powf(cents / weight / 1_200.0)
        })
        .collect()
}

/// The step of the voice's pitch scale a pitch falls on. 1 is "no pitch".
fn pitch_step(hertz: f32) -> i64 {
    if hertz <= 0.0 {
        return 1;
    }
    let mel = |hertz: f32| 1_127.0 * (1.0 + hertz / 700.0).ln();
    let (low, high) = (mel(PITCH_RANGE.0), mel(PITCH_RANGE.1));
    ((mel(hertz) - low) * 254.0 / (high - low) + 1.0).round().clamp(1.0, 255.0) as i64
}

/// What the block cutting needs from the models. Lets it be tested without them.
pub trait Models {
    /// The pitch of a window, one value for each 10 ms, 0 where there is none.
    fn pitch(&mut self, window: &[f32]) -> Option<Vec<f32>>;
    /// The window said again by the voice at the pitches given, at `RATE_OUT`.
    fn speak(&mut self, window: &[f32], pitch: &[f32]) -> Option<Vec<f32>>;
    /// The pitch the voice naturally speaks at.
    fn natural_pitch(&self) -> f32;
}

/// Cuts a live voice into blocks, has them said again and joins them back. Takes sound at
/// `RATE_IN` and gives it at `RATE_OUT`, later by the block and the sound heard after it.
pub struct Stream {
    window: Vec<f32>,
    waiting: Vec<f32>,
    /// What the last block went on with: the start of this one, heard in advance.
    tail: Vec<f32>,
    /// Usual level of the speech heard, to bring it to the models' level.
    level: f32,
    /// Usual pitch of whoever speaks, as a logarithm, and the frames it was heard on.
    speaker: f32,
    heard: f32,
}

impl Default for Stream {
    fn default() -> Self {
        Self::new()
    }
}

impl Stream {
    pub fn new() -> Self {
        Self {
            window: vec![0.0; WINDOW],
            waiting: Vec::new(),
            tail: vec![0.0; FADE],
            level: LEVEL_TARGET,
            speaker: 0.0,
            heard: 0.0,
        }
    }

    /// Forgets the sound in progress, not what is known of whoever speaks.
    pub fn restart(&mut self) {
        self.window.fill(0.0);
        self.waiting.clear();
        self.tail.fill(0.0);
    }

    /// The delay between a sound and its conversion, the time the models take aside.
    pub fn delay_seconds() -> f32 {
        (BLOCK + AHEAD) as f32 / RATE_IN as f32
    }

    /// Takes in new sound and adds to `output` every block that could be completed.
    pub fn push(&mut self, input: &[f32], models: &mut impl Models, output: &mut Vec<f32>) {
        self.waiting.extend_from_slice(input);
        while self.waiting.len() >= BLOCK {
            self.window.drain(..BLOCK);
            self.window.extend(self.waiting.drain(..BLOCK));
            let spoken = self.step(models);
            // Where this block best goes on from the last one.
            let start = CONTEXT * UP;
            let mut shift = 0;
            if self.tail.iter().any(|sample| sample.abs() > 1e-4) {
                let mut best = f32::MIN;
                for slide in (0..=SEARCH).step_by(SEARCH_STEP) {
                    let head = &spoken[start + slide..start + slide + FADE];
                    let alike: f32 = head.iter().zip(&self.tail).map(|(a, b)| a * b).sum();
                    let alike = alike / (rms(head) * rms(&self.tail) * FADE as f32 + 1e-9);
                    if alike > best {
                        (best, shift) = (alike, slide);
                    }
                }
            }
            let block = &spoken[start + shift..start + shift + BLOCK_OUT + FADE];
            let fade = |at: usize| {
                (std::f32::consts::FRAC_PI_2 * (at as f32 + 0.5) / FADE as f32).sin().powi(2)
            };
            output.extend(block[..BLOCK_OUT].iter().enumerate().map(|(at, sample)| {
                match self.tail.get(at) {
                    Some(early) => early + (sample - early) * fade(at),
                    None => *sample,
                }
            }));
            self.tail.copy_from_slice(&block[BLOCK_OUT..]);
        }
    }

    /// Has the current window said again. Silence stays silence, and what the models fail on
    /// becomes silence too: the user's real voice must never be heard in place of the chosen
    /// one.
    fn step(&mut self, models: &mut impl Models) -> Vec<f32> {
        let silence = || vec![0.0; FRAMES * FRAME_OUT];
        let fresh = &self.window[CONTEXT..CONTEXT + BLOCK];
        let loud = rms(fresh);
        if loud > LEVEL_SPEECH {
            self.level += (loud - self.level) * 0.05;
        }
        let gain = (LEVEL_TARGET / self.level).clamp(GAIN_RANGE.0, GAIN_RANGE.1);
        let levelled: Vec<f32> = self.window.iter().map(|sample| sample * gain).collect();

        let recent = &self.window[CONTEXT..];
        let quiet = rms(recent) < SILENCE_RMS || recent.iter().all(|s| s.abs() < SILENCE_PEAK);
        // The models run even on silence, for nothing: a graphics card left alone for half a
        // second slows down, and the first words after a pause would come late.
        let Some(mut pitch) = models.pitch(&levelled) else {
            return silence();
        };
        pitch.resize(FRAMES, 0.0);

        // The pitch of whoever speaks, from the new block only: the rest was counted before.
        let first = CONTEXT / (RATE_IN as usize / 100);
        let last = (CONTEXT + BLOCK) / (RATE_IN as usize / 100);
        for hertz in pitch[first..last.min(FRAMES)].iter().filter(|hertz| **hertz > 0.0) {
            self.heard = (self.heard + 1.0).min(SPEAKER_FRAMES);
            self.speaker += (hertz.ln() - self.speaker) / self.heard;
        }
        if self.heard > 0.0 {
            let shift = (models.natural_pitch() / self.speaker.exp()).clamp(1.0 / SHIFT_MAX, SHIFT_MAX);
            pitch.iter_mut().for_each(|hertz| *hertz *= shift);
        }
        let spoken = models.speak(&levelled, &pitch).filter(|spoken| spoken.len() >= FRAMES * FRAME_OUT);
        match spoken {
            Some(spoken) if !quiet => spoken,
            _ => silence(),
        }
    }
}

struct Engine {
    content: Session,
    pitch: Session,
    voice: Session,
    natural_pitch: f32,
}

impl Engine {
    fn load(dir: &std::path::Path, id: &str, natural_pitch: f32) -> Result<Self, VoiceError> {
        let read = |file: &str| std::fs::read(dir.join(file)).map_err(|_| VoiceError::ModelsMissing);
        Ok(Self {
            content: face::session(&read(CONTENT_FILE)?)?,
            pitch: face::session(&read(PITCH_FILE)?)?,
            voice: face::session(&read(&format!("{id}.onnx"))?)?,
            natural_pitch,
        })
    }

    fn pitch(&mut self, window: &[f32]) -> Result<Vec<f32>, VoiceError> {
        let audio = Tensor::from_array(([1, WINDOW], window.to_vec()))?;
        let outputs = self.pitch.run(ort::inputs!["audio" => audio])?;
        Ok(pitches(outputs[0].try_extract_tensor::<f32>()?.1))
    }

    fn speak(&mut self, window: &[f32], pitch: &[f32]) -> Result<Vec<f32>, VoiceError> {
        let audio = Tensor::from_array(([1, WINDOW], window.to_vec()))?;
        let outputs = self.content.run(ort::inputs!["audio" => audio])?;
        let units = outputs[0].try_extract_tensor::<f32>()?.1;
        if units.len() != FRAMES / 2 * CONTENT_SIZE {
            return Err(VoiceError::Engine("unexpected content size".into()));
        }
        // Each row twice: the voice works at twice the rate of the content model.
        let mut feats = Vec::with_capacity(FRAMES * CONTENT_SIZE);
        for row in units.chunks_exact(CONTENT_SIZE) {
            feats.extend_from_slice(row);
            feats.extend_from_slice(row);
        }
        let steps: Vec<i64> = pitch.iter().map(|hertz| pitch_step(*hertz)).collect();
        let outputs = self.voice.run(ort::inputs![
            "feats" => Tensor::from_array(([1, FRAMES, CONTENT_SIZE], feats))?,
            "p_len" => Tensor::from_array(([1], vec![FRAMES as i64]))?,
            "pitch" => Tensor::from_array(([1, FRAMES], steps))?,
            "pitchf" => Tensor::from_array(([1, FRAMES], pitch.to_vec()))?,
            "sid" => Tensor::from_array(([1], vec![0i64]))?,
        ])?;
        Ok(outputs[0].try_extract_tensor::<f32>()?.1.to_vec())
    }
}

/// The studio voice chosen by the user, if any, and the models that speak with it. They are
/// loaded when a voice is chosen.
pub struct Studio {
    dir: PathBuf,
    engine: Mutex<Option<(String, Engine)>>,
    /// Mirrors `engine`, for the audio callback, which must not wait on a lock held by a model.
    active: AtomicBool,
}

impl Studio {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir, engine: Mutex::new(None), active: AtomicBool::new(false) }
    }

    fn known(id: &str) -> Option<&'static (&'static str, &'static str, f32)> {
        VOICES.iter().find(|(known, ..)| *known == id)
    }

    /// Whether `id` is one of these voices. Only the identifiers listed above are ever turned
    /// into a path.
    pub fn has(&self, id: &str) -> bool {
        Self::known(id).is_some()
    }

    /// The studio voices installed on this PC, with the two models they all need.
    pub fn list(&self) -> Vec<Profile> {
        let installed = |file: &str| self.dir.join(file).is_file();
        if !installed(CONTENT_FILE) || !installed(PITCH_FILE) {
            return Vec::new();
        }
        VOICES
            .iter()
            .filter(|(id, ..)| installed(&format!("{id}.onnx")))
            .map(|(id, name, _)| Profile::studio(id, name))
            .collect()
    }

    /// Chooses the voice to speak with. Loading its models and their first run take seconds:
    /// better now, while the interface shows the voice as loading, than on the first words.
    pub fn select(&self, id: &str) -> Result<(), VoiceError> {
        let (id, _, natural_pitch) = Self::known(id).ok_or(VoiceError::ModelsMissing)?;
        let mut held = self.engine.lock().unwrap();
        if held.as_ref().is_none_or(|(loaded, _)| loaded != id) {
            self.active.store(false, Ordering::SeqCst);
            *held = None;
            let mut engine = Engine::load(&self.dir, id, *natural_pitch)?;
            let warm_up: Vec<f32> = (0..WINDOW).map(|n| ((n % 97) as f32 / 97.0 - 0.5) * 0.1).collect();
            let pitch = engine.pitch(&warm_up)?;
            engine.speak(&warm_up, &pitch[..FRAMES.min(pitch.len())])?;
            *held = Some((id.to_string(), engine));
        }
        self.active.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// Goes back to no studio voice, and gives the graphics card its memory back.
    pub fn clear(&self) {
        self.active.store(false, Ordering::SeqCst);
        *self.engine.lock().unwrap() = None;
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }

    /// The models of the chosen voice.
    pub fn models(&self) -> impl Models + '_ {
        Live { studio: self }
    }
}

struct Live<'a> {
    studio: &'a Studio,
}

impl Live<'_> {
    fn with<T>(&self, run: impl FnOnce(&mut Engine) -> Result<T, VoiceError>) -> Option<T> {
        let mut held = self.studio.engine.lock().unwrap();
        held.as_mut().and_then(|(_, engine)| run(engine).ok())
    }
}

impl Models for Live<'_> {
    fn pitch(&mut self, window: &[f32]) -> Option<Vec<f32>> {
        self.with(|engine| engine.pitch(window))
    }

    fn speak(&mut self, window: &[f32], pitch: &[f32]) -> Option<Vec<f32>> {
        self.with(|engine| engine.speak(window, pitch))
    }

    fn natural_pitch(&self) -> f32 {
        let held = self.studio.engine.lock().unwrap();
        held.as_ref().map_or(1.0, |(_, engine)| engine.natural_pitch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Models that say the window again as it is, three times finer, and hear one pitch.
    struct Echo {
        heard: f32,
        asked: Vec<f32>,
        fails: bool,
    }

    impl Models for Echo {
        fn pitch(&mut self, _: &[f32]) -> Option<Vec<f32>> {
            Some(vec![self.heard; FRAMES + 3])
        }

        fn speak(&mut self, window: &[f32], pitch: &[f32]) -> Option<Vec<f32>> {
            self.asked = pitch.to_vec();
            if self.fails {
                return None;
            }
            let fine = window.iter().flat_map(|sample| [*sample; UP]);
            Some(fine.take(FRAMES * FRAME_OUT).collect())
        }

        fn natural_pitch(&self) -> f32 {
            200.0
        }
    }

    fn note(hz: f32, seconds: f32, level: f32) -> Vec<f32> {
        (0..(seconds * RATE_IN as f32) as usize)
            .map(|n| (std::f32::consts::TAU * hz * n as f32 / RATE_IN as f32).sin() * level)
            .collect()
    }

    #[test]
    fn the_window_is_cut_as_the_models_were_exported() {
        assert_eq!(CONTEXT, RATE_IN as usize);
        assert_eq!(FRAMES, 126);
        // The block, its fade and the search all fit in what the voice draws.
        assert!(CONTEXT * UP + SEARCH + BLOCK_OUT + FADE <= FRAMES * FRAME_OUT);
    }

    #[test]
    fn blocks_are_joined_into_the_same_sound_a_little_later() {
        // At the level the models are given: the stream then leaves it as it is.
        let sound = note(200.0, 2.0, LEVEL_TARGET * 2f32.sqrt());
        let (mut stream, mut models, mut out) =
            (Stream::new(), Echo { heard: 200.0, asked: Vec::new(), fails: false }, Vec::new());
        // Uneven pieces, as a microphone hands them over.
        for piece in sound.chunks(441) {
            stream.push(piece, &mut models, &mut out);
        }
        assert_eq!(out.len(), sound.len() / BLOCK * BLOCK_OUT);
        // The note comes out whole: no gap, no jump where two blocks meet.
        let settled = &out[2 * BLOCK_OUT..];
        assert!((rms(settled) - LEVEL_TARGET).abs() < 0.005, "level {}", rms(settled));
        let jump = settled.windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max);
        // This note moves by 0.011 from one sample heard to the next at most.
        assert!(jump < 0.02, "jump of {jump} between two samples");
    }

    #[test]
    fn the_pitch_is_moved_to_where_the_voice_speaks() {
        let sound = note(100.0, 1.0, 0.1);
        let (mut stream, mut models, mut out) =
            (Stream::new(), Echo { heard: 100.0, asked: Vec::new(), fails: false }, Vec::new());
        stream.push(&sound, &mut models, &mut out);
        // A man at 100 Hz speaking to a voice at 200 Hz: every pitch is doubled.
        assert_eq!(models.asked.len(), FRAMES);
        assert!(models.asked.iter().all(|hertz| (hertz - 200.0).abs() < 0.5), "{:?}", &models.asked[..3]);
    }

    #[test]
    fn silence_is_played_as_nothing_and_so_is_a_failure() {
        let (mut stream, mut out) = (Stream::new(), Vec::new());
        let mut models = Echo { heard: 0.0, asked: Vec::new(), fails: false };
        stream.push(&vec![0.0005; 2 * BLOCK], &mut models, &mut out);
        assert!(out.iter().all(|sample| *sample == 0.0));

        let mut failing = Echo { heard: 150.0, asked: Vec::new(), fails: true };
        out.clear();
        stream.push(&note(150.0, 0.5, 0.2), &mut failing, &mut out);
        assert!(!out.is_empty() && out.iter().all(|sample| *sample == 0.0));
    }

    #[test]
    fn a_pitch_is_read_between_the_bins_and_placed_on_the_voice_scale() {
        // All the presence on one bin: its own pitch.
        let mut row = vec![0.0; PITCH_BINS];
        row[150] = 0.9;
        let cents = PITCH_FIRST_CENTS + 20.0 * 150.0;
        let hertz = pitches(&row)[0];
        assert!((hertz - 10.0 * 2f32.powf(cents / 1_200.0)).abs() < 0.01, "{hertz}");
        // Too faint: no pitch.
        row[150] = 0.02;
        assert_eq!(pitches(&row)[0], 0.0);

        assert_eq!(pitch_step(0.0), 1);
        assert_eq!(pitch_step(50.0), 1);
        assert_eq!(pitch_step(1_100.0), 255);
        assert!(pitch_step(200.0) > pitch_step(100.0));
    }

    #[test]
    fn only_installed_voices_are_listed() {
        let dir = std::env::temp_dir().join(format!("studio-test-{:032x}", rand::random::<u128>()));
        std::fs::create_dir_all(&dir).unwrap();
        let studio = Studio::new(dir.clone());
        assert!(studio.list().is_empty());
        std::fs::write(dir.join("studio-serena.onnx"), b"model").unwrap();
        // A voice without the two models it needs cannot speak.
        assert!(studio.list().is_empty());
        std::fs::write(dir.join(CONTENT_FILE), b"model").unwrap();
        std::fs::write(dir.join(PITCH_FILE), b"model").unwrap();
        assert_eq!(studio.list().len(), 1);
        assert!(studio.has("studio-serena") && !studio.has("../studio-serena"));
        assert!(!studio.is_active());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
