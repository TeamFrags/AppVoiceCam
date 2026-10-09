// Drives the built static site in a real browser (Microsoft Edge) against the real API.
// Run with `npm run test:e2e` from the repository root: it builds the site first.
// Uses ports 3000 and 4000 and a throwaway database in a temporary folder.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const OUT = path.join(ROOT, 'web/out');
const SHOTS = path.join(HERE, 'screenshots');
await mkdir(SHOTS, { recursive: true });
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

// Minimal static host behaving like Apache: directory index, and 404.html for unknown paths.
const site = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(OUT, pathname);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    res.end(await readFile(path.join(OUT, '404.html')));
  }
}).listen(3000);

const dataDir = await mkdtemp(path.join(tmpdir(), 'api-data-'));
const api = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: path.join(ROOT, 'backend'),
  env: { ...process.env, PORT: '4000', DEV_DATA_DIR: dataDir },
});
let apiLog = '';
api.stdout.on('data', (d) => (apiLog += d));
api.stderr.on('data', (d) => (apiLog += d));
for (let i = 0; i < 60; i++) {
  try {
    await fetch('http://localhost:4000/health');
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'fr-FR',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageViews = [];
  // Expected 401/404 responses are logged by the browser as resource errors; only real script errors count.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !m.text().startsWith('Failed to load resource') &&
      consoleErrors.push(m.text()),
  );
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on(
    'response',
    (r) => r.url().includes('/v1/analytics/pageview') && pageViews.push(r.status()),
  );
  const cookies = async () => Object.fromEntries((await context.cookies()).map((c) => [c.name, c]));

  // ── Home, banner, no tracking before a choice
  await page.goto('http://localhost:3000/');
  await page.waitForSelector('.consent');
  await page.waitForTimeout(600);
  check('home renders with the brand tagline', (await page.textContent('h1')).length > 5);
  check('consent banner is shown on first visit', await page.isVisible('.consent'));
  check(
    'no audience cookie and no page view before any choice',
    !(await cookies()).vid && pageViews.length === 0,
  );
  await page.screenshot({ path: path.join(SHOTS, 'home-desktop.png') });

  const [refuse, accept] = await page.$$('.consent .btn');
  const [a, b] = [await refuse.boundingBox(), await accept.boundingBox()];
  const styles = await page.$$eval('.consent .btn', (els) =>
    els.map((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).color),
  );
  check(
    'refuse and accept buttons have the same size and style',
    Math.abs(a.width - b.width) < 2 && a.height === b.height && styles[0] === styles[1],
  );

  // ── Refuse
  await page.click('.consent .btn:has-text("Decline")');
  await page.goto('http://localhost:3000/pricing/');
  await page.waitForTimeout(600);
  check(
    'after refusing: banner gone, no cookie, nothing sent',
    !(await page.isVisible('.consent')) && !(await cookies()).vid && pageViews.length === 0,
  );

  // ── Change of mind from the footer
  await page.click('text=Manage cookies');
  await page.click('.consent .btn:has-text("Accept")');
  await page.waitForTimeout(800);
  const vid = (await cookies()).vid;
  check(
    'after accepting: audience cookie set for about 13 months',
    !!vid &&
      (vid.expires - Date.now() / 1000) / 86400 > 390 &&
      (vid.expires - Date.now() / 1000) / 86400 < 400,
  );
  check(
    'after accepting: the current page is counted',
    pageViews.length === 1 && pageViews[0] === 204,
    `statuses=${pageViews}`,
  );
  await page.click('text=FAQ');
  await page.waitForURL('**/faq/');
  await page.waitForTimeout(600);
  check('client-side navigation is counted too', pageViews.length === 2);

  // ── Withdraw again
  await page.click('text=Manage cookies');
  await page.click('.consent .btn:has-text("Decline")');
  check('withdrawing consent deletes the audience cookie', !(await cookies()).vid);

  // ── Register, verify, login
  await page.goto('http://localhost:3000/register/');
  await page.fill('input[name=email]', 'e2e@example.com');
  await page.fill('input[name=password]', 'correct horse battery');
  await page.click('button:has-text("Create my account")');
  await page.waitForSelector('.notice.success');
  check('registration shows the "check your email" message', true);

  const link = apiLog.match(/http:\/\/localhost:3000\/verify-email\?token=[\w-]+/)?.[0];
  check('verification link was produced by the API', !!link);
  await page.goto(link.replace('/verify-email?', '/verify-email/?'));
  await page.waitForSelector('.notice');
  check(
    'email verification succeeds from the emailed link',
    await page.isVisible('.notice.success'),
    await page.textContent('.notice'),
  );

  await page.goto('http://localhost:3000/login/');
  await page.fill('input[name=email]', 'e2e@example.com');
  await page.fill('input[name=password]', 'wrong password!!');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('.notice.error');
  check(
    'wrong password shows a readable error',
    (await page.textContent('.notice.error')).includes('Incorrect'),
  );
  await page.fill('input[name=password]', 'correct horse battery');
  await page.click('button:has-text("Sign in")');
  await page.waitForURL('**/account/');
  await page.waitForSelector('text=e2e@example.com');
  check('login lands on the account page with the profile', true);
  check(
    'header switches to "My account" once signed in',
    await page.isVisible('.site-nav >> text=My account'),
  );
  check(
    'account shows plan and this device',
    (await page.isVisible('text=Free')) &&
      (await page.isVisible('text=Web browser')) &&
      (await page.isVisible('text=this device')),
  );
  await page.screenshot({ path: path.join(SHOTS, 'account-desktop.png') });

  const rt = (await cookies()).rt;
  const visibleToJs = await page.evaluate(() => document.cookie);
  check(
    'refresh cookie is HttpOnly, SameSite=Strict, scoped to /v1/auth',
    rt?.httpOnly && rt.sameSite === 'Strict' && rt.path === '/v1/auth',
  );
  check('page scripts cannot read the refresh cookie', !visibleToJs.includes('rt='));
  check(
    'nothing sensitive in localStorage',
    await page.evaluate(() =>
      Object.entries(localStorage).every(([, v]) => v.length < 80 && !/eyJ/.test(v)),
    ),
  );

  await page.reload();
  await page.waitForSelector('text=e2e@example.com');
  check('session survives a full reload (restored from the cookie)', true);

  // Two tabs restoring at once must not trip refresh-token reuse detection.
  const [t1, t2] = [await context.newPage(), await context.newPage()];
  await Promise.all([
    t1.goto('http://localhost:3000/account/'),
    t2.goto('http://localhost:3000/account/'),
  ]);
  await Promise.all([
    t1.waitForSelector('text=e2e@example.com'),
    t2.waitForSelector('text=e2e@example.com'),
  ]);
  await page.reload();
  await page.waitForSelector('text=e2e@example.com');
  check('two tabs refreshing together keep the session alive', true);
  await t1.close();
  await t2.close();

  await page.click('button:has-text("Sign out")');
  await page.waitForURL('http://localhost:3000/');
  await page.goto('http://localhost:3000/account/');
  await page.waitForURL('**/login/');
  check('after logout, the account page redirects to login', true);
  check(
    'header is back to "Sign in" after logout',
    await page.isVisible('.site-nav >> text=Sign in'),
  );

  // ── Languages: English at the root, the others under their own prefix
  await page.goto('http://localhost:3000/fr/pricing/');
  check(
    'French pages are served under /fr/ with lang="fr"',
    (await page.getAttribute('html', 'lang')) === 'fr' &&
      (await page.textContent('h1')) === 'Tarifs',
  );
  check(
    'each page lists its translations for search engines',
    (await page.$$('link[rel=alternate][hreflang]')).length >= 5,
  );
  await page.click('.lang summary');
  await page.click('.lang a[hreflang=es]');
  await page.waitForURL('**/es/pricing/');
  check(
    'the language menu opens the same page in another language',
    (await page.textContent('h1')) === 'Precios',
  );
  await page.click('.site-nav >> text=Funciones');
  await page.waitForURL('**/es/features/');
  check('links stay in the chosen language', true);
  check(
    'the root of the site is in English',
    (await (await page.goto('http://localhost:3000/')).text()).includes('<html lang="en"'),
  );

  // ── 404 and mobile layout
  const res = await page.goto('http://localhost:3000/nope/');
  check(
    'unknown address shows the 404 page',
    res.status() === 404 && (await page.isVisible('text=Page not found')),
  );

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'fr-FR',
  });
  const m = await mobile.newPage();
  for (const p of ['/', '/pricing/', '/privacy/', '/features/', '/fr/', '/de/features/']) {
    await m.goto('http://localhost:3000' + p);
    await m.waitForTimeout(300);
    const overflow = await m.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    check(`no horizontal scroll on mobile: ${p}`, overflow <= 0, `overflow=${overflow}px`);
  }
  await m.goto('http://localhost:3000/');
  await m.waitForSelector('.consent');
  await m.screenshot({ path: path.join(SHOTS, 'home-mobile.png') });
  await m.click('.consent .btn:has-text("Decline")');
  await m.goto('http://localhost:3000/pricing/');
  await m.screenshot({ path: path.join(SHOTS, 'pricing-mobile.png') });

  check(
    'no browser console errors during the whole run',
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | '),
  );
} catch (err) {
  check('run completed', false, String(err).slice(0, 400));
} finally {
  await browser.close();
  api.kill();
  site.close();
  await new Promise((r) => api.on('exit', r));
  await rm(dataDir, { recursive: true, force: true });
}
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
