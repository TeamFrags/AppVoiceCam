//! Camera and microphone capture.
//!
//! Each capture runs on its own thread, because the device handles are tied to the thread that
//! opened them. A capture is stopped by clearing its flag; the thread then releases the device.

use std::{
    io::Cursor,
    sync::{
        atomic::{AtomicBool, AtomicU32, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use base64::{engine::general_purpose::STANDARD, Engine};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use nokhwa::{
    pixel_format::RgbFormat,
    utils::{ApiBackend, CameraIndex, RequestedFormat, RequestedFormatType},
    Camera,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

/// Preview frames are capped: the interface only needs a smooth picture, not every frame.
const PREVIEW_INTERVAL: Duration = Duration::from_millis(33);
const PREVIEW_JPEG_QUALITY: u8 = 70;
const LEVEL_INTERVAL: Duration = Duration::from_millis(50);

#[derive(Serialize)]
pub struct Device {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct Devices {
    pub cameras: Vec<Device>,
    pub microphones: Vec<Device>,
}

pub fn list_devices() -> Devices {
    let cameras = nokhwa::query(ApiBackend::Auto)
        .unwrap_or_default()
        .into_iter()
        .map(|info| Device { id: info.index().to_string(), name: info.human_name() })
        .collect();
    // Microphones have no stable identifier in cpal, so the name doubles as the id.
    let microphones = cpal::default_host()
        .input_devices()
        .map(|devices| {
            devices
                .filter_map(|device| device.name().ok())
                .map(|name| Device { id: name.clone(), name })
                .collect()
        })
        .unwrap_or_default();
    Devices { cameras, microphones }
}

/// Handle on a running capture thread.
#[derive(Default)]
pub struct Capture {
    running: Mutex<Option<Arc<AtomicBool>>>,
}

impl Capture {
    pub fn stop(&self) {
        if let Some(flag) = self.running.lock().unwrap().take() {
            flag.store(false, Ordering::SeqCst);
        }
    }

    /// Stops whatever was running and returns the flag the new thread must watch.
    fn restart(&self) -> Arc<AtomicBool> {
        self.stop();
        let flag = Arc::new(AtomicBool::new(true));
        *self.running.lock().unwrap() = Some(flag.clone());
        flag
    }
}

#[derive(Clone, Serialize)]
struct CameraFrame {
    /// JPEG, base64-encoded, ready for an `<img>` source.
    jpeg: String,
    width: u32,
    height: u32,
}

#[derive(Clone, Serialize)]
struct CaptureEnded {
    reason: String,
}

fn encode_preview(rgb: &[u8], width: u32, height: u32) -> Option<String> {
    let mut jpeg = Cursor::new(Vec::with_capacity(64 * 1024));
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, PREVIEW_JPEG_QUALITY)
        .encode(rgb, width, height, image::ExtendedColorType::Rgb8)
        .ok()?;
    Some(STANDARD.encode(jpeg.into_inner()))
}

pub fn start_camera(app: AppHandle, capture: &Capture, id: &str) -> AppResult<()> {
    let index = match id.parse::<u32>() {
        Ok(number) => CameraIndex::Index(number),
        Err(_) => CameraIndex::String(id.to_string()),
    };
    let running = capture.restart();

    thread::spawn(move || {
        let outcome = (|| -> Result<(), String> {
            let format =
                RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
            let mut camera = Camera::new(index, format).map_err(|e| e.to_string())?;
            camera.open_stream().map_err(|e| e.to_string())?;

            let mut last_preview = Instant::now() - PREVIEW_INTERVAL;
            while running.load(Ordering::SeqCst) {
                let frame = camera.frame().map_err(|e| e.to_string())?;
                if last_preview.elapsed() < PREVIEW_INTERVAL {
                    continue;
                }
                last_preview = Instant::now();
                let image = frame.decode_image::<RgbFormat>().map_err(|e| e.to_string())?;
                if let Some(jpeg) = encode_preview(image.as_raw(), image.width(), image.height()) {
                    let payload =
                        CameraFrame { jpeg, width: image.width(), height: image.height() };
                    let _ = app.emit("camera-frame", payload);
                }
            }
            let _ = camera.stop_stream();
            Ok(())
        })();
        if let Err(reason) = outcome {
            let _ = app.emit("camera-ended", CaptureEnded { reason });
        }
    });
    Ok(())
}

/// Loudest sample of a block, in the 0..1 range, whatever the device's sample format.
pub fn peak<T: cpal::Sample>(samples: &[T]) -> f32
where
    f32: cpal::FromSample<T>,
{
    samples
        .iter()
        .map(|sample| cpal::Sample::from_sample::<T>(*sample))
        .map(|value: f32| value.abs())
        .fold(0.0, f32::max)
        .min(1.0)
}

pub fn start_microphone(app: AppHandle, capture: &Capture, id: &str) -> AppResult<()> {
    let wanted = id.to_string();
    let running = capture.restart();

    thread::spawn(move || {
        let outcome = (|| -> Result<(), String> {
            let host = cpal::default_host();
            let device = host
                .input_devices()
                .map_err(|e| e.to_string())?
                .find(|device| device.name().map(|name| name == wanted).unwrap_or(false))
                .or_else(|| host.default_input_device())
                .ok_or("no microphone")?;
            let config = device.default_input_config().map_err(|e| e.to_string())?;

            // The audio callback only records the loudest sample; this thread reports it.
            let level = Arc::new(AtomicU32::new(0));
            let failed = Arc::new(AtomicBool::new(false));
            let on_error = {
                let failed = failed.clone();
                move |_| failed.store(true, Ordering::SeqCst)
            };
            macro_rules! stream {
                ($sample:ty) => {{
                    let level = level.clone();
                    device.build_input_stream(
                        &config.clone().into(),
                        move |data: &[$sample], _: &cpal::InputCallbackInfo| {
                            let block = peak(data).to_bits();
                            level.fetch_max(block, Ordering::Relaxed);
                        },
                        on_error,
                        None,
                    )
                }};
            }
            let stream = match config.sample_format() {
                cpal::SampleFormat::F32 => stream!(f32),
                cpal::SampleFormat::I16 => stream!(i16),
                cpal::SampleFormat::U16 => stream!(u16),
                other => return Err(format!("unsupported sample format {other:?}")),
            }
            .map_err(|e| e.to_string())?;
            stream.play().map_err(|e| e.to_string())?;

            while running.load(Ordering::SeqCst) {
                thread::sleep(LEVEL_INTERVAL);
                if failed.load(Ordering::SeqCst) {
                    return Err("device error".to_string());
                }
                // Positive floats keep their order when compared as bits, so fetch_max works.
                let value = f32::from_bits(level.swap(0, Ordering::Relaxed));
                let _ = app.emit("mic-level", value);
            }
            Ok(())
        })();
        if let Err(reason) = outcome {
            let _ = app.emit("mic-ended", CaptureEnded { reason });
        }
    });
    Ok(())
}

/// Used by the commands to refuse an empty selection early, with a clear code.
pub fn require_id(id: &str) -> AppResult<()> {
    if id.trim().is_empty() {
        return Err(AppError::new("no_device_selected"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peak_is_normalised_for_every_sample_format() {
        assert_eq!(peak(&[0.0f32, -0.5, 0.25]), 0.5);
        assert!((peak(&[0i16, i16::MIN]) - 1.0).abs() < 1e-3);
        assert!(peak(&[u16::MAX / 2 + 1]) < 1e-3, "mid-scale is silence for unsigned samples");
        assert_eq!(peak::<f32>(&[]), 0.0);
    }

    #[test]
    fn preview_is_a_valid_jpeg() {
        let rgb = vec![128u8; 4 * 2 * 3];
        let jpeg = STANDARD.decode(encode_preview(&rgb, 4, 2).unwrap()).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
    }

    #[test]
    fn restarting_a_capture_stops_the_previous_one() {
        let capture = Capture::default();
        let first = capture.restart();
        let second = capture.restart();
        assert!(!first.load(Ordering::SeqCst));
        assert!(second.load(Ordering::SeqCst));
        capture.stop();
        assert!(!second.load(Ordering::SeqCst));
    }
}
