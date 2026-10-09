//! Software updates, published as GitHub releases.
//!
//! The release manifest and the installer come from a public repository, so neither is trusted:
//! the installer is only run if its signature matches the public key compiled into this
//! program (`plugins.updater.pubkey` in tauri.conf.json). The private key never ships.

use tauri::{AppHandle, Url};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::error::{AppError, AppResult};

fn failed<E>(_: E) -> AppError {
    AppError::new("update_failed")
}

/// `manifest_url` is empty in builds made without a release repository: they never update.
async fn find(app: &AppHandle, manifest_url: &str) -> AppResult<Option<Update>> {
    if manifest_url.is_empty() {
        return Ok(None);
    }
    let endpoint = Url::parse(manifest_url).map_err(failed)?;
    app.updater_builder()
        .endpoints(vec![endpoint])
        .map_err(failed)?
        .build()
        .map_err(failed)?
        .check()
        .await
        .map_err(failed)
}

/// Version number of a newer release, if there is one.
pub async fn check(app: &AppHandle, manifest_url: &str) -> AppResult<Option<String>> {
    Ok(find(app, manifest_url).await?.map(|update| update.version))
}

/// Downloads the newer release, verifies its signature, installs it and restarts.
pub async fn install(app: &AppHandle, manifest_url: &str) -> AppResult<()> {
    let update = find(app, manifest_url).await?.ok_or_else(|| AppError::new("update_failed"))?;
    update.download_and_install(|_, _| {}, || {}).await.map_err(failed)?;
    app.restart()
}
