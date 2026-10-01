import { get, getBrowser, text, abs, tableRows, sleep } from './_lib.mjs';

// Разведка 28.09.2026, расширена 29.09.2026 (Woosong University, Daejeon, Ю. Корея).
//
// Корневой домен www.wsu.ac.kr по-прежнему непригоден для обхода (уходит в SSO-
// редирект-петлю, curl падает по лимиту в 50 редиректов — проверено заново). Рабочий
// международный (англоязычный) поддомен — english.wsu.ac.kr, это international-
// admissions сайт (в шапке — International Service), поэтому цены с него размечены
// audience: 'international'.
//
// 28.09.2026: программы брались только со страницы тарифов (eng0302) — каждая
// строка таблицы считалась программой. 29.09.2026, по прямому поручению («сделать
// programs полным») — нашлась официальная страница-каталог программ:
//   /page/index.jsp?code=eng0201 (Undergraduate Programs, вкладка внутри общей
//     страницы Programs) — карточки по колледжам (SolBridge International School
//     of Business, Endicott College of International Studies, JW Kim College of
//     Future Studies, IDegree, College of Health and Welfare, College of Software
//     Convergence, College of Culinary Arts, College of Railroad), у каждой
//     специальности своя ссылка (часто на отдельный сайт колледжа — solbridge.ac.kr,
//     endicott.ac.kr, jcfs.ac.kr, idegree.wsu.ac.kr). 15 бакалаврских специальностей.
//   /page/index.jsp?code=eng0202 (Graduate Programs) — таблицы «Master's programs»
//     (5 позиций) и «Ph.D. programs» (4 позиции), тоже свои ссылки.
// Итого по каталогу — 15 + 5 + 4 = 24 программы (сайт пишет «over 20 English-taught
// programs» — сходится).
//
// Таблица тарифов (eng0302, "ANNUAL TUITION FEE FOR 2026 ACADEMIC YEAR") даёт 14
// бакалаврских + 8 магистерских + 6 PhD строк с ценой в USD. Сопоставляем построчно
// с каталогом по нормализованному названию (без пометок в скобках вида "(AACSB
// accredited)"/"(formerly known as …)", без начального "Global ", "&" -> "and"):
// почти всё совпадает 1:1. Не совпало и осталось отдельными программами (правило —
// не сочинять соответствие, которого не видно из текста):
//   - "Artificial Intelligence (AI)" (тариф, $10,494) — не совпадает с "AI • HCI"
//     (каталог, JW Kim College): разные по буквам названия, могут быть одной и той
//     же специальностью под разными вывесками на разных страницах сайта, но
//     доказательства тождества нет — оставлены как два разных пункта.
//   - "MS in AI Convergence", "MA in Global and Human Studies", "MS in AI Business
//     Management", "Master's in ECE", "Ph.D. AI Convergence", "Ph.D. in Design
//     Management" (все — тариф) — таких позиций на странице-каталоге Graduate
//     Programs нет вовсе, но это тот же официальный домен с реальной ценой,
//     поэтому остаются отдельными программами, а не выбрасываются.
//   - "K-Pop Arts Management", "AI • HCI", "International Business Management (MS)"
//     (все — каталог) — есть в каталоге, но строки с ценой на tuition-странице не
//     нашлось — программы остаются, просто без цены.
// "Associates Degrees (2-year)" (Baking and Pastry, Culinary Arts, K-Beauty Makeup,
// K-Pop Music and Dance) — уровня associate/diploma нет в схеме каталога — gaps,
// не programs (было по сути так же и раньше, просто не проговорено явно).
// "ESTIMATED ADDITIONAL COSTS" (Application/Enrollment Fee, Room & Board, Insurance,
// Student Council/Activity Fee, Remittance Fee) — не обучение, пропущены.
// IDegree* оставлен как есть (сумма релевантна только первым 4 онлайн-семестрам —
// это написано у них в сноске, не наш пересчёт).
//
// Корейский трек (~60 специальностей на корейском, отдельная от английского
// валюта/язык, упомянут на этой же странице «over 60 Korean-taught programs») —
// сознательно не берём: он на корейском языке, требует TOPIK, и живёт на корневом
// домене wsu.ac.kr, который недоступен (см. выше). Это не тот сайт/трек, который
// имеет смысл для англоязычного/международного каталога StudyRoom — помечено gaps.

const PROGRAMS_URL = 'https://english.wsu.ac.kr/page/index.jsp?code=eng0201';
const GRAD_URL = 'https://english.wsu.ac.kr/page/index.jsp?code=eng0202';
const TUITION_URL = 'https://english.wsu.ac.kr/page/index.jsp?code=eng0302';

const SECTION_LEVEL = {
  "Bachelor’s Degrees": 'bachelor',
  'Associates Degrees (2-year)': null, // -> gaps, нет уровня в схеме
  "Master’s Degrees": 'master',
  'Ph.D. Degrees': 'phd',
};

/** Название без сносок/пометок сайта и без начального "Global " — для сопоставления. */
function norm(title) {
  return String(title)
    .replace(/\s*\((AACSB accredited|formerly known as [^)]*)\)/gi, '')
    .replace(/\*+$/, '')
    .replace(/&/g, ' and ')
    .replace(/•/g, ' ')
    .replace(/[-–]/g, ' ')
    .trim()
    .replace(/^global\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanTitle(title) {
  return String(title)
    .replace(/\s*\((AACSB accredited|formerly known as [^)]*)\)/gi, '')
    .replace(/\*+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Карточки специальностей на eng0201: <p class="ProgramsTitle">Колледж</p> + <a href=…><p class="ProgramsText">Название</p>. */
function undergradPrograms(html) {
  const out = [];
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = /<p class="ProgramsTitle[^"]*">([^<]+)<\/p>|<a\s+href="([^"]+)"[^>]*class="hover"[^>]*>[\s\S]*?<p class="ProgramsText">([\s\S]*?)<\/p>/g;
  let college = null;
  let m;
  while ((m = re.exec(clean))) {
    if (m[1]) { college = text(m[1]); continue; }
    const title = text(m[3].replace(/<br\s*\/?>/gi, ' '));
    if (!title) continue;
    out.push({ title, level: 'bachelor', url: abs(m[2], PROGRAMS_URL) || PROGRAMS_URL, college });
  }
  return out;
}

/** Таблицы Master's/Ph.D. programs на eng0202: <table class="tbl_skin1"> с <tr><td>Название(+ссылка)</td><td>Тип</td><td>Школа</td></tr>. */
function gradPrograms(html) {
  const out = [];
  let level = null;
  for (const rowMatch of html.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
    // HTML-комментарии со старыми (закомментированными) ссылками попадаются прямо
    // внутри ячеек — вырезаем целиком, иначе их текст склеивается с настоящим.
    const row = rowMatch[0].replace(/<!--[\s\S]*?-->/g, '');
    const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => c[1]);
    if (!cells.length) continue;
    const texts = cells.map((c) => text(c));
    if (texts.length === 1) {
      if (/Master.s programs/i.test(texts[0])) level = 'master';
      else if (/Ph\.?D\.? programs/i.test(texts[0])) level = 'phd';
      continue;
    }
    if (!level) continue;
    if (texts[0] === 'Degree') continue; // строка-подзаголовок Degree/Type/School
    const hrefMatch = cells[0].match(/<a\s+href="([^"]+)"/);
    out.push({ title: texts[0], level, url: hrefMatch ? (abs(hrefMatch[1], GRAD_URL) || GRAD_URL) : GRAD_URL });
  }
  return out;
}

export default {
  slug: 'woosong-university',
  site: 'https://english.wsu.ac.kr',
  async collect({ log }) {
    const fees = [];
    const gaps = [];

    try {
      get('https://www.wsu.ac.kr/', { timeout: 20 });
      log('www.wsu.ac.kr: неожиданно ответил без ошибки');
    } catch (e) {
      log(`www.wsu.ac.kr всё ещё недоступен напрямую: ${e.message.split('\n')[0]}`);
    }
    await sleep(500);

    async function fetchOrBrowser(url) {
      try {
        return get(url);
      } catch (e) {
        try {
          const html = await getBrowser(url, { waitMs: 3000 });
          log(`${url}: загружено через getBrowser после неудачи curl`);
          return html;
        } catch (e2) {
          gaps.push({ why: `страница не открылась ни через curl, ни через getBrowser: ${e2.message}`, url });
          return null;
        }
      }
    }

    const ugHtml = await fetchOrBrowser(PROGRAMS_URL);
    await sleep(500);
    const gradHtml = await fetchOrBrowser(GRAD_URL);
    await sleep(500);
    const tuitionHtml = await fetchOrBrowser(TUITION_URL);
    await sleep(500);

    const catalog = [
      ...(ugHtml ? undergradPrograms(ugHtml) : []),
      ...(gradHtml ? gradPrograms(gradHtml) : []),
    ];
    if (ugHtml && !catalog.some((p) => p.level === 'bachelor')) {
      gaps.push({ why: 'на странице Undergraduate Programs не распозналась ни одна специальность — вёрстка могла измениться', url: PROGRAMS_URL });
    }
    if (gradHtml && !catalog.some((p) => p.level === 'master' || p.level === 'phd')) {
      gaps.push({ why: 'на странице Graduate Programs не распозналась ни одна программа — вёрстка могла измениться', url: GRAD_URL });
    }

    // index по нормализованному названию -> запись каталога (для подстановки цены и url).
    const byNorm = new Map();
    for (const p of catalog) {
      const k = norm(p.title);
      if (k && !byNorm.has(k)) byNorm.set(k, p);
    }

    let sawAnyFee = false;
    if (tuitionHtml) {
      const rows = tableRows(tuitionHtml);
      let level;
      let inAssociates = false;
      for (const row of rows) {
        if (row.length === 1 && Object.prototype.hasOwnProperty.call(SECTION_LEVEL, row[0])) {
          level = SECTION_LEVEL[row[0]];
          inAssociates = row[0] === 'Associates Degrees (2-year)';
          continue;
        }
        if (row.length === 1 && /ESTIMATED ADDITIONAL COSTS/i.test(row[0])) { level = undefined; inAssociates = false; continue; }
        if (row.length !== 2) continue;
        const [rawTitle, cell] = row;
        if (rawTitle === 'Program' || /Annual Tuition/i.test(rawTitle)) continue;
        if (inAssociates) {
          gaps.push({ why: `"${rawTitle}" — Associate degree (2-year), нет такого уровня в схеме каталога`, url: TUITION_URL });
          continue;
        }
        if (!level) continue;
        const m = cell.match(/\$([\d,]+)/);
        if (!m) continue;
        const amount = Number(m[1].replace(/,/g, ''));
        if (!amount) continue;
        sawAnyFee = true;
        const title = cleanTitle(rawTitle);
        const hit = byNorm.get(norm(rawTitle));
        fees.push({
          title: hit ? hit.title : title, level, amount, currency: 'USD', basis: 'year',
          audience: 'international', scope: 'program', programUrl: hit ? hit.url : undefined,
          url: TUITION_URL, raw: `${rawTitle} ${cell}`,
        });
        if (!hit) {
          // Реальная строка с ценой без пары в каталоге программ — тоже программа вуза.
          catalog.push({ title, level, url: TUITION_URL });
          byNorm.set(norm(rawTitle), { title, level, url: TUITION_URL });
        }
      }
    }
    if (!sawAnyFee) gaps.push({ why: 'таблица ANNUAL TUITION FEE не распозналась — вёрстка могла измениться', url: TUITION_URL });

    gaps.push({
      why: 'корейский трек (~60 специальностей на корейском, TOPIK) сознательно не включён: '
        + 'он на другом языке/домене (корневой wsu.ac.kr недоступен — SSO-редирект-петля) и не '
        + 'относится к международному/англоязычному приёму, который обслуживает english.wsu.ac.kr',
      url: 'https://www.wsu.ac.kr/',
    });

    const programs = catalog.map((p) => ({ title: p.title, level: p.level, url: p.url }));
    return { programs, fees, gaps };
  },
};
