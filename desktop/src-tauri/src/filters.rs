//! Camera filters: accessories drawn on the face, and colour looks for the whole picture.
//!
//! An accessory is a handful of flat shapes described once, in the 112 × 112 aligned face the
//! models already use (see `ARCFACE_TEMPLATE`). The five landmarks of the detector give the
//! transform from the camera frame to that space, so the shapes follow the head as it moves,
//! turns and comes closer. No picture file is needed.

use serde::Deserialize;

use crate::face::{Similarity, ARCFACE_TEMPLATE};

/// Width of the aligned face: mirroring a shape sends `x` to `FACE_WIDTH − x`.
const FACE_WIDTH: f32 = 112.0;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Filter {
    #[default]
    None,
    Glasses,
    Cat,
    Dog,
    Mono,
    Sepia,
    Blurface,
    Stars,
    Crown,
    Clown,
    Mustache,
    Devil,
    Angel,
    Hearts,
    Ninja,
    Fox,
}

impl Filter {
    pub fn from_code(code: u8) -> Self {
        [
            Self::Glasses,
            Self::Cat,
            Self::Dog,
            Self::Mono,
            Self::Sepia,
            Self::Blurface,
            Self::Stars,
            Self::Crown,
            Self::Clown,
            Self::Mustache,
            Self::Devil,
            Self::Angel,
            Self::Hearts,
            Self::Ninja,
            Self::Fox,
        ]
        .into_iter()
        .find(|filter| *filter as u8 == code)
        .unwrap_or_default()
    }

    /// Whether the filter is drawn on the face, and so needs the detector.
    pub fn needs_face(self) -> bool {
        !matches!(self, Self::None | Self::Mono | Self::Sepia)
    }
}

type Point = [f32; 2];

#[derive(Clone, Copy)]
enum Shape {
    /// `turn` is in radians, clockwise on screen.
    Ellipse { centre: Point, radius: Point, turn: f32 },
    Triangle([Point; 3]),
    Line { from: Point, to: Point, width: f32 },
}

impl Shape {
    /// Distance from a point to the edge of the shape, negative inside.
    fn distance(&self, [x, y]: Point) -> f32 {
        match *self {
            Shape::Ellipse { centre, radius, turn } => {
                let (sin, cos) = turn.sin_cos();
                let (dx, dy) = (x - centre[0], y - centre[1]);
                let (px, py) = (cos * dx + sin * dy, cos * dy - sin * dx);
                let inner = (px / radius[0]).hypot(py / radius[1]);
                let slope = (px / (radius[0] * radius[0])).hypot(py / (radius[1] * radius[1]));
                if slope <= f32::EPSILON {
                    return -radius[0].min(radius[1]);
                }
                inner * (inner - 1.0) / slope
            }
            Shape::Triangle(corners) => {
                let mut nearest = f32::MAX;
                let mut inside = [false; 2];
                for index in 0..3 {
                    let (from, to) = (corners[index], corners[(index + 1) % 3]);
                    nearest = nearest.min(segment_distance([x, y], from, to));
                    let side = (to[0] - from[0]) * (y - from[1]) - (to[1] - from[1]) * (x - from[0]);
                    inside[usize::from(side > 0.0)] = true;
                }
                // Inside, the point is on the same side of all three edges.
                if inside[0] != inside[1] { -nearest } else { nearest }
            }
            Shape::Line { from, to, width } => segment_distance([x, y], from, to) - width / 2.0,
        }
    }

    /// Box that contains the shape: left, top, right, bottom.
    fn bounds(&self) -> [f32; 4] {
        match *self {
            Shape::Ellipse { centre, radius, .. } => {
                let reach = radius[0].max(radius[1]);
                [centre[0] - reach, centre[1] - reach, centre[0] + reach, centre[1] + reach]
            }
            Shape::Triangle(corners) => around(&corners, 0.0),
            Shape::Line { from, to, width } => around(&[from, to], width / 2.0),
        }
    }

    fn mirrored(self) -> Self {
        let flip = |[x, y]: Point| [FACE_WIDTH - x, y];
        match self {
            Shape::Ellipse { centre, radius, turn } => {
                Shape::Ellipse { centre: flip(centre), radius, turn: -turn }
            }
            Shape::Triangle(corners) => Shape::Triangle(corners.map(flip)),
            Shape::Line { from, to, width } => Shape::Line { from: flip(from), to: flip(to), width },
        }
    }
}

fn around(points: &[Point], margin: f32) -> [f32; 4] {
    let fold = |axis: usize, pick: fn(f32, f32) -> f32, start: f32| {
        points.iter().map(|point| point[axis]).fold(start, pick)
    };
    [
        fold(0, f32::min, f32::MAX) - margin,
        fold(1, f32::min, f32::MAX) - margin,
        fold(0, f32::max, f32::MIN) + margin,
        fold(1, f32::max, f32::MIN) + margin,
    ]
}

fn segment_distance([x, y]: Point, from: Point, to: Point) -> f32 {
    let (dx, dy) = (to[0] - from[0], to[1] - from[1]);
    let along = ((x - from[0]) * dx + (y - from[1]) * dy) / (dx * dx + dy * dy).max(f32::EPSILON);
    let along = along.clamp(0.0, 1.0);
    (x - from[0] - along * dx).hypot(y - from[1] - along * dy)
}

struct Layer {
    shape: Shape,
    colour: [u8; 3],
    opacity: f32,
}

/// A shape and its mirror image, for everything a face has two of.
fn pair(shape: Shape, colour: [u8; 3], opacity: f32) -> [Layer; 2] {
    [Layer { shape, colour, opacity }, Layer { shape: shape.mirrored(), colour, opacity }]
}

fn round(centre: Point, radius: Point) -> Shape {
    Shape::Ellipse { centre, radius, turn: 0.0 }
}

/// The shapes of an accessory, from back to front.
fn layers(filter: Filter) -> Vec<Layer> {
    const FRAME: [u8; 3] = [24, 24, 30];
    const FUR: [u8; 3] = [46, 40, 46];
    const PINK: [u8; 3] = [255, 142, 172];
    const WHITE: [u8; 3] = [255, 255, 255];
    let [left_eye, _, nose, ..] = ARCFACE_TEMPLATE;
    let mut out = Vec::new();
    match filter {
        Filter::Glasses => {
            let lens = [left_eye[0], left_eye[1] + 1.5];
            out.extend(pair(Shape::Line { from: [23.0, 50.0], to: [3.0, 45.0], width: 2.4 }, FRAME, 1.0));
            out.push(Layer {
                shape: Shape::Line { from: [50.0, 50.0], to: [62.0, 50.0], width: 2.4 },
                colour: FRAME,
                opacity: 1.0,
            });
            out.extend(pair(round(lens, [16.5, 13.0]), FRAME, 1.0));
            out.extend(pair(round(lens, [14.5, 11.0]), [10, 12, 22], 0.94));
            // Each lens catches the light on the same side, so the glints are not mirrored.
            for shift in [0.0, FACE_WIDTH - 2.0 * lens[0]] {
                out.push(Layer {
                    shape: Shape::Line {
                        from: [lens[0] - 8.0 + shift, lens[1] - 3.0],
                        to: [lens[0] - 2.0 + shift, lens[1] - 7.0],
                        width: 1.8,
                    },
                    colour: WHITE,
                    opacity: 0.4,
                });
            }
        }
        Filter::Cat => {
            let ear = [[10.0, 12.0], [21.0, -30.0], [47.0, -3.0]];
            let inner = [[18.0, 6.0], [23.5, -18.0], [39.0, -2.0]];
            out.extend(pair(Shape::Triangle(ear), FUR, 1.0));
            out.extend(pair(Shape::Triangle(inner), PINK, 1.0));
            for tip in [[8.0, 67.0], [5.0, 78.0], [8.0, 89.0]] {
                let from = [41.0, 76.0 + (tip[1] - 78.0) * 0.25];
                out.extend(pair(Shape::Line { from, to: tip, width: 1.0 }, [28, 26, 30], 0.85));
            }
            out.push(Layer { shape: round([nose[0], nose[1] - 0.5], [5.5, 3.8]), colour: PINK, opacity: 1.0 });
        }
        Filter::Dog => {
            let ear = Shape::Ellipse { centre: [9.0, 22.0], radius: [11.0, 25.0], turn: 0.3 };
            let inner = Shape::Ellipse { centre: [10.0, 25.0], radius: [6.0, 18.0], turn: 0.3 };
            out.extend(pair(ear, [118, 76, 46], 1.0));
            out.extend(pair(inner, [150, 102, 68], 1.0));
            out.push(Layer { shape: round([nose[0], 104.0], [7.5, 11.5]), colour: [240, 104, 134], opacity: 1.0 });
            out.push(Layer {
                shape: Shape::Line { from: [nose[0], 97.0], to: [nose[0], 110.0], width: 1.0 },
                colour: [198, 70, 102],
                opacity: 1.0,
            });
            out.push(Layer { shape: round([nose[0], nose[1] - 1.0], [10.5, 7.5]), colour: [30, 24, 26], opacity: 1.0 });
            out.push(Layer { shape: round([nose[0] - 3.5, nose[1] - 4.0], [3.2, 1.6]), colour: WHITE, opacity: 0.45 });
        }
        Filter::Stars => {
            for (cx, cy) in [(30.0, -15.0), (56.0, -30.0), (82.0, -15.0)] {
                let t1 = Shape::Triangle([[cx - 8.0, cy + 4.0], [cx + 8.0, cy + 4.0], [cx, cy - 10.0]]);
                let t2 = Shape::Triangle([[cx - 8.0, cy - 4.0], [cx + 8.0, cy - 4.0], [cx, cy + 10.0]]);
                out.push(Layer { shape: t1, colour: [255, 255, 50], opacity: 1.0 });
                out.push(Layer { shape: t2, colour: [255, 255, 50], opacity: 1.0 });
            }
        }
        Filter::Crown => {
            let base = Shape::Line { from: [20.0, -5.0], to: [92.0, -5.0], width: 12.0 };
            let point1 = Shape::Triangle([[20.0, 0.0], [44.0, 0.0], [15.0, -40.0]]);
            let point2 = Shape::Triangle([[44.0, 0.0], [68.0, 0.0], [56.0, -45.0]]);
            let point3 = Shape::Triangle([[68.0, 0.0], [92.0, 0.0], [97.0, -40.0]]);
            let colour = [255, 215, 0];
            out.push(Layer { shape: base, colour, opacity: 1.0 });
            out.push(Layer { shape: point1, colour, opacity: 1.0 });
            out.push(Layer { shape: point2, colour, opacity: 1.0 });
            out.push(Layer { shape: point3, colour, opacity: 1.0 });
            out.push(Layer { shape: round([15.0, -40.0], [5.0, 5.0]), colour: [255, 0, 0], opacity: 1.0 });
            out.push(Layer { shape: round([56.0, -45.0], [6.0, 6.0]), colour: [0, 255, 0], opacity: 1.0 });
            out.push(Layer { shape: round([97.0, -40.0], [5.0, 5.0]), colour: [0, 0, 255], opacity: 1.0 });
        }
        Filter::Clown => {
            out.push(Layer { shape: round([nose[0], nose[1]], [14.0, 14.0]), colour: [220, 20, 20], opacity: 1.0 });
            out.extend(pair(round([left_eye[0], left_eye[1]], [16.0, 16.0]), [20, 100, 220], 0.5));
            out.extend(pair(Shape::Triangle([[left_eye[0]-10.0, left_eye[1]-20.0], [left_eye[0]+10.0, left_eye[1]-20.0], [left_eye[0], left_eye[1]-40.0]]), [20, 100, 220], 0.8));
            out.push(Layer { shape: Shape::Line { from: [30.0, 95.0], to: [82.0, 95.0], width: 8.0 }, colour: [220, 20, 20], opacity: 0.9 });
        }
        Filter::Mustache => {
            let stache = Shape::Ellipse { centre: [38.0, 83.0], radius: [20.0, 6.0], turn: -0.15 };
            out.extend(pair(stache, [40, 20, 10], 1.0));
        }
        Filter::Devil => {
            let horn = Shape::Triangle([[35.0, 10.0], [45.0, 0.0], [20.0, -35.0]]);
            out.extend(pair(horn, [220, 30, 30], 1.0));
        }
        Filter::Angel => {
            let halo = Shape::Ellipse { centre: [56.0, -30.0], radius: [40.0, 10.0], turn: 0.0 };
            out.push(Layer { shape: halo, colour: [255, 230, 100], opacity: 0.6 });
        }
        Filter::Hearts => {
            let h1 = Shape::Ellipse { centre: [left_eye[0] - 5.0, left_eye[1] - 5.0], radius: [6.0, 6.0], turn: 0.0 };
            let h2 = Shape::Ellipse { centre: [left_eye[0] + 5.0, left_eye[1] - 5.0], radius: [6.0, 6.0], turn: 0.0 };
            let h3 = Shape::Triangle([
                [left_eye[0] - 11.0, left_eye[1] - 3.0], 
                [left_eye[0] + 11.0, left_eye[1] - 3.0], 
                [left_eye[0], left_eye[1] + 12.0]
            ]);
            out.extend(pair(h1, [255, 40, 80], 1.0));
            out.extend(pair(h2, [255, 40, 80], 1.0));
            out.extend(pair(h3, [255, 40, 80], 1.0));
        }
        Filter::Ninja => {
            let band = Shape::Line { from: [10.0, 30.0], to: [102.0, 30.0], width: 28.0 };
            out.push(Layer { shape: band, colour: [20, 20, 20], opacity: 0.95 });
        }
        Filter::Fox => {
            let ear = Shape::Triangle([[15.0, 20.0], [35.0, 0.0], [10.0, -30.0]]);
            let inner = Shape::Triangle([[19.0, 15.0], [31.0, 2.0], [14.0, -20.0]]);
            out.extend(pair(ear, [220, 100, 30], 1.0));
            out.extend(pair(inner, WHITE, 1.0));
            out.push(Layer { shape: round([nose[0], nose[1]], [8.0, 5.0]), colour: [20, 20, 20], opacity: 1.0 });
            out.extend(pair(Shape::Line { from: [10.0, 70.0], to: [35.0, 75.0], width: 1.5 }, [20, 20, 20], 0.8));
            out.extend(pair(Shape::Line { from: [5.0, 80.0], to: [35.0, 80.0], width: 1.5 }, [20, 20, 20], 0.8));
        }
        Filter::Blurface | Filter::None | Filter::Mono | Filter::Sepia => {}
    }
    out
}

/// Draws the accessory of `filter` on the face whose landmarks are given, in place.
fn draw(rgb: &mut [u8], width: usize, height: usize, filter: Filter, landmarks: &[Point; 5]) {
    let to_face = Similarity::fit(landmarks, &ARCFACE_TEMPLATE);
    let to_frame = to_face.inverse();
    // Frame pixels per unit of the aligned face: one pixel of soft edge, whatever the distance.
    let zoom = to_frame.scale();

    for layer in layers(filter) {
        let [left, top, right, bottom] = layer.shape.bounds();
        let corners = [(left, top), (right, top), (left, bottom), (right, bottom)]
            .map(|(x, y)| to_frame.apply(x, y));
        let (xs, ys) = (corners.map(|corner| corner.0), corners.map(|corner| corner.1));
        let lowest = |values: [f32; 4]| values.into_iter().fold(f32::MAX, f32::min) - 1.0;
        let highest = |values: [f32; 4]| values.into_iter().fold(f32::MIN, f32::max) + 1.0;
        if highest(xs) < 0.0 || highest(ys) < 0.0 {
            continue;
        }
        let (x_from, y_from) = (lowest(xs).max(0.0) as usize, lowest(ys).max(0.0) as usize);
        let x_to = (highest(xs) as usize).min(width.saturating_sub(1));
        let y_to = (highest(ys) as usize).min(height.saturating_sub(1));

        for y in y_from..=y_to {
            for x in x_from..=x_to {
                let (u, v) = to_face.apply(x as f32, y as f32);
                let cover = (0.5 - layer.shape.distance([u, v]) * zoom).clamp(0.0, 1.0);
                if cover <= 0.0 {
                    continue;
                }
                let alpha = cover * layer.opacity;
                let at = (y * width + x) * 3;
                for (channel, colour) in layer.colour.iter().enumerate() {
                    let old = f32::from(rgb[at + channel]);
                    rgb[at + channel] = (old + (f32::from(*colour) - old) * alpha).round() as u8;
                }
            }
        }
    }
}

/// Recolours the whole picture.
fn grade(rgb: &mut [u8], filter: Filter) {
    // Weights in 256ths, one row per output channel.
    let weights: [[u32; 3]; 3] = match filter {
        Filter::Mono => [[77, 150, 29]; 3],
        Filter::Sepia => [[101, 197, 48], [89, 176, 43], [70, 137, 34]],
        _ => return,
    };
    for pixel in rgb.chunks_exact_mut(3) {
        let [r, g, b] = [pixel[0], pixel[1], pixel[2]].map(u32::from);
        for (value, row) in pixel.iter_mut().zip(weights) {
            *value = ((row[0] * r + row[1] * g + row[2] * b) >> 8).min(255) as u8;
        }
    }
}

fn blur_face(rgb: &mut [u8], width: usize, height: usize, landmarks: &[Point; 5], intensity: u8) {
    let to_face = Similarity::fit(landmarks, &ARCFACE_TEMPLATE);
    let to_frame = to_face.inverse();
    let zoom = to_frame.scale();
    
    let face_shape = Shape::Ellipse { centre: [56.0, 60.0], radius: [50.0, 65.0], turn: 0.0 };
    
    let [left, top, right, bottom] = face_shape.bounds();
    let corners = [(left, top), (right, top), (left, bottom), (right, bottom)]
        .map(|(x, y)| to_frame.apply(x, y));
    let (xs, ys) = (corners.map(|c| c.0), corners.map(|c| c.1));
    let lowest = |vals: [f32; 4]| vals.into_iter().fold(f32::MAX, f32::min) - 1.0;
    let highest = |vals: [f32; 4]| vals.into_iter().fold(f32::MIN, f32::max) + 1.0;
    
    if highest(xs) < 0.0 || highest(ys) < 0.0 { return; }
    let x_from = (lowest(xs).max(0.0) as usize).saturating_sub(5);
    let y_from = (lowest(ys).max(0.0) as usize).saturating_sub(5);
    let x_to = (highest(xs) as usize + 5).min(width.saturating_sub(1));
    let y_to = (highest(ys) as usize + 5).min(height.saturating_sub(1));
    
    let block_size = (zoom * intensity as f32 * 2.0).max(4.0) as usize;
    
    for y in (y_from..=y_to).step_by(block_size) {
        for x in (x_from..=x_to).step_by(block_size) {
            let cx = (x + block_size / 2) as f32;
            let cy = (y + block_size / 2) as f32;
            let (u, v) = to_face.apply(cx, cy);
            
            let cover = (0.5 - face_shape.distance([u, v]) * zoom).clamp(0.0, 1.0);
            if cover <= 0.0 { continue; }
            
            let mut r = 0u32; let mut g = 0u32; let mut b = 0u32;
            let mut count = 0;
            for by in y..y+block_size {
                if by >= height { continue; }
                for bx in x..x+block_size {
                    if bx >= width { continue; }
                    let idx = (by * width + bx) * 3;
                    r += rgb[idx] as u32;
                    g += rgb[idx+1] as u32;
                    b += rgb[idx+2] as u32;
                    count += 1;
                }
            }
            if count == 0 { continue; }
            let avg_r = (r / count) as u8;
            let avg_g = (g / count) as u8;
            let avg_b = (b / count) as u8;
            
            for by in y..y+block_size {
                if by >= height { continue; }
                for bx in x..x+block_size {
                    if bx >= width { continue; }
                    let (u, v) = to_face.apply(bx as f32, by as f32);
                    let cover = (0.5 - face_shape.distance([u, v]) * zoom).clamp(0.0, 1.0);
                    if cover <= 0.0 { continue; }
                    
                    let idx = (by * width + bx) * 3;
                    rgb[idx] = (rgb[idx] as f32 * (1.0 - cover) + avg_r as f32 * cover) as u8;
                    rgb[idx+1] = (rgb[idx+1] as f32 * (1.0 - cover) + avg_g as f32 * cover) as u8;
                    rgb[idx+2] = (rgb[idx+2] as f32 * (1.0 - cover) + avg_b as f32 * cover) as u8;
                }
            }
        }
    }
}

/// Applies a filter to a packed RGB frame, in place. Accessories need the landmarks of the
/// face; without them (nobody in view) the frame is left as it is.
pub fn apply(
    rgb: &mut [u8],
    width: usize,
    height: usize,
    filter: Filter,
    intensity: u8,
    landmarks: Option<&[Point; 5]>,
) {
    if rgb.len() != width * height * 3 {
        return;
    }
    match landmarks {
        Some(landmarks) if filter.needs_face() => {
            if filter == Filter::Blurface {
                blur_face(rgb, width, height, landmarks, intensity);
            } else {
                draw(rgb, width, height, filter, landmarks);
            }
        }
        _ => grade(rgb, filter),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIDE: usize = 240;

    /// The template, 1.5 times larger and moved: a face in the middle of a 240 × 240 frame.
    fn face() -> [Point; 5] {
        ARCFACE_TEMPLATE.map(|[x, y]| [x * 1.5 + 36.0, y * 1.5 + 50.0])
    }

    fn pixel(rgb: &[u8], [x, y]: Point) -> [u8; 3] {
        let at = ((y * 1.5 + 50.0) as usize * SIDE + (x * 1.5 + 36.0) as usize) * 3;
        [rgb[at], rgb[at + 1], rgb[at + 2]]
    }

    fn drawn(filter: Filter) -> Vec<u8> {
        let mut rgb = vec![200u8; SIDE * SIDE * 3];
        apply(&mut rgb, SIDE, SIDE, filter, Some(&face()));
        rgb
    }

    #[test]
    fn shapes_measure_distance_from_their_edge() {
        let circle = round([10.0, 10.0], [4.0, 4.0]);
        assert!((circle.distance([10.0, 10.0]) + 4.0).abs() < 1e-3);
        assert!((circle.distance([16.0, 10.0]) - 2.0).abs() < 1e-3);

        let triangle = Shape::Triangle([[0.0, 0.0], [10.0, 0.0], [0.0, 10.0]]);
        assert!((triangle.distance([2.0, 2.0]) + 2.0).abs() < 1e-3);
        assert!((triangle.distance([5.0, -3.0]) - 3.0).abs() < 1e-3);
        // The same triangle listed the other way round has the same inside.
        let reversed = Shape::Triangle([[0.0, 10.0], [10.0, 0.0], [0.0, 0.0]]);
        assert!(reversed.distance([2.0, 2.0]) < 0.0);

        let line = Shape::Line { from: [0.0, 0.0], to: [10.0, 0.0], width: 2.0 };
        assert!((line.distance([5.0, 3.0]) - 2.0).abs() < 1e-3);
        assert!((line.distance([13.0, 0.0]) - 2.0).abs() < 1e-3);
    }

    #[test]
    fn mirroring_moves_a_shape_to_the_other_side_of_the_face() {
        let ear = Shape::Ellipse { centre: [10.0, 20.0], radius: [5.0, 9.0], turn: 0.3 };
        let point = [13.0, 26.0];
        let mirror = [FACE_WIDTH - point[0], point[1]];
        assert!((ear.distance(point) - ear.mirrored().distance(mirror)).abs() < 1e-3);
    }

    #[test]
    fn glasses_cover_both_eyes_and_nothing_else() {
        let rgb = drawn(Filter::Glasses);
        let [left_eye, right_eye, nose, ..] = ARCFACE_TEMPLATE;
        for eye in [left_eye, right_eye] {
            assert!(pixel(&rgb, eye).iter().all(|value| *value < 40), "the lens is dark");
        }
        assert_eq!(pixel(&rgb, nose), [200; 3]);
        assert_eq!(rgb[..3], [200; 3], "the corner of the frame is untouched");
    }

    #[test]
    fn animal_filters_put_ears_above_the_face_and_a_nose_on_the_nose() {
        let nose = ARCFACE_TEMPLATE[2];
        let cat = drawn(Filter::Cat);
        assert_ne!(pixel(&cat, [25.0, -8.0]), [200; 3], "left ear");
        assert_ne!(pixel(&cat, [FACE_WIDTH - 25.0, -8.0]), [200; 3], "right ear");
        assert!(pixel(&cat, nose)[0] > 240, "pink nose");

        let dog = drawn(Filter::Dog);
        assert_ne!(pixel(&dog, [9.0, 22.0]), [200; 3], "left ear");
        assert!(pixel(&dog, nose).iter().all(|value| *value < 60), "dark nose");
        assert_ne!(pixel(&dog, [nose[0] + 4.0, 106.0]), [200; 3], "tongue");
    }

    #[test]
    fn an_accessory_needs_a_face_and_survives_one_that_leaves_the_frame() {
        let mut rgb = vec![200u8; SIDE * SIDE * 3];
        apply(&mut rgb, SIDE, SIDE, Filter::Cat, None);
        assert!(rgb.iter().all(|value| *value == 200));

        for shift in [-400.0, -60.0, 180.0, 900.0] {
            let moved = face().map(|[x, y]| [x + shift, y + shift]);
            apply(&mut rgb, SIDE, SIDE, Filter::Dog, Some(&moved));
        }
        // A frame whose size does not match its buffer is left alone rather than read past.
        apply(&mut rgb, SIDE, SIDE + 1, Filter::Glasses, Some(&face()));
    }

    #[test]
    fn colour_looks_recolour_every_pixel() {
        let mut mono = vec![255, 0, 0, 10, 200, 90];
        apply(&mut mono, 2, 1, Filter::Mono, None);
        assert_eq!(mono, [76, 76, 76, 130, 130, 130]);

        let mut sepia = vec![128u8; 3];
        apply(&mut sepia, 1, 1, Filter::Sepia, None);
        assert!(sepia[0] > sepia[1] && sepia[1] > sepia[2], "grey turns warm: {sepia:?}");

        let mut untouched = vec![1, 2, 3];
        apply(&mut untouched, 1, 1, Filter::None, None);
        assert_eq!(untouched, [1, 2, 3]);
    }

    #[test]
    fn unknown_filter_codes_mean_none() {
        assert_eq!(Filter::from_code(Filter::Dog as u8), Filter::Dog);
        assert_eq!(Filter::from_code(99), Filter::None);
        assert!(Filter::Cat.needs_face() && !Filter::Sepia.needs_face());
    }
}
