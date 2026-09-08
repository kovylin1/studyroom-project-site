import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { declaredNames, collectFields } from './schema-fields-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(ROOT, 'site/src/schema/university.ts');
const LIVE = path.join(ROOT, 'site/src/content/universities');
const WORK = path.join(ROOT, 'sources/kompas/catalog-work');

test('имена полей вытаскиваются из схемы, код мимо не проходит', () => {
  const names = declaredNames(`
    export const s = z.object({
      slug,
      title: z.string().min(1),
      city: z.object({ value: z.string(), source: z.string() }).optional(),
    });
    ctx.addIssue({ message: \`нет такой программы\`, path: ['tuition'] });
  `);
  for (const n of ['slug', 'title', 'city', 'value', 'source']) assert.ok(names.has(n), n);
  for (const n of ['message', 'path']) assert.ok(!names.has(n), `${n} — это код, а не поле схемы`);
});

test('поле карточки находится на любой глубине, слаги словарей не считаются полями', () => {
  const found = collectFields({
    slug: 'x',
    partnerSource: { type: 'aggregator', via: ['qs'] },
    programs: [{ slug: 'mba', verified: true }],
    tuition: { currency: 'USD', byProgram: { mba: 100 } },
    deadlines: { mba: '2026-01-01' },
  });
  for (const n of ['partnerSource', 'type', 'via', 'verified', 'currency']) assert.ok(found.has(n), n);
  assert.ok(!found.has('mba'), 'ключ tuition.byProgram — слаг программы, а не поле');
});

for (const [name, dir] of [['живой каталог', LIVE], ['рабочая копия', WORK]]) {
  test(`${name}: полей, не объявленных в схеме сайта, нет`, async () => {
    const declared = declaredNames(await fs.readFile(SCHEMA, 'utf8'));
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
    const missing = new Map();
    for (const f of files) {
      const card = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      for (const [key, where] of collectFields(card)) {
        if (!declared.has(key)) missing.set(key, `${where} (${f})`);
      }
    }
    assert.deepEqual([...missing], [], 'zod вырежет эти поля при чтении — до страниц они не доедут');
  });
}
