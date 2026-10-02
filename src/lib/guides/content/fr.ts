import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Premiers pas', text: 'Créez votre compte, connectez-vous et découvrez votre tableau de bord.' },
    promote: { title: 'Promouvoir KUMANI', text: 'Invitez vos proches avec votre lien et utilisez les vouchers.' },
    wallet: { title: 'Le portefeuille', text: 'Carte, points, dons, badges et reçus au même endroit.' },
    promoteTools: { title: "Outils pour promouvoir", text: "Les guides des services qui vous aident à faire connaître KUMANI." },
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
          text: 'Les règles sont dans le portefeuille : vous recevez des KU Points quand une personne invitée active un abonnement en payant par carte ou passe à Pro, ainsi qu’avec le Bonus Structure.',
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
  ],
}

export default content
