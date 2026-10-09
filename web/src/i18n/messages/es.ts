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
    terms: 'Condiciones',
    refunds: 'Reembolsos',
    support: 'Ayuda',
    creators: 'Creadores',
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
      '<b>La medición de audiencia del sitio</b>, solo si la aceptas: páginas visitadas, sitio de procedencia, fecha y hora de la visita, y país (deducido de tu dirección IP, que no se guarda), asociados a un identificador anónimo.',
      '<b>El inicio de sesión con Google o Discord</b>, si lo eliges: la dirección de correo y el identificador de cuenta que ese servicio nos transmite. Nunca recibimos tu contraseña.',
      '<b>Las solicitudes al programa de creadores</b>: el nombre, la dirección de correo, el enlace del canal y el mensaje que escribes en el formulario.',
    ],
    basisTitle: 'Qué nos permite utilizarlos',
    basis: [
      'Cuenta e inicios de sesión: prestar el servicio en el que te registraste, y nuestro interés legítimo en proteger las cuentas.',
      'Medición de audiencia: tu consentimiento, que puedes retirar en cualquier momento.',
      'Solicitudes de creadores: responder a una petición que has hecho, antes de cualquier colaboración.',
    ],
    recipientsTitle: 'Quién los recibe',
    recipients:
      'Tus datos nunca se venden. Solo los tratan los proveedores que alojan el servicio y envían nuestros correos, siguiendo nuestras instrucciones.',
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
      'Solicitudes de creadores: 12 meses, después se eliminan automáticamente.',
    ],
    rightsTitle: 'Tus derechos',
    rights:
      'Puedes solicitar el acceso a tus datos, su rectificación, su supresión o su exportación escribiendo a <mail>{email}</mail>. También puedes presentar una reclamación ante tu autoridad de protección de datos (en Francia, la CNIL: cnil.fr).',
  },
  legal: {
    updated: 'Última actualización: {date}',
  },
  terms: {
    title: 'Condiciones de uso',
    description:
      'Las reglas para usar {name}: tu cuenta, lo que está permitido, Premium y tus derechos.',
    sections: [
      {
        title: 'El servicio',
        body: [
          '{name} es una aplicación para Windows que cambia tu cara y tu voz en directo y las envía a tus otras aplicaciones como una cámara y un micrófono normales. Estas condiciones se aplican desde que creas una cuenta o usas la aplicación o este sitio.',
          'La aplicación sigue en desarrollo: algunas funciones pueden cambiar, aparecer o desaparecer.',
        ],
      },
      {
        title: 'Tu cuenta',
        body: [
          'Necesitas una cuenta para usar la aplicación. Indica una dirección de correo que consultes, no compartas tu contraseña y avísanos pronto si crees que otra persona usa tu cuenta.',
          'Debes tener al menos 15 años. Si eres menor de 18, necesitas el permiso de tu padre, madre o tutor legal.',
        ],
      },
      {
        title: 'Lo que está permitido',
        body: [
          'Usa solo caras y voces que tengas derecho a usar. Las caras personalizadas y las voces clonadas exigen el permiso de la persona a la que pertenecen.',
          'Está prohibido hacerte pasar por una persona real para engañar, acosar, estafar o perjudicar a alguien, crear contenido ilegal, o saltarte los límites de tu plan o las protecciones de la aplicación.',
          'Sigues siendo responsable de respetar las reglas de las aplicaciones y los juegos con los que usas {name}.',
        ],
      },
      {
        title: 'Gratis y Premium',
        body: [
          'El plan gratuito da acceso a una selección de caras y voces. Premium cuesta {price} al mes y desbloquea el resto. Las suscripciones aún no están abiertas: el precio y las condiciones se mostrarán antes de cualquier pago.',
          'Las cancelaciones y los reembolsos se explican en nuestra <refunds>política de reembolso</refunds>.',
        ],
      },
      {
        title: 'Suspensión y cierre de la cuenta',
        body: [
          'Si no se respetan estas condiciones, podemos suspender o expulsar la cuenta. El motivo se muestra cuando intentas iniciar sesión, y puedes impugnarlo escribiendo a <mail>{email}</mail>.',
          'Puedes pedirnos que eliminemos tu cuenta en cualquier momento en la misma dirección.',
        ],
      },
      {
        title: 'Propiedad',
        body: [
          'La aplicación, su catálogo de caras y voces, la marca y este sitio nos pertenecen. Tu cuenta te da un derecho de uso personal, que no puedes revender ni ceder.',
          'Lo que creas con {name} sigue siendo tuyo.',
        ],
      },
      {
        title: 'Disponibilidad y responsabilidad',
        body: [
          'Hacemos todo lo posible para que el servicio funcione, pero no podemos prometer que nunca se interrumpa. No somos responsables de cómo reacciona una aplicación o un juego de terceros a la cámara o al micrófono virtuales.',
          'Nada en estas condiciones elimina los derechos que la ley te reconoce como consumidor, incluida la garantía legal de conformidad.',
        ],
      },
      {
        title: 'Cambios en estas condiciones',
        body: [
          'Si cambiamos algo importante, te avisamos por correo o en este sitio antes de que se aplique. Si no estás de acuerdo, puedes cerrar tu cuenta.',
        ],
      },
      {
        title: 'Ley aplicable y contacto',
        body: [
          'Estas condiciones se rigen por la ley francesa. Si vives en otro país de la Unión Europea, conservas la protección de las normas imperativas de tu país.',
          '¿Una pregunta o una reclamación? Escribe a <mail>{email}</mail> o consulta la <support>página de ayuda</support>. El uso de tus datos se describe en la <privacy>página de privacidad</privacy>.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Política de reembolso',
    description: 'Cuándo y cómo obtener el reembolso de un pago de {name} Premium.',
    sections: [
      {
        title: 'En resumen',
        body: [
          'El plan gratuito no cuesta nada, así que no hay nada que reembolsar. Las suscripciones Premium aún no están abiertas: esta política se aplicará desde el día en que se abran.',
        ],
      },
      {
        title: '14 días para cambiar de opinión',
        body: [
          'Tienes 14 días desde tu primer pago de Premium para pedir un reembolso completo, sin dar ningún motivo.',
        ],
      },
      {
        title: 'Cancelación y renovaciones',
        body: [
          'Puedes cancelar cuando quieras. Premium sigue activo hasta el final del periodo ya pagado y no se cobra ningún pago más.',
          'Un periodo ya empezado no se reembolsa en parte, salvo en los casos siguientes o cuando la ley lo exija.',
        ],
      },
      {
        title: 'Pago cobrado por error',
        body: [
          'Un pago cobrado dos veces, o cobrado después de tu cancelación, se reembolsa por completo.',
          'Si Premium deja de funcionar por nuestra culpa durante mucho tiempo, escríbenos: reembolsamos el tiempo perdido.',
        ],
      },
      {
        title: 'Cómo pedirlo',
        body: [
          'Escribe a <mail>{email}</mail> desde la dirección de correo de tu cuenta, indicando la fecha del pago. Respondemos por correo, y un reembolso aceptado se devuelve al medio de pago utilizado en un plazo de 14 días.',
          'Consulta también las <terms>condiciones de uso</terms>.',
        ],
      },
    ],
  },
  support: {
    title: 'Ayuda',
    description: 'Obtén ayuda con {name}: cuenta, instalación, suscripción y tus datos.',
    lead: '¿Un problema o una pregunta? Escríbenos, una persona leerá tu mensaje.',
    faq: 'Muchas respuestas ya están en las <a>preguntas frecuentes</a>.',
    emailButton: 'Escribir a {email}',
    topicsTitle: 'Para una respuesta más rápida',
    topics: [
      {
        title: 'Cuenta e inicio de sesión',
        text: 'Escribe desde la dirección de correo de tu cuenta y dinos qué ves en pantalla. Nunca te pedimos tu contraseña.',
      },
      {
        title: 'Un fallo en la aplicación',
        text: 'Indica tu versión de Windows, tu tarjeta gráfica, la aplicación o el juego con el que usas {name} y qué estabas haciendo cuando ocurrió.',
      },
      {
        title: 'Suscripción y reembolsos',
        text: 'Indica la fecha del pago. Las reglas están en la <refunds>política de reembolso</refunds>.',
      },
      {
        title: 'Tus datos',
        text: 'Para acceder a tus datos, corregirlos, exportarlos o eliminarlos basta con un correo: respondemos en el plazo de un mes. Más detalles en la <privacy>página de privacidad</privacy>.',
      },
    ],
  },
  creators: {
    title: 'Programa de creadores',
    description:
      'Streamers y creadores de vídeo: consigue {name} Premium gratis y acceso anticipado a las nuevas caras y voces.',
    badge: 'Programa de creadores',
    heading: 'Tú creas, <b>nosotros te regalamos Premium</b>.',
    lead: '¿Haces directos o vídeos? Únete al programa de creadores de {name} y disfruta gratis de todo lo que la aplicación sabe hacer.',
    cta: 'Enviar solicitud',
    offerTitle: 'Lo que ofrecemos a los creadores',
    offers: [
      {
        title: 'Premium gratis',
        text: 'Todas las caras, todas las voces, las caras personalizadas y la clonación de voz, mientras formes parte del programa. Desde el día en que se abra Premium.',
      },
      {
        title: 'Las novedades antes que nadie',
        text: 'Prueba las nuevas caras y voces por adelantado y dinos qué te parecen.',
      },
      {
        title: 'Contacto directo con el equipo',
        text: '¿Una pregunta, una idea, un problema en pleno directo? Hablas directamente con nosotros.',
      },
    ],
    whoTitle: 'Quién puede solicitarlo',
    who: [
      'Publicas con regularidad en Twitch, YouTube, TikTok, Kick u otra plataforma',
      'Alcanzas una audiencia mínima: te comunicamos los criterios exactos en privado, en nuestra respuesta',
      'Tu contenido respeta las reglas de la plataforma donde publicas',
      'Tienes al menos 18 años',
    ],
    rulesTitle: 'Lo que pedimos a cambio',
    rules: [
      'Decir claramente a tu público que recibiste Premium gratis cuando muestres {name}',
      'Respetar las <terms>condiciones de uso</terms>: nunca hacerte pasar por una persona real para engañar',
      'Nada más: sin cuota de vídeos, sin guion que leer',
    ],
    formTitle: 'Enviar solicitud',
    formLead:
      'Leemos todas las solicitudes y respondemos por correo. No todas las solicitudes se aceptan.',
  },
  creatorForm: {
    name: 'Nombre o alias',
    platform: 'Plataforma principal',
    other: 'Otra',
    channelUrl: 'Enlace a tu canal',
    message: 'Háblanos de tu contenido (opcional)',
    submit: 'Enviar mi solicitud',
    done: 'Solicitud recibida. Te respondemos por correo.',
    notice:
      'Solo usamos estos datos para estudiar tu solicitud y responderte. Se eliminan al cabo de 12 meses. <a>Más información</a>',
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
    signInLead: 'Qué bien verte de nuevo. Tus caras y tus voces te esperan.',
    registerLead: 'Gratis, y listo en menos de un minuto.',
    registerDoneTitle: 'Revisa tu correo',
    showPassword: 'Mostrar la contraseña',
    hidePassword: 'Ocultar la contraseña',
    showcaseTitle: 'Una cara nueva, una voz nueva, <b>en directo</b>.',
    perks: [
      'Gratis para empezar, sin tarjeta bancaria',
      'Funciona con Discord y tus juegos',
      'Tu imagen y tu voz nunca salen de tu PC',
    ],
    statUsers: 'usuarios',
    statApps: 'aplicaciones compatibles',
    statLocal: 'procesado en tu PC',
  },
  admin: {
    title: 'Panel de control',
    live: 'En directo, actualizado cada 15 segundos',
    forbidden: 'Esta página está reservada a los administradores.',
    periods: { day: '24 horas', week: '7 días', month: '30 días', year: '12 meses' },
    visitors: 'Visitantes',
    views: 'Páginas vistas',
    signups: 'Cuentas nuevas',
    applications: 'Solicitudes de creadores',
    accounts: 'Cuentas',
    verified: 'Cuentas verificadas',
    activeToday: 'Activas en las últimas 24 horas',
    premium: 'Suscriptores Premium',
    total: 'en el periodo',
    topPages: 'Páginas más vistas',
    topReferrers: 'De dónde vienen los visitantes',
    none: 'Nada por ahora.',
    sections: {
      overview: 'Resumen',
      audience: 'Audiencia',
      accounts: 'Cuentas',
      creators: 'Creadores',
    },
    traffic: 'Tráfico del sitio',
    growth: 'Evolución del número de cuentas',
    countries: 'Países de los visitantes',
    hours: 'Horas de visita',
    hoursNote: 'Páginas vistas por hora del día, en tu zona horaria.',
    unknownCountry: 'Sin localizar',
    locationNote:
      'El país se deduce de la dirección IP en el momento de la visita; la dirección en sí nunca se guarda.',
    search: 'Buscar un correo',
    bannedOnly: 'Solo sancionados',
    roleAdmin: 'Admin',
    unverified: 'Sin verificar',
    joined: 'Registrado el {date}',
    lastSeen: 'visto el {date}',
    banned: 'Expulsado',
    suspendedUntil: 'Suspendido hasta el {date}',
    ban: 'Expulsar',
    unban: 'Levantar la sanción',
    sanction: 'Sanción',
    permanent: 'Expulsión definitiva',
    suspension: 'Suspensión, {period}',
    reason: 'Motivo (se muestra a la persona)',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    consentNote:
      'Los visitantes y las páginas vistas solo cuentan a quienes aceptaron la medición de audiencia.',
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
    invalid_application:
      'Revisa los campos: un nombre, un correo válido y un enlace a tu canal que empiece por https://.',
    generic: 'Se ha producido un error. Vuelve a intentarlo más tarde.',
  },
};
