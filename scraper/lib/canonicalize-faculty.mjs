import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TAX_PATH = path.join(__dirname, '..', 'sources', 'faculty-taxonomy.json');

let _tax = null;

export function loadTaxonomy(p = TAX_PATH) {
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    canonical: raw.canonical,
    canonicalSet: new Set(raw.canonical),
    rules: raw.rules.map((r) => ({ canonical: r.canonical, re: new RegExp(r.pattern, 'i') })),
    placeholders: new Set((raw.placeholders || []).map((s) => s.toLowerCase())),
    defer: raw.deferToTitle ? new RegExp(raw.deferToTitle, 'i') : null,
  };
}

function getTax() {
  if (!_tax) _tax = loadTaxonomy();
  return _tax;
}

function classify(str, tax) {
  if (!str) return null;
  for (const r of tax.rules) if (r.re.test(str)) return r.canonical;
  return null;
}

/**
 * Приводит сырое значение faculty к канону.
 * @param {*} rawFaculty  значение поля faculty (может быть null/undefined)
 * @param {string} title  название программы — используется как fallback-инференс
 * @returns {string|null} канон-факультет или null (не выдумываем)
 */
export function canonicalizeFaculty(rawFaculty, title = '', tax = getTax()) {
  const raw = (rawFaculty == null ? '' : String(rawFaculty)).trim();
  if (tax.canonicalSet.has(raw)) return raw; // уже канон — идемпотентно
  const low = raw.toLowerCase();
  if (raw === '' || tax.placeholders.has(low) || (tax.defer && tax.defer.test(low))) {
    return classify(title, tax); // пусто/мусор/широкий колледж → инференс по названию
  }
  return classify(raw, tax) || classify(title, tax);
}
