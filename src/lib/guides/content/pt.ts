import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primeiros passos', text: 'Crie a sua conta, entre e descubra o seu painel.' },
    promote: { title: 'Promover a KUMANI', text: 'Convide quem conhece com o seu link e use os vouchers.' },
    wallet: { title: 'A carteira', text: 'Cartão, pontos, donativos, badges e recibos num só lugar.' },
    promoteTools: { title: "Ferramentas para promover", text: "Os guias dos serviços que o ajudam a dar a conhecer a KUMANI." },
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
          text: 'As regras estão na carteira: recebe KU Points quando uma pessoa que convidou ativa a subscrição pagando com cartão ou passa a Pro, e com o Bónus Estrutura.',
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
  ],
}

export default content
