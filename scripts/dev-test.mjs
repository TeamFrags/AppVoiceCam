// npm run dev:test — starts the API, the website and the desktop app already signed in as an
// administrator, with no account to create. Development only: the API refuses this mode in
// production or on a public address, and release builds of the desktop app do not contain it.
//
//   npm run dev:test              everything
//   npm run dev:test -- web       API + website
//   npm run dev:test -- desktop   API + desktop app
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const unknown = only.filter((name) => name !== 'web' && name !== 'desktop');
if (unknown.length > 0) {
  console.error(`Unknown target: ${unknown.join(', ')} (expected web and/or desktop)`);
  process.exit(1);
}
const wanted = (name) => only.length === 0 || only.includes(name);

const PORT = process.env.PORT ?? '4000';
const API = `http://127.0.0.1:${PORT}`;

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // npm runs through a shell on Windows: killing the shell alone would orphan the servers.
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill();
    }
  }
  process.exit(code);
}

// PORT is the API's. Passed on to the website, Next.js would try to listen on it as well.
const inherited = { ...process.env };
delete inherited.PORT;

function run(workspace, env = {}) {
  const child = spawn(`npm run dev -w ${workspace}`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...inherited, ...env },
  });
  children.push(child);
  child.on('exit', (code) => stop(code ?? 1));
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

run('backend', { NODE_ENV: 'development', HOST: '127.0.0.1', PORT, DEV_AUTO_LOGIN: 'true' });

let ready = false;
for (let i = 0; i < 120 && !ready; i++) {
  try {
    ready = (await fetch(`${API}/health`)).ok;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
if (!ready) {
  console.error(`The API did not answer on ${API}`);
  stop(1);
}
// Another server already on that port would answer /health too, without the admin sign-in.
const probe = await fetch(`${API}/v1/dev/login`, { method: 'POST' }).catch(() => null);
if (!probe?.ok) {
  console.error(`${API} is not the dev:test API. Stop the server already running on that port.`);
  stop(1);
}

if (wanted('web')) {
  run('web', { NEXT_PUBLIC_API_URL: `http://localhost:${PORT}`, NEXT_PUBLIC_DEV_AUTO_LOGIN: '1' });
}
if (wanted('desktop')) {
  run('desktop', { APP_API_URL: `http://localhost:${PORT}`, APP_DEV_AUTO_LOGIN: '1' });
}
