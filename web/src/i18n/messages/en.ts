// English is the reference: its shape is the type every other language must match.
// {name}, {camera}, {microphone}, {apps}, {price}, {email} and {mascot} are filled in
// for every text (see ../index.ts). Other placeholders are filled where the text is used.
// <a>…</a>, <b>…</b> and similar tags mark the part of a sentence that becomes a link or bold.
export const en = {
  meta: {
    description: '{name} changes your face and voice live for Discord and your games.',
  },
  nav: {
    main: 'Main navigation',
    skip: 'Skip to content',
    features: 'Features',
    pricing: 'Pricing',
    faq: 'FAQ',
    download: 'Download',
    signIn: 'Sign in',
    account: 'My account',
    language: 'Language',
  },
  footer: {
    privacy: 'Privacy',
    cookies: 'Manage cookies',
  },
  home: {
    live: 'Face and voice in real time',
    lead: '{name} transforms your face and voice live, then sends them to Discord and your games as an ordinary camera and microphone.',
    ctaRegister: 'Create a free account',
    ctaFeatures: 'See the features',
    mascotAlt: '{mascot}, the {name} mascot',
    demoTitle: 'One click, a whole new you',
    demoText:
      'Pick a face, pick a voice: what your friends see and hear changes while you keep talking.',
    demoYou: 'You',
    demoThem: 'What they see',
    demoAlt:
      'Illustration: your webcam image on the left, and on the right the same person with a different face and voice.',
    appsTitle: 'Works where you play and chat',
    appsOther: 'And any app that accepts a webcam or a microphone.',
    apps: {
      discord: 'Calls, streams and voice channels',
      roblox: 'Voice chat and camera in your experiences',
      valorant: 'Voice chat with your team',
      fortnite: 'Voice chat with your squad',
      minecraft: 'Talk with your friends while you build',
      teamspeak: 'Voice channels',
    },
    stepsTitle: 'Ready in three steps',
    steps: [
      {
        title: 'Install and sign in',
        text: 'Download {name} for Windows and sign in with your free account.',
      },
      {
        title: 'Pick a face and a voice',
        text: 'Choose from the catalogue. The preview shows the result right away.',
      },
      {
        title: 'Select them in your app',
        text: 'Choose “{camera}” and “{microphone}” as camera and microphone in Discord or your game.',
      },
    ],
    featuresTitle: 'What {name} does',
    features: [
      {
        title: 'A new face, live',
        text: 'Pick a face from the catalogue: it follows your expressions in real time in front of your webcam.',
      },
      {
        title: 'A new voice, without lag',
        text: 'Your voice is transformed while you speak, built to stay smooth in the middle of a match.',
      },
      {
        title: 'Works with your apps',
        text: 'Select “{camera}” and “{microphone}” as camera and microphone wherever you need them.',
      },
      {
        title: 'Everything happens on your PC',
        text: 'Your camera and microphone are processed on your machine. Your image and voice are not sent to us.',
      },
    ],
    pricingTitle: 'Free to start',
    pricingText:
      'A few faces and voices are free. Premium unlocks the whole catalogue, custom faces and voice cloning.',
    pricingCta: 'Compare plans',
  },
  features: {
    title: 'Features',
    description:
      'Real-time face and voice changing, virtual camera and microphone, performance profiles: everything {name} does.',
    lead: '{name} installs on Windows and sits between your webcam, your microphone and your apps.',
    groups: [
      {
        title: 'Face',
        items: [
          'Ready-made preset faces',
          'Custom faces from a photo you have the right to use (Premium)',
          'Real-time expression tracking',
        ],
      },
      {
        title: 'Voice',
        items: [
          'Ready-made preset voices',
          'Cloning of a voice you have the right to use (Premium)',
          'Transformation while you speak',
        ],
      },
      {
        title: 'Virtual camera and microphone',
        items: [
          '“{camera}” and “{microphone}” appear in your list of devices',
          'Works with {apps}',
          'And with any app that uses a standard webcam or microphone',
        ],
      },
      {
        title: 'Performance',
        items: [
          'Uses your graphics card when available, your processor otherwise',
          'Three profiles: maximum performance, balanced, resource saver',
          'Optional display of frames per second and latency',
        ],
      },
      {
        title: 'Account and security',
        items: [
          'List of your signed-in devices, with remote sign-out',
          'Catalogue of faces and voices updated without reinstalling the app',
          'Updates signed and verified before installation',
        ],
      },
    ],
    note: 'The app is still in development: some features will arrive after the first release. <a>Create your account</a> to be ready at launch.',
  },
  pricing: {
    title: 'Pricing',
    description:
      '{name} is free to start. Premium at {price} per month unlocks every face, every voice and voice cloning.',
    lead: 'Start for free. Go Premium whenever you want, cancel whenever you want.',
    free: 'Free',
    freeItems: [
      'A selection of preset faces',
      'A selection of preset voices',
      'Virtual camera and microphone',
      'All performance profiles',
    ],
    freeCta: 'Create an account',
    premium: 'Premium',
    perMonth: '/ month',
    premiumItems: [
      'Every face in the catalogue',
      'Every voice in the catalogue',
      'Custom face creation',
      'Voice cloning',
      'Advanced features',
    ],
    soon: 'Coming soon',
    note: 'Subscriptions are not open yet. Price includes tax, no commitment.',
  },
  faq: {
    title: 'Frequently asked questions',
    description:
      'Compatibility, requirements, privacy, subscription: answers to the questions about {name}.',
    items: [
      {
        q: 'Which apps does {name} work with?',
        a: 'With {apps} and, more broadly, any app that lets you choose its webcam or microphone. Just select “{camera}” and “{microphone}” in its settings.',
      },
      {
        q: 'What do I need to run it?',
        a: 'A Windows PC. A recent graphics card gives the smoothest result; without one, the app falls back to the processor with a lighter profile.',
      },
      {
        q: 'Are my image and voice sent to your servers?',
        a: 'No. The transformation happens on your PC. Our servers handle your account, your subscription and the download of faces and voices.',
      },
      {
        q: 'Can I use someone else’s face or voice?',
        a: 'Only with their permission. Impersonating a real person to deceive, harass or scam is forbidden and gets the account banned.',
      },
      {
        q: 'Do I need an account?',
        a: 'Yes, the app asks you to sign in. The account is free.',
      },
      {
        q: 'How much is Premium?',
        a: '{price} per month, no commitment. It unlocks the whole catalogue, custom faces and voice cloning.',
      },
      {
        q: 'How do I delete my account or get my data?',
        a: 'Write to us at {email}: we handle the request and reply within one month.',
      },
    ],
  },
  download: {
    title: 'Download {name}',
    description: 'Download {name} for Windows.',
    soonTitle: 'Coming soon',
    text: 'The app is still in development. Create your account now: you will use it to sign in on release day.',
    button: 'Download for Windows',
    cta: 'Create an account',
  },
  privacy: {
    title: 'Privacy and cookies',
    description: 'What data {name} collects, why, for how long, and how to exercise your rights.',
    controllerTitle: 'Who is responsible for your data',
    publisherFallback: 'The publisher of {name}',
    contact: 'Contact:',
    collectTitle: 'What we collect',
    collect: [
      '<b>Your account</b>: email address and password (stored only as a hash, never in plain text).',
      '<b>Your sign-ins</b>: device name, IP address and date, to show you your active sessions and detect a suspicious sign-in.',
      '<b>Website audience measurement</b>, only if you accept it: pages visited and referring site, linked to an anonymous identifier.',
    ],
    noMedia:
      'We collect neither your camera image nor your microphone audio: the transformation happens on your PC.',
    cookiesTitle: 'Cookies',
    table: { name: 'Name', role: 'Purpose', duration: 'Duration', consent: 'Consent' },
    rt: {
      role: 'Keeps you signed in. Cannot be read by page scripts.',
      duration: '30 days',
      consent: 'Not required (necessary for the service)',
    },
    vid: {
      role: 'Anonymous identifier used to count visits.',
      duration: '13 months',
      consent: 'Required: set only if you accept',
    },
    choice:
      'Your choice is remembered for six months in your browser, then asked again. No advertising cookies, no third-party measurement tools. You can change your mind at any time: <manage>Manage cookies</manage>.',
    retentionTitle: 'Retention periods',
    retention: [
      'Account: until it is deleted.',
      'Audience measurement: 25 months, then deleted automatically.',
    ],
    rightsTitle: 'Your rights',
    rights:
      'You can ask to access, correct, delete or export your data by writing to <mail>{email}</mail>. You can also lodge a complaint with your data protection authority (in France, the CNIL: cnil.fr).',
  },
  auth: {
    signInTitle: 'Sign in',
    email: 'Email address',
    password: 'Password',
    signIn: 'Sign in',
    forgot: 'Forgot your password?',
    createAccount: 'Create an account',
    continueWith: 'Continue with {provider}',
    or: 'or',
    registerTitle: 'Create an account',
    passwordNew: 'Password (10 characters minimum)',
    register: 'Create my account',
    registerDone: 'Almost there: open the link we just emailed you to activate your account.',
    already: 'Already registered? <a>Sign in</a>',
    forgotTitle: 'Forgot your password',
    forgotSubmit: 'Send me the link',
    forgotDone: 'If an account exists for this address, a reset link has just been sent to it.',
    resetTitle: 'New password',
    resetPassword: 'New password (10 characters minimum)',
    save: 'Save',
    resetDone: 'Password changed. All your devices have been signed out.',
    verifyTitle: 'Email confirmation',
    verifying: 'Checking…',
    verified: 'Address confirmed. You can sign in.',
  },
  account: {
    title: 'My account',
    loading: 'Loading…',
    plan: 'Plan',
    free: 'Free',
    premium: 'Premium',
    renews: 'Next renewal: {date}',
    notOpen: 'Premium subscriptions are not open yet. <a>See the plans</a>',
    devices: 'Signed-in devices',
    thisDevice: 'this device',
    unknownIp: 'Unknown IP',
    seen: '{ip} · last seen {date}',
    revoke: 'Sign out',
    signOut: 'Sign out',
    webBrowser: 'Web browser',
  },
  consent: {
    title: 'Audience measurement',
    text: 'With your consent, an anonymous cookie lets us count visits and see which pages are read. No advertising, no sharing with third parties. <a>Learn more</a>',
    refuse: 'Decline',
    accept: 'Accept',
  },
  notFound: {
    title: 'Page not found',
    text: 'This address does not exist or no longer exists.',
    back: 'Back to home',
  },
  errors: {
    invalid_credentials: 'Incorrect email or password.',
    email_not_verified: 'First confirm your address using the link we emailed you.',
    account_locked: 'Too many attempts. Try again in a few minutes or reset your password.',
    rate_limited: 'Too many requests. Wait a little before trying again.',
    invalid_request: 'Check the fields: a valid email and a password of at least 10 characters.',
    invalid_or_expired_token: 'This link is no longer valid. Request a new one.',
    network_error: 'Cannot reach the server. Check your connection.',
    oauth_email_not_verified:
      'This Google or Discord account has no verified email address. Verify it there, then try again.',
    oauth_invalid_state: 'The sign-in expired. Try again.',
    oauth_provider_error: 'The sign-in service did not respond. Try again.',
    oauth_failed: 'Sign-in failed. Try again.',
    account_banned: 'This account is banned or suspended.',
    suspended: 'Account suspended until {date}. Reason: {reason}',
    banned: 'Account banned. Reason: {reason}',
    generic: 'Something went wrong. Try again later.',
  },
};

export type Messages = typeof en;
