//! Voices that come with the application.
//!
//! The `arctic` ones are recordings from CMU ARCTIC, which Carnegie Mellon University
//! publishes for any use, commercial included. The `kokoro` ones are no one's voice: they were
//! spoken by the Kokoro speech synthesiser (Apache-2.0), each with another of its voices. The
//! `qwen` ones are no one's voice either: the Qwen3-TTS synthesiser (Apache-2.0) spoke them,
//! two with voices it comes with, the others, the two children among them, with voices it made
//! up from a description. All are installed with the models, in a folder of their own, next to
//! the notices their licences ask to keep. The names shown are made up: they are not the
//! speakers'.

use std::{fs, path::PathBuf};

use crate::library::Profile;

/// Identifier of each voice, which is also the name of its file, and the name shown. One
/// recording is one voice: the same file under two names would be the same voice twice. The
/// women's voices of Kokoro go from the lowest to the highest, then those of Qwen3-TTS, then its
/// two children.
const VOICES: [(&str, &str); 20] = [
    ("kokoro-sky", "Sophie"),
    ("kokoro-kore", "Jeanne"),
    ("kokoro-river", "Inès"),
    ("kokoro-emma", "Emma"),
    ("kokoro-bella", "Chloé"),
    ("kokoro-jessica", "Léa"),
    ("qwen-deep", "Hélène"),
    ("qwen-vivian", "Manon"),
    ("qwen-warm", "Margot"),
    ("qwen-anna", "Yuna"),
    ("qwen-bright", "Camille"),
    ("qwen-boy", "Tom (kid)"),
    ("qwen-girl", "Lili (kid)"),
    ("arctic-slt", "Iris"),
    ("arctic-clb", "Clara"),
    ("arctic-bdl", "Marcus"),
    ("arctic-rms", "Walter"),
    ("arctic-jmk", "Jamie"),
    ("arctic-awb", "Alastair"),
    ("arctic-ksp", "Ravi"),
];

pub struct Catalogue {
    dir: PathBuf,
}

impl Catalogue {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn path(&self, id: &str) -> PathBuf {
        self.dir.join(format!("{id}.wav"))
    }

    /// The voices installed on this PC.
    pub fn list(&self) -> Vec<Profile> {
        VOICES
            .iter()
            .filter(|(id, _)| self.path(id).is_file())
            .map(|(id, name)| Profile::included(id, name))
            .collect()
    }

    /// The reference recording of a voice, a WAV file, if `id` is one of these voices. Only
    /// the identifiers listed above are ever turned into a path.
    pub fn voice(&self, id: &str) -> Option<Vec<u8>> {
        let (id, _) = VOICES.iter().find(|(known, _)| *known == id)?;
        fs::read(self.path(id)).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_installed_voices_are_listed_and_nothing_else_is_read() {
        let dir = std::env::temp_dir().join(format!("catalogue-test-{:032x}", rand::random::<u128>()));
        fs::create_dir_all(&dir).unwrap();
        let catalogue = Catalogue::new(dir.clone());
        assert!(catalogue.list().is_empty());
        assert!(catalogue.voice("arctic-slt").is_none());

        fs::write(dir.join("arctic-slt.wav"), b"sound").unwrap();
        fs::write(dir.join("other.wav"), b"sound").unwrap();
        assert_eq!(catalogue.list().len(), 1);
        assert_eq!(catalogue.voice("arctic-slt").unwrap(), b"sound");
        assert!(catalogue.voice("other").is_none());
        assert!(catalogue.voice("../voices/arctic-slt").is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_recording_is_offered_under_two_names() {
        for (at, (id, name)) in VOICES.iter().enumerate() {
            assert!(VOICES[..at].iter().all(|(other, _)| other != id), "{id} is listed twice");
            assert!(VOICES[..at].iter().all(|(_, other)| other != name), "{name} is used twice");
        }
    }
}
