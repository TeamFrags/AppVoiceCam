//! Converts a recording to the voice of another one from the command line, block by block as
//! the microphone path does, without the interface or a microphone:
//!
//!     cargo run --example voice -- <models folder> <reference voice> <speech> <result.wav>
//!
//! Prints how long a block takes, and how close the result is to each voice.

use std::{env, fs, path::Path, time::Instant};

use app_lib::{
    library::encode_wav,
    voice::{read_audio, Layout, Stream, VoiceClone, EFFORT_DEFAULT, RATE},
};

fn extension(path: &str) -> &str {
    Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("wav")
}

/// 1 for the same voice, around 0 for unrelated ones.
fn likeness(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let norm = |v: &[f32]| v.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot / (norm(a) * norm(b)).max(f32::EPSILON)
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let [models, reference, speech, result] = args.as_slice() else {
        eprintln!("usage: voice <models folder> <reference voice> <speech> <result.wav>");
        std::process::exit(2);
    };
    let clone = VoiceClone::new(models.into());

    let started = Instant::now();
    let reference_audio = fs::read(reference).expect("cannot read the reference voice");
    clone.set_target(reference_audio, extension(reference)).expect("unusable reference voice");
    println!("engine loaded, reference voice described: {:?}", started.elapsed());

    let speech_audio = fs::read(speech).expect("cannot read the speech");
    let input = read_audio(speech_audio.clone(), extension(speech)).expect("unusable speech");
    let target = clone.target().unwrap();

    // APP_EFFORT (0 to 3) and APP_ECONOMY try the other ways of cutting the stream.
    let economy = env::var_os("APP_ECONOMY").is_some();
    let effort = env::var("APP_EFFORT").ok().and_then(|v| v.parse().ok()).unwrap_or(EFFORT_DEFAULT);
    let mut stream = Stream::new(Layout::new(effort, economy));
    let mut output = Vec::new();
    let mut slowest = std::time::Duration::ZERO;
    let started = Instant::now();
    // Fed in pieces of about 10 ms, as a microphone would.
    for (index, piece) in input.chunks(220).enumerate() {
        let before = (Instant::now(), output.len());
        stream.push(piece, &mut clone.converter(target.clone()), &mut output);
        // The very first block includes one-off setup on the graphics card.
        if output.len() > before.1 && index > 200 {
            slowest = slowest.max(before.0.elapsed());
        }
    }
    let seconds = input.len() as f32 / RATE as f32;
    println!(
        "{seconds:.1} s of speech converted in {:?}, slowest block {slowest:?}",
        started.elapsed()
    );
    fs::write(result, encode_wav(&output, RATE)).expect("cannot write the result");

    let describe = |audio: Vec<u8>, ext: &str| clone.describe_file(audio, ext).unwrap();
    let before = describe(speech_audio, extension(speech));
    let after = describe(fs::read(result).unwrap(), "wav");
    println!("likeness to the reference: {:.2} before, {:.2} after", likeness(&before, &target), likeness(&after, &target));
    println!("likeness to the speaker:   {:.2} after", likeness(&after, &before));
}
