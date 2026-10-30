// Titoli e scritte fisse del CV nella lingua del CV (non in quella del sito):
// chi lo riceve legge un documento tutto in una lingua, sia nella pagina
// pubblica sia nel PDF.

export type CvLabels = {
  profile: string
  experience: string
  education: string
  skills: string
  languages: string
  certifications: string
  links: string
  contact: string
  personal: string
  present: string
  poweredBy: string
  birthDate: string
  nationality: string
  drivingLicence: string
  digitalSkills: string
  interests: string
  motherTongue: string
  otherLanguages: string
  understanding: string
  speaking: string
  writingGroup: string
  listening: string
  reading: string
  interaction: string
  production: string
  writing: string
  cefrNote: string
  privacy: string
  europeanFormat: string
  email: string
  phone: string
  address: string
  website: string
  // Titoli corti per le colonne strette
  personalShort: string
  educationShort: string
  languagesShort: string
}

const CV_LABELS: Record<string, CvLabels> = {
  it: {
    profile: 'Profilo',
    experience: 'Esperienza professionale',
    education: 'Istruzione e formazione',
    skills: 'Competenze',
    languages: 'Competenze linguistiche',
    certifications: 'Certificazioni',
    links: 'Link',
    contact: 'Contatti',
    personal: 'Informazioni personali',
    present: 'in corso',
    poweredBy: 'Aggiornato in tempo reale su',
    birthDate: 'Data di nascita',
    nationality: 'Nazionalità',
    drivingLicence: 'Patente di guida',
    digitalSkills: 'Competenze digitali',
    interests: 'Interessi',
    motherTongue: 'Lingua madre',
    otherLanguages: 'Altre lingue',
    understanding: 'Comprensione',
    speaking: 'Parlato',
    writingGroup: 'Scritto',
    listening: 'Ascolto',
    reading: 'Lettura',
    interaction: 'Interazione',
    production: 'Produzione orale',
    writing: 'Scrittura',
    cefrNote: 'Livelli: A1 e A2 utente base; B1 e B2 utente autonomo; C1 e C2 utente avanzato (Quadro comune europeo di riferimento per le lingue).',
    privacy:
      'Autorizzo il trattamento dei miei dati personali presenti nel curriculum vitae ai sensi del Regolamento UE 2016/679 (GDPR) e del D.Lgs. 196/2003.',
    europeanFormat: 'Curriculum vitae in formato europeo',
    email: 'Email',
    phone: 'Telefono',
    address: 'Indirizzo',
    website: 'Sito web',
    personalShort: 'Dati personali',
    educationShort: 'Istruzione',
    languagesShort: 'Lingue',
  },
  en: {
    profile: 'Profile',
    experience: 'Work experience',
    education: 'Education and training',
    skills: 'Skills',
    languages: 'Language skills',
    certifications: 'Certifications',
    links: 'Links',
    contact: 'Contact',
    personal: 'Personal information',
    present: 'present',
    poweredBy: 'Live-updated at',
    birthDate: 'Date of birth',
    nationality: 'Nationality',
    drivingLicence: 'Driving licence',
    digitalSkills: 'Digital skills',
    interests: 'Interests',
    motherTongue: 'Mother tongue',
    otherLanguages: 'Other languages',
    understanding: 'Understanding',
    speaking: 'Speaking',
    writingGroup: 'Writing',
    listening: 'Listening',
    reading: 'Reading',
    interaction: 'Interaction',
    production: 'Production',
    writing: 'Writing',
    cefrNote: 'Levels: A1 and A2 basic user; B1 and B2 independent user; C1 and C2 proficient user (Common European Framework of Reference for Languages).',
    privacy:
      'I authorise the processing of the personal data contained in this CV in accordance with Regulation (EU) 2016/679 (GDPR).',
    europeanFormat: 'Curriculum vitae in European format',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    website: 'Website',
    personalShort: 'Personal details',
    educationShort: 'Education',
    languagesShort: 'Languages',
  },
  es: {
    profile: 'Perfil',
    experience: 'Experiencia laboral',
    education: 'Educación y formación',
    skills: 'Competencias',
    languages: 'Competencias lingüísticas',
    certifications: 'Certificaciones',
    links: 'Enlaces',
    contact: 'Contacto',
    personal: 'Información personal',
    present: 'actualidad',
    poweredBy: 'Actualizado en tiempo real en',
    birthDate: 'Fecha de nacimiento',
    nationality: 'Nacionalidad',
    drivingLicence: 'Permiso de conducir',
    digitalSkills: 'Competencias digitales',
    interests: 'Intereses',
    motherTongue: 'Lengua materna',
    otherLanguages: 'Otros idiomas',
    understanding: 'Comprensión',
    speaking: 'Habla',
    writingGroup: 'Escritura',
    listening: 'Comprensión auditiva',
    reading: 'Comprensión lectora',
    interaction: 'Interacción oral',
    production: 'Expresión oral',
    writing: 'Expresión escrita',
    cefrNote: 'Niveles: A1 y A2 usuario básico; B1 y B2 usuario independiente; C1 y C2 usuario competente (Marco común europeo de referencia para las lenguas).',
    privacy:
      'Autorizo el tratamiento de mis datos personales contenidos en este currículum conforme al Reglamento (UE) 2016/679 (RGPD).',
    europeanFormat: 'Currículum vitae en formato europeo',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    address: 'Dirección',
    website: 'Sitio web',
    personalShort: 'Datos personales',
    educationShort: 'Formación',
    languagesShort: 'Idiomas',
  },
  fr: {
    profile: 'Profil',
    experience: 'Expérience professionnelle',
    education: 'Éducation et formation',
    skills: 'Compétences',
    languages: 'Compétences linguistiques',
    certifications: 'Certifications',
    links: 'Liens',
    contact: 'Contact',
    personal: 'Informations personnelles',
    present: "aujourd'hui",
    poweredBy: 'Mis à jour en temps réel sur',
    birthDate: 'Date de naissance',
    nationality: 'Nationalité',
    drivingLicence: 'Permis de conduire',
    digitalSkills: 'Compétences numériques',
    interests: "Centres d'intérêt",
    motherTongue: 'Langue maternelle',
    otherLanguages: 'Autres langues',
    understanding: 'Comprendre',
    speaking: 'Parler',
    writingGroup: 'Écrire',
    listening: 'Écouter',
    reading: 'Lire',
    interaction: 'Interaction orale',
    production: 'Production orale',
    writing: 'Écrire',
    cefrNote: 'Niveaux : A1 et A2 utilisateur élémentaire ; B1 et B2 utilisateur indépendant ; C1 et C2 utilisateur expérimenté (Cadre européen commun de référence pour les langues).',
    privacy:
      "J'autorise le traitement des données personnelles contenues dans ce CV conformément au Règlement (UE) 2016/679 (RGPD).",
    europeanFormat: 'Curriculum vitae au format européen',
    email: 'E-mail',
    phone: 'Téléphone',
    address: 'Adresse',
    website: 'Site web',
    personalShort: 'Infos personnelles',
    educationShort: 'Formation',
    languagesShort: 'Langues',
  },
  de: {
    profile: 'Profil',
    experience: 'Berufserfahrung',
    education: 'Schul- und Berufsbildung',
    skills: 'Kompetenzen',
    languages: 'Sprachkenntnisse',
    certifications: 'Zertifikate',
    links: 'Links',
    contact: 'Kontakt',
    personal: 'Persönliche Angaben',
    present: 'heute',
    poweredBy: 'In Echtzeit aktualisiert auf',
    birthDate: 'Geburtsdatum',
    nationality: 'Staatsangehörigkeit',
    drivingLicence: 'Führerschein',
    digitalSkills: 'Digitale Kompetenzen',
    interests: 'Interessen',
    motherTongue: 'Muttersprache',
    otherLanguages: 'Weitere Sprachen',
    understanding: 'Verstehen',
    speaking: 'Sprechen',
    writingGroup: 'Schreiben',
    listening: 'Hören',
    reading: 'Lesen',
    interaction: 'An Gesprächen teilnehmen',
    production: 'Zusammenhängendes Sprechen',
    writing: 'Schreiben',
    cefrNote: 'Niveaus: A1 und A2 elementare Sprachverwendung; B1 und B2 selbständige Sprachverwendung; C1 und C2 kompetente Sprachverwendung (Gemeinsamer Europäischer Referenzrahmen für Sprachen).',
    privacy:
      'Ich willige in die Verarbeitung der in diesem Lebenslauf enthaltenen personenbezogenen Daten gemäß Verordnung (EU) 2016/679 (DSGVO) ein.',
    europeanFormat: 'Lebenslauf im europäischen Format',
    email: 'E-Mail',
    phone: 'Telefon',
    address: 'Adresse',
    website: 'Website',
    personalShort: 'Persönliches',
    educationShort: 'Ausbildung',
    languagesShort: 'Sprachen',
  },
  pt: {
    profile: 'Perfil',
    experience: 'Experiência profissional',
    education: 'Educação e formação',
    skills: 'Competências',
    languages: 'Competências linguísticas',
    certifications: 'Certificações',
    links: 'Ligações',
    contact: 'Contactos',
    personal: 'Informação pessoal',
    present: 'atual',
    poweredBy: 'Atualizado em tempo real em',
    birthDate: 'Data de nascimento',
    nationality: 'Nacionalidade',
    drivingLicence: 'Carta de condução',
    digitalSkills: 'Competências digitais',
    interests: 'Interesses',
    motherTongue: 'Língua materna',
    otherLanguages: 'Outras línguas',
    understanding: 'Compreensão',
    speaking: 'Conversação',
    writingGroup: 'Escrita',
    listening: 'Compreensão oral',
    reading: 'Leitura',
    interaction: 'Interação oral',
    production: 'Produção oral',
    writing: 'Escrita',
    cefrNote: 'Níveis: A1 e A2 utilizador elementar; B1 e B2 utilizador independente; C1 e C2 utilizador proficiente (Quadro Europeu Comum de Referência para as Línguas).',
    privacy:
      'Autorizo o tratamento dos dados pessoais contidos neste currículo nos termos do Regulamento (UE) 2016/679 (RGPD).',
    europeanFormat: 'Curriculum vitae em formato europeu',
    email: 'E-mail',
    phone: 'Telefone',
    address: 'Morada',
    website: 'Sítio web',
    personalShort: 'Dados pessoais',
    educationShort: 'Formação',
    languagesShort: 'Línguas',
  },
  ru: {
    profile: 'Профиль',
    experience: 'Опыт работы',
    education: 'Образование и обучение',
    skills: 'Навыки',
    languages: 'Знание языков',
    certifications: 'Сертификаты',
    links: 'Ссылки',
    contact: 'Контакты',
    personal: 'Личная информация',
    present: 'по настоящее время',
    poweredBy: 'Обновляется в реальном времени на',
    birthDate: 'Дата рождения',
    nationality: 'Гражданство',
    drivingLicence: 'Водительские права',
    digitalSkills: 'Цифровые навыки',
    interests: 'Интересы',
    motherTongue: 'Родной язык',
    otherLanguages: 'Другие языки',
    understanding: 'Понимание',
    speaking: 'Говорение',
    writingGroup: 'Письмо',
    listening: 'Аудирование',
    reading: 'Чтение',
    interaction: 'Диалог',
    production: 'Монолог',
    writing: 'Письмо',
    cefrNote: 'Уровни: A1 и A2 — элементарное владение; B1 и B2 — самостоятельное владение; C1 и C2 — свободное владение (Общеевропейские компетенции владения иностранным языком).',
    privacy:
      'Я даю согласие на обработку персональных данных, содержащихся в этом резюме, в соответствии с Регламентом (ЕС) 2016/679 (GDPR).',
    europeanFormat: 'Резюме в европейском формате',
    email: 'Эл. почта',
    phone: 'Телефон',
    address: 'Адрес',
    website: 'Сайт',
    personalShort: 'Личные данные',
    educationShort: 'Образование',
    languagesShort: 'Языки',
  },
}

export function getCvLabels(locale: string): CvLabels {
  return CV_LABELS[locale] || CV_LABELS.it
}

// Data di nascita scritta per esteso nella lingua del CV (es. 31 luglio 1991)
export function formatBirthDate(iso: string | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  } catch {
    return iso
  }
}
