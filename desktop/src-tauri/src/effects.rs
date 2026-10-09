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

use crate::voice::{self, Resampler, Stream, VoiceClone};

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
/// The speaker waits for this much sound before playing, so a late block is not a click.
const MONITOR_START_SECONDS: f32 = 0.03;
/// Beyond this the monitor has fallen behind the voice: the oldest sound is dropped.
const MONITOR_MAX_SECONDS: f32 = 0.15;
/// A cloned voice arrives in blocks, not in a steady flow. This much silence goes in front of
/// a block that finds the speaker waiting, so the next one may be a little late without a gap.
const CLONE_MARGIN_SECONDS: f32 = 0.08;
/// Converted sound the speaker may have in store on top of one block, before it is cut down.
const CLONE_BACKLOG_SECONDS: f32 = 0.35;
/// The store is watched over this long. What was never used in that time is delay for nothing,
/// left by a slow moment: it is dropped, down to the margin.
const CLONE_TRIM_SECONDS: f32 = 2.0;
/// Microphone sound the models may have in store. More means they cannot keep up.
const CLONE_PENDING_SECONDS: f32 = 0.75;
/// How often the conversion thread looks up when no sound arrives.
const CLONE_POLL: Duration = Duration::from_millis(50);

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
#[derive(Default)]
pub struct VoiceSettings {
    monitor: AtomicBool,
    effect: AtomicU8,
}

impl VoiceSettings {
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

/// The sound waiting between the microphone and the speaker.
pub type MonitorQueue = Arc<Mutex<VecDeque<f32>>>;

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
    limit: usize,
    restart: usize,
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
            limit: (MONITOR_MAX_SECONDS * rate as f32) as usize,
            restart: (MONITOR_START_SECONDS * rate as f32) as usize,
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
        let mut queue = self.queue.lock().unwrap();
        for sample in mono {
            queue.push_back(self.processor.process(effect, sample));
        }
        if queue.len() > self.limit {
            let excess = queue.len() - self.restart;
            queue.drain(..excess);
        }
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
    let (mut down, mut up) = (Resampler::new(rate, voice::RATE), Resampler::new(voice::RATE, rate));
    let mut stream = Stream::new(voice::BLOCK_FAST);
    if let Some(speaker) = clone.speaker() {
        stream.set_speaker(speaker);
    }
    let mut processor = Processor::new(rate);
    let margin = (CLONE_MARGIN_SECONDS * rate as f32) as usize;
    let (mut low, mut converted, mut ready) = (Vec::new(), Vec::new(), Vec::new());
    // Least the speaker had in store when a block arrived, and the sound queued since last check.
    let (mut spare, mut watched) = (usize::MAX, 0);

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
        // Economy mode: longer blocks, so the models run half as often.
        let economy = economy.load(Ordering::Relaxed);
        let block = if economy { voice::BLOCK_ECONOMY } else { voice::BLOCK_FAST };
        if stream.block() != block {
            stream.set_block(block);
        }
        let limit = ((stream.delay_seconds() + CLONE_BACKLOG_SECONDS) * rate as f32) as usize;
        low.clear();
        converted.clear();
        ready.clear();
        down.process(&input, &mut low);
        stream.push(&low, &mut clone.converter(target), &mut converted);
        if let Some((speaker, speech)) = stream.speaker() {
            clone.remember_speaker(speaker, speech);
        }
        up.process(&converted, &mut ready);
        if ready.is_empty() {
            continue;
        }

        let effect = settings.effect();
        let mut queue = queue.lock().unwrap();
        spare = spare.min(queue.len());
        watched += ready.len();
        if queue.is_empty() {
            queue.extend(std::iter::repeat(0.0).take(margin));
        } else if watched as f32 >= CLONE_TRIM_SECONDS * rate as f32 {
            if spare > margin + margin / 2 {
                queue.drain(..spare - margin);
            }
            (spare, watched) = (usize::MAX, 0);
        }
        queue.extend(ready.iter().map(|sample| processor.process(effect, *sample)));
        if queue.len() > limit {
            let excess = queue.len() - ready.len() - margin;
            queue.drain(..excess);
        }
    }
}

/// Speaker side of the monitor: hands the queued sound out at the speaker's own sample rate.
pub struct MonitorPlayback {
    /// Microphone samples consumed for each speaker sample.
    step: f64,
    position: f64,
    current: f32,
    next: f32,
    start: usize,
    playing: bool,
}

impl MonitorPlayback {
    pub fn new(input_rate: u32, output_rate: u32) -> Self {
        Self {
            step: f64::from(input_rate.max(1)) / f64::from(output_rate.max(1)),
            position: 0.0,
            current: 0.0,
            next: 0.0,
            start: (MONITOR_START_SECONDS * input_rate as f32) as usize,
            playing: false,
        }
    }

    /// The next speaker sample. Silence while the queue fills up again after running dry.
    pub fn next(&mut self, queue: &mut VecDeque<f32>) -> f32 {
        if !self.playing {
            if queue.len() < self.start.max(1) {
                return 0.0;
            }
            self.playing = true;
        }
        self.position += self.step;
        while self.position >= 1.0 {
            self.position -= 1.0;
            self.current = self.next;
            match queue.pop_front() {
                Some(sample) => self.next = sample,
                None => {
                    (self.next, self.playing) = (0.0, false);
                    break;
                }
            }
        }
        self.current + (self.next - self.current) * self.position as f32
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
    fn unknown_effect_codes_mean_none() {
        assert_eq!(VoiceEffect::from_code(VoiceEffect::Robot as u8), VoiceEffect::Robot);
        assert_eq!(VoiceEffect::from_code(200), VoiceEffect::None);
    }

    #[test]
    fn the_feed_queues_mono_sound_only_while_monitoring_and_never_falls_behind() {
        let settings = Arc::new(VoiceSettings::default());
        let queue = MonitorQueue::default();
        let clone = Arc::new(VoiceClone::new(Default::default()));
        let mut feed =
            MonitorFeed::new(settings.clone(), queue.clone(), 1000, clone, Arc::default());
        feed.push(&[1.0f32, 0.0], 2);
        assert!(queue.lock().unwrap().is_empty(), "nothing is queued while the monitor is off");

        settings.set_monitor(true);
        feed.push(&[1.0f32, 0.0, -0.5, -0.5], 2);
        assert_eq!(*queue.lock().unwrap(), [0.5, -0.5]);

        feed.push(&[0.0f32; 400], 1);
        assert_eq!(queue.lock().unwrap().len(), 30, "the backlog is cut down to the start level");
    }

    #[test]
    fn playback_waits_for_enough_sound_then_follows_the_speaker_rate() {
        // Microphone at 1000 Hz, speaker at 2000 Hz: every sample is played twice as long.
        let mut playback = MonitorPlayback::new(1000, 2000);
        let mut queue: VecDeque<f32> = (0..10).map(|n| n as f32).collect();
        assert_eq!(playback.next(&mut queue), 0.0, "30 samples are needed to start");
        assert_eq!(queue.len(), 10);

        queue.extend((10..40).map(|n| n as f32));
        let played: Vec<f32> = (0..60).map(|_| playback.next(&mut queue)).collect();
        assert_eq!(queue.len(), 10, "60 speaker samples use 30 microphone samples");
        assert!(played.windows(2).all(|pair| pair[1] >= pair[0]), "the ramp stays a ramp");
        assert!((played[59] - 28.5).abs() < 1.0);

        // Running dry goes back to waiting instead of stuttering.
        (0..40).for_each(|_| _ = playback.next(&mut queue));
        assert!(queue.is_empty());
        queue.extend([1.0; 5]);
        assert_eq!(playback.next(&mut queue), 0.0);
    }
}
