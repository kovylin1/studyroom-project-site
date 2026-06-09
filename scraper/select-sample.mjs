// select-sample.mjs — stratified sample of ~70 unis for official-site accuracy audit.
// Strata = source-domain bucket; pick proportionally, deterministic (sort + stride).
// Output: control/audit-sample.json — [{slug,name,country,city,sourceUrl,website,
//   counts:{programs,scholarships,campuses}, sampleProgramUrl}]
import fs from 'node:fs';

const DIR = 'site/src/content/universities/';
const TARGET = Number(process.env.SAMPLE || 70);
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));

function bucket(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    if (/edvoy/.test(h)) return 'edvoy';
    if (/collabinternational/.test(h)) return 'collab';
    if (/kaplanpathways/.test(h)) return 'kaplan';
    if (/studygroup/.test(h)) return 'studygroup';
    if (/wikipedia/.test(h)) return 'wikipedia';
    if (/oxfordinternational|intostudy|catsglobalschools|kingseducation|qahighereducation/.test(h)) return 'pathway-other';
    return 'official';
  } catch { return 'official'; }
}

const unis = [];
for (const f of files) {
  let j; try { j = JSON.parse(fs.readFileSync(DIR + f, 'utf8')); } catch { continue; }
  const website = j.website || j.officialUrl ||
    (j.programs || []).map(p => p.programUrl).find(u => u && bucket(u) === 'official') || '';
  unis.push({
    slug: j.slug || f.replace('.json', ''),
    name: j.name, country: j.country, city: j.city,
    sourceUrl: j.sourceUrl, confidence: j.confidence,
    bucket: bucket(j.sourceUrl || ''),
    website,
    counts: {
      programs: (j.programs || []).length,
      scholarships: (j.scholarships || []).length,
      campuses: (j.campuses || []).length,
      accommodation: j.accommodation ? (Array.isArray(j.accommodation) ? j.accommodation.length : Object.keys(j.accommodation).length) : 0,
    },
    sampleProgram: (j.programs || [])[0] ? { title: j.programs[0].title, url: j.programs[0].programUrl } : null,
    tuitionKeys: j.tuition ? Object.keys(j.tuition) : [],
  });
}

// group
const groups = {};
for (const u of unis) (groups[u.bucket] ||= []).push(u);
const total = unis.length;
const sample = [];
for (const [b, list] of Object.entries(groups)) {
  list.sort((a, z) => a.slug.localeCompare(z.slug));
  const want = Math.max(2, Math.round(TARGET * list.length / total)); // min 2 per stratum
  const stride = Math.max(1, Math.floor(list.length / want));
  for (let i = 0; i < list.length && sample.filter(s => s.bucket === b).length < want; i += stride) {
    sample.push(list[i]);
  }
}

fs.mkdirSync('control', { recursive: true });
fs.writeFileSync('control/audit-sample.json', JSON.stringify(sample, null, 2));
const dist = {};
for (const s of sample) dist[s.bucket] = (dist[s.bucket] || 0) + 1;
console.log(`population by bucket:`, JSON.stringify(Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]))));
console.log(`sampled ${sample.length} unis:`, JSON.stringify(dist));
console.log(`with known website: ${sample.filter(s => s.website).length}/${sample.length}`);
console.log('wrote control/audit-sample.json');
