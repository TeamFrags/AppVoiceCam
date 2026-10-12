//! Swaps a face between two photos from the command line, without the interface or a camera:
//!
//!     cargo run --example swap -- <models folder> <source face> <target photo> <result.jpg>
//!
//! Prints how long the engine takes to load and to process one picture.

use std::{env, fs, path::PathBuf, time::Instant};

use app_lib::{face::FaceSwap, filters::Filter};

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let [models, source, target, result] = args.as_slice() else {
        eprintln!("usage: swap <models folder> <source face> <target photo> <result.jpg>");
        std::process::exit(2);
    };
    let face = FaceSwap::new(PathBuf::from(models));

    let started = Instant::now();
    face.set_source(&fs::read(source).expect("cannot read the source face"))
        .expect("no usable face in the source picture");
    println!("engine loaded, source face read: {:?}", started.elapsed());

    let target = fs::read(target).expect("cannot read the target photo");
    let picture = face.swap_photo(&target, Filter::None, 100).expect("swap failed");
    picture.save(result).expect("cannot write the result");

    // The first run includes one-off setup on the graphics card: time the following ones.
    let (width, height) = (picture.width() as usize, picture.height() as usize);
    let mut frame = picture.into_raw();
    let started = Instant::now();
    const RUNS: u32 = 20;
    for _ in 0..RUNS {
        assert!(face.process_frame(&mut frame, width, height, Filter::None, 100));
    }
    println!("{width} × {height}: {:?} per frame", started.elapsed() / RUNS);
}
