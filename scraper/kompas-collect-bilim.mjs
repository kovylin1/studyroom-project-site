#!/usr/bin/env node
// kompas-collect-bilim.mjs — задача B: Demiroğlu Bilim University, последний
// прямой партнёр без карточки. Строка документа — «Bilim Univ, Turkey».
//
// ПОЧЕМУ ВУЗ СЧИТАЛИ НЕДОСТУПНЫМ. Все прошлые заходы били в `bilim.edu.tr`
// и получали 503 «No server is available». Настоящий хост подсказал сертификат
// этого же домена: CN=*.demiroglu.bilim.edu.tr. Адрес сайта —
// https://demiroglu.bilim.edu.tr/ , отдаёт 200 и 212 КБ. Домен не «не резолвился» —
// стучались не туда.
//
// ИСТОЧНИК ДАННЫХ — страница /ogrenci/burslar-ve-ucretler: одна таблица,
// факультет | программа | квота | цена | стипендия | цена со стипендией.
//
// ЦЕНЫ НЕ ЗАПИСЫВАЮТСЯ, и это не лень. Каждая сумма привязана к стипендиальной
// квоте: «(TAM BURSLU)» — полная стипендия, цены нет вовсе; «(% 50 İNDİRİMLİ)» —
// цена места со скидкой 50 %; «(ÜCRETLİ)» — полная цена. Что у программы
// с квотой «50 %» стоит половина полной, видно прямо на странице: у «ANESTEZİ»
// есть обе строки, 450 000 и 900 000 TL. Но у остальных 18 программ полной цены
// НЕТ, и вывести её удвоением — это выдумать число (правило 2 плана).
// Плюс турецкой лиры нет в CURRENCY_CODES схемы сайта.
// Вся таблица уходит в выгрузку целиком, вопрос владельцу — кейсом.
//
// ÖNLİSANS НЕ ЗАВОДИТСЯ. Девять программ «Sağlık Hizmetleri Meslek Yüksekokulu» —
// это двухлетний önlisans, которому в схеме каталога уровня нет (их восемь).
// Уровень не выдумываем: программа без распознаваемого уровня не создаётся.
//
// Запуск: node kompas-collect-bilim.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = 'demiroglu-bilim-university';
const SITE = 'https://demiroglu.bilim.edu.tr/';
const FEES_URL = `${SITE}ogrenci/burslar-ve-ucretler`;
const EXTRACT = path.join(ROOT, 'sources/kompas/extracts/direct', `${SLUG}.json`);
const CASES = path.join(ROOT, 'sources/kompas/bilim-cases.json');
const DIRS = [
  path.join(ROOT, 'site/src/content/universities'),
  path.join(ROOT, 'sources/kompas/catalog-work'),
];
const APPLY = process.argv.includes('--apply');
const TODAY = new Date().toISOString().slice(0, 10);

// Факультеты дают бакалавриат; meslek yüksekokulu — önlisans, уровня нет.
const BACHELOR_UNITS = /FAKÜLTESİ|HEMŞİRELİK YÜKSEKOKULU/i;
const VOCATIONAL_UNIT = /MESLEK YÜKSEKOKULU/i;
// Приставки квот: их снимаем, программа от квоты не меняется.
const TIER = /\s*\((TAM BURSLU|TAM BURSLUİ|BURSLU|%\s*50\s*İNDİRİ?MLİ|ÜCRETLİ)\)\s*/gi;

const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCodePoint(parseInt(c, 16)))
  .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c))
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i', 'I': 'i' };
const slugify = (s) => s.toLowerCase().replace(/[çğıöşüİI]/g, (c) => TR[c] || c)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Качаем curl-ом, а не fetch: сервер не отдаёт промежуточный сертификат, и node
// падает на UNABLE_TO_VERIFY_LEAF_SIGNATURE. У curl своя связка корней, проверка
// подлинности при этом НЕ отключается — никакого -k.
const html = execFileSync('curl', [
  '-sS', '-L', '--max-time', '40',
  '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
  FEES_URL,
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
if (html.length < 1000) { console.error(`страница цен пуста (${html.length} б)`); process.exit(1); }

const table = html.match(/<table[\s\S]*?<\/table>/i);
if (!table) { console.error('таблицы на странице нет — разметка сменилась, разбор не угадываем'); process.exit(1); }

const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)]
  .map((r) => [...r[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((c) => decode(c[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()))
  .filter((c) => c.length >= 4 && c[0] && c[1] && !/FAKÜLTE \/ YÜKSEKOKUL/i.test(c[0]));

const byProgram = new Map();
for (const [unit, rawName, quota, price, , discounted] of rows) {
  // «BÖLÜMÜ» — это «отделение», структурное слово, и стоит оно не у всех строк.
  // Снимаем ради единообразия. Само название и его регистр не трогаем:
  // в турецком строчная «I» даёт «ı», и «TIP» (медицина) стало бы «tip» (тип).
  const title = rawName.replace(TIER, ' ').replace(/\s+BÖLÜMÜ\s*$/i, '')
    .replace(/\s+/g, ' ').trim();
  if (!title) continue;
  const level = BACHELOR_UNITS.test(unit) ? 'bachelor' : VOCATIONAL_UNIT.test(unit) ? null : null;
  const key = `${unit}||${title}`;
  const seen = byProgram.get(key) || { unit, title, level, tiers: [] };
  seen.tiers.push({ tier: rawName.slice(title.length).trim() || rawName, quota, price, discounted });
  byProgram.set(key, seen);
}

const collected = [...byProgram.values()];
const withLevel = collected.filter((p) => p.level);
const noLevel = collected.filter((p) => !p.level);

fs.mkdirSync(path.dirname(EXTRACT), { recursive: true });
const extract = {
  slug: SLUG,
  source: 'official',
  sourceKind: 'kompas-direct',
  site: SITE,
  feesUrl: FEES_URL,
  checkedAt: TODAY,
  note: 'Цены таблицы привязаны к стипендиальным квотам, а не к программе. В каталог не записаны.',
  programs: collected.map((p) => ({
    title: p.title, unit: p.unit, level: p.level, tiers: p.tiers,
    verifiedBySite: true, source: 'official', checkedAt: TODAY,
  })),
};
if (APPLY) fs.writeFileSync(EXTRACT, JSON.stringify(extract, null, 2) + '\n');

const card = {
  slug: SLUG,
  name: 'Demiroğlu Bilim University',
  country: 'Turkey',
  city: 'Istanbul',
  programs: withLevel.map((p) => ({
    slug: slugify(p.title),
    title: p.title,
    level: p.level,
    source: 'official',
    kompasStatus: 'source-added',
  })),
  // Цен нет: см. шапку. Валюта — заглушка, byProgram пуст, на страницу не выводится.
  tuition: { currency: 'USD', byProgram: {} },
  deadlines: {},
  requirements: { language: {}, exams: [] },
  scholarships: [],
  lastChecked: TODAY,
  sourceUrl: SITE,
  sourceHash: crypto.createHash('sha1').update(html).digest('hex').slice(0, 16),
  confidence: 'partner',
  language: 'en',
  officialUrl: SITE,
  officialUrlSource: 'cert:*.demiroglu.bilim.edu.tr',
  officialUrlCheckedAt: TODAY,
  partnerSource: {
    type: 'direct',
    via: [],
    directRaw: 'Bilim Univ, Turkey',
    note: `Заведён ${TODAY} с офсайта. Сайт считался недоступным, потому что стучались в bilim.edu.tr (503); настоящий хост — demiroglu.bilim.edu.tr, подсказан сертификатом.`,
    decidedAt: TODAY,
  },
};

const cases = {
  ranAt: new Date().toISOString(),
  cases: [
    {
      issue: 'bilim_fee_tier_unclear',
      slug: SLUG,
      count: withLevel.length,
      question: 'Цены вуза подписаны стипендиальными квотами: «TAM BURSLU» (бесплатно), «% 50 İNDİRİMLİ» (место со скидкой 50 %), «ÜCRETLİ» (полная цена). Полная цена опубликована только у двух программ из двадцати и ровно вдвое больше скидочной. Записывать ли скидочную цену как цену программы, или ждать полного прайса?',
      evidence: EXTRACT.slice(ROOT.length + 1),
    },
    {
      issue: 'bilim_currency_missing',
      slug: SLUG,
      question: 'Турецкой лиры (TRY) нет в CURRENCY_CODES схемы сайта — без неё цены этого вуза записать нельзя в принципе. Добавлять, как добавляли CHF, BHD, MYR и SGD?',
    },
    {
      issue: 'bilim_onlisans_skipped',
      slug: SLUG,
      count: noLevel.length,
      question: `Не заведено ${noLevel.length} программ önlisans (двухлетний Sağlık Hizmetleri Meslek Yüksekokulu): такого уровня в схеме нет, уровень не выдумываем. Заводить их отдельным уровнем или каталогу они не нужны?`,
      titles: noLevel.map((p) => p.title),
    },
  ],
};

for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  const file = path.join(dir, `${SLUG}.json`);
  if (fs.existsSync(file)) { console.log(`  ${path.basename(dir)}: карточка уже есть, не трогаю`); continue; }
  if (APPLY) fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n');
  console.log(`  ${path.basename(dir)}/${SLUG}.json ${APPLY ? 'записан' : '— записался бы'}`);
}
if (APPLY) fs.writeFileSync(CASES, JSON.stringify(cases, null, 2) + '\n');

console.log(`строк таблицы: ${rows.length}; программ различных: ${collected.length}`);
console.log(`заведено бакалавриатом: ${withLevel.length}; пропущено без уровня (önlisans): ${noLevel.length}`);
console.log(`${APPLY ? 'ЗАПИСАНО' : 'СУХОЙ ПРОГОН'}. Кейсов владельцу: ${cases.cases.length}`);
