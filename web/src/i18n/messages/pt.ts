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
    terms: 'Termos',
    refunds: 'Reembolsos',
    support: 'Suporte',
    creators: 'Criadores',
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
      '<b>A medição de audiência do site</b>, somente se você aceitar: páginas visitadas, site de origem, data e hora da visita, e país (deduzido do seu endereço IP, que não é guardado), ligados a um identificador anônimo.',
      '<b>O login com Google ou Discord</b>, se você escolher: o endereço de e-mail e o identificador de conta que esse serviço nos transmite. Nunca recebemos sua senha.',
      '<b>As candidaturas ao programa de criadores</b>: o nome, o endereço de e-mail, o link do canal e a mensagem que você escreve no formulário.',
    ],
    basisTitle: 'O que nos permite usá-los',
    basis: [
      'Conta e acessos: fornecer o serviço em que você se cadastrou, e nosso interesse legítimo em proteger as contas.',
      'Medição de audiência: seu consentimento, que você pode retirar a qualquer momento.',
      'Candidaturas de criadores: responder a um pedido que você fez, antes de qualquer parceria.',
    ],
    recipientsTitle: 'Quem os recebe',
    recipients:
      'Seus dados nunca são vendidos. Eles só são tratados pelos fornecedores que hospedam o serviço e entregam nossos e-mails, seguindo nossas instruções.',
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
      'Candidaturas de criadores: 12 meses, depois exclusão automática.',
    ],
    rightsTitle: 'Seus direitos',
    rights:
      'Você pode pedir acesso aos seus dados, sua correção, exclusão ou exportação escrevendo para <mail>{email}</mail>. Também pode apresentar uma reclamação à sua autoridade de proteção de dados (na França, a CNIL: cnil.fr).',
  },
  legal: {
    updated: 'Última atualização: {date}',
  },
  terms: {
    title: 'Termos de uso',
    description:
      'As regras para usar {name}: sua conta, o que é permitido, Premium e seus direitos.',
    sections: [
      {
        title: 'O serviço',
        body: [
          '{name} é um aplicativo para Windows que muda seu rosto e sua voz ao vivo e os envia aos seus outros aplicativos como uma câmera e um microfone comuns. Estes termos valem a partir do momento em que você cria uma conta ou usa o aplicativo ou este site.',
          'O aplicativo ainda está em desenvolvimento: recursos podem mudar, aparecer ou ser removidos.',
        ],
      },
      {
        title: 'Sua conta',
        body: [
          'Você precisa de uma conta para usar o aplicativo. Informe um endereço de e-mail que você consulta, não compartilhe sua senha e avise-nos logo se achar que outra pessoa está usando sua conta.',
          'Você precisa ter pelo menos 15 anos. Se tiver menos de 18, precisa da autorização de um dos pais ou do responsável legal.',
        ],
      },
      {
        title: 'O que é permitido',
        body: [
          'Use apenas rostos e vozes que você tem o direito de usar. Rostos personalizados e vozes clonadas exigem a autorização da pessoa a quem pertencem.',
          'É proibido se passar por uma pessoa real para enganar, assediar, aplicar golpes ou prejudicar alguém, criar conteúdo ilegal, ou burlar os limites do seu plano ou as proteções do aplicativo.',
          'Você continua responsável por respeitar as regras dos aplicativos e jogos com os quais usa {name}.',
        ],
      },
      {
        title: 'Grátis e Premium',
        body: [
          'O plano gratuito dá acesso a uma seleção de rostos e vozes. O Premium custa {price} por mês e libera o restante. As assinaturas ainda não estão abertas: o preço e as condições serão exibidos antes de qualquer pagamento.',
          'Cancelamentos e reembolsos estão descritos na nossa <refunds>política de reembolso</refunds>.',
        ],
      },
      {
        title: 'Suspensão e encerramento da conta',
        body: [
          'Se estes termos forem desrespeitados, podemos suspender ou banir a conta. O motivo é exibido quando você tenta entrar, e você pode contestá-lo escrevendo para <mail>{email}</mail>.',
          'Você pode pedir a exclusão da sua conta a qualquer momento no mesmo endereço.',
        ],
      },
      {
        title: 'Propriedade',
        body: [
          'O aplicativo, seu catálogo de rostos e vozes, a marca e este site pertencem a nós. Sua conta dá a você um direito de uso pessoal, que não pode ser revendido nem transferido.',
          'O que você cria com {name} continua sendo seu.',
        ],
      },
      {
        title: 'Disponibilidade e responsabilidade',
        body: [
          'Fazemos o possível para manter o serviço funcionando, mas não podemos prometer que ele nunca será interrompido. Não somos responsáveis pela forma como um aplicativo ou jogo de terceiros reage à câmera ou ao microfone virtuais.',
          'Nada nestes termos retira os direitos que a lei garante a você como consumidor, incluindo a garantia legal de conformidade.',
        ],
      },
      {
        title: 'Alterações destes termos',
        body: [
          'Se mudarmos algo importante, avisamos por e-mail ou neste site antes que a mudança entre em vigor. Se não concordar, você pode encerrar sua conta.',
        ],
      },
      {
        title: 'Lei aplicável e contato',
        body: [
          'Estes termos são regidos pela lei francesa. Se você mora em outro país da União Europeia, mantém a proteção das regras obrigatórias do seu país.',
          'Uma dúvida ou uma reclamação? Escreva para <mail>{email}</mail> ou veja a <support>página de suporte</support>. O uso dos seus dados está descrito na <privacy>página de privacidade</privacy>.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Política de reembolso',
    description: 'Quando e como obter o reembolso de um pagamento do {name} Premium.',
    sections: [
      {
        title: 'Em resumo',
        body: [
          'O plano gratuito não custa nada, então não há o que reembolsar. As assinaturas Premium ainda não estão abertas: esta política vale a partir do dia em que abrirem.',
        ],
      },
      {
        title: '14 dias para mudar de ideia',
        body: [
          'Você tem 14 dias a partir do seu primeiro pagamento do Premium para pedir o reembolso integral, sem precisar dar um motivo.',
        ],
      },
      {
        title: 'Cancelamento e renovações',
        body: [
          'Você pode cancelar quando quiser. O Premium continua ativo até o fim do período já pago e nenhum outro pagamento é cobrado.',
          'Um período já iniciado não é reembolsado em parte, exceto nos casos abaixo ou quando a lei exigir.',
        ],
      },
      {
        title: 'Pagamento cobrado por engano',
        body: [
          'Um pagamento cobrado duas vezes, ou cobrado depois do seu cancelamento, é reembolsado integralmente.',
          'Se o Premium parar de funcionar por nossa causa por muito tempo, escreva para nós: reembolsamos o tempo perdido.',
        ],
      },
      {
        title: 'Como pedir',
        body: [
          'Escreva para <mail>{email}</mail> a partir do endereço de e-mail da sua conta, informando a data do pagamento. Respondemos por e-mail, e um reembolso aceito é devolvido ao meio de pagamento utilizado em até 14 dias.',
          'Veja também os <terms>termos de uso</terms>.',
        ],
      },
    ],
  },
  support: {
    title: 'Suporte',
    description: 'Obtenha ajuda com {name}: conta, instalação, assinatura e seus dados.',
    lead: 'Um problema ou uma dúvida? Escreva para nós, uma pessoa vai ler sua mensagem.',
    faq: 'Muitas respostas já estão nas <a>perguntas frequentes</a>.',
    emailButton: 'Escrever para {email}',
    topicsTitle: 'Para uma resposta mais rápida',
    topics: [
      {
        title: 'Conta e login',
        text: 'Escreva a partir do endereço de e-mail da sua conta e diga o que aparece na tela. Nunca pedimos sua senha.',
      },
      {
        title: 'Um erro no aplicativo',
        text: 'Informe sua versão do Windows, sua placa de vídeo, o aplicativo ou jogo com o qual você usa {name} e o que estava fazendo quando aconteceu.',
      },
      {
        title: 'Assinatura e reembolsos',
        text: 'Informe a data do pagamento. As regras estão na <refunds>política de reembolso</refunds>.',
      },
      {
        title: 'Seus dados',
        text: 'Para acessar, corrigir, exportar ou excluir seus dados, basta um e-mail: respondemos em até um mês. Detalhes na <privacy>página de privacidade</privacy>.',
      },
    ],
  },
  creators: {
    title: 'Programa de criadores',
    description:
      'Streamers e criadores de vídeo: ganhe o {name} Premium de graça e acesso antecipado a novos rostos e vozes.',
    badge: 'Programa de criadores',
    heading: 'Você cria, <b>a gente dá o Premium</b>.',
    lead: 'Você faz lives ou vídeos? Entre no programa de criadores do {name} e aproveite de graça tudo o que o aplicativo sabe fazer.',
    cta: 'Candidatar-se',
    offerTitle: 'O que oferecemos aos criadores',
    offers: [
      {
        title: 'Premium de graça',
        text: 'Todos os rostos, todas as vozes, rostos personalizados e clonagem de voz, enquanto você fizer parte do programa. A partir do dia em que o Premium abrir.',
      },
      {
        title: 'As novidades antes de todo mundo',
        text: 'Teste novos rostos e vozes com antecedência e conte o que achou.',
      },
      {
        title: 'Contato direto com a equipe',
        text: 'Uma dúvida, uma ideia, um problema no meio da live? Você fala direto com a gente.',
      },
    ],
    whoTitle: 'Quem pode se candidatar',
    who: [
      'Você publica com regularidade na Twitch, no YouTube, no TikTok, no Kick ou em outro lugar',
      'Você atinge uma audiência mínima: informamos os critérios exatos em particular, na nossa resposta',
      'Seu conteúdo respeita as regras da plataforma em que você publica',
      'Você tem pelo menos 18 anos',
    ],
    rulesTitle: 'O que pedimos em troca',
    rules: [
      'Dizer claramente ao seu público que você ganhou o Premium de graça quando mostrar o {name}',
      'Respeitar os <terms>termos de uso</terms>: nunca se passar por uma pessoa real para enganar',
      'Nada mais: sem cota de vídeos, sem roteiro para ler',
    ],
    formTitle: 'Candidatar-se',
    formLead:
      'Lemos todas as candidaturas e respondemos por e-mail. Nem todas as candidaturas são aceitas.',
  },
  creatorForm: {
    name: 'Nome ou apelido',
    platform: 'Plataforma principal',
    other: 'Outra',
    channelUrl: 'Link do seu canal',
    message: 'Conte sobre o seu conteúdo (opcional)',
    submit: 'Enviar minha candidatura',
    done: 'Candidatura recebida. Respondemos por e-mail.',
    notice:
      'Usamos estas informações apenas para analisar sua candidatura e responder a você. Elas são excluídas após 12 meses. <a>Saiba mais</a>',
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
    signInLead: 'Que bom ver você de novo. Seus rostos e vozes estão esperando.',
    registerLead: 'Grátis, e pronto em menos de um minuto.',
    registerDoneTitle: 'Confira seu e-mail',
    showPassword: 'Mostrar a senha',
    hidePassword: 'Ocultar a senha',
    showcaseTitle: 'Um novo rosto, uma nova voz, <b>ao vivo</b>.',
    perks: [
      'Grátis para começar, sem cartão bancário',
      'Funciona com o Discord e seus jogos',
      'Sua imagem e sua voz nunca saem do seu PC',
    ],
    statUsers: 'usuários',
    statApps: 'aplicativos compatíveis',
    statLocal: 'processado no seu PC',
  },
  admin: {
    title: 'Painel',
    live: 'Ao vivo, atualizado a cada 15 segundos',
    forbidden: 'Esta página é reservada aos administradores.',
    periods: { day: '24 horas', week: '7 dias', month: '30 dias', year: '12 meses' },
    visitors: 'Visitantes',
    views: 'Páginas vistas',
    signups: 'Contas novas',
    applications: 'Candidaturas de criadores',
    accounts: 'Contas',
    verified: 'Contas verificadas',
    activeToday: 'Ativas nas últimas 24 horas',
    premium: 'Assinantes Premium',
    total: 'no período',
    topPages: 'Páginas mais vistas',
    topReferrers: 'De onde vêm os visitantes',
    none: 'Nada por enquanto.',
    sections: {
      overview: 'Visão geral',
      audience: 'Audiência',
      accounts: 'Contas',
      creators: 'Criadores',
    },
    traffic: 'Tráfego do site',
    growth: 'Evolução do número de contas',
    countries: 'Países dos visitantes',
    hours: 'Horários de visita',
    hoursNote: 'Páginas vistas por hora do dia, no seu fuso horário.',
    unknownCountry: 'Não localizado',
    locationNote:
      'O país é deduzido do endereço IP no momento da visita; o endereço em si nunca é guardado.',
    search: 'Buscar um e-mail',
    bannedOnly: 'Apenas sancionados',
    roleAdmin: 'Admin',
    unverified: 'Não verificado',
    joined: 'Cadastrado em {date}',
    lastSeen: 'visto em {date}',
    banned: 'Banido',
    suspendedUntil: 'Suspenso até {date}',
    ban: 'Banir',
    unban: 'Retirar a sanção',
    sanction: 'Sanção',
    permanent: 'Banimento definitivo',
    suspension: 'Suspensão, {period}',
    reason: 'Motivo (mostrado à pessoa)',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    consentNote: 'Visitantes e páginas vistas contam apenas quem aceitou a medição de audiência.',
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
    invalid_application:
      'Confira os campos: um nome, um e-mail válido e um link para o seu canal começando com https://.',
    generic: 'Ocorreu um erro. Tente de novo mais tarde.',
  },
};
