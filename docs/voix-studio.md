# Voix studio : second moteur de voix (RVC)

Fait le 11 octobre 2026 sur le PC de développement (RTX 3060 12 Go, Ryzen 5 5600G, 16 Go de
mémoire). **Rien n'a été écouté, et la vraie fenêtre du logiciel n'a pas été lancée** : tout ce
qui suit vient de mesures et de l'aperçu de l'interface. Extraits à écouter :
`desktop/samples/voix-studio-2026-10-11/` (dossier local, non versionné).

## 1. Ce que c'est

Une voix clonée (`voice.rs`, OpenVoice V2) est décrite par quelques secondes d'enregistrement
et redessinée par un modèle général. Une **voix studio** (`studio.rs`) est un modèle entraîné
pendant des heures sur une seule voix (RVC v2). L'utilisateur ne la fabrique pas : elle vient
avec le logiciel. Les deux moteurs coexistent ; une voix de l'un ou de l'autre est choisie,
jamais les deux.

Trois modèles travaillent sur chaque fenêtre de son (1,28 s, toujours la même longueur) :

| Fichier (`models/studio/`) | Rôle | Origine | Taille |
| --- | --- | --- | --- |
| `content.onnx` | Entend ce qui est dit | ContentVec (MIT), exporté par nous | 360 Mo |
| `pitch.onnx` | Entend à quelle hauteur | RMVPE, poids publiés avec le projet RVC (MIT), exporté par nous pour cette longueur exacte | 349 Mo |
| `studio-<voix>.onnx` | Redit le tout avec la voix | Entraîné par nous (voir § 3) | 105 Mo |

Découpage : blocs de 200 ms, une seconde de son avant chaque bloc, 80 ms après. Les blocs sont
raccordés en glissant le nouveau (12 ms au plus) là où il prolonge le mieux le précédent. La
hauteur est déplacée toute seule vers celle où la voix parle naturellement (243 Hz pour
Serena), d'après la hauteur moyenne de celui qui parle. Le micro passe par la même réduction
de bruit et la même file de lecture que les voix clonées (`effects.rs`, `convert_voice`).

Dans l'interface, les voix studio ont leur section en haut de l'écran des voix. Elle n'apparaît
que si une voix est installée.

## 2. Mesures

Même voix d'homme de 32 s (153 Hz), trajet complet en direct (`cargo run --example live --
<modèles> studio-serena <parole> <résultat>`), sortie par à-coups comme VoiceMeeter.

| | Voix studio Serena | Moteur actuel (vers Yuna) | Voix de départ |
| --- | --- | --- | --- |
| Rien à jouer | 0 fois | 0 fois | — |
| Note DNSMOS (sur 5) | 3,41 | 3,38 | 3,59 |
| Même parole convertie d'un seul tenant | 3,55 | 3,48 | — |
| Hauteur | 240 Hz | 248 Hz | 153 Hz |
| Retard | environ 480 ms | environ 540 ms | — |
| Fréquence du son | 48 kHz | 22 kHz | — |
| Clics comptés par 10 s | 4,8 | 0,0 | 4,7 |

Ce que ça dit :

- **la propreté est celle du micro, à peu de chose près**, en un seul tenant (3,55 pour 3,59).
  En direct il se perd 0,14 point, comme avec l'autre moteur : c'est le prix du découpage, de
  la réduction de bruit et de la file de lecture, pas celui de la voix ;
- **les clics comptés ne viennent pas des raccords** : la conversion d'un seul tenant, qui n'a
  aucun raccord, en compte 5,6, et la voix de départ 4,7. Le compteur prend les consonnes
  franches de cette voix pour des clics. À confirmer à l'oreille ;
- **le retard ne baisse que de 60 ms**, loin de ce que l'essai laissait espérer (240 à 370 ms).
  Le calcul lui-même est court ; ce qui reste est le bloc (200 ms), le son attendu après
  (80 ms) et la réserve de la file de lecture, qui doit couvrir un bloc entier. Avec des blocs
  de 100 ms : 410 ms de retard, mais un trou sur 32 s. Écarté tant que ce trou existe ;
- 50 passes d'entraînement donnaient déjà 3,45 : les 100 suivantes n'ont pas changé la note.

Ce que ça ne dit pas : si la voix sonne naturelle, si elle ressemble à une vraie femme, et ce
que ça donne avec un vrai micro dans une vraie pièce.

## 3. Comment Serena a été faite

Tout est dans un atelier hors du projet (`D:\newapp-voicelab`, Python, PyTorch). Rien n'est
installé dans le système.

1. **Parole d'entraînement** : 280 phrases (260 de CMU ARCTIC, équilibrées en sons, 20 en
   français), 16,5 minutes, dites par la voix `Serena` du synthétiseur Qwen3-TTS (Apache-2.0).
   Ce n'est la voix de personne. `desktop/scripts/studio/make-speech.py`.
2. **Entraînement** avec Applio (MIT), depuis les modèles de base RVC v2 en 48 kHz (MIT) :
   150 passes, lots de 8, environ 50 s par passe, 1 h 30 en tout. Jusqu'à 12 Go de mémoire et
   6 Go de carte graphique pendant ce temps.

   ```
   python core.py preprocess --model-name serena --dataset-path <phrases> --sample-rate 48000 --cut-preprocess Automatic --normalization-mode post
   python core.py extract --model-name serena --f0-method rmvpe --sample-rate 48000 --embedder-model contentvec --include-mutes 2
   python core.py train --model-name serena --vocoder HiFi-GAN --save-every-epoch 25 --total-epoch 150 --sample-rate 48000 --batch-size 8 --pretrained
   ```
3. **Export** en ONNX, depuis le dossier d'Applio : `desktop/scripts/studio/export-onnx.py`
   (`content`, `pitch 20480`, `voice logs/serena/G_<pas>.pth`). Les deux modèles communs ont
   été comparés à ceux de w-okada/voice-changer : mêmes nombres à 0,0001 près. Ceux de w-okada
   ne sont pas utilisés : ils sont marqués GPL-3.0 et réservés à son application.
4. **Installation** : `node desktop/scripts/install-studio.mjs <dossier des .onnx>`.

Une nouvelle voix : refaire 1 à 4 avec une autre voix, puis sa ligne dans `VOICES`
(`studio.rs`, avec sa hauteur naturelle : moyenne géométrique des hauteurs de ses phrases) et
dans `FILES` (`install-studio.mjs`).

## 4. Ce qui manque

- **L'écoute.** Aucune mesure ne remplace l'oreille.
- **Les modèles ne sont hébergés nulle part** : ils sont copiés depuis l'atelier. Les servir
  par le serveur est la phase 6. 814 Mo pour la première voix, 105 Mo par voix ensuite.
- **Licence des poids de RMVPE** : publiés dans le dépôt du projet RVC, lui-même sous MIT. À
  confirmer avant de vendre.
- **Une seule voix.** Pas encore de voix d'enfant ni d'homme : une heure et demie
  d'entraînement chacune.
- **Le retard** : voir § 2. Le réduire demande une file de lecture qui tienne avec des blocs
  de 100 ms.
- **La charge** : trois modèles sur la carte graphique en même temps que le visage. Pas
  mesurée avec la caméra en marche. Pas de repli sur le processeur essayé.
- Le curseur « Qualité de la voix » et le mode économie ne changent rien pour une voix studio.
- Les passages dits doucement ne sont pas rendus doucement (l'autre moteur le fait).
