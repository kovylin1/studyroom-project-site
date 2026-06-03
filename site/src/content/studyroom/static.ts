// Shared static StudyRoom content used across every per-university landing.
// Per-uni dynamic data lives in content/universities/{slug}.json (validated by University Zod schema).
// TBD markers (placeholder copy) should be replaced with real StudyRoom marketing text before launch.
//
// This module is the single source for everything that's the same across all 16 unis:
// site-wide branding, benefits, activities, important-to-know, dates timeline,
// form copy, footer, chat config. Anything that varies per university lives in the
// University schema.

import { CONTACTS, waLink, tgLink } from './contacts';

export interface Benefit {
  num: string;
  title: string;
}

export interface Activity {
  title: string;
  text: string;
}

export interface FaqItem {
  title: string;
  text: string;
}

export interface Review {
  name: string;
  program: string;
  text: string;
  thumbnail?: string;
  videoUrl?: string;
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string;
  url: string;
}

export interface DatesTimelineItem {
  title: string;
  text: string;
}

export interface FormConfig {
  inlineTitle: string;
  inlineText: string;
  finalTitle: string;
  finalText: string;
  fields: {
    name: { label: string; placeholder: string };
    phone: { label: string; placeholder: string };
  };
  submit: string;
  success: string;
  errors: { name: string; phone: string };
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterConfig {
  copyright: string;
  legal: string;
  links: readonly FooterLink[];
}

export interface ChatQuickAction {
  label: string;
  href: string;
  icon: 'whatsapp' | 'telegram';
}

export interface ChatConfig {
  buttonAriaLabel: string;
  consultant: { name: string; role: string; online: boolean; avatarInitial: string };
  greeting: string;
  quickActions: readonly ChatQuickAction[];
  inputPlaceholder: string;
  autoReply: string;
}

export const STUDYROOM_BENEFITS: readonly Benefit[] = [
  { num: '01', title: 'Партнёрский договор с университетом' },
  { num: '02', title: 'Сопровождение от подачи до зачисления' },
  { num: '03', title: 'Помощь со студенческой визой' },
  { num: '04', title: 'Поддержка с проживанием на месте' },
] as const;

export const STUDYROOM_ACTIVITIES: readonly Activity[] = [
  {
    title: 'Подбор программы',
    text: 'Анализируем оценки, опыт и цели — подбираем программу, по которой вы реально пройдёте.',
  },
  {
    title: 'Сопровождение поступления',
    text: 'Готовим пакет документов, мотивационные письма, рекомендации. Всё через нашу систему — без потерь.',
  },
  {
    title: 'Виза и переезд',
    text: 'Оформляем студенческую визу, помогаем с жильём, страховкой и первыми днями в новой стране.',
  },
] as const;

export const STUDYROOM_FAQ: readonly FaqItem[] = [
  {
    title: 'Студенческая виза',
    text: 'Тип Tier 4/Student. Готовим CAS-номер от университета, помогаем с заявлением и собеседованием. Срок оформления — 3-4 недели.',
  },
  {
    title: 'Медицинская страховка',
    text: 'NHS-плата (IHS) включена в стоимость визы. Дополнительная страховка — по желанию.',
  },
  {
    title: 'Перевод документов',
    text: 'Переводим аттестат/диплом, апостилируем при необходимости. Работаем с проверенными бюро в Алматы и Астане.',
  },
  {
    title: 'Финансовое подтверждение',
    text: 'Выписка со счёта на 28+ дней. Сумма зависит от города (~£1334/мес для Лондона, ~£1023/мес для остальных).',
  },
] as const;

export const STUDYROOM_REVIEWS: readonly Review[] = [
  {
    name: '[TBD: имя студента]',
    program: '[TBD: программа / университет / год]',
    text: '[TBD: 1-2 предложения о том, что StudyRoom помог сделать.]',
  },
  {
    name: '[TBD: имя студента]',
    program: '[TBD: программа / университет / год]',
    text: '[TBD: 1-2 предложения о том, что StudyRoom помог сделать.]',
  },
] as const;

export const STUDYROOM_ABOUT = {
  title: 'О школе StudyRoom',
  paragraphs: [
    'StudyRoom — образовательное агентство в Казахстане, специализирующееся на поступлении в зарубежные университеты. Работаем с прямыми партнёрскими договорами, без посредников.',
    '[TBD: количество студентов, годы работы, ключевые партнёрства, география — заполните перед запуском.]',
  ],
} as const;

export const STUDYROOM_CONTACT: ContactInfo = {
  phone: CONTACTS.phoneDisplay,
  whatsapp: waLink(),
  email: CONTACTS.email,
  url: CONTACTS.url,
} as const;

// Generic UK undergraduate admissions timeline (UCAS cycle, year-agnostic).
// Per-uni precise dates should eventually come from the scraper; this is the
// fallback shown until then.
export const STUDYROOM_DATES_TIMELINE: readonly DatesTimelineItem[] = [
  {
    title: 'Сентябрь',
    text: 'Старт приёма документов в UCAS на программы выбранного университета следующего учебного года.',
  },
  {
    title: 'Октябрь – январь',
    text: 'Дедлайны UCAS: 15 октября — Oxford / Cambridge / медицина / стоматология / ветеринария; 31 января — большинство остальных программ.',
  },
  {
    title: 'Январь – март',
    text: 'Профильные вступительные тесты и интервью (зависят от программы).',
  },
  {
    title: 'Март – июль',
    text: 'Оффлайн-решения университетов, выбор твёрдого и резервного оффера, подача на студенческую визу.',
  },
] as const;

export const STUDYROOM_FORM: FormConfig = {
  inlineTitle: 'Не можете определиться с выбором?',
  inlineText:
    'Оставьте имя и номер телефона — подберём программу под вашу специальность и бюджет.',
  finalTitle: 'Запишитесь на бесплатную консультацию по обучению',
  finalText:
    'Оставьте имя и номер телефона — подберём программу под вашу специальность и бюджет.',
  fields: {
    name: { label: 'Ваше имя', placeholder: 'Ваше имя' },
    phone: { label: 'Телефон', placeholder: '+7 (___) ___-__-__' },
  },
  submit: 'Записаться',
  success: 'Спасибо! Мы свяжемся с вами в ближайшее время.',
  errors: {
    name: 'Введите имя',
    phone: 'Введите номер целиком в формате +7 (___) ___-__-__',
  },
} as const;

export const STUDYROOM_FOOTER: FooterConfig = {
  copyright: 'StudyRoom — образовательное агентство',
  legal: [CONTACTS.legalName, CONTACTS.bin && `БИН ${CONTACTS.bin}`, CONTACTS.address]
    .filter(Boolean)
    .join(' · '),
  links: [
    { label: 'Программы', href: '#programs' },
    { label: 'Требования', href: '#requirements' },
    { label: 'Даты', href: '#dates' },
    { label: 'Записаться', href: '#cta' },
  ],
} as const;

export const STUDYROOM_CHAT: ChatConfig = {
  buttonAriaLabel: 'Открыть чат с консультантом StudyRoom',
  consultant: {
    name: 'Консультант StudyRoom',
    role: '',
    online: true,
    avatarInitial: 'S',
  },
  greeting:
    'Здравствуйте! Я консультант StudyRoom. Расскажу про поступление, программы, стоимость и документы. Чем могу помочь?',
  quickActions: [
    { label: 'WhatsApp', href: waLink(), icon: 'whatsapp' },
    { label: 'Telegram', href: tgLink(), icon: 'telegram' },
  ],
  inputPlaceholder: 'Напишите вопрос…',
  autoReply:
    'Спасибо за сообщение! Менеджер ответит в течение нескольких минут. Если срочно — напишите в WhatsApp или Telegram, либо оставьте телефон в форме «Записаться».',
} as const;
