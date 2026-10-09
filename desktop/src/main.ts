import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/sora/latin-700.css';
import './brand/tokens.css';
import './style.css';
import { brand } from './brand/tokens';
import { chooseLanguage, fmt, LANGUAGE_NAMES, locale, t } from './i18n';
import { bridge, errorMessage, isAppError, type Account, type Device } from './bridge';

const root = document.querySelector<HTMLDivElement>('#app')!;
document.title = brand.name;

const ACCOUNT_POLL_MS = 60_000;
let accountTimer: number | undefined;

/** Replaces the screen. Markup passed here is static; dynamic text is set through the DOM. */
function render(markup: string): void {
  window.clearInterval(accountTimer);
  root.innerHTML = markup;
}

const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

const logo = `<div class="logo-halo"><img src="/mascot.svg" alt="" /></div>`;
const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
const cameraIcon = icon(
  'M4 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM16 10.5l6-3.5v10l-6-3.5',
);
const micIcon = icon(
  'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3',
);

function showLoading(): void {
  render(
    `<main class="center"><div>${logo}<span class="spinner" role="status" aria-label="${t.loading}"></span></div></main>`,
  );
}

function showBanned(details: Record<string, unknown>): void {
  render(`
    <main class="center">
      <div class="card narrow">
        ${logo}
        <h1>${t.suspendedTitle}</h1>
        <p id="ban-text"></p>
        <button class="btn ghost" id="back">${t.changeAccount}</button>
      </div>
    </main>`);
  const until = typeof details.until === 'string' ? new Date(details.until) : null;
  const reason = typeof details.reason === 'string' ? details.reason : '';
  $('#ban-text').textContent = until
    ? fmt(t.suspendedUntil, { date: until.toLocaleDateString(locale), reason })
    : fmt(t.banned, { reason });
  $('#back').addEventListener('click', async () => {
    await bridge.signOut().catch(() => undefined);
    void showLogin();
  });
}

/** Sends the user to the right screen after a failed call. Returns true if it took over. */
function handleSessionError(err: unknown): boolean {
  if (!isAppError(err)) return false;
  if (err.code === 'account_banned') {
    showBanned(err.details);
    return true;
  }
  if (err.code === 'not_signed_in') {
    void showLogin();
    return true;
  }
  return false;
}

async function showLogin(): Promise<void> {
  render(`
    <main class="center">
      <div class="card narrow">
        ${logo}
        <h1 id="title" class="gradient-text"></h1>
        <p class="muted">${t.signInPrompt}</p>
        <p class="notice error" id="error" hidden role="alert"></p>
        <div id="providers" class="stack"></div>
        <form id="login" class="stack">
          <label>${t.email}<input name="email" type="email" autocomplete="email" required /></label>
          <label>${t.password}<input name="password" type="password" autocomplete="current-password" required /></label>
          <button class="btn" id="submit">${t.signIn}</button>
        </form>
        <p class="links">
          <button class="link" id="register">${t.createAccount}</button>
          <button class="link" id="forgot">${t.forgot}</button>
        </p>
      </div>
    </main>`);
  $('#title').textContent = brand.name;
  const error = $<HTMLParagraphElement>('#error');
  const fail = (err: unknown) => {
    if (handleSessionError(err)) return;
    error.textContent = errorMessage(err);
    error.hidden = false;
  };

  $('#register').addEventListener('click', () => void bridge.openWebsite('register'));
  $('#forgot').addEventListener('click', () => void bridge.openWebsite('forgot-password'));

  $<HTMLFormElement>('#login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const submit = $<HTMLButtonElement>('#submit');
    submit.disabled = true;
    submit.classList.add('loading');
    error.hidden = true;
    try {
      showMain(await bridge.signIn(String(data.get('email')), String(data.get('password'))));
    } catch (err) {
      submit.disabled = false;
      submit.classList.remove('loading');
      fail(err);
    }
  });

  // Provider buttons appear only for the providers the server has configured.
  const labels: Record<string, string> = { google: 'Google', discord: 'Discord' };
  const providers = await bridge.providers().catch(() => [] as string[]);
  const container = root.querySelector<HTMLDivElement>('#providers');
  if (!container) return;
  for (const provider of providers) {
    const label = labels[provider];
    if (!label) continue;
    const button = document.createElement('button');
    button.className = 'btn ghost';
    button.type = 'button';
    button.textContent = fmt(t.continueWith, { provider: label });
    button.addEventListener('click', () => void signInWithProvider(provider, label));
    container.append(button);
  }
}

async function signInWithProvider(provider: string, label: string): Promise<void> {
  render(`
    <main class="center">
      <div class="card narrow">
        ${logo}
        <h1>${t.signingInTitle}</h1>
        <p class="muted" id="hint"></p>
        <button class="btn ghost" id="cancel">${t.cancel}</button>
      </div>
    </main>`);
  $('#hint').textContent = fmt(t.signingInHint, { provider: label });
  $('#cancel').addEventListener('click', () => void bridge.cancelSignIn());
  try {
    showMain(await bridge.signInWith(provider));
  } catch (err) {
    if (handleSessionError(err)) return;
    await showLogin();
    if (!(isAppError(err) && err.code === 'cancelled')) {
      const error = $<HTMLParagraphElement>('#error');
      error.textContent = errorMessage(err);
      error.hidden = false;
    }
  }
}

function fillSelect(select: HTMLSelectElement, devices: Device[], empty: string): void {
  select.replaceChildren();
  if (devices.length === 0) {
    select.append(new Option(empty, ''));
    select.disabled = true;
    return;
  }
  for (const device of devices) select.append(new Option(device.name, device.id));
  select.disabled = false;
}

function showMain(account: Account): void {
  render(`
    <header class="bar">
      <img src="/mascot.svg" alt="" width="36" height="36" />
      <strong id="name" class="gradient-text"></strong>
      <span class="spacer"></span>
      <span class="chip"><span class="avatar" id="avatar" aria-hidden="true"></span><span id="email"></span></span>
      <span class="badge" id="tier"></span>
      <button class="btn ghost small" id="logout">${t.signOut}</button>
    </header>
    <main class="workspace">
      <p class="notice" id="notice" hidden role="alert"></p>
      <section class="card">
        <div class="card-head">${cameraIcon}<h2>${t.camera}</h2><span class="status" id="camera-status"></span></div>
        <div class="row">
          <select id="camera" aria-label="${t.camera}"></select>
          <button class="btn" id="camera-toggle">${t.start}</button>
        </div>
        <div class="preview">
          <img id="frame" alt="${t.cameraPreview}" hidden />
          <span class="live-badge" id="live" hidden>${t.live}</span>
          <p class="muted" id="frame-empty">${t.previewIdle}</p>
        </div>
        <p class="muted stat" id="camera-stat">&nbsp;</p>
      </section>
      <section class="card">
        <div class="card-head">${micIcon}<h2>${t.microphone}</h2><span class="status" id="mic-status"></span></div>
        <div class="row">
          <select id="mic" aria-label="${t.microphone}"></select>
          <button class="btn" id="mic-toggle">${t.start}</button>
        </div>
        <div class="meter" role="meter" aria-label="${t.micLevel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="meter">
          <div id="meter-fill"></div>
        </div>
        <p class="muted">
          ${t.versionNote}
        </p>
      </section>
    </main>`);

  $('#name').textContent = brand.name;
  $('#email').textContent = account.email;
  $('#avatar').textContent = account.email.charAt(0);
  const tier = $('#tier');
  const showTier = (value: Account['tier']) => {
    tier.textContent = value === 'premium' ? 'Premium' : t.free;
    tier.classList.toggle('premium', value === 'premium');
  };
  showTier(account.tier);

  /** Shows a capture as running or stopped: its status label and its start/stop button. */
  const showState = (status: HTMLElement, toggle: HTMLButtonElement, on: boolean) => {
    status.textContent = on ? t.live : t.stopped;
    status.classList.toggle('on', on);
    toggle.textContent = on ? t.stop : t.start;
    toggle.classList.toggle('stop', on);
  };

  const notice = $<HTMLParagraphElement>('#notice');
  const warn = (err: unknown) => {
    if (handleSessionError(err)) return;
    notice.textContent = errorMessage(err);
    notice.hidden = false;
  };

  // ── Camera
  const cameraSelect = $<HTMLSelectElement>('#camera');
  const cameraToggle = $<HTMLButtonElement>('#camera-toggle');
  const frame = $<HTMLImageElement>('#frame');
  const frameEmpty = $('#frame-empty');
  const cameraStat = $('#camera-stat');
  let cameraOn = false;
  let frames = 0;
  let fpsSince = performance.now();

  const setCamera = (on: boolean) => {
    cameraOn = on;
    showState($('#camera-status'), cameraToggle, on);
    $('.preview').classList.toggle('on', on);
    $('#live').hidden = !on;
    cameraSelect.disabled = on || cameraSelect.options[0]?.value === '';
    if (!on) {
      frame.hidden = true;
      frameEmpty.hidden = false;
      cameraStat.innerHTML = '&nbsp;';
    }
  };
  cameraToggle.addEventListener('click', async () => {
    notice.hidden = true;
    try {
      if (cameraOn) await bridge.stopCamera();
      else await bridge.startCamera(cameraSelect.value);
      setCamera(!cameraOn);
    } catch (err) {
      warn(err);
    }
  });

  // ── Microphone
  const micSelect = $<HTMLSelectElement>('#mic');
  const micToggle = $<HTMLButtonElement>('#mic-toggle');
  const meter = $('#meter');
  const meterFill = $('#meter-fill');
  let micOn = false;

  const setMeter = (level: number) => {
    const percent = Math.round(Math.min(1, level) * 100);
    meterFill.style.width = `${percent}%`;
    meter.setAttribute('aria-valuenow', String(percent));
  };
  const setMic = (on: boolean) => {
    micOn = on;
    showState($('#mic-status'), micToggle, on);
    micSelect.disabled = on || micSelect.options[0]?.value === '';
    if (!on) setMeter(0);
  };
  micToggle.addEventListener('click', async () => {
    notice.hidden = true;
    try {
      if (micOn) await bridge.stopMicrophone();
      else await bridge.startMicrophone(micSelect.value);
      setMic(!micOn);
    } catch (err) {
      warn(err);
    }
  });

  // ── Events from the native side. Listeners are dropped when this screen goes away.
  const unlisten = [
    bridge.onCameraFrame((payload) => {
      if (!cameraOn) return;
      frame.src = `data:image/jpeg;base64,${payload.jpeg}`;
      frame.hidden = false;
      frameEmpty.hidden = true;
      frames += 1;
      const elapsed = performance.now() - fpsSince;
      if (elapsed >= 1000) {
        const fps = Math.round((frames * 1000) / elapsed);
        cameraStat.textContent = fmt(t.previewStat, {
          width: payload.width,
          height: payload.height,
          fps,
        });
        frames = 0;
        fpsSince = performance.now();
      }
    }),
    bridge.onMicLevel((level) => micOn && setMeter(level)),
    bridge.onCaptureEnded((source) => {
      if (source === 'camera') setCamera(false);
      else setMic(false);
      notice.textContent = source === 'camera' ? t.cameraEnded : t.micEnded;
      notice.hidden = false;
    }),
  ];
  const leave = () =>
    unlisten.forEach((pending) => void pending.then((off) => [off].flat().forEach((f) => f())));

  setCamera(false);
  setMic(false);

  $('#logout').addEventListener('click', async () => {
    leave();
    await bridge.signOut().catch(() => undefined);
    void showLogin();
  });

  bridge
    .listDevices()
    .then((devices) => {
      fillSelect(cameraSelect, devices.cameras, t.noCamera);
      fillSelect(micSelect, devices.microphones, t.noMicrophone);
      cameraToggle.disabled = devices.cameras.length === 0;
      micToggle.disabled = devices.microphones.length === 0;
    })
    .catch(warn);

  // The server decides: a ban, a revoked session or a new plan is picked up here.
  accountTimer = window.setInterval(async () => {
    try {
      showTier((await bridge.account()).tier);
    } catch (err) {
      if (isAppError(err) && (err.code === 'account_banned' || err.code === 'not_signed_in')) {
        leave();
        handleSessionError(err);
      }
    }
  }, ACCOUNT_POLL_MS);
}

async function start(): Promise<void> {
  showLoading();
  try {
    const account = await bridge.restoreSession();
    if (account) showMain(account);
    else await showLogin();
  } catch (err) {
    if (handleSessionError(err)) return;
    // Server unreachable at startup: the login screen explains it and lets the user retry.
    await showLogin();
    const error = $<HTMLParagraphElement>('#error');
    error.textContent = errorMessage(err);
    error.hidden = false;
  }
}

const UPDATE_POLL_MS = 6 * 3600_000;

/** Offers a newer version when there is one. The banner sits outside #app: it survives screen changes. */
async function watchForUpdates(): Promise<void> {
  // A failed check is silent: the next one will tell.
  const version = await bridge.checkUpdate().catch(() => null);
  if (!version) {
    window.setTimeout(() => void watchForUpdates(), UPDATE_POLL_MS);
    return;
  }

  const banner = document.createElement('aside');
  banner.className = 'update';
  banner.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = fmt(t.updateAvailable, { version });
  const install = document.createElement('button');
  install.className = 'btn small';
  install.textContent = t.updateInstall;
  install.addEventListener('click', async () => {
    install.disabled = true;
    text.textContent = fmt(t.updateDownloading, { version });
    try {
      await bridge.installUpdate();
    } catch (err) {
      text.textContent = errorMessage(err);
      install.disabled = false;
    }
  });
  banner.append(text, install);
  document.body.append(banner);
}

/** Language menu, outside #app like the update banner: it is there on every screen. */
function showLanguagePicker(): void {
  const picker = document.createElement('select');
  picker.className = 'language';
  picker.setAttribute('aria-label', 'Language');
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    picker.append(new Option(name, code, false, code === locale));
  }
  picker.addEventListener('change', () => chooseLanguage(picker.value));
  document.body.append(picker);
}

document.documentElement.lang = locale;
void start();
void watchForUpdates();
showLanguagePicker();
