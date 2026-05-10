// Shared static StudyRoom content used across every per-university landing.
// Per-uni dynamic data lives in content/universities/{slug}.json (validated by University Zod schema).
// TBD markers (placeholder copy) should be replaced with real StudyRoom marketing text before launch.

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
}

export interface ContactInfo {
  phone: string;
  whatsapp: string;
  email: string;
  url: string;
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
  phone: '+7 (TBD) TBD-TBD-TBD',
  whatsapp: 'https://wa.me/7TBD',
  email: 'hello@studyroom.kz',
  url: 'https://studyroom.kz',
} as const;
