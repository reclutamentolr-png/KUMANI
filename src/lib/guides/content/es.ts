import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primeros pasos', text: 'Crea tu cuenta, accede y descubre tu panel.' },
    promote: { title: 'Promocionar KUMANI', text: 'Invita a quien conoces con tu enlace y usa los vouchers.' },
    wallet: { title: 'El monedero', text: 'Tarjeta, puntos, donaciones, insignias y recibos en un solo lugar.' },
  },
  guides: [
    {
      slug: 'registrazione',
      category: 'start',
      title: 'Cómo registrarse',
      summary: 'Crea tu cuenta KUMANI en pocos minutos y actívala con el código que recibes por email.',
      minutes: 3,
      steps: [
        {
          title: 'Abre KUMANI y toca «Empezar ahora»',
          text: 'En la página de inicio, toca el botón dorado «Empezar ahora» arriba a la derecha. Si alguien te ha enviado su enlace de invitación, ábrelo: su código se rellena solo.',
        },
        {
          title: 'Rellena tus datos',
          text: 'Escribe nombre, apellidos, email y una contraseña de al menos 6 caracteres, y luego elige tu país y tu ciudad.',
          tip: 'Usa un email que revises a menudo: ahí llega el código para activar la cuenta.',
        },
        {
          title: 'Código de invitación y voucher (opcionales)',
          text: 'Si un Kumano te ha invitado, escribe su código de invitación. Si has recibido un voucher KUMANI, introdúcelo en el campo «Código de voucher de activación»: tu suscripción se activa enseguida. Si tienes una tienda, un despacho o un negocio, marca «Soy profesional». Después toca «Crea tu cuenta».',
        },
        {
          title: 'Verifica tu email',
          text: 'Te enviamos un código por email. Escríbelo en el campo «Código de verificación» y toca «Verificar y activar cuenta». ¡Listo: ya estás dentro!',
          tip: '¿No encuentras el email? Mira en la carpeta de spam o toca «Reenviar código».',
        },
      ],
      cta: { label: 'Crea tu cuenta', href: '/register' },
    },
    {
      slug: 'accesso',
      category: 'start',
      title: 'Cómo acceder',
      summary: 'Entra en tu cuenta y recupera la contraseña si la has olvidado.',
      minutes: 2,
      steps: [
        {
          title: 'Introduce email y contraseña',
          text: 'En la página de inicio, toca «Acceder», escribe el email y la contraseña que elegiste al registrarte y toca «Acceder».',
        },
        {
          title: '¿Olvidaste tu contraseña?',
          text: 'Toca «¿Olvidaste tu contraseña?» debajo del botón de acceso.',
        },
        {
          title: 'Restablece la contraseña',
          text: 'Escribe tu email y toca «Restablecer contraseña»: te enviamos un código para elegir una nueva. Después accede con la nueva contraseña.',
          tip: 'Puedes añadir KUMANI a la pantalla de inicio del móvil: se abre como una app.',
        },
      ],
      cta: { label: 'Ir al acceso', href: '/login' },
    },
    {
      slug: 'dashboard',
      category: 'start',
      title: 'Tu panel',
      summary: 'Qué encuentras en el panel y cómo llegar a los servicios que más usas.',
      minutes: 3,
      steps: [
        {
          title: 'La barra superior',
          text: 'Arriba cambias el idioma, abres tu perfil y el monedero, y cierras sesión. La estrella te lleva a tus servicios favoritos.',
        },
        {
          title: 'Los servicios gratuitos',
          text: 'En el nivel «Gratis» están los servicios incluidos para todos los inscritos, sin límite de tiempo. Toca «Abrir» para usarlos y la estrellita para añadirlos a favoritos.',
        },
        {
          title: 'Los tres niveles de servicios',
          text: 'Los servicios se dividen en tres niveles: Gratis, Base y Pro. Con la suscripción Base o Pro se desbloquean todos los servicios del nivel; con un Pass puedes activar también un solo servicio.',
        },
        {
          title: 'Puntos, suscripción y código de invitación',
          text: 'Más abajo ves los KU Karma que acumulas cada día con los accesos, el estado de tu suscripción (con «Suscríbete ahora» o «Activar con Vale») y tu código de invitación personal.',
        },
        {
          title: 'La Comunidad y las demás páginas',
          text: 'Al final encuentras tu Comunidad KUMANI y los accesos rápidos a las demás páginas: Comunidad, monedero y Tablón.',
        },
      ],
      cta: { label: 'Abrir el panel', href: '/dashboard' },
    },
    {
      slug: 'invito',
      category: 'promote',
      title: 'Invitar con tu enlace',
      summary: 'Comparte tu código o tu enlace de invitación y sigue a quien entra en tu estrella KUMANI.',
      minutes: 3,
      steps: [
        {
          title: 'Tu código de invitación',
          text: 'En el panel encuentras tu código de invitación personal. Toca el icono de al lado para copiarlo: quien se registra con tu enlace entra en tu estrella KUMANI.',
        },
        {
          title: 'Comparte el enlace',
          text: 'En la página Comunidad tienes tu enlace listo: cópialo, toca «Invitar por WhatsApp» o «Compartir…» para enviarlo con Instagram, Telegram y las demás apps del móvil.',
          tip: 'Un mensaje personal funciona mejor que uno enviado a todos: cuenta por qué KUMANI te resulta útil.',
        },
        {
          title: 'Tu estrella KUMANI',
          text: 'La estrella muestra las 5 personas que has invitado directamente y cuántas personas activas hay bajo cada posición. Quien se ha registrado pero aún no ha activado la suscripción aparece en «Aún no KUMANI».',
        },
        {
          title: 'Cómo ganas KU Points',
          text: 'Las reglas están en el monedero: recibes KU Points cuando una persona que invitaste activa la suscripción pagando con tarjeta o pasa a Pro, y con el Bonus Estructura.',
        },
      ],
      cta: { label: 'Abrir tu Comunidad', href: '/dashboard/rete' },
    },
    {
      slug: 'voucher',
      category: 'promote',
      title: 'Crear y usar vouchers',
      summary: 'Convierte los KU Points en vouchers para regalar y activa un voucher que hayas recibido.',
      minutes: 3,
      steps: [
        {
          title: 'Canjea un paquete de puntos',
          text: 'En el monedero, en la sección de vouchers, gasta tus KU Points para canjear un paquete: recibes un crédito en euros para crear vouchers. Debajo de cada paquete ves cuántos puntos te faltan.',
        },
        {
          title: 'Crea un voucher',
          text: 'Con el crédito elige el plan (Base o Pro, un año) y si el voucher es para regalar o para vender, y luego toca «Crear voucher».',
        },
        {
          title: '¿Recibiste un vale?',
          text: 'Escribe el código en el campo «¿Recibiste un vale?» y toca «Canjear»: tu suscripción se activa enseguida. También puedes introducirlo al registrarte.',
        },
      ],
      cta: { label: 'Ir a los vouchers', href: '/wallet' },
    },
    {
      slug: 'wallet',
      category: 'wallet',
      title: 'Usar el monedero',
      summary: 'Tu tarjeta, los puntos, las donaciones, las insignias y los recibos: esto es lo que encuentras en el monedero.',
      minutes: 4,
      steps: [
        {
          title: 'Tu tarjeta Membership',
          text: 'Arriba está tu tarjeta KUMANI con número de miembro, plan activo y vencimiento. Puedes guardar el código QR con «Descargar QR».',
        },
        {
          title: 'Tus puntos',
          text: 'Aquí ves los KU Karma, que se ganan cada día con los accesos y el uso de las herramientas, y los KU Points, que recibes cuando una persona que invitaste activa la suscripción. Los puntos no son dinero y solo se usan dentro de la plataforma.',
        },
        {
          title: 'Dona tus KU Points',
          text: 'En la sección Donaciones puedes donar tus KU Points a la asociación que apoya KUMANI: cada 10 puntos donados = 1 €, que KUMANI entrega a la asociación.',
        },
        {
          title: 'Las insignias',
          text: 'Las insignias Kuman Green, Kuman Star y Kuman Black se desbloquean con el total de KU Points ganados. La barra te dice cuántos puntos faltan para la siguiente.',
        },
        {
          title: 'Recibos, cupones y descuento en la renovación',
          text: 'Más abajo encuentras los Recibos digitales (plan Pro), los cupones obtenidos en el Ecosistema y el descuento en la renovación de la suscripción que puedes conseguir con los KU Karma.',
        },
      ],
      cta: { label: 'Abrir el monedero', href: '/wallet' },
    },
  ],
}

export default content
