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
/** A cloned face or voice, kept on this PC. */
export interface Profile {
  id: string;
  name: string;
  /** Portrait of a face, as a base64 JPEG. Voices have none. */
  picture: string | null;
}
export interface Profiles {
  faces: Profile[];
  voices: Profile[];
}
export interface CameraFrame {
  jpeg: string;
  width: number;
  height: number;
  /** Whether the face of this frame was replaced. */
  swapped: boolean;
}
export type VoiceEffect = 'none' | 'deep' | 'high' | 'robot' | 'echo' | 'radio';
export type Filter = 'none' | 'glasses' | 'cat' | 'dog' | 'mono' | 'sepia';
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
  /** Plays the microphone back, with its effect, while it runs. Stopping it turns this off. */
  setMonitor: (on: boolean) => invoke<void>('set_monitor', { on }),
  setVoiceEffect: (effect: VoiceEffect) => invoke<void>('set_voice_effect', { effect }),
  setFilter: (filter: Filter) => invoke<void>('set_filter', { filter }),
  /** Opens or closes the floating camera window. Returns whether it is now open. */
  togglePip: () => invoke<boolean>('toggle_pip'),
  library: () => invoke<Profiles>('list_library'),
  /** Pictures and recordings travel as base64, without the `data:` prefix. */
  cloneFace: (name: string, image: string) => invoke<Profile>('clone_face', { name, image }),
  useFace: (id: string) => invoke<void>('use_face', { id }),
  clearFace: () => invoke<void>('clear_face'),
  /** The first use loads the voice models: it takes a few seconds. */
  useVoice: (id: string) => invoke<void>('use_voice', { id }),
  clearVoice: () => invoke<void>('clear_voice'),
  importVoice: (name: string, extension: string, audio: string) =>
    invoke<Profile>('import_voice', { name, extension, audio }),
  startVoiceSample: (id: string) => invoke<void>('start_voice_sample', { id }),
  /** Length of the recording, in seconds. It is kept until saved or discarded. */
  stopVoiceSample: () => invoke<number>('stop_voice_sample'),
  saveVoiceSample: (name: string) => invoke<Profile>('save_voice_sample', { name }),
  discardVoiceSample: () => invoke<void>('discard_voice_sample'),
  removeProfile: (kind: 'face' | 'voice', id: string) =>
    invoke<void>('remove_profile', { kind, id }),
  setEconomy: (on: boolean) => invoke<void>('set_economy', { on }),
  /** Returns the photo with the chosen face, as a base64 JPEG. */
  swapPhoto: (image: string) => invoke<string>('swap_photo', { image }),
  /** Version number of a newer release, or null. */
  checkUpdate: () => invoke<string | null>('check_update'),
  /** Resolves only on failure: on success the application restarts. */
  installUpdate: () => invoke<void>('install_update'),

  onCameraFrame: (handler: (frame: CameraFrame) => void): Promise<UnlistenFn> =>
    listen<CameraFrame>('camera-frame', (event) => handler(event.payload)),
  onMicLevel: (handler: (level: number) => void): Promise<UnlistenFn> =>
    listen<number>('mic-level', (event) => handler(event.payload)),
  /** The monitor lost its speakers or found none: the native side has turned it off. */
  onMonitorEnded: (handler: () => void): Promise<UnlistenFn> => listen('monitor-ended', handler),
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
