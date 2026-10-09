import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/sora/latin-700.css';
import './brand/tokens.css';
import './style.css';
import { brand } from './brand/tokens';
import { chooseLanguage, fmt, LANGUAGE_NAMES, locale, t } from './i18n';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { bridge, errorMessage, isAppError, type Account } from './bridge';
import { mountPip } from './pip';
import { mountWorkspace } from './workspace';

const root = document.querySelector<HTMLDivElement>('#app')!;
document.title = brand.name;

const ACCOUNT_POLL_MS = 60_000;
let accountTimer: number | undefined;

/** Replaces the screen. Markup passed here is static; dynamic text is set through the DOM. */
function render(markup: string): void {
  window.clearInterval(accountTimer);
  // The main screen says so itself: it has its own language menu, in its settings.
  document.body.dataset.screen = 'entry';
  root.innerHTML = markup;
}

const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;

const logo = `<div class="logo-halo"><img src="/mascot.svg" alt="" /></div>`;

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

function showMain(account: Account): void {
  render('');
  const workspace = mountWorkspace(root, account, {
    sessionError: handleSessionError,
    signOut: async () => {
      workspace.leave();
      await bridge.signOut().catch(() => undefined);
      void showLogin();
    },
  });

  // The server decides: a ban, a revoked session or a new plan is picked up here.
  accountTimer = window.setInterval(async () => {
    try {
      workspace.showTier((await bridge.account()).tier);
    } catch (err) {
      if (isAppError(err) && (err.code === 'account_banned' || err.code === 'not_signed_in')) {
        workspace.leave();
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

/**
 * The window has no system title bar: this one replaces it on every screen. The window is
 * dragged by it, and double-clicking it maximizes the window as usual.
 */
function showTitleBar(): void {
  const bar = document.createElement('header');
  bar.className = 'titlebar';
  bar.dataset.tauriDragRegion = '';
  bar.innerHTML = `
    <img src="/mascot.svg" alt="" width="20" height="20" />
    <strong class="gradient-text"></strong>
    <span class="spacer"></span>
    <button data-do="minimize" aria-label="${t.minimize}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" /></svg></button>
    <button data-do="maximize" aria-label="${t.maximize}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5h7v7h-7z" /></svg></button>
    <button data-do="close" class="close" aria-label="${t.close}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>`;
  bar.querySelector('strong')!.textContent = brand.name;
  const actions: Record<string, () => Promise<void>> = {
    minimize: () => getCurrentWindow().minimize(),
    maximize: () => getCurrentWindow().toggleMaximize(),
    close: () => getCurrentWindow().close(),
  };
  for (const button of bar.querySelectorAll<HTMLButtonElement>('button')) {
    button.addEventListener('click', () => void actions[button.dataset.do!]?.());
  }
  document.body.prepend(bar);
}

/** Language menu of the screens before the main one, outside #app like the update banner. */
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
// The same page serves both windows: the floating one only shows the camera.
if (getCurrentWindow().label === 'pip') {
  mountPip(root);
} else {
  showTitleBar();
  void start();
  void watchForUpdates();
  showLanguagePicker();
}
