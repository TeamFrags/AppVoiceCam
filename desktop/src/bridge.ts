// Typed access to the commands implemented in Rust (src-tauri/src/lib.rs).
// The interface holds no credential: it only asks the native side to act.
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { t } from './i18n';

export interface Account {
  email: string;
  tier: 'free' | 'premium';
}
export interface Device {
  id: string;
  name: string;
}
export interface Devices {
  cameras: Device[];
  microphones: Device[];
}
export interface CameraFrame {
  jpeg: string;
  width: number;
  height: number;
}
export interface AppError {
  code: string;
  details: Record<string, unknown>;
}

export const bridge = {
  restoreSession: () => invoke<Account | null>('restore_session'),
  signIn: (email: string, password: string) => invoke<Account>('sign_in', { email, password }),
  signInWith: (provider: string) => invoke<Account>('sign_in_with', { provider }),
  cancelSignIn: () => invoke<void>('cancel_sign_in'),
  providers: () => invoke<string[]>('sign_in_providers'),
  account: () => invoke<Account>('account'),
  signOut: () => invoke<void>('sign_out'),
  openWebsite: (page: 'register' | 'forgot-password' | 'pricing' | 'account') =>
    invoke<void>('open_website', { page }),
  listDevices: () => invoke<Devices>('list_devices'),
  startCamera: (id: string) => invoke<void>('start_camera', { id }),
  stopCamera: () => invoke<void>('stop_camera'),
  startMicrophone: (id: string) => invoke<void>('start_microphone', { id }),
  stopMicrophone: () => invoke<void>('stop_microphone'),
  /** Version number of a newer release, or null. */
  checkUpdate: () => invoke<string | null>('check_update'),
  /** Resolves only on failure: on success the application restarts. */
  installUpdate: () => invoke<void>('install_update'),

  onCameraFrame: (handler: (frame: CameraFrame) => void): Promise<UnlistenFn> =>
    listen<CameraFrame>('camera-frame', (event) => handler(event.payload)),
  onMicLevel: (handler: (level: number) => void): Promise<UnlistenFn> =>
    listen<number>('mic-level', (event) => handler(event.payload)),
  onCaptureEnded: (handler: (source: 'camera' | 'mic') => void): Promise<UnlistenFn[]> =>
    Promise.all([
      listen('camera-ended', () => handler('camera')),
      listen('mic-ended', () => handler('mic')),
    ]),
};

export function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'code' in value;
}

export function errorMessage(err: unknown): string {
  const known: Record<string, string> = t.errors;
  return (isAppError(err) ? known[err.code] : undefined) ?? t.errors.generic;
}
