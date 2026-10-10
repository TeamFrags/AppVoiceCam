// The screen shown once signed in: a sidebar, and one view each for presets, faces, voices
// and settings. Every view stays in the page while another is shown, so a running camera or
// microphone carries on when the user looks elsewhere.
import { chooseLanguage, fmt, LANGUAGE_NAMES, locale, t } from './i18n';
import {
  bridge,
  errorMessage,
  type Account,
  type Device,
  type Filter,
  type Phone,
  type Profile,
  type VoiceEffect,
} from './bridge';

/** A face and a voice saved under one name. Either may be missing: the original is kept. */
interface Preset {
  id: string;
  name: string;
  face: string | null;
  voice: string | null;
}
type View = 'presets' | 'face' | 'voice' | 'settings';

export interface Workspace {
  showTier(tier: Account['tier']): void;
  /** Drops what outlives the screen: native event listeners and page-wide handlers. */
  leave(): void;
}
interface Hooks {
  /** Takes over when the session is gone or the account banned. Returns true if it did. */
  sessionError(err: unknown): boolean;
  signOut(): void;
}

const PRESETS_KEY = 'presets';
const ECONOMY_KEY = 'economy';
const FILTER_KEY = 'filter';
const EFFECT_KEY = 'effect';
const EFFORT_KEY = 'voiceEffort';
const MIC_KEY = 'microphone';
const OUTPUT_KEY = 'monitorOutput';
/** The effort the native side starts with: the third of the four levels. */
const EFFORT_DEFAULT = 2;
const VOICE_MAX_BYTES = 20 * 1024 * 1024;
/** Asking twice before deleting: the second click must come within this delay. */
const REMOVE_CONFIRM_MS = 3000;
/** The camera id the native side gives the linked phone, next to those of the webcams. */
const PHONE_CAMERA = 'phone';

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
const icons = {
  presets: icon('M12 3 3 8l9 5 9-5-9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5'),
  face: icon(
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8.5 10h.01M15.5 10h.01M8.5 14.5a4.5 4.5 0 0 0 7 0',
  ),
  voice: icon('M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3'),
  camera: icon(
    'M4 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2ZM16 10.5l6-3.5v10l-6-3.5',
  ),
  settings: icon('M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4'),
  economy: icon('M5 19c0-8 5-13 14-14 0 9-5 14-14 14ZM5 19l7-7'),
  search: icon('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4'),
  plus: icon('M12 5v14M5 12h14'),
  chevron: icon('M6 9l6 6 6-6'),
  close: icon('M6 6l12 12M18 6 6 18'),
  person: icon('M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21a8 8 0 0 1 16 0'),
  signOut: icon('M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9'),
  pip: icon('M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM12 12h7v4h-7z'),
  reset: icon('M4 5v5h5M5.5 15a7 7 0 1 0 1-7.5L4 10'),
  phone: icon('M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM11 18h2'),
  headphones: icon(
    'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H6a2 2 0 0 1-2-2v-4ZM20 14h-3v6h1a2 2 0 0 0 2-2v-4Z',
  ),
};

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the value lasts until the application closes.
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1);
const portrait = (profile: Profile | undefined) =>
  profile?.picture ? `data:image/jpeg;base64,${profile.picture}` : null;
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** File name without its extension, and the extension in lower case. */
function splitName(file: File): [string, string] {
  const dot = file.name.lastIndexOf('.');
  return dot < 0 ? [file.name, ''] : [file.name.slice(0, dot), file.name.slice(dot + 1).toLowerCase()];
}

/** A colour of its own for each profile without a picture, always the same for a given one. */
function hue(key: string): number {
  let sum = 0;
  for (const char of key) sum = (sum * 31 + char.charCodeAt(0)) % 360;
  return sum;
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

/**
 * One choice among a few, as a row of chips. `names` gives the values and their labels; the
 * value kept from last time is chosen again if it is still one of them.
 */
function chips<T extends string>(
  group: HTMLElement,
  names: Record<T, string>,
  key: string,
  pick: (value: T) => void,
): void {
  const select = (value: T) => {
    for (const chip of group.querySelectorAll<HTMLElement>('.chip')) {
      chip.setAttribute('aria-checked', String(chip.dataset.value === value));
    }
    pick(value);
  };
  for (const [value, label] of Object.entries(names) as [T, string][]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.setAttribute('role', 'radio');
    chip.dataset.value = value;
    chip.textContent = label;
    chip.addEventListener('click', () => {
      store(key, value);
      select(value);
    });
    group.append(chip);
  }
  const kept = stored<string>(key, '');
  select(kept in names ? (kept as T) : (Object.keys(names)[0] as T));
}

interface TileSpec {
  name: string;
  /** Picture shown in the circle; without one, `icon` or the first letter of the name. */
  picture?: string | null;
  icon?: string;
  /** Seeds the colour of a circle that has no picture. */
  tint?: string;
  active?: boolean;
  add?: boolean;
  onPick(): void | Promise<void>;
  onRemove?(): void | Promise<void>;
}

function tile(spec: TileSpec): HTMLElement {
  const item = document.createElement('div');
  item.className = 'tile';
  item.classList.toggle('active', spec.active === true);
  item.classList.toggle('add', spec.add === true);

  const orb = document.createElement('button');
  orb.type = 'button';
  orb.className = 'orb';
  orb.title = spec.name;
  if (!spec.add) orb.setAttribute('aria-pressed', String(spec.active === true));
  if (spec.picture) {
    const picture = document.createElement('img');
    picture.src = spec.picture;
    picture.alt = '';
    orb.append(picture);
  } else if (spec.icon) {
    orb.innerHTML = spec.icon;
  } else {
    orb.textContent = spec.name.charAt(0);
    orb.style.setProperty('--hue', String(hue(spec.tint ?? spec.name)));
    orb.classList.add('tinted');
  }
  orb.addEventListener('click', async () => {
    orb.classList.add('busy');
    try {
      await spec.onPick();
    } finally {
      orb.classList.remove('busy');
    }
  });

  const label = document.createElement('span');
  label.className = 'tile-name';
  label.textContent = spec.name;
  item.append(orb, label);

  const onRemove = spec.onRemove;
  if (onRemove) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tile-remove';
    remove.innerHTML = icons.close;
    remove.setAttribute('aria-label', fmt(t.remove, { name: spec.name }));
    remove.title = fmt(t.remove, { name: spec.name });
    remove.addEventListener('click', () => {
      if (remove.classList.contains('armed')) return void onRemove();
      remove.classList.add('armed');
      window.setTimeout(() => remove.classList.remove('armed'), REMOVE_CONFIRM_MS);
    });
    item.append(remove);
  }
  return item;
}

const navItem = (view: View, glyph: string, label: string) =>
  `<button class="nav-item" data-view="${view}">${glyph}<span>${label}</span></button>`;
const economySwitch = `<input type="checkbox" role="switch" class="switch economy-toggle" aria-label="${t.economy}" />`;
const dialogActions = `
  <div class="dialog-actions">
    <button type="button" class="btn ghost" data-cancel>${t.cancel}</button>
    <button class="btn" data-save>${t.save}</button>
  </div>`;

const MARKUP = `
  <div class="shell">
    <aside class="sidebar">
      <nav class="nav">
        ${navItem('presets', icons.presets, t.presets)}
        ${navItem('face', icons.face, t.face)}
        ${navItem('voice', icons.voice, t.voice)}
      </nav>
      <span class="spacer"></span>
      <label class="economy" title="${t.economyHint}">${icons.economy}<span>${t.economy}</span>${economySwitch}</label>
      <nav class="nav">${navItem('settings', icons.settings, t.settings)}</nav>
      <div class="account">
        <button class="account-button" id="account-button" aria-haspopup="menu" aria-expanded="false">
          <span class="avatar" id="avatar" aria-hidden="true"></span>
          <span class="account-email" id="email"></span>
          ${icons.chevron}
        </button>
        <div class="menu" id="account-menu" role="menu" hidden>
          <div class="menu-head"><span class="badge tier"></span></div>
          <button role="menuitem" class="manage">${icons.person}${t.manageAccount}</button>
          <button role="menuitem" class="danger" id="logout">${icons.signOut}${t.signOut}</button>
        </div>
      </div>
    </aside>
    <main class="content">
      <label class="search" id="search-box">${icons.search}<input type="search" id="search" placeholder="${t.search}" aria-label="${t.search}" /></label>
      <p class="notice" id="notice" hidden role="alert"></p>

      <section class="view" data-view="presets">
        <h1>${t.presets}</h1>
        <div class="grid" id="preset-grid"></div>
        <p class="muted" id="preset-empty">${t.presetsEmpty}</p>
      </section>

      <section class="view split" data-view="face" hidden>
        <div>
          <h1>${t.face}</h1>
          <div class="grid" id="face-grid"></div>
        </div>
        <div class="card">
          <div class="card-head">${icons.camera}<h2>${t.camera}</h2><span class="status" id="camera-status"></span></div>
          <div class="row">
            <select id="camera" aria-label="${t.camera}"></select>
            <button class="btn" id="camera-toggle">${t.start}</button>
            <button class="btn ghost square" id="phone" aria-label="${t.phoneCamera}" aria-pressed="false" title="${t.phoneCameraHint}">${icons.phone}</button>
            <button class="btn ghost square" id="pip" aria-label="${t.pip}" title="${t.pipHint}">${icons.pip}</button>
          </div>
          <div class="preview">
            <img id="frame" alt="${t.cameraPreview}" hidden draggable="false" />
            <span class="live-badge" id="live" hidden>${t.live}</span>
            <p class="muted" id="frame-empty">${t.dropPhoto}</p>
          </div>
          <p class="muted stat" id="camera-stat">&nbsp;</p>
          <div class="options">
            <span class="options-label" id="filters-label">${t.filters}</span>
            <div class="chips" id="filters" role="radiogroup" aria-labelledby="filters-label"></div>
          </div>
          <div class="options" id="filter-intensity-container" hidden>
            <span class="options-label" id="intensity-label">${t.filterIntensity}</span>
            <input type="range" id="filter-intensity" min="1" max="10" value="5" aria-label="${t.filterIntensity}" />
          </div>
          <div class="row face-row">
            <p class="muted" id="face-hint"></p>
            <button class="btn ghost small" id="photo-try" disabled>${t.tryPhoto}</button>
            <input type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" hidden />
          </div>
        </div>
      </section>

      <section class="view split" data-view="voice" hidden>
        <div>
          <h1>${t.voice}</h1>
          <div class="grid" id="voice-grid"></div>
        </div>
        <div class="card">
          <div class="card-head">${icons.voice}<h2>${t.microphone}</h2><span class="status" id="mic-status"></span></div>
          <div class="row">
            <select id="mic" aria-label="${t.microphone}"></select>
            <button class="btn" id="mic-toggle">${t.start}</button>
          </div>
          <div class="meter" role="meter" aria-label="${t.micLevel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="meter">
            <div id="meter-fill"></div>
          </div>
          <div class="row monitor-row">
            <button class="btn ghost small" id="monitor" aria-pressed="false">${icons.headphones}${t.monitor}</button>
            <p class="muted fine">${t.monitorHint}</p>
          </div>
          <label class="output-row">
            <span class="options-label">${t.monitorOutput}</span>
            <select id="output"></select>
          </label>
          <div class="effort">
            <div class="effort-head">
              <span class="options-label" id="effort-label">${t.effort}</span>
              <strong id="effort-name"></strong>
              <button type="button" class="effort-reset" id="effort-reset" aria-label="${t.effortReset}" title="${t.effortReset}">${icons.reset}</button>
            </div>
            <input type="range" class="slider" id="effort" min="0" max="${t.effortNames.length - 1}" step="1" aria-labelledby="effort-label" />
            <p class="muted fine" id="effort-hint">&nbsp;</p>
          </div>
          <div class="row relearn-row">
            <button class="btn ghost small" id="relearn">${t.relearn}</button>
            <p class="muted fine" id="relearn-hint">${t.relearnHint}</p>
          </div>
          <div class="options">
            <span class="options-label" id="effects-label">${t.effects}</span>
            <div class="chips" id="effects" role="radiogroup" aria-labelledby="effects-label"></div>
          </div>
          <p class="muted">${t.voiceNote}</p>
        </div>
      </section>

      <section class="view" data-view="settings" hidden>
        <h1>${t.settings}</h1>
        <div class="settings">
          <div class="card setting">
            <div><h2>${t.economy}</h2><p class="muted">${t.economyHint}</p></div>
            ${economySwitch}
          </div>
          <div class="card setting">
            <div><h2>${t.language}</h2></div>
            <select id="language" aria-label="${t.language}"></select>
          </div>
          <div class="card setting">
            <div><h2>${t.account}</h2><p class="muted" id="settings-email"></p></div>
            <span class="badge tier"></span>
            <button class="btn small" id="upgrade">${t.upgrade}</button>
            <button class="btn ghost small manage">${t.manageAccount}</button>
          </div>
        </div>
      </section>

      <p class="muted" id="no-results" hidden>${t.noResults}</p>
    </main>
  </div>

  <dialog class="dialog" id="face-dialog">
    <form class="stack">
      <h2>${t.cloneFace}</h2>
      <p class="muted">${t.cloneFaceHint}</p>
      <p class="notice error" hidden role="alert"></p>
      <div class="row pick">
        <img class="pick-preview" id="face-picked" alt="" hidden />
        <button type="button" class="btn ghost" id="face-choose">${t.choosePhoto}</button>
        <input type="file" id="face-file" accept="image/jpeg,image/png,image/webp" hidden />
      </div>
      <label>${t.name}<input name="name" maxlength="40" required /></label>
      <p class="muted fine">${t.consent}</p>
      ${dialogActions}
    </form>
  </dialog>

  <dialog class="dialog" id="voice-dialog">
    <form class="stack">
      <h2>${t.cloneVoice}</h2>
      <p class="muted">${t.cloneVoiceHint}</p>
      <p class="notice error" hidden role="alert"></p>
      <div class="row pick">
        <button type="button" class="btn ghost" id="record">${t.record}</button>
        <button type="button" class="btn ghost" id="voice-import">${t.importAudio}</button>
        <input type="file" id="voice-file" accept=".wav,.mp3,.flac,.ogg,.m4a" hidden />
      </div>
      <div class="meter"><div id="sample-fill"></div></div>
      <p class="muted fine" id="sample-state">&nbsp;</p>
      <label>${t.name}<input name="name" maxlength="40" required /></label>
      <p class="muted fine">${t.consent}</p>
      ${dialogActions}
    </form>
  </dialog>

  <dialog class="dialog" id="phone-dialog">
    <div class="stack">
      <h2>${t.phoneCamera}</h2>
      <p class="notice error" hidden role="alert"></p>
      <div data-step="code">
        <p class="muted">${t.phoneHint}</p>
        <img class="qr" id="phone-qr" alt="${t.phoneQr}" />
        <p class="muted fine">${t.phoneWarning}</p>
      </div>
      <div data-step="request">
        <p id="phone-request"></p>
        <p class="muted fine">${t.phoneRequestHint}</p>
      </div>
      <div data-step="linked"><p id="phone-linked"></p></div>
      <div data-step="idle"><p class="muted" id="phone-idle"></p></div>
      <div class="dialog-actions">
        <button type="button" class="btn ghost" id="phone-close">${t.close}</button>
        <button type="button" class="btn ghost" id="phone-refuse">${t.refuse}</button>
        <button type="button" class="btn" id="phone-allow">${t.allow}</button>
        <button type="button" class="btn" id="phone-new">${t.phoneNewCode}</button>
        <button type="button" class="btn stop" id="phone-unlink">${t.disconnect}</button>
      </div>
    </div>
  </dialog>

  <dialog class="dialog" id="preset-dialog">
    <form class="stack">
      <h2>${t.newPreset}</h2>
      <p class="muted">${t.presetHint}</p>
      <label>${t.name}<input name="name" maxlength="40" required /></label>
      ${dialogActions}
    </form>
  </dialog>`;

export function mountWorkspace(root: HTMLElement, account: Account, hooks: Hooks): Workspace {
  root.innerHTML = MARKUP;
  document.body.dataset.screen = 'main';
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement>(selector: string) => root.querySelectorAll<T>(selector);
  /** Page-wide handlers end with the screen. */
  const gone = new AbortController();

  const notice = $<HTMLParagraphElement>('#notice');
  const warn = (err: unknown) => {
    if (hooks.sessionError(err)) return;
    notice.textContent = errorMessage(err);
    notice.hidden = false;
  };

  // ── Account
  $('#email').textContent = account.email;
  $('#settings-email').textContent = account.email;
  $('#avatar').textContent = account.email.charAt(0);
  const showTier = (tier: Account['tier']) => {
    for (const badge of all('.tier')) {
      badge.textContent = tier === 'premium' ? 'Premium' : t.free;
      badge.classList.toggle('premium', tier === 'premium');
    }
    $('#upgrade').hidden = tier === 'premium';
  };
  showTier(account.tier);

  const accountButton = $<HTMLButtonElement>('#account-button');
  const accountMenu = $('#account-menu');
  const showMenu = (open: boolean) => {
    accountMenu.hidden = !open;
    accountButton.setAttribute('aria-expanded', String(open));
  };
  accountButton.addEventListener('click', () => showMenu(accountMenu.hidden));
  document.addEventListener(
    'click',
    (event) => {
      if (!(event.target as Element).closest('.account')) showMenu(false);
    },
    { signal: gone.signal },
  );
  document.addEventListener('keydown', (event) => event.key === 'Escape' && showMenu(false), {
    signal: gone.signal,
  });
  for (const manage of all('.manage')) {
    manage.addEventListener('click', () => {
      showMenu(false);
      bridge.openWebsite('account').catch(warn);
    });
  }
  $('#upgrade').addEventListener('click', () => bridge.openWebsite('pricing').catch(warn));
  $('#logout').addEventListener('click', () => hooks.signOut());

  // ── Views
  const search = $<HTMLInputElement>('#search');
  const show = (view: View) => {
    for (const section of all('.view')) section.hidden = section.dataset.view !== view;
    for (const item of all('.nav-item')) {
      if (item.dataset.view === view) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
    $('#search-box').hidden = view === 'settings';
    notice.hidden = true;
    redraw();
  };
  for (const item of all('.nav-item')) {
    item.addEventListener('click', () => show(item.dataset.view as View));
  }

  // ── Settings
  // How much delay is spent on a cleaner cloned voice. The native side answers with the delay.
  const effort = $<HTMLInputElement>('#effort');
  const setEffort = async (level: number) => {
    effort.value = String(level);
    effort.style.setProperty('--fill', `${(level / Number(effort.max)) * 100}%`);
    effort.setAttribute('aria-valuetext', t.effortNames[level] ?? '');
    $('#effort-name').textContent = t.effortNames[level] ?? '';
    $('#effort-reset').hidden = level === EFFORT_DEFAULT;
    store(EFFORT_KEY, level);
    try {
      $('#effort-hint').textContent = fmt(t.effortHint, { ms: await bridge.setVoiceEffort(level) });
    } catch (err) {
      warn(err);
    }
  };
  effort.addEventListener('input', () => void setEffort(Number(effort.value)));
  $('#effort-reset').addEventListener('click', () => void setEffort(EFFORT_DEFAULT));

  const setEconomy = (on: boolean) => {
    for (const toggle of all<HTMLInputElement>('.economy-toggle')) toggle.checked = on;
    store(ECONOMY_KEY, on);
    bridge
      .setEconomy(on)
      // Economy mode lengthens the delay of the cloned voice: the hint follows.
      .then(() => setEffort(Number(effort.value)))
      .catch(warn);
  };
  for (const toggle of all<HTMLInputElement>('.economy-toggle')) {
    toggle.addEventListener('change', () => setEconomy(toggle.checked));
  }
  const language = $<HTMLSelectElement>('#language');
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    language.append(new Option(name, code, false, code === locale));
  }
  language.addEventListener('change', () => chooseLanguage(language.value));

  // ── Library: faces, voices and presets
  let faces: Profile[] = [];
  let voices: Profile[] = [];
  let presets = stored<Preset[]>(PRESETS_KEY, []);
  let activeFace: string | null = null;
  let activeVoice: string | null = null;

  const photoTry = $<HTMLButtonElement>('#photo-try');
  let cameraOn = false;
  let currentPhotoDataUrl: string | null = null;
  let updateTestPhoto = async (): Promise<void> => {};

  const syncFace = () => {
    // A still photo can be tested whenever the camera is off, even before a face is picked.
    photoTry.disabled = cameraOn;
    $('#face-hint').textContent = activeFace === null ? t.faceIdle : t.faceReady;
  };

  const selectFace = async (id: string | null) => {
    notice.hidden = true;
    try {
      if (id === null) await bridge.clearFace();
      else await bridge.useFace(id);
      activeFace = id;
    } catch (err) {
      warn(err);
    }
    syncFace();
    redraw();
    if (currentPhotoDataUrl && !cameraOn) {
      void updateTestPhoto();
    }
  };
  const selectVoice = async (id: string | null) => {
    notice.hidden = true;
    try {
      if (id === null) await bridge.clearVoice();
      else await bridge.useVoice(id);
      activeVoice = id;
    } catch (err) {
      warn(err);
    }
    redraw();
  };
  const known = (profiles: Profile[], id: string | null) =>
    profiles.some((profile) => profile.id === id) ? id : null;

  const removeProfile = async (kind: 'face' | 'voice', id: string) => {
    try {
      await bridge.removeProfile(kind, id);
    } catch (err) {
      return warn(err);
    }
    if (kind === 'face') {
      faces = faces.filter((face) => face.id !== id);
      if (activeFace === id) await selectFace(null);
    } else {
      voices = voices.filter((voice) => voice.id !== id);
      if (activeVoice === id) await selectVoice(null);
    }
    // Presets keep their name and their other half.
    presets = presets.map((preset) => ({
      ...preset,
      face: known(faces, preset.face),
      voice: known(voices, preset.voice),
    }));
    store(PRESETS_KEY, presets);
    redraw();
  };

  function redraw(): void {
    const query = search.value.trim().toLowerCase();
    const draw = (grid: HTMLElement, specs: TileSpec[]) => {
      const shown = specs.filter((spec) => spec.name.toLowerCase().includes(query));
      grid.replaceChildren(...shown.map(tile));
      return shown.length;
    };

    const presetCount = draw($('#preset-grid'), [
      { name: t.newPreset, icon: icons.plus, add: true, onPick: () => openDialog(presetDialog) },
      ...presets.map((preset) => ({
        name: preset.name,
        picture: portrait(faces.find((face) => face.id === preset.face)),
        tint: preset.id,
        active: preset.face === activeFace && preset.voice === activeVoice,
        onPick: async () => {
          await selectFace(known(faces, preset.face));
          await selectVoice(known(voices, preset.voice));
        },
        onRemove: () => {
          presets = presets.filter((other) => other.id !== preset.id);
          store(PRESETS_KEY, presets);
          redraw();
        },
      })),
    ]);
    const faceCount = draw($('#face-grid'), [
      { name: t.cloneFace, icon: icons.plus, add: true, onPick: () => openDialog(faceDialog) },
      {
        name: t.original,
        icon: icons.person,
        active: activeFace === null,
        onPick: () => selectFace(null),
      },
      ...faces.map((face) => ({
        name: face.name,
        picture: portrait(face),
        tint: face.id,
        active: face.id === activeFace,
        onPick: () => selectFace(face.id),
        onRemove: () => removeProfile('face', face.id),
      })),
    ]);
    const voiceCount = draw($('#voice-grid'), [
      { name: t.cloneVoice, icon: icons.plus, add: true, onPick: () => openDialog(voiceDialog) },
      {
        name: t.original,
        icon: icons.voice,
        active: activeVoice === null,
        onPick: () => selectVoice(null),
      },
      ...voices.map((voice) => ({
        name: voice.name,
        tint: voice.id,
        active: voice.id === activeVoice,
        onPick: () => selectVoice(voice.id),
        onRemove: voice.included ? undefined : () => removeProfile('voice', voice.id),
      })),
    ]);

    $('#preset-empty').hidden = presets.length > 0 || query !== '';
    const counts: Record<string, number> = {
      presets: presetCount,
      face: faceCount,
      voice: voiceCount,
    };
    const current = root.querySelector<HTMLElement>('.view:not([hidden])')?.dataset.view ?? '';
    $('#no-results').hidden = (counts[current] ?? 1) > 0;
  }
  search.addEventListener('input', redraw);

  // ── Dialogs
  const faceDialog = $<HTMLDialogElement>('#face-dialog');
  const voiceDialog = $<HTMLDialogElement>('#voice-dialog');
  const presetDialog = $<HTMLDialogElement>('#preset-dialog');

  function openDialog(dialog: HTMLDialogElement): void {
    dialog.querySelector('form')!.reset();
    const error = dialog.querySelector<HTMLElement>('.notice');
    if (error) error.hidden = true;
    dialog.showModal();
  }
  /** Runs `save` with the name typed in the dialog, which closes unless it fails. */
  const onSave = (dialog: HTMLDialogElement, save: (name: string) => Promise<void> | void) => {
    const form = dialog.querySelector('form')!;
    const button = dialog.querySelector<HTMLButtonElement>('[data-save]')!;
    const error = dialog.querySelector<HTMLElement>('.notice');
    dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (error) error.hidden = true;
      button.classList.add('loading');
      button.disabled = true;
      try {
        await save(String(new FormData(form).get('name')));
        dialog.close();
        redraw();
      } catch (err) {
        if (hooks.sessionError(err)) return dialog.close();
        if (error) {
          error.textContent = errorMessage(err);
          error.hidden = false;
        }
      } finally {
        button.classList.remove('loading');
        button.disabled = false;
      }
    });
  };
  const nameOf = (dialog: HTMLDialogElement) => dialog.querySelector<HTMLInputElement>('[name=name]')!;

  // Clone a face: a photo and a name.
  const facePicked = $<HTMLImageElement>('#face-picked');
  const faceFile = $<HTMLInputElement>('#face-file');
  let facePicture: string | null = null;
  $('#face-choose').addEventListener('click', () => faceFile.click());
  faceFile.addEventListener('change', async () => {
    const file = faceFile.files?.[0];
    // Cleared so that choosing the same file again is still a change.
    faceFile.value = '';
    if (!file) return;
    facePicture = await readAsDataUrl(file);
    facePicked.src = facePicture;
    facePicked.hidden = false;
    if (!nameOf(faceDialog).value) nameOf(faceDialog).value = splitName(file)[0].slice(0, 40);
  });
  faceDialog.addEventListener('close', () => {
    facePicture = null;
    facePicked.hidden = true;
  });
  onSave(faceDialog, async (name) => {
    if (facePicture === null) throw { code: 'invalid_image', details: {} };
    const face = await bridge.cloneFace(name, base64(facePicture));
    faces.push(face);
    await selectFace(face.id);
  });

  // Clone a voice: a recording made here or an audio file, and a name.
  const record = $<HTMLButtonElement>('#record');
  const voiceFile = $<HTMLInputElement>('#voice-file');
  const sampleState = $('#sample-state');
  const sampleFill = $('#sample-fill');
  /** The reference recording waiting to be saved: held by the native side, or a file. */
  let sample: 'recorded' | { extension: string; audio: string } | null = null;
  let recording = false;
  let recordTimer: number | undefined;

  const showRecording = (on: boolean) => {
    recording = on;
    record.textContent = on ? t.stop : t.record;
    record.classList.toggle('stop', on);
    window.clearInterval(recordTimer);
    if (!on) sampleFill.style.width = '0';
  };
  const voiceNotice = (text: string) => {
    const error = voiceDialog.querySelector<HTMLElement>('.notice')!;
    error.textContent = text;
    error.hidden = false;
  };
  const voiceError = (err: unknown) => {
    if (hooks.sessionError(err)) return voiceDialog.close();
    voiceNotice(errorMessage(err));
  };
  record.addEventListener('click', async () => {
    try {
      if (recording) {
        showRecording(false);
        const seconds = await bridge.stopVoiceSample();
        sample = 'recorded';
        sampleState.textContent = fmt(t.sampleReady, { source: clock(seconds) });
        return;
      }
      // The recording takes the microphone over from the level meter of the Voice view.
      setMic(false);
      await bridge.startVoiceSample(micSelect.value);
      sample = null;
      showRecording(true);
      const since = performance.now();
      sampleState.textContent = clock(0);
      recordTimer = window.setInterval(() => {
        sampleState.textContent = clock((performance.now() - since) / 1000);
      }, 250);
    } catch (err) {
      showRecording(false);
      voiceError(err);
    }
  });
  $('#voice-import').addEventListener('click', () => voiceFile.click());
  voiceFile.addEventListener('change', async () => {
    const file = voiceFile.files?.[0];
    voiceFile.value = '';
    if (!file) return;
    if (file.size > VOICE_MAX_BYTES) return voiceError({ code: 'invalid_audio', details: {} });
    if (recording) showRecording(false);
    await bridge.discardVoiceSample().catch(() => undefined);
    const [stem, extension] = splitName(file);
    sample = { extension, audio: base64(await readAsDataUrl(file)) };
    sampleState.textContent = fmt(t.sampleReady, { source: file.name });
    if (!nameOf(voiceDialog).value) nameOf(voiceDialog).value = stem.slice(0, 40);
  });
  voiceDialog.addEventListener('close', () => {
    showRecording(false);
    sample = null;
    sampleState.innerHTML = '&nbsp;';
    void bridge.discardVoiceSample().catch(() => undefined);
  });
  onSave(voiceDialog, async (name) => {
    if (recording || sample === null) throw { code: 'sample_missing', details: {} };
    const voice =
      sample === 'recorded'
        ? await bridge.saveVoiceSample(name)
        : await bridge.importVoice(name, sample.extension, sample.audio);
    voices.push(voice);
    await selectVoice(voice.id);
  });

  onSave(presetDialog, (name) => {
    presets.push({ id: crypto.randomUUID(), name: name.trim(), face: activeFace, voice: activeVoice });
    store(PRESETS_KEY, presets);
  });

  /** Shows a capture as running or stopped: its status label and its start/stop button. */
  const showState = (status: HTMLElement, toggle: HTMLButtonElement, on: boolean) => {
    status.textContent = on ? t.live : t.stopped;
    status.classList.toggle('on', on);
    toggle.textContent = on ? t.stop : t.start;
    toggle.classList.toggle('stop', on);
  };

  // ── Camera
  const cameraSelect = $<HTMLSelectElement>('#camera');
  const cameraToggle = $<HTMLButtonElement>('#camera-toggle');
  const frame = $<HTMLImageElement>('#frame');
  const frameEmpty = $('#frame-empty');
  const cameraStat = $('#camera-stat');
  let frames = 0;
  let fpsSince = performance.now();

  const setCamera = (on: boolean) => {
    cameraOn = on;
    showState($('#camera-status'), cameraToggle, on);
    $('.preview').classList.toggle('on', on);
    $('#live').hidden = !on;
    cameraSelect.disabled = on || cameraSelect.options[0]?.value === '';
    syncFace();
    if (!on) {
      if (currentPhotoDataUrl) {
        void updateTestPhoto();
      } else {
        frame.hidden = true;
        frameEmpty.hidden = false;
      }
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

  // A phone as the camera. It scans a QR code, then waits: nothing comes in until the request
  // is allowed here. Once linked it is one more camera in the list.
  const phoneDialog = $<HTMLDialogElement>('#phone-dialog');
  const phoneNotice = phoneDialog.querySelector<HTMLElement>('.notice')!;
  type PhoneStep = 'code' | 'request' | 'linked' | 'idle';
  let phoneStep: PhoneStep = 'idle';
  let phone: Phone | null = null;
  let webcams: Device[] = [];
  const phoneName = (from: Phone) => `${from.device || t.phone} (${from.address})`;

  const fillCameras = () => {
    const kept = cameraSelect.value;
    const cameras = phone
      ? [...webcams, { id: PHONE_CAMERA, name: t.phoneCamera }]
      : webcams;
    fillSelect(cameraSelect, cameras, t.noCamera);
    // A phone that has just been linked is what the user wants to see, unless a camera runs.
    const wanted = phone && !cameraOn ? PHONE_CAMERA : kept;
    if (cameras.some((camera) => camera.id === wanted)) cameraSelect.value = wanted;
    cameraToggle.disabled = cameras.length === 0;
    if (cameraOn) cameraSelect.disabled = true;
  };
  const showPhoneStep = (step: PhoneStep) => {
    phoneStep = step;
    for (const part of phoneDialog.querySelectorAll<HTMLElement>('[data-step]')) {
      part.hidden = part.dataset.step !== step;
    }
    $('#phone-close').hidden = step === 'request';
    $('#phone-refuse').hidden = step !== 'request';
    $('#phone-allow').hidden = step !== 'request';
    $('#phone-new').hidden = step !== 'idle';
    $('#phone-unlink').hidden = step !== 'linked';
  };
  const setPhone = (linked: Phone | null) => {
    phone = linked;
    $('#phone').setAttribute('aria-pressed', String(linked !== null));
    if (linked) $('#phone-linked').textContent = fmt(t.phoneLinked, { phone: phoneName(linked) });
    fillCameras();
  };
  const phoneFailed = (err: unknown) => {
    if (hooks.sessionError(err)) return phoneDialog.close();
    phoneNotice.textContent = errorMessage(err);
    phoneNotice.hidden = false;
  };
  const showPhoneCode = async () => {
    phoneNotice.hidden = true;
    $('#phone-idle').textContent = '';
    try {
      const offer = await bridge.phoneLink();
      $<HTMLImageElement>('#phone-qr').src = `data:image/svg+xml,${encodeURIComponent(offer.qr)}`;
      showPhoneStep('code');
    } catch (err) {
      showPhoneStep('idle');
      phoneFailed(err);
    }
  };
  $('#phone').addEventListener('click', () => {
    phoneDialog.showModal();
    if (phone) showPhoneStep('linked');
    else if (phoneStep === 'idle') void showPhoneCode();
  });
  $('#phone-new').addEventListener('click', () => void showPhoneCode());
  $('#phone-close').addEventListener('click', () => phoneDialog.close());
  $('#phone-allow').addEventListener('click', () => bridge.phoneAnswer(true).catch(phoneFailed));
  $('#phone-refuse').addEventListener('click', () => phoneDialog.close());
  $('#phone-unlink').addEventListener('click', () => {
    bridge.phoneUnlink().catch(warn);
    phoneDialog.close();
  });
  // Closed with a code still on screen, or a request unanswered: the code is withdrawn, which
  // refuses the request. A phone already linked stays.
  phoneDialog.addEventListener('close', () => {
    if (phoneStep === 'code' || phoneStep === 'request') bridge.phoneUnlink().catch(warn);
  });
  showPhoneStep('idle');

  $('#pip').addEventListener('click', () => {
    notice.hidden = true;
    bridge.togglePip().catch(warn);
  });
  const filterIntensityContainer = $<HTMLDivElement>('#filter-intensity-container');
  const filterIntensity = $<HTMLInputElement>('#filter-intensity');
  
  chips<Filter>($('#filters'), t.filterNames, FILTER_KEY, (filter) => {
    bridge.setFilter(filter).catch(warn);
    if (filter === 'blurface') {
      filterIntensityContainer.hidden = false;
    } else {
      filterIntensityContainer.hidden = true;
    }
    if (currentPhotoDataUrl && !cameraOn) {
      void updateTestPhoto();
    }
  });

  filterIntensity.addEventListener('input', () => {
    bridge.setFilterIntensity(Number(filterIntensity.value)).catch(warn);
    if (currentPhotoDataUrl && !cameraOn) {
      void updateTestPhoto();
    }
  });

  // Try the chosen face / filter on a still photo, without a camera.
  const preview = $<HTMLDivElement>('.preview');
  updateTestPhoto = async () => {
    if (!currentPhotoDataUrl || cameraOn) return;
    photoTry.classList.add('loading');
    try {
      const swapped = await bridge.previewPhoto(base64(currentPhotoDataUrl));
      frame.src = `data:image/jpeg;base64,${swapped}`;
      frame.hidden = false;
      frameEmpty.hidden = true;
    } catch (err) {
      warn(err);
    } finally {
      photoTry.classList.remove('loading');
    }
  };

  const loadTestPhoto = async (file: File) => {
    notice.hidden = true;
    try {
      currentPhotoDataUrl = await readAsDataUrl(file);
      await updateTestPhoto();
    } catch (err) {
      warn(err);
    }
  };

  preview.addEventListener('dragover', (e) => {
    e.preventDefault();
    preview.classList.add('drag-over');
  });
  preview.addEventListener('dragleave', () => {
    preview.classList.remove('drag-over');
  });
  preview.addEventListener('drop', async (e) => {
    e.preventDefault();
    preview.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await loadTestPhoto(file);
    }
  });

  const photoFile = $<HTMLInputElement>('#photo-file');
  photoTry.addEventListener('click', () => photoFile.click());
  photoFile.addEventListener('change', async () => {
    const file = photoFile.files?.[0];
    photoFile.value = '';
    if (file) await loadTestPhoto(file);
  });

  // Drag to reposition the preview
  let isDragging = false;
  let dragX = 0, dragY = 0;
  let bgPosX = 50, bgPosY = 50;

  const startDrag = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    const touch = 'touches' in e ? e.touches[0] : null;
    dragX = touch ? touch.clientX : (e as MouseEvent).clientX;
    dragY = touch ? touch.clientY : (e as MouseEvent).clientY;
  };
  const moveDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const touch = 'touches' in e ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : (e as MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (e as MouseEvent).clientY;
    
    bgPosX -= ((clientX - dragX) / frame.clientWidth) * 100;
    bgPosY -= ((clientY - dragY) / frame.clientHeight) * 100;
    
    bgPosX = Math.max(0, Math.min(100, bgPosX));
    bgPosY = Math.max(0, Math.min(100, bgPosY));
    
    frame.style.objectPosition = `${bgPosX}% ${bgPosY}%`;
    
    dragX = clientX;
    dragY = clientY;
  };
  const endDrag = () => { isDragging = false; };

  frame.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag(e); });
  frame.addEventListener('touchstart', startDrag, { passive: true });
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('touchmove', moveDrag, { passive: true });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);

  // ── Microphone
  const micSelect = $<HTMLSelectElement>('#mic');
  const micToggle = $<HTMLButtonElement>('#mic-toggle');
  const meter = $('#meter');
  const meterFill = $('#meter-fill');
  const monitorToggle = $<HTMLButtonElement>('#monitor');
  const outputSelect = $<HTMLSelectElement>('#output');
  outputSelect.append(new Option(t.outputDefault, ''));
  outputSelect.addEventListener('change', () => {
    store(OUTPUT_KEY, outputSelect.value);
    bridge.setMonitorOutput(outputSelect.value).catch(warn);
  });
  micSelect.addEventListener('change', () => store(MIC_KEY, micSelect.value));
  const relearn = $<HTMLButtonElement>('#relearn');
  relearn.addEventListener('click', () => {
    bridge
      .relearnOwnVoice()
      .then(() => {
        $('#relearn-hint').textContent = t.relearnDone;
      })
      .catch(warn);
  });
  let micOn = false;
  let monitorOn = false;

  const percent = (level: number) => Math.round(Math.min(1, level) * 100);
  const setMeter = (level: number) => {
    meterFill.style.width = `${percent(level)}%`;
    meter.setAttribute('aria-valuenow', String(percent(level)));
  };
  function setMic(on: boolean): void {
    micOn = on;
    showState($('#mic-status'), micToggle, on);
    micSelect.disabled = on || micSelect.options[0]?.value === '';
    if (on) return;
    setMeter(0);
    // The monitor ends with the microphone: it never comes back by itself at the next start.
    if (monitorOn) void bridge.setMonitor(false).catch(() => undefined);
    showMonitor(false);
  }
  function showMonitor(on: boolean): void {
    monitorOn = on;
    monitorToggle.setAttribute('aria-pressed', String(on));
  }
  monitorToggle.addEventListener('click', async () => {
    notice.hidden = true;
    try {
      const on = !monitorOn;
      // Hearing oneself needs the microphone: it is started along if it was not running.
      if (on && !micOn) {
        await bridge.startMicrophone(micSelect.value);
        setMic(true);
      }
      await bridge.setMonitor(on);
      showMonitor(on);
    } catch (err) {
      warn(err);
    }
  });
  chips<VoiceEffect>($('#effects'), t.effectNames, EFFECT_KEY, (effect) => {
    bridge.setVoiceEffect(effect).catch(warn);
  });
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
        const stat = fmt(t.previewStat, { width: payload.width, height: payload.height, fps });
        const unseen = activeFace !== null && !payload.swapped;
        cameraStat.textContent = unseen ? `${stat} · ${t.faceNotSeen}` : stat;
        frames = 0;
        fpsSince = performance.now();
      }
    }),
    bridge.onMicLevel((level) => {
      if (micOn) setMeter(level);
      if (recording) sampleFill.style.width = `${percent(level)}%`;
    }),
    bridge.onMonitorEnded(() => {
      showMonitor(false);
      notice.textContent = t.monitorEnded;
      notice.hidden = false;
    }),
    bridge.onPhoneRequest((from) => {
      $('#phone-request').textContent = fmt(t.phoneRequest, { phone: phoneName(from) });
      showPhoneStep('request');
      if (!phoneDialog.open) phoneDialog.showModal();
    }),
    bridge.onPhoneLinked((linked) => {
      setPhone(linked);
      showPhoneStep('linked');
    }),
    bridge.onPhoneEnded(() => {
      const wasLinked = phone !== null;
      const wasShown = wasLinked && cameraOn && cameraSelect.value === PHONE_CAMERA;
      // A code nobody scanned in time says so; a refusal or a hang-up needs no words here.
      $('#phone-idle').textContent = phoneStep === 'code' ? t.phoneExpired : '';
      showPhoneStep('idle');
      if (wasShown) setCamera(false);
      setPhone(null);
      if (!wasLinked) return;
      if (phoneDialog.open) phoneDialog.close();
      notice.textContent = t.phoneEnded;
      notice.hidden = false;
    }),
    bridge.onCaptureEnded((source) => {
      if (source === 'camera') {
        setCamera(false);
      } else if (recording) {
        showRecording(false);
        sampleState.innerHTML = '&nbsp;';
        return voiceNotice(t.micEnded);
      } else {
        setMic(false);
      }
      notice.textContent = source === 'camera' ? t.cameraEnded : t.micEnded;
      notice.hidden = false;
    }),
  ];

  setCamera(false);
  setMic(false);
  const keptEffort = Number(stored<unknown>(EFFORT_KEY, EFFORT_DEFAULT));
  effort.value = String(keptEffort in t.effortNames ? keptEffort : EFFORT_DEFAULT);
  setEconomy(stored(ECONOMY_KEY, false));
  // The native side may still hold the face of a previous screen: start from none.
  void bridge.clearFace().catch(() => undefined);
  void bridge.clearVoice().catch(() => undefined);
  show('presets');

  bridge
    .library()
    .then((library) => {
      ({ faces, voices } = library);
      redraw();
    })
    .catch(warn);
  // A phone linked before the interface was drawn again, by a change of language for one.
  bridge
    .phoneStatus()
    .then((linked) => linked && setPhone(linked))
    .catch(warn);
  bridge
    .listDevices()
    .then((devices) => {
      webcams = devices.cameras;
      fillCameras();
      fillSelect(micSelect, devices.microphones, t.noMicrophone);
      // The microphone and the output chosen last time, if they are still plugged in.
      const keptMic = stored<unknown>(MIC_KEY, '');
      if (devices.microphones.some((device) => device.id === keptMic)) {
        micSelect.value = String(keptMic);
      }
      for (const device of devices.speakers) {
        outputSelect.append(new Option(device.name, device.id));
      }
      const keptOutput = stored<unknown>(OUTPUT_KEY, '');
      if (devices.speakers.some((device) => device.id === keptOutput)) {
        outputSelect.value = String(keptOutput);
        bridge.setMonitorOutput(outputSelect.value).catch(warn);
      }
      micToggle.disabled = devices.microphones.length === 0;
      record.disabled = devices.microphones.length === 0;
      monitorToggle.disabled = devices.microphones.length === 0;
    })
    .catch(warn);

  return {
    showTier,
    leave() {
      gone.abort();
      unlisten.forEach((pending) => void pending.then((off) => [off].flat().forEach((f) => f())));
    },
  };
}
