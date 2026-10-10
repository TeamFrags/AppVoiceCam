//! Temporary measuring bench. Not part of the product.
//!
//!     zz_lab score <dnsmos.onnx> <file>...

use std::{env, fs, path::Path};

use app_lib::voice::{read_audio, Resampler, RATE};
use ort::{session::Session, value::Tensor};

fn extension(path: &str) -> &str {
    Path::new(path).extension().and_then(|ext| ext.to_str()).unwrap_or("wav")
}

fn load(path: &str) -> Vec<f32> {
    read_audio(fs::read(path).expect("cannot read"), extension(path)).expect("unusable audio")
}

fn to_rate(samples: &[f32], from: u32, to: u32) -> Vec<f32> {
    let mut out = Vec::new();
    let mut r = Resampler::new(from, to);
    r.process(samples, &mut out);
    r.process(&[0.0; 64], &mut out);
    out
}

/// DNSMOS P.835: (signal, background, overall), each from 1 to 5.
fn dnsmos(session: &mut Session, samples16: &[f32]) -> (f32, f32, f32) {
    const LEN: usize = 144_160;
    let mut audio = samples16.to_vec();
    while audio.len() < LEN {
        let copy = audio.clone();
        audio.extend(copy);
    }
    let hops = (audio.len() - LEN) / 16_000 + 1;
    let (mut sig, mut bak, mut ovr) = (0.0, 0.0, 0.0);
    for hop in 0..hops {
        let seg = audio[hop * 16_000..hop * 16_000 + LEN].to_vec();
        let input = Tensor::from_array(([1, LEN], seg)).unwrap();
        let outputs = session.run(ort::inputs!["input_1" => input]).unwrap();
        let raw = outputs[0].try_extract_tensor::<f32>().unwrap().1;
        let (s, b, o) = (raw[0], raw[1], raw[2]);
        sig += -0.08397278 * s * s + 1.22083953 * s + 0.0052439;
        bak += -0.13166888 * b * b + 1.60915514 * b - 0.39604546;
        ovr += -0.06766283 * o * o + 1.11546468 * o + 0.04602535;
    }
    let n = hops as f32;
    (sig / n, bak / n, ovr / n)
}

/// Sudden jumps: samples whose second difference stands far above that of the sound around.
fn clicks(samples: &[f32], rate: u32) -> usize {
    let d2: Vec<f32> = samples.windows(3).map(|w| (w[2] - 2.0 * w[1] + w[0]).abs()).collect();
    let half = (rate as usize) / 200; // 5 ms each side
    let mut count = 0;
    let mut last = 0usize;
    let mut sum: f64 = d2.iter().take(2 * half + 1).map(|v| f64::from(*v)).sum();
    for at in half..d2.len().saturating_sub(half + 1) {
        let around = (sum - f64::from(d2[at])) / (2 * half) as f64;
        if f64::from(d2[at]) > 12.0 * around + 0.004 && at > last + half {
            count += 1;
            last = at;
        }
        sum += f64::from(d2[at + half + 1]) - f64::from(d2[at - half]);
    }
    count
}

/// Runs of exact silence of 3 ms or more inside the sound.
fn holes(samples: &[f32], rate: u32) -> usize {
    let first = samples.iter().position(|s| *s != 0.0).unwrap_or(0);
    let last = samples.iter().rposition(|s| *s != 0.0).unwrap_or(0);
    let (mut run, mut count) = (0, 0);
    for sample in &samples[first..=last.max(first)] {
        if *sample == 0.0 {
            run += 1;
            if run == rate as usize * 3 / 1000 {
                count += 1;
            }
        } else {
            run = 0;
        }
    }
    count
}

fn rms(samples: &[f32]) -> f32 {
    (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt()
}

/// Pitch of a 40 ms frame by normalised autocorrelation, or none if it is not voiced.
fn frame_pitch(frame: &[f32], rate: u32) -> Option<f32> {
    let (low, high) = (rate as usize / 500, rate as usize / 60);
    let energy: f32 = frame.iter().map(|s| s * s).sum();
    if energy / (frame.len() as f32) < 1e-5 {
        return None;
    }
    let n = frame.len() - high;
    let mut best = (0, 0.0f32);
    let mut scores = vec![0.0f32; high + 1];
    for lag in low..=high {
        let (mut ab, mut aa, mut bb) = (0.0, 0.0, 0.0);
        for i in 0..n {
            ab += frame[i] * frame[i + lag];
            aa += frame[i] * frame[i];
            bb += frame[i + lag] * frame[i + lag];
        }
        let score = ab / (aa * bb).sqrt().max(1e-9);
        scores[lag] = score;
        if score > best.1 {
            best = (lag, score);
        }
    }
    if best.1 < 0.6 {
        return None;
    }
    // The shortest lag nearly as good as the best: avoids octave-down errors.
    let lag = (low..=high)
        .find(|lag| {
            scores[*lag] > 0.9 * best.1
                && scores[*lag] >= scores[lag.saturating_sub(1).max(low)]
                && scores[*lag] >= scores[(*lag + 1).min(high)]
        })
        .unwrap_or(best.0);
    Some(rate as f32 / lag as f32)
}

fn pitch_stats(samples: &[f32], rate: u32) -> (f32, f32, f32, f32) {
    let len = rate as usize * 40 / 1000;
    let hop = rate as usize / 100;
    let mut pitches: Vec<f32> = samples
        .windows(len)
        .step_by(hop)
        .filter_map(|frame| frame_pitch(frame, rate))
        .collect();
    let frames = samples.len().saturating_sub(len) / hop + 1;
    if pitches.is_empty() {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let voiced = pitches.len() as f32 / frames as f32;
    pitches.sort_by(f32::total_cmp);
    let at = |q: f32| pitches[((pitches.len() - 1) as f32 * q) as usize];
    (at(0.5), at(0.1), at(0.9), voiced)
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("score") => {
            let mut session = Session::builder().unwrap().commit_from_file(&args[1]).unwrap();
            println!(
                "{:>5} {:>5} {:>5} {:>6} {:>5} {:>6} {:>5}-{:<5} {:>4}  file",
                "SIG", "BAK", "OVR", "clicks", "holes", "f0", "p10", "p90", "vcd"
            );
            for path in &args[2..] {
                let audio = load(path);
                let (sig, bak, ovr) = dnsmos(&mut session, &to_rate(&audio, RATE, 16_000));
                let seconds = audio.len() as f32 / RATE as f32;
                let (f0, lo, hi, voiced) = pitch_stats(&audio, RATE);
                println!(
                    "{sig:5.2} {bak:5.2} {ovr:5.2} {:6.1} {:5} {f0:6.0} {lo:5.0}-{hi:<5.0} {voiced:4.2}  {} ({seconds:.1}s rms {:.3})",
                    clicks(&audio, RATE) as f32 / seconds * 10.0,
                    holes(&audio, RATE),
                    Path::new(path).file_name().unwrap().to_string_lossy(),
                    rms(&audio),
                );
            }
        }
        Some("noisy") => {
            // zz_lab noisy <in> <out> <voice gain> <hiss rms> <hum peak> [lead seconds]
            // A poor microphone: a quieter voice, hiss, mains hum, and hiss alone before the
            // first word.
            let voice = load(&args[1]);
            let (gain, hiss, hum): (f32, f32, f32) =
                (args[3].parse().unwrap(), args[4].parse().unwrap(), args[5].parse().unwrap());
            let lead: f32 = args.get(6).and_then(|v| v.parse().ok()).unwrap_or(0.0);
            let mut sound = vec![0.0; (lead * RATE as f32) as usize];
            sound.extend(voice.iter().map(|s| s * gain));
            let (mut seed, mut low) = (7u32, 0.0f32);
            for (n, sample) in sound.iter_mut().enumerate() {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                let white = (seed >> 8) as f32 / (1 << 23) as f32 - 1.0;
                // Half white, half low: closer to a room than pure white noise.
                low += 0.05 * (white - low);
                let t = n as f32 / RATE as f32;
                let mains = (std::f32::consts::TAU * 50.0 * t).sin()
                    + 0.5 * (std::f32::consts::TAU * 150.0 * t).sin();
                *sample += hiss * (white * 1.2 + low * 5.0) + hum * mains;
            }
            println!("voice rms {:.4}, whole rms {:.4}", rms(&voice) * gain, rms(&sound));
            fs::write(&args[2], app_lib::library::encode_wav(&sound, RATE)).unwrap();
        }
        Some("dist") => {
            // zz_lab dist <reference> <file>...  : how far each file is from the reference
            // where it speaks, and what is heard where the reference is silent.
            let spec = |x: &[f32]| -> Vec<Vec<f32>> {
                let mut planner = rustfft::FftPlanner::<f32>::new();
                let fft = planner.plan_fft_forward(1024);
                x.windows(1024)
                    .step_by(256)
                    .map(|frame| {
                        let mut buf: Vec<rustfft::num_complex::Complex<f32>> = frame
                            .iter()
                            .enumerate()
                            .map(|(n, s)| {
                                let w = 0.5 - 0.5 * (std::f32::consts::TAU * n as f32 / 1024.0).cos();
                                rustfft::num_complex::Complex::new(s * w, 0.0)
                            })
                            .collect();
                        fft.process(&mut buf);
                        // 31 bands of 12 bins (260 Hz): the shape of the sound, not its fine
                        // lines, which move with the slightest shift in time.
                        buf[..372]
                            .chunks(12)
                            .map(|band| {
                                let power = band.iter().map(|c| c.norm_sqr()).sum::<f32>();
                                (power + 1e-3).log10() * 10.0
                            })
                            .collect()
                    })
                    .collect()
            };
            let reference = load(&args[1]);
            let ref_spec = spec(&reference);
            let envelope = |x: &[f32]| -> Vec<f32> { x.chunks(64).map(rms).collect() };
            let ref_env = envelope(&reference);
            for path in &args[2..] {
                let sound = load(path);
                let env = envelope(&sound);
                // The delay is where the loudness of the two lines up best, then where the
                // waves themselves do.
                let alike = |delay: usize| -> f32 {
                    ref_env.iter().zip(env.iter().skip(delay)).map(|(a, b)| a * b).sum()
                };
                let coarse = (0..1500).max_by(|a, b| alike(*a).total_cmp(&alike(*b))).unwrap() * 64;
                let wave = |delay: usize| -> f32 {
                    reference.iter().zip(sound.iter().skip(delay)).step_by(3).map(|(a, b)| a * b).sum()
                };
                let delay = (coarse.saturating_sub(96)..coarse + 96)
                    .max_by(|a, b| wave(*a).total_cmp(&wave(*b)))
                    .unwrap();
                let aligned = &sound[delay.min(sound.len())..];
                let got = spec(aligned);
                let (mut total, mut count) = (0.0f64, 0usize);
                let (mut quiet, mut quiet_n) = (0.0f64, 0usize);
                let far = |a: &[f32], b: &[f32]| -> f32 {
                    (a.iter().zip(b).map(|(x, y)| (x - y) * (x - y)).sum::<f32>() / a.len() as f32).sqrt()
                };
                // The playout plays a hair faster or slower: each second is lined up again.
                for (second, piece) in ref_spec.chunks(86).enumerate() {
                    let first = second * 86;
                    let spoken: Vec<usize> = (0..piece.len())
                        .filter(|at| rms(&reference[(first + at) * 256..(first + at) * 256 + 1024]) > 0.02)
                        .collect();
                    for at in 0..piece.len() {
                        let from = (first + at) * 256;
                        if rms(&reference[from..from + 1024]) < 0.002 && from + 1024 <= aligned.len() {
                            quiet += f64::from(rms(&aligned[from..from + 1024])).powi(2);
                            quiet_n += 1;
                        }
                    }
                    if spoken.len() < 10 {
                        continue;
                    }
                    let best = (-30i64..=30)
                        .filter_map(|shift| {
                            let mut sum = 0.0;
                            for at in &spoken {
                                let frame = (first + at) as i64 + shift;
                                sum += far(got.get(usize::try_from(frame).ok()?)?, &piece[*at]);
                            }
                            Some(sum / spoken.len() as f32)
                        })
                        .fold(f32::MAX, f32::min);
                    if best < f32::MAX {
                        total += f64::from(best);
                        count += 1;
                    }
                }
                let seconds = sound.len() as f32 / RATE as f32;
                println!(
                    "{:5.2} dB off, pauses at {:6.1} dB, clicks/10s {:4.1}, delay {:4.0} ms, rms {:.3}  {}",
                    total / count.max(1) as f64,
                    10.0 * (quiet / quiet_n.max(1) as f64 + 1e-12).log10(),
                    clicks(&sound, RATE) as f32 / seconds * 10.0,
                    delay as f32 / RATE as f32 * 1000.0,
                    rms(&sound),
                    Path::new(path).file_name().unwrap().to_string_lossy(),
                );
            }
        }
        Some("idle") => {
            // zz_lab idle <models> <voice> : how long a run of the converter takes after the
            // graphics card was left alone for a while.
            use app_lib::voice::{Converter, VoiceClone};
            let clone = VoiceClone::new(args[1].clone().into());
            clone.set_target(fs::read(&args[2]).unwrap(), extension(&args[2])).unwrap();
            let mut converter = clone.converter(clone.target().unwrap());
            let window: Vec<f32> = (0..112 * 256).map(|n| ((n % 97) as f32 / 97.0 - 0.5) * 0.2).collect();
            let source = vec![0.1f32; 256];
            for idle in [0u64, 100, 140, 300, 600, 1000, 2000, 5000] {
                let mut runs = Vec::new();
                for _ in 0..6 {
                    std::thread::sleep(std::time::Duration::from_millis(idle));
                    let tick = std::time::Instant::now();
                    converter.convert(&window, &source).unwrap();
                    runs.push(format!("{:.0}", tick.elapsed().as_secs_f32() * 1000.0));
                }
                println!("after {idle:5} ms idle: {} ms", runs.join(" "));
            }
        }
        Some("gpuload") => {
            // Keeps the graphics card busy with the face swap, as a running camera would.
            let face = app_lib::face::FaceSwap::new(args[1].clone().into());
            let picture = fs::read(&args[2]).expect("cannot read the picture");
            face.set_source(&picture).expect("no face in the picture");
            let swapped = face.swap_photo(&picture).expect("swap failed");
            let big =
                image::imageops::resize(&swapped, 1280, 720, image::imageops::FilterType::Triangle);
            let (w, h) = (big.width() as usize, big.height() as usize);
            let mut frame = big.into_raw();
            let seconds: u64 = args[3].parse().unwrap();
            let started = std::time::Instant::now();
            let mut frames = 0;
            while started.elapsed().as_secs() < seconds {
                let tick = std::time::Instant::now();
                face.process_frame(&mut frame, w, h, app_lib::filters::Filter::None);
                frames += 1;
                // A camera hands a frame over every 33 ms at most.
                if let Some(rest) = std::time::Duration::from_millis(33).checked_sub(tick.elapsed())
                {
                    std::thread::sleep(rest);
                }
            }
            println!("gpuload: {frames} frames in {seconds} s");
        }
        Some("devices") => {
            use cpal::traits::{DeviceTrait, HostTrait};
            let host = cpal::default_host();
            let name = |d: Option<cpal::Device>| d.and_then(|d| d.name().ok()).unwrap_or_default();
            println!("default input:  {}", name(host.default_input_device()));
            println!("default output: {}", name(host.default_output_device()));
            for device in host.input_devices().unwrap() {
                let config = device.default_input_config();
                println!("in  {:<60} {:?}", device.name().unwrap_or_default(), config.ok());
            }
            for device in host.output_devices().unwrap() {
                let config = device.default_output_config();
                println!("out {:<60} {:?}", device.name().unwrap_or_default(), config.ok());
            }
        }
        Some("outticks") => {
            // How the default speakers ask for sound: how much at a time, how regularly.
            // Plays silence.
            use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
            let device = cpal::default_host().default_output_device().unwrap();
            let config = device.default_output_config().unwrap();
            let channels = usize::from(config.channels());
            let log = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
            let started = std::time::Instant::now();
            let sink = log.clone();
            let stream = device
                .build_output_stream(
                    &config.clone().into(),
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        data.fill(0.0);
                        sink.lock().unwrap().push((started.elapsed(), data.len() / channels));
                    },
                    |_| {},
                    None,
                )
                .unwrap();
            stream.play().unwrap();
            std::thread::sleep(std::time::Duration::from_secs(4));
            drop(stream);
            let log = log.lock().unwrap();
            let sizes: Vec<usize> = log.iter().map(|(_, n)| *n).collect();
            let gaps: Vec<f32> =
                log.windows(2).map(|w| (w[1].0 - w[0].0).as_secs_f32() * 1000.0).collect();
            println!(
                "{} {:?}: {} callbacks, frames min {} max {}, interval ms min {:.1} max {:.1}",
                device.name().unwrap_or_default(),
                config,
                log.len(),
                sizes.iter().min().unwrap(),
                sizes.iter().max().unwrap(),
                gaps.iter().copied().fold(f32::MAX, f32::min),
                gaps.iter().copied().fold(0.0, f32::max),
            );
        }
        Some("seams") => {
            // How far the block-by-block conversion is from converting the recording in one go,
            // and where in a block the difference sits.
            use app_lib::voice::{levelled, Converter, Layout, Stream, VoiceClone};
            let clone = VoiceClone::new(args[1].clone().into());
            clone.set_target(fs::read(&args[2]).unwrap(), extension(&args[2])).unwrap();
            let target = clone.target().unwrap();
            let input = levelled(load(&args[3]));
            let mut converter = clone.converter(target);
            let source = converter.describe(&input).unwrap();
            let whole = converter.convert(&input, &source).unwrap();
            fs::write(format!("{}-whole.wav", args[4]), app_lib::library::encode_wav(&whole, RATE))
                .unwrap();
            let spec = |x: &[f32]| -> Vec<Vec<f32>> {
                let mut planner = rustfft::FftPlanner::<f32>::new();
                let fft = planner.plan_fft_forward(1024);
                x.windows(1024)
                    .step_by(256)
                    .map(|frame| {
                        let mut buf: Vec<rustfft::num_complex::Complex<f32>> = frame
                            .iter()
                            .enumerate()
                            .map(|(n, s)| {
                                let w = 0.5 - 0.5 * (std::f32::consts::TAU * n as f32 / 1024.0).cos();
                                rustfft::num_complex::Complex::new(s * w, 0.0)
                            })
                            .collect();
                        fft.process(&mut buf);
                        buf[..372].iter().map(|c| (c.norm_sqr() + 1e-7).log10() * 10.0).collect()
                    })
                    .collect()
            };
            let whole_spec = spec(&whole);
            for effort in 0..=3u8 {
                for economy in [false, true] {
                    let layout = Layout::new(effort, economy);
                    let mut stream = Stream::new(layout);
                    stream.set_levelling(false);
                    stream.set_speaker(source.clone(), usize::MAX / 2);
                    let mut out = Vec::new();
                    for piece in input.chunks(220) {
                        stream.push(piece, &mut converter, &mut out);
                    }
                    let delay = (layout.delay_seconds() * RATE as f32).round() as usize;
                    let block = if economy { 24 } else { 12 };
                    // `out` is the input, later by the sound given after each block.
                    let after = delay - block * 256;
                    let aligned = &out[after.min(out.len())..];
                    let got = spec(aligned);
                    let mut by_position = vec![(0.0f64, 0usize); block];
                    let (mut total, mut count) = (0.0f64, 0usize);
                    for (frame, (a, b)) in got.iter().zip(&whole_spec).enumerate() {
                        let loud = b.iter().copied().fold(f32::MIN, f32::max);
                        if loud < -20.0 {
                            continue;
                        }
                        let lsd = (a.iter().zip(b).map(|(x, y)| (x - y) * (x - y)).sum::<f32>()
                            / a.len() as f32)
                            .sqrt();
                        total += f64::from(lsd);
                        count += 1;
                        let slot = &mut by_position[frame % block];
                        slot.0 += f64::from(lsd);
                        slot.1 += 1;
                    }
                    let positions: Vec<String> = by_position
                        .iter()
                        .map(|(sum, n)| format!("{:.1}", sum / (*n).max(1) as f64))
                        .collect();
                    println!(
                        "effort {effort} economy {economy}: {:.2} dB off, clicks/10s {:.1} (whole {:.1}); by frame in block: {}",
                        total / count.max(1) as f64,
                        clicks(&out, RATE) as f32 / (out.len() as f32 / RATE as f32) * 10.0,
                        clicks(&whole, RATE) as f32 / (whole.len() as f32 / RATE as f32) * 10.0,
                        positions.join(" ")
                    );
                    fs::write(
                        format!("{}-e{effort}{}.wav", args[4], if economy { "eco" } else { "" }),
                        app_lib::library::encode_wav(&out, RATE),
                    )
                    .unwrap();
                }
            }
        }
        Some("edges") => {
            // How much of a converted window is the same wave as the whole recording converted
            // in one go, frame by frame from the left edge to the right one.
            use app_lib::voice::{levelled, Converter, VoiceClone};
            let clone = VoiceClone::new(args[1].clone().into());
            clone.set_target(fs::read(&args[2]).unwrap(), extension(&args[2])).unwrap();
            let target = clone.target().unwrap();
            let input = levelled(load(&args[3]));
            let frames: usize = args.get(4).and_then(|v| v.parse().ok()).unwrap_or(84);
            let mut converter = clone.converter(target);
            let source = converter.describe(&input).unwrap();
            let whole = converter.convert(&input, &source).unwrap();
            let window = frames * 256;
            let mut alike = vec![(0.0f64, 0.0f64, 0.0f64); frames];
            let mut at = 0;
            // What stands in for the sound that is not there yet, after the window.
            let pad_frames: usize = args.get(5).and_then(|v| v.parse().ok()).unwrap_or(0);
            let pad_kind = args.get(6).map(String::as_str).unwrap_or("mirror");
            let mut runs: Vec<f32> = Vec::new();
            while at + window <= input.len() {
                let real = &input[at..at + window];
                let mut padded = real.to_vec();
                let pad = pad_frames * 256;
                match pad_kind {
                    "mirror" => padded.extend(real[window - pad..].iter().rev()),
                    "loop" => padded.extend_from_slice(&real[window - pad..]),
                    "zero" => padded.extend(std::iter::repeat(0.0).take(pad)),
                    _ => panic!("unknown padding"),
                }
                let tick = std::time::Instant::now();
                let part = converter.convert(&padded, &source).unwrap();
                if at > 0 {
                    runs.push(tick.elapsed().as_secs_f32() * 1000.0);
                }
                for frame in 0..frames {
                    let a = &part[frame * 256..(frame + 1) * 256];
                    let b = &whole[at + frame * 256..at + (frame + 1) * 256];
                    let slot = &mut alike[frame];
                    slot.0 += a.iter().zip(b).map(|(x, y)| f64::from(x * y)).sum::<f64>();
                    slot.1 += a.iter().map(|x| f64::from(x * x)).sum::<f64>();
                    slot.2 += b.iter().map(|x| f64::from(x * x)).sum::<f64>();
                }
                at += 37 * 256;
            }
            let line: Vec<String> = alike
                .iter()
                .map(|(ab, aa, bb)| format!("{:.2}", ab / (aa * bb).sqrt().max(1e-12)))
                .collect();
            runs.sort_by(f32::total_cmp);
            println!(
                "window of {frames} frames + {pad_frames} of {pad_kind}, run ms median {:.0} p90 {:.0} max {:.0}, likeness to the whole by frame:\n{}",
                runs[runs.len() / 2],
                runs[runs.len() * 9 / 10],
                runs[runs.len() - 1],
                line.join(" ")
            );
        }
        Some("time") => {
            // zz_lab time <models> <cpu|gpu> <frames>...  : run time by window length, in order.
            let bytes = fs::read(Path::new(&args[1]).join("tone_color.onnx")).unwrap();
            let mut session = if args[2] == "gpu" {
                let gpu = ort::ep::DirectML::default().with_performance_preference(
                    ort::ep::directml::PerformancePreference::HighPerformance,
                );
                Session::builder()
                    .unwrap()
                    .with_execution_providers([gpu.build()])
                    .unwrap()
                    .with_memory_pattern(false)
                    .unwrap()
                    .with_parallel_execution(false)
                    .unwrap()
                    .commit_from_memory(&bytes)
                    .unwrap()
            } else {
                Session::builder().unwrap().commit_from_memory(&bytes).unwrap()
            };
            for frames in args[3..].iter().map(|v| v.parse::<usize>().unwrap()) {
                let mut runs = Vec::new();
                for run in 0..14 {
                    let planes: Vec<f32> =
                        (0..513 * frames).map(|n| ((n * 31 + run) % 97) as f32 / 97.0).collect();
                    let tick = std::time::Instant::now();
                    let outputs = session
                        .run(ort::inputs![
                            "audio" => Tensor::from_array(([1, 513, frames], planes)).unwrap(),
                            "audio_length" => Tensor::from_array(([1], vec![frames as i64])).unwrap(),
                            "src_tone" => Tensor::from_array(([1, 256, 1], vec![0.1f32; 256])).unwrap(),
                            "dest_tone" => Tensor::from_array(([1, 256, 1], vec![0.2f32; 256])).unwrap(),
                            "tau" => Tensor::from_array(([1], vec![0.0f32])).unwrap(),
                        ])
                        .unwrap();
                    let _ = outputs[0].try_extract_tensor::<f32>().unwrap().1.len();
                    runs.push(tick.elapsed().as_secs_f32() * 1000.0);
                }
                let first = runs[0];
                let mut rest = runs[2..].to_vec();
                rest.sort_by(f32::total_cmp);
                println!(
                    "{frames:4} frames: first {first:6.0} ms, then median {:5.1} max {:5.1}",
                    rest[rest.len() / 2],
                    rest[rest.len() - 1]
                );
            }
        }
        _ => eprintln!("usage: zz_lab score <dnsmos.onnx> <file>..."),
    }
}
