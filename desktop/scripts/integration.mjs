// Starts a throwaway backend, creates a verified account, then runs the Rust integration tests
// (tests/session.rs) against it. Nothing persists: the database lives in a temporary folder.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../..');
const PORT = '4010';
const API = `http://127.0.0.1:${PORT}`;
const EMAIL = 'integration@example.com';
const PASSWORD = 'correct horse battery';

const dataDir = await mkdtemp(path.join(tmpdir(), 'api-data-'));
const api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: path.join(root, 'backend'),
  env: { ...process.env, PORT, DEV_DATA_DIR: dataDir },
});
let log = '';
api.stdout.on('data', (chunk) => (log += chunk));
api.stderr.on('data', (chunk) => (log += chunk));

let status = 1;
try {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`${API}/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  const post = (url, body) =>
    fetch(API + url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  await post('/v1/auth/register', { email: EMAIL, password: PASSWORD });
  const token = log.match(/verify-email\?token=([\w-]+)/)?.[1];
  if (!token) throw new Error('no verification link in the server output');
  const verified = await post('/v1/auth/verify-email', { token });
  if (!verified.ok) throw new Error(`verification failed: ${verified.status}`);

  const result = spawnSync(
    'cargo',
    ['test', '--manifest-path', 'src-tauri/Cargo.toml', '--test', 'session', '--', '--ignored'],
    {
      cwd: path.join(here, '..'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, TEST_API_URL: API, TEST_EMAIL: EMAIL, TEST_PASSWORD: PASSWORD },
    },
  );
  status = result.status ?? 1;
} catch (err) {
  console.error(String(err));
} finally {
  api.kill();
  await new Promise((resolve) => api.on('exit', resolve));
  await rm(dataDir, { recursive: true, force: true });
}
process.exit(status);
