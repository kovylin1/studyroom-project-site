// Тесты разбора выгрузок в замере цен Navitas. Проверяется главное: выгрузка
// привязывается к карточке по полю `catalogSlug` внутри файла, а не по имени файла.
// Именно на этом замер 24.08 объявил 1 113 цен QS «ничем не подтверждёнными»:
// QS зовёт файлы своим слагом портала, и поиск по имени файла их не находил.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { buildExtractIndex, normTitle } from './kompas-navitas-fees-diag.mjs';

async function fixture(tree) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'navdiag-'));
  for (const [src, files] of Object.entries(tree)) {
    await fs.mkdir(path.join(dir, src), { recursive: true });
    for (const [name, body] of Object.entries(files)) {
      await fs.writeFile(path.join(dir, src, name), JSON.stringify(body), 'utf8');
    }
  }
  return dir;
}

test('файл, названный слагом источника, ложится на карточку из catalogSlug', async () => {
  const dir = await fixture({
    qs: {
      'robert-gordon-university-foundation.json': {
        slug: 'robert-gordon-university-foundation',
        catalogSlug: 'robert-gordon',
        programs: [{ title: 'Foundation Leading to Nursing', level: 'foundation', tuition: 8300 }],
      },
    },
  });
  const idx = await buildExtractIndex(dir);
  assert.ok(idx.has('robert-gordon'), 'карточка найдена по catalogSlug');
  assert.equal(idx.get('robert-gordon').titles.get(normTitle('Foundation Leading to Nursing')).fee, 8300);
  assert.equal(idx.has('robert-gordon-university-foundation'), false, 'слаг источника карточкой не считается');
});

test('несколько файлов одного вуза складываются, а не затирают друг друга', async () => {
  const dir = await fixture({
    qs: {
      'a-foundation.json': { catalogSlug: 'keele', programs: [{ title: 'Foundation Business', level: 'foundation', tuition: 14500 }] },
      'a-degrees.json': { catalogSlug: 'keele', programs: [{ title: 'BSc Computer Science', level: 'bachelor', tuition: 17400 }] },
    },
    edvoy: {
      'keele.json': { catalogSlug: 'keele', programs: [{ title: 'MSc Data Science', level: 'master', tuition: 18500 }] },
    },
  });
  const idx = await buildExtractIndex(dir);
  const titles = idx.get('keele').titles;
  assert.equal(titles.size, 3);
  assert.equal(titles.get(normTitle('BSc Computer Science')).src, 'qs');
  assert.equal(titles.get(normTitle('MSc Data Science')).src, 'edvoy');
});

test('цена уровня доступна отдельно от названия', async () => {
  const dir = await fixture({
    qs: { 'x.json': { catalogSlug: 'brunel', programs: [{ title: 'BA History', level: 'bachelor', tuition: 17400 }] } },
  });
  const levels = (await buildExtractIndex(dir)).get('brunel').levels;
  assert.equal(levels.get('bachelor').has(17400), true);
  assert.equal(levels.get('bachelor').has(99999), false);
  assert.equal(levels.has('master'), false, 'уровень без цены не выдумывается');
});

test('строка без цены не попадает в уровни, но остаётся в названиях', async () => {
  const dir = await fixture({
    qs: { 'x.json': { catalogSlug: 'swansea', programs: [{ title: 'MPhil Physics', level: 'master' }] } },
  });
  const b = (await buildExtractIndex(dir)).get('swansea');
  assert.equal(b.titles.get(normTitle('MPhil Physics')).fee, 0);
  assert.equal(b.levels.size, 0);
});

test('выгрузки-исключения пропускаются целиком', async () => {
  const dir = await fixture({
    qs: {
      'no.json': { catalogSlug: 'ghost', noPrograms: true, programs: [{ title: 'X', level: 'bachelor', tuition: 1 }] },
      'nai.json': { catalogSlug: 'ghost2', notAnInstitution: true, programs: [{ title: 'Y', level: 'bachelor', tuition: 1 }] },
      'exc.json': { catalogSlug: 'ghost3', excludedFromDiff: true, programs: [{ title: 'Z', level: 'bachelor', tuition: 1 }] },
    },
  });
  const idx = await buildExtractIndex(dir);
  assert.equal(idx.size, 0);
});

test('запись с ценой вытесняет запись без цены под тем же названием', async () => {
  const dir = await fixture({
    aaa: { 'p.json': { catalogSlug: 'plymouth', programs: [{ title: 'BSc Nursing', level: 'bachelor' }] } },
    bbb: { 'p.json': { catalogSlug: 'plymouth', programs: [{ title: 'BSc Nursing', level: 'bachelor', tuition: 16000 }] } },
  });
  const hit = (await buildExtractIndex(dir)).get('plymouth').titles.get(normTitle('BSc Nursing'));
  assert.equal(hit.fee, 16000);
  assert.equal(hit.src, 'bbb');
});
