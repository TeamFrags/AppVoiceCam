//! Camera and microphone capture.
//!
//! Each capture runs on its own thread, because the device handles are tied to the thread that
//! opened them. A capture is stopped by clearing its flag; the thread then releases the device.

use std::{
    io::Cursor,
    sync::{
        atomic::{AtomicBool, AtomicU32, AtomicU8, Ordering},
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

use crate::{
    effects::{self, MonitorFeed, MonitorQueue, Pending, Playout, VoiceSettings},
    error::{AppError, AppResult},
    face::FaceSwap,
    filters::Filter,
    phone::PhoneCamera,
    voice::VoiceClone,
};

/// Preview frames are capped: the interface only needs a smooth picture, not every frame.
const PREVIEW_INTERVAL: Duration = Duration::from_millis(33);
const PREVIEW_JPEG_QUALITY: u8 = 70;
/// In economy mode fewer frames go through the face models, which is what loads the graphics card.
const ECONOMY_INTERVAL: Duration = Duration::from_millis(125);
/// How long the capture waits for a picture from the phone before checking it must go on.
const PHONE_WAIT: Duration = Duration::from_millis(250);
const LEVEL_INTERVAL: Duration = Duration::from_millis(50);
const RECORD_MAX_SECONDS: usize = 60;

/// Collects what the microphone hears while a voice sample is being recorded, as mono samples.
#[derive(Default)]
pub struct Recorder {
    active: AtomicBool,
    rate: AtomicU32,
    samples: Mutex<Vec<f32>>,
}

impl Recorder {
    pub fn begin(&self) {
        self.samples.lock().unwrap().clear();
        self.active.store(true, Ordering::SeqCst);
    }

    /// Stops listening and returns the length of the recording, in seconds.
    pub fn end(&self) -> f32 {
        self.active.store(false, Ordering::SeqCst);
        let rate = self.rate.load(Ordering::SeqCst).max(1);
        self.samples.lock().unwrap().len() as f32 / rate as f32
    }

    /// Hands over the recording with its sample rate, leaving nothing behind.
    pub fn take(&self) -> (Vec<f32>, u32) {
        self.active.store(false, Ordering::SeqCst);
        (std::mem::take(&mut *self.samples.lock().unwrap()), self.rate.load(Ordering::SeqCst))
    }

    fn push<T: cpal::Sample>(&self, data: &[T], channels: usize)
    where
        f32: cpal::FromSample<T>,
    {
        if !self.active.load(Ordering::Relaxed) {
            return;
        }
        let limit = self.rate.load(Ordering::Relaxed) as usize * RECORD_MAX_SECONDS;
        let mut samples = self.samples.lock().unwrap();
        for frame in data.chunks(channels.max(1)) {
            if samples.len() >= limit {
                break;
            }
            let sum: f32 = frame.iter().map(|s| <f32 as cpal::Sample>::from_sample(*s)).sum();
            samples.push(sum / frame.len() as f32);
        }
    }
}

#[derive(Serialize)]
pub struct Device {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct Devices {
    pub cameras: Vec<Device>,
    pub microphones: Vec<Device>,
    /// Where the monitor can be played: speakers, headphones, virtual cables.
    pub speakers: Vec<Device>,
}

pub fn list_devices() -> Devices {
    let cameras = nokhwa::query(ApiBackend::Auto)
        .unwrap_or_default()
        .into_iter()
        .map(|info| Device { id: info.index().to_string(), name: info.human_name() })
        .collect();
    // Sound devices have no stable identifier in cpal, so the name doubles as the id.
    fn named(devices: impl Iterator<Item = cpal::Device>) -> Vec<Device> {
        devices
            .filter_map(|device| device.name().ok())
            .map(|name| Device { id: name.clone(), name })
            .collect()
    }
    let host = cpal::default_host();
    let microphones = host.input_devices().map(named).unwrap_or_default();
    let speakers = host.output_devices().map(named).unwrap_or_default();
    Devices { cameras, microphones, speakers }
}

/// Clears a flag when dropped: a helper thread watching it ends with the scope, whichever
/// way the scope is left.
struct StopOnDrop(Arc<AtomicBool>);

impl Drop for StopOnDrop {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
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
    /// Whether the face of this frame was replaced.
    swapped: bool,
}

#[derive(Clone, Serialize)]
struct CaptureEnded {
    reason: String,
}

/// JPEG, base64-encoded, ready for an `<img>` source.
pub fn encode_jpeg(rgb: &[u8], width: u32, height: u32, quality: u8) -> Option<String> {
    let mut jpeg = Cursor::new(Vec::with_capacity(64 * 1024));
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, quality)
        .encode(rgb, width, height, image::ExtendedColorType::Rgb8)
        .ok()?;
    Some(STANDARD.encode(jpeg.into_inner()))
}

pub fn start_camera(
    app: AppHandle,
    capture: &Capture,
    face: Arc<FaceSwap>,
    economy: Arc<AtomicBool>,
    filter: Arc<AtomicU8>,
    filter_intensity: Arc<AtomicU8>,
    id: &str,
) -> AppResult<()> {
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
                let interval =
                    if economy.load(Ordering::Relaxed) { ECONOMY_INTERVAL } else { PREVIEW_INTERVAL };
                if last_preview.elapsed() < interval {
                    continue;
                }
                last_preview = Instant::now();
                let mut image = frame.decode_image::<RgbFormat>().map_err(|e| e.to_string())?;
                let (width, height) = (image.width(), image.height());
                preview(&app, &face, &filter, &filter_intensity, &mut image, width, height);
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

/// Runs a picture through the face models and the filter, then hands it to the interface.
fn preview(
    app: &AppHandle,
    face: &FaceSwap,
    filter: &AtomicU8,
    filter_intensity: &AtomicU8,
    rgb: &mut [u8],
    width: u32,
    height: u32,
) {
    let filter = Filter::from_code(filter.load(Ordering::Relaxed));
    let intensity = filter_intensity.load(Ordering::Relaxed);
    let swapped = face.process_frame(rgb, width as usize, height as usize, filter, intensity);
    if let Some(jpeg) = encode_jpeg(rgb, width, height, PREVIEW_JPEG_QUALITY) {
        let _ = app.emit("camera-frame", CameraFrame { jpeg, width, height, swapped });
    }
}

/// The linked phone as the camera: its pictures take the same path as a webcam's. When the
/// link ends the thread ends quietly, the interface being told of the phone itself.
pub fn start_phone_camera(
    app: AppHandle,
    capture: &Capture,
    face: Arc<FaceSwap>,
    economy: Arc<AtomicBool>,
    filter: Arc<AtomicU8>,
    filter_intensity: Arc<AtomicU8>,
    phone: PhoneCamera,
) {
    let running = capture.restart();

    thread::spawn(move || {
        let mut last_preview = Instant::now() - PREVIEW_INTERVAL;
        while running.load(Ordering::SeqCst) {
            let Ok(frame) = phone.frame(PHONE_WAIT) else { return };
            let Some((mut rgb, width, height)) = frame else { continue };
            let interval =
                if economy.load(Ordering::Relaxed) { ECONOMY_INTERVAL } else { PREVIEW_INTERVAL };
            if last_preview.elapsed() < interval {
                continue;
            }
            last_preview = Instant::now();
            preview(&app, &face, &filter, &filter_intensity, &mut rgb, width, height);
        }
    });
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

/// Plays the monitor queue on the output called `wanted`, or on the default speakers or
/// headphones when there is none by that name, until the stream is dropped.
fn open_monitor(
    queue: MonitorQueue,
    wanted: &str,
    failed: Arc<AtomicBool>,
) -> Result<cpal::Stream, String> {
    fn stream<T>(
        device: &cpal::Device,
        config: &cpal::StreamConfig,
        queue: MonitorQueue,
        failed: Arc<AtomicBool>,
    ) -> Result<cpal::Stream, cpal::BuildStreamError>
    where
        T: cpal::SizedSample + cpal::FromSample<f32>,
    {
        let channels = usize::from(config.channels).max(1);
        let mut mono = Vec::new();
        device.build_output_stream(
            config,
            move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
                mono.resize(data.len() / channels, 0.0);
                queue.lock().unwrap().pull(&mut mono);
                // The voice is mono: every speaker plays the same sample.
                for (frame, sample) in data.chunks_mut(channels).zip(&mono) {
                    frame.fill(<T as cpal::Sample>::from_sample(*sample));
                }
            },
            move |_| failed.store(true, Ordering::SeqCst),
            None,
        )
    }

    let host = cpal::default_host();
    let device = host
        .output_devices()
        .ok()
        .and_then(|mut devices| {
            devices.find(|device| device.name().map(|name| name == wanted).unwrap_or(false))
        })
        .or_else(|| host.default_output_device())
        .ok_or("no audio output")?;
    let config = device.default_output_config().map_err(|e| e.to_string())?;
    queue.lock().unwrap().open(config.sample_rate().0);
    let format = config.sample_format();
    let config = config.into();
    let stream = match format {
        cpal::SampleFormat::F32 => stream::<f32>(&device, &config, queue, failed),
        cpal::SampleFormat::I16 => stream::<i16>(&device, &config, queue, failed),
        cpal::SampleFormat::U16 => stream::<u16>(&device, &config, queue, failed),
        other => return Err(format!("unsupported sample format {other:?}")),
    }
    .map_err(|e| e.to_string())?;
    stream.play().map_err(|e| e.to_string())?;
    Ok(stream)
}

pub fn start_microphone(
    app: AppHandle,
    capture: &Capture,
    recorder: Arc<Recorder>,
    voice: Arc<VoiceSettings>,
    clone: Arc<VoiceClone>,
    economy: Arc<AtomicBool>,
    id: &str,
) -> AppResult<()> {
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
            // The user's own voice is described once per microphone.
            clone.listen_to(&device.name().unwrap_or_default());
            let config = device.default_input_config().map_err(|e| e.to_string())?;
            let channels = usize::from(config.channels());
            let rate = config.sample_rate().0;
            recorder.rate.store(rate, Ordering::SeqCst);
            let monitor: MonitorQueue = Arc::new(Mutex::new(Playout::new(rate)));
            let pending = Arc::<Pending>::default();
            let mut feed =
                MonitorFeed::new(voice.clone(), monitor.clone(), rate, clone.clone(), pending.clone());
            // The cloned voice is computed on its own thread, which lasts as long as this one.
            let converting = Arc::new(AtomicBool::new(true));
            let _stop_converting = StopOnDrop(converting.clone());
            {
                let (voice, monitor) = (voice.clone(), monitor.clone());
                thread::spawn(move || {
                    effects::convert_voice(
                        &converting,
                        &voice,
                        &clone,
                        &economy,
                        &pending,
                        &monitor,
                        rate,
                    )
                });
            }

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
                    let recorder = recorder.clone();
                    device.build_input_stream(
                        &config.clone().into(),
                        move |data: &[$sample], _: &cpal::InputCallbackInfo| {
                            let block = peak(data).to_bits();
                            level.fetch_max(block, Ordering::Relaxed);
                            recorder.push(data, channels);
                            feed.push(data, channels);
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

            // The speakers are opened and closed here as the user turns the monitor on and off.
            let mut speaker = None;
            let mut playing_on = String::new();
            let speaker_failed = Arc::new(AtomicBool::new(false));
            while running.load(Ordering::SeqCst) {
                thread::sleep(LEVEL_INTERVAL);
                if failed.load(Ordering::SeqCst) {
                    return Err("device error".to_string());
                }
                // Positive floats keep their order when compared as bits, so fetch_max works.
                let value = f32::from_bits(level.swap(0, Ordering::Relaxed));
                let _ = app.emit("mic-level", value);

                let lost = speaker_failed.swap(false, Ordering::SeqCst);
                // Another output was chosen: the monitor moves to it.
                let moved = voice.output() != playing_on;
                if speaker.is_some() && (lost || moved || !voice.monitor()) {
                    speaker = None;
                }
                if speaker.is_none() && voice.monitor() && !lost {
                    playing_on = voice.output();
                    speaker = open_monitor(monitor.clone(), &playing_on, speaker_failed.clone()).ok();
                }
                // No output, or it went away: the monitor is off again and the interface is told.
                if voice.monitor() && speaker.is_none() {
                    voice.set_monitor(false);
                    let _ = app.emit("monitor-ended", ());
                }
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
    fn a_recording_is_mono_and_only_kept_while_recording() {
        let recorder = Recorder::default();
        recorder.rate.store(4, Ordering::SeqCst);
        recorder.push(&[1.0f32, 1.0], 2);
        assert_eq!(recorder.end(), 0.0, "nothing is kept before the recording begins");

        recorder.begin();
        recorder.push(&[1.0f32, 0.0, -0.5, -0.5], 2);
        assert_eq!(recorder.end(), 0.5);
        recorder.push(&[1.0f32, 1.0], 2);
        assert_eq!(recorder.take(), (vec![0.5, -0.5], 4));
        assert!(recorder.take().0.is_empty());
    }

    #[test]
    fn preview_is_a_valid_jpeg() {
        let rgb = vec![128u8; 4 * 2 * 3];
        let jpeg = STANDARD.decode(encode_jpeg(&rgb, 4, 2, 70).unwrap()).unwrap();
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
