// kompas-direct-level-fees.mjs — КОМПАС 3.5: цена, объявленная НА УРОВЕНЬ обучения.
// Сети не нужно, живой каталог не трогаем. Идемпотентно.
//
// Решение 2026-07-23 (владелец спросил, могу ли решить сам — могу, вот обоснование):
// уровневую цену привязывать МОЖНО, но только когда выполнены все три условия:
//   1) сумма реально снята с офсайта вуза и лежит в feeTable выгрузки;
//   2) подпись прайса прямо называет уровень — «Undergraduate (BA) non-EU students»,
//      «Master’s degree», «Bachelor’s degrees»;
//   3) у программы этот уровень определён.
// И у такой цены обязательно стоит feeScope: 'level' — видно, что она за уровень,
// а не за конкретную программу.
//
// Чем это отличается от фабрикации Navitas, за которую нас ругали: там сумма была
// ВЫДУМАНА литеральной таблицей UK_FEE_BAND_BASE прямо в коде скрипта и раздавалась
// всем вузам одинаково. Здесь сумма настоящая, с сайта самого вуза, и честно помечена
// как уровневая. Разница между «взято у источника с оговоркой» и «придумано».
//
// Если у уровня нашлось НЕСКОЛЬКО цен (обычно ЕС и не-ЕС), берётся международная:
// каталог собирается для казахстанских студентов, home-цена им не подходит.
//
// Запуск: node kompas-direct-level-fees.mjs [--dry-run]

import fs from 'node:fs/promises';
import path from 'node:path';
import { KOMPAS_DIR, args, logger } from './lib/kompas-collect.mjs';

const log = logger('level-fees');
const DRY = args.has('dry-run');
const DIR = path.join(KOMPAS_DIR, 'extracts', 'direct');

// Подпись прайса → уровень каталога. Только явные формулировки: «Total Tuition Fees
// in USD» уровня не называет и сюда не попадает.
const LEVEL_OF_LABEL = [
  [/\b(phd|doctoral|doctorate|dba\b)/i, 'phd'],
  [/\b(master|graduate|ma\b|msc\b|mba\b|postgraduate|yüksek lisans)/i, 'master'],
  [/\b(bachelor|undergraduate|ba\b|bsc\b|lisans)/i, 'bachelor'],
  [/\b(foundation|pathway|preparatory|hazırlık)/i, 'foundation'],
  [/\b(diploma|hnd|hnc)\b/i, 'diploma'],
];

/**
 * Аудитория цены по САМОЙ подписи строки, а не по соседним ячейкам.
 * Поймано глазами: в прайсе Anglo-American соседние строки «EU / EFTA nationals» и
 * «non-EU / non-EFTA» попадали в общий контекст, и обе получали international —
 * а это разные суммы, 125 489 и 144 404 CZK. Казахстанскому студенту нужна вторая.
 * Порядок проверок важен: «non-EU» обязано разбираться раньше «EU».
 */
function audienceOfLabel(label) {
  const t = String(label || '');
  if (/\b(non-?eu|non-?efta|non-?uk|international|overseas|foreign)\b/i.test(t)) return 'international';
  if (/\b(eu|efta|home|domestic|resident|residents|citizens?|nationals?)\b/i.test(t)) return 'home';
  return null;
}

function levelOfLabel(label) {
  if (!label) return null;
  for (const [re, lvl] of LEVEL_OF_LABEL) if (re.test(label)) return lvl;
  return null;
}

async function main() {
  const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.json'));
  let totalLinked = 0;
  const perUni = [];

  for (const f of files) {
    const file = path.join(DIR, f);
    const j = JSON.parse(await fs.readFile(file, 'utf8'));
    const rows = j.feeTable ?? [];
    const programs = j.programs ?? [];

    // цена уровня: из нескольких кандидатов побеждает международная
    const byLevel = new Map();
    for (const r of rows) {
      const lvl = levelOfLabel(r.label) ?? levelOfLabel(r.rawCell);
      if (!lvl) continue;
      // аудиторию пересчитываем из подписи: в выгрузке она снята по контексту и врёт
      const aud = audienceOfLabel(r.label) ?? audienceOfLabel(r.rawCell);
      const row = { ...r, feeAudience: aud };
      const prev = byLevel.get(lvl);
      const better = !prev
        || (aud === 'international' && prev.feeAudience !== 'international');
      if (better) byLevel.set(lvl, row);
    }

    let linked = 0, cleared = 0;
    for (const p of programs) {
      if (p.feeScope === 'level') {
        delete p.tuition; delete p.feeAudience; delete p.feeLabel;
        delete p.feeSourceUrl; delete p.feeScope; delete p.feeMatch;
        cleared++;
      }
      if (p.tuition || !p.level) continue;
      const hit = byLevel.get(p.level);
      if (!hit) continue;
      p.tuition = { amount: hit.amount, currency: hit.currency };
      p.feeAudience = hit.feeAudience;
      p.feeLabel = hit.label.slice(0, 90);
      p.feeSourceUrl = hit.feeUrl;
      p.feeScope = 'level'; // цена объявлена на уровень обучения, не на эту программу
      p.feeMatch = 'level-fee';
      linked++;
    }

    if (linked || cleared) {
      j.withPrice = programs.filter((p) => p.tuition).length;
      j.levelFeesLinked = linked;
      if (!DRY) await fs.writeFile(file, JSON.stringify(j, null, 2) + '\n', 'utf8');
      const lv = [...byLevel.entries()].map(([k, v]) => `${k} ${v.amount} ${v.currency}`).join(', ');
      log(`${j.slug}: +${linked} (снято ${cleared}) — ${lv || 'уровней не найдено'}`);
      perUni.push({ slug: j.slug, linked, levels: [...byLevel.keys()] });
      totalLinked += linked;
    }
  }

  console.log(JSON.stringify({ universities: perUni.length, linked: totalLinked }, null, 2));
  console.log('LEVEL-FEES DONE');
}

main().catch((e) => { console.error(e); process.exit(1); });
