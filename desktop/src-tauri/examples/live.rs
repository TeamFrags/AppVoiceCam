//! Plays a recording through the whole monitor path in real time, as if it were spoken into
//! the microphone, without a microphone or speakers:
//!
//!     cargo run --example live -- <models folder> <reference voice> <speech> <result.wav>
//!
//! Prints how often the speaker had nothing to play, which is heard as crackling, and the
//! delay between the speech and the cloned voice. APP_EFFORT (0 to 3) and APP_ECONOMY choose
//! what the interface would.

use std::{
    env, fs,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use app_lib::{
    effects::{convert_voice, MonitorFeed, MonitorQueue, Pending, Playout, VoiceSettings},
    library::encode_wav,
    voice::{self, read_audio, Resampler, VoiceClone},
};

/// A usual microphone rate, and the 10 ms blocks a sound card hands over.
const RATE: u32 = 48_000;
const TICK: usize = 480;
const TICK_TIME: Duration = Duration::from_millis(10);
/// What the speakers ask for at each tick. Some ask by fits and starts, as VoiceMeeter does:
/// more than two ticks' worth at once, then nothing.
const PULLS: [usize; 5] = [1056, 0, 384, 480, 480];

fn extension(path: &str) -> &str {
    Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("wav")
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let [models, reference, speech, result] = args.as_slice() else {
        eprintln!("usage: live <models folder> <reference voice> <speech> <result.wav>");
        std::process::exit(2);
    };
    let clone = Arc::new(VoiceClone::new(models.into()));
    let reference_audio = fs::read(reference).expect("cannot read the reference voice");
    clone.set_target(reference_audio, extension(reference)).expect("unusable reference voice");
    let speech_audio = fs::read(speech).expect("cannot read the speech");
    let mut input = Vec::new();
    Resampler::new(voice::RATE, RATE)
        .process(&read_audio(speech_audio, extension(speech)).expect("unusable speech"), &mut input);

    // APP_KNOWN: the speaker's voice is already described, from this clean recording.
    if let Ok(known) = env::var("APP_KNOWN") {
        use voice::Converter;
        let clean = voice::levelled(
            read_audio(fs::read(&known).expect("cannot read"), extension(&known)).expect("unusable"),
        );
        let source = clone.converter(clone.target().unwrap()).describe(&clean).unwrap();
        clone.remember_speaker(&source, usize::MAX / 2, clone.epoch());
    }
    let settings = Arc::new(VoiceSettings::default());
    settings.set_monitor(true);
    if let Some(effort) = env::var("APP_EFFORT").ok().and_then(|value| value.parse().ok()) {
        settings.set_effort(effort);
    }
    let economy = Arc::new(AtomicBool::new(env::var_os("APP_ECONOMY").is_some()));
    let queue: MonitorQueue = Arc::new(Mutex::new(Playout::new(RATE)));
    queue.lock().unwrap().open(RATE);
    let pending = Arc::<Pending>::default();
    let running = Arc::new(AtomicBool::new(true));
    {
        let (running, settings, clone, economy, pending, queue) = (
            running.clone(),
            settings.clone(),
            clone.clone(),
            economy.clone(),
            pending.clone(),
            queue.clone(),
        );
        thread::spawn(move || {
            convert_voice(&running, &settings, &clone, &economy, &pending, &queue, RATE)
        });
    }
    let mut feed = MonitorFeed::new(settings, queue.clone(), RATE, clone, pending);
    let mut output = Vec::new();
    let begin = Instant::now();
    for (tick, block) in input.chunks_exact(TICK).enumerate() {
        while begin.elapsed() < TICK_TIME * tick as u32 {
            thread::sleep(Duration::from_millis(1));
        }
        feed.push(block, 1);
        let mut asked = vec![0.0; PULLS[tick % PULLS.len()]];
        let mut playout = queue.lock().unwrap();
        let before = playout.gaps;
        playout.pull(&mut asked);
        if playout.gaps != before {
            println!("  nothing to play at {:.2} s", tick as f32 / 100.0);
        }
        drop(playout);
        output.extend(asked);
    }
    let gaps = queue.lock().unwrap().gaps;
    running.store(false, Ordering::SeqCst);

    // The delay is how far back the output must be moved for its loudness to follow the input's.
    let loudness = |sound: &[f32]| -> Vec<f32> {
        sound.chunks(TICK).map(|tick| tick.iter().map(|sample| sample.abs()).sum()).collect()
    };
    let (spoken, heard) = (loudness(&input), loudness(&output));
    let alike = |delay: usize| spoken.iter().zip(&heard[delay..]).map(|(a, b)| a * b).sum::<f32>();
    let delay = (0..150).max_by(|a, b| alike(*a).total_cmp(&alike(*b))).unwrap_or(0);
    println!(
        "{:.1} s of speech: nothing to play {gaps} times, delay about {} ms",
        input.len() as f32 / RATE as f32,
        delay * 10
    );
    fs::write(result, encode_wav(&output, RATE)).expect("cannot write the result");
}
