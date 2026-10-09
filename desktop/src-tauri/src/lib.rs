pub mod api;
pub mod capture;
pub mod error;
pub mod oauth;
pub mod update;

use tauri::{AppHandle, Manager, State};
use tokio::sync::Notify;

use api::{Account, ApiClient};
use capture::{Capture, Devices};
use error::{AppError, AppResult};

/// Neutral codename: the commercial name can change without orphaning stored sessions.
const KEYCHAIN_SERVICE: &str = "newapp";
const API_URL: &str = env!("APP_API_URL");
const WEB_URL: &str = env!("APP_WEB_URL");
const UPDATE_URL: &str = env!("APP_UPDATE_URL");

struct AppState {
    api: ApiClient,
    camera: Capture,
    microphone: Capture,
    cancel_sign_in: Notify,
}

fn device_name() -> String {
    std::env::var("COMPUTERNAME").unwrap_or_else(|_| "PC".to_string())
}

/// Capture is refused without a session opened by the server. This check runs in the client
/// and can be patched out, so nothing of value depends on it: models and Premium features are
/// released by the server, which checks the account itself.
async fn require_session(state: &AppState) -> AppResult<()> {
    if state.api.has_session().await {
        Ok(())
    } else {
        Err(AppError::new("not_signed_in"))
    }
}

fn stop_captures(state: &AppState) {
    state.camera.stop();
    state.microphone.stop();
}

/// Restores the previous session at startup. `None` means the login screen must be shown.
#[tauri::command]
async fn restore_session(state: State<'_, AppState>) -> AppResult<Option<Account>> {
    match state.api.account().await {
        Ok(account) => Ok(Some(account)),
        Err(err) if err.is("not_signed_in") => Ok(None),
        Err(err) => Err(err),
    }
}

#[tauri::command]
async fn sign_in(state: State<'_, AppState>, email: String, password: String) -> AppResult<Account> {
    state.api.login(&email, &password, &device_name()).await?;
    state.api.account().await
}

#[tauri::command]
async fn sign_in_with(state: State<'_, AppState>, provider: String) -> AppResult<Account> {
    oauth::sign_in(&state.api, &provider, &device_name(), &state.cancel_sign_in).await?;
    state.api.account().await
}

#[tauri::command]
fn cancel_sign_in(state: State<'_, AppState>) {
    state.cancel_sign_in.notify_waiters();
}

#[tauri::command]
async fn sign_in_providers(state: State<'_, AppState>) -> AppResult<Vec<String>> {
    state.api.providers().await
}

/// Polled by the interface: a ban, a revoked session or a change of plan shows up here.
#[tauri::command]
async fn account(state: State<'_, AppState>) -> AppResult<Account> {
    let result = state.api.account().await;
    if matches!(&result, Err(err) if err.is("not_signed_in") || err.is("account_banned")) {
        stop_captures(&state);
    }
    result
}

#[tauri::command]
async fn sign_out(state: State<'_, AppState>) -> AppResult<()> {
    stop_captures(&state);
    state.api.logout().await;
    Ok(())
}

/// Opens a page of the website in the user's browser. Only these fixed pages can be opened.
#[tauri::command]
fn open_website(page: String) -> AppResult<()> {
    let path = match page.as_str() {
        "register" => "/register/",
        "forgot-password" => "/forgot-password/",
        "pricing" => "/pricing/",
        "account" => "/account/",
        _ => return Err(AppError::new("unknown_page")),
    };
    open::that(format!("{WEB_URL}{path}")).map_err(|_| AppError::new("browser_unavailable"))
}

#[tauri::command]
async fn list_devices(state: State<'_, AppState>) -> AppResult<Devices> {
    require_session(&state).await?;
    // Device enumeration talks to drivers and can take a moment: keep it off the async threads.
    tauri::async_runtime::spawn_blocking(capture::list_devices)
        .await
        .map_err(|_| AppError::new("device_error"))
}

#[tauri::command]
async fn start_camera(app: AppHandle, state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_session(&state).await?;
    capture::require_id(&id)?;
    capture::start_camera(app, &state.camera, &id)
}

#[tauri::command]
fn stop_camera(state: State<'_, AppState>) {
    state.camera.stop();
}

#[tauri::command]
async fn start_microphone(app: AppHandle, state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_session(&state).await?;
    capture::require_id(&id)?;
    capture::start_microphone(app, &state.microphone, &id)
}

#[tauri::command]
fn stop_microphone(state: State<'_, AppState>) {
    state.microphone.stop();
}

/// Asked by the interface at startup and from time to time. Works without a session, so a
/// broken version can always be replaced.
#[tauri::command]
async fn check_update(app: AppHandle) -> AppResult<Option<String>> {
    update::check(&app, UPDATE_URL).await
}

#[tauri::command]
async fn install_update(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    stop_captures(&state);
    update::install(&app, UPDATE_URL).await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.manage(AppState {
                api: ApiClient::new(API_URL, KEYCHAIN_SERVICE),
                camera: Capture::default(),
                microphone: Capture::default(),
                cancel_sign_in: Notify::new(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            restore_session,
            sign_in,
            sign_in_with,
            cancel_sign_in,
            sign_in_providers,
            account,
            sign_out,
            open_website,
            list_devices,
            start_camera,
            stop_camera,
            start_microphone,
            stop_microphone,
            check_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the application");
}
