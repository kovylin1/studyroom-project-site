// ЕДИНЫЙ ИСТОЧНИК всех контактов StudyRoom (телефон, WhatsApp, Telegram, email, реквизиты).
// Раньше эти данные были захардкожены в index.astro, compare.astro, [slug].astro и static.ts.
// Теперь правится ТОЛЬКО здесь — везде подтягивается отсюда.
//
// ⚠️ ПЕРЕД ЗАПУСКОМ заполни поля с пометкой TODO реальными значениями.

export const CONTACTS = {
  // Красивый телефон для показа на странице
  phoneDisplay: '+7 (727) 000-00-00',       // TODO: реальный номер телефона
  // Тот же номер для tel: — только «+» и цифры
  phoneHref: '+77270000000',                // TODO: тот же номер цифрами с «+»
  // Номер WhatsApp для ссылок wa.me/<num> — ТОЛЬКО цифры, без «+» и скобок
  whatsappNumber: '77000000000',            // TODO: номер WhatsApp Business (цифры)
  // Username Telegram без «@» для t.me/<user>
  telegram: 'studyroom_kz',                 // TODO: username Telegram (без @)
  email: 'hello@studyroom.kz',              // TODO: проверь/замени email
  url: 'https://studyroom.kz',
  workHours: 'пн–пт 9:00–19:00',
  // Юридические реквизиты для футера лендинга
  legalName: 'ТОО «StudyRoom»',
  bin: '',                                  // TODO: БИН юрлица (пусто = скрыть в футере)
  address: 'Алматы',                        // TODO: адрес офиса
} as const;

/** Ссылка на WhatsApp с опциональным предзаполненным текстом. */
export const waLink = (text?: string): string =>
  `https://wa.me/${CONTACTS.whatsappNumber}` +
  (text ? `?text=${encodeURIComponent(text)}` : '');

/** Ссылка на Telegram. */
export const tgLink = (): string => `https://t.me/${CONTACTS.telegram}`;

/** Ссылка-звонок. */
export const telLink = (): string => `tel:${CONTACTS.phoneHref}`;

// Факты об агентстве для блока «О StudyRoom». Реальные данные — правь здесь.
export const AGENCY = {
  sinceYear: 2015,             // с какого года работаем («лет на рынке» считается автоматически)
  studentsPlaced: '1000+',     // сколько казахстанцев поступили через нас
  visaApprovalRate: '99%',     // доля одобрений студенческих виз
} as const;

/** Лет на рынке — считается от текущего года, не требует ручного обновления. */
export const yearsOnMarket = (): number =>
  new Date().getFullYear() - AGENCY.sinceYear;
