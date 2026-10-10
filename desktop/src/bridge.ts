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
  /** Where the monitor can be played: speakers, headphones, virtual cables. */
  speakers: Device[];
}
/** A cloned face or voice, kept on this PC, or a voice that comes with the application. */
export interface Profile {
  id: string;
  name: string;
  /** Portrait of a face, as a base64 JPEG. Voices have none. */
  picture: string | null;
  /** Comes with the application: it cannot be removed. */
  included: boolean;
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
/** A phone that asks to be, or is, the camera. */
export interface Phone {
  /** "iPhone", "iPad" or "Android"; empty when its browser does not say. */
  device: string;
  /** Its address on the local network. */
  address: string;
}
export interface PhoneOffer {
  /** The QR code the phone scans, as an SVG picture. */
  qr: string;
  /** How long it can be scanned. */
  seconds: number;
}
export type VoiceEffect = 'none' | 'deep' | 'high' | 'robot' | 'echo' | 'radio';
export type Filter = 'none' | 'glasses' | 'cat' | 'dog' | 'mono' | 'sepia' | 'blurface' | 'stars' | 'crown' | 'clown' | 'mustache' | 'devil' | 'angel' | 'hearts' | 'ninja' | 'fox';
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
  /** Shows a QR code for a phone on the same network. Any earlier code or link is ended. */
  phoneLink: () => invoke<PhoneOffer>('phone_link'),
  /** Lets in, or turns away, the phone that scanned the code. */
  phoneAnswer: (allow: boolean) => invoke<void>('phone_answer', { allow }),
  phoneUnlink: () => invoke<void>('phone_unlink'),
  /** The phone linked right now, or null. */
  phoneStatus: () => invoke<Phone | null>('phone_status'),
  startMicrophone: (id: string) => invoke<void>('start_microphone', { id }),
  stopMicrophone: () => invoke<void>('stop_microphone'),
  /** Plays the microphone back, with its effect, while it runs. Stopping it turns this off. */
  setMonitor: (on: boolean) => invoke<void>('set_monitor', { on }),
  /** Where the monitor is played. An empty id is the default output of the PC. */
  setMonitorOutput: (id: string) => invoke<void>('set_monitor_output', { id }),
  /** Forgets how the user sounds through the current microphone: it is learnt again. */
  relearnOwnVoice: () => invoke<void>('relearn_own_voice'),
  setVoiceEffect: (effect: VoiceEffect) => invoke<void>('set_voice_effect', { effect }),
  /** From 0 (least delay) to 3 (cleanest cloned voice). Returns the delay to expect, in ms. */
  setVoiceEffort: (effort: number) => invoke<number>('set_voice_effort', { effort }),
  setFilter: (filter: Filter) => invoke<void>('set_filter', { filter }),
  setFilterIntensity: (intensity: number) => invoke<void>('set_filter_intensity', { intensity }),
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
  /** Returns the photo with the chosen face (if any) and the active filter, as a base64 JPEG. */
  previewPhoto: (image: string) => invoke<string>('preview_photo', { image }),
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
  /** A phone scanned the code and waits for the user's answer. */
  onPhoneRequest: (handler: (phone: Phone) => void): Promise<UnlistenFn> =>
    listen<Phone>('phone-request', (event) => handler(event.payload)),
  onPhoneLinked: (handler: (phone: Phone) => void): Promise<UnlistenFn> =>
    listen<Phone>('phone-linked', (event) => handler(event.payload)),
  /** The link is over, whoever ended it; also sent when a code runs out unused. */
  onPhoneEnded: (handler: () => void): Promise<UnlistenFn> => listen('phone-ended', handler),
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
