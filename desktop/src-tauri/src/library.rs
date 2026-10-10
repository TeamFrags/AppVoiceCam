//! Faces and voices cloned by the user, kept on this PC.
//!
//! A face is the portrait it was cloned from; a voice is its reference recording. An index
//! file holds their names. Identifiers are generated here and checked on the way back in, so
//! nothing the interface sends is ever used as a path.

use std::{fs, io::Cursor, path::PathBuf, sync::Mutex};

use base64::{engine::general_purpose::STANDARD, Engine};
use image::RgbImage;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

const INDEX_FILE: &str = "library.json";
const NAME_MAX: usize = 40;
const PORTRAIT_SIDE: u32 = 512;
const PORTRAIT_JPEG_QUALITY: u8 = 88;
const VOICE_MAX_BYTES: usize = 20 * 1024 * 1024;
const VOICE_FORMATS: [&str; 5] = ["wav", "mp3", "flac", "ogg", "m4a"];
/// A shorter reference recording does not carry enough of a voice to clone it.
pub const SAMPLE_MIN_SECONDS: f32 = 5.0;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Face,
    Voice,
}

#[derive(Clone, Serialize, Deserialize)]
struct Entry {
    id: String,
    name: String,
    file: String,
}

#[derive(Default, Serialize, Deserialize)]
struct Index {
    faces: Vec<Entry>,
    voices: Vec<Entry>,
}

/// What the interface shows for a face or a voice.
#[derive(Debug, Serialize)]
pub struct Profile {
    id: String,
    name: String,
    /// Portrait of a face, as a base64 JPEG. Voices have none.
    picture: Option<String>,
    /// Comes with the application: it cannot be removed.
    included: bool,
}

impl Profile {
    /// A voice that comes with the application.
    pub fn included(id: &str, name: &str) -> Self {
        Self { id: id.to_string(), name: name.to_string(), picture: None, included: true }
    }
}

#[derive(Serialize)]
pub struct Profiles {
    faces: Vec<Profile>,
    voices: Vec<Profile>,
}

pub struct Library {
    dir: PathBuf,
    index: Mutex<Index>,
}

fn storage_failed<E>(_: E) -> AppError {
    AppError::new("storage_failed")
}

fn clean_name(name: &str) -> AppResult<String> {
    let name: String = name.trim().chars().filter(|c| !c.is_control()).take(NAME_MAX).collect();
    if name.is_empty() {
        return Err(AppError::new("invalid_name"));
    }
    Ok(name)
}

fn new_id() -> String {
    format!("{:032x}", rand::random::<u128>())
}

/// Mono 16-bit PCM, the plainest form of a WAV file.
pub fn encode_wav(samples: &[f32], rate: u32) -> Vec<u8> {
    let data_len = (samples.len() * 2) as u32;
    let mut wav = Vec::with_capacity(44 + samples.len() * 2);
    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVEfmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes()); // PCM
    wav.extend_from_slice(&1u16.to_le_bytes()); // one channel
    wav.extend_from_slice(&rate.to_le_bytes());
    wav.extend_from_slice(&(rate * 2).to_le_bytes()); // bytes per second
    wav.extend_from_slice(&2u16.to_le_bytes()); // bytes per sample
    wav.extend_from_slice(&16u16.to_le_bytes()); // bits per sample
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    for sample in samples {
        let value = (sample.clamp(-1.0, 1.0) * f32::from(i16::MAX)) as i16;
        wav.extend_from_slice(&value.to_le_bytes());
    }
    wav
}

impl Library {
    /// An index that is missing or unreadable is an empty library.
    pub fn open(dir: PathBuf) -> Self {
        let index = fs::read(dir.join(INDEX_FILE))
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self { dir, index: Mutex::new(index) }
    }

    fn save(&self, index: &Index) -> AppResult<()> {
        let json = serde_json::to_vec(index).map_err(storage_failed)?;
        fs::write(self.dir.join(INDEX_FILE), json).map_err(storage_failed)
    }

    fn store(&self, kind: Kind, name: String, extension: &str, bytes: &[u8]) -> AppResult<Entry> {
        let id = new_id();
        let entry = Entry { file: format!("{id}.{extension}"), id, name };
        fs::create_dir_all(&self.dir).map_err(storage_failed)?;
        fs::write(self.dir.join(&entry.file), bytes).map_err(storage_failed)?;
        let mut index = self.index.lock().unwrap();
        match kind {
            Kind::Face => index.faces.push(entry.clone()),
            Kind::Voice => index.voices.push(entry.clone()),
        }
        self.save(&index)?;
        Ok(entry)
    }

    /// The voices that come with the application are listed after the user's own.
    pub fn list(&self, included: Vec<Profile>) -> Profiles {
        let index = self.index.lock().unwrap();
        let faces = index
            .faces
            .iter()
            .map(|entry| Profile {
                id: entry.id.clone(),
                name: entry.name.clone(),
                picture: fs::read(self.dir.join(&entry.file)).ok().map(|b| STANDARD.encode(b)),
                included: false,
            })
            .collect();
        let voices = index
            .voices
            .iter()
            .map(|entry| Profile {
                id: entry.id.clone(),
                name: entry.name.clone(),
                picture: None,
                included: false,
            })
            .chain(included)
            .collect();
        Profiles { faces, voices }
    }

    /// Keeps a portrait in which a face has already been found.
    pub fn add_face(&self, name: &str, portrait: RgbImage) -> AppResult<Profile> {
        let name = clean_name(name)?;
        let portrait = image::DynamicImage::ImageRgb8(portrait);
        let portrait = if portrait.width().max(portrait.height()) > PORTRAIT_SIDE {
            portrait.thumbnail(PORTRAIT_SIDE, PORTRAIT_SIDE).to_rgb8()
        } else {
            portrait.to_rgb8()
        };
        let mut jpeg = Cursor::new(Vec::new());
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg, PORTRAIT_JPEG_QUALITY)
            .encode(&portrait, portrait.width(), portrait.height(), image::ExtendedColorType::Rgb8)
            .map_err(|_| AppError::new("invalid_image"))?;
        let jpeg = jpeg.into_inner();
        let entry = self.store(Kind::Face, name, "jpg", &jpeg)?;
        let picture = Some(STANDARD.encode(jpeg));
        Ok(Profile { id: entry.id, name: entry.name, picture, included: false })
    }

    /// The portrait of a face, as the image file it was saved in.
    pub fn face(&self, id: &str) -> AppResult<Vec<u8>> {
        let index = self.index.lock().unwrap();
        let entry = index.faces.iter().find(|entry| entry.id == id);
        let entry = entry.ok_or_else(|| AppError::new("not_found"))?;
        fs::read(self.dir.join(&entry.file)).map_err(|_| AppError::new("not_found"))
    }

    /// The reference recording of a voice, and the kind of audio file it is.
    pub fn voice(&self, id: &str) -> AppResult<(Vec<u8>, String)> {
        let index = self.index.lock().unwrap();
        let entry = index.voices.iter().find(|entry| entry.id == id);
        let entry = entry.ok_or_else(|| AppError::new("not_found"))?;
        let audio = fs::read(self.dir.join(&entry.file)).map_err(|_| AppError::new("not_found"))?;
        let extension = entry.file.rsplit('.').next().unwrap_or_default().to_string();
        Ok((audio, extension))
    }

    /// Keeps a reference recording. `extension` says what kind of audio file it is.
    pub fn add_voice(&self, name: &str, extension: &str, audio: &[u8]) -> AppResult<Profile> {
        let name = clean_name(name)?;
        let extension = extension.to_ascii_lowercase();
        if !VOICE_FORMATS.contains(&extension.as_str())
            || audio.is_empty()
            || audio.len() > VOICE_MAX_BYTES
        {
            return Err(AppError::new("invalid_audio"));
        }
        let entry = self.store(Kind::Voice, name, &extension, audio)?;
        Ok(Profile { id: entry.id, name: entry.name, picture: None, included: false })
    }

    pub fn remove(&self, kind: Kind, id: &str) -> AppResult<()> {
        let mut index = self.index.lock().unwrap();
        let entries = match kind {
            Kind::Face => &mut index.faces,
            Kind::Voice => &mut index.voices,
        };
        let at = entries.iter().position(|entry| entry.id == id);
        let entry = entries.remove(at.ok_or_else(|| AppError::new("not_found"))?);
        let _ = fs::remove_file(self.dir.join(entry.file));
        self.save(&index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn library() -> Library {
        Library::open(std::env::temp_dir().join(format!("library-test-{}", new_id())))
    }

    #[test]
    fn a_voice_is_kept_listed_after_reopening_and_removed() {
        let library = library();
        let voice = library.add_voice("  Narrator ", "WAV", &encode_wav(&[0.0; 8], 48_000)).unwrap();
        assert_eq!(voice.name, "Narrator");

        let reopened = Library::open(library.dir.clone());
        assert_eq!(reopened.list(Vec::new()).voices.len(), 1);
        let listed = reopened.list(vec![Profile::included("arctic-slt", "Iris")]).voices;
        assert_eq!((listed.len(), listed[1].included), (2, true));
        let (audio, extension) = reopened.voice(&voice.id).unwrap();
        assert_eq!((audio.len(), extension.as_str()), (44 + 16, "wav"));
        reopened.remove(Kind::Voice, &voice.id).unwrap();
        assert!(reopened.list(Vec::new()).voices.is_empty());
        assert!(reopened.remove(Kind::Voice, &voice.id).unwrap_err().is("not_found"));
        let _ = fs::remove_dir_all(&library.dir);
    }

    #[test]
    fn a_face_is_saved_as_a_small_portrait() {
        let library = library();
        let face = library.add_face("Me", RgbImage::new(2000, 1000)).unwrap();
        let saved = image::load_from_memory(&library.face(&face.id).unwrap()).unwrap();
        assert_eq!((saved.width(), saved.height()), (512, 256));
        let _ = fs::remove_dir_all(&library.dir);
    }

    #[test]
    fn bad_names_files_and_identifiers_are_refused() {
        let library = library();
        assert!(library.add_voice(" \n ", "wav", b"x").unwrap_err().is("invalid_name"));
        assert!(library.add_voice("A", "exe", b"x").unwrap_err().is("invalid_audio"));
        assert!(library.add_voice("A", "wav", b"").unwrap_err().is("invalid_audio"));
        assert!(library.face("../library").unwrap_err().is("not_found"));
    }

    #[test]
    fn a_recording_becomes_a_wav_file() {
        let wav = encode_wav(&[0.0, 1.0, -1.0], 16_000);
        assert_eq!(&wav[..4], b"RIFF");
        assert_eq!(wav.len(), 44 + 6);
        assert_eq!(&wav[46..48], &i16::MAX.to_le_bytes());
    }
}
