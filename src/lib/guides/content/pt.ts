import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primeiros passos', text: 'Crie a sua conta, entre e descubra o seu painel.' },
    promote: { title: 'Promover a KUMANI', text: 'Convide quem conhece com o seu link e use os vouchers.' },
    wallet: { title: 'A carteira', text: 'Cartão, pontos, donativos, badges e recibos num só lugar.' },
    promoteTools: { title: "Ferramentas para promover", text: "Os guias dos serviços que o ajudam a dar a conhecer a KUMANI." },
    security: { title: "Segurança", text: "Os guias dos serviços que o ajudam a reconhecer e travar as burlas." },
    community: { title: "Comunidade", text: "Os guias dos serviços para se conhecerem, ajudarem e jogarem juntos." },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'Como registar-se',
      summary: 'Crie a sua conta KUMANI em poucos minutos e ative-a com o código que recebe por email.',
      minutes: 3,
      steps: [
        {
          title: 'Abra a KUMANI e toque em «Começar agora»',
          text: 'Na página inicial, toque no botão dourado «Começar agora», no canto superior direito. Se alguém lhe enviou o link de convite, abra-o: o código é preenchido automaticamente.',
        },
        {
          title: 'Preencha os seus dados',
          text: 'Escreva nome, apelido, email e uma palavra-passe com pelo menos 6 caracteres; depois escolha o seu país e a sua cidade.',
          tip: 'Use um email que consulte com frequência: é para lá que vai o código para ativar a conta.',
        },
        {
          title: 'Código de convite e voucher (opcionais)',
          text: 'Se um Kumano o convidou, escreva o código de convite dele. Se recebeu um voucher KUMANI, introduza-o no campo «Código de voucher de ativação»: a sua subscrição fica ativa de imediato. Se tem uma loja, um consultório ou um negócio, assinale «Sou profissional». Depois toque em «Crie a sua conta».',
        },
        {
          title: 'Verifique o seu email',
          text: 'Enviamos-lhe um código por email. Escreva-o no campo «Código de verificação» e toque em «Verificar e ativar conta». Pronto: já está dentro!',
          tip: 'Não encontra o email? Veja na pasta de spam ou toque em «Reenviar código».',
        },
      ],
      cta: { label: 'Crie a sua conta', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'Como entrar',
      summary: 'Entre na sua conta e recupere a palavra-passe se a esqueceu.',
      minutes: 2,
      steps: [
        {
          title: 'Introduza email e palavra-passe',
          text: 'Na página inicial, toque em «Entrar», escreva o email e a palavra-passe que escolheu ao registar-se e toque em «Entrar».',
        },
        {
          title: 'Esqueceu-se da palavra-passe?',
          text: 'Toque em «Esqueceu-se da palavra-passe?» por baixo do botão de entrada.',
        },
        {
          title: 'Reponha a palavra-passe',
          text: 'Escreva o seu email e toque em «Repor Palavra-passe»: enviamos-lhe um código para escolher uma nova. Depois entre com a nova palavra-passe.',
          tip: 'Pode adicionar a KUMANI ao ecrã principal do telemóvel: abre como uma app.',
        },
      ],
      cta: { label: 'Ir para a entrada', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'O seu painel',
      summary: 'O que encontra no painel e como chegar aos serviços que mais usa.',
      minutes: 3,
      steps: [
        {
          title: 'A barra superior',
          text: 'Em cima muda o idioma, abre o seu perfil e a carteira, e sai da conta. A estrela leva-o aos seus serviços favoritos.',
        },
        {
          title: 'Os serviços gratuitos',
          text: 'No nível «Grátis» estão os serviços incluídos para todos os inscritos, sem limite de tempo. Toque em «Abrir» para os usar e na pequena estrela para os adicionar aos favoritos.',
        },
        {
          title: 'Os três níveis de serviços',
          text: 'Os serviços dividem-se em três níveis: Grátis, Base e Pro. Com a subscrição Base ou Pro desbloqueia todos os serviços do nível; com um Pass pode ativar também um único serviço.',
        },
        {
          title: 'Pontos, subscrição e código de convite',
          text: 'Mais abaixo vê os KU Karma que acumula todos os dias ao entrar, o estado da sua subscrição (com «Subscreva agora» ou «Ativar com Voucher») e o seu código de convite pessoal.',
        },
        {
          title: 'A Comunidade e as outras páginas',
          text: 'No fim encontra a sua Comunidade KUMANI e as ligações rápidas para as outras páginas: Comunidade, carteira e Mural.',
        },
      ],
      cta: { label: 'Abrir o painel', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Convidar com o seu link',
      summary: 'Partilhe o seu código ou link de convite e acompanhe quem entra na sua estrela KUMANI.',
      minutes: 3,
      steps: [
        {
          title: 'O seu código de convite',
          text: 'No painel encontra o seu código de convite pessoal. Toque no ícone ao lado para o copiar: quem se regista com o seu link entra na sua estrela KUMANI.',
        },
        {
          title: 'Partilhe o link',
          text: 'Na página Comunidade tem o seu link pronto: copie-o, toque em «Convidar pelo WhatsApp» ou «Partilhar…» para o enviar com Instagram, Telegram e as outras apps do telemóvel.',
          tip: 'Uma mensagem pessoal resulta melhor do que uma enviada a todos: conte porque é que a KUMANI lhe é útil.',
        },
        {
          title: 'A sua estrela KUMANI',
          text: 'A estrela mostra as 5 pessoas que convidou diretamente e quantas pessoas ativas há sob cada posição. Quem se registou mas ainda não ativou a subscrição aparece em «Ainda não KUMANI».',
        },
        {
          title: 'Como ganha KU Points',
          text: 'As regras estão na carteira: recebe KU Points quando uma pessoa que convidou ativa a subscrição pagando com cartão ou passa a Pro, e com o Bónus Acolhimento.',
        },
      ],
      cta: { label: 'Abrir a sua Comunidade', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Criar e usar vouchers',
      summary: 'Transforme os KU Points em vouchers para oferecer e ative um voucher que recebeu.',
      minutes: 3,
      steps: [
        {
          title: 'Resgate um pacote de pontos',
          text: 'Na carteira, na secção dos vouchers, gaste os seus KU Points para resgatar um pacote: recebe um crédito em euros para criar vouchers. Por baixo de cada pacote vê quantos pontos lhe faltam.',
        },
        {
          title: 'Crie um voucher',
          text: 'Com o crédito escolha o plano (Base ou Pro, um ano) e se o voucher é para oferecer ou para vender; depois toque em «Criar voucher».',
        },
        {
          title: 'Recebeu um voucher?',
          text: 'Escreva o código no campo «Recebeu um voucher?» e toque em «Resgatar»: a sua subscrição fica ativa de imediato. Também o pode introduzir ao registar-se.',
        },
      ],
      cta: { label: 'Ir para os vouchers', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Usar a carteira',
      summary: 'O seu cartão, os pontos, os donativos, os badges e os recibos: eis o que encontra na carteira.',
      minutes: 4,
      steps: [
        {
          title: 'O seu cartão Membership',
          text: 'No topo está o seu cartão KUMANI com número de membro, plano ativo e validade. Pode guardar o código QR com «Descarregar QR».',
        },
        {
          title: 'Os seus pontos',
          text: 'Aqui vê os KU Karma, que se ganham todos os dias ao entrar e ao usar as ferramentas, e os KU Points, que recebe quando uma pessoa que convidou ativa a subscrição. Os pontos não são dinheiro e só se usam dentro da plataforma.',
        },
        {
          title: 'Doe os seus KU Points',
          text: 'Na secção Donativos pode doar os seus KU Points à associação apoiada pela KUMANI: cada 10 pontos doados = 1 €, que a KUMANI entrega à associação.',
        },
        {
          title: 'Os badges',
          text: 'Os badges Kuman Green, Kuman Star e Kuman Black desbloqueiam-se com o total de KU Points ganhos. A barra diz-lhe quantos pontos faltam para o seguinte.',
        },
        {
          title: 'Recibos, cupões e desconto na renovação',
          text: 'Mais abaixo encontra os Recibos digitais (plano Pro), os cupões obtidos no Ecossistema e o desconto na renovação da subscrição que pode obter com os KU Karma.',
        },
      ],
      cta: { label: 'Abrir a carteira', href: '/wallet' },
    },
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "QR Code dinâmico",
      summary: "Crie o QR code do seu link de convite, escolha as cores e descarregue-o para imprimir ou partilhar.",
      minutes: 2,
      steps: [
        {
          title: "O seu link já está lá dentro",
          text: "O QR leva ao seu link de convite pessoal. O «Link de destino» está bloqueado: assim, quem o lê entra sempre na sua estrela KUMANI."
        },
        {
          title: "Escolha as cores",
          text: "Mude a «Cor do QR Code» e a «Cor de Fundo», ou toque num dos «Temas rápidos».",
          tip: "Mantenha um bom contraste entre o QR e o fundo: um QR demasiado claro lê-se mal."
        },
        {
          title: "Descarregue o QR",
          text: "Veja a pré-visualização e toque em «Descarregar PNG»: a imagem é de alta resolução, boa também para impressão."
        },
        {
          title: "Onde usá-lo",
          text: "Imprima-o em cartões de visita e folhetos, partilhe-o nas redes sociais ou junte-o à assinatura dos seus emails."
        }
      ],
      cta: {
        label: "Abrir o QR Code dinâmico",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "Mensagens WhatsApp",
      summary: "Mensagens prontas com o seu link de convite: escolha o tom certo e envie em segundos.",
      minutes: 2,
      steps: [
        {
          title: "Escolha a mensagem",
          text: "Há 4 mensagens para situações diferentes: informal, formal, emocional e depois de um encontro. O seu link de convite já está no texto."
        },
        {
          title: "Copie ou envie",
          text: "Toque em «Enviar no WhatsApp» para abrir o WhatsApp com a mensagem pronta e escolha a quem a enviar. Ou toque em «Copiar mensagem» e cole-a onde quiser, até noutra app.",
          tip: "No WhatsApp pode alterar o texto antes de o enviar: acrescente o nome da pessoa."
        },
        {
          title: "Dicas para mensagens eficazes",
          text: "Personalize sempre a mensagem, não a envie a demasiadas pessoas ao mesmo tempo e, depois, faça uma chamada ou envie uma mensagem de voz."
        }
      ],
      cta: {
        label: "Abrir Mensagens WhatsApp",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Crie a sua página pessoal com os seus links, para pôr na bio do Instagram, TikTok e das outras redes.",
      minutes: 3,
      steps: [
        {
          title: "Escreva a sua bio",
          text: "No campo «Texto da Bio» escreva uma frase sobre si: aparece por baixo do seu nome."
        },
        {
          title: "Cor e temas especiais",
          text: "Escolha a cor da página. Os temas especiais (Aurora boreal, Lua sobre o lago, Savana ao pôr do sol) aparecem em pré-visualização ao tocar neles: os KU Karma só são usados se decidir desbloqueá-los."
        },
        {
          title: "Adicione os seus links e guarde",
          text: "Toque em «Adicionar Link» para pôr os seus links (site, redes, loja…): o seu link de convite KUMANI está sempre lá. Depois toque em «Guardar Página».",
          tip: "Mais abaixo vê a pré-visualização da página."
        },
        {
          title: "Partilhe a sua página",
          text: "Copie o link da página e ponha-o na bio das suas redes, ou toque em «Visite a sua Link in Bio» para a ver. Lembre-se de guardar antes de partilhar."
        }
      ],
      cta: {
        label: "Abrir Link in Bio",
        href: "/marketplace/link-in-bio"
      }
    },
    {
      slug: "spotlight",
      category: "promoteTools",
      title: "Kumano do Dia",
      summary: "Conte a sua história e entre na montra da comunidade: todos os dias um Kumano fica em destaque. Reservado a subscritores ativos.",
      minutes: 3,
      steps: [
        {
          title: "Conte a sua história",
          text: "Preencha nome ou alcunha (nunca o apelido), cidade, país, profissão ou paixão e uma história curta, que se leia em 20 segundos."
        },
        {
          title: "Escolha as suas ferramentas preferidas",
          text: "Toque nas ferramentas KUMANI que mais usa: aparecem junto da sua história."
        },
        {
          title: "Consentimentos e envio",
          text: "Assinale o consentimento para ser mostrado à comunidade (o da página inicial é opcional) e toque em «Guardar e entrar na montra». O Staff KUMANI aprova a história e depois ela entra na rotação do Kumano do Dia.",
          tip: "Pode retirar a sua história da montra ou da página inicial quando quiser, a partir desta mesma página."
        }
      ],
      cta: {
        label: "Conte a sua história",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Encontre encontros, workshops e serões da comunidade, inscreva-se com um toque e entre com o seu passe.",
      minutes: 3,
      steps: [
        {
          title: "Encontre um evento",
          text: "Pesquise por cidade, país, idioma e data, ou toque em «Só online» para os eventos online."
        },
        {
          title: "Inscreva-se e receba o passe",
          text: "Abra o evento e toque em «Participar»: recebe logo o passe com QR, que encontra em «Os meus passes». Mostre-o à entrada: o organizador lê-o e já está dentro.",
          tip: "Se o evento estiver cheio pode entrar na lista de espera: se vagar um lugar, entra automaticamente."
        },
        {
          title: "Organize um evento",
          text: "Quer organizar um encontro na sua cidade ou online? Toque em «Organizar um evento»."
        },
        {
          title: "Torne-se organizador verificado",
          text: "Para organizar eventos é preciso ser um Kumano Verificado: toque em «Torne-se organizador verificado» e siga os passos. Depois, em «Os meus eventos», gere inscritos e check-in."
        }
      ],
      cta: {
        label: "Abrir KUMANI Events",
        href: "/events"
      }
    },
    {
      slug: "antitruffa",
      category: "security",
      title: "Manual Antiburla",
      summary: "As burlas mais comuns, com exemplos reais e o que fazer de imediato: leia-o, guarde-o e partilhe-o com quem ama.",
      minutes: 2,
      steps: [
        {
          title: "Descarregue-o ou imprima-o",
          text: "No topo, toque em «Descarregar ou imprimir o manual»: abre-se a impressão do telemóvel ou do computador, onde também o pode guardar em PDF."
        },
        {
          title: "Partilhe-o com quem ama",
          text: "Envie-o a pais, avós e amigos por WhatsApp, Facebook, Telegram, X, LinkedIn ou email, ou copie o link. Quem se regista a partir do seu link entra na sua rede."
        },
        {
          title: "O teste dos 10 segundos",
          text: "Antes de clicar, responder ou pagar, faça a si próprio as 6 perguntas do teste: se uma só resposta for «sim», é quase de certeza uma burla.",
          tip: "Logo abaixo estão as 6 regras de ouro: bastam para evitar a maioria das burlas."
        },
        {
          title: "Escolha um capítulo",
          text: "A partir do índice vá ao capítulo de que precisa: emails e SMS, chamadas, à porta de casa, chats, compras, investimentos… Toque numa burla para a abrir e ler exemplos e o que fazer. No fim encontra o que fazer de imediato se foi burlado."
        }
      ],
      cta: {
        label: "Abrir o Manual Antiburla",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "Verificar IBAN",
      summary: "Verifique o IBAN antes de uma transferência: se está bem escrito, de que país é e que sinais vigiar.",
      minutes: 2,
      steps: [
        {
          title: "Cole o IBAN",
          text: "Cole o IBAN que lhe deram, com ou sem espaços, e toque em «Verificar o IBAN». Tudo acontece no seu telemóvel: o IBAN não é enviado nem guardado."
        },
        {
          title: "Leia o resultado",
          text: "Vê se o IBAN está bem escrito e de que país é. Nos IBAN italianos vê também as suas partes: CIN, ABI (o banco), CAB (a agência) e número de conta.",
          tip: "Se houver um erro, dizemos-lhe onde: por exemplo um carácter em falta ou dois números trocados."
        },
        {
          title: "Para que está a pagar?",
          text: "Escolha a resposta mais próxima (um particular, uma casa de férias, uma loja online, um investimento…) e o seu país: mostramos-lhe os sinais a que deve estar atento."
        },
        {
          title: "Antes de fazer a transferência",
          text: "Lembre-se: um IBAN válido não garante que o destinatário seja honesto. Leia os conselhos antes de pagar: uma transferência imediata não pode ser anulada."
        }
      ],
      cta: {
        label: "Abrir Verificar IBAN",
        href: "/marketplace/verifica-iban"
      }
    },
    {
      slug: "checkmail",
      category: "security",
      title: "CheckMail",
      summary: "Recebeu um e-mail suspeito? Carregue-o ou copie-o: verificamos remetente, links, anexos e texto e dizemos-lhe qual o risco.",
      minutes: 3,
      steps: [
        {
          title: "Escolha como carregar o e-mail",
          text: "Há três formas: «Carregar o ficheiro» (o e-mail guardado como .eml ou .msg, a mais completa), «Colar o código-fonte» ou «No telemóvel». Cada uma tem instruções para Gmail, Outlook e outros programas."
        },
        {
          title: "Introduza o e-mail e analise-o",
          text: "No telemóvel basta copiar remetente, assunto e texto com os links e depois tocar em «Analisar o e-mail».",
          tip: "Por baixo do botão vê quantas análises lhe restam hoje."
        },
        {
          title: "O nível de risco",
          text: "O resultado diz-lhe se o risco é baixo, médio ou alto e enumera o que encontrámos: remetente falso, links encurtados, pressa, pedidos de dados…"
        },
        {
          title: "O que fazer",
          text: "Siga os conselhos: por exemplo não clique, não abra anexos e não responda. Com «Analisar outro e-mail» recomeça.",
          tip: "O CheckMail dá indícios, não certezas: na dúvida, contacte a empresa pelos seus canais oficiais."
        }
      ],
      cta: {
        label: "Abrir CheckMail",
        href: "/marketplace/checkmail"
      }
    },
    {
      slug: "verifoto",
      category: "security",
      title: "VeriFoto",
      summary: "Verifique se uma foto é verdadeira ou se foi criada ou retocada com inteligência artificial, antes de confiar.",
      minutes: 2,
      steps: [
        {
          title: "Escolha a foto",
          text: "Toque em «Escolher uma foto» e escolha a imagem a verificar (JPG, PNG ou WebP até 15 MB). Os controlos básicos são feitos no seu telemóvel."
        },
        {
          title: "O risco de ser IA ou retocada",
          text: "Vê um veredito e uma percentagem de risco: 0–30% baixo, 31–69% incerto, 70–100% alto. Por baixo estão os indícios encontrados, como certificados digitais e dados da câmara."
        },
        {
          title: "O mapa de retoques",
          text: "Toque em «Mapa de retoques»: as zonas muito mais claras do que o resto podem indicar partes coladas ou retocadas. É uma ajuda visual, não uma prova."
        },
        {
          title: "Segunda opinião e foto original",
          text: "Para um controlo extra use o detetor de IA: aceite o envio de uma cópia reduzida da foto e toque em «Analisar com o detetor de IA». Com o Google Lens ou o TinEye procura se a mesma foto já existe online.",
          tip: "O VeriFoto dá indícios, não certezas: na dúvida, não confie."
        }
      ],
      cta: {
        label: "Abrir VeriFoto",
        href: "/marketplace/verifoto"
      }
    },
    {
      slug: "documento-sicuro",
      category: "security",
      title: "Documento Seguro",
      summary: "Antes de enviar a foto de um documento, acrescente um texto com o motivo e a data e tape os dados que não são precisos.",
      minutes: 3,
      steps: [
        {
          title: "Escolha a foto do documento",
          text: "Toque em «Escolher uma foto» para a tirar da galeria ou em «Tirar uma foto». A foto fica no seu telemóvel: não é carregada nem guardada."
        },
        {
          title: "Tape os dados que não são precisos",
          text: "Toque em «Tapar uma zona» e arraste o dedo sobre a foto para pôr um retângulo preto sobre o número do documento, a assinatura ou a foto, se não lhos pediram.",
          tip: "Também lhe dizemos se a foto tem dados escondidos, como a localização GPS: na cópia descarregada já não estão."
        },
        {
          title: "Acrescente o texto de proteção",
          text: "Escolha para que a envia (arrendamento, banco, trabalho, compra online…) e a quem: o texto com motivo e data repete-se na diagonal por toda a foto. Pode mudar o texto, a visibilidade, o tamanho e a cor.",
          tip: "Use um texto diferente para cada pessoa: se a cópia circular, saberá de onde saiu."
        },
        {
          title: "Descarregue ou envie a cópia",
          text: "Toque em «Descarregar a cópia protegida» ou «Partilhar»: obtém uma cópia nova com o texto e as zonas tapadas, sem dados escondidos. O original não é alterado."
        }
      ],
      cta: {
        label: "Abrir Documento Seguro",
        href: "/marketplace/documento-sicuro"
      }
    },
    {
      slug: "listings",
      category: "community",
      title: "Anúncios da Comunidade",
      summary: "Publique serviços e produtos, procure o que precisa e escreva a quem publicou.",
      minutes: 3,
      steps: [
        {
          title: "Procure um anúncio",
          text: "Escreva o que procura, escolha categoria, país e cidade e toque em «Pesquisar». Os anúncios em montra aparecem primeiro."
        },
        {
          title: "Publique o seu anúncio",
          text: "Toque em «Novo Anúncio»: publicá-lo custa alguns KU Karma, que vê no botão. Escreva título, categoria e descrição; preço e imagem são opcionais.",
          tip: "Se não tiver KU Karma suficientes, entre todos os dias para os acumular. Os anúncios valem 30 dias e depois pode republicá-los com um clique."
        },
        {
          title: "Onde fica",
          text: "Escolha país e cidade. Para serviços e consultorias assinale «Disponível também online / à distância»: o anúncio aparece em todas as cidades do país."
        },
        {
          title: "Montra (opcional)",
          text: "Pode destacar logo o anúncio na secção Em Montra com KU Points, escolhendo por quantos dias. Depois toque em «Publicar Anúncio»."
        },
        {
          title: "As suas mensagens",
          text: "Em «As minhas mensagens» encontra as conversas com quem lhe escreveu sobre um anúncio ou a quem escreveu. Para a sua privacidade, as mensagens são apagadas automaticamente após 30 dias."
        }
      ],
      cta: {
        label: "Abrir os Anúncios",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Ajude alguém durante uma hora e ganhe uma hora, para gastar quando precisar de uma mão.",
      minutes: 3,
      steps: [
        {
          title: "1 hora = 1 hora",
          text: "Ajuda alguém durante uma hora e ganha uma hora, que usa quando precisar de ajuda. As horas não valem dinheiro e não se convertem em pontos nem descontos."
        },
        {
          title: "Verifique e participe",
          text: "Toque em «Verificar e participar»: é preciso estar registado há pelo menos 30 dias, ter o perfil completo, ser maior de idade, ter a identidade verificada (número fiscal ou documento) e aceitar as regras. Depois cria o seu perfil e recebe as horas de boas-vindas.",
          tip: "Pode verificar a identidade e aceitar as regras já, mesmo que ainda falte algum requisito."
        },
        {
          title: "Peça ou ofereça ajuda",
          text: "No quadro filtre pedidos e ofertas por categoria, presencial ou online, e cidade. Publique com «Pedir ajuda» ou «Oferecer ajuda», ou responda com «Ofereço-me»: as horas passam de um saldo para o outro quando ambos confirmam."
        },
        {
          title: "Trocas seguras",
          text: "Da primeira vez encontrem-se num local público ou online. Ninguém deve pedir-lhe dinheiro, presentes ou dados bancários; nada de consultorias profissionais nem trabalhos perigosos. Se algo correr mal, denuncie: o Staff intervém."
        }
      ],
      cta: {
        label: "Abrir a Time Bank",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Compras em grupo entre Kumani: juntos compra-se melhor, diretamente ao produtor ou à loja.",
      minutes: 3,
      steps: [
        {
          title: "Juntos compra-se melhor",
          text: "Um Kumano propõe uma compra em grupo a um produtor ou a uma loja e os outros aderem: atingido o mínimo, a encomenda avança e cada um paga diretamente ao fornecedor."
        },
        {
          title: "Adira a uma Kordata",
          text: "Em «Abertos» encontra as Kordate ativas, por categoria (comida e vinho, tecnologia, viagens e eventos, casa e energia…). Abra a que lhe interessa e toque em «Aderir»: avisamos quando o mínimo for atingido. Em «Os meus» encontra aquelas em que participa.",
          tip: "Depois de aderir vê quem participa e pode escrever no chat do grupo."
        },
        {
          title: "Proponha uma Kordata",
          text: "Toque em «Propor uma Kordata». Para proteger quem adere é preciso tornar-se organizador: subscrição ativa há pelo menos 30 dias, perfil completo, identidade verificada e regras do organizador aceites."
        },
        {
          title: "Como se paga",
          text: "A KUMANI não gere pagamentos: atingido o mínimo, cada um paga diretamente ao fornecedor seguindo as instruções do organizador, que responde pelo que propõe."
        }
      ],
      cta: {
        label: "Abrir Kordata",
        href: "/marketplace/convivio"
      }
    },
    {
      slug: "affinity",
      category: "community",
      title: "KUMANI Affinity",
      summary: "Um jogo de 20 perguntas para descobrir o seu arquétipo, desafiar um amigo e conhecer pessoas em sintonia consigo.",
      minutes: 3,
      steps: [
        {
          title: "Responda a 20 perguntas",
          text: "Toque em «Começar o jogo» e responda a 20 perguntas rápidas: não há respostas certas ou erradas.",
          tip: "Guardamos só o seu mapa (5 valores) e o arquétipo, nunca as respostas. Pode apagá-lo quando quiser."
        },
        {
          title: "O seu arquétipo e o seu mapa",
          text: "No fim descobre o seu arquétipo KUMANI e o seu Mapa de Afinidade em 5 valores: aventura, valores, ritmo, curiosidade e calor. Pode partilhá-lo ou jogar outra vez."
        },
        {
          title: "Jogue em Duo",
          text: "Toque em «Enviar o link Duo» e envie-o a um amigo ou ao parceiro: faz o jogo, mesmo sem se registar, e descobrem logo a vossa compatibilidade."
        },
        {
          title: "Affinity Amizades",
          text: "Todas as semanas a Kumi apresenta-lhe algumas pessoas em sintonia consigo. Escolha as línguas que fala, acrescente uma frase sobre si, dê o consentimento e toque em «Ativar as apresentações». O chat só abre se ambos disserem que sim.",
          tip: "Participam só pessoas subscritoras e maiores de idade que escolheram participar. Pode bloquear, denunciar ou pausar quando quiser."
        }
      ],
      cta: {
        label: "Abrir Affinity",
        href: "/marketplace/affinity"
      }
    },
    {
      slug: "veritas",
      category: "community",
      title: "Veritas",
      summary: "O jogo «Quem está a mentir?» de 3 a 8 jogadores: os amigos podem jogar mesmo sem se registarem.",
      minutes: 2,
      steps: [
        {
          title: "Crie uma sala",
          text: "Escreva a sua alcunha, escolha a língua das perguntas e o número de rondas e toque em «Criar a sala». Convide os amigos com o link ou o código: de 3 a 8 jogadores, mesmo sem registo."
        },
        {
          title: "Entre com um código",
          text: "Se um amigo já criou uma sala, escreva o código dele e toque em «Entrar na sala»."
        },
        {
          title: "Como se joga",
          text: "Em cada ronda chega uma pergunta: todos escrevem a verdade, exceto um que inventa em segredo. Leiam as respostas anónimas e votem em quem mente. Quem descobre o mentiroso ganha 1 ponto; o mentiroso ganha 1 ponto por cada pessoa enganada."
        }
      ],
      cta: {
        label: "Abrir Veritas",
        href: "/marketplace/veritas"
      }
    },
  ],
}

export default content
