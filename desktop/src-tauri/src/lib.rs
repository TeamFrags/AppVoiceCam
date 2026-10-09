pub mod api;
pub mod capture;
pub mod effects;
pub mod error;
pub mod face;
pub mod filters;
pub mod library;
pub mod oauth;
pub mod update;
pub mod voice;

use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc,
    },
};

use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tokio::sync::Notify;

use api::{Account, ApiClient};
use capture::{Capture, Devices, Recorder};
use effects::{VoiceEffect, VoiceSettings};
use error::{AppError, AppResult};
use face::FaceSwap;
use filters::Filter;
use library::{Kind, Library, Profile, Profiles};
use voice::VoiceClone;

/// Neutral codename: the commercial name can change without orphaning stored sessions.
const KEYCHAIN_SERVICE: &str = "newapp";
const API_URL: &str = env!("APP_API_URL");
const WEB_URL: &str = env!("APP_WEB_URL");
const UPDATE_URL: &str = env!("APP_UPDATE_URL");
const PHOTO_JPEG_QUALITY: u8 = 90;
const MAIN_WINDOW: &str = "main";
/// The small window that keeps the camera in view above the other applications.
const PIP_WINDOW: &str = "pip";
const PIP_SIZE: (f64, f64) = (384.0, 216.0);
const PIP_MIN_SIZE: (f64, f64) = (192.0, 108.0);

struct AppState {
    api: ApiClient,
    camera: Capture,
    microphone: Capture,
    face: Arc<FaceSwap>,
    library: Arc<Library>,
    recorder: Arc<Recorder>,
    economy: Arc<AtomicBool>,
    /// Camera filter, as a `Filter` code: read by the capture thread for every frame.
    filter: Arc<AtomicU8>,
    voice: Arc<VoiceSettings>,
    voice_clone: Arc<VoiceClone>,
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
    state.recorder.take();
    state.voice.set_monitor(false);
}

fn close_pip(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(PIP_WINDOW) {
        let _ = window.close();
    }
}

/// Restores the previous session at startup. `None` means the login screen must be shown.
#[tauri::command]
async fn restore_session(state: State<'_, AppState>) -> AppResult<Option<Account>> {
    match state.api.account().await {
        Ok(account) => Ok(Some(account)),
        Err(err) if err.is("not_signed_in") => {
            // `npm run dev:test`: no login screen, straight in as the development admin.
            #[cfg(debug_assertions)]
            {
                if std::env::var_os("APP_DEV_AUTO_LOGIN").is_some() {
                    state.api.dev_login(&device_name()).await?;
                    return state.api.account().await.map(Some);
                }
            }
            Ok(None)
        }
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
async fn account(app: AppHandle, state: State<'_, AppState>) -> AppResult<Account> {
    let result = state.api.account().await;
    if matches!(&result, Err(err) if err.is("not_signed_in") || err.is("account_banned")) {
        stop_captures(&state);
        close_pip(&app);
    }
    result
}

#[tauri::command]
async fn sign_out(app: AppHandle, state: State<'_, AppState>) -> AppResult<()> {
    stop_captures(&state);
    close_pip(&app);
    state.face.clear_source();
    state.voice_clone.clear_target();
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
    capture::start_camera(
        app,
        &state.camera,
        state.face.clone(),
        state.economy.clone(),
        state.filter.clone(),
        &id,
    )
}

#[tauri::command]
fn stop_camera(state: State<'_, AppState>) {
    state.camera.stop();
}

#[tauri::command]
async fn start_microphone(app: AppHandle, state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_session(&state).await?;
    capture::require_id(&id)?;
    capture::start_microphone(
        app,
        &state.microphone,
        state.recorder.clone(),
        state.voice.clone(),
        state.voice_clone.clone(),
        state.economy.clone(),
        &id,
    )
}

#[tauri::command]
fn stop_microphone(state: State<'_, AppState>) {
    state.microphone.stop();
    state.voice.set_monitor(false);
}

/// Monitor: the microphone is played back on the speakers or headphones, with its effect. It
/// only sounds while the microphone runs.
#[tauri::command]
fn set_monitor(state: State<'_, AppState>, on: bool) {
    state.voice.set_monitor(on);
}

#[tauri::command]
fn set_voice_effect(state: State<'_, AppState>, effect: VoiceEffect) {
    state.voice.set_effect(effect);
}

/// Filter drawn on the camera picture, after the face swap.
#[tauri::command]
fn set_filter(state: State<'_, AppState>, filter: Filter) {
    state.filter.store(filter as u8, Ordering::Relaxed);
}

/// Opens the floating camera window, or closes it if it is open. Returns whether it is open.
/// It receives the same frames as the main window and can do nothing but show them.
#[tauri::command]
async fn toggle_pip(app: AppHandle, state: State<'_, AppState>) -> AppResult<bool> {
    if app.get_webview_window(PIP_WINDOW).is_some() {
        close_pip(&app);
        return Ok(false);
    }
    require_session(&state).await?;
    WebviewWindowBuilder::new(&app, PIP_WINDOW, WebviewUrl::App("index.html".into()))
        .title(app.package_info().name.clone())
        .inner_size(PIP_SIZE.0, PIP_SIZE.1)
        .min_inner_size(PIP_MIN_SIZE.0, PIP_MIN_SIZE.1)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|_| AppError::new("window_failed"))?;
    Ok(true)
}

/// File and model work is kept off the async threads.
async fn blocking<T: Send + 'static>(
    run: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(run).await.map_err(|_| AppError::new("storage_failed"))?
}

/// Pictures arrive from the interface as base64. Loading the models and running them takes
/// a while, so the work is kept off the async threads.
async fn with_picture<T: Send + 'static>(
    state: &AppState,
    image: String,
    run: impl FnOnce(&FaceSwap, &[u8]) -> Result<T, face::FaceError> + Send + 'static,
) -> AppResult<T> {
    require_session(state).await?;
    let bytes = STANDARD.decode(image).map_err(|_| AppError::new("invalid_image"))?;
    let face = state.face.clone();
    tauri::async_runtime::spawn_blocking(move || run(&face, &bytes))
        .await
        .map_err(|_| AppError::new("face_engine_failed"))?
        .map_err(AppError::from)
}

/// The faces and voices cloned on this PC.
#[tauri::command]
async fn list_library(state: State<'_, AppState>) -> AppResult<Profiles> {
    require_session(&state).await?;
    let library = state.library.clone();
    blocking(move || Ok(library.list())).await
}

/// Clones a face from a picture file: it joins the library once a face is found in it.
#[tauri::command]
async fn clone_face(state: State<'_, AppState>, name: String, image: String) -> AppResult<Profile> {
    let library = state.library.clone();
    let portrait = with_picture(&state, image, |face, bytes| face.portrait(bytes)).await?;
    blocking(move || library.add_face(&name, portrait)).await
}

/// Chooses the face shown instead of the user's own, among the cloned ones.
#[tauri::command]
async fn use_face(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_session(&state).await?;
    let (library, face) = (state.library.clone(), state.face.clone());
    blocking(move || Ok(face.set_source(&library.face(&id)?)?)).await
}

#[tauri::command]
fn clear_face(state: State<'_, AppState>) {
    state.face.clear_source();
}

/// Applies the chosen face to a still photo: a way to try it without a camera.
#[tauri::command]
async fn swap_photo(state: State<'_, AppState>, image: String) -> AppResult<String> {
    with_picture(&state, image, |face, bytes| {
        let picture = face.swap_photo(bytes)?;
        capture::encode_jpeg(&picture, picture.width(), picture.height(), PHOTO_JPEG_QUALITY)
            .ok_or(face::FaceError::InvalidImage)
    })
    .await
}

/// Chooses the voice heard instead of the user's own, among the cloned ones. The first use
/// loads the voice models, which takes a few seconds.
#[tauri::command]
async fn use_voice(state: State<'_, AppState>, id: String) -> AppResult<()> {
    require_session(&state).await?;
    let (library, clone) = (state.library.clone(), state.voice_clone.clone());
    blocking(move || {
        let (audio, extension) = library.voice(&id)?;
        Ok(clone.set_target(audio, &extension)?)
    })
    .await
}

#[tauri::command]
fn clear_voice(state: State<'_, AppState>) {
    state.voice_clone.clear_target();
}

/// Clones a voice from an audio file: its reference recording joins the library.
#[tauri::command]
async fn import_voice(
    state: State<'_, AppState>,
    name: String,
    extension: String,
    audio: String,
) -> AppResult<Profile> {
    require_session(&state).await?;
    let audio = STANDARD.decode(audio).map_err(|_| AppError::new("invalid_audio"))?;
    let library = state.library.clone();
    blocking(move || library.add_voice(&name, &extension, &audio)).await
}

/// Starts recording a voice sample from a microphone. Its level is reported as usual.
#[tauri::command]
async fn start_voice_sample(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<()> {
    require_session(&state).await?;
    capture::require_id(&id)?;
    state.recorder.begin();
    // Hearing oneself would end up in the reference recording.
    state.voice.set_monitor(false);
    capture::start_microphone(
        app,
        &state.microphone,
        state.recorder.clone(),
        state.voice.clone(),
        state.voice_clone.clone(),
        state.economy.clone(),
        &id,
    )
}

/// Stops the recording and returns its length in seconds. It is kept until saved or discarded.
#[tauri::command]
fn stop_voice_sample(state: State<'_, AppState>) -> f32 {
    state.microphone.stop();
    state.recorder.end()
}

#[tauri::command]
async fn save_voice_sample(state: State<'_, AppState>, name: String) -> AppResult<Profile> {
    require_session(&state).await?;
    state.microphone.stop();
    if state.recorder.end() < library::SAMPLE_MIN_SECONDS {
        return Err(AppError::new("sample_too_short"));
    }
    let (samples, rate) = state.recorder.take();
    let library = state.library.clone();
    blocking(move || library.add_voice(&name, "wav", &library::encode_wav(&samples, rate))).await
}

#[tauri::command]
fn discard_voice_sample(state: State<'_, AppState>) {
    state.microphone.stop();
    state.recorder.take();
}

#[tauri::command]
async fn remove_profile(state: State<'_, AppState>, kind: Kind, id: String) -> AppResult<()> {
    require_session(&state).await?;
    let library = state.library.clone();
    blocking(move || library.remove(kind, &id)).await
}

/// Economy mode: fewer camera frames are processed, to spare the graphics card.
#[tauri::command]
fn set_economy(state: State<'_, AppState>, on: bool) {
    state.economy.store(on, Ordering::Relaxed);
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
            // APP_MODELS_DIR points a development build at models kept elsewhere.
            let models = match std::env::var_os("APP_MODELS_DIR") {
                Some(dir) => PathBuf::from(dir),
                None => app.path().app_local_data_dir()?.join("models"),
            };
            let library = app.path().app_local_data_dir()?.join("library");
            app.manage(AppState {
                api: ApiClient::new(API_URL, KEYCHAIN_SERVICE),
                camera: Capture::default(),
                microphone: Capture::default(),
                face: Arc::new(FaceSwap::new(models.clone())),
                voice_clone: Arc::new(VoiceClone::new(models)),
                library: Arc::new(Library::open(library)),
                recorder: Arc::default(),
                economy: Arc::default(),
                filter: Arc::default(),
                voice: Arc::default(),
                cancel_sign_in: Notify::new(),
            });
            Ok(())
        })
        // The floating window must not keep the application alive once the main one is closed.
        .on_window_event(|window, event| {
            if window.label() == MAIN_WINDOW && matches!(event, WindowEvent::Destroyed) {
                close_pip(window.app_handle());
            }
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
            set_monitor,
            set_voice_effect,
            set_filter,
            toggle_pip,
            list_library,
            clone_face,
            use_face,
            clear_face,
            swap_photo,
            use_voice,
            clear_voice,
            import_voice,
            start_voice_sample,
            stop_voice_sample,
            save_voice_sample,
            discard_voice_sample,
            remove_profile,
            set_economy,
            check_update,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the application");
}
