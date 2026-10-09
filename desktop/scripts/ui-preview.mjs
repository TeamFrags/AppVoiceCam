// Renders the interface in Microsoft Edge with the native side replaced by a stub, and saves
// one screenshot per screen in desktop/screenshots/. It checks layout only: the real commands
// are covered by `npm test` and `npm run test:integration`.
//   npm run build:ui -w desktop && node desktop/scripts/ui-preview.mjs
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, '../dist');
const shots = path.join(here, '../screenshots');
await mkdir(shots, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  const file = path.join(dist, req.url === '/' ? 'index.html' : decodeURIComponent(req.url));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(1421);

/** Installed before the page's own script: answers commands the way the Rust side would. */
function stub(scenario) {
  const listeners = {};
  let nextId = 1;
  const account = { email: 'toi@exemple.com', tier: scenario.tier ?? 'free' };
  window.__emit = (event, payload) =>
    (listeners[event] ?? []).forEach((cb) => cb({ event, payload }));
  window.__TAURI_INTERNALS__ = {
    transformCallback(callback) {
      const id = nextId++;
      window[`_${id}`] = callback;
      return id;
    },
    async invoke(command, args) {
      if (command === 'plugin:event|listen') {
        (listeners[args.event] ??= []).push(window[`_${args.handler}`]);
        return args.handler;
      }
      if (command === 'restore_session') {
        if (scenario.banned)
          throw {
            code: 'account_banned',
            details: { reason: 'Usurpation d’identité', until: null },
          };
        return scenario.signedIn ? account : null;
      }
      if (command === 'sign_in_providers') return ['google', 'discord'];
      if (command === 'sign_in') throw { code: 'invalid_credentials', details: {} };
      if (command === 'account') return account;
      if (command === 'list_devices') {
        return {
          cameras: [{ id: '0', name: 'Webcam HD' }],
          microphones: [{ id: 'Micro', name: 'Microphone (Realtek(R) Audio)' }],
        };
      }
      return null;
    },
  };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const problems = [];
async function shoot(name, scenario, act) {
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.on('pageerror', (err) => problems.push(`${name}: ${err}`));
  await page.addInitScript(stub, scenario);
  await page.goto('http://localhost:1421/');
  await page.waitForTimeout(400);
  if (act) await act(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  if (overflow > 0) problems.push(`${name}: horizontal overflow of ${overflow}px`);
  await page.screenshot({ path: path.join(shots, `${name}.png`) });
  await page.close();
}

try {
  await shoot('login', {});
  await shoot('login-error', {}, async (page) => {
    await page.fill('input[name=email]', 'toi@exemple.com');
    await page.fill('input[name=password]', 'mauvais mot de passe');
    await page.click('#submit');
    await page.waitForSelector('#error:not([hidden])');
  });
  await shoot('main', { signedIn: true, tier: 'premium' }, async (page) => {
    await page.click('#mic-toggle');
    await page.evaluate(() => window.__emit('mic-level', 0.62));
    await page.waitForTimeout(200);
  });
  await shoot('banned', { banned: true });
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length === 0 ? 'no layout or script problems' : problems.join('\n'));
process.exit(problems.length === 0 ? 0 : 1);
