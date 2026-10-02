import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Premiers pas', text: 'Créez votre compte, connectez-vous et découvrez votre tableau de bord.' },
    promote: { title: 'Promouvoir KUMANI', text: 'Invitez vos proches avec votre lien et utilisez les vouchers.' },
    wallet: { title: 'Le portefeuille', text: 'Carte, points, dons, badges et reçus au même endroit.' },
    promoteTools: { title: "Outils pour promouvoir", text: "Les guides des services qui vous aident à faire connaître KUMANI." },
    security: { title: "Sécurité", text: "Les guides des services qui vous aident à reconnaître et à stopper les arnaques." },
    community: { title: "Communauté", text: "Les guides des services pour se rencontrer, s’entraider et jouer ensemble." },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'Comment s’inscrire',
      summary: 'Créez votre compte KUMANI en quelques minutes et activez-le avec le code reçu par e-mail.',
      minutes: 3,
      steps: [
        {
          title: 'Ouvrez KUMANI et touchez « Commencer »',
          text: 'Sur la page d’accueil, touchez le bouton doré « Commencer » en haut à droite. Si quelqu’un vous a envoyé son lien d’invitation, ouvrez-le : son code est rempli automatiquement.',
        },
        {
          title: 'Remplissez vos informations',
          text: 'Saisissez votre prénom, votre nom, votre e-mail et un mot de passe d’au moins 6 caractères, puis choisissez votre pays et votre ville.',
          tip: 'Utilisez un e-mail que vous consultez souvent : c’est là qu’arrive le code pour activer votre compte.',
        },
        {
          title: 'Code d’invitation et voucher (facultatifs)',
          text: 'Si un Kumano vous a invité, saisissez son code d’invitation. Si vous avez reçu un voucher KUMANI, saisissez-le dans le champ « Code voucher d’activation » : votre abonnement est activé tout de suite. Si vous avez un commerce, un cabinet ou une activité, cochez « Je suis un professionnel ». Touchez ensuite « Créez votre compte ».',
        },
        {
          title: 'Vérifiez votre e-mail',
          text: 'Nous vous envoyons un code par e-mail. Saisissez-le dans le champ « Code de vérification » et touchez « Vérifier et activer le compte ». C’est fait : vous êtes inscrit !',
          tip: 'Vous ne trouvez pas l’e-mail ? Regardez dans les spams ou touchez « Renvoyer le code ».',
        },
      ],
      cta: { label: 'Créez votre compte', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'Comment se connecter',
      summary: 'Accédez à votre compte et récupérez votre mot de passe si vous l’avez oublié.',
      minutes: 2,
      steps: [
        {
          title: 'Saisissez e-mail et mot de passe',
          text: 'Sur la page d’accueil, touchez « Se connecter », saisissez l’e-mail et le mot de passe choisis lors de l’inscription et touchez « Se connecter ».',
        },
        {
          title: 'Mot de passe oublié ?',
          text: 'Touchez « Mot de passe oublié ? » sous le bouton de connexion.',
        },
        {
          title: 'Réinitialisez le mot de passe',
          text: 'Saisissez votre e-mail et touchez « Réinitialiser le mot de passe » : nous vous envoyons un code pour en choisir un nouveau. Connectez-vous ensuite avec le nouveau mot de passe.',
          tip: 'Vous pouvez ajouter KUMANI à l’écran d’accueil du téléphone : il s’ouvre comme une application.',
        },
      ],
      cta: { label: 'Aller à la connexion', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'Votre tableau de bord',
      summary: 'Ce que vous trouvez dans le tableau de bord et comment accéder aux services que vous utilisez le plus.',
      minutes: 3,
      steps: [
        {
          title: 'La barre du haut',
          text: 'En haut, vous changez la langue, ouvrez votre profil et le portefeuille, et vous vous déconnectez. L’étoile vous mène à vos services favoris.',
        },
        {
          title: 'Les services gratuits',
          text: 'Le niveau « Gratuit » réunit les services inclus pour tous les inscrits, sans limite de temps. Touchez « Ouvrir » pour les utiliser et la petite étoile pour les ajouter aux favoris.',
        },
        {
          title: 'Les trois niveaux de services',
          text: 'Les services sont répartis en trois niveaux : Gratuit, Base et Pro. Un abonnement Base ou Pro débloque tous les services du niveau ; avec un Pass, vous pouvez aussi activer un seul service.',
        },
        {
          title: 'Points, abonnement et code d’invitation',
          text: 'Plus bas, vous voyez les KU Karma que vous accumulez chaque jour en vous connectant, l’état de votre abonnement (avec « S’abonner maintenant » ou « Activer avec un Bon ») et votre code d’invitation personnel.',
        },
        {
          title: 'La Communauté et les autres pages',
          text: 'Tout en bas, vous trouvez votre Communauté KUMANI et les liens rapides vers les autres pages : Communauté, portefeuille et Annonces.',
        },
      ],
      cta: { label: 'Ouvrir le tableau de bord', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Inviter avec votre lien',
      summary: 'Partagez votre code ou votre lien d’invitation et suivez ceux qui rejoignent votre étoile KUMANI.',
      minutes: 3,
      steps: [
        {
          title: 'Votre code d’invitation',
          text: 'Votre code d’invitation personnel se trouve dans le tableau de bord. Touchez l’icône à côté pour le copier : qui s’inscrit avec votre lien rejoint votre étoile KUMANI.',
        },
        {
          title: 'Partagez le lien',
          text: 'Sur la page Communauté, votre lien est prêt : copiez-le, touchez « Inviter sur WhatsApp » ou « Partager… » pour l’envoyer avec Instagram, Telegram et les autres applis du téléphone.',
          tip: 'Un message personnel fonctionne mieux qu’un message envoyé à tout le monde : expliquez pourquoi KUMANI vous est utile.',
        },
        {
          title: 'Votre étoile KUMANI',
          text: 'L’étoile montre les 5 personnes que vous avez invitées directement et combien de personnes actives se trouvent sous chaque position. Qui s’est inscrit sans encore activer d’abonnement apparaît dans « Pas encore KUMANI ».',
        },
        {
          title: 'Comment gagner des KU Points',
          text: 'Les règles sont dans le portefeuille : vous recevez des KU Points quand une personne invitée active un abonnement en payant par carte ou passe à Pro, ainsi qu’avec le Bonus Accueil.',
        },
      ],
      cta: { label: 'Ouvrir votre Communauté', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Créer et utiliser les vouchers',
      summary: 'Transformez vos KU Points en vouchers à offrir et activez un voucher reçu.',
      minutes: 3,
      steps: [
        {
          title: 'Échangez un pack de points',
          text: 'Dans le portefeuille, section vouchers, dépensez vos KU Points pour échanger un pack : vous recevez un crédit en euros pour créer des vouchers. Sous chaque pack, vous voyez combien de points il vous manque.',
        },
        {
          title: 'Créez un voucher',
          text: 'Avec le crédit, choisissez le plan (Base ou Pro, un an) et si le voucher est à offrir ou à vendre, puis touchez « Créer le voucher ».',
        },
        {
          title: 'Vous avez reçu un bon ?',
          text: 'Saisissez le code dans le champ « Vous avez reçu un bon ? » et touchez « Utiliser » : votre abonnement est activé tout de suite. Vous pouvez aussi le saisir lors de l’inscription.',
        },
      ],
      cta: { label: 'Aller aux vouchers', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Utiliser le portefeuille',
      summary: 'Votre carte, vos points, vos dons, vos badges et vos reçus : voici ce que contient le portefeuille.',
      minutes: 4,
      steps: [
        {
          title: 'Votre carte Membership',
          text: 'En haut se trouve votre carte KUMANI avec numéro de membre, plan actif et échéance. Vous pouvez enregistrer le QR code avec « Télécharger le QR ».',
        },
        {
          title: 'Vos points',
          text: 'Ici, vous voyez les KU Karma, gagnés chaque jour en vous connectant et en utilisant les outils, et les KU Points, reçus quand une personne invitée active un abonnement. Les points ne sont pas de l’argent et ne s’utilisent que sur la plateforme.',
        },
        {
          title: 'Donnez vos KU Points',
          text: 'Dans la section Dons, vous pouvez donner vos KU Points à l’association soutenue par KUMANI : chaque tranche de 10 points donnés = 1 €, que KUMANI verse à l’association.',
        },
        {
          title: 'Les badges',
          text: 'Les badges Kuman Green, Kuman Star et Kuman Black se débloquent avec le total de KU Points gagnés. La barre indique combien de points il manque pour le suivant.',
        },
        {
          title: 'Reçus, coupons et réduction sur le renouvellement',
          text: 'Plus bas, vous trouvez les Reçus numériques (plan Pro), les coupons obtenus dans l’Écosystème et la réduction sur le renouvellement de l’abonnement que vous pouvez obtenir avec les KU Karma.',
        },
      ],
      cta: { label: 'Ouvrir le portefeuille', href: '/wallet' },
    },
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "QR Code dynamique",
      summary: "Créez le QR code de votre lien d’invitation, choisissez les couleurs et téléchargez-le pour l’imprimer ou le partager.",
      minutes: 2,
      steps: [
        {
          title: "Votre lien est déjà dedans",
          text: "Le QR mène à votre lien d’invitation personnel. Le « Lien de destination » est verrouillé : qui le scanne rejoint toujours votre étoile KUMANI."
        },
        {
          title: "Choisissez les couleurs",
          text: "Changez la « Couleur du QR Code » et la « Couleur de fond », ou touchez l’un des « Thèmes rapides ».",
          tip: "Gardez un bon contraste entre le QR et le fond : un QR trop clair se lit mal."
        },
        {
          title: "Téléchargez le QR",
          text: "Vérifiez l’aperçu et touchez « Télécharger le PNG » : l’image est en haute résolution, adaptée aussi à l’impression."
        },
        {
          title: "Où l’utiliser",
          text: "Imprimez-le sur des cartes de visite et des flyers, partagez-le sur les réseaux sociaux ou ajoutez-le à votre signature e-mail."
        }
      ],
      cta: {
        label: "Ouvrir le QR Code dynamique",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "Messages WhatsApp",
      summary: "Des messages prêts avec votre lien d’invitation : choisissez le bon ton et envoyez-le en quelques secondes.",
      minutes: 2,
      steps: [
        {
          title: "Choisissez le message",
          text: "Il y a 4 messages pour des situations différentes : informel, formel, émotionnel et après une rencontre. Votre lien d’invitation est déjà dans le texte."
        },
        {
          title: "Copiez ou envoyez",
          text: "Touchez « Envoyer sur WhatsApp » pour ouvrir WhatsApp avec le message prêt et choisissez le destinataire. Ou touchez « Copier le message » et collez-le où vous voulez, même dans une autre appli.",
          tip: "Dans WhatsApp, vous pouvez modifier le texte avant de l’envoyer : ajoutez le prénom de la personne."
        },
        {
          title: "Conseils pour des messages efficaces",
          text: "Personnalisez toujours le message, ne l’envoyez pas à trop de personnes à la fois et faites suivre un appel ou un message vocal."
        }
      ],
      cta: {
        label: "Ouvrir Messages WhatsApp",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Créez votre page personnelle avec vos liens, à mettre dans la bio d’Instagram, TikTok et des autres réseaux.",
      minutes: 3,
      steps: [
        {
          title: "Écrivez votre bio",
          text: "Dans le champ « Texte bio », écrivez une phrase sur vous : elle apparaît sous votre nom."
        },
        {
          title: "Couleur et thèmes spéciaux",
          text: "Choisissez la couleur de la page. Les thèmes spéciaux (Aurore boréale, Lune sur le lac, Savane au coucher du soleil) s’affichent en aperçu quand vous les touchez : les KU Karma ne sont utilisés que si vous décidez de les débloquer."
        },
        {
          title: "Ajoutez vos liens et enregistrez",
          text: "Touchez « Ajouter un lien » pour ajouter vos liens (site, réseaux, boutique…) : votre lien d’invitation KUMANI est toujours présent. Touchez ensuite « Enregistrer la page ».",
          tip: "Plus bas, vous voyez l’aperçu de la page."
        },
        {
          title: "Partagez votre page",
          text: "Copiez le lien de la page et mettez-le dans la bio de vos réseaux, ou touchez « Visitez votre page Link in Bio » pour la voir. Pensez à enregistrer avant de partager."
        }
      ],
      cta: {
        label: "Ouvrir Link in Bio",
        href: "/marketplace/link-in-bio"
      }
    },
    {
      slug: "spotlight",
      category: "promoteTools",
      title: "Kumano du Jour",
      summary: "Racontez votre histoire et entrez dans la vitrine de la communauté : chaque jour, un Kumano est mis en avant. Réservé aux abonnés actifs.",
      minutes: 3,
      steps: [
        {
          title: "Racontez votre histoire",
          text: "Indiquez votre prénom ou surnom (jamais le nom de famille), ville, pays, métier ou passion et une courte histoire, lisible en 20 secondes."
        },
        {
          title: "Choisissez vos outils préférés",
          text: "Touchez les outils KUMANI que vous utilisez le plus : ils apparaissent avec votre histoire."
        },
        {
          title: "Consentements et envoi",
          text: "Cochez le consentement pour être montré à la communauté (celui pour la page d’accueil est facultatif) et touchez « Enregistrer et entrer en vitrine ». Le Staff KUMANI approuve l’histoire, puis elle entre dans la rotation du Kumano du Jour.",
          tip: "Vous pouvez retirer votre histoire de la vitrine ou de la page d’accueil à tout moment, depuis cette même page."
        }
      ],
      cta: {
        label: "Racontez votre histoire",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Trouvez les rencontres, ateliers et soirées de la communauté, inscrivez-vous en un geste et entrez avec votre pass.",
      minutes: 3,
      steps: [
        {
          title: "Trouvez un événement",
          text: "Cherchez par ville, pays, langue et date, ou touchez « En ligne uniquement » pour les événements en ligne."
        },
        {
          title: "Inscrivez-vous et recevez le pass",
          text: "Ouvrez l’événement et touchez « Participer » : vous recevez tout de suite le pass avec QR, que vous retrouvez dans « Mes pass ». Montrez-le à l’entrée : l’organisateur le scanne et vous êtes dedans.",
          tip: "Si l’événement est complet, vous pouvez vous inscrire en liste d’attente : si une place se libère, vous entrez automatiquement."
        },
        {
          title: "Organisez un événement",
          text: "Vous voulez organiser une rencontre dans votre ville ou en ligne ? Touchez « Organiser un événement »."
        },
        {
          title: "Devenez organisateur vérifié",
          text: "Pour organiser des événements, il faut être un Kumano Vérifié : touchez « Devenir organisateur vérifié » et suivez les étapes. Ensuite, depuis « Mes événements », vous gérez inscrits et check-in."
        }
      ],
      cta: {
        label: "Ouvrir KUMANI Events",
        href: "/events"
      }
    },
    {
      slug: "antitruffa",
      category: "security",
      title: "Manuel anti-arnaques",
      summary: "Les arnaques les plus répandues, avec des exemples réels et quoi faire tout de suite : lisez-le, enregistrez-le et partagez-le avec vos proches.",
      minutes: 2,
      steps: [
        {
          title: "Téléchargez-le ou imprimez-le",
          text: "En haut, touchez « Télécharger ou imprimer le manuel » : la fenêtre d’impression du téléphone ou de l’ordinateur s’ouvre, où vous pouvez aussi l’enregistrer en PDF."
        },
        {
          title: "Partagez-le avec vos proches",
          text: "Envoyez-le à vos parents, grands-parents et amis par WhatsApp, Facebook, Telegram, X, LinkedIn ou e-mail, ou copiez le lien. Qui s’inscrit depuis votre lien rejoint votre réseau."
        },
        {
          title: "Le test des 10 secondes",
          text: "Avant de cliquer, de répondre ou de payer, posez-vous les 6 questions du test : si une seule réponse est « oui », c’est presque certainement une arnaque.",
          tip: "Juste en dessous se trouvent les 6 règles d’or : elles suffisent à éviter la plupart des arnaques."
        },
        {
          title: "Choisissez un chapitre",
          text: "Depuis le sommaire, allez au chapitre qui vous intéresse : e-mails et SMS, appels, à votre porte, messageries, achats, investissements… Touchez une arnaque pour l’ouvrir et lire des exemples et quoi faire. À la fin, vous trouvez quoi faire tout de suite si vous avez été arnaqué."
        }
      ],
      cta: {
        label: "Ouvrir le manuel anti-arnaques",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "Vérification IBAN",
      summary: "Vérifiez l’IBAN avant un virement : s’il est bien écrit, de quel pays il est et quels signaux surveiller.",
      minutes: 2,
      steps: [
        {
          title: "Collez l’IBAN",
          text: "Collez l’IBAN qu’on vous a donné, avec ou sans espaces, et touchez « Vérifier l’IBAN ». Tout se passe sur votre téléphone : l’IBAN n’est ni envoyé ni enregistré."
        },
        {
          title: "Lisez le résultat",
          text: "Vous voyez si l’IBAN est bien écrit et de quel pays il est. Pour les IBAN italiens, vous voyez aussi ses parties : CIN, ABI (la banque), CAB (l’agence) et numéro de compte.",
          tip: "S’il y a une erreur, nous vous disons où : par exemple un caractère manquant ou deux chiffres inversés."
        },
        {
          title: "Pour quoi payez-vous ?",
          text: "Choisissez la réponse la plus proche (un particulier, une location de vacances, une boutique en ligne, un investissement…) et votre pays : nous vous montrons les signaux à surveiller."
        },
        {
          title: "Avant de faire le virement",
          text: "Rappelez-vous : un IBAN valide ne garantit pas que le destinataire est honnête. Lisez les conseils avant de payer : un virement instantané ne peut pas être annulé."
        }
      ],
      cta: {
        label: "Ouvrir Vérification IBAN",
        href: "/marketplace/verifica-iban"
      }
    },
    {
      slug: "checkmail",
      category: "security",
      title: "CheckMail",
      summary: "Vous avez reçu un e-mail suspect ? Importez-le ou copiez-le : nous vérifions l’expéditeur, les liens, les pièces jointes et le texte et nous vous disons s’il est risqué.",
      minutes: 3,
      steps: [
        {
          title: "Choisissez comment charger l’e-mail",
          text: "Il y a trois façons : « Importer le fichier » (l’e-mail enregistré en .eml ou .msg, la plus complète), « Coller la source » ou « Depuis le téléphone ». Chacune a ses instructions pour Gmail, Outlook et les autres logiciels."
        },
        {
          title: "Saisissez l’e-mail et analysez-le",
          text: "Depuis le téléphone, il suffit de copier l’expéditeur, l’objet et le texte avec les liens, puis de toucher « Analyser l’e-mail ».",
          tip: "Sous le bouton, vous voyez combien d’analyses il vous reste aujourd’hui."
        },
        {
          title: "Le niveau de risque",
          text: "Le résultat vous dit si le risque est faible, moyen ou élevé et liste ce que nous avons trouvé : faux expéditeur, liens raccourcis, urgence, demandes de données…"
        },
        {
          title: "Que faire",
          text: "Suivez les conseils : par exemple ne cliquez pas, n’ouvrez pas les pièces jointes et ne répondez pas. Avec « Analyser un autre e-mail », vous recommencez.",
          tip: "CheckMail donne des indices, pas des certitudes : en cas de doute, contactez l’entreprise par ses canaux officiels."
        }
      ],
      cta: {
        label: "Ouvrir CheckMail",
        href: "/marketplace/checkmail"
      }
    },
    {
      slug: "verifoto",
      category: "security",
      title: "VeriFoto",
      summary: "Vérifiez si une photo est vraie ou si elle a été créée ou retouchée avec l’intelligence artificielle, avant de lui faire confiance.",
      minutes: 2,
      steps: [
        {
          title: "Choisissez la photo",
          text: "Touchez « Choisir une photo » et prenez l’image à vérifier (JPG, PNG ou WebP jusqu’à 15 Mo). Les contrôles de base se font sur votre téléphone."
        },
        {
          title: "Le risque qu’elle soit IA ou retouchée",
          text: "Vous voyez un verdict et un pourcentage de risque : 0–30 % faible, 31–69 % incertain, 70–100 % élevé. En dessous, les indices trouvés, comme les certificats numériques et les données de l’appareil photo."
        },
        {
          title: "La carte des retouches",
          text: "Touchez « Carte des retouches » : les zones beaucoup plus claires que le reste peuvent indiquer des parties collées ou retouchées. C’est une aide visuelle, pas une preuve."
        },
        {
          title: "Deuxième avis et photo originale",
          text: "Pour un contrôle de plus, utilisez le détecteur d’IA : acceptez l’envoi d’une copie réduite de la photo et touchez « Analyser avec le détecteur d’IA ». Avec Google Lens ou TinEye, cherchez si la même photo existe déjà en ligne.",
          tip: "VeriFoto donne des indices, pas des certitudes : en cas de doute, méfiez-vous."
        }
      ],
      cta: {
        label: "Ouvrir VeriFoto",
        href: "/marketplace/verifoto"
      }
    },
    {
      slug: "documento-sicuro",
      category: "security",
      title: "Document Sûr",
      summary: "Avant d’envoyer la photo d’une pièce d’identité, ajoutez une mention avec l’objet et la date et cachez les données inutiles.",
      minutes: 3,
      steps: [
        {
          title: "Choisissez la photo du document",
          text: "Touchez « Choisir une photo » pour la prendre dans la galerie, ou « Prendre une photo ». La photo reste sur votre téléphone : elle n’est ni envoyée ni enregistrée."
        },
        {
          title: "Cachez les données inutiles",
          text: "Touchez « Cacher une zone » et faites glisser le doigt sur la photo pour poser un rectangle noir sur le numéro du document, la signature ou la photo, s’ils ne vous ont pas été demandés.",
          tip: "Nous vous indiquons aussi si la photo contient des données cachées, comme la position GPS : elles disparaissent de la copie téléchargée."
        },
        {
          title: "Ajoutez la mention de protection",
          text: "Choisissez pourquoi vous l’envoyez (location, banque, travail, achat en ligne…) et à qui : la mention avec l’objet et la date se répète en diagonale sur toute la photo. Vous pouvez modifier le texte, la visibilité, la taille et la couleur.",
          tip: "Utilisez une mention différente pour chaque personne : si la copie circule, vous saurez d’où elle vient."
        },
        {
          title: "Téléchargez ou envoyez la copie",
          text: "Touchez « Télécharger la copie protégée » ou « Partager » : vous obtenez une nouvelle copie avec la mention et les zones cachées, sans données cachées. L’original n’est pas modifié."
        }
      ],
      cta: {
        label: "Ouvrir Document Sûr",
        href: "/marketplace/documento-sicuro"
      }
    },
    {
      slug: "listings",
      category: "community",
      title: "Petites Annonces",
      summary: "Publiez des services et des produits, trouvez ce qu’il vous faut et écrivez à l’auteur de l’annonce.",
      minutes: 3,
      steps: [
        {
          title: "Cherchez une annonce",
          text: "Écrivez ce que vous cherchez, choisissez catégorie, pays et ville et touchez « Rechercher ». Les annonces en vitrine apparaissent en premier."
        },
        {
          title: "Publiez votre annonce",
          text: "Touchez « Nouvelle annonce » : la publier coûte quelques KU Karma, indiqués sur le bouton. Écrivez titre, catégorie et description ; prix et image sont facultatifs.",
          tip: "Si vous n’avez pas assez de KU Karma, connectez-vous chaque jour pour en accumuler. Les annonces durent 30 jours, puis vous pouvez les republier en un clic."
        },
        {
          title: "Où ça se trouve",
          text: "Choisissez pays et ville. Pour les services et conseils, cochez « Disponible aussi en ligne / à distance » : l’annonce apparaît dans toutes les villes du pays."
        },
        {
          title: "Vitrine (facultative)",
          text: "Vous pouvez mettre tout de suite l’annonce en avant dans la section En vitrine avec des KU Points, en choisissant le nombre de jours. Touchez ensuite « Publier une Annonce »."
        },
        {
          title: "Vos messages",
          text: "Dans « Mes messages », vous trouvez les conversations avec ceux qui vous ont écrit pour une annonce ou à qui vous avez écrit. Pour votre vie privée, les messages s’effacent automatiquement après 30 jours."
        }
      ],
      cta: {
        label: "Ouvrir les Petites Annonces",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Aidez quelqu’un pendant une heure et gagnez une heure, à utiliser quand vous avez besoin d’un coup de main.",
      minutes: 3,
      steps: [
        {
          title: "1 heure = 1 heure",
          text: "Vous aidez quelqu’un pendant une heure et gagnez une heure, que vous utilisez quand vous avez besoin d’aide. Les heures ne valent pas d’argent et ne se convertissent ni en points ni en réductions."
        },
        {
          title: "Vérifiez et participez",
          text: "Touchez « Vérifier et participer » : il faut être inscrit depuis au moins 30 jours, avoir un profil complet, être majeur, avoir une identité vérifiée (code fiscal ou pièce d’identité) et accepter les règles. Ensuite vous créez votre profil et recevez les heures de bienvenue.",
          tip: "Vous pouvez vérifier votre identité et accepter les règles tout de suite, même s’il manque encore une condition."
        },
        {
          title: "Demandez ou proposez de l’aide",
          text: "Sur le tableau, filtrez demandes et offres par catégorie, en présentiel ou en ligne, et par ville. Publiez avec « Demander de l’aide » ou « Proposer de l’aide », ou répondez avec « Je me propose » : les heures passent d’un solde à l’autre quand vous confirmez tous les deux."
        },
        {
          title: "Échanges sûrs",
          text: "La première fois, rencontrez-vous dans un lieu public ou en ligne. Personne ne doit vous demander d’argent, de cadeaux ou de coordonnées bancaires ; pas de conseils professionnels ni de travaux dangereux. Un problème ? Signalez-le : le Staff intervient."
        }
      ],
      cta: {
        label: "Ouvrir la Time Bank",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Des achats groupés entre Kumani : ensemble on achète mieux, directement chez le producteur ou le commerçant.",
      minutes: 3,
      steps: [
        {
          title: "Ensemble on achète mieux",
          text: "Un Kumano propose un achat groupé chez un producteur ou un commerçant et les autres participent : une fois le minimum atteint, la commande part et chacun paie directement le fournisseur."
        },
        {
          title: "Participez à une Kordata",
          text: "Dans « Ouverts », vous trouvez les Kordate actives, par catégorie (gastronomie et vin, technologie, voyages et événements, maison et énergie…). Ouvrez celle qui vous intéresse et touchez « Je participe » : nous vous prévenons quand le minimum est atteint. Dans « Les miens », vous retrouvez celles auxquelles vous participez.",
          tip: "Après votre participation, vous voyez qui participe et pouvez écrire dans la discussion du groupe."
        },
        {
          title: "Proposez une Kordata",
          text: "Touchez « Proposer une Kordata ». Pour protéger les participants, il faut devenir organisateur : abonnement actif depuis au moins 30 jours, profil complet, identité vérifiée et règles de l’organisateur acceptées."
        },
        {
          title: "Comment on paie",
          text: "KUMANI ne gère pas les paiements : une fois le minimum atteint, chacun paie directement le fournisseur selon les instructions de l’organisateur, qui répond de ce qu’il propose."
        }
      ],
      cta: {
        label: "Ouvrir Kordata",
        href: "/marketplace/convivio"
      }
    },
    {
      slug: "affinity",
      category: "community",
      title: "KUMANI Affinity",
      summary: "Un jeu de 20 questions pour découvrir votre archétype, défier un ami et rencontrer des personnes sur la même longueur d’onde.",
      minutes: 3,
      steps: [
        {
          title: "Répondez à 20 questions",
          text: "Touchez « Commencer le jeu » et répondez à 20 questions rapides : il n’y a pas de bonnes ou de mauvaises réponses.",
          tip: "Nous enregistrons seulement votre carte (5 valeurs) et votre archétype, jamais vos réponses. Vous pouvez la supprimer quand vous voulez."
        },
        {
          title: "Votre archétype et votre carte",
          text: "À la fin, vous découvrez votre archétype KUMANI et votre Carte d’Affinité sur 5 valeurs : aventure, valeurs, rythme, curiosité et chaleur. Vous pouvez la partager ou rejouer."
        },
        {
          title: "Jouez en Duo",
          text: "Touchez « Envoyer le lien Duo » et envoyez-le à un ami ou à votre partenaire : il joue, même sans s’inscrire, et vous découvrez tout de suite votre compatibilité."
        },
        {
          title: "Affinity Amitiés",
          text: "Chaque semaine, Kumi vous présente quelques personnes sur la même longueur d’onde. Choisissez les langues que vous parlez, ajoutez une phrase sur vous, donnez votre accord et touchez « Activer les présentations ». La discussion s’ouvre seulement si vous dites oui tous les deux.",
          tip: "Seules des personnes abonnées et majeures qui ont choisi de participer sont incluses. Vous pouvez bloquer, signaler ou mettre en pause quand vous voulez."
        }
      ],
      cta: {
        label: "Ouvrir Affinity",
        href: "/marketplace/affinity"
      }
    },
    {
      slug: "veritas",
      category: "community",
      title: "Veritas",
      summary: "Le jeu « Qui ment ? » de 3 à 8 joueurs : les amis peuvent jouer même sans s’inscrire.",
      minutes: 2,
      steps: [
        {
          title: "Créez une salle",
          text: "Écrivez votre pseudo, choisissez la langue des questions et le nombre de tours et touchez « Créer la salle ». Invitez vos amis avec le lien ou le code : de 3 à 8 joueurs, même sans inscription."
        },
        {
          title: "Entrez avec un code",
          text: "Si un ami a déjà créé une salle, écrivez son code et touchez « Rejoindre la salle »."
        },
        {
          title: "Comment jouer",
          text: "À chaque tour arrive une question : tout le monde écrit la vérité, sauf une personne qui invente en secret. Lisez les réponses anonymes et votez pour le menteur. Qui démasque le menteur gagne 1 point ; le menteur gagne 1 point par personne trompée."
        }
      ],
      cta: {
        label: "Ouvrir Veritas",
        href: "/marketplace/veritas"
      }
    },
  ],
}

export default content
