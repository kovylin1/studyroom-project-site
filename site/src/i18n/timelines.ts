// site/src/i18n/timelines.ts
// Локализованные таймлайны подачи по странам (UK / Canada / AU+NZ / US / generic).
// RU — источник истины (перенесено из [slug].astro как есть). EN/KK — переводы.
import type { Locale } from './utils';

export interface TimelineItem {
  title: string;
  text: string;
}

type Key = 'uk' | 'canada' | 'au' | 'us' | 'generic';

export const timelines: Record<Locale, Record<Key, TimelineItem[]>> = {
  ru: {
    uk: [
      { title: 'Сентябрь', text: 'Старт приёма документов в UCAS на программы следующего учебного года.' },
      { title: 'Октябрь – январь', text: 'Дедлайны UCAS: 15 октября — медицина и стоматология; 31 января — большинство программ.' },
      { title: 'Январь – март', text: 'Вступительные тесты и интервью. Параллельно подаём документы на pathway-программы (Foundation и Pre-Master\'s).' },
      { title: 'Март – июль', text: 'Решения университета, выбор оффера, подача на студенческую визу.' },
    ],
    canada: [
      { title: 'Сентябрь – ноябрь', text: 'Открывается приём документов на следующий академический год.' },
      { title: 'Январь – март', text: 'Дедлайны подачи на основные осенние интейки. Тесты и интервью при необходимости.' },
      { title: 'Март – июнь', text: 'Условные офферы, подтверждение оценок, подача на Study Permit.' },
      { title: 'Июнь – август', text: 'Получение Study Permit, бронирование жилья, перелёт.' },
    ],
    au: [
      { title: 'За 8–10 мес до старта', text: 'Подача документов напрямую в университет. Семестры — февраль/июль.' },
      { title: 'За 6–8 мес', text: 'Условный оффер. Сбор финансовых документов.' },
      { title: 'За 4–6 мес', text: 'Безусловный оффер. Подача на студенческую визу.' },
      { title: 'За 1–2 мес', text: 'Виза, жильё, перелёт.' },
    ],
    us: [
      { title: 'Август – октябрь', text: 'Открывается Common App. Сдача SAT/TOEFL/IELTS.' },
      { title: 'Ноябрь – январь', text: 'Early Decision/Action до 1 ноября; Regular Decision до 1–15 января.' },
      { title: 'Март – апрель', text: 'Решения. Финансовая помощь / стипендии.' },
      { title: 'Май – август', text: 'I-20, виза F-1, жильё, перелёт.' },
    ],
    generic: [
      { title: 'За 10–12 мес до старта', text: 'Подбор программ и университетов, проверка требований и дедлайнов на официальных сайтах.' },
      { title: 'За 8–10 мес', text: 'Подача документов напрямую в университет, сдача языкового теста (IELTS/TOEFL) и профильных экзаменов.' },
      { title: 'За 4–6 мес', text: 'Получение оффера, сбор финансовых документов, подача на студенческую визу.' },
      { title: 'За 1–2 мес', text: 'Виза, бронирование жилья, перелёт.' },
    ],
  },
  en: {
    uk: [
      { title: 'September', text: 'UCAS opens for applications to next year\'s programmes.' },
      { title: 'October – January', text: 'UCAS deadlines: 15 October — medicine and dentistry; 31 January — most programmes.' },
      { title: 'January – March', text: 'Entrance tests and interviews. In parallel we apply to pathway programmes (Foundation and Pre-Master\'s).' },
      { title: 'March – July', text: 'University decisions, choosing an offer, applying for a student visa.' },
    ],
    canada: [
      { title: 'September – November', text: 'Applications open for the next academic year.' },
      { title: 'January – March', text: 'Deadlines for the main autumn intakes. Tests and interviews if required.' },
      { title: 'March – June', text: 'Conditional offers, confirming grades, applying for a Study Permit.' },
      { title: 'June – August', text: 'Receiving the Study Permit, booking accommodation, flight.' },
    ],
    au: [
      { title: '8–10 months before start', text: 'Apply directly to the university. Semesters — February/July.' },
      { title: '6–8 months before', text: 'Conditional offer. Gathering financial documents.' },
      { title: '4–6 months before', text: 'Unconditional offer. Applying for a student visa.' },
      { title: '1–2 months before', text: 'Visa, accommodation, flight.' },
    ],
    us: [
      { title: 'August – October', text: 'Common App opens. Sitting SAT/TOEFL/IELTS.' },
      { title: 'November – January', text: 'Early Decision/Action by 1 November; Regular Decision by 1–15 January.' },
      { title: 'March – April', text: 'Decisions. Financial aid / scholarships.' },
      { title: 'May – August', text: 'I-20, F-1 visa, accommodation, flight.' },
    ],
    generic: [
      { title: '10–12 months before start', text: 'Shortlisting programmes and universities, checking requirements and deadlines on official sites.' },
      { title: '8–10 months before', text: 'Applying directly to the university, sitting a language test (IELTS/TOEFL) and subject exams.' },
      { title: '4–6 months before', text: 'Receiving an offer, gathering financial documents, applying for a student visa.' },
      { title: '1–2 months before', text: 'Visa, booking accommodation, flight.' },
    ],
  },
  kk: {
    uk: [
      { title: 'Қыркүйек', text: 'Келесі оқу жылының бағдарламаларына UCAS арқылы құжат қабылдау басталады.' },
      { title: 'Қазан – қаңтар', text: 'UCAS мерзімдері: 15 қазан — медицина мен стоматология; 31 қаңтар — бағдарламалардың көпшілігі.' },
      { title: 'Қаңтар – наурыз', text: 'Кіру тесттері мен әңгімелесулер. Қатар pathway-бағдарламаларға (Foundation және Pre-Master\'s) құжат тапсырамыз.' },
      { title: 'Наурыз – шілде', text: 'Университет шешімдері, оффер таңдау, студенттік визаға өтініш беру.' },
    ],
    canada: [
      { title: 'Қыркүйек – қараша', text: 'Келесі академиялық жылға құжат қабылдау ашылады.' },
      { title: 'Қаңтар – наурыз', text: 'Негізгі күзгі интейктерге құжат тапсыру мерзімдері. Қажет болса тесттер мен әңгімелесулер.' },
      { title: 'Наурыз – маусым', text: 'Шартты офферлер, бағаларды растау, Study Permit-ке өтініш беру.' },
      { title: 'Маусым – тамыз', text: 'Study Permit алу, тұрғын үй брондау, ұшу.' },
    ],
    au: [
      { title: 'Басталуына 8–10 ай қалғанда', text: 'Университетке тікелей құжат тапсыру. Семестрлер — ақпан/шілде.' },
      { title: '6–8 ай қалғанда', text: 'Шартты оффер. Қаржылық құжаттарды жинау.' },
      { title: '4–6 ай қалғанда', text: 'Шартсыз оффер. Студенттік визаға өтініш беру.' },
      { title: '1–2 ай қалғанда', text: 'Виза, тұрғын үй, ұшу.' },
    ],
    us: [
      { title: 'Тамыз – қазан', text: 'Common App ашылады. SAT/TOEFL/IELTS тапсыру.' },
      { title: 'Қараша – қаңтар', text: 'Early Decision/Action — 1 қарашаға дейін; Regular Decision — 1–15 қаңтарға дейін.' },
      { title: 'Наурыз – сәуір', text: 'Шешімдер. Қаржылық көмек / стипендиялар.' },
      { title: 'Мамыр – тамыз', text: 'I-20, F-1 визасы, тұрғын үй, ұшу.' },
    ],
    generic: [
      { title: 'Басталуына 10–12 ай қалғанда', text: 'Бағдарламалар мен университеттерді таңдау, ресми сайттарда талаптар мен мерзімдерді тексеру.' },
      { title: '8–10 ай қалғанда', text: 'Университетке тікелей құжат тапсыру, тілдік тест (IELTS/TOEFL) және бейіндік емтихандарды тапсыру.' },
      { title: '4–6 ай қалғанда', text: 'Оффер алу, қаржылық құжаттарды жинау, студенттік визаға өтініш беру.' },
      { title: '1–2 ай қалғанда', text: 'Виза, тұрғын үй брондау, ұшу.' },
    ],
  },
};

export function pickTimeline(locale: Locale, country: string): TimelineItem[] {
  const c = country.toLowerCase();
  const key: Key =
    /kingdom|britain|england|scotland|wales/.test(c) ? 'uk'
    : /canada/.test(c) ? 'canada'
    : /australia|zealand/.test(c) ? 'au'
    : /united states|usa|america/.test(c) ? 'us'
    : 'generic';
  return timelines[locale][key];
}
