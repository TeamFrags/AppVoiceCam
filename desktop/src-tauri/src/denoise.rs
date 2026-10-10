//! Noise reduction for the microphone, before the voice models hear it.
//!
//! The models redraw whatever they are given as a voice: the hiss of a microphone, a fan or
//! mains hum come out as a crackling, droning voice under the real one. RNNoise (a small
//! network, here in its Rust port, BSD licence) removes them first. It costs a hundredth of a
//! processor core and 10 ms of delay.

use nnnoiseless::DenoiseState;

use crate::voice::Resampler;

/// RNNoise works at this rate only, on frames of 10 ms.
pub const RATE: u32 = 48_000;
const FRAME: usize = DenoiseState::FRAME_SIZE;
/// RNNoise expects samples on the scale of 16-bit sound.
const SCALE: f32 = 32_768.0;

/// Cleans a stream of mono samples, block after block. What comes out is at 48 kHz, whatever
/// the rate of what goes in.
pub struct Denoiser {
    /// Brings the sound to 48 kHz when the microphone runs at another rate.
    up: Option<Resampler>,
    state: Box<DenoiseState<'static>>,
    waiting: Vec<f32>,
    frame: [f32; FRAME],
    /// The first frame out of RNNoise fades in from nothing and is not sound.
    started: bool,
}

impl Denoiser {
    pub fn new(rate: u32) -> Self {
        Self {
            up: (rate != RATE).then(|| Resampler::new(rate, RATE)),
            state: DenoiseState::new(),
            waiting: Vec::new(),
            frame: [0.0; FRAME],
            started: false,
        }
    }

    /// Adds the cleaned `input` to `output`. What does not fill a frame yet waits for more.
    pub fn process(&mut self, input: &[f32], output: &mut Vec<f32>) {
        match &mut self.up {
            Some(up) => up.process(input, &mut self.waiting),
            None => self.waiting.extend_from_slice(input),
        }
        let mut done = 0;
        for noisy in self.waiting.chunks_exact_mut(FRAME) {
            noisy.iter_mut().for_each(|sample| *sample *= SCALE);
            self.state.process_frame(&mut self.frame, noisy);
            done += FRAME;
            if !self.started {
                self.started = true;
                self.frame.fill(0.0);
            }
            output.extend(self.frame.iter().map(|sample| sample / SCALE));
        }
        self.waiting.drain(..done);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rms(samples: &[f32]) -> f32 {
        (samples.iter().map(|s| s * s).sum::<f32>() / samples.len().max(1) as f32).sqrt()
    }

    fn hiss(len: usize, level: f32) -> Vec<f32> {
        let mut seed = 3u32;
        (0..len)
            .map(|_| {
                seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                ((seed >> 8) as f32 / (1 << 23) as f32 - 1.0) * level
            })
            .collect()
    }

    #[test]
    fn hiss_is_removed_and_the_length_is_kept_whatever_the_blocks() {
        let noise = hiss(4 * RATE as usize, 0.02);
        let (mut denoiser, mut clean) = (Denoiser::new(RATE), Vec::new());
        // Uneven pieces, as a microphone hands them over.
        for piece in noise.chunks(441) {
            denoiser.process(piece, &mut clean);
        }
        assert_eq!(clean.len(), noise.len() / FRAME * FRAME);
        let settled = 2 * RATE as usize;
        let left = rms(&clean[settled..]) / rms(&noise[settled..]);
        // White noise up to 24 kHz is the hardest there is: a real room is brought down further.
        assert!(left < 0.7, "{left} of the hiss is left");
    }

    #[test]
    fn another_rate_comes_out_at_48_khz() {
        let (mut denoiser, mut clean) = (Denoiser::new(44_100), Vec::new());
        denoiser.process(&hiss(44_100, 0.01), &mut clean);
        assert!((clean.len() as i64 - 48_000).abs() < 2 * FRAME as i64, "{} samples", clean.len());
    }
}
