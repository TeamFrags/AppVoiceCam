//! Face swap: puts the face of a source picture on the face seen by the camera.
//!
//! Three models run one after the other, the same ones as InsightFace and Deep-Live-Cam:
//! a detector (SCRFD) that finds the face and five landmarks, a recogniser (ArcFace) that
//! turns the source face into an identity vector, and the swapper (inswapper) that redraws an
//! aligned 128 × 128 crop of the target with that identity. The crop is then blended back.
//!
//! The models are published for non-commercial use only: see `scripts/fetch-models.mjs`.

use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    sync::Mutex,
};

use image::{DynamicImage, ImageDecoder, ImageReader};
use ort::{
    ep,
    session::{builder::SessionBuilder, Session},
    value::Tensor,
};

use crate::{
    error::AppError,
    filters::{self, Filter},
};

const DETECTOR_FILE: &str = "det_10g.onnx";
const RECOGNISER_FILE: &str = "w600k_r50.onnx";
const SWAPPER_FILE: &str = "inswapper_128.onnx";

const DET_SIZE: usize = 640;
const DET_THRESHOLD: f32 = 0.5;
const DET_STRIDES: [usize; 3] = [8, 16, 32];
const DET_ANCHORS: usize = 2;
const ARCFACE_SIZE: usize = 112;
const SWAP_SIZE: usize = 128;
const EMBEDDING: usize = 512;
/// Photos are reduced to this size before a still swap: larger ones only cost time.
const MAX_PHOTO_SIDE: u32 = 1920;

/// Where the five landmarks (eyes, nose, mouth corners) sit in a 112 × 112 aligned face.
pub(crate) const ARCFACE_TEMPLATE: [[f32; 2]; 5] = [
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
];
/// The swapper was trained on the same template, shifted to the middle of its 128 × 128 crop.
const SWAP_TEMPLATE_SHIFT: f32 = 8.0;

#[derive(Debug)]
pub enum FaceError {
    ModelsMissing,
    InvalidImage,
    NoFace,
    Engine(String),
}

impl From<ort::Error> for FaceError {
    fn from(err: ort::Error) -> Self {
        FaceError::Engine(err.to_string())
    }
}

impl From<ort::Error<SessionBuilder>> for FaceError {
    fn from(err: ort::Error<SessionBuilder>) -> Self {
        FaceError::Engine(err.to_string())
    }
}

impl From<FaceError> for AppError {
    fn from(err: FaceError) -> Self {
        AppError::new(match err {
            FaceError::ModelsMissing => "models_missing",
            FaceError::InvalidImage => "invalid_image",
            FaceError::NoFace => "no_face",
            FaceError::Engine(_) => "face_engine_failed",
        })
    }
}

/// Rotation, uniform scale and translation: `x' = a·x − b·y + tx`, `y' = b·x + a·y + ty`.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Similarity {
    a: f32,
    b: f32,
    tx: f32,
    ty: f32,
}

impl Similarity {
    /// Least-squares fit that sends `from` onto `to`.
    pub(crate) fn fit(from: &[[f32; 2]; 5], to: &[[f32; 2]; 5]) -> Self {
        let mean = |points: &[[f32; 2]; 5]| {
            let sum = points.iter().fold([0.0, 0.0], |acc, p| [acc[0] + p[0], acc[1] + p[1]]);
            [sum[0] / 5.0, sum[1] / 5.0]
        };
        let (from_mean, to_mean) = (mean(from), mean(to));
        let (mut dot, mut cross, mut norm) = (0.0, 0.0, 0.0);
        for (p, q) in from.iter().zip(to) {
            let (px, py) = (p[0] - from_mean[0], p[1] - from_mean[1]);
            let (qx, qy) = (q[0] - to_mean[0], q[1] - to_mean[1]);
            dot += px * qx + py * qy;
            cross += px * qy - py * qx;
            norm += px * px + py * py;
        }
        let norm = norm.max(f32::EPSILON);
        let (a, b) = (dot / norm, cross / norm);
        Self {
            a,
            b,
            tx: to_mean[0] - (a * from_mean[0] - b * from_mean[1]),
            ty: to_mean[1] - (b * from_mean[0] + a * from_mean[1]),
        }
    }

    pub(crate) fn apply(&self, x: f32, y: f32) -> (f32, f32) {
        (self.a * x - self.b * y + self.tx, self.b * x + self.a * y + self.ty)
    }

    /// How much lengths grow through the transform.
    pub(crate) fn scale(&self) -> f32 {
        self.a.hypot(self.b)
    }

    pub(crate) fn inverse(&self) -> Self {
        let det = (self.a * self.a + self.b * self.b).max(f32::EPSILON);
        let (a, b) = (self.a / det, -self.b / det);
        Self { a, b, tx: -(a * self.tx - b * self.ty), ty: -(b * self.tx + a * self.ty) }
    }
}

/// Packed 8-bit RGB picture, borrowed from the capture or from a decoded photo.
struct Frame<'a> {
    rgb: &'a [u8],
    width: usize,
    height: usize,
}

impl Frame<'_> {
    /// Bilinear sample; anything outside the picture is black.
    fn sample(&self, x: f32, y: f32) -> [f32; 3] {
        let (x0, y0) = (x.floor(), y.floor());
        let (fx, fy) = (x - x0, y - y0);
        let mut out = [0.0; 3];
        for (dy, wy) in [(0.0, 1.0 - fy), (1.0, fy)] {
            for (dx, wx) in [(0.0, 1.0 - fx), (1.0, fx)] {
                let (px, py) = (x0 + dx, y0 + dy);
                if px < 0.0 || py < 0.0 || px >= self.width as f32 || py >= self.height as f32 {
                    continue;
                }
                let at = (py as usize * self.width + px as usize) * 3;
                let weight = wx * wy;
                for (channel, value) in out.iter_mut().enumerate() {
                    *value += weight * f32::from(self.rgb[at + channel]);
                }
            }
        }
        out
    }

    /// Aligned square crop as a planar (channel, row, column) tensor of `(pixel − mean) / scale`.
    fn crop(&self, to_crop: &Similarity, size: usize, mean: f32, scale: f32) -> Vec<f32> {
        let to_frame = to_crop.inverse();
        let plane = size * size;
        let mut tensor = vec![0.0; 3 * plane];
        for y in 0..size {
            for x in 0..size {
                let (sx, sy) = to_frame.apply(x as f32, y as f32);
                let pixel = self.sample(sx, sy);
                for (channel, value) in pixel.iter().enumerate() {
                    tensor[channel * plane + y * size + x] = (value - mean) / scale;
                }
            }
        }
        tensor
    }
}

struct Face {
    score: f32,
    area: f32,
    landmarks: [[f32; 2]; 5],
}

/// Identity of the source face, in the form the swapper expects.
#[derive(Clone)]
pub struct Identity(Vec<f32>);

pub struct FaceEngine {
    detector: Session,
    detector_input: String,
    recogniser: Session,
    recogniser_input: String,
    swapper: Session,
    /// Matrix stored inside the swapper file that maps an ArcFace embedding to its input space.
    emap: Vec<f32>,
}

pub(crate) fn session(model: &[u8]) -> Result<Session, FaceError> {
    // The graphics card is asked first; ONNX Runtime falls back to the processor without it.
    let gpu = ep::DirectML::default()
        .with_performance_preference(ep::directml::PerformancePreference::HighPerformance);
    // DirectML requires sequential execution and no memory pattern.
    Ok(Session::builder()?
        .with_execution_providers([gpu.build()])?
        .with_memory_pattern(false)?
        .with_parallel_execution(false)?
        .commit_from_memory(model)?)
}

fn read_model(dir: &Path, file: &str) -> Result<Vec<u8>, FaceError> {
    fs::read(dir.join(file)).map_err(|_| FaceError::ModelsMissing)
}

fn normalise(vector: &mut [f32]) {
    let norm = vector.iter().map(|v| v * v).sum::<f32>().sqrt().max(f32::EPSILON);
    vector.iter_mut().for_each(|v| *v /= norm);
}

impl FaceEngine {
    pub fn load(dir: &Path) -> Result<Self, FaceError> {
        let detector = session(&read_model(dir, DETECTOR_FILE)?)?;
        let recogniser = session(&read_model(dir, RECOGNISER_FILE)?)?;
        let swapper_file = read_model(dir, SWAPPER_FILE)?;
        let emap = onnx::last_initializer(&swapper_file, [EMBEDDING, EMBEDDING])
            .ok_or_else(|| FaceError::Engine("swapper file has no identity matrix".into()))?;
        let swapper = session(&swapper_file)?;
        Ok(Self {
            detector_input: detector.inputs()[0].name().to_string(),
            detector,
            recogniser_input: recogniser.inputs()[0].name().to_string(),
            recogniser,
            swapper,
            emap,
        })
    }

    /// Finds the main face: the most confident detection among the largest ones.
    fn detect(&mut self, frame: &Frame) -> Result<Face, FaceError> {
        // The picture is scaled into the top-left corner of the square input, the rest is black.
        let scale = (DET_SIZE as f32 / frame.width as f32).min(DET_SIZE as f32 / frame.height as f32);
        let width = ((frame.width as f32 * scale) as usize).clamp(1, DET_SIZE);
        let height = ((frame.height as f32 * scale) as usize).clamp(1, DET_SIZE);
        let plane = DET_SIZE * DET_SIZE;
        let mut blob = vec![-127.5 / 128.0; 3 * plane];
        for y in 0..height {
            for x in 0..width {
                let sx = ((x as f32 + 0.5) / scale - 0.5).clamp(0.0, frame.width as f32 - 1.0);
                let sy = ((y as f32 + 0.5) / scale - 0.5).clamp(0.0, frame.height as f32 - 1.0);
                let pixel = frame.sample(sx, sy);
                for (channel, value) in pixel.iter().enumerate() {
                    blob[channel * plane + y * DET_SIZE + x] = (value - 127.5) / 128.0;
                }
            }
        }

        let input = Tensor::from_array(([1, 3, DET_SIZE, DET_SIZE], blob))?;
        let outputs = self.detector.run(ort::inputs![self.detector_input.as_str() => input])?;
        // Per stride: one score, four box distances and five landmarks for each anchor. The
        // outputs are told apart by their length, which does not depend on their order.
        let mut tensors = Vec::with_capacity(outputs.len());
        for index in 0..outputs.len() {
            tensors.push(outputs[index].try_extract_tensor::<f32>()?.1);
        }
        let of_len = |len: usize| tensors.iter().copied().find(|tensor| tensor.len() == len);

        let mut faces = Vec::new();
        for stride in DET_STRIDES {
            let side = DET_SIZE / stride;
            let count = side * side * DET_ANCHORS;
            let (Some(scores), Some(boxes), Some(points)) =
                (of_len(count), of_len(count * 4), of_len(count * 10))
            else {
                return Err(FaceError::Engine("unexpected detector outputs".into()));
            };
            for anchor in (0..count).filter(|&anchor| scores[anchor] >= DET_THRESHOLD) {
                let cell = anchor / DET_ANCHORS;
                let (cx, cy) = ((cell % side * stride) as f32, (cell / side * stride) as f32);
                let distance = |index: usize| boxes[anchor * 4 + index] * stride as f32;
                let area = (distance(0) + distance(2)) * (distance(1) + distance(3));
                let mut landmarks = [[0.0; 2]; 5];
                for (index, landmark) in landmarks.iter_mut().enumerate() {
                    let at = anchor * 10 + index * 2;
                    landmark[0] = (cx + points[at] * stride as f32) / scale;
                    landmark[1] = (cy + points[at + 1] * stride as f32) / scale;
                }
                faces.push(Face { score: scores[anchor], area, landmarks });
            }
        }

        let largest = faces.iter().map(|face| face.area).fold(0.0, f32::max);
        faces
            .into_iter()
            .filter(|face| face.area >= largest * 0.6)
            .max_by(|a, b| a.score.total_cmp(&b.score))
            .ok_or(FaceError::NoFace)
    }

    fn identity(&mut self, frame: &Frame) -> Result<Identity, FaceError> {
        let face = self.detect(frame)?;
        let to_crop = Similarity::fit(&face.landmarks, &ARCFACE_TEMPLATE);
        let crop = frame.crop(&to_crop, ARCFACE_SIZE, 127.5, 127.5);
        let input = Tensor::from_array(([1, 3, ARCFACE_SIZE, ARCFACE_SIZE], crop))?;
        let outputs = self.recogniser.run(ort::inputs![self.recogniser_input.as_str() => input])?;
        let mut embedding = outputs[0].try_extract_tensor::<f32>()?.1.to_vec();
        if embedding.len() != EMBEDDING {
            return Err(FaceError::Engine("unexpected embedding size".into()));
        }
        normalise(&mut embedding);

        let mut latent = vec![0.0; EMBEDDING];
        for (row, weight) in embedding.iter().enumerate() {
            let emap_row = &self.emap[row * EMBEDDING..(row + 1) * EMBEDDING];
            for (value, coefficient) in latent.iter_mut().zip(emap_row) {
                *value += weight * coefficient;
            }
        }
        normalise(&mut latent);
        Ok(Identity(latent))
    }

    /// Landmarks of the main face of the picture.
    fn landmarks(
        &mut self,
        rgb: &[u8],
        width: usize,
        height: usize,
    ) -> Result<[[f32; 2]; 5], FaceError> {
        Ok(self.detect(&Frame { rgb, width, height })?.landmarks)
    }

    /// Replaces the main face of the picture, in place, and returns its landmarks.
    fn swap(
        &mut self,
        rgb: &mut [u8],
        width: usize,
        height: usize,
        identity: &Identity,
    ) -> Result<[[f32; 2]; 5], FaceError> {
        let mut template = ARCFACE_TEMPLATE;
        template.iter_mut().for_each(|point| point[0] += SWAP_TEMPLATE_SHIFT);

        let (landmarks, to_crop, crop) = {
            let frame = Frame { rgb, width, height };
            let face = self.detect(&frame)?;
            let to_crop = Similarity::fit(&face.landmarks, &template);
            (face.landmarks, to_crop, frame.crop(&to_crop, SWAP_SIZE, 0.0, 255.0))
        };
        let target = Tensor::from_array(([1, 3, SWAP_SIZE, SWAP_SIZE], crop))?;
        let source = Tensor::from_array(([1, EMBEDDING], identity.0.clone()))?;
        let outputs = self.swapper.run(ort::inputs!["target" => target, "source" => source])?;
        let swapped = outputs[0].try_extract_tensor::<f32>()?.1;
        let plane = SWAP_SIZE * SWAP_SIZE;
        if swapped.len() != 3 * plane {
            return Err(FaceError::Engine("unexpected swapper output".into()));
        }

        // Only the part of the picture covered by the crop is touched.
        let to_frame = to_crop.inverse();
        let last = (SWAP_SIZE - 1) as f32;
        let corners = [(0.0, 0.0), (last, 0.0), (0.0, last), (last, last)]
            .map(|(x, y)| to_frame.apply(x, y));
        let (xs, ys) = (corners.map(|corner| corner.0), corners.map(|corner| corner.1));
        let lowest = |values: [f32; 4]| values.into_iter().fold(f32::MAX, f32::min).max(0.0);
        let highest = |values: [f32; 4]| values.into_iter().fold(0.0, f32::max);
        let (x_from, y_from) = (lowest(xs).floor() as usize, lowest(ys).floor() as usize);
        let x_to = (highest(xs).ceil() as usize).min(width - 1);
        let y_to = (highest(ys).ceil() as usize).min(height - 1);

        for y in y_from..=y_to {
            for x in x_from..=x_to {
                let (u, v) = to_crop.apply(x as f32, y as f32);
                if u < 0.0 || v < 0.0 || u > last || v > last {
                    continue;
                }
                let alpha = blend_weight(u.min(v).min(last - u).min(last - v));
                if alpha <= 0.0 {
                    continue;
                }
                let (u0, v0) = (u.floor() as usize, v.floor() as usize);
                let (u1, v1) = ((u0 + 1).min(SWAP_SIZE - 1), (v0 + 1).min(SWAP_SIZE - 1));
                let (fu, fv) = (u - u0 as f32, v - v0 as f32);
                let at = (y * width + x) * 3;
                for channel in 0..3 {
                    let value = |row: usize, column: usize| {
                        swapped[channel * plane + row * SWAP_SIZE + column]
                    };
                    let top = value(v0, u0) * (1.0 - fu) + value(v0, u1) * fu;
                    let bottom = value(v1, u0) * (1.0 - fu) + value(v1, u1) * fu;
                    let new = (top * (1.0 - fv) + bottom * fv) * 255.0;
                    let old = f32::from(rgb[at + channel]);
                    rgb[at + channel] = (old + (new - old) * alpha).round().clamp(0.0, 255.0) as u8;
                }
            }
        }
        Ok(landmarks)
    }
}

/// How much of the swapped crop is kept, from its distance to the edge of the crop: nothing
/// on the border, everything inside, with a soft transition so no square outline shows.
fn blend_weight(distance_to_edge: f32) -> f32 {
    const BORDER: f32 = 6.0;
    const FEATHER: f32 = 16.0;
    let t = ((distance_to_edge - BORDER) / FEATHER).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Decodes a photo, upright (phones store the rotation apart from the pixels).
fn decode(bytes: &[u8]) -> Result<image::RgbImage, FaceError> {
    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| FaceError::InvalidImage)?
        .into_decoder()
        .map_err(|_| FaceError::InvalidImage)?;
    let orientation = decoder.orientation().map_err(|_| FaceError::InvalidImage)?;
    let mut picture = DynamicImage::from_decoder(decoder).map_err(|_| FaceError::InvalidImage)?;
    picture.apply_orientation(orientation);
    if picture.width().max(picture.height()) > MAX_PHOTO_SIDE {
        picture = picture.thumbnail(MAX_PHOTO_SIDE, MAX_PHOTO_SIDE);
    }
    Ok(picture.to_rgb8())
}

/// The face chosen by the user and the engine that applies it. The engine is loaded on first
/// use: it takes a few seconds and several hundred megabytes of graphics memory.
pub struct FaceSwap {
    models: PathBuf,
    engine: Mutex<Option<FaceEngine>>,
    identity: Mutex<Option<Identity>>,
}

impl FaceSwap {
    pub fn new(models: PathBuf) -> Self {
        Self { models, engine: Mutex::new(None), identity: Mutex::new(None) }
    }

    fn with_engine<T>(
        &self,
        run: impl FnOnce(&mut FaceEngine) -> Result<T, FaceError>,
    ) -> Result<T, FaceError> {
        let mut engine = self.engine.lock().unwrap();
        if engine.is_none() {
            *engine = Some(FaceEngine::load(&self.models)?);
        }
        run(engine.as_mut().unwrap())
    }

    /// Chooses the face to wear, from an image file (JPEG, PNG or WebP).
    pub fn set_source(&self, image: &[u8]) -> Result<(), FaceError> {
        let picture = decode(image)?;
        let frame = Frame {
            rgb: picture.as_raw(),
            width: picture.width() as usize,
            height: picture.height() as usize,
        };
        let identity = self.with_engine(|engine| engine.identity(&frame))?;
        *self.identity.lock().unwrap() = Some(identity);
        Ok(())
    }

    /// Decodes a picture and checks that a face is found in it, without choosing it.
    pub fn portrait(&self, image: &[u8]) -> Result<image::RgbImage, FaceError> {
        let picture = decode(image)?;
        let frame = Frame {
            rgb: picture.as_raw(),
            width: picture.width() as usize,
            height: picture.height() as usize,
        };
        self.with_engine(|engine| engine.identity(&frame))?;
        Ok(picture)
    }

    pub fn clear_source(&self) {
        *self.identity.lock().unwrap() = None;
    }

    /// Swaps the face of a still photo and returns it as packed RGB with its size.
    pub fn swap_photo(&self, image: &[u8], filter: Filter, intensity: u8) -> Result<image::RgbImage, FaceError> {
        let identity = self.identity.lock().unwrap().clone().ok_or(FaceError::NoFace)?;
        let mut picture = decode(image)?;
        let (width, height) = (picture.width() as usize, picture.height() as usize);
        let found = self.with_engine(|engine| engine.swap(&mut picture, width, height, &identity));
        filters::apply(&mut picture, width, height, filter, intensity, found.as_ref().ok());
        found?;
        Ok(picture)
    }

    /// Applies the face swap (if a face is chosen) and the filter to a still photo. Works
    /// without a face chosen: the filter is applied alone, which is enough to test accessories.
    pub fn process_photo(&self, image: &[u8], filter: Filter, intensity: u8) -> Result<image::RgbImage, FaceError> {
        let mut picture = decode(image)?;
        let (width, height) = (picture.width() as usize, picture.height() as usize);
        let identity = self.identity.lock().unwrap().clone();
        let found = match &identity {
            Some(identity) => self.with_engine(|engine| engine.swap(&mut picture, width, height, identity)),
            None if filter.needs_face() => {
                self.with_engine(|engine| engine.landmarks(&picture, width, height))
            }
            None => Err(FaceError::NoFace),
        };
        filters::apply(&mut picture, width, height, filter, intensity, found.as_ref().ok());
        // If a face was chosen but not found, report the error. Otherwise the photo is fine.
        if identity.is_some() {
            found?;
        }
        Ok(picture)
    }

    /// Swaps the face of a camera frame in place, then applies the filter. Returns false when
    /// the face is left as it is: no face chosen, no face in view, or the engine failed.
    pub fn process_frame(
        &self,
        rgb: &mut [u8],
        width: usize,
        height: usize,
        filter: Filter,
        intensity: u8,
    ) -> bool {
        let identity = self.identity.lock().unwrap().clone();
        // The swap has already found the face: an accessory reuses its landmarks.
        let found = match &identity {
            Some(identity) => self.with_engine(|engine| engine.swap(rgb, width, height, identity)),
            None if filter.needs_face() => {
                self.with_engine(|engine| engine.landmarks(rgb, width, height))
            }
            None => Err(FaceError::NoFace),
        };
        filters::apply(rgb, width, height, filter, intensity, found.as_ref().ok());
        identity.is_some() && found.is_ok()
    }
}

/// Just enough of the ONNX file format (protocol buffers) to read one tensor out of a model.
mod onnx {
    const MODEL_GRAPH: u64 = 7;
    const GRAPH_INITIALIZER: u64 = 5;
    const TENSOR_DIMS: u64 = 1;
    const TENSOR_DATA_TYPE: u64 = 2;
    const TENSOR_FLOAT_DATA: u64 = 4;
    const TENSOR_RAW_DATA: u64 = 9;
    const DATA_TYPE_FLOAT: u64 = 1;

    enum Field<'a> {
        Number(u64),
        Bytes(&'a [u8]),
    }

    fn varint(data: &[u8], at: &mut usize) -> Option<u64> {
        let mut value = 0u64;
        for shift in (0..64).step_by(7) {
            let byte = *data.get(*at)?;
            *at += 1;
            value |= u64::from(byte & 0x7f) << shift;
            if byte & 0x80 == 0 {
                return Some(value);
            }
        }
        None
    }

    /// Calls `visit` for each field of a message. Returns None on malformed data.
    fn fields<'a>(data: &'a [u8], mut visit: impl FnMut(u64, Field<'a>)) -> Option<()> {
        let mut at = 0;
        while at < data.len() {
            let key = varint(data, &mut at)?;
            match key & 7 {
                0 => visit(key >> 3, Field::Number(varint(data, &mut at)?)),
                1 => at = at.checked_add(8)?,
                2 => {
                    let len = usize::try_from(varint(data, &mut at)?).ok()?;
                    let end = at.checked_add(len)?;
                    visit(key >> 3, Field::Bytes(data.get(at..end)?));
                    at = end;
                }
                5 => at = at.checked_add(4)?,
                _ => return None,
            }
        }
        Some(())
    }

    /// The last constant tensor of the model, if it is a float matrix of the given shape.
    pub fn last_initializer(model: &[u8], shape: [usize; 2]) -> Option<Vec<f32>> {
        let mut graph = None;
        fields(model, |number, field| {
            if let (MODEL_GRAPH, Field::Bytes(bytes)) = (number, field) {
                graph = Some(bytes);
            }
        })?;
        let mut tensor = None;
        fields(graph?, |number, field| {
            if let (GRAPH_INITIALIZER, Field::Bytes(bytes)) = (number, field) {
                tensor = Some(bytes);
            }
        })?;

        let (mut dims, mut data_type, mut raw) = (Vec::new(), 0, None);
        fields(tensor?, |number, field| match (number, field) {
            (TENSOR_DIMS, Field::Number(dim)) => dims.push(dim as usize),
            // Repeated numbers may also be packed into one byte string.
            (TENSOR_DIMS, Field::Bytes(packed)) => {
                let mut at = 0;
                while let Some(dim) = varint(packed, &mut at) {
                    dims.push(dim as usize);
                }
            }
            (TENSOR_DATA_TYPE, Field::Number(kind)) => data_type = kind,
            // Both hold little-endian floats: packed `float_data`, or `raw_data`.
            (TENSOR_FLOAT_DATA | TENSOR_RAW_DATA, Field::Bytes(bytes)) => raw = Some(bytes),
            _ => {}
        })?;
        let raw = raw?;
        if dims != shape || data_type != DATA_TYPE_FLOAT || raw.len() != shape[0] * shape[1] * 4 {
            return None;
        }
        Some(raw.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect())
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        /// Length-delimited field: key, length (below 128 here), payload.
        fn bytes_field(number: u8, payload: &[u8]) -> Vec<u8> {
            let mut out = vec![number << 3 | 2, payload.len() as u8];
            out.extend_from_slice(payload);
            out
        }

        #[test]
        fn reads_the_last_initializer_of_a_model() {
            let values = [1.0f32, 2.0, 3.0, 4.0, 5.0, 6.0];
            let raw: Vec<u8> = values.iter().flat_map(|v| v.to_le_bytes()).collect();
            let mut tensor = vec![1 << 3, 2, 1 << 3, 3, 2 << 3, 1];
            tensor.extend(bytes_field(9, &raw));
            let other = vec![1 << 3, 1, 2 << 3, 1];
            let mut graph = bytes_field(5, &other);
            graph.extend(bytes_field(5, &tensor));
            let model = bytes_field(7, &graph);

            assert_eq!(last_initializer(&model, [2, 3]).unwrap(), values);
            // The same tensor with its values in `float_data` instead of `raw_data`.
            let packed = model.iter().map(|&byte| if byte == 9 << 3 | 2 { 4 << 3 | 2 } else { byte });
            assert_eq!(last_initializer(&packed.collect::<Vec<_>>(), [2, 3]).unwrap(), values);
            assert!(last_initializer(&model, [3, 2]).is_none(), "the shape must match");
            assert!(last_initializer(&model[..model.len() - 1], [2, 3]).is_none());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn similarity_sends_landmarks_onto_the_template_and_back() {
        // The template, turned by 30°, doubled in size and moved.
        let (sin, cos) = 30f32.to_radians().sin_cos();
        let moved = ARCFACE_TEMPLATE
            .map(|[x, y]| [2.0 * (cos * x - sin * y) + 100.0, 2.0 * (sin * x + cos * y) + 40.0]);
        let fit = Similarity::fit(&moved, &ARCFACE_TEMPLATE);
        for (from, to) in moved.iter().zip(&ARCFACE_TEMPLATE) {
            let (x, y) = fit.apply(from[0], from[1]);
            assert!((x - to[0]).abs() < 1e-2 && (y - to[1]).abs() < 1e-2);
            let (bx, by) = fit.inverse().apply(x, y);
            assert!((bx - from[0]).abs() < 1e-2 && (by - from[1]).abs() < 1e-2);
        }
    }

    #[test]
    fn sampling_interpolates_and_is_black_outside() {
        let rgb = [0, 0, 0, 100, 100, 100];
        let frame = Frame { rgb: &rgb, width: 2, height: 1 };
        assert_eq!(frame.sample(0.5, 0.0), [50.0; 3]);
        assert_eq!(frame.sample(-3.0, 0.0), [0.0; 3]);
    }

    #[test]
    fn blend_keeps_the_centre_and_drops_the_border() {
        assert_eq!(blend_weight(0.0), 0.0);
        assert_eq!(blend_weight(64.0), 1.0);
        assert!(blend_weight(10.0) > 0.0 && blend_weight(10.0) < 1.0);
    }

    #[test]
    fn a_file_that_is_not_an_image_is_refused() {
        assert!(matches!(decode(b"not an image"), Err(FaceError::InvalidImage)));
    }
}
