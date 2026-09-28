import { get, getBrowser, tableRows, sleep } from './_lib.mjs';

// Разведка 28.09.2026 (Woosong University, Daejeon, Ю. Корея).
//
// Карточка: sourceUrl = https://www.wsu.ac.kr/ — 1 программа-заглушка
// "Programmes — contact StudyRoom" (level: bachelor).
//
// Проверено заново (02.09.2026 www.wsu.ac.kr уходил в бесконечный редирект на
// err.wsu.ac.kr): сейчас www.wsu.ac.kr/ всё ещё редиректит — уже не на err.wsu.ac.kr,
// а в SSO-цикл (sso.wsu.ac.kr/svc/tk/Auth.eps?... -> ещё редиректы -> curl падает по
// лимиту в 50 редиректов). Корневой домен для прямого обхода непригоден.
//
// НО международный (англоязычный) поддомен english.wsu.ac.kr — рабочий, отдаёт 200
// без единого редиректа: https://english.wsu.ac.kr/page/index.jsp?code=eng0302 —
// страница "Tuition & Fees" с чистой таблицей "ANNUAL TUITION FEE FOR 2026 ACADEMIC
// YEAR" по каждой программе бакалавриата/ассошиэйт/магистратуры/PhD, суммы в USD
// (не в KRW — валюта на самой странице USD, схема каталога её принимает без вопросов).
// Это international-admissions сайт (в шапке — International Service, контакт внизу
// подписан "INTERNATIONAL"), в отличие от корейской версии (сама wsu.ac.kr) — поэтому
// цены отсюда размечены audience: 'international'.
//
// Из таблицы исключены "ESTIMATED ADDITIONAL COSTS" (Application/Enrollment Fee,
// Room & Board, Insurance, Student Council/Activity Fee, Remittance Fee) — не обучение,
// пропущены по правилу. IDegree* оставлен как есть (сумма релевантна только первым
// 4 онлайн-семестрам — это написано у них в сноске, не наш пересчёт).
//
// Карточка сейчас без реальных программ (только TBA-заглушка) — сопоставление по
// title почти наверняка уйдёт в unmatched, это ожидаемо: у StudyRoom пока просто нет
// вудожной программной сетки Woosong в карточке, парсер её не создаёт (не наша зона).

const TUITION_URL = 'https://english.wsu.ac.kr/page/index.jsp?code=eng0302';

const SECTION_LEVEL = {
  "Bachelor’s Degrees": 'bachelor',
  'Associates Degrees (2-year)': 'diploma',
  "Master’s Degrees": 'master',
  'Ph.D. Degrees': 'phd',
};

export default {
  slug: 'woosong-university',
  site: 'https://english.wsu.ac.kr',
  async collect({ log }) {
    const fees = [];
    const gaps = [];

    // Подтверждаем, что корневой домен действительно всё ещё в редирект-петле.
    try {
      get('https://www.wsu.ac.kr/', { timeout: 20 });
      log('www.wsu.ac.kr: неожиданно ответил без ошибки');
    } catch (e) {
      log(`www.wsu.ac.kr всё ещё недоступен напрямую: ${e.message.split('\n')[0]}`);
    }
    await sleep(500);

    let html;
    try {
      html = get(TUITION_URL);
    } catch (e) {
      gaps.push({ why: `curl не смог загрузить ${TUITION_URL}: ${e.message}`, url: TUITION_URL });
      try {
        html = await getBrowser(TUITION_URL, { waitMs: 3000 });
        log('загружено через getBrowser после неудачи curl');
      } catch (e2) {
        gaps.push({ why: `getBrowser тоже не смог: ${e2.message}`, url: TUITION_URL });
        return { programs: [], fees, gaps };
      }
    }

    const rows = tableRows(html);
    let level = null;
    let sawAny = false;
    for (const row of rows) {
      if (row.length === 1 && SECTION_LEVEL[row[0]]) { level = SECTION_LEVEL[row[0]]; continue; }
      if (row.length === 1 && /ESTIMATED ADDITIONAL COSTS/i.test(row[0])) { level = null; continue; } // дальше — не обучение
      if (!level) continue;
      if (row.length !== 2) continue;
      const [title, cell] = row;
      if (title === 'Program' || /Annual Tuition/i.test(title)) continue;
      const m = cell.match(/\$([\d,]+)/);
      if (!m) continue;
      const amount = Number(m[1].replace(/,/g, ''));
      if (!amount) continue;
      sawAny = true;
      fees.push({
        title, level, amount, currency: 'USD', basis: 'year', audience: 'international', scope: 'program',
        url: TUITION_URL, raw: `${title} ${cell}`,
      });
    }

    if (!sawAny) gaps.push({ why: 'таблица ANNUAL TUITION FEE не распозналась — вёрстка могла измениться', url: TUITION_URL });
    gaps.push({
      why: 'карточка Woosong пока содержит только программу-заглушку "Programmes — contact '
        + 'StudyRoom" без реальной программной сетки — программные цены выше почти наверняка '
        + 'не сопоставятся ни с одной программой карточки (это ожидаемо, не баг парсера).',
      url: TUITION_URL,
    });

    return { programs: [], fees, gaps };
  },
};
