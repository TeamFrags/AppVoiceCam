//! Voices that come with the application.
//!
//! They are recordings from CMU ARCTIC, which Carnegie Mellon University publishes for any
//! use, commercial included. They are installed with the models, in a folder of their own,
//! next to the notice their licence asks to keep. The names shown are made up: they are not
//! the speakers'.

use std::{fs, path::PathBuf};

use crate::library::Profile;

/// Identifier of each voice, which is also the name of its file, and the name shown.
const VOICES: [(&str, &str); 7] = [
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
}
