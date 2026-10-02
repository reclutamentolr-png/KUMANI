import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primeros pasos', text: 'Crea tu cuenta, accede y descubre tu panel.' },
    promote: { title: 'Promocionar KUMANI', text: 'Invita a quien conoces con tu enlace y usa los vouchers.' },
    wallet: { title: 'El monedero', text: 'Tarjeta, puntos, donaciones, insignias y recibos en un solo lugar.' },
    promoteTools: { title: "Herramientas para promocionar", text: "Las guías de los servicios que te ayudan a dar a conocer KUMANI." },
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
    {
      slug: "qr-generator",
      category: "promoteTools",
      title: "Código QR dinámico",
      summary: "Crea el código QR de tu enlace de invitación, elige los colores y descárgalo para imprimirlo o compartirlo.",
      minutes: 2,
      steps: [
        {
          title: "Tu enlace ya está dentro",
          text: "El QR lleva a tu enlace de invitación personal. El «Enlace de destino» está bloqueado: así quien lo escanea entra siempre en tu estrella KUMANI."
        },
        {
          title: "Elige los colores",
          text: "Cambia el «Color del código QR» y el «Color de fondo», o toca uno de los «Temas rápidos».",
          tip: "Deja buen contraste entre el QR y el fondo: un QR demasiado claro se lee mal."
        },
        {
          title: "Descarga el QR",
          text: "Revisa la vista previa y toca «Descargar PNG»: la imagen es de alta resolución, apta también para imprimir."
        },
        {
          title: "Dónde usarlo",
          text: "Imprímelo en tarjetas de visita y folletos, compártelo en redes sociales o añádelo a la firma de tus emails."
        }
      ],
      cta: {
        label: "Abrir el Código QR dinámico",
        href: "/marketplace/qr-generator"
      }
    },
    {
      slug: "whatsapp-messages",
      category: "promoteTools",
      title: "Mensajes de WhatsApp",
      summary: "Mensajes listos con tu enlace de invitación: elige el tono adecuado y envíalo en segundos.",
      minutes: 2,
      steps: [
        {
          title: "Elige el mensaje",
          text: "Hay 4 mensajes para situaciones distintas: informal, formal, emocional y después de un encuentro. Tu enlace de invitación ya está en el texto."
        },
        {
          title: "Copia o envía",
          text: "Toca «Enviar por WhatsApp» para abrir WhatsApp con el mensaje listo y elige a quién mandarlo. O toca «Copiar mensaje» y pégalo donde quieras, incluso en otra app.",
          tip: "En WhatsApp puedes modificar el texto antes de enviarlo: añade el nombre de la persona."
        },
        {
          title: "Consejos para mensajes eficaces",
          text: "Personaliza siempre el mensaje, no lo mandes a demasiadas personas a la vez y después haz una llamada o manda un audio."
        }
      ],
      cta: {
        label: "Abrir Mensajes de WhatsApp",
        href: "/marketplace/whatsapp-messages"
      }
    },
    {
      slug: "link-in-bio",
      category: "promoteTools",
      title: "Link in Bio",
      summary: "Crea tu página personal con tus enlaces, para ponerla en la bio de Instagram, TikTok y las demás redes.",
      minutes: 3,
      steps: [
        {
          title: "Escribe tu bio",
          text: "En el campo «Texto de la bio» escribe una frase sobre ti: aparece debajo de tu nombre."
        },
        {
          title: "Color y temas especiales",
          text: "Elige el color de la página. Los temas especiales (Aurora boreal, Luna sobre el lago, Sabana al atardecer) se ven en vista previa al tocarlos: los KU Karma solo se usan si decides desbloquearlos."
        },
        {
          title: "Añade tus enlaces y guarda",
          text: "Toca «Añadir enlace» para poner tus enlaces (web, redes, tienda…): tu enlace de invitación KUMANI está siempre. Después toca «Guardar página».",
          tip: "Más abajo ves la vista previa de cómo quedará la página."
        },
        {
          title: "Comparte tu página",
          text: "Copia el enlace de la página y ponlo en la bio de tus redes, o toca «Visita tu Link in Bio» para verla. Recuerda guardar antes de compartir."
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
      title: "Kumano del Día",
      summary: "Cuenta tu historia y entra en el escaparate de la comunidad: cada día se destaca a un Kumano. Reservado a suscriptores activos.",
      minutes: 3,
      steps: [
        {
          title: "Cuenta tu historia",
          text: "Rellena nombre o apodo (nunca el apellido), ciudad, país, oficio o pasión y una historia breve, que se lea en 20 segundos."
        },
        {
          title: "Elige tus herramientas favoritas",
          text: "Toca las herramientas KUMANI que más usas: aparecen junto a tu historia."
        },
        {
          title: "Consentimientos y envío",
          text: "Marca el consentimiento para que te muestren a la comunidad (el de la página de inicio es opcional) y toca «Guardar y entrar en el escaparate». El Staff KUMANI aprueba la historia y luego entra en la rotación del Kumano del Día.",
          tip: "Puedes quitar tu historia del escaparate o de la página de inicio cuando quieras, desde esta misma página."
        }
      ],
      cta: {
        label: "Cuenta tu historia",
        href: "/marketplace/spotlight"
      }
    },
    {
      slug: "events",
      category: "promoteTools",
      title: "KUMANI Events",
      summary: "Encuentra encuentros, talleres y veladas de la comunidad, apúntate con un toque y entra con tu pase.",
      minutes: 3,
      steps: [
        {
          title: "Encuentra un evento",
          text: "Busca por ciudad, país, idioma y fecha, o toca «Solo online» para los eventos en línea."
        },
        {
          title: "Apúntate y recibe el pase",
          text: "Abre el evento y toca «Participar»: recibes enseguida el pase con QR, que encuentras en «Mis pases». Enséñalo en la entrada: el organizador lo escanea y ya estás dentro.",
          tip: "Si el evento está completo puedes apuntarte a la lista de espera: si queda un sitio libre, entras automáticamente."
        },
        {
          title: "Organiza un evento",
          text: "¿Quieres organizar un encuentro en tu ciudad u online? Toca «Organiza un evento»."
        },
        {
          title: "Hazte organizador verificado",
          text: "Para organizar eventos hay que ser un Kumano Verificado: toca «Hazte organizador verificado» y sigue los pasos. Después, desde «Mis eventos», gestionas inscritos y check-in."
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
