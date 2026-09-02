#!/usr/bin/env node
// kompas-collect-a1.mjs — задача A1: пересбор прямых партнёров, у которых
// в карточке вместо программ лежит мусор.
//
// Решение владельца 02.09.2026: «пересобрать с офсайтов». Правило 1 КОМПАСа
// (программы только с агрегаторов) снято для этого списка — агрегаторы этих
// вузов не показывают вовсе.
//
// ПОЧЕМУ ПАРСЕР НА ДОМЕН. Общий kompas-collect-direct ищет карточки курсов по
// общей разметке и на этих сайтах приносит что угодно: у beykent он записал
// «Mainpage» и семь новостей про публикации преподавателей, у sp-jain — 37
// профилей сотрудников. Каталог программ у каждого вуза лежит на своей вёрстке,
// поэтому здесь на каждый домен свой разбор, а не одна догадка на всех.
//
// РАЗВЕДКА 02.09 ПО ПЯТИ ВУЗАМ, у которых карточка состоит из мусора:
//   beykent.edu.tr    — 200, разбор есть (ниже)
//   final.edu.tr      — 200, разбор есть (ниже)
//   northland.edu     — 200, НО ЭТО ЧУЖОЙ ВУЗ: заголовок «Northland College —
//                       The Environmental Liberal Arts College», Висконсин, США,
//                       а карточка у нас про Northland Institute в ОАЭ.
//                       Офсайт привязан неверно, собирать с него нельзя.
//   uem.edu.pl        — 521, сервер лежит.
//   wsu.ac.kr         — уводит в бесконечный редирект на свой же err.wsu.ac.kr.
//
// Живой каталог правится только с --apply и только если ни одна цена и ни один
// срок не осиротеет: tuition.byProgram и deadlines висят на слагах программ.
// Старый состав кладётся в бэкап.
//
// Запуск: node kompas-collect-a1.mjs [--slug=beykent-university] [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [
  path.join(ROOT, 'site/src/content/universities'),
  path.join(ROOT, 'sources/kompas/catalog-work'),
];
const EXTRACT_DIR = path.join(ROOT, 'sources/kompas/extracts/direct');
const BACKUP = path.join(ROOT, 'sources/kompas/a1-programs-backup.json');
const APPLY = process.argv.includes('--apply');
const ONLY = (process.argv.find((a) => a.startsWith('--slug=')) || '').slice(7);
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const NAMED = {
  amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', uuml: 'ü', Uuml: 'Ü',
  ouml: 'ö', Ouml: 'Ö', ccedil: 'ç', Ccedil: 'Ç', scaron: 'š', rsquo: '’', ndash: '–', mdash: '—',
};
const dec = (s) => s
  .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCodePoint(parseInt(c, 16)))
  .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(+c))
  .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NAMED ? NAMED[n] : (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m)));

// curl, а не fetch: у турецких хостов неполные цепочки сертификатов, node на них падает.
const get = (url) => execFileSync('curl', ['-sS', '-L', '--max-time', '40', '-A', UA, url],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const TR = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i' };
const slugify = (s) => s.toLowerCase().replace(/[çğıöşüİ]/g, (c) => TR[c] || c)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// У Beykent в тексте ссылки название факультета приклеено к названию программы:
// «Mühendislik - Mimarlık Fakültesi Bilgisayar Mühendisliği». Приставку снимаем —
// это заголовок раздела, а не часть имени программы.
const stripUnit = (s) => s.replace(/^.{3,60}?(Fakültesi|Yüksekokulu|Enstitüsü)\s+/u, '').trim();

// Разделы факультета лежат на той же глубине, что и программы, поэтому глубина
// их не отличает: у стоматологов страница факультета вместо списка программ
// показывает «Çalışma Alanları», «Erasmus+», «Laboratuvarlar». Отсекаем по слагу
// раздела — он устойчивее, чем текст ссылки.
const SECTION_SLUGS = new Set([
  'calisma-alanlari', 'erasmus', 'laboratuvarlar', 'akademik-kadro', 'staj',
  'duyurular', 'iletisim', 'hakkimizda', 'misyon', 'vizyon', 'basvuru-sartlari',
  'ders-plani', 'yonetim', 'bolum-mesaji', 'egitim-amaclari', 'kariyer',
]);
const isSection = (url) => SECTION_SLUGS.has(url.split('?')[0].replace(/\/$/, '').split('/').pop());

const anchors = (html) => [...html.matchAll(/<a[^>]+href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .map((m) => ({ href: m[1], text: dec(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() }))
  .filter((a) => a.text.length > 2);

// Уровень по турецкому названию ступени. Не угадываем: нет приметы — нет уровня.
const trLevel = (s) => (/doktora/i.test(s) ? 'phd' : /y[uü]ksek\s*lisans|tezli|tezsiz/i.test(s) ? 'master' : null);

const SITES = {
  'beykent-university': {
    site: 'https://www.beykent.edu.tr/',
    collect() {
      const out = [];
      // Бакалавриат: страница ступени → девять факультетов → программы факультета.
      const idx = get('https://www.beykent.edu.tr/aday-ogrenci/bolumler-programlar/lisans');
      const faculties = [...new Set(anchors(idx)
        .map((a) => a.href)
        .filter((h) => /\/bolumler-programlar\/lisans\/[a-z-]+$/.test(h)))];
      for (const f of faculties) {
        const url = f.startsWith('http') ? f : `https://www.beykent.edu.tr${f}`;
        const page = get(url);
        const unit = f.split('/').pop();
        const before = out.length;
        for (const a of anchors(page)) {
          if (!new RegExp(`${unit}/[a-z0-9(-]`, 'i').test(a.href)) continue;
          if (isSection(a.href)) continue;
          out.push({ title: stripUnit(a.text), level: 'bachelor', unit, url: a.href.startsWith('http') ? a.href : `https://www.beykent.edu.tr${a.href}` });
        }
        // Урок сессии 3: без счётчика недобора прогон отчитается об успехе на
        // проценте данных. У стоматологов страница факультета показывает только
        // разделы, ссылки на программу нет — факультет уходит в дыры, а не молча.
        if (out.length === before) GAPS.push({ slug: 'beykent-university', unit, url, why: 'на странице факультета нет ни одной ссылки на программу' });
      }
      // Магистратура и докторантура. Страница института — это ОГЛАВЛЕНИЕ:
      // «Başvuru Şartları», «Yüksek Lisans», «Doktora», «Uzaktan Eğitim».
      // Списки программ лежат ступенью ниже, поэтому спускаемся ещё раз.
      const gradIdx = get('https://www.beykent.edu.tr/aday-ogrenci/bolumler-programlar/lisansustu-egitim-enstitusu');
      for (const step of anchors(gradIdx)) {
        const level = trLevel(step.text);
        if (!level) continue;
        const stepUrl = step.href.startsWith('http') ? step.href : `https://www.beykent.edu.tr${step.href}`;
        const tail = stepUrl.split('/').pop();
        for (const a of anchors(get(stepUrl))) {
          if (!new RegExp(`${tail}/[a-z0-9(-]`, 'i').test(a.href)) continue;
          if (isSection(a.href)) continue;
          out.push({ title: stripUnit(a.text), level, unit: tail, url: a.href.startsWith('http') ? a.href : `https://www.beykent.edu.tr${a.href}` });
        }
      }
      return out;
    },
  },
  'final-international-university': {
    site: 'https://www.final.edu.tr/',
    collect() {
      const page = get('https://www.final.edu.tr/tum-programlar');
      const out = [];
      for (const a of anchors(page)) {
        const m = a.href.match(/f-\d+-([a-z-]+)\/i-\d+-programlar\/b-\d+-/i);
        if (!m) continue;
        const unit = m[1];
        // Fakülte и yüksekokul дают бакалавриат; enstitü — магистратуру и докторантуру;
        // meslek yüksekokulu — önlisans, которому уровня в схеме нет.
        const level = /meslek/i.test(unit) ? null
          : /enstitu/i.test(unit) ? trLevel(a.text)
            : /fakultesi|yuksekokul/i.test(unit) ? 'bachelor' : null;
        out.push({ title: a.text, level, unit, url: a.href.startsWith('http') ? a.href : `https://www.final.edu.tr/${a.href.replace(/^\//, '')}` });
      }
      return out;
    },
  },
};

const UNREACHABLE = {
  'northland-institute': 'northland.edu — это Northland College, Висконсин, США, а карточка про Northland Institute в ОАЭ: офсайт привязан неверно, собирать нельзя',
  'university-of-european-management': 'uem.edu.pl отдаёт 521 — сервер лежит',
  'woosong-university': 'wsu.ac.kr уводит в бесконечный редирект на err.wsu.ac.kr',
};

const GAPS = [];
const backup = [];
const summary = [];

for (const [slug, cfg] of Object.entries(SITES)) {
  if (ONLY && ONLY !== slug) continue;
  process.stdout.write(`--- ${slug}\n`);
  let raw;
  try { raw = cfg.collect(); } catch (e) { console.log(`   сбор упал: ${e.message}`); continue; }

  // Дубли по названию внутри вуза схлопываем, уровень не выдумываем.
  const seen = new Map();
  for (const p of raw) {
    const key = `${p.title}||${p.level || ''}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  const all = [...seen.values()];
  const withLevel = all.filter((p) => p.level);
  const noLevel = all.filter((p) => !p.level);

  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  const extract = {
    slug, source: 'official', sourceKind: 'kompas-direct-a1', site: cfg.site, checkedAt: TODAY,
    note: 'Пересбор 02.09.2026: в карточке лежал мусор общего сборщика. Цены на этих страницах не подписаны — не собраны.',
    gaps: GAPS.filter((g) => g.slug === slug),
    programs: all.map((p) => ({ ...p, verifiedBySite: true, source: 'official', checkedAt: TODAY })),
  };
  if (APPLY) fs.writeFileSync(path.join(EXTRACT_DIR, `${slug}.json`), JSON.stringify(extract, null, 2) + '\n');

  const programs = withLevel.map((p) => ({
    slug: slugify(p.title), title: p.title, level: p.level,
    source: 'official', programUrl: p.url, kompasStatus: 'source-added',
  }));
  // Один слаг — одна программа: иначе схема ловит dup-program-slug.
  const bySlug = new Map();
  for (const p of programs) if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);
  const finalPrograms = [...bySlug.values()];

  let wrote = 0, blocked = null;
  for (const dir of DIRS) {
    const file = path.join(dir, `${slug}.json`);
    if (!fs.existsSync(file)) continue;
    const card = JSON.parse(fs.readFileSync(file, 'utf8'));
    const newSlugs = new Set(finalPrograms.map((p) => p.slug));
    const orphanFees = Object.keys(card.tuition?.byProgram || {}).filter((s) => !newSlugs.has(s));
    const orphanDates = Object.keys(card.deadlines || {}).filter((s) => !newSlugs.has(s));
    if (orphanFees.length || orphanDates.length) {
      blocked = `осиротели бы ${orphanFees.length} цен и ${orphanDates.length} сроков — состав не заменён`;
      continue;
    }
    backup.push({ dir: path.basename(dir), slug, programs: card.programs });
    card.programs = finalPrograms;
    card.lastChecked = TODAY;
    if (APPLY) fs.writeFileSync(file, JSON.stringify(card, null, 2) + '\n');
    wrote++;
  }

  summary.push({ slug, collected: all.length, withLevel: finalPrograms.length, noLevel: noLevel.length, wrote, blocked });
  console.log(`   собрано ${all.length}, с уровнем ${finalPrograms.length}, без уровня ${noLevel.length}${blocked ? `; ${blocked}` : `; карточек заменено ${wrote}`}`);
}

if (APPLY && backup.length) fs.writeFileSync(BACKUP, JSON.stringify({ ranAt: new Date().toISOString(), backup }, null, 2) + '\n');

console.log(`\n${APPLY ? 'ЗАПИСАНО' : 'СУХОЙ ПРОГОН'}`);
for (const s of summary) console.log(`  ${s.slug}: ${s.withLevel} программ`);
if (GAPS.length) {
  console.log(`НЕДОБОР — разделов без единой программы: ${GAPS.length}`);
  for (const g of GAPS) console.log(`  ${g.slug}/${g.unit}: ${g.why}`);
}
console.log('недоступны, карточки не тронуты:');
for (const [slug, why] of Object.entries(UNREACHABLE)) console.log(`  ${slug} — ${why}`);
