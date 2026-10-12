// Puts the studio voices and the two models they need into the folder the application reads
// them from. Run with: node scripts/install-studio.mjs <folder holding the .onnx files>
//
// These models are not downloaded from anywhere yet: they are made on a development PC (see
// docs/voix-studio.md) and will be served by the server like the others (phase 6).
//
// Licence: content.onnx is an export of ContentVec (MIT). pitch.onnx is an export of RMVPE
// (weights published with the RVC project, MIT). The voices are trained with Applio (MIT) from
// the RVC base models (MIT), on speech made by the Qwen3-TTS synthesiser (Apache-2.0): they
// are no one's voice.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

// The identifiers are those of src-tauri/src/studio.rs.
const FILES = ['content.onnx', 'pitch.onnx', 'studio-serena.onnx'];

const from = process.argv[2];
if (!from) throw new Error('usage: node install-studio.mjs <folder holding the .onnx files>');

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

const config = JSON.parse(
  await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
);
const dir = join(
  process.env.APP_MODELS_DIR ?? join(process.env.LOCALAPPDATA, config.identifier, 'models'),
  'studio',
);
mkdirSync(dir, { recursive: true });
console.log(`Studio folder: ${dir}`);
for (const file of FILES) {
  const source = join(from, file);
  if (!existsSync(source)) throw new Error(`${file} is not in ${from}`);
  const hash = await sha256(source);
  const target = join(dir, file);
  if (existsSync(target) && (await sha256(target)) === hash) {
    console.log(`ok       ${file}`);
    continue;
  }
  await copyFile(source, target);
  console.log(`copied   ${file}  ${hash}`);
}
