use std::{env, fs, path::Path};

fn main() {
    // The API address is fixed at compile time: local server for development builds, the
    // production domain from brand/brand.json for release builds. APP_API_URL overrides both.
    let brand_path = Path::new("../../brand/brand.json");
    println!("cargo:rerun-if-changed={}", brand_path.display());
    println!("cargo:rerun-if-env-changed=APP_API_URL");

    let brand: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(brand_path).expect("brand/brand.json is missing"))
            .expect("brand/brand.json is not valid JSON");
    let domain = brand["domain"].as_str().expect("brand.json has no domain");

    let release = env::var("PROFILE").map(|p| p == "release").unwrap_or(false);
    let api_url = env::var("APP_API_URL").unwrap_or_else(|_| {
        if release {
            format!("https://api.{domain}")
        } else {
            "http://localhost:4000".to_string()
        }
    });
    let web_url = if release {
        format!("https://{domain}")
    } else {
        "http://localhost:3000".to_string()
    };
    println!("cargo:rustc-env=APP_API_URL={api_url}");
    println!("cargo:rustc-env=APP_WEB_URL={web_url}");

    // Updates are read from the releases of a public GitHub repository ("owner/name"). Without
    // APP_UPDATE_REPO the address is empty and the program never looks for an update.
    println!("cargo:rerun-if-env-changed=APP_UPDATE_REPO");
    let update_url = match env::var("APP_UPDATE_REPO") {
        Ok(repo) if !repo.is_empty() => {
            let valid = repo.split('/').count() == 2
                && repo.chars().all(|c| c.is_ascii_alphanumeric() || "-_./".contains(c));
            assert!(valid, "APP_UPDATE_REPO must look like owner/name, got {repo}");
            format!("https://github.com/{repo}/releases/latest/download/latest.json")
        }
        _ => String::new(),
    };
    println!("cargo:rustc-env=APP_UPDATE_URL={update_url}");

    tauri_build::build();
}
