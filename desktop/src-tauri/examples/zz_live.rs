// Temporary: runs the real monitor path in real time, without a microphone or speakers.
use app_lib::effects::{convert_voice, MonitorFeed, MonitorPlayback, MonitorQueue, Pending, VoiceSettings};
use app_lib::library::encode_wav;
use app_lib::voice::{read_audio, Resampler, VoiceClone};
use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
use std::time::{Duration, Instant};
use std::{env, fs, thread};

const RATE: u32 = 48_000;
const TICK: usize = 480;

fn main() {
    let a: Vec<String> = env::args().skip(1).collect();
    let ext = |p: &str| p.rsplit('.').next().unwrap().to_string();
    let clone = Arc::new(VoiceClone::new((&a[0]).into()));
    clone.set_target(fs::read(&a[1]).unwrap(), &ext(&a[1])).unwrap();
    let low = read_audio(fs::read(&a[2]).unwrap(), &ext(&a[2])).unwrap();
    let mut input = Vec::new();
    Resampler::new(22_050, RATE).process(&low, &mut input);

    let settings = Arc::new(VoiceSettings::default());
    settings.set_monitor(true);
    let economy = Arc::new(AtomicBool::new(env::var_os("APP_ECONOMY").is_some()));
    let (queue, pending) = (MonitorQueue::default(), Arc::<Pending>::default());
    let running = Arc::new(AtomicBool::new(true));
    {
        let (running, settings, clone, economy, pending, queue) =
            (running.clone(), settings.clone(), clone.clone(), economy.clone(), pending.clone(), queue.clone());
        thread::spawn(move || convert_voice(&running, &settings, &clone, &economy, &pending, &queue, RATE));
    }
    let mut feed = MonitorFeed::new(settings, queue.clone(), RATE, clone, pending);
    let mut playback = MonitorPlayback::new(RATE, RATE);

    let (mut output, mut gaps, mut started) = (Vec::new(), 0, false);
    let begin = Instant::now();
    let ticks = input.len() / TICK;
    for tick in 0..ticks {
        // One tick every 10 ms of real time.
        let due = begin + Duration::from_millis(10 * tick as u64);
        while Instant::now() < due {
            thread::sleep(Duration::from_millis(1));
        }
        feed.push(&input[tick * TICK..(tick + 1) * TICK], 1);
        let mut queue = queue.lock().unwrap();
        if started && queue.is_empty() {
            gaps += 1;
        }
        started |= !queue.is_empty();
        for _ in 0..TICK {
            output.push(playback.next(&mut queue));
        }
    }
    running.store(false, Ordering::SeqCst);

    // Delay: how far the output must be moved back for its loudness to follow the input's.
    let envelope = |s: &[f32]| -> Vec<f32> { s.chunks(TICK).map(|c| c.iter().map(|v| v.abs()).sum::<f32>()).collect() };
    let (ein, eout) = (envelope(&input), envelope(&output));
    let best = (0..120usize)
        .max_by(|x, y| {
            let score = |d: usize| ein.iter().zip(&eout[d..]).map(|(p, q)| p * q).sum::<f32>();
            score(*x).total_cmp(&score(*y))
        })
        .unwrap();
    println!("{} ticks, speaker waited with nothing to play {gaps} times ({} ms), delay about {} ms", ticks, gaps * 10, best * 10);
    fs::write(&a[3], encode_wav(&output, RATE)).unwrap();
}
