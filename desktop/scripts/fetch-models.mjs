// Downloads the face and voice models into the folder the application reads them from, and
// checks each file against a pinned SHA-256. Run with: npm run models -w desktop
//
// Licence: the two voice models are ONNX exports of OpenVoice V2 (MyShell), under the MIT
// licence: they may be shipped in a paid product.
//
// Licence: inswapper_128 and the buffalo_l models are published by InsightFace for
// non-commercial research use only. They must not be shipped in a paid product.
//
// Licence: the voices that come with the application are recordings from CMU ARCTIC (Carnegie
// Mellon University), free for any purpose, commercial included, as long as their notice is
// kept and changes are marked. The notice is written next to them, as LICENCE.txt.
//
// Licence: the other voices are in this repository, in desktop/voices/. They are no one's
// voice: the Kokoro speech synthesiser (Kokoro-82M, Apache-2.0) spoke them, each with another
// of its voices. scripts/make-voices.mjs makes them again; their notice is NOTICE.txt. The
// `qwen` ones were spoken by the Qwen3-TTS synthesiser (Apache-2.0), with voices it comes with
// or made up from a description: scripts/make-voices-qwen.py, notice NOTICE-qwen.txt.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODELS = [
  {
    file: 'det_10g.onnx',
    url: 'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/det_10g.onnx',
    sha256: '5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91',
  },
  {
    file: 'w600k_r50.onnx',
    url: 'https://huggingface.co/public-data/insightface/resolve/main/models/buffalo_l/w600k_r50.onnx',
    sha256: '4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43',
  },
  {
    file: 'inswapper_128.onnx',
    url: 'https://huggingface.co/ezioruan/inswapper_128.onnx/resolve/main/inswapper_128.onnx',
    sha256: 'e4a3f08c753cb72d04e10aa0f7dbe3deebbf39567d4ead6dce08e98aa49e16af',
  },
  {
    file: 'tone_extract.onnx',
    url: 'https://huggingface.co/Hinotsuba/OpenVoice-ONNX-v2/resolve/bfc3335585a356228f19df7b1ebf36906b731207/tone_extract.onnx',
    sha256: 'e91c2cb696e199d2519ed8b62ca6e3c8e42cb99ca13955dd6e188051486e681c',
  },
  {
    file: 'tone_color.onnx',
    url: 'https://huggingface.co/Hinotsuba/OpenVoice-ONNX-v2/resolve/bfc3335585a356228f19df7b1ebf36906b731207/tone_color.onnx',
    sha256: '896195b84b0cb87a828bb8cab06577e9c024356bc9727b1a8f4174154bc0affa',
  },
];

// The voices that come with the application: for each speaker, the first sentences of the
// corpus joined into one reference recording, named `arctic-<speaker>.wav`. The hash is that
// of the joined recording; the server has no HTTPS, so it is the only check.
const ARCTIC = 'http://festvox.org/cmu_arctic/cmu_arctic';
const VOICE_SENTENCES = 6;
const VOICES = [
  { speaker: 'slt', sha256: '278c7ec4e66db96f5faeef4045d6ed55817860270408f09713523ce8839e5572' },
  { speaker: 'clb', sha256: '7d0bca1c7e1b670d162ff34412ddeb3063130d6d6d8b333e1e0609f6361c1109' },
  { speaker: 'bdl', sha256: 'b90ba860ed641aebb6896e82f3b475c0a96499edf3d9f06dfff5fefa8ad74a05' },
  { speaker: 'rms', sha256: '9c18149363cb3433ecf24b4252550f3f05312b0047c114114406665ebb01b04f' },
  { speaker: 'jmk', sha256: '7f9734ee9b170dc4ab94d7f3ff027c36909f80f7ba74f87a1f5883e9eacc4f9c' },
  { speaker: 'awb', sha256: 'a413bc33717b992dcaf729fb77407d035d2e8e30cd88b8779c4f877e3b50f077' },
  { speaker: 'ksp', sha256: '44ead775d4731d3f4be0c35be528908553569497966f89975b4fb47d3e603bd0' },
];

// The voices kept in desktop/voices/, as `<id>.wav`. The identifiers are those of
// src-tauri/src/catalogue.rs.
const SYNTHETIC_VOICES = [
  { id: 'kokoro-sky', sha256: '253eada2cacda1064ffc65cff430dc7acc0a5855bd01f47aaa9ae783f60b6dec' },
  { id: 'kokoro-kore', sha256: '3b9d810dc0b8b0789233d86872004b744b630f23eb8c4ea41c8842a2b7a87357' },
  {
    id: 'kokoro-river',
    sha256: '88c81e1eacc571ce8964d25bcdde0e779ddd84332dd6f1b97169e64123382e7f',
  },
  { id: 'kokoro-emma', sha256: 'd42f7eea16b0a10ea36fd48527fafd5a847e8284768ee74c5019d45b3541457c' },
  {
    id: 'kokoro-bella',
    sha256: '5ddf97080d1794dc7c9d5579b136227084bdd9e823f221677caeb2095a5d805b',
  },
  {
    id: 'kokoro-jessica',
    sha256: 'a612b105e2bdf19835a6d1f9fb5d86c35d6fb49a2afa46fa51e7d2f55d14dd34',
  },
  { id: 'qwen-deep', sha256: '5c3423de00573a6ec89d824402200e996d889a904fbc18a73340d2518b868fa9' },
  {
    id: 'qwen-vivian',
    sha256: '46aad43e9a2d1480cc1a6a8ab26f62ba3e76d3914fa5bee8122a4383cf2b601e',
  },
  { id: 'qwen-warm', sha256: '376f6ee1d56358ac8f4b509081f0727d218218b120fc0f909e33940eb6b92171' },
  { id: 'qwen-anna', sha256: '48610bfb6c76534d2d76cbf750cd1d64e7e3c613091879468f18c738954ddf5b' },
  {
    id: 'qwen-bright',
    sha256: '9e249439f8796e77e3bb455a909ca39053ecac323cd99d3ab222b188b1ca738b',
  },
  { id: 'qwen-boy', sha256: 'c8b09c9d614d8e996694fdde6535cafebabf9ef4414e9f9047c3f9077aa259f0' },
  { id: 'qwen-girl', sha256: '7b2dfa9260720673ffeedc614d2e7c9052c3c2eb0f62d466b89e4fda0b81dffa' },
];

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The format and the samples of a WAV file. */
function wavParts(bytes) {
  let format;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = bytes.toString('latin1', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === 'fmt ') format = bytes.subarray(at + 8, at + 24);
    if (id === 'data' && format) return { format, samples: bytes.subarray(at + 8, at + 8 + size) };
    at += 8 + size + (size % 2);
  }
  throw new Error('not a WAV file');
}

/** WAV files of the same format, one after the other in a single file. */
function joinWav(files) {
  const parts = files.map(wavParts);
  const { format } = parts[0];
  if (parts.some((part) => !part.format.equals(format))) throw new Error('mixed WAV formats');
  const samples = Buffer.concat(parts.map((part) => part.samples));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVEfmt ', 8, 'latin1');
  header.writeUInt32LE(16, 16);
  format.copy(header, 20);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

const config = JSON.parse(
  await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
);
const dir =
  process.env.APP_MODELS_DIR ?? join(process.env.LOCALAPPDATA, config.identifier, 'models');
mkdirSync(dir, { recursive: true });
console.log(`Models folder: ${dir}`);

for (const model of MODELS) {
  const path = join(dir, model.file);
  if (existsSync(path) && (await sha256(path)) === model.sha256) {
    console.log(`ok       ${model.file}`);
    continue;
  }
  console.log(`download ${model.file}`);
  const response = await fetch(model.url);
  if (!response.ok) throw new Error(`${model.file}: HTTP ${response.status}`);
  const partial = `${path}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  const actual = await sha256(partial);
  if (actual !== model.sha256) {
    throw new Error(`${model.file}: unexpected SHA-256 ${actual}, file left at ${partial}`);
  }
  renameSync(partial, path);
  console.log(`ok       ${model.file}`);
}

const voices = join(dir, 'voices');
mkdirSync(voices, { recursive: true });
for (const voice of VOICES) {
  const file = `arctic-${voice.speaker}.wav`;
  const path = join(voices, file);
  if (existsSync(path) && (await sha256(path)) === voice.sha256) {
    console.log(`ok       ${file}`);
    continue;
  }
  console.log(`download ${file}`);
  const sentences = [];
  for (let number = 1; number <= VOICE_SENTENCES; number++) {
    const name = `arctic_a${String(number).padStart(4, '0')}.wav`;
    sentences.push(await download(`${ARCTIC}/cmu_us_${voice.speaker}_arctic/wav/${name}`));
  }
  const joined = joinWav(sentences);
  const actual = createHash('sha256').update(joined).digest('hex');
  if (actual !== voice.sha256) throw new Error(`${file}: unexpected SHA-256 ${actual}`);
  await writeFile(path, joined);
  console.log(`ok       ${file}`);
}

const kept = new URL('../voices/', import.meta.url);
for (const voice of SYNTHETIC_VOICES) {
  const file = `${voice.id}.wav`;
  const path = join(voices, file);
  if (existsSync(path) && (await sha256(path)) === voice.sha256) {
    console.log(`ok       ${file}`);
    continue;
  }
  const source = new URL(file, kept);
  const actual = await sha256(source);
  if (actual !== voice.sha256) throw new Error(`${file}: unexpected SHA-256 ${actual}`);
  await copyFile(source, path);
  console.log(`copied   ${file}`);
}
await copyFile(new URL('NOTICE.txt', kept), join(voices, 'NOTICE-kokoro.txt'));
await copyFile(new URL('NOTICE-qwen.txt', kept), join(voices, 'NOTICE-qwen.txt'));

const licence = join(voices, 'LICENCE.txt');
if (!existsSync(licence)) {
  // The notice differs a little from one speaker to the next: each wording is kept once.
  const notices = new Set();
  for (const { speaker } of VOICES) {
    const notice = await download(`${ARCTIC}/cmu_us_${speaker}_arctic/COPYING`);
    notices.add(notice.toString('utf8').trim());
  }
  const about =
    'The voices in this folder are recordings from the CMU ARCTIC databases\n' +
    '(http://www.festvox.org/cmu_arctic/), speakers ' +
    VOICES.map(({ speaker }) => speaker).join(', ') +
    '.\nModification: for each speaker, the first ' +
    VOICE_SENTENCES +
    ' sentences were joined into one file.\nTheir notices follow.';
  await writeFile(licence, [about, ...notices].join('\n\n\n') + '\n');
  console.log('ok       LICENCE.txt');
}
