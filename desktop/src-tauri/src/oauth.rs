//! Google and Discord sign-in through the system browser.
//!
//! The application never shows a provider's login page itself: it opens the user's own browser
//! and waits on a loopback port for the one-time code the server sends back.

use std::time::Duration;

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Notify,
};

use crate::{
    api::ApiClient,
    error::{AppError, AppResult},
};

const PROVIDERS: [&str; 2] = ["google", "discord"];
const TIMEOUT: Duration = Duration::from_secs(180);

const DONE_PAGE: &str = "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>Connexion</title>\
<body style=\"font-family:system-ui;background:#111;color:#eee;text-align:center;padding-top:20vh\">\
<h1>Connexion r\u{e9}ussie</h1><p>Tu peux fermer cet onglet et revenir dans l\u{2019}application.</p></body></html>";

/// A random verifier and the challenge derived from it. Only the challenge travels through
/// the browser; the verifier stays in this process until the final exchange.
pub fn pkce_pair() -> (String, String) {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

/// Extracts the `code` parameter from the first line of the browser's request, if that request
/// is the expected `GET /callback?...`.
pub fn code_from_request(request: &str) -> Option<String> {
    let target = request.lines().next()?.strip_prefix("GET ")?.split(' ').next()?;
    let url = reqwest::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/callback" {
        return None;
    }
    url.query_pairs().find(|(key, _)| key == "code").map(|(_, value)| value.into_owned())
}

async fn wait_for_code(listener: TcpListener) -> AppResult<String> {
    loop {
        let (mut socket, _) = listener.accept().await.map_err(|_| AppError::new("oauth_failed"))?;
        let mut buffer = vec![0u8; 4096];
        let read = socket.read(&mut buffer).await.unwrap_or(0);
        let code = code_from_request(&String::from_utf8_lossy(&buffer[..read]));

        // Browsers also ask for things like /favicon.ico: answer and keep waiting.
        let (status, body) = match code {
            Some(_) => ("200 OK", DONE_PAGE),
            None => ("404 Not Found", ""),
        };
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = socket.write_all(response.as_bytes()).await;
        let _ = socket.shutdown().await;
        if let Some(code) = code {
            return Ok(code);
        }
    }
}

/// Runs a whole provider sign-in. Resolves when the session is open, the user cancels, or
/// nothing came back within three minutes.
pub async fn sign_in(
    api: &ApiClient,
    provider: &str,
    device_name: &str,
    cancel: &Notify,
) -> AppResult<()> {
    if !PROVIDERS.contains(&provider) {
        return Err(AppError::new("unknown_provider"));
    }
    // Port 0: the system picks a free port, on the loopback interface only.
    let listener =
        TcpListener::bind("127.0.0.1:0").await.map_err(|_| AppError::new("oauth_failed"))?;
    let port = listener.local_addr().map_err(|_| AppError::new("oauth_failed"))?.port();
    let (verifier, challenge) = pkce_pair();

    let url = format!(
        "{}/v1/auth/oauth/{provider}/start?client=desktop&port={port}&challenge={challenge}",
        api.base_url()
    );
    open::that(url).map_err(|_| AppError::new("browser_unavailable"))?;

    let code = tokio::select! {
        code = wait_for_code(listener) => code?,
        _ = cancel.notified() => return Err(AppError::new("cancelled")),
        _ = tokio::time::sleep(TIMEOUT) => return Err(AppError::new("oauth_timeout")),
    };
    api.exchange_oauth_code(&code, &verifier, device_name).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn challenge_is_the_sha256_of_the_verifier() {
        let (verifier, challenge) = pkce_pair();
        assert_eq!(verifier.len(), 43);
        assert_eq!(challenge, URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes())));
        assert_ne!(pkce_pair().0, verifier);
    }

    #[test]
    fn reads_the_code_from_the_callback_request() {
        let request = "GET /callback?code=abc-DEF_123 HTTP/1.1\r\nHost: 127.0.0.1:5000\r\n\r\n";
        assert_eq!(code_from_request(request).as_deref(), Some("abc-DEF_123"));
    }

    #[tokio::test]
    async fn loopback_server_skips_stray_requests_and_returns_the_code() {
        use tokio::net::TcpStream;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let waiting = tokio::spawn(wait_for_code(listener));

        let request = |line: &'static str| async move {
            let mut socket = TcpStream::connect(address).await.unwrap();
            socket.write_all(line.as_bytes()).await.unwrap();
            let mut response = String::new();
            socket.read_to_string(&mut response).await.unwrap();
            response
        };
        assert!(request("GET /favicon.ico HTTP/1.1\r\n\r\n").await.starts_with("HTTP/1.1 404"));
        let done = request("GET /callback?code=one-time-code HTTP/1.1\r\n\r\n").await;
        assert!(done.starts_with("HTTP/1.1 200"));
        assert!(done.contains("Connexion r\u{e9}ussie"));

        assert_eq!(waiting.await.unwrap().unwrap(), "one-time-code");
    }

    #[test]
    fn ignores_other_requests() {
        assert_eq!(code_from_request("GET /favicon.ico HTTP/1.1\r\n\r\n"), None);
        assert_eq!(code_from_request("GET /other?code=abc HTTP/1.1\r\n\r\n"), None);
        assert_eq!(code_from_request("GET /callback?error=x HTTP/1.1\r\n\r\n"), None);
        assert_eq!(code_from_request("POST /callback?code=abc HTTP/1.1\r\n\r\n"), None);
        assert_eq!(code_from_request(""), None);
    }
}
