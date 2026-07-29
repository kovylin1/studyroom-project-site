#!/usr/bin/env node
// kompas-collect-cats.mjs — КОМПАС сессия 2, агрегатор CATS Global Schools: живой состав.
//
// ЧТО ЭТО ЗА АГРЕГАТОР. CATS — сеть ШКОЛ (GCSE, A-level, sixth form, языковые курсы), а не вузов.
// В вузовский каталог такие карточки ложатся плохо: уровни high_school / sixth_form схемой
// каталога не предусмотрены. Нужно решение владельца, держим ли мы их вообще.
//
// НАХОДКА ЗАМЕРА 2026-07-22. В промежуточной выгрузке `scraper/sources/cats-collected.json`
// поле subjects у GCSE и A-Level заполнено НЕ предметами школы, а таблицей поступлений
// выпускников: «A level / Economics, Russian, Sociology / University College London /
// Social Sciences with Data Science / ...». То есть туда попали названия вузов и специальностей.
// ПРОВЕРЕНО ОТДЕЛЬНО: в живой каталог это НЕ протекло — `expand-cats-programs.mjs` разворачивает
// программы по собственному шаблону предметов, и карточки содержат нормальные «GCSE English
// Language», «GCSE Mathematics». Но любой, кто возьмёт cats-collected.json как источник, будет
// введён в заблуждение — поэтому находка записана.
//
// Здесь собирается только живой состав школ. Usage:
//   node scraper/kompas-collect-cats.mjs [--dry-run]

import { fetchHtml, decodeEntities, writeMembership, args, logger, stats } from './lib/kompas-collect.mjs';

const log = logger('cats');
const AGG = 'cats';
const INDEX = 'https://catsglobalschools.com/our-schools/';
const DRY = args.has('dry-run');

// Школы, которые покрывает существующий коллектор scrape-cats-all.mjs (9 из живых 12).
// Ключ — слаг на живом сайте, значение — слаг в выгрузке коллектора. Они местами
// расходятся: на сайте «the-worthgate-school-canterbury», у коллектора «worthgate-school».
const COVERED_BY_COLLECTOR = {
  'cats-cambridge': 'cats-cambridge',
  'the-worthgate-school-canterbury': 'worthgate-school',
  'bournemouth-collegiate-school': 'bournemouth-collegiate-school',
  'bosworth-independent-school': 'bosworth-independent-school',
  'guildhouse-school-london': 'guildhouse-school-london',
  'cats-academy-boston': 'cats-academy-boston',
  'forest-city-international-school': 'forest-city-international-school',
  'st-michaels-school': 'st-michaels-school',
  'cats-college-china': 'cats-college-china',
};

const html = await fetchHtml(INDEX);

const schools = [...new Set(
  [...html.matchAll(/href="(https?:\/\/catsglobalschools\.com\/our-schools\/([^"#?/]+)\/)"/g)].map((m) => m[2]),
)].map((slug) => {
  // имя школы — из заголовка карточки рядом со ссылкой, иначе из слага
  const near = html.match(new RegExp(`our-schools/${slug}/"[^>]*>([\\s\\S]{0,120}?)<`, 'i'));
  const name = decodeEntities((near?.[1] || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  return {
    slug,
    name: name || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    url: `${INDEX}${slug}/`,
    coveredByCollector: !!COVERED_BY_COLLECTOR[slug],
    collectorSlug: COVERED_BY_COLLECTOR[slug] || null,
  };
});

log(`школ на сайте: ${schools.length}, покрыто коллектором: ${schools.filter((s) => s.coveredByCollector).length}`);

await writeMembership(AGG, {
  _meta: {
    aggregator: AGG,
    label: 'CATS Global Schools',
    source: INDEX,
    collectedAt: new Date().toISOString(),
    rule: 'all',
    counts: { live: schools.length, coveredByCollector: schools.filter((s) => s.coveredByCollector).length },
    notes: [
      'CATS — сеть школ (GCSE / A-level / sixth form / языковые), а не вузов; уровни не покрываются схемой вузовского каталога.',
      'В cats-collected.json поле subjects у GCSE и A-Level содержит таблицу ПОСТУПЛЕНИЙ выпускников (вузы и специальности), а не предметы школы.',
      'В живой каталог эта грязь НЕ протекла: expand-cats-programs.mjs разворачивает предметы по собственному шаблону — проверено на cats-cambridge, bosworth, guildhouse.',
      'Программы CATS в единой форме здесь не собираются — сперва нужно решение владельца, нужны ли школы в каталоге вообще.',
    ],
  },
  schools,
  notCoveredByCollector: schools.filter((s) => !s.coveredByCollector).map((s) => s.name),
}, { dryRun: DRY });

log(`запросов ${stats.requests}, неудач ${stats.failed}`);
if (DRY) log('DRY-RUN: на диск не писали');
