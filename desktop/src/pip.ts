// The floating camera window: the picture the main window previews, kept above the other
// applications. It holds no session and calls no command: it listens to the frames, and is
// moved by dragging it anywhere.
import { getCurrentWindow } from '@tauri-apps/api/window';
import { bridge } from './bridge';
import { t } from './i18n';

/** Without a frame for this long, the camera is taken as stopped. */
const IDLE_MS = 1500;

export function mountPip(root: HTMLElement): void {
  document.body.dataset.screen = 'pip';
  root.innerHTML = `
    <main class="pip" data-tauri-drag-region>
      <img id="pip-frame" alt="${t.cameraPreview}" hidden />
      <p class="muted" id="pip-empty">${t.previewIdle}</p>
      <button class="pip-close" aria-label="${t.close}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg></button>
    </main>`;
  const frame = root.querySelector<HTMLImageElement>('#pip-frame')!;
  const empty = root.querySelector<HTMLElement>('#pip-empty')!;
  root.querySelector('.pip-close')!.addEventListener('click', () => void getCurrentWindow().close());

  let idle: number | undefined;
  const show = (live: boolean) => {
    frame.hidden = !live;
    empty.hidden = live;
  };
  void bridge.onCameraFrame((payload) => {
    frame.src = `data:image/jpeg;base64,${payload.jpeg}`;
    show(true);
    window.clearTimeout(idle);
    idle = window.setTimeout(() => show(false), IDLE_MS);
  });
}
