//! A phone used as the camera.
//!
//! The application shows a QR code. It leads the phone's browser to a page served by this PC,
//! on the local network, with a one-time code. The phone asks its owner for the camera, then
//! asks this PC to be let in: nothing is accepted until the user allows it here. Its pictures
//! then go through the same face pipeline as a webcam's.
//!
//! The page is served over HTTPS because browsers only open the camera on a secure page. The
//! certificate is made here and signed by nobody, so the phone warns before showing the page:
//! the link is hidden from the rest of the network, but the phone cannot prove it reached this
//! PC. The one-time code and the approval are what decide who gets in.

use std::{
    convert::Infallible,
    io::Cursor,
    net::{IpAddr, SocketAddr, UdpSocket},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc, Condvar, Mutex,
    },
    time::{Duration, Instant},
};

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use http_body_util::{BodyExt, Full, Limited};
use hyper::{
    body::{Bytes, Incoming},
    header,
    server::conn::http1,
    service::service_fn,
    Method, Request, Response, StatusCode,
};
use hyper_util::rt::{TokioIo, TokioTimer};
use qrcode::{render::svg, QrCode};
use rand::RngCore;
use serde::Serialize;
use tokio::{net::TcpListener, sync::watch};
use tokio_rustls::{
    rustls::{
        self,
        pki_types::{PrivateKeyDer, PrivatePkcs8KeyDer},
    },
    TlsAcceptor,
};

use crate::error::{AppError, AppResult};

/// The camera id the interface uses for the linked phone, next to those of the webcams.
pub const CAMERA_ID: &str = "phone";

/// How long a QR code can be scanned and answered.
const CODE_LIFETIME: Duration = Duration::from_secs(120);
/// A linked phone that stays silent this long is gone: page closed, screen locked, out of reach.
const SILENCE: Duration = Duration::from_secs(30);
/// After this many wrong codes the QR code is withdrawn.
const MAX_WRONG_CODES: u8 = 5;
const CODE_MAX_BYTES: usize = 64;
const FRAME_MAX_BYTES: usize = 2 * 1024 * 1024;
/// A decoded picture larger than this is refused: a small file can describe a huge one.
const FRAME_MAX_SIDE: u32 = 4096;
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);
/// Once a link is over, open connections get this long to deliver their last answer.
const CLOSING_GRACE: Duration = Duration::from_secs(2);
const QR_SIZE: u32 = 256;

const PAGE: &str = include_str!("phone.html");
/// The page loads nothing from anywhere else, and talks to this PC only.
const PAGE_POLICY: &str = "default-src 'none'; style-src 'unsafe-inline'; \
script-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:";

/// What the user is told about a phone before letting it in.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PhoneInfo {
    /// "iPhone", "iPad" or "Android"; empty when the browser does not say.
    pub device: String,
    /// Its address on the local network.
    pub address: String,
}

/// What the interface shows to start a link.
#[derive(Serialize)]
pub struct Offer {
    /// The QR code, as an SVG picture.
    pub qr: String,
    /// How long it can be scanned.
    pub seconds: u64,
}

pub enum Event {
    /// A phone showed the right code and waits for the user's answer.
    Request(PhoneInfo),
    Linked(PhoneInfo),
    /// The link is over, whoever ended it; also sent when a code runs out unused.
    Ended,
}

pub type Notifier = Arc<dyn Fn(Event) + Send + Sync>;

#[derive(Clone)]
enum Stage {
    /// The QR code is on screen.
    Waiting,
    /// A phone showed the code: the user decides.
    Asking(PhoneInfo),
    /// `key` is what the phone must show with every picture.
    Linked { phone: PhoneInfo, key: String },
    Closed,
}

/// One QR code and the phone it lets in, from the moment it is shown until the link ends.
struct Link {
    code: String,
    stage: watch::Sender<Stage>,
    /// The latest picture from the phone, as a JPEG, until the capture thread takes it.
    frame: Mutex<Option<Vec<u8>>>,
    arrived: Condvar,
    /// Whether the camera is running on the PC: otherwise the phone sends no picture.
    wanted: AtomicBool,
    last_seen: Mutex<Instant>,
    wrong_codes: AtomicU8,
    page: String,
    notify: Notifier,
}

impl Link {
    fn close(&self) {
        if matches!(self.stage.send_replace(Stage::Closed), Stage::Closed) {
            return;
        }
        self.frame.lock().unwrap().take();
        self.arrived.notify_all();
        (self.notify)(Event::Ended);
    }

    fn linked(&self) -> Option<PhoneInfo> {
        match &*self.stage.borrow() {
            Stage::Linked { phone, .. } => Some(phone.clone()),
            _ => None,
        }
    }

    /// Ends a code nobody used in time, and a link whose phone went silent.
    fn expire(&self, opened: Instant) {
        let over = match &*self.stage.borrow() {
            Stage::Waiting | Stage::Asking(_) => opened.elapsed() > CODE_LIFETIME,
            Stage::Linked { .. } => self.last_seen.lock().unwrap().elapsed() > SILENCE,
            Stage::Closed => false,
        };
        if over {
            self.close();
        }
    }

    /// Whether a request carries the key given to the linked phone.
    fn holds_key(&self, request: &Request<Incoming>) -> bool {
        let shown = request
            .headers()
            .get(header::AUTHORIZATION)
            .and_then(|value| value.as_bytes().strip_prefix(b"Bearer "));
        match (&*self.stage.borrow(), shown) {
            (Stage::Linked { key, .. }, Some(shown)) => same(shown, key.as_bytes()),
            _ => false,
        }
    }
}

/// The phone linked as a camera, if any. One at a time.
#[derive(Default)]
pub struct Phone {
    link: Mutex<Option<Arc<Link>>>,
}

impl Phone {
    /// Starts waiting for a phone on the local network and returns the QR code that leads to
    /// it. A previous code or link is ended first.
    pub async fn open(&self, app_name: &str, notify: Notifier) -> AppResult<Offer> {
        let address = lan_address().ok_or_else(|| AppError::new("no_network"))?;
        Ok(self.open_on(address, app_name, notify).await?.0)
    }

    /// The same on a chosen address of this PC. Also returns the address the QR code holds,
    /// which the application itself never needs: tests and `examples/phone.rs` do.
    pub async fn open_on(
        &self,
        address: IpAddr,
        app_name: &str,
        notify: Notifier,
    ) -> AppResult<(Offer, String)> {
        self.close();
        let failed = || AppError::new("phone_failed");
        // Port 0: the system picks a free port. Only the address of the local network listens.
        let listener = TcpListener::bind((address, 0)).await.map_err(|_| failed())?;
        let port = listener.local_addr().map_err(|_| failed())?.port();
        let acceptor = tls_acceptor(address).ok_or_else(failed)?;

        let code = secret(16);
        let url = format!("https://{}/#{code}", SocketAddr::new(address, port));
        let qr = QrCode::new(url.as_bytes())
            .map_err(|_| failed())?
            .render::<svg::Color>()
            .min_dimensions(QR_SIZE, QR_SIZE)
            .build();

        let link = Arc::new(Link {
            code,
            stage: watch::Sender::new(Stage::Waiting),
            frame: Mutex::default(),
            arrived: Condvar::new(),
            wanted: AtomicBool::new(false),
            last_seen: Mutex::new(Instant::now()),
            wrong_codes: AtomicU8::new(0),
            page: PAGE
                .replace("%APP%", &escape_html(app_name))
                .replace("%THEME%", env!("APP_PHONE_THEME")),
            notify,
        });
        *self.link.lock().unwrap() = Some(link.clone());
        tokio::spawn(serve(listener, acceptor, link));
        Ok((Offer { qr, seconds: CODE_LIFETIME.as_secs() }, url))
    }

    fn current(&self) -> Option<Arc<Link>> {
        self.link.lock().unwrap().clone()
    }

    /// The user's answer to the phone that showed the code. A refusal ends the code as well.
    pub fn answer(&self, allow: bool) {
        let Some(link) = self.current() else { return };
        if !allow {
            return link.close();
        }
        // Set first: the silence of the phone is counted from now, not from the QR code.
        *link.last_seen.lock().unwrap() = Instant::now();
        let mut linked = None;
        link.stage.send_if_modified(|stage| {
            let Stage::Asking(phone) = stage else { return false };
            let phone = phone.clone();
            linked = Some(phone.clone());
            *stage = Stage::Linked { phone, key: secret(32) };
            true
        });
        if let Some(phone) = linked {
            (link.notify)(Event::Linked(phone));
        }
    }

    /// Ends the link, or withdraws the QR code. The phone is told at its next message.
    pub fn close(&self) {
        if let Some(link) = self.link.lock().unwrap().take() {
            link.close();
        }
    }

    pub fn linked(&self) -> Option<PhoneInfo> {
        self.current()?.linked()
    }

    /// The pictures of the linked phone, which starts sending them. `None` without a phone.
    pub fn camera(&self) -> Option<PhoneCamera> {
        let link = self.current()?;
        link.linked()?;
        link.wanted.store(true, Ordering::SeqCst);
        Some(PhoneCamera(link))
    }
}

/// The linked phone, seen as a camera by the capture thread. Dropping it tells the phone to
/// stop sending pictures; the link itself stays.
pub struct PhoneCamera(Arc<Link>);

/// The phone is no longer linked.
#[derive(Debug, PartialEq)]
pub struct Unlinked;

impl PhoneCamera {
    /// The next picture as packed RGB with its width and height, or `None` if none came
    /// within `wait`. A picture that cannot be read is skipped the same way.
    pub fn frame(&self, wait: Duration) -> Result<Option<(Vec<u8>, u32, u32)>, Unlinked> {
        if self.0.linked().is_none() {
            return Err(Unlinked);
        }
        let waiting = self.0.frame.lock().unwrap();
        let (mut slot, _) =
            self.0.arrived.wait_timeout_while(waiting, wait, |frame| frame.is_none()).unwrap();
        let jpeg = slot.take();
        drop(slot);
        Ok(jpeg.and_then(|jpeg| decode(&jpeg)))
    }
}

impl Drop for PhoneCamera {
    fn drop(&mut self) {
        self.0.wanted.store(false, Ordering::SeqCst);
        self.0.frame.lock().unwrap().take();
    }
}

fn decode(jpeg: &[u8]) -> Option<(Vec<u8>, u32, u32)> {
    let mut reader = image::ImageReader::with_format(Cursor::new(jpeg), image::ImageFormat::Jpeg);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(FRAME_MAX_SIDE);
    limits.max_image_height = Some(FRAME_MAX_SIDE);
    reader.limits(limits);
    let picture = reader.decode().ok()?.into_rgb8();
    let (width, height) = picture.dimensions();
    Some((picture.into_raw(), width, height))
}

/// Random bytes as text that fits in an address.
fn secret(bytes: usize) -> String {
    let mut random = vec![0u8; bytes];
    rand::thread_rng().fill_bytes(&mut random);
    URL_SAFE_NO_PAD.encode(random)
}

/// Compares two secrets without stopping at the first difference, so the time taken says
/// nothing about how much of a guess was right.
fn same(shown: &[u8], expected: &[u8]) -> bool {
    shown.len() == expected.len()
        && shown.iter().zip(expected).fold(0, |differences, (a, b)| differences | (a ^ b)) == 0
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// The kind of phone, from what its browser says about itself. Only these fixed names ever
/// reach the interface.
fn device_label(user_agent: &str) -> &'static str {
    ["iPhone", "iPad", "Android"].into_iter().find(|name| user_agent.contains(name)).unwrap_or("")
}

/// The address of this PC on the local network: the one it would use to reach the internet.
/// Connecting a UDP socket sends nothing; it only makes the system choose a route.
fn lan_address() -> Option<IpAddr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("192.0.2.1:9").ok()?;
    let address = socket.local_addr().ok()?.ip();
    (!address.is_loopback() && !address.is_unspecified()).then_some(address)
}

/// A certificate for this address, made on the spot and signed by nobody: see the top of the
/// file. Its key never leaves the memory of this process.
fn tls_acceptor(address: IpAddr) -> Option<TlsAcceptor> {
    let rcgen::CertifiedKey { cert, key_pair } =
        rcgen::generate_simple_self_signed(vec![address.to_string()]).ok()?;
    let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key_pair.serialize_der()));
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ServerConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .ok()?
        .with_no_client_auth()
        .with_single_cert(vec![cert.der().clone()], key)
        .ok()?;
    Some(TlsAcceptor::from(Arc::new(config)))
}

async fn closed(stage: &mut watch::Receiver<Stage>) {
    let _ = stage.wait_for(|stage| matches!(stage, Stage::Closed)).await;
}

/// Answers the phone until the link is closed. The port is released at that moment.
async fn serve(listener: TcpListener, acceptor: TlsAcceptor, link: Arc<Link>) {
    let opened = Instant::now();
    let mut stage = link.stage.subscribe();
    let mut tick = tokio::time::interval(Duration::from_secs(1));
    loop {
        tokio::select! {
            _ = closed(&mut stage) => return,
            _ = tick.tick() => link.expire(opened),
            accepted = listener.accept() => {
                let Ok((socket, peer)) = accepted else { continue };
                tokio::spawn(connection(socket, peer.ip(), acceptor.clone(), link.clone()));
            }
        }
    }
}

async fn connection(
    socket: tokio::net::TcpStream,
    peer: IpAddr,
    acceptor: TlsAcceptor,
    link: Arc<Link>,
) {
    let mut stage = link.stage.subscribe();
    let exchange = async {
        let Ok(Ok(stream)) =
            tokio::time::timeout(HANDSHAKE_TIMEOUT, acceptor.accept(socket)).await
        else {
            return;
        };
        let service = service_fn(|request: Request<Incoming>| {
            let link = link.clone();
            async move { Ok::<_, Infallible>(respond(&link, peer, request).await) }
        });
        let _ = http1::Builder::new()
            .timer(TokioTimer::new())
            .header_read_timeout(HANDSHAKE_TIMEOUT)
            .serve_connection(TokioIo::new(stream), service)
            .await;
    };
    tokio::select! {
        _ = exchange => {}
        _ = async {
            closed(&mut stage).await;
            tokio::time::sleep(CLOSING_GRACE).await;
        } => {}
    }
}

type Answer = Response<Full<Bytes>>;

fn answer(status: StatusCode, body: impl Into<Bytes>) -> Answer {
    let mut response = Response::new(Full::new(body.into()));
    *response.status_mut() = status;
    let headers = response.headers_mut();
    headers.insert(header::CACHE_CONTROL, header::HeaderValue::from_static("no-store"));
    headers.insert(header::CONTENT_TYPE, header::HeaderValue::from_static("text/plain"));
    response
}

async fn body(request: Request<Incoming>, limit: usize) -> Option<Bytes> {
    Some(Limited::new(request.into_body(), limit).collect().await.ok()?.to_bytes())
}

async fn respond(link: &Link, peer: IpAddr, request: Request<Incoming>) -> Answer {
    let post = request.method() == Method::POST;
    let path = request.uri().path().to_owned();
    match path.as_str() {
        "/" if request.method() == Method::GET => page(link),
        "/pair" if post => pair(link, peer, request).await,
        "/frame" if post => frame(link, request).await,
        // The phone hung up.
        "/bye" if post => {
            if link.holds_key(&request) {
                link.close();
            }
            answer(StatusCode::NO_CONTENT, "")
        }
        _ => answer(StatusCode::NOT_FOUND, ""),
    }
}

fn page(link: &Link) -> Answer {
    let mut response = answer(StatusCode::OK, link.page.clone());
    let headers = response.headers_mut();
    let fixed = header::HeaderValue::from_static;
    headers.insert(header::CONTENT_TYPE, fixed("text/html; charset=utf-8"));
    headers.insert(header::CONTENT_SECURITY_POLICY, fixed(PAGE_POLICY));
    headers.insert(header::REFERRER_POLICY, fixed("no-referrer"));
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, fixed("nosniff"));
    response
}

/// The phone shows the code of the QR and waits for the user's answer: 200 with its key once
/// allowed, 403 when refused or left unanswered. A code is good for one phone, once.
async fn pair(link: &Link, peer: IpAddr, request: Request<Incoming>) -> Answer {
    let agent = request.headers().get(header::USER_AGENT).and_then(|value| value.to_str().ok());
    let phone = PhoneInfo {
        device: device_label(agent.unwrap_or_default()).to_string(),
        address: peer.to_string(),
    };
    let Some(shown) = body(request, CODE_MAX_BYTES).await else {
        return answer(StatusCode::BAD_REQUEST, "");
    };
    if !same(&shown, link.code.as_bytes()) {
        if link.wrong_codes.fetch_add(1, Ordering::SeqCst) + 1 >= MAX_WRONG_CODES {
            link.close();
        }
        return answer(StatusCode::UNAUTHORIZED, "");
    }
    let taken = link.stage.send_if_modified(|stage| {
        let free = matches!(stage, Stage::Waiting);
        if free {
            *stage = Stage::Asking(phone.clone());
        }
        free
    });
    if !taken {
        return answer(StatusCode::GONE, "");
    }
    (link.notify)(Event::Request(phone));

    let mut stage = link.stage.subscribe();
    let key = match stage.wait_for(|stage| !matches!(stage, Stage::Asking(_))).await {
        Ok(stage) => match &*stage {
            Stage::Linked { key, .. } => Some(key.clone()),
            _ => None,
        },
        Err(_) => None,
    };
    match key {
        Some(key) => answer(StatusCode::OK, key),
        None => answer(StatusCode::FORBIDDEN, ""),
    }
}

/// A picture from the linked phone, or an empty message that only says it is still there.
/// The answer tells it whether the PC wants pictures right now: "1" or "0".
async fn frame(link: &Link, request: Request<Incoming>) -> Answer {
    if !link.holds_key(&request) {
        return answer(StatusCode::UNAUTHORIZED, "");
    }
    let Some(jpeg) = body(request, FRAME_MAX_BYTES).await else {
        return answer(StatusCode::PAYLOAD_TOO_LARGE, "");
    };
    *link.last_seen.lock().unwrap() = Instant::now();
    let wanted = link.wanted.load(Ordering::SeqCst);
    if wanted && !jpeg.is_empty() {
        // Only the latest picture is kept: one the capture thread had no time for is dropped.
        *link.frame.lock().unwrap() = Some(jpeg.to_vec());
        link.arrived.notify_one();
    }
    answer(StatusCode::OK, if wanted { "1" } else { "0" })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn secrets_are_compared_whole() {
        assert!(same(b"abc", b"abc"));
        assert!(!same(b"abc", b"abd"));
        assert!(!same(b"ab", b"abc"));
        assert!(!same(b"", b"abc"));
    }

    #[test]
    fn a_secret_fits_in_an_address_and_is_never_the_same() {
        let code = secret(16);
        assert_eq!(code.len(), 22);
        assert!(code.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
        assert_ne!(secret(16), code);
    }

    #[test]
    fn names_the_kind_of_phone_and_nothing_else() {
        let iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1";
        let android = "Mozilla/5.0 (Linux; Android 10; K) Chrome/130.0.0.0 Mobile Safari/537.36";
        assert_eq!(device_label(iphone), "iPhone");
        assert_eq!(device_label(android), "Android");
        assert_eq!(device_label("<script>alert(1)</script>"), "");
    }

    #[test]
    fn the_page_is_filled_in_and_names_are_escaped() {
        assert!(PAGE.contains("%APP%") && PAGE.contains("%THEME%"));
        assert_eq!(escape_html("A&B \"<x>\""), "A&amp;B &quot;&lt;x&gt;&quot;");
        assert!(env!("APP_PHONE_THEME").contains("--ink-raised:#"));
    }

    #[test]
    fn a_picture_too_large_or_unreadable_is_skipped() {
        let encode = |width, height| {
            let mut jpeg = Cursor::new(Vec::new());
            image::RgbImage::new(width, height)
                .write_to(&mut jpeg, image::ImageFormat::Jpeg)
                .unwrap();
            jpeg.into_inner()
        };
        let (rgb, width, height) = decode(&encode(8, 4)).unwrap();
        assert_eq!((rgb.len(), width, height), (8 * 4 * 3, 8, 4));
        assert!(decode(&encode(FRAME_MAX_SIDE + 1, 1)).is_none());
        assert!(decode(b"not a picture").is_none());
    }

    /// The whole path a phone takes, against the real server on the loopback address.
    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_phone_gets_in_only_with_the_code_and_the_users_consent() {
        let (events, mut seen) = tokio::sync::mpsc::unbounded_channel();
        let notify: Notifier = Arc::new(move |event| {
            let _ = events.send(match event {
                Event::Request(phone) => format!("request {}", phone.device),
                Event::Linked(phone) => format!("linked {}", phone.device),
                Event::Ended => "ended".to_string(),
            });
        });
        let phone = Phone::default();
        let local = IpAddr::V4(Ipv4Addr::LOCALHOST);
        let (offer, url) = phone.open_on(local, "A&B", notify).await.unwrap();
        assert!(offer.qr.contains("<svg"));
        let (origin, code) = url.split_once("/#").unwrap();
        // The certificate is signed by nobody: the test accepts it as the phone's owner does.
        let browser = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .user_agent("Mozilla/5.0 (Linux; Android 10; K)")
            .build()
            .unwrap();
        let post = |path: &str, key: &str, body: Vec<u8>| {
            browser.post(format!("{origin}{path}")).bearer_auth(key).body(body).send()
        };

        let page = browser.get(format!("{origin}/")).send().await.unwrap();
        assert!(page.headers()["content-security-policy"].to_str().unwrap().contains("'none'"));
        let page = page.text().await.unwrap();
        assert!(page.contains("data-app=\"A&amp;B\"") && !page.contains("%THEME%"));
        assert!(!page.contains(code), "the code is not written in the page");

        // Without the code, and before any link, nothing is accepted.
        assert_eq!(post("/pair", "", b"guess".to_vec()).await.unwrap().status(), 401);
        assert_eq!(post("/frame", "guess", vec![]).await.unwrap().status(), 401);
        assert!(phone.camera().is_none());

        let pairing = tokio::spawn(post("/pair", "", code.as_bytes().to_vec()));
        assert_eq!(seen.recv().await.unwrap(), "request Android");
        assert!(phone.linked().is_none(), "showing the code is not enough");
        // The code works once: a second phone that read the same QR is turned away.
        assert_eq!(post("/pair", "", code.as_bytes().to_vec()).await.unwrap().status(), 410);

        phone.answer(true);
        assert_eq!(seen.recv().await.unwrap(), "linked Android");
        let pairing = pairing.await.unwrap().unwrap();
        assert_eq!(pairing.status(), 200);
        let key = pairing.text().await.unwrap();
        assert_eq!(phone.linked().unwrap().address, "127.0.0.1");

        // The camera is stopped on the PC: the phone is told to send nothing.
        assert_eq!(post("/frame", &key, vec![]).await.unwrap().text().await.unwrap(), "0");
        let camera = phone.camera().unwrap();
        assert_eq!(camera.frame(Duration::from_millis(10)), Ok(None));
        let mut jpeg = Cursor::new(Vec::new());
        image::RgbImage::new(6, 4).write_to(&mut jpeg, image::ImageFormat::Jpeg).unwrap();
        let sent = post("/frame", &key, jpeg.into_inner()).await.unwrap();
        assert_eq!(sent.text().await.unwrap(), "1");
        let (rgb, width, height) = camera.frame(Duration::from_secs(5)).unwrap().unwrap();
        assert_eq!((rgb.len(), width, height), (6 * 4 * 3, 6, 4));
        assert_eq!(post("/frame", "wrong-key", vec![]).await.unwrap().status(), 401);
        drop(camera);
        assert_eq!(post("/frame", &key, vec![]).await.unwrap().text().await.unwrap(), "0");

        phone.close();
        assert_eq!(seen.recv().await.unwrap(), "ended");
        assert!(phone.linked().is_none());
        // Its key is worth nothing once the link is over, whether the answer still comes
        // through the open connection or the port is already closed.
        let after = post("/frame", &key, vec![]).await;
        assert!(after.map(|answer| answer.status() == 401).unwrap_or(true));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn a_refusal_ends_the_code_and_wrong_codes_withdraw_it() {
        let quiet: Notifier = Arc::new(|_| {});
        let phone = Phone::default();
        let local = IpAddr::V4(Ipv4Addr::LOCALHOST);
        let browser =
            reqwest::Client::builder().danger_accept_invalid_certs(true).build().unwrap();

        let (_, url) = phone.open_on(local, "App", quiet.clone()).await.unwrap();
        let (origin, code) = url.split_once("/#").unwrap();
        let pairing = tokio::spawn(browser.post(format!("{origin}/pair")).body(code.to_string()).send());
        let link = phone.current().unwrap();
        let mut stage = link.stage.subscribe();
        stage.wait_for(|stage| matches!(stage, Stage::Asking(_))).await.unwrap();
        phone.answer(false);
        assert_eq!(pairing.await.unwrap().unwrap().status(), 403);
        assert!(phone.linked().is_none());

        let (_, url) = phone.open_on(local, "App", quiet).await.unwrap();
        let (origin, code) = url.split_once("/#").unwrap();
        for _ in 0..MAX_WRONG_CODES {
            let wrong = browser.post(format!("{origin}/pair")).body("guess").send().await;
            assert_eq!(wrong.unwrap().status(), 401);
        }
        let late = browser.post(format!("{origin}/pair")).body(code.to_string()).send().await;
        assert!(late.map(|answer| answer.status() != 200).unwrap_or(true));
    }
}
