// Валидирует universities/*.json против Zod-схемы САЙТА.
//
// Раньше здесь лежала копия схемы «держать в синхроне» — и она разъехалась: в site
// появились CHF, поля происхождения стипендий и фото, brokenLink, а копия про них не
// знала и роняла валидные карточки (bhms в CHF). Копию убрал: схема импортируется из
// site/src/schema/university.ts, то есть ровно та, по которой собирается сайт.
//
// Запуск из scraper/:
//   node node_modules/tsx/dist/cli.mjs src/validate-unis.ts
//   node node_modules/tsx/dist/cli.mjs src/validate-unis.ts --dir=../sources/kompas/catalog-work
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { universitySchema } from '../../site/src/schema/university';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirArg = (process.argv.find((a) => a.startsWith('--dir=')) ?? '').slice('--dir='.length);
const dir = dirArg
  ? path.resolve(process.cwd(), dirArg)
  : path.resolve(__dirname, '../../site/src/content/universities');

let ok = 0;
let bad = 0;
const errs: string[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let data: unknown;
  try { data = JSON.parse(readFileSync(path.join(dir, f), 'utf8')); }
  catch { bad++; if (errs.length < 60) errs.push(`${f}: JSON parse error`); continue; }
  const r = universitySchema.safeParse(data);
  if (r.success) ok++;
  else { bad++; if (errs.length < 60) errs.push(`${f}: ${JSON.stringify(r.error.issues.slice(0, 3))}`); }
}
for (const e of errs) console.error(e);
console.log(JSON.stringify({ dir, ok, bad }));
process.exit(bad ? 1 : 0);
