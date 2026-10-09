// Temporary: compares ways of cutting the stream against a one-shot conversion.
use app_lib::library::encode_wav;
use app_lib::voice::{read_audio, Converter, VoiceClone};
use rustfft::{num_complex::Complex, FftPlanner};
use std::{env, fs};

const HOP: usize = 256;

fn num(name: &str, default: usize) -> usize {
    env::var(name).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn spectrum(samples: &[f32]) -> Vec<Vec<f32>> {
    let fft = FftPlanner::<f32>::new().plan_fft_forward(1024);
    samples
        .windows(1024)
        .step_by(256)
        .map(|frame| {
            let mut buf: Vec<Complex<f32>> = frame
                .iter()
                .enumerate()
                .map(|(n, s)| Complex::new(s * (0.5 - 0.5 * (std::f32::consts::TAU * n as f32 / 1024.0).cos()), 0.0))
                .collect();
            fft.process(&mut buf);
            buf[..513].iter().map(|c| c.norm()).collect()
        })
        .collect()
}

/// Mean log-spectral distance in dB over frames that carry speech, and the share of frames
/// that are more than 6 dB away.
fn distance(a: &[f32], b: &[f32]) -> (f32, f32) {
    let (sa, sb) = (spectrum(a), spectrum(b));
    let (mut total, mut frames, mut bad) = (0.0, 0, 0);
    for (x, y) in sa.iter().zip(&sb) {
        let energy: f32 = y.iter().map(|v| v * v).sum();
        if energy < 1.0 {
            continue;
        }
        let d: f32 = x.iter().zip(y).map(|(p, q)| (20.0 * ((p + 1e-2) / (q + 1e-2)).log10()).abs()).sum::<f32>() / 513.0;
        total += d;
        frames += 1;
        if d > 6.0 {
            bad += 1;
        }
    }
    (total / frames.max(1) as f32, bad as f32 / frames.max(1) as f32)
}

/// Roughness: energy above 6 kHz that comes and goes at the block rate shows as a high
/// frame-to-frame change of the high band.
fn flutter(a: &[f32]) -> f32 {
    let s = spectrum(a);
    let high: Vec<f32> = s.iter().map(|f| f[280..].iter().map(|v| v * v).sum::<f32>().sqrt()).collect();
    let mean = high.iter().sum::<f32>() / high.len() as f32;
    high.windows(2).map(|p| (p[1] - p[0]).abs()).sum::<f32>() / high.len() as f32 / mean.max(1e-6)
}

fn main() {
    let a: Vec<String> = env::args().skip(1).collect();
    let (models, reference, speech, out) = (&a[0], &a[1], &a[2], &a[3]);
    let ext = |p: &str| p.rsplit('.').next().unwrap().to_string();
    let clone = VoiceClone::new(models.into());
    clone.set_target(fs::read(reference).unwrap(), &ext(reference)).unwrap();
    let input = read_audio(fs::read(speech).unwrap(), &ext(speech)).unwrap();
    let input = &input[..input.len() / HOP * HOP];
    let mut conv = clone.converter(clone.target().unwrap());
    let source = conv.describe(input).unwrap();

    if env::var_os("ONESHOT").is_some() {
        let whole = conv.convert(input, &source).unwrap();
        fs::write(out, encode_wav(&whole, 22050)).unwrap();
        println!("one shot written, flutter {:.3}, input flutter {:.3}", flutter(&whole), flutter(input));
        return;
    }
    let oneshot = read_audio(fs::read(&a[4]).unwrap(), "wav").unwrap();

    let window = num("WINDOW", 42) * HOP;
    let block = num("BLOCK", 8) * HOP;
    let fade = num("FADE", 512);
    let search = num("SEARCH", 0);
    let guard = num("GUARD", 0) * HOP;
    let context = window - block - fade - search - guard;
    let live_source = env::var_os("LIVESRC").is_some();

    let mut win = vec![0.0f32; window];
    let mut tail = vec![0.0f32; fade];
    let mut output = Vec::new();
    for (index, chunk) in input.chunks_exact(block).enumerate() {
        win.drain(..block);
        win.extend_from_slice(chunk);
        let src = if live_source && index < 20 { conv.describe(&win).unwrap() } else { source.clone() };
        let converted = conv.convert(&win, &src).unwrap();
        let mut best = (0usize, f32::MIN);
        if search > 0 && tail.iter().any(|s| s.abs() > 1e-4) {
            for d in 0..=search {
                let seg = &converted[context + d..context + d + fade];
                let dot: f32 = seg.iter().zip(&tail).map(|(x, y)| x * y).sum();
                let norm: f32 = seg.iter().map(|x| x * x).sum::<f32>().sqrt() + 1e-6;
                if dot / norm > best.1 {
                    best = (d, dot / norm);
                }
            }
        }
        let start = context + best.0;
        for at in 0..block {
            let s = converted[start + at];
            output.push(if at < fade {
                let w = (std::f32::consts::FRAC_PI_2 * (at as f32 + 0.5) / fade as f32).sin().powi(2);
                tail[at] + (s - tail[at]) * w
            } else {
                s
            });
        }
        tail.copy_from_slice(&converted[start + block..start + block + fade]);
    }
    let delay = fade + search + guard;
    let (lsd, bad) = distance(&output[delay..], &oneshot);
    println!(
        "block {} fade {fade} search {search} guard {} ctx {}: LSD {lsd:.2} dB, bad frames {:.0}%, flutter {:.3}",
        block / HOP, guard / HOP, context / HOP, bad * 100.0, flutter(&output)
    );
    fs::write(out, encode_wav(&output, 22050)).unwrap();
}
