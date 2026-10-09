import type { Messages } from './en';

// Brazilian Portuguese.
export const pt: Messages = {
  meta: {
    description: '{name} muda seu rosto e sua voz ao vivo para o Discord e seus jogos.',
  },
  nav: {
    main: 'Navegação principal',
    skip: 'Ir para o conteúdo',
    features: 'Recursos',
    pricing: 'Preços',
    faq: 'Perguntas',
    download: 'Baixar',
    signIn: 'Entrar',
    account: 'Minha conta',
    language: 'Idioma',
  },
  footer: {
    privacy: 'Privacidade',
    cookies: 'Gerenciar cookies',
  },
  home: {
    live: 'Rosto e voz em tempo real',
    lead: '{name} transforma seu rosto e sua voz ao vivo e os envia ao Discord e aos seus jogos como uma câmera e um microfone comuns.',
    ctaRegister: 'Criar uma conta grátis',
    ctaFeatures: 'Ver os recursos',
    mascotAlt: '{mascot}, o mascote de {name}',
    demoTitle: 'Um clique e você é outra pessoa',
    demoText:
      'Escolha um rosto, escolha uma voz: o que seus amigos veem e ouvem muda enquanto você continua falando.',
    demoYou: 'Você',
    demoThem: 'O que eles veem',
    demoAlt:
      'Ilustração: à esquerda a imagem da sua webcam, à direita a mesma pessoa com outro rosto e outra voz.',
    appsTitle: 'Funciona onde você joga e conversa',
    appsOther: 'E qualquer aplicativo que aceite uma webcam ou um microfone.',
    apps: {
      discord: 'Chamadas, transmissões e canais de voz',
      roblox: 'Chat de voz e câmera nas suas experiências',
      valorant: 'Chat de voz com seu time',
      fortnite: 'Chat de voz com seu esquadrão',
      minecraft: 'Converse com seus amigos enquanto constrói',
      teamspeak: 'Canais de voz',
    },
    stepsTitle: 'Pronto em três passos',
    steps: [
      {
        title: 'Instale e entre',
        text: 'Baixe {name} para Windows e entre com sua conta gratuita.',
      },
      {
        title: 'Escolha um rosto e uma voz',
        text: 'Escolha no catálogo. A prévia mostra o resultado na hora.',
      },
      {
        title: 'Selecione-os no seu aplicativo',
        text: 'Escolha “{camera}” e “{microphone}” como câmera e microfone no Discord ou no seu jogo.',
      },
    ],
    featuresTitle: 'O que {name} faz',
    features: [
      {
        title: 'Um rosto novo, ao vivo',
        text: 'Escolha um rosto no catálogo: ele acompanha suas expressões em tempo real diante da webcam.',
      },
      {
        title: 'Uma voz nova, sem atraso',
        text: 'Sua voz é transformada enquanto você fala, pensada para continuar fluida no meio da partida.',
      },
      {
        title: 'Compatível com seus aplicativos',
        text: 'Selecione “{camera}” e “{microphone}” como câmera e microfone onde precisar.',
      },
      {
        title: 'Tudo acontece no seu PC',
        text: 'Sua câmera e seu microfone são processados na sua máquina. Sua imagem e sua voz não são enviadas para nós.',
      },
    ],
    pricingTitle: 'Grátis para começar',
    pricingText:
      'Alguns rostos e vozes são gratuitos. O Premium libera todo o catálogo, os rostos personalizados e a clonagem de voz.',
    pricingCta: 'Comparar planos',
  },
  features: {
    title: 'Recursos',
    description:
      'Troca de rosto e de voz em tempo real, câmera e microfone virtuais, perfis de desempenho: tudo o que {name} faz.',
    lead: '{name} é instalado no Windows e fica entre sua webcam, seu microfone e seus aplicativos.',
    groups: [
      {
        title: 'Rosto',
        items: [
          'Rostos predefinidos prontos para usar',
          'Rostos personalizados a partir de uma foto que você tem o direito de usar (Premium)',
          'Acompanhamento das expressões em tempo real',
        ],
      },
      {
        title: 'Voz',
        items: [
          'Vozes predefinidas prontas para usar',
          'Clonagem de uma voz que você tem o direito de usar (Premium)',
          'Transformação enquanto você fala',
        ],
      },
      {
        title: 'Câmera e microfone virtuais',
        items: [
          '“{camera}” e “{microphone}” aparecem na sua lista de dispositivos',
          'Compatível com {apps}',
          'E com qualquer aplicativo que use uma webcam ou um microfone padrão',
        ],
      },
      {
        title: 'Desempenho',
        items: [
          'Usa sua placa de vídeo quando disponível; caso contrário, seu processador',
          'Três perfis: desempenho máximo, equilibrado, economia de recursos',
          'Exibição opcional de quadros por segundo e latência',
        ],
      },
      {
        title: 'Conta e segurança',
        items: [
          'Lista dos seus dispositivos conectados, com desconexão remota',
          'Catálogo de rostos e vozes atualizado sem reinstalar o aplicativo',
          'Atualizações assinadas e verificadas antes da instalação',
        ],
      },
    ],
    note: 'O aplicativo está em desenvolvimento: alguns recursos chegarão depois da primeira versão. <a>Crie sua conta</a> para estar pronto no lançamento.',
  },
  pricing: {
    title: 'Preços',
    description:
      '{name} é grátis para começar. O Premium, por {price} ao mês, libera todos os rostos, todas as vozes e a clonagem de voz.',
    lead: 'Comece grátis. Assine o Premium quando quiser, cancele quando quiser.',
    free: 'Grátis',
    freeItems: [
      'Uma seleção de rostos predefinidos',
      'Uma seleção de vozes predefinidas',
      'Câmera e microfone virtuais',
      'Todos os perfis de desempenho',
    ],
    freeCta: 'Criar uma conta',
    premium: 'Premium',
    perMonth: '/ mês',
    premiumItems: [
      'Todos os rostos do catálogo',
      'Todas as vozes do catálogo',
      'Criação de rostos personalizados',
      'Clonagem de voz',
      'Recursos avançados',
    ],
    soon: 'Em breve',
    note: 'As assinaturas ainda não estão abertas. Preço com impostos incluídos, sem fidelidade.',
  },
  faq: {
    title: 'Perguntas frequentes',
    description:
      'Compatibilidade, requisitos, privacidade, assinatura: respostas às perguntas sobre {name}.',
    items: [
      {
        q: 'Com quais aplicativos {name} funciona?',
        a: 'Com {apps} e, de modo geral, qualquer aplicativo que permita escolher a webcam ou o microfone. Basta selecionar “{camera}” e “{microphone}” nas configurações dele.',
      },
      {
        q: 'O que é preciso para usar?',
        a: 'Um PC com Windows. Uma placa de vídeo recente oferece a melhor fluidez; sem ela, o aplicativo passa para o processador com um perfil mais leve.',
      },
      {
        q: 'Minha imagem e minha voz são enviadas aos seus servidores?',
        a: 'Não. A transformação acontece no seu PC. Nossos servidores cuidam da sua conta, da sua assinatura e do download de rostos e vozes.',
      },
      {
        q: 'Posso usar o rosto ou a voz de outra pessoa?',
        a: 'Somente com a permissão dela. Passar-se por uma pessoa real para enganar, assediar ou aplicar golpes é proibido e leva ao banimento da conta.',
      },
      {
        q: 'Preciso de uma conta?',
        a: 'Sim, o aplicativo pede para entrar. A conta é gratuita.',
      },
      {
        q: 'Quanto custa o Premium?',
        a: '{price} por mês, sem fidelidade. Ele libera todo o catálogo, os rostos personalizados e a clonagem de voz.',
      },
      {
        q: 'Como excluo minha conta ou recupero meus dados?',
        a: 'Escreva para {email}: tratamos o pedido e respondemos em até um mês.',
      },
    ],
  },
  download: {
    title: 'Baixar {name}',
    description: 'Baixar {name} para Windows.',
    soonTitle: 'Em breve',
    text: 'O aplicativo está em desenvolvimento. Crie sua conta agora: você vai usá-la para entrar no dia do lançamento.',
    button: 'Baixar para Windows',
    cta: 'Criar uma conta',
  },
  privacy: {
    title: 'Privacidade e cookies',
    description:
      'Quais dados {name} coleta, por quê, por quanto tempo e como exercer seus direitos.',
    controllerTitle: 'Quem é responsável pelos seus dados',
    publisherFallback: 'O editor de {name}',
    contact: 'Contato:',
    collectTitle: 'O que coletamos',
    collect: [
      '<b>Sua conta</b>: endereço de e-mail e senha (guardada apenas em forma de hash, nunca em texto puro).',
      '<b>Seus acessos</b>: nome do dispositivo, endereço IP e data, para mostrar suas sessões ativas e detectar um acesso suspeito.',
      '<b>A medição de audiência do site</b>, somente se você aceitar: páginas visitadas e site de origem, ligados a um identificador anônimo.',
    ],
    noMedia:
      'Não coletamos nem a imagem da sua câmera nem o som do seu microfone: a transformação acontece no seu PC.',
    cookiesTitle: 'Cookies',
    table: { name: 'Nome', role: 'Finalidade', duration: 'Duração', consent: 'Consentimento' },
    rt: {
      role: 'Manter você conectado. Ilegível para os scripts da página.',
      duration: '30 dias',
      consent: 'Não exigido (necessário para o serviço)',
    },
    vid: {
      role: 'Identificador anônimo para contar as visitas.',
      duration: '13 meses',
      consent: 'Exigido: só é gravado se você aceitar',
    },
    choice:
      'Sua escolha é lembrada por seis meses no seu navegador e depois perguntada de novo. Nenhum cookie de publicidade, nenhuma ferramenta de medição de terceiros. Você pode mudar de ideia a qualquer momento: <manage>Gerenciar cookies</manage>.',
    retentionTitle: 'Prazos de conservação',
    retention: [
      'Conta: até ser excluída.',
      'Medição de audiência: 25 meses, depois exclusão automática.',
    ],
    rightsTitle: 'Seus direitos',
    rights:
      'Você pode pedir acesso aos seus dados, sua correção, exclusão ou exportação escrevendo para <mail>{email}</mail>. Também pode apresentar uma reclamação à sua autoridade de proteção de dados (na França, a CNIL: cnil.fr).',
  },
  auth: {
    signInTitle: 'Entrar',
    email: 'Endereço de e-mail',
    password: 'Senha',
    signIn: 'Entrar',
    forgot: 'Esqueceu a senha?',
    createAccount: 'Criar uma conta',
    continueWith: 'Continuar com {provider}',
    or: 'ou',
    registerTitle: 'Criar uma conta',
    passwordNew: 'Senha (mínimo de 10 caracteres)',
    register: 'Criar minha conta',
    registerDone: 'Quase lá: abra o link que acabamos de enviar por e-mail para ativar sua conta.',
    already: 'Já tem conta? <a>Entrar</a>',
    forgotTitle: 'Esqueci a senha',
    forgotSubmit: 'Receber o link',
    forgotDone:
      'Se existir uma conta para este endereço, um link de redefinição acaba de ser enviado.',
    resetTitle: 'Nova senha',
    resetPassword: 'Nova senha (mínimo de 10 caracteres)',
    save: 'Salvar',
    resetDone: 'Senha alterada. Todos os seus dispositivos foram desconectados.',
    verifyTitle: 'Confirmação do e-mail',
    verifying: 'Verificando…',
    verified: 'Endereço confirmado. Você já pode entrar.',
  },
  account: {
    title: 'Minha conta',
    loading: 'Carregando…',
    plan: 'Assinatura',
    free: 'Grátis',
    premium: 'Premium',
    renews: 'Próxima renovação: {date}',
    notOpen: 'As assinaturas Premium ainda não estão abertas. <a>Ver os planos</a>',
    devices: 'Dispositivos conectados',
    thisDevice: 'este dispositivo',
    unknownIp: 'IP desconhecido',
    seen: '{ip} · visto em {date}',
    revoke: 'Desconectar',
    signOut: 'Sair',
    webBrowser: 'Navegador web',
  },
  consent: {
    title: 'Medição de audiência',
    text: 'Com sua permissão, um cookie anônimo nos permite contar as visitas e saber quais páginas são lidas. Sem publicidade, sem compartilhamento com terceiros. <a>Saiba mais</a>',
    refuse: 'Recusar',
    accept: 'Aceitar',
  },
  notFound: {
    title: 'Página não encontrada',
    text: 'Este endereço não existe ou deixou de existir.',
    back: 'Voltar ao início',
  },
  errors: {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_verified: 'Confirme primeiro seu endereço pelo link que enviamos por e-mail.',
    account_locked: 'Tentativas demais. Tente de novo em alguns minutos ou redefina sua senha.',
    rate_limited: 'Solicitações demais. Aguarde um pouco antes de tentar de novo.',
    invalid_request: 'Confira os campos: um e-mail válido e uma senha de pelo menos 10 caracteres.',
    invalid_or_expired_token: 'Este link não é mais válido. Solicite um novo.',
    network_error: 'Não foi possível contatar o servidor. Verifique sua conexão.',
    oauth_email_not_verified:
      'Esta conta do Google ou do Discord não tem um e-mail verificado. Verifique-o lá e tente de novo.',
    oauth_invalid_state: 'O acesso expirou. Tente de novo.',
    oauth_provider_error: 'O serviço de acesso não respondeu. Tente de novo.',
    oauth_failed: 'O acesso falhou. Tente de novo.',
    account_banned: 'Esta conta está banida ou suspensa.',
    suspended: 'Conta suspensa até {date}. Motivo: {reason}',
    banned: 'Conta banida. Motivo: {reason}',
    generic: 'Ocorreu um erro. Tente de novo mais tarde.',
  },
};
