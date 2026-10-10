//! Tries a phone as the camera without the application: prints the address the QR code would
//! hold, lets in the first phone that shows the code, and counts the pictures it sends.
//!
//!     cargo run --example phone                 on the local network: open the address on a phone
//!     cargo run --example phone -- 127.0.0.1    on this PC only: open it in a browser here
//!
//! There is no approval step here, unlike in the application: whoever opens the address first
//! gets in. Stop it with Ctrl+C.

use std::{
    net::{IpAddr, UdpSocket},
    sync::Arc,
    time::{Duration, Instant},
};

use app_lib::phone::{Event, Notifier, Phone};

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    let address: IpAddr = match std::env::args().nth(1) {
        Some(address) => address.parse().expect("not an address"),
        None => {
            let socket = UdpSocket::bind("0.0.0.0:0").unwrap();
            socket.connect("192.0.2.1:9").expect("this PC is not on a network");
            socket.local_addr().unwrap().ip()
        }
    };
    let phone = Arc::new(Phone::default());
    let (events, mut seen) = tokio::sync::mpsc::unbounded_channel();
    let notify: Notifier = Arc::new(move |event| {
        let _ = events.send(event);
    });
    let (_, url) = phone.open_on(address, "Example", notify).await.expect("cannot listen");
    println!("open {url}");

    while let Some(event) = seen.recv().await {
        match event {
            Event::Request(from) => {
                println!("request from {} {}: allowed", from.device, from.address);
                phone.answer(true);
            }
            Event::Linked(_) => {
                let camera = phone.camera().expect("just linked");
                std::thread::spawn(move || {
                    let (mut pictures, mut since) = (0, Instant::now());
                    while let Ok(frame) = camera.frame(Duration::from_millis(250)) {
                        let Some((_, width, height)) = frame else { continue };
                        pictures += 1;
                        if since.elapsed() >= Duration::from_secs(1) {
                            println!("{pictures} pictures/s, {width} x {height}");
                            (pictures, since) = (0, Instant::now());
                        }
                    }
                });
            }
            Event::Ended => {
                println!("ended");
                return;
            }
        }
    }
}
