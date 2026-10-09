// Reports what can be read in clear inside the release executable. Run after a release build:
//   node desktop/scripts/inspect-binary.mjs
// It is a quick check of what a curious person finds with a text search, not a security audit.
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(here, '../..');
const exe = path.join(here, '../src-tauri/target/release/app-desktop.exe');
const binary = await readFile(exe);
const text = binary.toString('latin1');
const has = (needle) => text.includes(needle) || binary.includes(Buffer.from(needle, 'utf8'));
const found = (needles) => needles.filter(has);

const user = os.userInfo().username;
const report = {
  'size (MB)': (binary.length / 1048576).toFixed(1),
  // Whole paths only: a bare first name also matches unrelated data (a compression dictionary
  // contains "Alberta"), and dependency paths legitimately appear as "~\.cargo\...".
  'personal paths (home folder, project folder)': found([
    os.homedir(),
    `Users\\${user}`,
    `Users/${user}`,
    project,
  ]),
  'internal function and type names': found([
    'ApiClient',
    'exchange_oauth_code',
    'stored_refresh_token',
    'forget_refresh_token',
    'require_session',
    'wait_for_code',
    'pkce_pair',
  ]),
  'source file names (kept by Rust for crash messages)': found([
    'src\\api.rs',
    'src\\oauth.rs',
    'src\\capture.rs',
    'src\\lib.rs',
  ]),
  'interface text in clear': found(['Connecte-toi pour utiliser', 'Continuer avec', 'Aperçu']),
  'secret-looking names': found([
    'CLIENT_SECRET',
    'JWT_PRIVATE',
    'sk_live',
    'SMTP_URL',
    'BEGIN PRIVATE',
  ]),
  'command names (the interface calls them by name, so they must be present)': found([
    'restore_session',
    'sign_in_with',
    'start_camera',
  ]),
};
for (const [label, value] of Object.entries(report)) {
  console.log(
    `${label}: ${Array.isArray(value) ? (value.length ? value.join(', ') : 'none') : value}`,
  );
}
