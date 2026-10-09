import type { Messages } from './en';

export const es: Messages = {
  meta: {
    description: '{name} cambia tu cara y tu voz en directo para Discord y tus juegos.',
  },
  nav: {
    main: 'Navegación principal',
    skip: 'Ir al contenido',
    features: 'Funciones',
    pricing: 'Precios',
    faq: 'Preguntas',
    download: 'Descargar',
    signIn: 'Iniciar sesión',
    account: 'Mi cuenta',
    language: 'Idioma',
  },
  footer: {
    privacy: 'Privacidad',
    cookies: 'Gestionar cookies',
  },
  home: {
    live: 'Cara y voz en tiempo real',
    lead: '{name} transforma tu cara y tu voz en directo y las envía a Discord y a tus juegos como una cámara y un micrófono normales.',
    ctaRegister: 'Crear una cuenta gratis',
    ctaFeatures: 'Ver las funciones',
    mascotAlt: '{mascot}, la mascota de {name}',
    demoTitle: 'Un clic y eres otra persona',
    demoText:
      'Elige una cara, elige una voz: lo que tus amigos ven y oyen cambia mientras sigues hablando.',
    demoYou: 'Tú',
    demoThem: 'Lo que ven',
    demoAlt:
      'Ilustración: a la izquierda la imagen de tu webcam, a la derecha la misma persona con otra cara y otra voz.',
    appsTitle: 'Funciona donde juegas y chateas',
    appsOther: 'Y cualquier aplicación que acepte una webcam o un micrófono.',
    apps: {
      discord: 'Llamadas, directos y canales de voz',
      roblox: 'Chat de voz y cámara en tus experiencias',
      valorant: 'Chat de voz con tu equipo',
      fortnite: 'Chat de voz con tu escuadrón',
      minecraft: 'Habla con tus amigos mientras construyes',
      teamspeak: 'Canales de voz',
    },
    stepsTitle: 'Listo en tres pasos',
    steps: [
      {
        title: 'Instala e inicia sesión',
        text: 'Descarga {name} para Windows e inicia sesión con tu cuenta gratuita.',
      },
      {
        title: 'Elige una cara y una voz',
        text: 'Escoge del catálogo. La vista previa muestra el resultado al instante.',
      },
      {
        title: 'Selecciónalas en tu aplicación',
        text: 'Elige «{camera}» y «{microphone}» como cámara y micrófono en Discord o en tu juego.',
      },
    ],
    featuresTitle: 'Qué hace {name}',
    features: [
      {
        title: 'Una cara nueva, en directo',
        text: 'Elige una cara del catálogo: sigue tus expresiones en tiempo real delante de tu webcam.',
      },
      {
        title: 'Una voz nueva, sin retraso',
        text: 'Tu voz se transforma mientras hablas, pensada para seguir fluida en plena partida.',
      },
      {
        title: 'Compatible con tus aplicaciones',
        text: 'Selecciona «{camera}» y «{microphone}» como cámara y micrófono donde los necesites.',
      },
      {
        title: 'Todo ocurre en tu PC',
        text: 'Tu cámara y tu micrófono se procesan en tu equipo. No nos envías ni tu imagen ni tu voz.',
      },
    ],
    pricingTitle: 'Gratis para empezar',
    pricingText:
      'Algunas caras y voces son gratuitas. Premium desbloquea todo el catálogo, las caras personalizadas y la clonación de voz.',
    pricingCta: 'Comparar planes',
  },
  features: {
    title: 'Funciones',
    description:
      'Cambio de cara y de voz en tiempo real, cámara y micrófono virtuales, perfiles de rendimiento: todo lo que hace {name}.',
    lead: '{name} se instala en Windows y se coloca entre tu webcam, tu micrófono y tus aplicaciones.',
    groups: [
      {
        title: 'Cara',
        items: [
          'Caras predefinidas listas para usar',
          'Caras personalizadas a partir de una foto que tengas derecho a usar (Premium)',
          'Seguimiento de expresiones en tiempo real',
        ],
      },
      {
        title: 'Voz',
        items: [
          'Voces predefinidas listas para usar',
          'Clonación de una voz que tengas derecho a usar (Premium)',
          'Transformación mientras hablas',
        ],
      },
      {
        title: 'Cámara y micrófono virtuales',
        items: [
          '«{camera}» y «{microphone}» aparecen en tu lista de dispositivos',
          'Compatible con {apps}',
          'Y con cualquier aplicación que use una webcam o un micrófono estándar',
        ],
      },
      {
        title: 'Rendimiento',
        items: [
          'Usa tu tarjeta gráfica cuando está disponible; si no, tu procesador',
          'Tres perfiles: máximo rendimiento, equilibrado, ahorro de recursos',
          'Indicador opcional de imágenes por segundo y latencia',
        ],
      },
      {
        title: 'Cuenta y seguridad',
        items: [
          'Lista de tus dispositivos conectados, con cierre de sesión a distancia',
          'Catálogo de caras y voces actualizado sin reinstalar la aplicación',
          'Actualizaciones firmadas y verificadas antes de instalarse',
        ],
      },
    ],
    note: 'La aplicación está en desarrollo: algunas funciones llegarán después de la primera versión. <a>Crea tu cuenta</a> para estar listo en el lanzamiento.',
  },
  pricing: {
    title: 'Precios',
    description:
      '{name} es gratis para empezar. Premium, por {price} al mes, desbloquea todas las caras, todas las voces y la clonación de voz.',
    lead: 'Empieza gratis. Pásate a Premium cuando quieras, cancela cuando quieras.',
    free: 'Gratis',
    freeItems: [
      'Una selección de caras predefinidas',
      'Una selección de voces predefinidas',
      'Cámara y micrófono virtuales',
      'Todos los perfiles de rendimiento',
    ],
    freeCta: 'Crear una cuenta',
    premium: 'Premium',
    perMonth: '/ mes',
    premiumItems: [
      'Todas las caras del catálogo',
      'Todas las voces del catálogo',
      'Creación de caras personalizadas',
      'Clonación de voz',
      'Funciones avanzadas',
    ],
    soon: 'Próximamente',
    note: 'Las suscripciones aún no están abiertas. Precio con impuestos incluidos, sin permanencia.',
  },
  faq: {
    title: 'Preguntas frecuentes',
    description:
      'Compatibilidad, requisitos, privacidad, suscripción: respuestas a las preguntas sobre {name}.',
    items: [
      {
        q: '¿Con qué aplicaciones funciona {name}?',
        a: 'Con {apps} y, en general, con cualquier aplicación que permita elegir la webcam o el micrófono. Basta con seleccionar «{camera}» y «{microphone}» en sus ajustes.',
      },
      {
        q: '¿Qué necesito para usarlo?',
        a: 'Un PC con Windows. Una tarjeta gráfica reciente ofrece la mayor fluidez; sin ella, la aplicación pasa al procesador con un perfil más ligero.',
      },
      {
        q: '¿Se envían mi imagen y mi voz a vuestros servidores?',
        a: 'No. La transformación se hace en tu PC. Nuestros servidores gestionan tu cuenta, tu suscripción y la descarga de caras y voces.',
      },
      {
        q: '¿Puedo usar la cara o la voz de otra persona?',
        a: 'Solo con su permiso. Hacerse pasar por una persona real para engañar, acosar o estafar está prohibido y supone la expulsión de la cuenta.',
      },
      {
        q: '¿Hace falta una cuenta?',
        a: 'Sí, la aplicación pide iniciar sesión. La cuenta es gratuita.',
      },
      {
        q: '¿Cuánto cuesta Premium?',
        a: '{price} al mes, sin permanencia. Desbloquea todo el catálogo, las caras personalizadas y la clonación de voz.',
      },
      {
        q: '¿Cómo elimino mi cuenta o recupero mis datos?',
        a: 'Escríbenos a {email}: tramitamos la solicitud y te respondemos en el plazo de un mes.',
      },
    ],
  },
  download: {
    title: 'Descargar {name}',
    description: 'Descargar {name} para Windows.',
    soonTitle: 'Próximamente',
    text: 'La aplicación está en desarrollo. Crea tu cuenta ahora: te servirá para iniciar sesión el día del lanzamiento.',
    button: 'Descargar para Windows',
    cta: 'Crear una cuenta',
  },
  privacy: {
    title: 'Privacidad y cookies',
    description:
      'Qué datos recoge {name}, por qué, durante cuánto tiempo y cómo ejercer tus derechos.',
    controllerTitle: 'Quién es responsable de tus datos',
    publisherFallback: 'El editor de {name}',
    contact: 'Contacto:',
    collectTitle: 'Qué recogemos',
    collect: [
      '<b>Tu cuenta</b>: dirección de correo y contraseña (guardada solo en forma de hash, nunca en claro).',
      '<b>Tus inicios de sesión</b>: nombre del dispositivo, dirección IP y fecha, para mostrarte tus sesiones activas y detectar un acceso sospechoso.',
      '<b>La medición de audiencia del sitio</b>, solo si la aceptas: páginas visitadas y sitio de procedencia, asociados a un identificador anónimo.',
    ],
    noMedia:
      'No recogemos ni la imagen de tu cámara ni el sonido de tu micrófono: la transformación se hace en tu PC.',
    cookiesTitle: 'Cookies',
    table: { name: 'Nombre', role: 'Finalidad', duration: 'Duración', consent: 'Consentimiento' },
    rt: {
      role: 'Mantener tu sesión iniciada. Ilegible para los scripts de la página.',
      duration: '30 días',
      consent: 'No requerido (necesaria para el servicio)',
    },
    vid: {
      role: 'Identificador anónimo para contar las visitas.',
      duration: '13 meses',
      consent: 'Requerido: solo se instala si aceptas',
    },
    choice:
      'Tu elección se recuerda durante seis meses en tu navegador y después se vuelve a preguntar. Ninguna cookie publicitaria, ninguna herramienta de medición de terceros. Puedes cambiar de opinión en cualquier momento: <manage>Gestionar cookies</manage>.',
    retentionTitle: 'Plazos de conservación',
    retention: [
      'Cuenta: hasta su eliminación.',
      'Medición de audiencia: 25 meses, después se elimina automáticamente.',
    ],
    rightsTitle: 'Tus derechos',
    rights:
      'Puedes solicitar el acceso a tus datos, su rectificación, su supresión o su exportación escribiendo a <mail>{email}</mail>. También puedes presentar una reclamación ante tu autoridad de protección de datos (en Francia, la CNIL: cnil.fr).',
  },
  auth: {
    signInTitle: 'Iniciar sesión',
    email: 'Dirección de correo',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    forgot: '¿Has olvidado tu contraseña?',
    createAccount: 'Crear una cuenta',
    continueWith: 'Continuar con {provider}',
    or: 'o',
    registerTitle: 'Crear una cuenta',
    passwordNew: 'Contraseña (mínimo 10 caracteres)',
    register: 'Crear mi cuenta',
    registerDone:
      'Ya casi está: abre el enlace que acabamos de enviarte por correo para activar tu cuenta.',
    already: '¿Ya tienes cuenta? <a>Iniciar sesión</a>',
    forgotTitle: 'Contraseña olvidada',
    forgotSubmit: 'Recibir el enlace',
    forgotDone:
      'Si existe una cuenta para esta dirección, acabamos de enviarle un enlace de restablecimiento.',
    resetTitle: 'Nueva contraseña',
    resetPassword: 'Nueva contraseña (mínimo 10 caracteres)',
    save: 'Guardar',
    resetDone: 'Contraseña cambiada. Se ha cerrado la sesión en todos tus dispositivos.',
    verifyTitle: 'Confirmación del correo',
    verifying: 'Comprobando…',
    verified: 'Dirección confirmada. Ya puedes iniciar sesión.',
  },
  account: {
    title: 'Mi cuenta',
    loading: 'Cargando…',
    plan: 'Suscripción',
    free: 'Gratis',
    premium: 'Premium',
    renews: 'Próxima renovación: {date}',
    notOpen: 'Las suscripciones Premium aún no están abiertas. <a>Ver los planes</a>',
    devices: 'Dispositivos conectados',
    thisDevice: 'este dispositivo',
    unknownIp: 'IP desconocida',
    seen: '{ip} · visto el {date}',
    revoke: 'Desconectar',
    signOut: 'Cerrar sesión',
    webBrowser: 'Navegador web',
  },
  consent: {
    title: 'Medición de audiencia',
    text: 'Con tu permiso, una cookie anónima nos permite contar las visitas y saber qué páginas se leen. Sin publicidad y sin compartir nada con terceros. <a>Más información</a>',
    refuse: 'Rechazar',
    accept: 'Aceptar',
  },
  notFound: {
    title: 'Página no encontrada',
    text: 'Esta dirección no existe o ha dejado de existir.',
    back: 'Volver al inicio',
  },
  errors: {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_verified: 'Confirma primero tu dirección con el enlace que te enviamos por correo.',
    account_locked:
      'Demasiados intentos. Vuelve a intentarlo en unos minutos o restablece tu contraseña.',
    rate_limited: 'Demasiadas solicitudes. Espera un poco antes de volver a intentarlo.',
    invalid_request:
      'Revisa los campos: un correo válido y una contraseña de al menos 10 caracteres.',
    invalid_or_expired_token: 'Este enlace ya no es válido. Solicita uno nuevo.',
    network_error: 'No se puede contactar con el servidor. Comprueba tu conexión.',
    oauth_email_not_verified:
      'Esta cuenta de Google o Discord no tiene un correo verificado. Verifícalo allí y vuelve a intentarlo.',
    oauth_invalid_state: 'El inicio de sesión ha caducado. Vuelve a intentarlo.',
    oauth_provider_error: 'El servicio de inicio de sesión no ha respondido. Vuelve a intentarlo.',
    oauth_failed: 'El inicio de sesión ha fallado. Vuelve a intentarlo.',
    account_banned: 'Esta cuenta está expulsada o suspendida.',
    suspended: 'Cuenta suspendida hasta el {date}. Motivo: {reason}',
    banned: 'Cuenta expulsada. Motivo: {reason}',
    generic: 'Se ha producido un error. Vuelve a intentarlo más tarde.',
  },
};
