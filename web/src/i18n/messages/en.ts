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
    terms: 'Terms',
    refunds: 'Refunds',
    support: 'Support',
    creators: 'Creators',
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
      '<b>Website audience measurement</b>, only if you accept it: pages visited, referring site, date and time of the visit, and country (worked out from your IP address, which is not stored), linked to an anonymous identifier.',
      '<b>Sign-in with Google or Discord</b>, if you choose it: the email address and the account identifier that service gives us. We never receive your password.',
      '<b>Creator program applications</b>: the name, email address, channel link and message you type in the form.',
    ],
    basisTitle: 'Why we are allowed to use them',
    basis: [
      'Account and sign-ins: to provide the service you signed up for, and for our legitimate interest in keeping accounts secure.',
      'Audience measurement: your consent, which you can withdraw at any time.',
      'Creator applications: to answer a request you made, before any partnership.',
    ],
    recipientsTitle: 'Who receives them',
    recipients:
      'Your data is never sold. It is only handled by the providers that host the service and deliver our emails, on our instructions.',
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
      'Creator applications: 12 months, then deleted automatically.',
    ],
    rightsTitle: 'Your rights',
    rights:
      'You can ask to access, correct, delete or export your data by writing to <mail>{email}</mail>. You can also lodge a complaint with your data protection authority (in France, the CNIL: cnil.fr).',
  },
  legal: {
    updated: 'Last updated: {date}',
  },
  terms: {
    title: 'Terms of use',
    description:
      'The rules for using {name}: your account, what is allowed, Premium and your rights.',
    sections: [
      {
        title: 'The service',
        body: [
          '{name} is a Windows app that changes your face and your voice live and sends them to your other apps as an ordinary camera and microphone. These terms apply as soon as you create an account or use the app or this website.',
          'The app is still in development: features can change, appear or be removed.',
        ],
      },
      {
        title: 'Your account',
        body: [
          'You need an account to use the app. Give an email address you can read, keep your password to yourself, and tell us quickly if you think someone else is using your account.',
          'You must be at least 15 years old. If you are under 18, you need the agreement of a parent or guardian.',
        ],
      },
      {
        title: 'What is allowed',
        body: [
          'Use only faces and voices you have the right to use. Custom faces and cloned voices require the permission of the person they belong to.',
          'It is forbidden to pass yourself off as a real person to deceive, harass, defraud or harm someone, to create illegal content, or to get around the limits of your plan or the protections of the app.',
          'You remain responsible for following the rules of the apps and games you use {name} with.',
        ],
      },
      {
        title: 'Free and Premium',
        body: [
          'The free plan gives access to a selection of faces and voices. Premium costs {price} per month and unlocks the rest. Subscriptions are not open yet: the price and the conditions will be shown before any payment.',
          'Cancellations and refunds are covered by our <refunds>refund policy</refunds>.',
        ],
      },
      {
        title: 'Suspension and closing your account',
        body: [
          'If these terms are broken, we can suspend or ban the account. The reason is shown when you try to sign in, and you can contest it by writing to <mail>{email}</mail>.',
          'You can ask us to delete your account at any time at the same address.',
        ],
      },
      {
        title: 'Ownership',
        body: [
          'The app, its catalogue of faces and voices, the brand and this website belong to us. Your account gives you a personal right to use them, which you cannot resell or transfer.',
          'What you create with {name} stays yours.',
        ],
      },
      {
        title: 'Availability and liability',
        body: [
          'We do our best to keep the service running, but we cannot promise it will never be interrupted. We are not liable for how a third-party app or game reacts to the virtual camera or microphone.',
          'Nothing in these terms removes the rights the law gives you as a consumer, including the legal guarantee of conformity.',
        ],
      },
      {
        title: 'Changes to these terms',
        body: [
          'If we change something important, we tell you by email or on this website before it applies. If you disagree, you can close your account.',
        ],
      },
      {
        title: 'Law and contact',
        body: [
          'These terms are governed by French law. If you live in another country of the European Union, you keep the protection of the mandatory rules of your country.',
          'A question or a complaint? Write to <mail>{email}</mail> or see the <support>support page</support>. How we handle your data is described on the <privacy>privacy page</privacy>.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Refund policy',
    description: 'When and how to get a {name} Premium payment refunded.',
    sections: [
      {
        title: 'In short',
        body: [
          'The free plan costs nothing, so there is nothing to refund. Premium subscriptions are not open yet: this policy applies from the day they open.',
        ],
      },
      {
        title: '14 days to change your mind',
        body: [
          'You have 14 days from your first Premium payment to ask for a full refund, without giving a reason.',
        ],
      },
      {
        title: 'Cancelling and renewals',
        body: [
          'You can cancel whenever you want. Premium then stays active until the end of the period already paid, and no further payment is taken.',
          'A period that has started is not refunded in part, except in the cases below or where the law requires it.',
        ],
      },
      {
        title: 'Payment taken by mistake',
        body: [
          'A payment taken twice, or taken after you cancelled, is refunded in full.',
          'If Premium stops working because of us for a long time, write to us: we refund the time lost.',
        ],
      },
      {
        title: 'How to ask',
        body: [
          'Write to <mail>{email}</mail> from the email address of your account, with the date of the payment. We answer by email, and an accepted refund is sent back to the payment method you used within 14 days.',
          'See also the <terms>terms of use</terms>.',
        ],
      },
    ],
  },
  support: {
    title: 'Support',
    description: 'Get help with {name}: account, installation, subscription and your data.',
    lead: 'A problem or a question? Write to us, a person will read your message.',
    faq: 'Many answers are already in the <a>FAQ</a>.',
    emailButton: 'Write to {email}',
    topicsTitle: 'To get a faster answer',
    topics: [
      {
        title: 'Account and sign-in',
        text: 'Write from the email address of your account and tell us what you see on screen. We never ask for your password.',
      },
      {
        title: 'A bug in the app',
        text: 'Tell us your Windows version, your graphics card, the app or game you use {name} with, and what you were doing when it happened.',
      },
      {
        title: 'Subscription and refunds',
        text: 'Give the date of the payment. The rules are in the <refunds>refund policy</refunds>.',
      },
      {
        title: 'Your data',
        text: 'To access, correct, export or delete your data, a simple email is enough: we answer within one month. Details on the <privacy>privacy page</privacy>.',
      },
    ],
  },
  creators: {
    title: 'Creator program',
    description:
      'Streamers and video creators: get {name} Premium for free and early access to new faces and voices.',
    badge: 'Creator program',
    heading: 'You create, <b>we give you Premium</b>.',
    lead: 'You stream or make videos? Join the {name} creator program and get everything the app can do, for free.',
    cta: 'Apply',
    offerTitle: 'What we give creators',
    offers: [
      {
        title: 'Premium for free',
        text: 'Every face, every voice, custom faces and voice cloning, for as long as you are in the program. Starts the day Premium opens.',
      },
      {
        title: 'New things before everyone else',
        text: 'Try new faces and voices early and tell us what you think of them.',
      },
      {
        title: 'A direct line to the team',
        text: 'A question, an idea, a problem in the middle of a stream? You talk to us directly.',
      },
    ],
    whoTitle: 'Who can apply',
    who: [
      'You publish regularly on Twitch, YouTube, TikTok, Kick or elsewhere',
      'You reach a minimum audience: we share the exact criteria privately, in our reply',
      'Your content follows the rules of the platform you publish on',
      'You are at least 18 years old',
    ],
    rulesTitle: 'What we ask in return',
    rules: [
      'Say clearly to your audience that you got Premium for free when you show {name}',
      'Follow the <terms>terms of use</terms>: never pass yourself off as a real person to deceive',
      'Nothing else: no quota of videos, no script to read',
    ],
    formTitle: 'Apply',
    formLead: 'We read every application and reply by email. Not every application is accepted.',
  },
  creatorForm: {
    name: 'Name or handle',
    platform: 'Main platform',
    other: 'Other',
    channelUrl: 'Link to your channel',
    message: 'Tell us about your content (optional)',
    submit: 'Send my application',
    done: 'Application received. We reply by email.',
    notice:
      'We only use these details to review your application and reply to you. They are deleted after 12 months. <a>Learn more</a>',
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
    signInLead: 'Welcome back. Your faces and voices are waiting.',
    registerLead: 'Free, and ready in under a minute.',
    registerDoneTitle: 'Check your inbox',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    showcaseTitle: 'A new face, a new voice, <b>live</b>.',
    perks: [
      'Free to start, no bank card needed',
      'Works with Discord and your games',
      'Your image and voice never leave your PC',
    ],
    statUsers: 'users',
    statApps: 'compatible apps',
    statLocal: 'processed on your PC',
  },
  admin: {
    title: 'Dashboard',
    live: 'Live, refreshed every 15 seconds',
    forbidden: 'This page is reserved for administrators.',
    periods: { day: '24 hours', week: '7 days', month: '30 days', year: '12 months' },
    visitors: 'Visitors',
    views: 'Page views',
    signups: 'New accounts',
    applications: 'Creator applications',
    accounts: 'Accounts',
    verified: 'Verified accounts',
    activeToday: 'Active in the last 24 hours',
    premium: 'Premium subscribers',
    total: 'over the period',
    topPages: 'Most viewed pages',
    topReferrers: 'Where visitors come from',
    none: 'Nothing yet.',
    sections: {
      overview: 'Overview',
      audience: 'Audience',
      accounts: 'Accounts',
      creators: 'Creators',
    },
    traffic: 'Website traffic',
    growth: 'Number of accounts over time',
    countries: 'Visitor countries',
    hours: 'Visiting hours',
    hoursNote: 'Page views by hour of the day, in your time zone.',
    unknownCountry: 'Not located',
    locationNote:
      'The country is worked out from the IP address at the time of the visit; the address itself is never stored.',
    search: 'Search an email',
    bannedOnly: 'Sanctioned only',
    roleAdmin: 'Admin',
    unverified: 'Unverified',
    joined: 'Joined {date}',
    lastSeen: 'last seen {date}',
    banned: 'Banned',
    suspendedUntil: 'Suspended until {date}',
    ban: 'Ban',
    unban: 'Lift the sanction',
    sanction: 'Sanction',
    permanent: 'Permanent ban',
    suspension: 'Suspension, {period}',
    reason: 'Reason (shown to the person)',
    confirm: 'Confirm',
    cancel: 'Cancel',
    consentNote: 'Visitors and page views only count people who accepted audience measurement.',
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
    invalid_application:
      'Check the fields: a name, a valid email and a link to your channel starting with https://.',
    generic: 'Something went wrong. Try again later.',
  },
};

export type Messages = typeof en;
