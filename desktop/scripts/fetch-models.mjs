// Downloads the face and voice models into the folder the application reads them from, and
// checks each file against a pinned SHA-256. Run with: npm run models -w desktop
//
// Licence: the two voice models are ONNX exports of OpenVoice V2 (MyShell), under the MIT
// licence: they may be shipped in a paid product.
//
// Licence: inswapper_128 and the buffalo_l models are published by InsightFace for
// non-commercial research use only. They must not be shipped in a paid product.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
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
