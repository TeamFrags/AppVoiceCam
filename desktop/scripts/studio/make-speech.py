"""Training speech for an RVC voice: many different sentences spoken by one Qwen3-TTS voice.

    python qw_train.py <speaker> <prompts file> <out dir> [how many]

The prompts file is cmuarctic.data (CMU ARCTIC: phonetically balanced sentences from
out-of-copyright books). French sentences are added so the voice has heard French sounds too.
"""
import os
import re
import sys
import time

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

FRENCH = [
    "Le matin, la lumière glissait doucement sur les collines, et elle attendait près de la fenêtre.",
    "Personne ne lui avait dit combien de temps durerait le voyage, ni pourquoi les lettres s'étaient arrêtées.",
    "Il restait pourtant du pain sur la table, un bon feu, et bien assez de temps pour réfléchir à tout cela.",
    "Il y a des soirs où la ville semble retenir son souffle, quand les rues se vident peu à peu.",
    "Les vitrines s'éteignent une à une, et l'on n'entend plus que le bruit lointain d'un tramway.",
    "C'est à cette heure-là qu'elle aimait marcher, sans but précis, pour sentir l'air frais sur son visage.",
    "Un chasseur sachant chasser doit savoir chasser sans son chien, même sous la pluie.",
    "Attends, tu es sérieuse ? Non, vraiment, c'est incroyable, je n'en reviens pas !",
    "Bonjour à tous, j'espère que vous allez bien, on se retrouve pour une nouvelle partie.",
    "Je voudrais un grand verre d'eau, une tranche de gâteau et un peu de fromage, s'il vous plaît.",
    "Le train de huit heures quarante-cinq partira avec un léger retard, voie numéro trois.",
    "Tu peux répéter la question ? Je n'ai pas bien entendu ce que tu viens de dire.",
    "Nous avons gagné la manche, mais il faut rester concentrés jusqu'à la fin du match.",
    "Quelle journée magnifique ! Le soleil brille, les oiseaux chantent, et tout le monde sourit.",
    "Franchement, je ne sais pas quoi choisir entre le bleu, le vert, le jaune et l'orange.",
    "Un oignon, huit champignons, un brin de thym et une pincée de sel suffisent pour la sauce.",
    "Regarde derrière toi, il arrive par la gauche, vite, cache-toi derrière le mur !",
    "Merci beaucoup pour votre aide, c'était vraiment gentil de votre part, à bientôt.",
    "Le vieux pêcheur rangeait ses filets pendant que les mouettes tournaient au-dessus du port.",
    "Zut, j'ai oublié mes clefs dans la voiture, il faut que je retourne les chercher.",
]

speaker, prompts, out = sys.argv[1:4]
count = int(sys.argv[4]) if len(sys.argv) > 4 else 260
english = re.findall(r'"(.+?)"', open(prompts, encoding="utf-8").read())[:count]
lines = [("English", t) for t in english] + [("French", t) for t in FRENCH]
model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice", device_map="cuda:0", dtype=torch.bfloat16
)
STYLE = "Speak in a natural, clear, lively voice, at a normal pace."
BATCH, total, started = 8, 0.0, time.time()
for at in range(0, len(lines), BATCH):
    batch = lines[at : at + BATCH]
    if os.path.exists(f"{out}/{at:04d}.wav"):  # made by an earlier run
        continue
    torch.manual_seed(100 + at)
    wavs, rate = model.generate_custom_voice(
        text=[t for _, t in batch],
        language=[l for l, _ in batch],
        speaker=[speaker] * len(batch),
        instruct=[STYLE] * len(batch),
    )
    for n, wav in enumerate(wavs):
        # A run-away generation (far too long for its sentence) is left out.
        if len(wav) / rate > 4 + 0.12 * len(batch[n][1]):
            continue
        sf.write(f"{out}/{at + n:04d}.wav", wav, rate, subtype="PCM_16")
        total += len(wav) / rate
    print(f"{at + len(batch)}/{len(lines)} sentences, {total / 60:.1f} min of speech, {time.time() - started:.0f} s", flush=True)
