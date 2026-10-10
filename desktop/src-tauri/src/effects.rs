//! Voice effects and the monitor that plays the microphone back to the user.
//!
//! The effects are plain signal processing on mono samples, one at a time: nothing here needs
//! a model. The monitor is a short queue between the microphone callback, which fills it, and
//! the speaker callback, which empties it at its own sample rate.
//!
//! With a cloned voice chosen, the models stand in between: the microphone callback only hands
//! its sound over, and a thread of its own converts it, applies the effect and fills the queue.

use std::{
    collections::VecDeque,
    f32::consts::{PI, TAU},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc, Condvar, Mutex,
    },
    time::Duration,
};

use serde::Deserialize;

use crate::{
    denoise::{self, Denoiser},
    voice::{self, Layout, Resampler, Stream, VoiceClone},
};

/// Length of the two overlapping grains of the pitch shifter.
const PITCH_WINDOW_SECONDS: f32 = 0.045;
const DEEP_RATIO: f32 = 0.74;
const HIGH_RATIO: f32 = 1.45;
const ROBOT_HZ: f32 = 55.0;
const ECHO_SECONDS: f32 = 0.26;
const ECHO_FEEDBACK: f32 = 0.42;
const RADIO_LOW_HZ: f32 = 450.0;
const RADIO_HIGH_HZ: f32 = 2600.0;
const RADIO_DRIVE: f32 = 3.5;
/// Fade at the start of the sound, and when the speaker runs out of it: never a clean cut,
/// which is heard as a click.
const FADE_SECONDS: f32 = 0.004;
/// The store is watched over this many stretches of this length. The least it held in all of
/// them is what a late block would have found: more than the reserve is delay for nothing.
const WATCH_SECONDS: f32 = 1.0;
const WATCH_STRETCHES: usize = 10;
/// The store is brought back to its reserve by playing this much faster or slower at most:
/// too little to be heard, and enough to follow two sound cards that do not agree on time.
const SPEED_TRIM: f64 = 0.01;
/// More than this above the reserve, a slow moment has left the voice far behind: the surplus
/// is dropped at once, between two fades.
const SKIP_SECONDS: f32 = 0.25;
/// Each time the speaker runs out, the reserve grows; it shrinks back slowly afterwards.
const RESERVE_MAX_SECONDS: f32 = 0.3;
/// Microphone sound the models may have in store. More means they cannot keep up.
const CLONE_PENDING_SECONDS: f32 = 0.75;
/// How often the conversion thread looks up when no sound arrives.
const CLONE_POLL: Duration = Duration::from_millis(50);
/// What a run of the models usually takes on a mid-range graphics card: part of the delay
/// shown to the user.
const CLONE_RUN_SECONDS: f32 = 0.04;
/// What the noise reduction and the changes of sample rate hold back.
const CLONE_CLEAN_SECONDS: f32 = 0.02;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VoiceEffect {
    #[default]
    None,
    Deep,
    High,
    Robot,
    Echo,
    Radio,
}

impl VoiceEffect {
    fn from_code(code: u8) -> Self {
        [Self::Deep, Self::High, Self::Robot, Self::Echo, Self::Radio]
            .into_iter()
            .find(|effect| *effect as u8 == code)
            .unwrap_or_default()
    }
}

/// What the user chose for the microphone: read by the audio callbacks, set by the commands.
pub struct VoiceSettings {
    monitor: AtomicBool,
    effect: AtomicU8,
    /// How much delay is spent on a cleaner cloned voice: see `voice::Layout`.
    effort: AtomicU8,
    /// Name of the output the monitor is played on. Empty: the default one.
    output: Mutex<String>,
}

impl Default for VoiceSettings {
    fn default() -> Self {
        Self {
            monitor: AtomicBool::new(false),
            effect: AtomicU8::new(0),
            effort: AtomicU8::new(voice::EFFORT_DEFAULT),
            output: Mutex::default(),
        }
    }
}

/// Delay between speaking and hearing the cloned voice, in milliseconds, for an effort.
pub fn clone_delay_ms(effort: u8, economy: bool) -> u32 {
    let seconds =
        Layout::new(effort, economy).delay_seconds()
        + CLONE_CLEAN_SECONDS
        + CLONE_RUN_SECONDS
        + Flow::Blocks.lead();
    (seconds * 100.0).round() as u32 * 10
}

impl VoiceSettings {
    pub fn set_effort(&self, effort: u8) {
        self.effort.store(effort.min(voice::EFFORT_MAX), Ordering::SeqCst);
    }

    pub fn effort(&self) -> u8 {
        self.effort.load(Ordering::Relaxed)
    }

    pub fn set_output(&self, name: String) {
        *self.output.lock().unwrap() = name;
    }

    pub fn output(&self) -> String {
        self.output.lock().unwrap().clone()
    }

    pub fn set_monitor(&self, on: bool) {
        self.monitor.store(on, Ordering::SeqCst);
    }

    pub fn monitor(&self) -> bool {
        self.monitor.load(Ordering::Relaxed)
    }

    pub fn set_effect(&self, effect: VoiceEffect) {
        self.effect.store(effect as u8, Ordering::SeqCst);
    }

    pub fn effect(&self) -> VoiceEffect {
        VoiceEffect::from_code(self.effect.load(Ordering::Relaxed))
    }
}

/// Circular memory of the last samples, read back at a fractional distance.
struct DelayLine {
    samples: Vec<f32>,
    write: usize,
}

impl DelayLine {
    fn new(len: usize) -> Self {
        Self { samples: vec![0.0; len.max(4)], write: 0 }
    }

    fn push(&mut self, sample: f32) {
        self.samples[self.write] = sample;
        self.write = (self.write + 1) % self.samples.len();
    }

    /// The sample pushed `delay` samples ago (1 is the latest), interpolated.
    fn read(&self, delay: f32) -> f32 {
        let len = self.samples.len();
        let delay = delay.clamp(1.0, (len - 2) as f32);
        let whole = delay.floor();
        let fraction = delay - whole;
        let at = |back: usize| self.samples[(self.write + len - back) % len];
        at(whole as usize) * (1.0 - fraction) + at(whole as usize + 1) * fraction
    }

    fn clear(&mut self) {
        self.samples.fill(0.0);
    }
}

/// Applies the chosen effect to a stream of mono samples.
pub struct Processor {
    rate: f32,
    effect: VoiceEffect,
    pitch: DelayLine,
    pitch_window: f32,
    pitch_phase: f32,
    echo: DelayLine,
    echo_delay: f32,
    robot_phase: f32,
    low: f32,
    high: f32,
}

impl Processor {
    pub fn new(rate: u32) -> Self {
        let rate = rate.max(1) as f32;
        let pitch_window = PITCH_WINDOW_SECONDS * rate;
        let echo_delay = ECHO_SECONDS * rate;
        Self {
            rate,
            effect: VoiceEffect::None,
            pitch: DelayLine::new(pitch_window as usize + 4),
            pitch_window,
            pitch_phase: 0.0,
            echo: DelayLine::new(echo_delay as usize + 4),
            echo_delay,
            robot_phase: 0.0,
            low: 0.0,
            high: 0.0,
        }
    }

    pub fn process(&mut self, effect: VoiceEffect, sample: f32) -> f32 {
        if effect != self.effect {
            // What the previous effect remembered must not be heard in the new one.
            self.effect = effect;
            self.pitch.clear();
            self.echo.clear();
            (self.low, self.high) = (0.0, 0.0);
        }
        let out = match effect {
            VoiceEffect::None => sample,
            VoiceEffect::Deep => self.shift(sample, DEEP_RATIO),
            VoiceEffect::High => self.shift(sample, HIGH_RATIO),
            VoiceEffect::Robot => {
                self.robot_phase = (self.robot_phase + ROBOT_HZ / self.rate).fract();
                sample * (TAU * self.robot_phase).sin() * 1.4
            }
            VoiceEffect::Echo => {
                let past = self.echo.read(self.echo_delay);
                self.echo.push(sample + past * ECHO_FEEDBACK);
                sample + past * 0.6
            }
            VoiceEffect::Radio => {
                // A narrow band, pushed until it clips softly.
                let pole = |hz: f32| 1.0 - (-TAU * hz / self.rate).exp();
                self.low += pole(RADIO_HIGH_HZ) * (sample - self.low);
                self.high += pole(RADIO_LOW_HZ) * (self.low - self.high);
                ((self.low - self.high) * RADIO_DRIVE).tanh()
            }
        };
        out.clamp(-1.0, 1.0)
    }

    /// Changes the pitch by `ratio` without changing the speed: two read heads slide along
    /// the recent past, half a grain apart, each one silent at the moment it jumps back.
    fn shift(&mut self, sample: f32, ratio: f32) -> f32 {
        self.pitch.push(sample);
        self.pitch_phase = (self.pitch_phase + (1.0 - ratio) / self.pitch_window).rem_euclid(1.0);
        let mut out = 0.0;
        for offset in [0.0, 0.5] {
            let phase = (self.pitch_phase + offset).fract();
            let gain = (PI * phase).sin().powi(2);
            out += gain * self.pitch.read(1.0 + phase * self.pitch_window);
        }
        out
    }
}

/// How sound reaches the store: a little at a time from the microphone, or a whole block at
/// once from the voice models, which may be late.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Flow {
    Steady,
    Blocks,
}

impl Flow {
    /// Silence put in front of the first sound, so the following one may be late, in seconds.
    fn lead(self) -> f32 {
        match self {
            Flow::Steady => 0.04,
            Flow::Blocks => 0.1,
        }
    }

    /// Least sound to keep in store at the worst moment, in seconds.
    fn reserve(self) -> f32 {
        match self {
            Flow::Steady => 0.01,
            Flow::Blocks => 0.07,
        }
    }
}

/// The sound waiting between whoever makes it and the speaker, which takes it at its own
/// sample rate and in its own time: some sound cards ask for 10 ms every 10 ms, others for
/// three times that in one go, then nothing for a while.
///
/// It never cuts the sound. It starts and ends on a fade, keeps as little in store as the
/// last seconds have shown to be safe, and gets there by playing a hair faster or slower.
pub struct Playout {
    queue: VecDeque<f32>,
    rate: f32,
    /// Stored samples used for each speaker sample, before the speed trim.
    step: f64,
    speed: f64,
    position: f64,
    playing: bool,
    gain: f32,
    fade: f32,
    /// Sound still to be faded in after a start.
    rising: usize,
    flow: Flow,
    /// Extra reserve learnt from running out, in samples.
    learnt: usize,
    /// Least held in each of the last stretches, and in the current one.
    lows: [usize; WATCH_STRETCHES],
    low: usize,
    stretch: usize,
    watched: f64,
    calm: usize,
    /// Sound to drop once faded out.
    skip: usize,
    /// How many times the speaker ran out of sound: each one is heard as a short gap.
    pub gaps: u32,
}

/// Shared by the thread that makes the sound and the speaker callback.
pub type MonitorQueue = Arc<Mutex<Playout>>;

impl Playout {
    /// `rate` is that of the sound pushed in. The speaker's is given when it opens.
    pub fn new(rate: u32) -> Self {
        let rate = rate.max(1) as f32;
        Self {
            queue: VecDeque::new(),
            rate,
            step: 1.0,
            speed: 1.0,
            position: 0.0,
            playing: false,
            gain: 0.0,
            fade: (FADE_SECONDS * rate).max(1.0),
            rising: 0,
            flow: Flow::Steady,
            learnt: 0,
            lows: [usize::MAX; WATCH_STRETCHES],
            low: usize::MAX,
            stretch: 0,
            watched: 0.0,
            calm: 0,
            skip: 0,
            gaps: 0,
        }
    }

    /// Starts afresh for a speaker of this sample rate.
    pub fn open(&mut self, speaker_rate: u32) {
        *self = Self { step: f64::from(self.rate) / f64::from(speaker_rate.max(1)), ..Self::new(self.rate as u32) };
    }

    fn samples(&self, seconds: f32) -> usize {
        (seconds * self.rate) as usize
    }

    fn reserve(&self) -> usize {
        self.samples(self.flow.reserve()) + self.learnt
    }

    /// Sound in store, in seconds: part of the delay between speaking and hearing.
    pub fn held_seconds(&self) -> f32 {
        self.queue.len() as f32 / self.rate
    }

    fn forget_lows(&mut self) {
        self.lows = [usize::MAX; WATCH_STRETCHES];
        self.low = usize::MAX;
        self.watched = 0.0;
        self.speed = 1.0;
    }

    /// Adds sound. The first sound after a silence starts behind a short wait and on a fade.
    pub fn push(&mut self, sound: impl Iterator<Item = f32>, flow: Flow) {
        if flow != self.flow {
            self.flow = flow;
            self.forget_lows();
        }
        if !self.playing {
            self.queue.clear();
            let lead = self.samples(flow.lead()) + self.learnt;
            self.queue.extend(std::iter::repeat(0.0).take(lead));
            (self.playing, self.position, self.gain) = (true, 0.0, 1.0);
            self.rising = self.fade as usize;
            self.forget_lows();
        }
        for sample in sound {
            let gain = 1.0 - self.rising as f32 / self.fade;
            self.rising = self.rising.saturating_sub(1);
            self.queue.push_back(sample * gain);
        }
    }

    /// Fills `out` with the next speaker samples. Silence when there is nothing to play.
    pub fn pull(&mut self, out: &mut [f32]) {
        for slot in out.iter_mut() {
            *slot = self.next();
        }
        if !self.playing {
            return;
        }
        self.low = self.low.min(self.queue.len());
        self.watched += out.len() as f64 * self.step;
        if self.watched >= f64::from(WATCH_SECONDS * self.rate) {
            self.watched = 0.0;
            self.lows[self.stretch] = self.low;
            self.stretch = (self.stretch + 1) % WATCH_STRETCHES;
            self.low = usize::MAX;
            self.settle();
        }
    }

    /// Steers the store towards its reserve, from the least it held lately.
    fn settle(&mut self) {
        let least = self.lows.iter().copied().min().unwrap_or(usize::MAX);
        if least == usize::MAX {
            return;
        }
        let spare = (least as f32 - self.reserve() as f32) / self.rate;
        if spare > SKIP_SECONDS {
            self.skip = self.samples(spare - self.flow.lead());
            return;
        }
        // A tenth of the surplus each second: slow enough to hold a steady speed.
        let trim = (f64::from(spare) * 0.1).clamp(-SPEED_TRIM, SPEED_TRIM);
        self.speed = if spare.abs() < 0.003 { 1.0 } else { 1.0 + trim };
        // A reserve learnt the hard way is given back little by little.
        self.calm += 1;
        if self.calm >= WATCH_STRETCHES {
            self.calm = 0;
            self.learnt = self.learnt * 9 / 10;
        }
    }

    fn next(&mut self) -> f32 {
        if !self.playing {
            return 0.0;
        }
        // Four samples are read around the position: one before, three from it on.
        if self.queue.len() < 4 {
            self.playing = false;
            self.queue.clear();
            self.gaps += 1;
            self.calm = 0;
            let more = self.learnt + self.learnt / 2 + self.samples(0.02);
            self.learnt = more.min(self.samples(RESERVE_MAX_SECONDS));
            return 0.0;
        }
        let left = (self.queue.len() - 4) as f32 / self.fade;
        let wanted = if self.skip > 0 { 0.0 } else { left.min(1.0) };
        self.gain = if wanted < self.gain {
            wanted.max(self.gain - 1.0 / self.fade)
        } else {
            wanted.min(self.gain + 1.0 / self.fade)
        };
        if self.skip > 0 && self.gain <= 0.0 {
            let dropped = self.skip.min(self.queue.len().saturating_sub(8));
            self.queue.drain(..dropped);
            self.skip = 0;
            self.forget_lows();
        }
        // A smooth curve through the four samples (Catmull-Rom): at the same rate and speed
        // it gives the samples back untouched.
        let (a, b, c, d) = (self.queue[0], self.queue[1], self.queue[2], self.queue[3]);
        let t = self.position as f32;
        let value = b
            + 0.5 * t * (c - a + t * (2.0 * a - 5.0 * b + 4.0 * c - d + t * (3.0 * (b - c) + d - a)));
        self.position += self.step * self.speed;
        while self.position >= 1.0 && self.queue.len() > 4 {
            self.position -= 1.0;
            self.queue.pop_front();
        }
        if self.position >= 1.0 {
            // The store ran dry in the middle of a step: the fade has already reached silence.
            self.position = 0.0;
            self.queue.pop_front();
        }
        value * self.gain
    }
}

/// Microphone sound waiting for the voice models, at the microphone's rate.
#[derive(Default)]
pub struct Pending {
    samples: Mutex<Vec<f32>>,
    arrived: Condvar,
}

/// Microphone side of the monitor: mixes each block to mono, then either applies the effect
/// and queues it, or hands it to the voice models when a cloned voice is chosen.
pub struct MonitorFeed {
    settings: Arc<VoiceSettings>,
    queue: MonitorQueue,
    processor: Processor,
    clone: Arc<VoiceClone>,
    pending: Arc<Pending>,
    pending_limit: usize,
}

impl MonitorFeed {
    pub fn new(
        settings: Arc<VoiceSettings>,
        queue: MonitorQueue,
        rate: u32,
        clone: Arc<VoiceClone>,
        pending: Arc<Pending>,
    ) -> Self {
        Self {
            settings,
            queue,
            processor: Processor::new(rate),
            clone,
            pending,
            pending_limit: (CLONE_PENDING_SECONDS * rate as f32) as usize,
        }
    }

    pub fn push<T: cpal::Sample>(&mut self, data: &[T], channels: usize)
    where
        f32: cpal::FromSample<T>,
    {
        if !self.settings.monitor() {
            return;
        }
        let mono = data.chunks(channels.max(1)).map(|frame| {
            let sum: f32 = frame.iter().map(|s| <f32 as cpal::Sample>::from_sample(*s)).sum();
            sum / frame.len() as f32
        });
        if self.clone.is_active() {
            let mut waiting = self.pending.samples.lock().unwrap();
            // Too far behind to catch up: start again from now.
            if waiting.len() > self.pending_limit {
                waiting.clear();
            }
            waiting.extend(mono);
            self.pending.arrived.notify_one();
            return;
        }
        let effect = self.settings.effect();
        let processor = &mut self.processor;
        let sound = mono.map(|sample| processor.process(effect, sample));
        self.queue.lock().unwrap().push(sound, Flow::Steady);
    }
}

/// Turns what the microphone hands over into the chosen voice and queues it for the speaker,
/// until `running` is cleared. Runs on a thread of its own: a block takes the models tens of
/// milliseconds, which an audio callback cannot afford.
pub fn convert_voice(
    running: &AtomicBool,
    settings: &VoiceSettings,
    clone: &VoiceClone,
    economy: &AtomicBool,
    pending: &Pending,
    queue: &MonitorQueue,
    rate: u32,
) {
    let mut denoiser = Denoiser::new(rate);
    let (mut down, mut up) =
        (Resampler::new(denoise::RATE, voice::RATE), Resampler::new(voice::RATE, rate));
    // Starts with what is known of the user's voice, which may be nothing.
    let fresh = |layout: Layout| {
        let mut stream = Stream::new(layout);
        if let Some((speaker, speech)) = clone.speaker() {
            stream.set_speaker(speaker, speech);
        }
        stream
    };
    let mut epoch = clone.epoch();
    let mut stream = fresh(Layout::default());
    let mut processor = Processor::new(rate);
    let (mut clean, mut low, mut converted, mut ready) =
        (Vec::new(), Vec::new(), Vec::new(), Vec::new());

    while running.load(Ordering::SeqCst) {
        let input = {
            let waiting = pending.samples.lock().unwrap();
            let (mut waiting, _) = pending
                .arrived
                .wait_timeout_while(waiting, CLONE_POLL, |waiting| waiting.is_empty())
                .unwrap();
            std::mem::take(&mut *waiting)
        };
        let Some(target) = clone.target().filter(|_| settings.monitor()) else {
            stream.restart();
            continue;
        };
        // The effort and economy mode may change while speaking.
        let layout = Layout::new(settings.effort(), economy.load(Ordering::Relaxed));
        if stream.layout() != layout {
            stream.set_layout(layout);
        }
        // The user asked for their voice to be learnt again.
        if clone.epoch() != epoch {
            epoch = clone.epoch();
            stream = fresh(layout);
        }
        clean.clear();
        low.clear();
        converted.clear();
        ready.clear();
        denoiser.process(&input, &mut clean);
        down.process(&clean, &mut low);
        stream.push(&low, &mut clone.converter(target), &mut converted);
        if let Some((speaker, speech)) = stream.speaker() {
            clone.remember_speaker(speaker, speech, epoch);
        }
        up.process(&converted, &mut ready);
        if ready.is_empty() {
            continue;
        }

        let effect = settings.effect();
        let sound = ready.iter().map(|sample| processor.process(effect, *sample));
        queue.lock().unwrap().push(sound, Flow::Blocks);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 48_000;

    fn sine(hz: f32, seconds: f32) -> Vec<f32> {
        (0..(seconds * RATE as f32) as usize)
            .map(|n| (TAU * hz * n as f32 / RATE as f32).sin() * 0.5)
            .collect()
    }

    /// Frequency of a signal, from how often it crosses zero going up.
    fn frequency(samples: &[f32]) -> f32 {
        let rising = samples.windows(2).filter(|pair| pair[0] < 0.0 && pair[1] >= 0.0).count();
        rising as f32 * RATE as f32 / samples.len() as f32
    }

    fn run(effect: VoiceEffect, input: &[f32]) -> Vec<f32> {
        let mut processor = Processor::new(RATE);
        input.iter().map(|sample| processor.process(effect, *sample)).collect()
    }

    #[test]
    fn no_effect_leaves_the_voice_untouched() {
        let input = sine(220.0, 0.1);
        assert_eq!(run(VoiceEffect::None, &input), input);
    }

    #[test]
    fn pitch_effects_move_the_frequency_by_their_ratio() {
        let input = sine(300.0, 1.0);
        for (effect, ratio) in [(VoiceEffect::Deep, DEEP_RATIO), (VoiceEffect::High, HIGH_RATIO)] {
            let output = run(effect, &input);
            let heard = frequency(&output[RATE as usize / 10..]);
            let wanted = 300.0 * ratio;
            assert!((heard - wanted).abs() < wanted * 0.08, "{effect:?}: {heard} Hz, not {wanted}");
        }
    }

    #[test]
    fn echo_repeats_a_sound_after_its_delay() {
        let mut input = vec![0.0; RATE as usize];
        input[0] = 0.5;
        let output = run(VoiceEffect::Echo, &input);
        let delay = (ECHO_SECONDS * RATE as f32) as usize;
        assert_eq!(output[0], 0.5);
        assert!(output[1..delay - 2].iter().all(|sample| *sample == 0.0));
        let repeat = output[delay - 2..delay + 3].iter().fold(0.0f32, |a, b| a.max(*b));
        assert!((repeat - 0.3).abs() < 0.01, "first repeat at {repeat}");
    }

    #[test]
    fn radio_keeps_the_voice_band_and_drops_the_rest() {
        let loudest = |hz: f32| {
            let output = run(VoiceEffect::Radio, &sine(hz, 0.5));
            output[RATE as usize / 4..].iter().fold(0.0f32, |a, b| a.max(b.abs()))
        };
        assert!(loudest(1000.0) > 3.0 * loudest(60.0));
        assert!(loudest(1000.0) > 2.0 * loudest(12_000.0));
    }

    #[test]
    fn every_effect_stays_within_range() {
        let input: Vec<f32> = sine(180.0, 0.5).iter().map(|sample| sample * 4.0).collect();
        for code in 0..6 {
            let output = run(VoiceEffect::from_code(code), &input);
            assert!(output.iter().all(|sample| sample.is_finite() && sample.abs() <= 1.0));
        }
    }

    #[test]
    fn changing_effect_forgets_the_previous_one() {
        let mut processor = Processor::new(RATE);
        for sample in sine(200.0, 0.5) {
            processor.process(VoiceEffect::Echo, sample);
        }
        processor.process(VoiceEffect::None, 0.0);
        let tail: Vec<f32> = (0..RATE).map(|_| processor.process(VoiceEffect::Echo, 0.0)).collect();
        assert!(tail.iter().all(|sample| *sample == 0.0));
    }

    #[test]
    fn the_effort_is_medium_until_chosen_and_costs_delay() {
        let settings = VoiceSettings::default();
        assert_eq!(settings.effort(), voice::EFFORT_DEFAULT);
        settings.set_effort(200);
        assert_eq!(settings.effort(), voice::EFFORT_MAX);
        assert_eq!(clone_delay_ms(2, false), 530);
        assert!(clone_delay_ms(0, false) < 440 && clone_delay_ms(3, false) > 550);
        assert!(clone_delay_ms(1, true) > clone_delay_ms(1, false));
    }

    #[test]
    fn unknown_effect_codes_mean_none() {
        assert_eq!(VoiceEffect::from_code(VoiceEffect::Robot as u8), VoiceEffect::Robot);
        assert_eq!(VoiceEffect::from_code(200), VoiceEffect::None);
    }

    #[test]
    fn the_feed_stores_mono_sound_only_while_monitoring() {
        let settings = Arc::new(VoiceSettings::default());
        let queue: MonitorQueue = Arc::new(Mutex::new(Playout::new(1000)));
        let clone = Arc::new(VoiceClone::new(Default::default()));
        let mut feed =
            MonitorFeed::new(settings.clone(), queue.clone(), 1000, clone, Arc::default());
        feed.push(&[1.0f32, 0.0], 2);
        assert_eq!(queue.lock().unwrap().held_seconds(), 0.0, "nothing while the monitor is off");

        settings.set_monitor(true);
        feed.push(&[1.0f32, 0.0, -0.5, -0.5], 2);
        // 40 ms of wait, then the two mono samples.
        assert_eq!(queue.lock().unwrap().queue.len(), 42);
    }

    /// Plays a note through the store, pushed and pulled in the given amounts, and returns
    /// what the speaker got with the number of times it ran out.
    fn play(pushes: &[usize], pulls: &[usize], flow: Flow, seconds: usize) -> (Vec<f32>, u32) {
        let mut playout = Playout::new(RATE);
        playout.open(RATE);
        let note = sine(220.0, seconds as f32 + 1.0);
        let (mut pushed, mut pulled, mut out) = (0, 0, Vec::new());
        let (mut pushes, mut pulls) = (pushes.iter().cycle(), pulls.iter().cycle());
        let (mut next_push, mut next_pull) = (*pushes.next().unwrap(), *pulls.next().unwrap());
        // Time goes by one sample at a time: sound is made and asked for at the same pace.
        for now in 0..seconds * RATE as usize {
            if now == pushed + next_push {
                playout.push(note[pushed..now].iter().copied(), flow);
                (pushed, next_push) = (now, *pushes.next().unwrap());
            }
            if now == pulled + next_pull {
                let mut block = vec![0.0; next_pull];
                playout.pull(&mut block);
                out.extend(block);
                (pulled, next_pull) = (now, *pulls.next().unwrap());
            }
        }
        (out, playout.gaps)
    }

    /// Largest jump between two samples: a click is a jump far above what the note does.
    fn steepest(sound: &[f32]) -> f32 {
        sound.windows(2).map(|pair| (pair[1] - pair[0]).abs()).fold(0.0, f32::max)
    }

    /// Twice the largest jump of the test note itself: a fade adds a little, a cut fifty times more.
    const NOTE_STEP: f32 = 0.5 * TAU * 220.0 / RATE as f32 * 2.0;

    #[test]
    fn a_speaker_that_asks_by_fits_and_starts_gets_sound_without_a_gap_or_a_click() {
        // 10 ms at a time from the microphone; the speaker takes 22 ms then 10 ms at once,
        // as VoiceMeeter does, or 43 ms in one go.
        for pulls in [&[480usize][..], &[1056, 5, 475], &[2048]] {
            let (out, gaps) = play(&[480], pulls, Flow::Steady, 20);
            assert_eq!(gaps, 0, "{pulls:?}");
            assert!(steepest(&out) < NOTE_STEP, "{pulls:?}: jump of {}", steepest(&out));
            let playing = &out[RATE as usize..];
            assert!(playing.chunks(48).all(|w| w.iter().any(|s| s.abs() > 0.1)), "{pulls:?}");
        }
        // Whole blocks of a cloned voice, one of them 60 ms late now and then.
        let (out, gaps) = play(&[6672, 6672, 9552, 3792], &[1056, 5, 475], Flow::Blocks, 30);
        assert_eq!(gaps, 0);
        assert!(steepest(&out) < NOTE_STEP);
    }

    #[test]
    fn running_out_of_sound_fades_out_and_the_store_learns_to_keep_more() {
        let mut playout = Playout::new(RATE);
        playout.open(RATE);
        let note = sine(220.0, 1.0);
        playout.push(note[..4800].iter().copied(), Flow::Steady);
        let mut out = vec![0.0; 9600];
        playout.pull(&mut out);
        assert_eq!(playout.gaps, 1);
        assert!(steepest(&out) < NOTE_STEP, "a fade, not a cut: {}", steepest(&out));
        assert!(out[8000..].iter().all(|sample| *sample == 0.0));

        // The next start waits longer than the first one did.
        playout.push(note[..480].iter().copied(), Flow::Steady);
        assert!(playout.queue.len() > 480 + (0.04 * RATE as f32) as usize);
    }

    #[test]
    fn sound_piling_up_is_played_a_hair_faster_and_a_big_backlog_is_dropped_between_fades() {
        // The microphone runs 0.2 % fast: after two minutes 240 ms would have piled up.
        let (out, gaps) = play(&[481], &[480], Flow::Steady, 120);
        assert_eq!(gaps, 0);
        assert!(steepest(&out) < NOTE_STEP);

        let mut playout = Playout::new(RATE);
        playout.open(RATE);
        let note = sine(220.0, 17.0);
        // A second of sound arrives at once, then the usual flow.
        playout.push(note[..48_000].iter().copied(), Flow::Steady);
        let mut out = Vec::new();
        for tick in 0..1500 {
            let at = 48_000 + tick * 480;
            playout.push(note[at..at + 480].iter().copied(), Flow::Steady);
            let mut block = vec![0.0; 480];
            playout.pull(&mut block);
            out.extend(block);
        }
        assert!(playout.held_seconds() < 0.2, "{} s still in store", playout.held_seconds());
        assert!(steepest(&out) < NOTE_STEP);
        assert_eq!(playout.gaps, 0);
    }

    #[test]
    fn the_store_follows_the_speaker_rate() {
        // Stored at 1000 Hz, played at 2000 Hz: each stored sample lasts two speaker samples.
        let mut playout = Playout::new(1000);
        playout.open(2000);
        playout.push((0..200).map(|n| n as f32), Flow::Steady);
        let mut out = vec![0.0; 280];
        playout.pull(&mut out);
        // 40 ms of wait, a short fade, then the ramp at half the pace.
        let ramp = &out[120..280];
        assert!(ramp.windows(2).all(|pair| (pair[1] - pair[0] - 0.5).abs() < 0.01), "{ramp:?}");
    }
}
