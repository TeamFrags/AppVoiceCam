"""Makes again the synthetic voices named qwen-*.wav kept in desktop/voices/: the same text
spoken by the Qwen3-TTS speech synthesiser (Apache-2.0), with two of the voices it comes with
and five voices it makes up from a description. No one's voice is recorded.

qwen-tts is not a dependency of the project (PyTorch and two models of 4 GB each). Run this
from a Python 3.11 or 3.12 environment where it is installed, on a graphics card (5 GB):

    pip install torch --index-url https://download.pytorch.org/whl/cu128
    pip install qwen-tts soundfile
    python <project>/desktop/scripts/make-voices-qwen.py <output folder>

What comes out can differ from one machine to the next: check the new files by measure
(cargo run --example zz_lab -- voices ...) and by ear, then put their SHA-256 in
fetch-models.mjs.
"""
import sys

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

# About twenty seconds: what the voice model needs to describe a voice well.
TEXT = (
    "The morning light came slowly over the hills, and she waited by the window for a while. "
    "Nobody had told her how long the journey would take, or why the letters had stopped. "
    "Still, there was bread on the table, a warm fire, and enough time to think it all through. "
    "She poured some tea, opened the old book again, and began to read the first page aloud."
)
CALM = "Speak in a calm, natural, even voice, at a steady pace, clearly, like a professional narrator."
# Chosen by measure among the nine voices of the synthesiser and twenty made-up ones, on a
# man's voice converted to each: the sound stays clean (DNSMOS 3.4 to 3.5, as the other voices
# of the catalogue), and no two voices of the catalogue are alike for the voice model
# (likeness under 0.8). Four of the synthesiser's own women's voices are close to each other:
# two are kept.
SPEAKERS = {"qwen-vivian": "Vivian", "qwen-anna": "Ono_Anna"}
# Each made-up voice with the draw that gave it. A child's voice is the hardest to reach: what
# was measured, from a man's voice, is 334 Hz for the girl and 184 Hz for the boy.
DESIGNS = {
    "qwen-deep": (21, "A woman in her forties. Deep, low, velvety, confident voice, slightly husky, very natural. Calm, steady pace."),
    "qwen-warm": (7, "A woman in her thirties. Warm, smooth, medium-low voice, close and reassuring, like a professional radio host. Calm, steady pace."),
    "qwen-bright": (21, "A woman in her twenties. Bright, clear, high and energetic voice, smiling, very natural. Calm, steady pace."),
    "qwen-boy": (7, "An eleven-year-old boy. Clear, bright, unbroken boy's voice, slightly lower than a small child's. He speaks calmly, at a steady pace."),
    "qwen-girl": (21, "A six-year-old little girl. Very high-pitched, small, bright and innocent child's voice. She speaks clearly and calmly, at a steady pace."),
}

if len(sys.argv) < 2:
    sys.exit("usage: python make-voices-qwen.py <output folder>")
out = sys.argv[1]


def load(name):
    return Qwen3TTSModel.from_pretrained(
        f"Qwen/Qwen3-TTS-12Hz-1.7B-{name}", device_map="cuda:0", dtype=torch.bfloat16
    )


def keep(label, wavs, rate):
    sf.write(f"{out}/{label}.wav", wavs[0], rate, subtype="PCM_16")
    print(f"{label}.wav", f"{len(wavs[0]) / rate:.1f} s")


model = load("CustomVoice")
for label, speaker in SPEAKERS.items():
    torch.manual_seed(7)
    keep(label, *model.generate_custom_voice(text=TEXT, language="English", speaker=speaker, instruct=CALM))
del model
torch.cuda.empty_cache()
model = load("VoiceDesign")
for label, (seed, instruct) in DESIGNS.items():
    torch.manual_seed(seed)
    keep(label, *model.generate_voice_design(text=TEXT, language="English", instruct=instruct))
