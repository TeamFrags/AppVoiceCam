# Voix : chantier en cours (journal de reprise)

Commencé le 10 octobre 2026. Demande : supprimer les grésillements et coupures des voix
importées, ajouter plusieurs voix de femme de très bonne qualité, et garder les réglages d'un
lancement à l'autre. Ce fichier est tenu à jour au fil du travail pour pouvoir reprendre si la
session s'arrête. **Rien n'a été écouté** : tout ce qui suit vient de mesures.

## État du code à l'instant

- `desktop/src-tauri/src/voice.rs` : **étape 1 faite, compile, tests verts.** Mesure
  (`zz_lab seams`, écart avec la conversion d'un seul tenant) : 2,1 / 1,4 / 0,9 / 0,4 dB aux
  qualités 0 à 3, contre 5,9 / 5,4 / 4,6 / 0,1 avant.
- `effects.rs` : **étape 2 faite, tests verts (48).** `Playout` remplace l'ancienne file et
  `MonitorPlayback`. `examples/live.rs` simule maintenant une sortie par à-coups comme
  VoiceMeeter (1056, 0, 384, 480, 480 échantillons) : zéro trou aux qualités 0 et 2, retard
  mesuré ~480 ms à la qualité 2 (510 avant, avec des raccords moins bons).
- `capture.rs`, `lib.rs`, interface : **étape 5 faite** (liste `speakers`, commande
  `set_monitor_output`, sélecteur « Écouter sur », micro et sortie retenus dans le
  `localStorage`).
- `denoise.rs` (nouveau), `voice.rs`, `effects.rs` : **étape 3 faite, tests verts (52).**
  RNNoise avant la conversion ; mise à niveau qui suit le fond sonore et ne dépasse jamais 1 ;
  silence joué comme du silence ; le modèle tourne pendant les pauses pour que la carte
  graphique reste prête ; réserve de la file portée à 70 ms.
- `voice.rs`, `lib.rs`, interface : **étape 4 faite sauf l'avertissement** (pauses retirées des
  références ; `own-voice/` par micro ; commande `relearn_own_voice` et son bouton).
- `desktop/src-tauri/examples/zz_lab.rs` : banc de mesure temporaire, à supprimer à la fin.
  Sous-commandes : `score`, `seams`, `edges`, `time`, `devices`, `outticks`, `gpuload`,
  et depuis l'étape 3 `noisy` (fabrique un mauvais micro), `dist` (écart avec une référence,
  bruit dans les pauses), `idle` (durée d'un calcul après un repos de la carte graphique).
- L'interface démarrait au cran 1 alors que le cœur était au cran 2 : les deux sont à 2.
- 11 octobre 2026, `voice.rs` : **voix douces, fait, tests verts (61).** Un passage doux est
  remonté pour le modèle puis redescendu d'autant (`LIFT_MAX`, `Stream::lifts`) ; le fond
  sonore est estimé sur le moment le plus calme de chaque bloc. Le cran « Ultra » en économie
  ne laisse plus au modèle moins de contexte que le minimum.
- 11 octobre 2026, `catalogue.rs`, `fetch-models.mjs`, `desktop/voices/` : **étape 7 faite.**
  Six voix de femme de synthèse (Kokoro) à la place des trois doublons « Ultra Realistic ».
- 11 octobre 2026, mêmes fichiers : **sept voix Qwen3-TTS ajoutées** (cinq femmes, un garçon,
  une fillette ; Apache-2.0, aucune personne réelle). Vingt voix au catalogue. Mesurées, pas
  écoutées. w-okada/voice-changer regardé le même jour : son moteur RVC (MIT) est le candidat
  pour le second moteur, pas encore essayé.
- 11 octobre 2026, `studio.rs` (nouveau), `effects.rs`, `lib.rs`, interface : **second moteur
  (RVC) et première voix studio, Serena.** Tests verts (67). Mesures et fabrication :
  [voix-studio.md](voix-studio.md). Ni écouté ni lancé dans la vraie fenêtre.
- `filters.rs` : les appels de test restés à l'ancienne forme empêchaient tous les tests du
  cœur de compiler ; corrigés.
- Mesures, comparaison VoiceStudio / OmniVoice / Kokoro et protocole :
  [voix-comparatif.md](voix-comparatif.md).

## Mesures de l'étape 3 (10 octobre 2026)

Voix d'homme `bdl` vers `arctic-slt`, trajet complet en temps réel (`live`), comparé à la
conversion d'un seul tenant du son propre. « Faible » : voix à un dixième du niveau. « Moyen » :
voix à 0,3, souffle et ronflette à 22 dB sous la voix. « Mauvais » : voix à 0,15, bruit à 14 dB.

| Micro | Écart avant | Écart après | Fond sonore avant (sur 5) | Après |
| --- | --- | --- | --- | --- |
| Propre | 2,0 dB | 2,5 dB | 4,17 | 4,16 |
| Faible | 1,8 dB | 3,8 dB | 4,16 | 4,13 |
| Moyen | 7,0 dB | 4,5 dB | 3,36 | 4,11 |
| Mauvais | 15,0 dB | 6,4 dB | 2,41 | 3,97 |

Le micro propre ou faible perd un peu (la mise à niveau monte moins vite qu'avant) ; à revoir si
l'écoute le confirme. Avant le premier mot, le souffle amplifié 25 fois passait tel quel
(−35 dB) : c'est maintenant du silence.

Trous : la carte graphique met 32 ms par calcul quand elle enchaîne, 50 à 210 ms après un repos
de 0,3 à 5 s (`zz_lab idle`). C'était un trou au premier mot après chaque pause, une fois sur
trois environ. Depuis que le modèle tourne aussi pendant les silences : 0 trou sur 15 passages,
dont 2 avec le changement de visage en charge.

Essayé et abandonné : blocs de 8 trames au lieu de 12. Gain de 40 ms de retard seulement, et un
trou réapparaît quand la caméra tourne.

## Ce qui a été trouvé (causes, par ordre d'importance)

1. **La sortie audio de ce PC est VoiceMeeter** (`VoiceMeeter Input (VAIO)` par défaut,
   entrée par défaut `VoiceMeeter Output`). Elle réclame le son par à-coups : 480 à 1056
   échantillons d'un coup, espacés de 0,3 à 20 ms. La file du retour audio (`effects.rs`) n'a
   que 30 ms d'avance en direct et 80 ms en voix clonée, coupe net quand elle est vide, remet
   80 ms de silence, et retire le surplus d'un coup toutes les 2 s : chaque fois c'est un clic
   ou un trou. Le test `live` ne le voyait pas : il tire exactement 10 ms toutes les 10 ms.
2. **Raccords entre blocs abîmés.** Mesuré (`zz_lab edges`) : le modèle redessine exactement
   la même onde que sur l'enregistrement entier seulement à plus de ~24 trames (280 ms) du
   bord gauche et ~25 trames (290 ms) du bord droit. Ressemblance par distance au bord droit :
   0,5 à 12 trames, 0,88 à 17, 0,95 à 19, 0,99 à 22, 1,00 à 26. Aux réglages Rapide et Moyen,
   la fin de chaque bloc et son fondu tombaient à 9-19 trames du bord : un raccord dégradé
   7 fois par seconde. `best_shift` (recalage des ondes) devient inutile et risqué.
3. **Miroir.** Ajouter après la fenêtre ses 24 dernières trames jouées à l'envers améliore le
   bord droit : 0,98 dès 15 trames, 0,99 dès 19, 1,00 dès 25 (gain d'environ 90 ms de retard
   à qualité égale). 12 trames de miroir font moins bien, 40 pas mieux que 24.
4. **Taille de fenêtre.** DirectML est rapide pour la première taille vue (29 ms pour
   84 trames, 31 pour 96, 36 pour 128) et ~5 fois plus lent pour toute autre taille ensuite
   (150 ms). La taille doit donc rester constante. Sur le processeur : 180 ms pour 64 trames.
5. **Micro bruité ou faible** : le gain monte jusqu'à ×25 et le premier son entendu fixe le
   niveau, donc du souffle peut être amplifié et converti en grésillement ; dans les pauses,
   le micro brut amplifié passe tel quel.
6. **Tes deux voix importées sont très courtes** : 8,3 s et 4,2 s (« Titeuf »). C'est trop
   peu pour décrire un timbre (20 à 30 s conseillées). L'import n'avertit pas.
7. **`own-voice.bin`** (description de ta propre voix) est apprise une fois puis gardée pour
   toujours, quel que soit le micro choisi. Si elle a été apprise sur la mauvaise entrée
   (par exemple une sortie VoiceMeeter), tout le rendu est faussé. Pas de remise à zéro.
8. **Risque de boucle** : si le son converti revient dans l'entrée choisie via VoiceMeeter,
   il est reconverti en boucle (voix robotique). Il faut pouvoir choisir la sortie audio.
9. Bonne nouvelle : OpenVoice **change bien la hauteur** vers celle de la voix cible (homme
   92 Hz → 185 Hz vers une voix de femme à 206 Hz). `MANQUE.md` dit le contraire, à corriger.

## Plan

- [x] **Étape 1 — `voice.rs`, découpage** : fenêtre fixe de 112 trames = contexte + bloc
      (12, ou 24 en économie) + suite réelle `AHEAD` (11/16/20/26 trames selon la qualité,
      fondu d'une trame compris) + miroir de 24 trames. Supprimer `best_shift`. Qualité par
      défaut : 2. En cas d'échec du modèle, sortir du silence et non la vraie voix.
      Vérifier avec `zz_lab seams` (viser < 0,5 dB d'écart dès la qualité 2).
- [x] **Étape 2 — `effects.rs`, file de lecture** (`Playout`) commune au direct et au clonage :
      avance adaptative (minimum observé sur 10 s), fondus à l'épuisement et à la reprise,
      rattrapage par variation de vitesse ≤ 1 % au lieu de couper, ré-échantillonnage propre
      (sinus cardinal) au lieu de l'interpolation linéaire. Simuler une sortie par à-coups
      dans `examples/live.rs` et viser zéro clic.
- [x] **Étape 3 — micro** : réduction de bruit (crate `nnnoiseless`, RNNoise en Rust,
      BSD) avant conversion ; mise à niveau qui ignore le bruit de fond.
- [~] **Étape 4 — descriptions de voix** (reste : avertir à l'import si moins de 10 s) : retirer les silences de l'enregistrement de
      référence (le modèle pèse surtout la fin du fichier), avertir si moins de 10 s ;
      description de la voix de l'utilisateur gardée par micro, revérifiée, avec un bouton
      pour la réapprendre.
- [x] **Étape 5 — sortie audio au choix** (`capture.rs`, liste des sorties, sélecteur).
- [ ] **Étape 6 — réglages gardés** : fichier `settings.json` côté Rust (micro, caméra,
      sortie, voix, visage, effet, qualité, économie, filtre, langue, presets), relu au
      démarrage. Aujourd'hui seuls quelques réglages sont dans le `localStorage` et ni le
      micro ni la voix choisie ne sont retenus.
- [x] **Étape 7 — voix de femme** : six références de synthèse Kokoro en 24 kHz (Apache-2.0,
      aucune personne réelle), choisies par mesure parmi quinze. OmniVoice essayé et écarté
      pour cet usage (voix conçues trop semblables, modèle non commercial).
- [x] **Étape 7 bis — voix douces** : voir ci-dessus.
- [~] **Étape 8** : fait : tests, échantillons dans `desktop/samples/voix-2026-10-11/`,
      `MANQUE.md`, `architecture.md`. Reste : `ui-preview`. `zz_lab.rs` est gardé : le
      protocole de test (`scripts/voice-protocol.mjs`) s'en sert.
- [ ] **À faire à l'oreille** : écouter les six voix et les extraits avant/après. Aucune
      mesure ne dit si une voix est naturelle.

## Pour reprendre les mesures

Fichiers d'essai dans le dossier temporaire de la session (à refaire s'il a disparu) : voix
réelles = phrases 10 à 21 de CMU ARCTIC (`bdl`, `rms`, `slt`) mises bout à bout. Micros
simulés : `zz_lab noisy <voix> <sortie> <gain> <souffle> <ronflette> [silence avant]`, avec
0.15 0.004 0.003 2 pour « mauvais » et 0.3 0.0015 0.001 2 pour « moyen ». `APP_KNOWN=<voix
propre>` fait démarrer `live` avec la voix de celui qui parle déjà connue.

```
cd desktop/src-tauri
cargo build --example zz_lab
M="$LOCALAPPDATA/com.newapp.desktop/models"
./target/debug/examples/zz_lab.exe edges "$M" "$M/voices/arctic-slt.wav" <voix.wav> 64 24 mirror
./target/debug/examples/zz_lab.exe seams "$M" "$M/voices/arctic-slt.wav" <voix.wav> <préfixe>
./target/debug/examples/zz_lab.exe time  "$M" gpu 112
```
