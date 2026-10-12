# Voix de femme : audit, comparaison et protocole de test

Fait le 11 octobre 2026 sur le PC de développement (RTX 3060 12 Go, Ryzen 5 5600G, 16 Go de
mémoire). **Rien n'a été écouté** : tout ce qui suit vient de mesures. Les extraits à écouter
sont dans `desktop/samples/voix-2026-10-11/` (dossier local, non versionné).

## 1. Ce que fait réellement le logiciel

Le logiciel ne contient **aucune synthèse vocale** (texte → parole). Il contient un **changeur
de voix en direct** : le micro est redessiné avec le timbre d'un enregistrement de référence
(OpenVoice V2, `desktop/src-tauri/src/voice.rs`). Conséquences :

- la prononciation, l'accent, le rythme et l'intonation sont **ceux de la personne qui parle** :
  le modèle ne change que le timbre et la hauteur. Aucun réglage ne peut « améliorer le
  français » d'une voix convertie ; il ne peut qu'être abîmé ou préservé ;
- la qualité du son est plafonnée par le convertisseur (22 kHz), pas par la voix choisie ;
- VoiceStudio et OmniVoice, qui fabriquent de la parole à partir d'un texte, ne peuvent pas
  remplacer ce convertisseur. Ils ne peuvent servir qu'à **fabriquer des voix de référence**.

## 2. Défauts trouvés, par ordre d'importance

| Défaut | Cause | État |
| --- | --- | --- |
| Une voix douce sort abîmée, un murmure est coupé | Le modèle dessine mal ce qui est plus faible que son entraînement, et la mise à niveau ne suit qu'en plusieurs secondes. En dessous d'un vingtième du niveau habituel, le son passait sous le seuil de silence et n'était pas joué. Dans les passages doux, la voix retombait vers la hauteur de celui qui parle (92 Hz mesurés au lieu de 167) | Corrigé, voir § 5 |
| Après quelques secondes de parole sans pause, un mot doux était pris pour du bruit | Le fond sonore était estimé sur des blocs de 139 ms, plus longs que les silences entre les mots : il montait avec la parole | Corrigé : estimé sur le moment le plus calme de chaque bloc |
| Trois voix « Ultra Realistic » identiques aux voix existantes | `catalogue.rs` listait deux fois les mêmes fichiers sous d'autres noms (« Sophie » et « Chloé » étaient « Iris », « Emma » était « Clara ») | Corrigé : six vraies voix distinctes |
| Les deux voix de femme d'origine se ressemblent | Ressemblance de 0,88 entre « Iris » et « Clara » pour le modèle (1 = même voix) | Six voix ajoutées, entre 0,46 et 0,70 |
| Les tests du cœur ne compilaient plus | Appels de test restés à l'ancienne forme dans `filters.rs` ; test du catalogue cassé par les doublons ; cran de qualité « Ultra » en mode économie donnant au modèle moins de contexte que le minimum | Corrigé : 61 tests verts |

Les causes déjà traitées la veille (sortie audio par à-coups, raccords entre blocs, bruit du
micro) sont dans [VOIX-EN-COURS.md](VOIX-EN-COURS.md).

## 3. VoiceStudio, OmniVoice et Kokoro

| | VoiceStudio | OmniVoice | Kokoro |
| --- | --- | --- | --- |
| Nature | Application (Electron + serveur Python) qui enrobe des moteurs ; moteur par défaut : OmniVoice | Modèle de synthèse vocale (0,6 milliard de paramètres) | Modèle de synthèse vocale (82 millions de paramètres) |
| Change une voix en direct | Non | Non | Non |
| Licence | AGPL-3.0 : l'embarquer obligerait à publier tout le logiciel | Code Apache-2.0, **modèle CC-BY-NC** : pas d'usage commercial | Apache-2.0, code et modèle |
| Français | Selon le moteur | Oui (646 langues annoncées) | Non avec `kokoro-js` (anglais) |
| Voix de femme | Selon le moteur | Par clonage, ou « conception » par consignes (genre, âge, hauteur) | 15 voix fixes |
| Installation | Python, PyTorch, 5 Go au moins | Python, PyTorch : environ 10 Go sur disque mesurés (PyTorch 7,5 Go, modèle 3 Go) | Node seul, 300 Mo |
| Sortie | — | 24 kHz | 24 kHz |

Ce qui vient des auteurs, non vérifié ici : les « 646 langues », la vitesse annoncée
d'OmniVoice sur carte H100, la liste des autres moteurs de VoiceStudio (CosyVoice 3,
IndexTTS 2.5, GPT-SoVITS… dont aucun n'est un changeur de voix en direct).

### OmniVoice, mesuré sur ce PC

Synthèse directe en français, voix clonée, 32 étapes, demi-précision :

| Mesure | Résultat |
| --- | --- |
| Mémoire de la carte graphique | 2,2 Go |
| Vitesse | environ 2 fois plus vite que le temps réel (0,47 à 0,63 s de calcul par seconde de son) ; 133 s de parole en 63 s |
| Mots mal reconnus par Whisper | 0 sur 105 (texte long), 0 sur 420 (texte de 133 s), 0 sur 26 (texte doux), 3 sur 32 (virelangues : « loquace » dit « loquoise ») |
| Fin de phrase coupée | 1 génération sur 6 de la même phrase (« à quelle heure » tronqué, d'après Whisper) |
| Note DNSMOS (sur 5) | 3,1 à 3,4 |
| Même voix d'une génération à l'autre | ressemblance 0,93 à 0,98 |
| Clics | aucun |

En synthèse directe, OmniVoice est donc bon en français. Mais sa **conception de voix** ne
convient pas pour fabriquer des voix distinctes :

- en français, les consignes de hauteur sont ignorées (« très grave » sort à 227 Hz, « âgée,
  grave » à 240 Hz, toutes entre 227 et 401 Hz, plutôt au-dessus d'une voix de femme adulte
  courante) et trois voix sur neuf, dont le murmure, tombent sous 2,7 de DNSMOS. Les auteurs
  préviennent que ce mode n'a été entraîné qu'en chinois et en anglais ;
- en anglais, huit consignes différentes (hors murmure) donnent des voix proches : ressemblance
  de 0,53 à 0,97 entre elles, le plus souvent au-dessus de 0,75, et jusqu'à 0,97 entre deux
  consignes différentes tirées avec la même graine. Le tirage pèse autant que la consigne.

### Comme voix à imiter par le changeur

La même voix d'homme (`desktop/samples/1-voix-de-depart.wav`) convertie d'un seul tenant vers
chaque référence :

| Référence | Note DNSMOS du résultat | Hauteur obtenue | Ressemblance entre voix de la même source |
| --- | --- | --- | --- |
| CMU ARCTIC (« Iris », « Clara ») | 3,48 | 179 à 185 Hz | 0,88 |
| Kokoro, les six retenues | 3,32 à 3,42 | 159 à 225 Hz | 0,46 à 0,70 |
| OmniVoice, conception en français (hors murmure) | 2,87 à 3,30 | 212 à 334 Hz | 0,44 à 0,85 |
| OmniVoice, conception en anglais (hors murmure) | 2,93 à 3,40 | 190 à 315 Hz | 0,53 à 0,97 |

Aucune référence ne rend le son plus propre que les autres : la note est celle du
convertisseur. Ce que le choix de la référence change, c'est le timbre et la hauteur.

## 4. Choix

**Kokoro pour fabriquer les voix du catalogue.** Six voix réellement distinctes, sons propres,
licence compatible avec un produit vendu, aucune personne réelle (donc aucun accord à obtenir),
et pas de Python. OmniVoice est écarté pour cet usage : voix conçues trop semblables, et modèle
interdit d'usage commercial.

**OpenVoice V2 reste le convertisseur.** Ni VoiceStudio ni OmniVoice ne le remplacent. Un
convertisseur plus fidèle et plus rapide reste le vrai levier de réalisme (voir
[MANQUE.md](MANQUE.md), « second moteur ») : il n'a pas été essayé ici.

**Si une lecture de texte à voix haute est voulue un jour** (fonction qui n'existe pas),
OmniVoice est le meilleur candidat mesuré en français, à deux conditions : un serveur Python à
côté du logiciel, et un produit non commercial tant que la licence du modèle reste CC-BY-NC.

### Les six voix

De la plus grave à la plus aiguë. Hauteur mesurée sur le trajet en direct, depuis une voix
d'homme à 153 Hz. Je n'ai pas pu les écouter : je ne leur attribue donc aucun caractère
(« chaleureuse », « posée »…), seulement ce qui se mesure.

| Nom affiché | Fichier | Voix Kokoro | Hauteur | Note DNSMOS |
| --- | --- | --- | --- | --- |
| Sophie | `kokoro-sky` | `af_sky` | 159 Hz | 3,45 |
| Jeanne | `kokoro-kore` | `af_kore` | 160 Hz | 3,47 |
| Inès | `kokoro-river` | `af_river` | 174 Hz | 3,50 |
| Emma | `kokoro-emma` | `bf_emma` | 182 Hz | 3,51 |
| Chloé | `kokoro-bella` | `af_bella` | 210 Hz | 3,45 |
| Léa | `kokoro-jessica` | `af_jessica` | 220 Hz | 3,48 |

Une fois passées par la voix de la même personne, elles se rapprochent : ressemblance de 0,61 à
0,81 entre les six résultats, parce que le modèle garde une part de celui qui parle.

### Sept voix de plus, dont deux d'enfant (Qwen3-TTS, 11 octobre 2026)

Qwen3-TTS (Alibaba, 1,7 milliard de paramètres, Apache-2.0, code et modèles) est lui aussi une
synthèse vocale : il ne change pas une voix en direct et ne remplace pas le convertisseur. Il
sert ici, comme Kokoro, à fabriquer des voix de référence. Deux modèles : `CustomVoice` (neuf
voix fournies, dont quatre de femme) et `VoiceDesign` (une voix inventée d'après une
description, enfants compris). Mesuré sur ce PC : 4,6 Go de mémoire de la carte graphique,
environ 2,5 à 3 s de calcul par seconde de son, 4 Go sur disque par modèle.

Vingt-neuf références fabriquées (les neuf voix fournies, dix descriptions tirées deux fois),
sept gardées. Même mesure que plus haut : la voix d'homme convertie d'un seul tenant, puis sur
le trajet en direct (`live`, 32 s de parole).

| Nom affiché | Fichier | Origine | Hauteur en direct | Note DNSMOS en direct | Rien à jouer |
| --- | --- | --- | --- | --- | --- |
| Hélène | `qwen-deep` | décrite : femme, la quarantaine, grave | 167 Hz | 3,45 | 0 fois |
| Manon | `qwen-vivian` | voix fournie `Vivian` | 208 Hz | 3,43 | 0 fois |
| Margot | `qwen-warm` | décrite : femme, la trentaine, chaleureuse | 216 Hz | 3,39 | 0 fois |
| Yuna | `qwen-anna` | voix fournie `Ono_Anna` | 248 Hz | 3,38 | 0 fois |
| Camille | `qwen-bright` | décrite : femme, la vingtaine, claire | 272 Hz | 3,30 | 0 fois |
| Tom (kid) | `qwen-boy` | décrite : garçon de onze ans | 185 Hz | 3,47 | 0 fois |
| Lili (kid) | `qwen-girl` | décrite : fillette de six ans | 334 Hz | 3,18 | 0 fois |

Retard : 520 à 600 ms, comme les autres voix. Clics : 0 à 0,6 par 10 s.

Ce que ces mesures disent, et ne disent pas :

- la note est celle du convertisseur, comme pour toutes les références : ces voix ne sont ni
  plus propres ni plus « réalistes » que les six de Kokoro. Elles élargissent le choix : des
  voix plus aiguës (jusqu'à 272 Hz chez les femmes, 216 Hz au plus avant) et deux enfants ;
- ressemblance entre deux voix du catalogue : 0,77 au plus pour ces sept (Camille et Lili,
  Hélène et Jeanne). Trois des quatre voix de femme fournies par Qwen se ressemblent (0,76 à
  0,80) : deux gardées. Les descriptions « douce » et « mûre » retombaient sur des voix déjà
  prises (0,80 à 0,91) ;
- **les voix d'enfant décrites se ressemblent toutes** : fillette de six ou neuf ans, garçon de
  huit ans et adolescente donnent la même voix pour le modèle (0,83 à 0,95). Une seule est
  gardée. Le garçon de onze ans est le seul tirage distinct, et il est grave pour un enfant
  (185 Hz) ;
- la hauteur d'un enfant est atteinte (334 Hz depuis un homme à 153 Hz), mais le rythme et
  l'intonation restent ceux de l'adulte qui parle : **rien ne dit qu'on croit entendre un
  enfant**. C'est la voix la moins bien notée (3,18). À juger à l'oreille en premier.

Extraits : `desktop/samples/voix-2026-10-11-qwen/`. Refaire les voix :
`desktop/scripts/make-voices-qwen.py`. Notice : `desktop/voices/NOTICE-qwen.txt`.

## 5. Voix douces : ce qui a changé

Avant de donner un passage doux au modèle, il est remonté au niveau du reste de la parole
(jusqu'à 12 fois) ; une fois dessiné, il est redescendu d'autant. **Un mot dit doucement est
entendu aussi doucement qu'il a été dit**, mais dessiné aussi bien qu'un mot dit normalement.
Un micro faible du début à la fin, lui, reste remonté au niveau normal comme avant : ce n'est
pas une voix douce, c'est un signal faible.

La même parole dite plus fort et plus doucement tour à tour (`zz_lab soft`), comparée à la
conversion de la parole à plein niveau, baissée d'autant :

| Niveau du passage | Écart de forme avant | Après | Passage non joué avant | Après |
| --- | --- | --- | --- | --- |
| Normal | 1,44 dB | 1,48 dB | 0 % | 0 % |
| Un tiers | 3,42 dB | 1,35 dB | 1 % | 0 % |
| Un dixième | 5,00 dB | 1,53 dB | 4 % | 0 % |
| Un vingtième | (coupé) | 3,26 dB | 100 % | 2 % |

Le niveau entendu suit celui demandé à environ 1 dB près jusqu'à un dixième. Limite : en dessous d'un
douzième, le passage n'est plus remonté entièrement. Un vrai chuchotement (sans voix) n'a pas
été essayé : ce modèle ne sait pas en dessiner.

## 6. Protocole de test

`node desktop/scripts/voice-protocol.mjs <dossier de parole> <dnsmos.onnx> <dossier de sortie>`
rejoue de la parole enregistrée sur tout le trajet en direct (réduction de bruit, mise à
niveau, conversion par blocs, file de lecture avec une sortie par à-coups) et mesure le
résultat. La parole de départ est ici une voix d'homme française fabriquée par OmniVoice, la
même pour tous les textes.

| Test | Résultat (vers « Sophie », réglage par défaut) |
| --- | --- |
| 1. Phrase courte | 0 trou, DNSMOS 3,11, 0 mot perdu sur 5 |
| 2. Texte long (32 s) | 0 trou, DNSMOS 3,45, 0 mot perdu sur 105 ; vers les cinq autres voix : 3,45 à 3,51, 0 mot perdu |
| 3. Mots difficiles | 0 trou, DNSMOS 3,52, mêmes mots reconnus qu'au départ |
| 4. Questions, exclamations, pauses | 0 trou, DNSMOS 3,41, 0 mot perdu sur 29 |
| 5. Texte doux, et le même à un tiers et un dixième du niveau | 0 trou, DNSMOS 3,47, 3,49 et 3,38, mêmes mots reconnus qu'au départ |
| 6. Une minute d'affilée | 0 trou, DNSMOS 3,45 |
| 7. Même phrase trois fois | Même hauteur (166 Hz) et même note à 0,02 près : la conversion ne tire rien au hasard |
| Même voix d'un texte à l'autre | Ressemblance 0,88 à 0,98 |
| Retard | 520 à 570 ms |

Pour comparaison, la parole de départ est notée 3,24 à 3,60 : la conversion ne la dégrade pas
selon cette note.

Limites du protocole :

- DNSMOS note la propreté du son, pas le naturel ni la ressemblance avec une vraie femme.
  **Seule l'écoute peut en juger.**
- Whisper mesure si les mots restent compréhensibles, pas si l'accent est agréable.
- Le test 6 s'arrête à 60 s : l'outil de lecture des fichiers coupe là.
- Parole de départ de synthèse, propre : pas un vrai micro dans une vraie pièce.

### Refaire les mesures

```
npm run models -w desktop          # modèles et voix du catalogue
npm run test:desktop               # 61 tests du cœur
cd desktop
node scripts/voice-protocol.mjs <parole> <sig_bak_ovr.onnx> <sortie>
cd src-tauri
M="$LOCALAPPDATA/com.newapp.desktop/models"
cargo run --example zz_lab -- soft "$M" "$M/voices/kokoro-sky.wav" <parole.wav> <préfixe>
cargo run --example zz_lab -- voices "$M" <sig_bak_ovr.onnx> <parole.wav> <sortie> <référence.wav>...
```

`sig_bak_ovr.onnx` est le modèle DNSMOS de Microsoft (dépôt DNS-Challenge, dossier
`DNSMOS/DNSMOS`). Refaire les voix du catalogue : `desktop/scripts/make-voices.mjs`.

L'atelier des essais OmniVoice et Kokoro est dans `D:\newapp-voicelab` (une vingtaine de Go :
Python, PyTorch, modèles, sons). Rien n'a été installé dans le système. Il ne sert pas au
logiciel et peut être supprimé d'un bloc.
