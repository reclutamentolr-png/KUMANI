import type { LetterLang } from '@/lib/letteraPresentazione'

// Frasi pronte della Lettera di presentazione, nella lingua della lettera.
// {company} {position} {profession} {recipient} diventano i dati scritti nel
// modulo (o il segnaposto tra parentesi quadre); [numero], [data] ecc. sono da
// completare a mano. Formulazioni neutre: niente «motivato/a», «interessato/a».
// In tedesco il primo paragrafo dopo il saluto comincia con la minuscola.

export type PhraseToken = 'company' | 'position' | 'profession' | 'recipient'

export const PHRASE_GROUPS = ['opening', 'fit', 'company', 'availability', 'closing'] as const
export type PhraseGroup = (typeof PHRASE_GROUPS)[number]

export type LangPhrases = {
  greetings: string[]
  closings: string[]
  groups: Record<PhraseGroup, string[]>
}

export const LETTER_PHRASES: Record<LetterLang, LangPhrases> = {
  it: {
    greetings: ['Gentile Responsabile della selezione,', 'Gentile {recipient},', 'Spettabile {company},', 'Buongiorno,'],
    closings: ['Cordiali saluti', 'Distinti saluti', 'Con i migliori saluti', 'Un cordiale saluto'],
    groups: {
      opening: [
        'Vi scrivo per propormi per la posizione di {position} presso {company}: ho letto il vostro annuncio con grande interesse.',
        'Con questa lettera desidero presentare la mia candidatura per il ruolo di {position}.',
        'Ho saputo che {company} cerca una persona per il ruolo di {position} e vorrei propormi.',
        'Vi invio la mia candidatura spontanea: mi piacerebbe entrare a far parte di {company} e mettere a disposizione la mia esperienza.',
        'Su consiglio di [nome della persona], vi scrivo per propormi per il ruolo di {position}.',
      ],
      fit: [
        'Lavoro come {profession} da [numero] anni e in questo tempo ho imparato a lavorare con precisione, a rispettare le scadenze e a collaborare con il gruppo.',
        "Nel mio ultimo impiego mi occupavo di [attività principali], un'esperienza che mi ha dato competenze molto utili per il ruolo di {position}.",
        'So organizzare bene il lavoro e risolvere i problemi con calma, anche nei momenti più impegnativi.',
        'Mi piace imparare cose nuove: mi adatto in fretta a strumenti e metodi diversi e accetto volentieri nuove responsabilità.',
        'Chi ha lavorato con me apprezza la mia affidabilità, la puntualità e il modo gentile di trattare con clienti e colleghi.',
        'Ho seguito un corso di [nome del corso] che mi ha dato basi solide per svolgere al meglio questo lavoro.',
      ],
      company: [
        'Conosco {company} per la qualità del suo lavoro e mi piacerebbe contribuire alla sua crescita.',
        "Apprezzo molto l'attenzione di {company} verso i clienti e verso le persone che ci lavorano: sono valori in cui mi riconosco.",
        "Lavorare presso {company} sarebbe per me un'occasione importante per crescere professionalmente in un ambiente serio e dinamico.",
        'Seguo con interesse le attività di {company} e credo di poter dare un contributo concreto al vostro gruppo.',
        '{company} è un punto di riferimento nel settore e per me sarebbe un piacere far parte della vostra squadra.',
      ],
      availability: [
        'Sono disponibile a iniziare da subito.',
        'Sono disponibile a iniziare dal [data].',
        'Posso lavorare a tempo pieno o part-time, anche nei fine settimana.',
        'Sono disponibile a spostamenti e trasferte.',
        'Abito vicino alla vostra sede e posso raggiungerla facilmente.',
      ],
      closing: [
        "Vi ringrazio per l'attenzione e resto a disposizione per un colloquio, anche telefonico.",
        'Allego il mio curriculum vitae, dove troverete maggiori dettagli sulla mia esperienza.',
        'Sarei felice di potervi incontrare per raccontarvi meglio chi sono e cosa posso offrire.',
        'Potete contattarmi in qualsiasi momento ai recapiti indicati in questa lettera.',
        'In attesa di un vostro gentile riscontro, vi ringrazio per il tempo che mi avete dedicato.',
      ],
    },
  },
  en: {
    greetings: ['Dear Hiring Manager,', 'Dear {recipient},', 'Dear Sir or Madam,', 'Hello,'],
    closings: ['Kind regards,', 'Yours sincerely,', 'Yours faithfully,', 'Best regards,'],
    groups: {
      opening: [
        'I am writing to apply for the position of {position} at {company}. I read your advertisement with great interest.',
        'With this letter I would like to put myself forward for the role of {position}.',
        'I recently learned that {company} is looking for someone for the role of {position}, and I would like to be considered.',
        'I am sending you a speculative application: I would very much like to join {company} and bring my experience to your team.',
        'On the recommendation of [name of the person], I am writing to apply for the role of {position}.',
      ],
      fit: [
        'I have worked as a {profession} for [number] years, and in that time I have learned to work accurately, meet deadlines and collaborate well with my team.',
        'In my last job I was responsible for [main tasks], an experience that gave me skills that are very useful for the role of {position}.',
        'I am good at organising my work and solving problems calmly, even at the busiest times.',
        'I enjoy learning new things: I adapt quickly to different tools and methods, and I am happy to take on new responsibilities.',
        'People who have worked with me appreciate my reliability, my punctuality and the courteous way I deal with customers and colleagues.',
        'I have completed a course in [course name], which gave me a solid basis for doing this job well.',
      ],
      company: [
        '{company} is known for the quality of its work, and I would like to contribute to its growth.',
        'I greatly appreciate the care {company} shows for its customers and its staff: these are values I share.',
        'Working at {company} would be an important opportunity for me to grow professionally in a serious and dynamic environment.',
        'I follow the work of {company} with interest and I believe I can make a real contribution to your team.',
        '{company} is a point of reference in its sector, and it would be a pleasure for me to join your team.',
      ],
      availability: [
        'I am available to start immediately.',
        'I am available to start from [date].',
        'I can work full time or part time, including weekends.',
        'I am willing to travel for work.',
        'I live near your premises and can reach them easily.',
      ],
      closing: [
        'Thank you for your attention. I would be glad to attend an interview, including by phone.',
        'I enclose my CV, where you will find more details about my experience.',
        'I would be pleased to meet you and tell you more about myself and what I can offer.',
        'You can contact me at any time using the details given in this letter.',
        'I look forward to hearing from you, and thank you for your time.',
      ],
    },
  },
  es: {
    greetings: ['Estimado equipo de selección:', 'Estimado equipo de {company}:', 'Buenos días, {recipient}:', 'Muy señores míos:'],
    closings: ['Atentamente,', 'Un cordial saludo,', 'Saludos cordiales,', 'Reciban un cordial saludo,'],
    groups: {
      opening: [
        'Les escribo para presentar mi candidatura al puesto de {position} en {company}: he leído su anuncio con mucho interés.',
        'Con esta carta deseo presentar mi candidatura para el puesto de {position}.',
        'He sabido que {company} busca a una persona para el puesto de {position} y me gustaría ofrecerme.',
        'Les envío mi candidatura espontánea: me gustaría mucho formar parte de {company} y aportar mi experiencia.',
        'Por recomendación de [nombre de la persona], les escribo para presentar mi candidatura al puesto de {position}.',
      ],
      fit: [
        'Trabajo como {profession} desde hace [número] años y en este tiempo he aprendido a trabajar con precisión, cumplir los plazos y colaborar con el equipo.',
        'En mi último empleo me encargaba de [tareas principales], una experiencia que me ha dado competencias muy útiles para el puesto de {position}.',
        'Sé organizar bien el trabajo y resolver los problemas con calma, incluso en los momentos de más actividad.',
        'Me gusta aprender cosas nuevas: me adapto rápidamente a herramientas y métodos diferentes y asumo con gusto nuevas responsabilidades.',
        'Quienes han trabajado conmigo valoran mi fiabilidad, mi puntualidad y el trato amable con clientes y compañeros.',
        'He realizado un curso de [nombre del curso] que me ha dado una buena base para desempeñar bien este trabajo.',
      ],
      company: [
        '{company} es conocida por la calidad de su trabajo y me gustaría contribuir a su crecimiento.',
        'Valoro mucho la atención que {company} dedica a sus clientes y a su personal: son valores con los que me identifico.',
        'Trabajar en {company} sería para mí una gran oportunidad de crecer profesionalmente en un entorno serio y dinámico.',
        'Sigo con interés la actividad de {company} y creo que puedo aportar una contribución concreta a su equipo.',
        '{company} es un referente en su sector y para mí sería un placer formar parte de su equipo.',
      ],
      availability: [
        'Tengo disponibilidad inmediata.',
        'Tengo disponibilidad para empezar a partir del [fecha].',
        'Puedo trabajar a jornada completa o parcial, también los fines de semana.',
        'Tengo disponibilidad para viajar y desplazarme.',
        'Vivo cerca de su sede y puedo llegar con facilidad.',
      ],
      closing: [
        'Les agradezco su atención y quedo a su disposición para una entrevista, también por teléfono.',
        'Adjunto mi currículum, donde encontrarán más detalles sobre mi experiencia.',
        'Sería un placer conocerles para contarles mejor quién soy y qué puedo aportar.',
        'Pueden ponerse en contacto conmigo en cualquier momento a través de los datos indicados en esta carta.',
        'A la espera de su respuesta, les agradezco el tiempo que me han dedicado.',
      ],
    },
  },
  fr: {
    greetings: ['Madame, Monsieur,', 'Bonjour,', 'Bonjour {recipient},', 'Chère équipe de {company},'],
    closings: [
      "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      'Veuillez agréer, Madame, Monsieur, mes sincères salutations.',
      'Bien cordialement,',
      'Cordialement,',
    ],
    groups: {
      opening: [
        "Je me permets de vous adresser ma candidature au poste de {position} au sein de {company}. J'ai lu votre annonce avec beaucoup d'intérêt.",
        'Par la présente, je souhaite vous proposer ma candidature au poste de {position}.',
        "J'ai appris que {company} recherche une personne pour le poste de {position} et je souhaite vous proposer ma candidature.",
        "Je vous adresse ma candidature spontanée : j'aimerais beaucoup rejoindre {company} et mettre mon expérience à votre service.",
        'Sur les conseils de [nom de la personne], je vous écris pour poser ma candidature au poste de {position}.',
      ],
      fit: [
        "J'exerce le métier de {profession} depuis [nombre] ans ; cette expérience m'a appris à travailler avec précision, à respecter les délais et à collaborer en équipe.",
        "Dans mon dernier emploi, je m'occupais de [tâches principales], une expérience qui m'a apporté des compétences très utiles pour le poste de {position}.",
        'Je sais organiser mon travail et résoudre les problèmes avec calme, même dans les moments les plus chargés.',
        "J'aime apprendre : je m'adapte rapidement à de nouveaux outils et à de nouvelles méthodes, et j'accepte volontiers de nouvelles responsabilités.",
        'Les personnes qui ont travaillé avec moi apprécient ma fiabilité, ma ponctualité et ma courtoisie envers les clients et les collègues.',
        "J'ai suivi une formation en [nom de la formation] qui m'a donné de bonnes bases pour exercer ce métier.",
      ],
      company: [
        '{company} est reconnue pour la qualité de son travail et je souhaite contribuer à son développement.',
        "J'apprécie beaucoup l'attention que {company} porte à ses clients et à ses équipes : ce sont des valeurs que je partage.",
        "Travailler chez {company} serait pour moi une belle occasion d'évoluer professionnellement dans un environnement sérieux et dynamique.",
        "Je suis avec intérêt les activités de {company} et je pense pouvoir apporter une contribution concrète à votre équipe.",
        '{company} est une référence dans son secteur et ce serait un plaisir pour moi de rejoindre votre équipe.',
      ],
      availability: [
        'Je suis disponible immédiatement.',
        'Je suis disponible à partir du [date].',
        'Je peux travailler à temps plein ou à temps partiel, y compris le week-end.',
        'Je suis disponible pour des déplacements.',
        "J'habite près de vos locaux et je peux m'y rendre facilement.",
      ],
      closing: [
        'Je vous remercie de votre attention et reste à votre disposition pour un entretien, y compris par téléphone.',
        'Vous trouverez ci-joint mon CV, qui présente plus en détail mon parcours.',
        'Ce serait un plaisir de vous rencontrer pour vous présenter mon parcours et ce que je peux vous apporter.',
        'Vous pouvez me joindre à tout moment aux coordonnées indiquées dans cette lettre.',
        "Dans l'attente de votre réponse, je vous remercie du temps que vous m'avez accordé.",
      ],
    },
  },
  de: {
    greetings: ['Sehr geehrte Damen und Herren,', 'Guten Tag {recipient},', 'Liebes Team von {company},', 'Hallo,'],
    closings: ['Mit freundlichen Grüßen', 'Freundliche Grüße', 'Beste Grüße', 'Viele Grüße'],
    groups: {
      opening: [
        'hiermit bewerbe ich mich um die Stelle als {position} bei {company}. Ihre Anzeige habe ich mit großem Interesse gelesen.',
        'mit diesem Schreiben möchte ich mich als {position} bei Ihnen bewerben.',
        'ich habe erfahren, dass {company} eine Person für die Stelle als {position} sucht, und möchte mich gern bewerben.',
        'hiermit sende ich Ihnen meine Initiativbewerbung: Ich würde sehr gern Teil von {company} werden und meine Erfahrung einbringen.',
        'auf Empfehlung von [Name der Person] bewerbe ich mich um die Stelle als {position}.',
      ],
      fit: [
        'Seit [Zahl] Jahren arbeite ich als {profession}. In dieser Zeit habe ich gelernt, sorgfältig zu arbeiten, Fristen einzuhalten und gut im Team zusammenzuarbeiten.',
        'In meiner letzten Stelle war ich für [Hauptaufgaben] zuständig – eine Erfahrung, die mir für die Stelle als {position} sehr nützlich ist.',
        'Ich kann meine Arbeit gut organisieren und Probleme ruhig lösen, auch in sehr arbeitsreichen Zeiten.',
        'Ich lerne gern Neues: Ich arbeite mich schnell in neue Werkzeuge und Abläufe ein und übernehme gern Verantwortung.',
        'Wer mit mir gearbeitet hat, schätzt meine Zuverlässigkeit, meine Pünktlichkeit und meinen freundlichen Umgang mit Kundschaft und Kollegium.',
        'Ich habe eine Weiterbildung in [Name des Kurses] abgeschlossen, die mir eine gute Grundlage für diese Tätigkeit gibt.',
      ],
      company: [
        '{company} ist für die Qualität seiner Arbeit bekannt, und ich möchte gern zu Ihrem weiteren Erfolg beitragen.',
        'Ich schätze sehr, wie viel Wert {company} auf Kundschaft und Mitarbeitende legt: Diese Werte teile ich.',
        'Bei {company} zu arbeiten wäre für mich eine wichtige Chance, mich in einem seriösen und dynamischen Umfeld beruflich weiterzuentwickeln.',
        'Die Entwicklung von {company} verfolge ich mit Interesse, und ich kann Ihr Team sicher wirkungsvoll unterstützen.',
        '{company} ist in der Branche ein Begriff, und ich würde mich freuen, Teil Ihres Teams zu werden.',
      ],
      availability: [
        'Ich kann ab sofort beginnen.',
        'Ich kann ab dem [Datum] beginnen.',
        'Ich kann in Vollzeit oder Teilzeit arbeiten, auch am Wochenende.',
        'Ich bin reisebereit und beim Einsatzort flexibel.',
        'Ich wohne in der Nähe Ihres Standorts und kann ihn gut erreichen.',
      ],
      closing: [
        'Vielen Dank für Ihre Aufmerksamkeit. Über eine Einladung zu einem Vorstellungsgespräch, auch telefonisch, freue ich mich sehr.',
        'Meinen Lebenslauf mit weiteren Details zu meiner Erfahrung finden Sie in der Anlage.',
        'Gern stelle ich mich Ihnen persönlich vor und erzähle Ihnen mehr über mich und meine Stärken.',
        'Sie erreichen mich jederzeit unter den in diesem Schreiben angegebenen Kontaktdaten.',
        'Ich freue mich auf Ihre Rückmeldung und danke Ihnen für Ihre Zeit.',
      ],
    },
  },
  pt: {
    greetings: ['Exmos. Senhores,', 'Estimada equipa da empresa {company},', 'Bom dia,', 'Ex.mo(a) Sr.(a) {recipient},'],
    closings: ['Com os melhores cumprimentos,', 'Atenciosamente,', 'Cordiais cumprimentos,', 'Com estima,'],
    groups: {
      opening: [
        'Venho por este meio candidatar-me à função de {position} na empresa {company}. Li o vosso anúncio com muito interesse.',
        'Com esta carta, gostaria de apresentar a minha candidatura à função de {position}.',
        'Tive conhecimento de que a empresa {company} procura uma pessoa para a função de {position} e gostaria de me candidatar.',
        'Envio-lhes a minha candidatura espontânea: gostaria muito de fazer parte da empresa {company} e de contribuir com a minha experiência.',
        'Por recomendação de [nome da pessoa], escrevo-lhes para me candidatar à função de {position}.',
      ],
      fit: [
        'Trabalho como {profession} há [número] anos e, ao longo deste tempo, aprendi a trabalhar com rigor, a cumprir prazos e a colaborar em equipa.',
        'No meu último emprego, era responsável por [tarefas principais], uma experiência que me deu competências muito úteis para a função de {position}.',
        'Tenho facilidade em organizar o trabalho e em resolver problemas com calma, mesmo nos momentos de maior atividade.',
        'Gosto de aprender: adapto-me rapidamente a ferramentas e métodos diferentes e assumo com gosto novas responsabilidades.',
        'Quem trabalhou comigo valoriza a minha fiabilidade, a minha pontualidade e a forma cordial como trato clientes e colegas.',
        'Frequentei um curso de [nome do curso] que me deu uma boa base para desempenhar bem esta função.',
      ],
      company: [
        'Conheço a empresa {company} pela qualidade do seu trabalho e gostaria de contribuir para o seu crescimento.',
        'Valorizo muito a atenção que a empresa {company} dedica aos clientes e às pessoas que nela trabalham: são valores com os quais me identifico.',
        'Trabalhar na empresa {company} seria para mim uma oportunidade importante de crescer profissionalmente num ambiente sério e dinâmico.',
        'Acompanho com interesse a atividade da empresa {company} e acredito que posso dar um contributo concreto à vossa equipa.',
        'A empresa {company} é uma referência no setor e seria um prazer fazer parte da vossa equipa.',
      ],
      availability: [
        'Tenho disponibilidade imediata.',
        'Tenho disponibilidade para começar a partir de [data].',
        'Posso trabalhar a tempo inteiro ou a tempo parcial, incluindo fins de semana.',
        'Tenho disponibilidade para deslocações.',
        'Moro perto das vossas instalações e posso chegar facilmente.',
      ],
      closing: [
        'Agradeço a vossa atenção e fico ao dispor para uma entrevista, também por telefone.',
        'Junto envio o meu curriculum vitae, onde poderão encontrar mais detalhes sobre a minha experiência.',
        'Seria um prazer conhecê-los pessoalmente para lhes falar melhor de mim e do que posso oferecer.',
        'Podem contactar-me a qualquer momento através dos contactos indicados nesta carta.',
        'Aguardando o vosso contacto, agradeço o tempo que me dedicaram.',
      ],
    },
  },
  ru: {
    greetings: ['Уважаемые господа!', 'Здравствуйте!', 'Добрый день, {recipient}!', 'Уважаемая команда компании {company}!'],
    closings: ['С уважением,', 'С наилучшими пожеланиями,', 'Заранее благодарю за внимание.', 'С уважением и надеждой на сотрудничество,'],
    groups: {
      opening: [
        'Ваша вакансия «{position}» в компании {company} вызвала у меня большой интерес, и я хочу предложить свою кандидатуру.',
        'Этим письмом я хочу предложить свою кандидатуру на должность «{position}».',
        'Мне стало известно, что компания {company} ищет сотрудника на должность «{position}», и я хочу предложить свою кандидатуру.',
        'Направляю Вам свою кандидатуру по собственной инициативе: мне бы очень хотелось стать частью компании {company} и применить свой опыт.',
        'По рекомендации [имя человека] предлагаю свою кандидатуру на должность «{position}».',
      ],
      fit: [
        'Мой опыт работы по профессии «{profession}» — [число] лет. Этот опыт научил меня работать точно, соблюдать сроки и слаженно работать в команде.',
        'На последнем месте работы в мои обязанности входило [основные задачи] — этот опыт дал мне навыки, очень полезные для должности «{position}».',
        'Я умею хорошо организовать работу и спокойно решать проблемы, даже в самые напряжённые периоды.',
        'Мне нравится учиться новому: я быстро осваиваю новые инструменты и методы и охотно беру на себя ответственность.',
        'Коллеги ценят мою надёжность, пунктуальность и вежливое общение с клиентами и сотрудниками.',
        'Курс «[название курса]» дал мне хорошую основу для выполнения этой работы.',
      ],
      company: [
        'Компания {company} известна качеством своей работы, и мне хотелось бы внести вклад в её развитие.',
        'Мне очень близко внимание, которое компания {company} уделяет клиентам и сотрудникам: я разделяю эти ценности.',
        'Работа в компании {company} стала бы для меня важной возможностью профессионального роста в серьёзной и динамичной среде.',
        'Я с интересом слежу за развитием компании {company} и считаю, что могу внести реальный вклад в работу Вашей команды.',
        'Компания {company} — один из лидеров отрасли, и для меня было бы честью стать частью Вашей команды.',
      ],
      availability: [
        'Могу приступить к работе немедленно.',
        'Могу приступить к работе с [дата].',
        'Могу работать на полную или неполную ставку, в том числе по выходным.',
        'Командировки и разъезды для меня не проблема.',
        'Я живу недалеко от Вашего офиса и могу легко до него добираться.',
      ],
      closing: [
        'Благодарю за внимание. С удовольствием приму участие в собеседовании, в том числе по телефону.',
        'Прилагаю своё резюме, в котором Вы найдёте подробности о моём опыте.',
        'Мне было бы приятно встретиться с Вами и подробнее рассказать о себе и о том, что я могу предложить.',
        'Со мной можно связаться в любое время по контактам, указанным в этом письме.',
        'В ожидании Вашего ответа благодарю за уделённое время.',
      ],
    },
  },
}
