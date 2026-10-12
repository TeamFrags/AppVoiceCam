// The test protocol of the voices: plays recorded speech through the whole live path (noise
// reduction, levelling, conversion block by block, playout) towards the voices that come with
// the application, and measures what comes out. Nothing is heard: listen to the files after.
//
//   node scripts/voice-protocol.mjs <speech folder> <dnsmos.onnx> <output folder>
//
// The speech folder holds the same person saying, as WAV files:
//   0-reference   twenty seconds of anything: how this person sounds (not converted)
//   1-courte      a short everyday sentence
//   2-longue      several paragraphs
//   3-difficile   words that are hard to say
//   4-ponctuation questions, exclamations, pauses
//   5-douce       something said softly
//   6-prolongee   two minutes or more
// The DNSMOS model is sig_bak_ovr.onnx, from https://github.com/microsoft/DNS-Challenge
// (DNSMOS/DNSMOS). It runs in real time: about eight minutes for the texts above.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [speech, dnsmos, out] = process.argv.slice(2);
if (!speech || !dnsmos || !out) {
  throw new Error('usage: voice-protocol.mjs <speech folder> <dnsmos.onnx> <output folder>');
}
const core = new URL('../src-tauri/', import.meta.url);
const config = JSON.parse(readFileSync(new URL('tauri.conf.json', core), 'utf8'));
const models =
  process.env.APP_MODELS_DIR ?? join(process.env.LOCALAPPDATA, config.identifier, 'models');
const VOICES = {
  sophie: 'kokoro-sky',
  jeanne: 'kokoro-kore',
  ines: 'kokoro-river',
  emma: 'kokoro-emma',
  chloe: 'kokoro-bella',
  lea: 'kokoro-jessica',
};
const MAIN = 'sophie';

const cargo = (args) => execFileSync('cargo', args, { cwd: core, stdio: 'inherit' });
cargo(['build', '--example', 'live', '--example', 'zz_lab']);
const example = (name) => fileURLToPath(new URL(`target/debug/examples/${name}.exe`, core));
const run = (name, args, env = {}) =>
  execFileSync(example(name), args, { encoding: 'utf8', env: { ...process.env, ...env } });

mkdirSync(out, { recursive: true });
const reference = join(speech, '0-reference.wav');
const known = existsSync(reference) ? { APP_KNOWN: reference } : {};
const made = [];
function live(input, voice, name) {
  const result = join(out, `${name}.wav`);
  const report = run(
    'live',
    [models, join(models, 'voices', `${VOICES[voice]}.wav`), input, result],
    known,
  );
  console.log(`${name}: ${report.trim().split('\n').join(' | ')}`);
  made.push(result);
}

const texts = readdirSync(speech)
  .filter((file) => /^[1-6]-.*\.wav$/.test(file))
  .map((file) => file.slice(0, -4));
// 1 to 6: every text, towards one voice.
for (const text of texts) live(join(speech, `${text}.wav`), MAIN, `${text}__${MAIN}`);
// The same text towards every other voice: are they six voices, or one?
for (const voice of Object.keys(VOICES).filter((voice) => voice !== MAIN)) {
  live(join(speech, '2-longue.wav'), voice, `2-longue__${voice}`);
}
// 7: the same sentence three times: is it the same voice each time?
for (const take of [1, 2, 3]) {
  live(join(speech, '4-ponctuation.wav'), MAIN, `7-repetition-${take}__${MAIN}`);
}
// The soft text again, as if said at a third and at a tenth of the level.
for (const level of ['0.3', '0.1']) {
  const quiet = join(out, `source-5-douce-x${level}.wav`);
  run('zz_lab', ['noisy', join(speech, '5-douce.wav'), quiet, level, '0', '0']);
  live(quiet, MAIN, `5-douce__${MAIN}-x${level}`);
}

console.log('\nSIG, BAK, OVR: DNSMOS notes from 1 to 5 (speech, background, overall).');
console.log(run('zz_lab', ['score', dnsmos, ...made]));
console.log('The same speech said louder and softer by turns:');
const main = join(models, 'voices', `${VOICES[MAIN]}.wav`);
console.log(run('zz_lab', ['soft', models, main, join(speech, '2-longue.wav'), join(out, 'soft')]));
