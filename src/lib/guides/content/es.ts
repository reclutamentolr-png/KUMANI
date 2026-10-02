import type { GuidesContent } from '@/lib/guides/types'

const content: GuidesContent = {
  categories: {
    start: { title: 'Primeros pasos', text: 'Crea tu cuenta, accede y descubre tu panel.' },
    promote: { title: 'Promocionar KUMANI', text: 'Invita a quien conoces con tu enlace y usa los vouchers.' },
    wallet: { title: 'El monedero', text: 'Tarjeta, puntos, donaciones, insignias y recibos en un solo lugar.' },
    promoteTools: { title: "Herramientas para promocionar", text: "Las guías de los servicios que te ayudan a dar a conocer KUMANI." },
    security: { title: "Seguridad", text: "Las guías de los servicios que te ayudan a reconocer y frenar las estafas." },
    community: { title: "Comunidad", text: "Las guías de los servicios para conocerse, ayudarse y jugar juntos." },
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
          text: 'Las reglas están en el monedero: recibes KU Points cuando una persona que invitaste activa la suscripción pagando con tarjeta o pasa a Pro, y con el Bonus Acogida.',
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
    {
      slug: "antitruffa",
      category: "security",
      title: "Manual Antiestafas",
      summary: "Las estafas más comunes, con ejemplos reales y qué hacer enseguida: léelo, guárdalo y compártelo con quien quieres.",
      minutes: 2,
      steps: [
        {
          title: "Descárgalo o imprímelo",
          text: "Arriba toca «Descarga o imprime el manual»: se abre la impresión del móvil o del ordenador, donde también puedes guardarlo como PDF."
        },
        {
          title: "Compártelo con quien quieres",
          text: "Envíalo a padres, abuelos y amigos por WhatsApp, Facebook, Telegram, X, LinkedIn o email, o copia el enlace. Quien se registra desde tu enlace entra en tu red."
        },
        {
          title: "La prueba de los 10 segundos",
          text: "Antes de hacer clic, responder o pagar, hazte las 6 preguntas de la prueba: si una sola respuesta es «sí», es casi seguro una estafa.",
          tip: "Justo debajo están las 6 reglas de oro: con ellas evitas la mayoría de las estafas."
        },
        {
          title: "Elige un capítulo",
          text: "Desde el índice ve al capítulo que necesitas: emails y SMS, llamadas, en la puerta de casa, chats, compras, inversiones… Toca una estafa para abrirla y leer ejemplos y qué hacer. Al final está qué hacer enseguida si te han estafado."
        }
      ],
      cta: {
        label: "Abrir el Manual Antiestafas",
        href: "/marketplace/antitruffa"
      }
    },
    {
      slug: "verifica-iban",
      category: "security",
      title: "Verificar IBAN",
      summary: "Comprueba el IBAN antes de una transferencia: si está bien escrito, de qué país es y qué señales vigilar.",
      minutes: 2,
      steps: [
        {
          title: "Pega el IBAN",
          text: "Pega el IBAN que te han dado, con o sin espacios, y toca «Comprobar el IBAN». Todo se hace en tu móvil: el IBAN no se envía ni se guarda."
        },
        {
          title: "Lee el resultado",
          text: "Ves si el IBAN está bien escrito y de qué país es. Para los IBAN italianos ves también sus partes: CIN, ABI (el banco), CAB (la sucursal) y número de cuenta.",
          tip: "Si hay un error te decimos dónde: por ejemplo un carácter que falta o dos números invertidos."
        },
        {
          title: "¿Para qué estás pagando?",
          text: "Elige la respuesta más parecida (un particular, una casa de vacaciones, una tienda online, una inversión…) y tu país: te mostramos las señales a las que prestar atención."
        },
        {
          title: "Antes de hacer la transferencia",
          text: "Recuerda: un IBAN válido no garantiza que el destinatario sea honrado. Lee los consejos antes de pagar: una transferencia inmediata no se puede anular."
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
      summary: "¿Has recibido un correo sospechoso? Súbelo o cópialo: comprobamos remitente, enlaces, adjuntos y texto y te decimos cuánto riesgo tiene.",
      minutes: 3,
      steps: [
        {
          title: "Elige cómo cargar el correo",
          text: "Hay tres formas: «Subir el archivo» (el correo guardado como .eml o .msg, la más completa), «Pegar el código fuente» o «Desde el móvil». Cada una tiene instrucciones para Gmail, Outlook y otros programas."
        },
        {
          title: "Introduce el correo y analízalo",
          text: "Desde el móvil basta con copiar remitente, asunto y texto con los enlaces, y luego tocar «Analizar el correo».",
          tip: "Debajo del botón ves cuántos análisis te quedan hoy."
        },
        {
          title: "El nivel de riesgo",
          text: "El resultado te dice si el riesgo es bajo, medio o alto y enumera lo que hemos encontrado: remitente falso, enlaces acortados, prisas, peticiones de datos…"
        },
        {
          title: "Qué hacer",
          text: "Sigue los consejos: por ejemplo no hagas clic, no abras los adjuntos y no respondas. Con «Analizar otro correo» empiezas de nuevo.",
          tip: "CheckMail da indicios, no certezas: ante la duda, contacta con la empresa por sus canales oficiales."
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
      summary: "Comprueba si una foto es real o si ha sido creada o retocada con inteligencia artificial, antes de fiarte.",
      minutes: 2,
      steps: [
        {
          title: "Elige la foto",
          text: "Toca «Elegir una foto» y selecciona la imagen que quieres comprobar (JPG, PNG o WebP hasta 15 MB). Los controles básicos se hacen en tu móvil."
        },
        {
          title: "El riesgo de que sea IA o retocada",
          text: "Ves un veredicto y un porcentaje de riesgo: 0–30 % bajo, 31–69 % incierto, 70–100 % alto. Debajo están los indicios encontrados, como certificados digitales y datos de la cámara."
        },
        {
          title: "El mapa de retoques",
          text: "Toca «Mapa de retoques»: las zonas mucho más claras que el resto pueden indicar partes pegadas o retocadas. Es una ayuda visual, no una prueba."
        },
        {
          title: "Segunda opinión y foto original",
          text: "Para un control extra usa el detector de IA: acepta el envío de una copia reducida de la foto y toca «Analizar con el detector de IA». Con Google Lens o TinEye buscas si la misma foto ya existe en internet.",
          tip: "VeriFoto da indicios, no certezas: ante la duda, no te fíes."
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
      summary: "Antes de enviar la foto de un documento, añade un texto con el motivo y la fecha y tapa los datos que no hacen falta.",
      minutes: 3,
      steps: [
        {
          title: "Elige la foto del documento",
          text: "Toca «Elegir una foto» para cogerla de la galería o «Hacer una foto». La foto se queda en tu móvil: no se sube ni se guarda."
        },
        {
          title: "Tapa los datos que no hacen falta",
          text: "Toca «Tapar una zona» y arrastra el dedo sobre la foto para poner un rectángulo negro sobre el número del documento, la firma o la foto, si no te los han pedido.",
          tip: "También te decimos si la foto contiene datos ocultos, como la ubicación GPS: en la copia descargada ya no están."
        },
        {
          title: "Añade el texto de protección",
          text: "Elige para qué la envías (alquiler, banco, trabajo, compra online…) y a quién: el texto con motivo y fecha se repite en diagonal por toda la foto. Puedes cambiar el texto, la visibilidad, el tamaño y el color.",
          tip: "Usa un texto distinto para cada persona: si la copia circula, sabrás de dónde ha salido."
        },
        {
          title: "Descarga o envía la copia",
          text: "Toca «Descargar la copia protegida» o «Compartir»: obtienes una copia nueva con el texto y las zonas tapadas, sin datos ocultos. El original no se toca."
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
      title: "Anuncios de la Comunidad",
      summary: "Publica servicios y productos, busca lo que necesitas y escribe a quien ha publicado.",
      minutes: 3,
      steps: [
        {
          title: "Busca un anuncio",
          text: "Escribe lo que buscas, elige categoría, país y ciudad y toca «Buscar». Los anuncios destacados aparecen primero."
        },
        {
          title: "Publica tu anuncio",
          text: "Toca «Nuevo anuncio»: publicarlo cuesta algunos KU Karma, los ves en el botón. Escribe título, categoría y descripción; precio e imagen son opcionales.",
          tip: "Si no tienes suficientes KU Karma, accede cada día para acumularlos. Los anuncios duran 30 días y luego puedes volver a publicarlos con un clic."
        },
        {
          title: "Dónde está",
          text: "Elige país y ciudad. Para servicios y consultorías marca «Disponible también online / a distancia»: el anuncio aparece en todas las ciudades del país."
        },
        {
          title: "Escaparate (opcional)",
          text: "Puedes destacar el anuncio enseguida en la sección En el escaparate con KU Points, eligiendo cuántos días. Luego toca «Publicar Anuncio»."
        },
        {
          title: "Tus mensajes",
          text: "En «Mis mensajes» encuentras las conversaciones con quien te ha escrito por un anuncio o a quien has escrito tú. Por tu privacidad, los mensajes se borran solos a los 30 días."
        }
      ],
      cta: {
        label: "Abrir los Anuncios",
        href: "/marketplace/listings"
      }
    },
    {
      slug: "timebank",
      category: "community",
      title: "KUMANI Time Bank",
      summary: "Ayuda a alguien durante una hora y gana una hora, para usarla cuando necesites una mano.",
      minutes: 3,
      steps: [
        {
          title: "1 hora = 1 hora",
          text: "Ayudas a alguien durante una hora y ganas una hora, que usas cuando necesitas ayuda. Las horas no valen dinero y no se convierten en puntos ni descuentos."
        },
        {
          title: "Verifica y participa",
          text: "Toca «Verificar y participar»: hace falta estar registrado desde hace al menos 30 días, tener el perfil completo, ser mayor de edad, tener la identidad verificada (código fiscal o documento) y aceptar las reglas. Después creas tu perfil y recibes las horas de bienvenida.",
          tip: "Puedes verificar tu identidad y aceptar las reglas ya, aunque todavía falte algún requisito."
        },
        {
          title: "Pide u ofrece ayuda",
          text: "En el tablón filtra peticiones y ofertas por categoría, presencial u online y ciudad. Publica con «Pedir ayuda» u «Ofrecer ayuda», o responde con «Me ofrezco»: las horas pasan de un saldo a otro cuando confirmáis los dos."
        },
        {
          title: "Intercambios seguros",
          text: "La primera vez quedad en un lugar público u online. Nadie debe pedirte dinero, regalos ni datos bancarios; nada de consultorías profesionales ni trabajos peligrosos. Si algo va mal, denúncialo: el Staff interviene."
        }
      ],
      cta: {
        label: "Abrir la Time Bank",
        href: "/marketplace/timebank"
      }
    },
    {
      slug: "convivio",
      category: "community",
      title: "Kordata",
      summary: "Compras en grupo entre Kumani: juntos se compra mejor, directamente al productor o a la tienda.",
      minutes: 3,
      steps: [
        {
          title: "Juntos se compra mejor",
          text: "Un Kumano propone una compra en grupo a un productor o una tienda y los demás se unen: alcanzado el mínimo, el pedido sale y cada uno paga directamente al proveedor."
        },
        {
          title: "Únete a una Kordata",
          text: "En «Abiertos» encuentras las Kordate activas, por categoría (comida y vino, tecnología, viajes y eventos, casa y energía…). Abre la que te interese y toca «Me uno»: te avisamos cuando se alcance el mínimo. En «Los míos» encuentras aquellas en las que participas.",
          tip: "Después de unirte ves quién participa y puedes escribir en el chat del grupo."
        },
        {
          title: "Propón una Kordata",
          text: "Toca «Proponer una Kordata». Para proteger a quien se une hay que hacerse organizador: suscripción activa desde hace al menos 30 días, perfil completo, identidad verificada y normas del organizador aceptadas."
        },
        {
          title: "Cómo se paga",
          text: "KUMANI no gestiona los pagos: alcanzado el mínimo, cada uno paga directamente al proveedor siguiendo las instrucciones del organizador, que responde de lo que propone."
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
      summary: "Un juego de 20 preguntas para descubrir tu arquetipo, retar a un amigo y conocer a personas afines.",
      minutes: 3,
      steps: [
        {
          title: "Responde a 20 preguntas",
          text: "Toca «Empezar el juego» y responde a 20 preguntas rápidas: no hay respuestas correctas ni incorrectas.",
          tip: "Solo guardamos tu mapa (5 valores) y tu arquetipo, nunca tus respuestas. Puedes borrarlo cuando quieras."
        },
        {
          title: "Tu arquetipo y tu mapa",
          text: "Al final descubres tu arquetipo KUMANI y tu Mapa de Afinidad en 5 valores: aventura, valores, ritmo, curiosidad y calidez. Puedes compartirlo o volver a jugar."
        },
        {
          title: "Juega en Dúo",
          text: "Toca «Enviar el enlace Dúo» y mándalo a un amigo o a tu pareja: juega, incluso sin registrarse, y descubrís al momento vuestra compatibilidad."
        },
        {
          title: "Affinity Amistades",
          text: "Cada semana Kumi te presenta a algunas personas afines. Elige los idiomas que hablas, añade una frase sobre ti, da tu consentimiento y toca «Activar las presentaciones». El chat solo se abre si los dos decís que sí.",
          tip: "Solo participan personas suscritas y mayores de edad que lo han elegido. Puedes bloquear, denunciar o pausar cuando quieras."
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
      summary: "El juego «¿Quién miente?» de 3 a 8 jugadores: los amigos pueden jugar incluso sin registrarse.",
      minutes: 2,
      steps: [
        {
          title: "Crea una sala",
          text: "Escribe tu apodo, elige el idioma de las preguntas y el número de rondas y toca «Crear la sala». Invita a tus amigos con el enlace o el código: de 3 a 8 jugadores, incluso sin registrarse."
        },
        {
          title: "Entra con un código",
          text: "Si un amigo ya ha creado una sala, escribe su código y toca «Entrar en la sala»."
        },
        {
          title: "Cómo se juega",
          text: "En cada ronda llega una pregunta: todos escriben la verdad, salvo uno que en secreto se la inventa. Leed las respuestas anónimas y votad quién miente. Quien descubre al mentiroso gana 1 punto; el mentiroso gana 1 punto por cada persona engañada."
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
