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
  // One dark pixel stands in for every portrait.
  const pixel =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  let profiles = 0;
  const profile = (name, picture = null) => ({
    id: `p${++profiles}`,
    name,
    picture,
    included: false,
  });
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: scenario.window ?? 'main' },
      currentWebview: { label: scenario.window ?? 'main' },
    },
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
          speakers: [
            { id: 'Casque', name: 'Headphones (Realtek(R) Audio)' },
            { id: 'Cable', name: 'CABLE Input (VB-Audio Virtual Cable)' },
          ],
        };
      }
      if (command === 'list_library') {
        return {
          faces: ['Nova', 'Atlas', 'Mika'].map((name) => profile(name, pixel)),
          voices: ['Narrator', 'Robot', 'Luna', 'Deep'].map((name) => profile(name)),
        };
      }
      if (command === 'clone_face') return profile(args.name, pixel);
      if (command === 'import_voice' || command === 'save_voice_sample') return profile(args.name);
      if (command === 'stop_voice_sample') return 7.4;
      if (command === 'phone_link') {
        // A checkerboard stands in for the QR code.
        const qr =
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#fff"/><path d="M1 1h2v2H1zM5 1h2v2H5zM1 5h2v2H1zM4 4h1v1H4zM5 5h2v2H5z"/></svg>';
        return { qr, seconds: 120 };
      }
      if (command === 'set_voice_effort') return 400 + args.effort * 90;
      return null;
    },
  };
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const problems = [];
async function shoot(name, scenario, act) {
  const page = await browser.newPage({
    viewport: { width: scenario.width ?? 1180, height: scenario.height ?? 760 },
  });
  page.on('pageerror', (err) => problems.push(`${name}: ${err}`));
  await page.addInitScript(stub, scenario);
  await page.goto('http://localhost:1421/');
  await page.waitForTimeout(400);
  if (act) await act(page);
  // Transitions and entrance animations are left to finish.
  await page.waitForTimeout(600);
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
  const signedIn = { signedIn: true, tier: 'premium' };
  const open = (page, view) => page.click(`.nav-item[data-view=${view}]`);
  // A one-pixel PNG stands in for a photo: the stub accepts any picture.
  const photo = {
    name: 'Photo de moi.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  };

  await shoot('face', signedIn, async (page) => {
    await open(page, 'face');
    await page.click('#face-grid .tile:nth-child(3) .orb');
    await page.waitForSelector('#face-grid .tile:nth-child(3).active');
    await page.click('#filters .chip[data-value=cat]');
  });
  await shoot('face-clone', signedIn, async (page) => {
    await open(page, 'face');
    await page.click('#face-grid .tile.add .orb');
    await page.setInputFiles('#face-file', photo);
    await page.waitForSelector('#face-picked:not([hidden])');
  });
  const android = { device: 'Android', address: '192.168.1.34' };
  await shoot('phone-code', signedIn, async (page) => {
    await open(page, 'face');
    await page.click('#phone');
    await page.waitForSelector('#phone-qr[src]');
  });
  await shoot('phone-request', signedIn, async (page) => {
    await open(page, 'face');
    await page.click('#phone');
    await page.evaluate((phone) => window.__emit('phone-request', phone), android);
    await page.waitForSelector('#phone-allow:not([hidden])');
  });
  await shoot('phone-linked', signedIn, async (page) => {
    await open(page, 'face');
    await page.click('#phone');
    await page.evaluate((phone) => window.__emit('phone-linked', phone), android);
    await page.click('#phone-close');
    await page.waitForSelector('#camera option[value=phone]:checked', { state: 'attached' });
  });
  await shoot('voice', signedIn, async (page) => {
    await open(page, 'voice');
    await page.click('#voice-grid .tile:nth-child(4) .orb');
    // The monitor starts the microphone along with it.
    await page.click('#monitor');
    await page.waitForSelector('#mic-toggle.stop');
    await page.click('#effects .chip[data-value=robot]');
    await page.fill('#effort', '2');
    await page.evaluate(() => window.__emit('mic-level', 0.62));
  });
  await shoot('voice-clone', signedIn, async (page) => {
    await open(page, 'voice');
    await page.click('#voice-grid .tile.add .orb');
    await page.click('#record');
    await page.evaluate(() => window.__emit('mic-level', 0.5));
    await page.click('#record');
    await page.fill('#voice-dialog [name=name]', 'Ma voix');
  });
  await shoot('presets', signedIn, async (page) => {
    // A preset is made of the face and the voice selected at that moment, then found again.
    await open(page, 'face');
    await page.click('#face-grid .tile:nth-child(3) .orb');
    await open(page, 'voice');
    await page.click('#voice-grid .tile:nth-child(3) .orb');
    await open(page, 'presets');
    await page.click('#preset-grid .tile.add .orb');
    await page.fill('#preset-dialog [name=name]', 'Stream');
    await page.click('#preset-dialog [data-save]');
    await page.waitForSelector('#preset-grid .tile.active');
    await page.fill('#search', 'str');
  });
  await shoot('account-menu', signedIn, async (page) => {
    await page.click('#account-button');
    await page.waitForSelector('#account-menu:not([hidden])');
  });
  await shoot('settings', signedIn, async (page) => {
    await open(page, 'settings');
    await page.click('.setting .economy-toggle');
  });
  await shoot('face-narrow', { ...signedIn, width: 960 }, (page) => open(page, 'face'));
  const floating = { window: 'pip', width: 384, height: 216 };
  await shoot('pip-idle', floating);
  await shoot('pip', floating, (page) =>
    page.evaluate(() => {
      // A plain colour stands in for a camera frame.
      const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 36 });
      const context = canvas.getContext('2d');
      context.fillStyle = '#3b6ea5';
      context.fillRect(0, 0, 64, 36);
      const jpeg = canvas.toDataURL('image/jpeg').split(',')[1];
      window.__emit('camera-frame', { jpeg, width: 64, height: 36, swapped: false });
    }),
  );
  await shoot('banned', { banned: true });
} finally {
  await browser.close();
  server.close();
}
console.log(problems.length === 0 ? 'no layout or script problems' : problems.join('\n'));
process.exit(problems.length === 0 ? 0 : 1);
