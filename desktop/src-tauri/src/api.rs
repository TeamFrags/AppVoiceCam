//! Client for the backend API and owner of the session.
//!
//! The refresh token is kept in the Windows Credential Manager and the access token in this
//! process's memory. Neither is ever handed to the web view, so interface code (the part of the
//! application that is easiest to read or tamper with) never sees a credential.

use std::time::{Duration, Instant};

use reqwest::Method;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

const KEYCHAIN_USER: &str = "refresh-token";
/// Renew a little early so a request never leaves with a token about to expire.
const EXPIRY_MARGIN: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Account {
    pub email: String,
    /// "free" or "premium", as decided by the server on every call.
    pub tier: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenPair {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

struct AccessToken {
    value: String,
    expires_at: Instant,
}

pub struct ApiClient {
    http: reqwest::Client,
    base_url: String,
    keychain_service: String,
    /// Also serialises refreshes: a refresh token is single-use, and replaying one makes the
    /// server revoke the whole session.
    access: Mutex<Option<AccessToken>>,
}

impl ApiClient {
    pub fn new(base_url: &str, keychain_service: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .user_agent(concat!("desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("HTTP client");
        Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            // One entry per server, so a development build never overwrites the real session.
            keychain_service: format!("{keychain_service}:{base_url}"),
            access: Mutex::new(None),
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn keychain(&self) -> AppResult<keyring::Entry> {
        keyring::Entry::new(&self.keychain_service, KEYCHAIN_USER)
            .map_err(|_| AppError::new("keychain_unavailable"))
    }

    fn stored_refresh_token(&self) -> Option<String> {
        self.keychain().ok()?.get_password().ok()
    }

    fn forget_refresh_token(&self) {
        if let Ok(entry) = self.keychain() {
            let _ = entry.delete_credential();
        }
    }

    async fn send<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
        bearer: Option<&str>,
    ) -> AppResult<T> {
        let mut request = self.http.request(method, format!("{}{path}", self.base_url));
        if let Some(body) = body {
            request = request.json(body);
        }
        if let Some(token) = bearer {
            request = request.bearer_auth(token);
        }
        let response = request.send().await?;
        let status = response.status();
        let text = response.text().await?;
        let value: Value = if text.is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&text).unwrap_or(Value::Null)
        };
        if !status.is_success() {
            return Err(AppError::from_api(status.as_u16(), value));
        }
        serde_json::from_value(value).map_err(|_| AppError::new("unexpected_response"))
    }

    /// Stores a fresh token pair. The refresh token is saved first: it has already replaced
    /// the previous one on the server, so losing it would lose the session.
    fn adopt(&self, pair: TokenPair, slot: &mut Option<AccessToken>) -> AppResult<()> {
        self.keychain()?
            .set_password(&pair.refresh_token)
            .map_err(|_| AppError::new("keychain_unavailable"))?;
        *slot = Some(AccessToken {
            value: pair.access_token,
            expires_at: Instant::now() + Duration::from_secs(pair.expires_in),
        });
        Ok(())
    }

    async fn refresh(&self, slot: &mut Option<AccessToken>) -> AppResult<()> {
        let Some(refresh_token) = self.stored_refresh_token() else {
            return Err(AppError::new("not_signed_in"));
        };
        let body = json!({ "refreshToken": refresh_token });
        match self.send::<TokenPair>(Method::POST, "/v1/auth/refresh", Some(&body), None).await {
            Ok(pair) => self.adopt(pair, slot),
            Err(err) => {
                // Only a definite refusal ends the session. A network failure must not: the
                // token is still valid and will work once the connection is back.
                if err.is("invalid_refresh_token") || err.is("account_banned") {
                    self.forget_refresh_token();
                    *slot = None;
                }
                Err(if err.is("invalid_refresh_token") { AppError::new("not_signed_in") } else { err })
            }
        }
    }

    /// Calls an endpoint that requires a session, renewing the access token when needed.
    pub async fn authed<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
    ) -> AppResult<T> {
        let token = {
            let mut slot = self.access.lock().await;
            let fresh = matches!(&*slot, Some(t) if t.expires_at > Instant::now() + EXPIRY_MARGIN);
            if !fresh {
                self.refresh(&mut slot).await?;
            }
            slot.as_ref().map(|t| t.value.clone()).ok_or_else(|| AppError::new("not_signed_in"))?
        };
        match self.send::<T>(method.clone(), path, body, Some(&token)).await {
            // The server may have revoked the access token early; one renewal is worth trying.
            Err(err) if err.is("invalid_token") => {
                let token = {
                    let mut slot = self.access.lock().await;
                    self.refresh(&mut slot).await?;
                    slot.as_ref().map(|t| t.value.clone()).ok_or_else(|| AppError::new("not_signed_in"))?
                };
                self.send::<T>(method, path, body, Some(&token)).await
            }
            Err(err) => {
                if err.is("session_revoked") {
                    self.forget_refresh_token();
                    *self.access.lock().await = None;
                    return Err(AppError::new("not_signed_in"));
                }
                Err(err)
            }
            ok => ok,
        }
    }

    pub async fn login(&self, email: &str, password: &str, device_name: &str) -> AppResult<()> {
        let body = json!({ "email": email, "password": password, "deviceName": device_name });
        let pair = self.send::<TokenPair>(Method::POST, "/v1/auth/login", Some(&body), None).await?;
        self.adopt(pair, &mut *self.access.lock().await)
    }

    /// Completes a Google or Discord sign-in started by `oauth::sign_in`.
    pub async fn exchange_oauth_code(
        &self,
        code: &str,
        verifier: &str,
        device_name: &str,
    ) -> AppResult<()> {
        let body = json!({ "code": code, "verifier": verifier, "deviceName": device_name });
        let pair =
            self.send::<TokenPair>(Method::POST, "/v1/auth/oauth/exchange", Some(&body), None).await?;
        self.adopt(pair, &mut *self.access.lock().await)
    }

    pub async fn providers(&self) -> AppResult<Vec<String>> {
        #[derive(Deserialize)]
        struct Providers {
            providers: Vec<String>,
        }
        Ok(self
            .send::<Providers>(Method::GET, "/v1/auth/oauth/providers", None, None)
            .await?
            .providers)
    }

    /// Who is signed in and what they are entitled to, straight from the server.
    pub async fn account(&self) -> AppResult<Account> {
        #[derive(Deserialize)]
        struct Me {
            email: String,
        }
        #[derive(Deserialize)]
        struct Entitlements {
            tier: String,
        }
        let me: Me = self.authed(Method::GET, "/v1/me", None).await?;
        let rights: Entitlements = self.authed(Method::GET, "/v1/me/entitlements", None).await?;
        Ok(Account { email: me.email, tier: rights.tier })
    }

    pub async fn has_session(&self) -> bool {
        self.access.lock().await.is_some()
    }

    pub async fn logout(&self) {
        // Best effort on the server side; the local credentials are removed regardless.
        let _ = self.authed::<Value>(Method::POST, "/v1/auth/logout", None).await;
        self.forget_refresh_token();
        *self.access.lock().await = None;
    }
}
