// Deterministic faculty grouping for programs that lack a `faculty` field.
// Targets the Edvoy stratum (unis where >50% of programs have no faculty),
// so curated official/Kaplan files are left untouched. Purely additive.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const U = 'site/src/content/universities';

// Ordered rules — first match wins. Specific before general.
const RULES = [
  ['Computing & IT', /\b(comput|software|data scien|data analyt|artificial intelligence|machine learning|cyber|information technolog|informatics|information system|web develop|games? develop|cloud comput)\b/i],
  ['Engineering', /\b(engineer|mechanical|electrical|electronic|civil|aerospace|aeronautic|robotic|mechatron|manufactur|automotive|petroleum|telecommunication)\b/i],
  ['Health & Medicine', /\b(medic|nursing|midwif|health|pharmac|dentist|physiother|biomed|clinical|veterinar|nutrition|psychiatr|public health|paramedic|optometr)\b/i],
  ['Law', /\b(law|llb|llm|legal|jurisprud|criminal justice)\b/i],
  ['Business & Management', /\b(business|management|mba|marketing|finance|financial|accounting|account|economic|commerce|entrepreneur|hospitality|tourism|human resource|supply chain|logistics|banking|project management|real estate|fintech)\b/i],
  ['Social Sciences', /\b(psycholog|sociolog|politic|international relation|social work|criminolog|anthropolog|public policy|development studies|geograph|social scien|gender)\b/i],
  ['Arts & Design', /\b(art|design|music|film|media|fashion|photograph|drama|theatre|theater|animation|architect|creative|journalism|graphic|interior|fine art|illustration|performing|dance|game art)\b/i],
  ['Education', /\b(educat|teach|pedagog|tesol|tefl|early childhood|curriculum)\b/i],
  ['Natural Sciences', /\b(biolog|chemistr|physic|mathematic|maths|geolog|environment|astronom|statistic|ecolog|biochem|microbiolog|genetic|agricultur|marine|zoolog|botan|forensic scien|food scien|sport scien)\b/i],
  ['Humanities & Languages', /\b(history|english|languag|literatur|philosoph|linguist|translat|cultur|religi|theolog|humanit|classics|archaeolog|french|spanish|german|chinese|japanese)\b/i],
];

// Level-based fallback so non-degree courses don't all pile into "Other".
const LEVEL_FAC = {
  foundation: 'Foundation Programmes',
  'english-language': 'English Language',
  'short-course': 'Short Courses',
  'high-school': 'School',
  'sixth-form': 'School',
  pathway: 'Pathway Programmes',
};

function classify(title, level, programType) {
  for (const [fac, re] of RULES) if (re.test(title)) return fac;
  if (programType === 'pathway') return 'Pathway Programmes';
  if (level && LEVEL_FAC[level]) return LEVEL_FAC[level];
  return 'Other';
}

const files = readdirSync(U).filter((f) => f.endsWith('.json'));
let touchedUnis = 0, touchedProgs = 0;
const dist = {};
for (const f of files) {
  const p = join(U, f);
  let d;
  try { d = JSON.parse(readFileSync(p, 'utf8')); } catch { continue; }
  const progs = d.programs || [];
  if (!progs.length) continue;
  const missing = progs.filter((x) => !x.faculty || !String(x.faculty).trim());
  if (missing.length / progs.length <= 0.5) continue; // not an Edvoy-style file
  for (const pr of missing) {
    pr.faculty = classify(pr.title || '', pr.level, pr.programType);
    dist[pr.faculty] = (dist[pr.faculty] || 0) + 1;
    touchedProgs++;
  }
  writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
  touchedUnis++;
}
console.log(`Edvoy faculty map: ${touchedUnis} unis, ${touchedProgs} programs labelled`);
console.log('Distribution:', Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', '));
