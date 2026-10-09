// Texts of the interface, in English unless the user picks another language.
// English is the reference: its shape is the type every other language must match.
const en = {
  loading: 'Loading',
  suspendedTitle: 'Account suspended',
  suspendedUntil: 'Your account is suspended until {date}. Reason: {reason}',
  banned: 'Your account has been banned. Reason: {reason}',
  changeAccount: 'Switch account',
  signInPrompt: 'Sign in to use the app.',
  email: 'Email address',
  password: 'Password',
  signIn: 'Sign in',
  createAccount: 'Create an account',
  forgot: 'Forgot your password?',
  continueWith: 'Continue with {provider}',
  signingInTitle: 'Signing in',
  signingInHint: 'Finish signing in with {provider} in your browser, then come back here.',
  cancel: 'Cancel',
  signOut: 'Sign out',
  free: 'Free',
  camera: 'Camera',
  microphone: 'Microphone',
  start: 'Start',
  stop: 'Stop',
  live: 'Live',
  stopped: 'Stopped',
  cameraPreview: 'Camera preview',
  previewIdle: 'Preview stopped',
  previewStat: '{width} × {height} · {fps} fps (preview)',
  micLevel: 'Microphone level',
  versionNote:
    'This version captures your camera and microphone. Face and voice transformation arrives in a future version.',
  cameraEnded: 'The camera stopped. It may be in use by another application.',
  micEnded: 'The microphone stopped. Check that it is still plugged in.',
  noCamera: 'No camera detected',
  noMicrophone: 'No microphone detected',
  updateAvailable: 'Version {version} is available.',
  updateInstall: 'Install and restart',
  updateDownloading: 'Downloading version {version}…',
  errors: {
    invalid_credentials: 'Incorrect email or password.',
    email_not_verified: 'First confirm your address using the link we emailed you.',
    account_locked: 'Too many attempts. Try again in a few minutes.',
    rate_limited: 'Too many requests. Wait a little before trying again.',
    invalid_request: 'Check your email and password.',
    network_error: 'Cannot reach the server. Check your connection.',
    oauth_timeout: 'The sign-in did not complete in the browser. Try again.',
    oauth_invalid_code: 'Sign-in failed. Try again.',
    browser_unavailable: 'Cannot open the browser.',
    keychain_unavailable: 'Cannot save the session on this PC.',
    no_device_selected: 'Choose a device first.',
    update_failed: 'The update failed. Try again later.',
    generic: 'Something went wrong. Try again later.',
  },
};

type Messages = typeof en;

const fr: Messages = {
  loading: 'Chargement',
  suspendedTitle: 'Compte suspendu',
  suspendedUntil: 'Ton compte est suspendu jusqu’au {date}. Motif : {reason}',
  banned: 'Ton compte a été banni. Motif : {reason}',
  changeAccount: 'Changer de compte',
  signInPrompt: 'Connecte-toi pour utiliser l’application.',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  signIn: 'Se connecter',
  createAccount: 'Créer un compte',
  forgot: 'Mot de passe oublié ?',
  continueWith: 'Continuer avec {provider}',
  signingInTitle: 'Connexion en cours',
  signingInHint: 'Termine la connexion avec {provider} dans ton navigateur, puis reviens ici.',
  cancel: 'Annuler',
  signOut: 'Se déconnecter',
  free: 'Gratuit',
  camera: 'Caméra',
  microphone: 'Micro',
  start: 'Démarrer',
  stop: 'Arrêter',
  live: 'En direct',
  stopped: 'À l’arrêt',
  cameraPreview: 'Aperçu de la caméra',
  previewIdle: 'Aperçu à l’arrêt',
  previewStat: '{width} × {height} · {fps} images/s (aperçu)',
  micLevel: 'Niveau du micro',
  versionNote:
    'Cette version capture ta caméra et ton micro. La transformation du visage et de la voix arrive dans une prochaine version.',
  cameraEnded: 'La caméra s’est arrêtée. Elle est peut-être utilisée par une autre application.',
  micEnded: 'Le micro s’est arrêté. Vérifie qu’il est toujours branché.',
  noCamera: 'Aucune caméra détectée',
  noMicrophone: 'Aucun micro détecté',
  updateAvailable: 'La version {version} est disponible.',
  updateInstall: 'Installer et redémarrer',
  updateDownloading: 'Téléchargement de la version {version}…',
  errors: {
    invalid_credentials: 'E-mail ou mot de passe incorrect.',
    email_not_verified: 'Confirme d’abord ton adresse grâce au lien reçu par e-mail.',
    account_locked: 'Trop de tentatives. Réessaie dans quelques minutes.',
    rate_limited: 'Trop de demandes. Patiente un peu avant de réessayer.',
    invalid_request: 'Vérifie ton e-mail et ton mot de passe.',
    network_error: 'Impossible de joindre le serveur. Vérifie ta connexion.',
    oauth_timeout: 'La connexion n’a pas abouti dans le navigateur. Réessaie.',
    oauth_invalid_code: 'La connexion a échoué. Réessaie.',
    browser_unavailable: 'Impossible d’ouvrir le navigateur.',
    keychain_unavailable: 'Impossible d’enregistrer la session sur ce PC.',
    no_device_selected: 'Choisis d’abord un périphérique.',
    update_failed: 'La mise à jour a échoué. Réessaie plus tard.',
    generic: 'Une erreur est survenue. Réessaie plus tard.',
  },
};

const es: Messages = {
  loading: 'Cargando',
  suspendedTitle: 'Cuenta suspendida',
  suspendedUntil: 'Tu cuenta está suspendida hasta el {date}. Motivo: {reason}',
  banned: 'Tu cuenta ha sido expulsada. Motivo: {reason}',
  changeAccount: 'Cambiar de cuenta',
  signInPrompt: 'Inicia sesión para usar la aplicación.',
  email: 'Dirección de correo',
  password: 'Contraseña',
  signIn: 'Iniciar sesión',
  createAccount: 'Crear una cuenta',
  forgot: '¿Has olvidado tu contraseña?',
  continueWith: 'Continuar con {provider}',
  signingInTitle: 'Iniciando sesión',
  signingInHint: 'Termina de iniciar sesión con {provider} en tu navegador y vuelve aquí.',
  cancel: 'Cancelar',
  signOut: 'Cerrar sesión',
  free: 'Gratis',
  camera: 'Cámara',
  microphone: 'Micrófono',
  start: 'Iniciar',
  stop: 'Detener',
  live: 'En directo',
  stopped: 'Detenido',
  cameraPreview: 'Vista previa de la cámara',
  previewIdle: 'Vista previa detenida',
  previewStat: '{width} × {height} · {fps} imágenes/s (vista previa)',
  micLevel: 'Nivel del micrófono',
  versionNote:
    'Esta versión captura tu cámara y tu micrófono. La transformación de la cara y de la voz llegará en una próxima versión.',
  cameraEnded: 'La cámara se ha detenido. Puede que otra aplicación la esté usando.',
  micEnded: 'El micrófono se ha detenido. Comprueba que sigue conectado.',
  noCamera: 'No se ha detectado ninguna cámara',
  noMicrophone: 'No se ha detectado ningún micrófono',
  updateAvailable: 'La versión {version} está disponible.',
  updateInstall: 'Instalar y reiniciar',
  updateDownloading: 'Descargando la versión {version}…',
  errors: {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_verified: 'Confirma primero tu dirección con el enlace que te enviamos por correo.',
    account_locked: 'Demasiados intentos. Vuelve a intentarlo en unos minutos.',
    rate_limited: 'Demasiadas solicitudes. Espera un poco antes de volver a intentarlo.',
    invalid_request: 'Revisa tu correo y tu contraseña.',
    network_error: 'No se puede contactar con el servidor. Comprueba tu conexión.',
    oauth_timeout: 'El inicio de sesión no se completó en el navegador. Vuelve a intentarlo.',
    oauth_invalid_code: 'El inicio de sesión ha fallado. Vuelve a intentarlo.',
    browser_unavailable: 'No se puede abrir el navegador.',
    keychain_unavailable: 'No se puede guardar la sesión en este PC.',
    no_device_selected: 'Elige primero un dispositivo.',
    update_failed: 'La actualización ha fallado. Vuelve a intentarlo más tarde.',
    generic: 'Se ha producido un error. Vuelve a intentarlo más tarde.',
  },
};

// Brazilian Portuguese.
const pt: Messages = {
  loading: 'Carregando',
  suspendedTitle: 'Conta suspensa',
  suspendedUntil: 'Sua conta está suspensa até {date}. Motivo: {reason}',
  banned: 'Sua conta foi banida. Motivo: {reason}',
  changeAccount: 'Trocar de conta',
  signInPrompt: 'Entre para usar o aplicativo.',
  email: 'Endereço de e-mail',
  password: 'Senha',
  signIn: 'Entrar',
  createAccount: 'Criar uma conta',
  forgot: 'Esqueceu a senha?',
  continueWith: 'Continuar com {provider}',
  signingInTitle: 'Entrando',
  signingInHint: 'Conclua o acesso com {provider} no seu navegador e volte para cá.',
  cancel: 'Cancelar',
  signOut: 'Sair',
  free: 'Grátis',
  camera: 'Câmera',
  microphone: 'Microfone',
  start: 'Iniciar',
  stop: 'Parar',
  live: 'Ao vivo',
  stopped: 'Parado',
  cameraPreview: 'Prévia da câmera',
  previewIdle: 'Prévia parada',
  previewStat: '{width} × {height} · {fps} quadros/s (prévia)',
  micLevel: 'Nível do microfone',
  versionNote:
    'Esta versão captura sua câmera e seu microfone. A transformação do rosto e da voz chega em uma próxima versão.',
  cameraEnded: 'A câmera parou. Talvez esteja sendo usada por outro aplicativo.',
  micEnded: 'O microfone parou. Verifique se ele continua conectado.',
  noCamera: 'Nenhuma câmera detectada',
  noMicrophone: 'Nenhum microfone detectado',
  updateAvailable: 'A versão {version} está disponível.',
  updateInstall: 'Instalar e reiniciar',
  updateDownloading: 'Baixando a versão {version}…',
  errors: {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_verified: 'Confirme primeiro seu endereço pelo link que enviamos por e-mail.',
    account_locked: 'Tentativas demais. Tente de novo em alguns minutos.',
    rate_limited: 'Solicitações demais. Aguarde um pouco antes de tentar de novo.',
    invalid_request: 'Confira seu e-mail e sua senha.',
    network_error: 'Não foi possível contatar o servidor. Verifique sua conexão.',
    oauth_timeout: 'O acesso não foi concluído no navegador. Tente de novo.',
    oauth_invalid_code: 'O acesso falhou. Tente de novo.',
    browser_unavailable: 'Não foi possível abrir o navegador.',
    keychain_unavailable: 'Não foi possível salvar a sessão neste PC.',
    no_device_selected: 'Escolha primeiro um dispositivo.',
    update_failed: 'A atualização falhou. Tente de novo mais tarde.',
    generic: 'Ocorreu um erro. Tente de novo mais tarde.',
  },
};

const de: Messages = {
  loading: 'Wird geladen',
  suspendedTitle: 'Konto gesperrt',
  suspendedUntil: 'Dein Konto ist bis {date} gesperrt. Grund: {reason}',
  banned: 'Dein Konto wurde dauerhaft gesperrt. Grund: {reason}',
  changeAccount: 'Konto wechseln',
  signInPrompt: 'Melde dich an, um die App zu nutzen.',
  email: 'E-Mail-Adresse',
  password: 'Passwort',
  signIn: 'Anmelden',
  createAccount: 'Konto erstellen',
  forgot: 'Passwort vergessen?',
  continueWith: 'Weiter mit {provider}',
  signingInTitle: 'Anmeldung läuft',
  signingInHint:
    'Schließe die Anmeldung mit {provider} im Browser ab und komm dann hierher zurück.',
  cancel: 'Abbrechen',
  signOut: 'Abmelden',
  free: 'Kostenlos',
  camera: 'Kamera',
  microphone: 'Mikrofon',
  start: 'Starten',
  stop: 'Stoppen',
  live: 'Live',
  stopped: 'Gestoppt',
  cameraPreview: 'Kameravorschau',
  previewIdle: 'Vorschau gestoppt',
  previewStat: '{width} × {height} · {fps} Bilder/s (Vorschau)',
  micLevel: 'Mikrofonpegel',
  versionNote:
    'Diese Version nimmt deine Kamera und dein Mikrofon auf. Die Verwandlung von Gesicht und Stimme kommt in einer späteren Version.',
  cameraEnded: 'Die Kamera wurde gestoppt. Vielleicht wird sie von einer anderen App verwendet.',
  micEnded: 'Das Mikrofon wurde gestoppt. Prüfe, ob es noch angeschlossen ist.',
  noCamera: 'Keine Kamera gefunden',
  noMicrophone: 'Kein Mikrofon gefunden',
  updateAvailable: 'Version {version} ist verfügbar.',
  updateInstall: 'Installieren und neu starten',
  updateDownloading: 'Version {version} wird heruntergeladen…',
  errors: {
    invalid_credentials: 'E-Mail oder Passwort falsch.',
    email_not_verified: 'Bestätige zuerst deine Adresse über den Link in unserer E-Mail.',
    account_locked: 'Zu viele Versuche. Versuch es in ein paar Minuten erneut.',
    rate_limited: 'Zu viele Anfragen. Warte kurz, bevor du es erneut versuchst.',
    invalid_request: 'Prüfe deine E-Mail und dein Passwort.',
    network_error: 'Der Server ist nicht erreichbar. Prüfe deine Verbindung.',
    oauth_timeout: 'Die Anmeldung wurde im Browser nicht abgeschlossen. Versuch es erneut.',
    oauth_invalid_code: 'Die Anmeldung ist fehlgeschlagen. Versuch es erneut.',
    browser_unavailable: 'Der Browser kann nicht geöffnet werden.',
    keychain_unavailable: 'Die Sitzung kann auf diesem PC nicht gespeichert werden.',
    no_device_selected: 'Wähle zuerst ein Gerät.',
    update_failed: 'Das Update ist fehlgeschlagen. Versuch es später erneut.',
    generic: 'Etwas ist schiefgelaufen. Versuch es später erneut.',
  },
};

const LANGUAGES: Record<string, Messages> = { en, fr, es, pt, de };

/** Each language is named in itself, so a user recognises their own. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
};

const STORAGE_KEY = 'language';

function storedLanguage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** English like the website, until the user picks another language. */
export const locale = [storedLanguage()].find((l) => l !== null && l in LANGUAGES) ?? 'en';

export const t = LANGUAGES[locale] ?? en;

/** Remembers the choice and redraws the whole interface in that language. */
export function chooseLanguage(language: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice cannot be kept, the interface stays as it is.
  }
  location.reload();
}

/** Replaces {placeholders} in a text. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => String(vars[key] ?? whole));
}
