import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Premiers pas', text: 'Créez votre compte, connectez-vous et découvrez votre tableau de bord.' },
    promote: { title: 'Promouvoir KUMANI', text: 'Invitez vos proches avec votre lien et utilisez les vouchers.' },
    wallet: { title: 'Le portefeuille', text: 'Carte, points, dons, badges et reçus au même endroit.' },
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
  ],
}

export default content
