// kompas-direct-relink-fees.mjs — КОМПАС 3.5: довязка цен из сводных прайсов. СЕТИ НЕ НУЖНО.
//
// Зачем отдельным шагом: сбор показал, что у прямых партнёров цена почти нигде не стоит
// на странице программы — она лежит в сводной таблице, где подпись слева это не название
// программы, а «Total Tuition Fees in USD», «2 trimesters (8 months)» или «Bachelor’s degrees».
// Но у части сайтов название и цена стоят В ОДНОЙ ячейке:
//   «– International Business 9 000 € / year» (Karelia).
// Такую строку привязать к программе можно честно, по вхождению названия.
//
// Что НЕ делаем: не растягиваем цену уровня на все программы уровня и не угадываем по
// порядку строк. Не привязалось — остаётся в feeTable для глаз владельца (правило 4).
//
// Запуск: node kompas-direct-relink-fees.mjs [--dry-run]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('relink');
const DRY = args.has('dry-run');
const DIR = path.join(KOMPAS_DIR, 'extracts', 'direct');

// Родовой заголовок раздела, а не программа.
const GENERIC_TITLE = /^(master|bachelor|doctora|phd|undergraduate|postgraduate|foundation)?[’'s ]*\s*(degree|degrees)?\s*(programmes?|programs?|courses?|degrees?|studies)\s*$/i;

const norm = (s) => (s || '').toLowerCase()
  .replace(/[’'`]/g, '')
  .replace(/[^a-zа-я0-9 ]/gi, ' ')
  .replace(/\b(bsc|ba|beng|llb|bba|msc|ma|mba|meng|llm|hons|programme|program|degree|course|in|of|and)\b/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Название программы, зашитое в ту же ячейку, что и цена. */
function titleInsideCell(rawCell) {
  if (!rawCell) return null;
  // убираем сумму с валютой и хвост «/ year»
  const t = rawCell
    .replace(/[\d][\d\s.,]*\s*(€|£|\$|EUR|USD|GBP|AED|CZK|TRY|PLN|HUF|INR|MYR|AUD)/gi, ' ')
    .replace(/(€|£|\$|EUR|USD|GBP|AED|CZK|TRY|PLN|HUF|INR|MYR|AUD)\s*[\d][\d\s.,]*/gi, ' ')
    .replace(/\/\s*(year|yr|semester|term|trimester|month)\b/gi, ' ')
    .replace(/^[\s–—-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length >= 6 && t.length <= 90 ? t : null;
}

async function main() {
  let files;
  try { files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json')); }
  catch { console.error('нет выгрузок — сначала kompas-collect-direct.mjs'); process.exit(1); }

  let totalLinked = 0;
  const perUni = [];

  for (const f of files) {
    const file = path.join(DIR, f);
    const j = JSON.parse(await fs.readFile(file, 'utf8'));
    const rows = j.feeTable ?? [];
    if (!rows.length) continue;

    // индекс «название из ячейки → цена»
    const idx = new Map();
    for (const r of rows) {
      const inner = titleInsideCell(r.rawCell);
      for (const cand of [inner, r.label]) {
        const k = norm(cand);
        if (k.length >= 6 && !idx.has(k)) idx.set(k, r);
      }
    }

    let linked = 0;
    let cleared = 0;
    for (const p of j.programs ?? []) {
      // шаг идемпотентен: прежнюю довязку снимаем и считаем заново
      if (p.feeMatch === 'fee-table-relink') {
        delete p.tuition; delete p.feeAudience; delete p.feeLabel;
        delete p.feeSourceUrl; delete p.feeMatch;
        cleared++;
      }
      if (p.tuition) continue;
      // родовым заголовкам цену не ставим: у Karelia «Master’s Degree Programmes»
      // получил цену Sustainability Management — это привязка не к той программе
      if (GENERIC_TITLE.test(p.title.trim())) continue;
      const k = norm(p.title);
      if (k.length < 8) continue;
      // ТОЛЬКО точное совпадение. Нечёткое (includes) проверено глазами и даёт брак:
      // у SP Jain на «Doctor of Business Administration» село AUD 700 из абзаца
      // «Please Note…», то есть сбор за заявку, а не стоимость обучения.
      const hit = idx.get(k);
      if (!hit) continue;
      p.tuition = { amount: hit.amount, currency: hit.currency };
      p.feeAudience = hit.feeAudience;
      p.feeLabel = (hit.rawCell || hit.label).slice(0, 80);
      p.feeSourceUrl = hit.feeUrl;
      p.feeMatch = 'fee-table-relink'; // видно, что цена пришла не со страницы программы
      linked++;
    }

    // пишем и когда привязок нет, но прежние сняты — иначе брак остаётся на диске
    if (linked || cleared) {
      j.withPrice = (j.programs ?? []).filter((p) => p.tuition).length;
      j.feeRowsMatched = linked;
      if (!DRY) await fs.writeFile(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
      log(`${j.slug}: +${linked} цен, снято ${cleared} (итого ${j.withPrice})`);
      perUni.push({ slug: j.slug, linked, cleared, withPrice: j.withPrice });
      totalLinked += linked;
    }
  }

  console.log(JSON.stringify({ files: files.length, universitiesTouched: perUni.length, linked: totalLinked }, null, 2));
  console.log('RELINK DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
