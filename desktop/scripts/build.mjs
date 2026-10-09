// Release build. Wraps `tauri build` to keep this PC's folder names out of the executable:
// Rust records the full path of every source file for its crash messages, which would
// otherwise ship the Windows user name and the project location to every customer.
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(here, '../..');

// When several prefixes match, rustc applies the last one: the most specific goes last.
const remaps = [`--remap-path-prefix=${os.homedir()}=~`, `--remap-path-prefix=${project}=app`];
// The "encoded" variable separates flags with 0x1f, so paths containing spaces stay intact.
const existing = process.env.CARGO_ENCODED_RUSTFLAGS?.split('\x1f') ?? [];

// With the signing key present this is a publishable build: the installer gets a signature
// file, and the program must know where to look for the next version.
const args = [];
if (process.env.TAURI_SIGNING_PRIVATE_KEY) {
  if (!process.env.APP_UPDATE_REPO) {
    console.error('APP_UPDATE_REPO (owner/name of the releases repository) is required.');
    process.exit(1);
  }
  args.push('--config', 'src-tauri/tauri.release.conf.json');
}

const result = spawnSync('npx', ['tauri', 'build', ...args, ...process.argv.slice(2)], {
  cwd: path.join(here, '..'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CARGO_ENCODED_RUSTFLAGS: [...existing, ...remaps].join('\x1f') },
});
process.exit(result.status ?? 1);
