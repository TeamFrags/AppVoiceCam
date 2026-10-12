// Makes again the synthetic voices kept in desktop/voices/: the same text spoken by the Kokoro
// speech synthesiser (Apache-2.0) with each of the voices chosen. No one's voice is recorded.
//
// kokoro-js is not a dependency of the project (it brings a 300 MB model). Run this from a
// folder where it is installed, with ffmpeg on the PATH:
//
//   mkdir voice-lab && cd voice-lab && npm init -y && npm install kokoro-js@1.2.1
//   node <project>/desktop/scripts/make-voices.mjs <output folder>
//
// What comes out can differ by a few samples from one machine to the next: check the new files
// by measure (cargo run --example zz_lab -- voices ...) and by ear, then put their SHA-256 in
// fetch-models.mjs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { KokoroTTS } from 'kokoro-js';

// Chosen among Kokoro's fifteen women's voices by measure, on a man's voice converted to each:
// the sound stays clean (DNSMOS 3.3 to 3.4, the same as the recorded voices), and no two of
// them are alike for the voice model (likeness 0.46 to 0.70, where the two recorded women's
// voices are at 0.88). From the lowest (159 Hz once converted) to the highest (225 Hz).
const VOICES = {
  'kokoro-sky': 'af_sky',
  'kokoro-kore': 'af_kore',
  'kokoro-river': 'af_river',
  'kokoro-emma': 'bf_emma',
  'kokoro-bella': 'af_bella',
  'kokoro-jessica': 'af_jessica',
};
// About twenty seconds: what the voice model needs to describe a voice well.
const TEXT =
  'The morning light came slowly over the hills, and she waited by the window for a while. ' +
  'Nobody had told her how long the journey would take, or why the letters had stopped. ' +
  'Still, there was bread on the table, a warm fire, and enough time to think it all through. ' +
  'She poured some tea, opened the old book again, and began to read the first page aloud.';

const out = process.argv[2];
if (!out) throw new Error('usage: node make-voices.mjs <output folder>');
mkdirSync(out, { recursive: true });
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
  dtype: 'fp32',
  device: 'cpu',
});
for (const [id, voice] of Object.entries(VOICES)) {
  const audio = await tts.generate(TEXT, { voice });
  const float = join(out, `${id}.f32.wav`);
  await audio.save(float);
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    float,
    '-c:a',
    'pcm_s16le',
    join(out, `${id}.wav`),
  ]);
  rmSync(float);
  console.log(`${id}.wav`, `${(audio.audio.length / audio.sampling_rate).toFixed(1)} s`);
}
