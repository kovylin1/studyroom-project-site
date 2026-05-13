// Generic faculty classifier — assigns each program to one of 8 faculty buckets
// based on the title. Used for unis where Kaplan's global award-faculty map
// doesn't cover the institution (UK/Canada are covered; USA partially; AU/NZ
// not at all). Without this, every program lands in "Прочее" and the
// per-faculty modal on the landing page collapses to a single bucket.
//
// Order matters — first match wins. Specific degree codes (BEd/MBA/BFA/BEng)
// are checked before broad subject keywords (Engineering / Business / Arts /
// Science) so a "BFA Music and Computer Science" goes to Fine Arts, not
// Engineering.
//
// Faculty names are deliberately neutral (e.g. "Business" not "Gustavson School
// of Business" or "W.P. Carey School") so the same classifier works across all
// 6 unis it currently serves: Victoria + Arizona State + Pace + Simmons +
// UConn + Oregon. Per-uni thematic photos for each bucket live in
// `FACULTY_IMAGE_OVERRIDES` in `[slug].astro`.
//
// Patterns use loose matching (no end-anchor `\b)\b/`) so substring forms like
// "Nutritional Sciences" / "Economics" / "Religious Studies" match their base
// keyword. Risk of over-matching is mitigated by rule order (most-specific
// degree codes first) and inner `\b` anchors on ambiguous short keywords like
// `\bMusic\b`, `\bArt\b`, `\bGerman\b` that could otherwise creep into longer
// unrelated words.

const RULES: Array<{ faculty: string; pattern: RegExp }> = [
  // Law — must come BEFORE Business so "Master of Laws" / "Bachelor of Laws"
  // don't drift into Business via the generic "Management" / "Leadership"
  // catches. Covers LLB/LLM/JD degree codes + named Law programs.
  {
    faculty: 'Law',
    pattern: /\b(LLB|LLM|JD\b|Juris Doctor|Bachelor of Laws|Master of Laws|Doctor of Laws|\bLegal Practice\b|\bLegal Studies\b|\bJurisprudence\b|\bLaws\b|Law and Justice|Criminal Law|\bLaw\b\s*(\(|\/|with|and))/i,
  },

  // Education — degree codes (BEd / EdM / EdD / MAT / EdS) + teacher-prep +
  // bare "Education" / "Master of Teaching" patterns common in AU/NZ unis.
  {
    faculty: 'Education',
    pattern: /\b(BEd|EdM|EdD|EdS|M\.?Ed\.?|MAT|Master of Teaching|Teacher Education|Elementary Education|Secondary Education|Elementary Curriculum|Special Education|School of Education|Educational (Studies|Foundations|Leadership|Policy|Psychology)|Education BA|Education BS|Education \(|Pre-Teaching|Pedagogy|Early Childhood|\bEducation\b)/i,
  },

  // Engineering & Computer Science — moved ahead of Business so titles like
  // "Engineering Management" or "Management and Engineering for
  // Manufacturing" don't drift into Business via "Management".
  {
    faculty: 'Engineering and Computer Science',
    pattern: /\b(BEng|MEng|BSEng|BSE\s|BArch|MArch|Software Engineering|Software Development|Computer Science|Computer Engineering|Computing|Data Science|Data Analytics|Data Analysis|Telecommunications|Aerospace|Building Envelopes|Information Technology|Information Systems|Information Science|Informatics|Cybersecurity|Cyber Security|\bArchitecture\b|Architectural|\bMechanical\b|\bElectrical\b|Civil Engineering|Industrial Engineering|Chemical Engineering|Biomedical Engineering|Robotics|Automotive|Game Development|Game Design|Web Design|Web Development|Cognitive Science|Engineering Management|Manufacturing Engineering|Manufacturing|Materials Engineering|Nuclear Engineering|Petroleum|Construction Management|Construction Engineering|\bConstruction\b|Renewable.*Energy|Sustainable.*Energy|GIS|Geomatics|Urban Planning|Urban Design|Urban and Environmental Planning|\bEngineering\b)/i,
  },

  // Business — MBA/BBA/BSBA/BCom + business-named programs + bare
  // "Business" / "Management" / "Leadership" terms.
  {
    faculty: 'Business',
    pattern: /\b(MBA|MGB|BCom|BBA|BSBA|MMA|MSF|Commerce|Business Administration|Business Analytics|Business Management|General Business|Software Projects|Sustainable Finance|Global Business|Accountancy|Accounting|Actuarial|\bFinance\b|Marketing|Entrepreneurship|Supply Chain|Real Estate|Hospitality|Tourism|\bBusiness\b|Risk Management|\bMM\s|\bManagement\b|Leadership|Innovation in Society|Innovation\b)/i,
  },

  // Fine Arts — BFA / MFA + arts subjects. Inner `\b` on common short roots
  // (\bArt\b, \bMusic\b, \bDance\b, \bFilm\b) to avoid mismatches in
  // "Started", "Artery", etc. Bare "\bDesign\b" catches Massey's "Master of
  // Design" / "Bachelor of Design" / "Communication Design" without needing
  // the trailing parenthesis variant.
  {
    faculty: 'Fine Arts',
    pattern: /\b(BFA|MFA|BMus|\bMusic\b|Theatre|Theater|Visual Arts|Studio Art|Fine Arts?|Creative Arts|Art History|Art \(|\bArts\b|\bArt\b|\bDance\b|\bFilm\b|Filmmaking|Cinema|Photography|Creative Writing|\bWriting\b|Digital Media|Digital Cinema|Environmental Design|Folklore|\bDesign\b|Screen Arts|Game Arts|Performance|Performing Arts)/i,
  },

  // Health Sciences — social work, public health, allied health, nursing,
  // kinesiology, nutrition, wellness, therapy, counseling, communication
  // disorders, family/human development. Counselling = UK/AU spelling;
  // Podiatry, Biosecurity, Sport (and Exercise), bare "\bHealth\b" added for
  // AU/NZ catalogs.
  {
    faculty: 'Health Sciences',
    pattern: /\b(BSW|MSW|BSN|MSN|Social Work|Public Health|Global Health|Kinesiology|Health Information|Child and Youth Care|Recreation|BCYC|Allied Health|Nursing|Health Sciences?|Health Science|Health and Exercise|Pre-Health|Health Promotion|Health Service|Pharmacy|Pharmaceutical|\bDental\b|Physical Therapy|Occupational Therapy|Nutrition|Dietetics|Mental Health|Exercise Science|Communication Disorders|Family and Human|Human Development|Child Behavioral|Wellness|Speech|Audiology|Public Service|Health Care|Physiology|Pre-Med|Behavior Analysis|Hearing Sciences|Counsel(?:l)?ing|Therapy|Marriage and Family|Podiatry|Biosecurity|Biomedicine|Sport and Exercise|Sport.*Science|\bHealth\b|Midwifery|Paramedicine|Oral Health)/i,
  },

  // Humanities — languages, classics, literature, philosophy, religion,
  // history, area studies, liberal arts/studies, ethnic studies.
  {
    faculty: 'Humanities',
    pattern: /\b(English|French|Francophone|Germanic|\bGerman\b|\bSpanish\b|\bPortuguese\b|\bItalian\b|\bChinese\b|\bJapanese\b|\bKorean\b|\bRussian\b|\bArabic\b|\bHebrew\b|\bYiddish\b|Sanskrit|Greek|Hispanic|Indigenous Studies|Latin(?!\s+American)|Medieval|Pacific and Asian|Philosophy|Religion|Religious|Slavic|Linguistics|History|Africana|African American|American Indian|American Studies|Asian Studies|Asian American|Global Asia|\bAsia\b|Classics|Comparative Literature|\bLiterature\b|Cultural Studies|Liberal Arts|Liberal Studies|Sign Language|Islamic|Jewish Studies|Judaic|Ancient (History|Languages?)|Egyptology|Archaeology|Ethnic Studies|Romance Languages?|\bHumanities\b|Civic.*Thought|Letters and Cultures|International Letters|Integrated Studies|\bCulture\b|Interdisciplinary Studies|Museum Studies)/i,
  },

  // Social Sciences — econ, psych, sociology, political science, geography,
  // anthropology, gender/women studies, communications, journalism, public
  // policy, criminal/justice studies, human rights, international studies,
  // urban/community studies. Aboriginal Studies / Development Studies /
  // International Development added for AU/NZ catalogs.
  {
    faculty: 'Social Sciences',
    pattern: /\b(Anthropology|Environmental Studies|Economic|Economics|Gender|\bSexuality\b|Women'?s|Geography|Political Science|\bPolitics\b|Psychology|Psychological|Sociology|Latin American|Criminal Justice|Criminology|International Relations|International Studies|International Development|Public Policy|Public Administration|Public Relations|Communications?|Journalism|Media Studies|Advertising|Urban Studies|Urban and Community|Demography|Global Studies|Peace Studies|Social Sciences?|Social Science|Human Rights|African Studies|Africana Studies|Justice Studies|Aboriginal Studies|Indigenous|Development Studies|Global Security)/i,
  },

  // Science — STEM catch-all. Loose anchors so Biolog* covers all derived
  // forms (Biology / Biological / Biomedical / Biophysics / Bioinformatics /
  // Pathobiology). Nutritional belongs to Health Sciences (rule above),
  // not Science. Bare "\bScience\b" added so generic "Bachelor of Science"
  // / "Master of Science (Biotechnology)" land here as last STEM resort.
  // Biotechnology + Food Technology + Forensic Science added for AU/NZ.
  {
    faculty: 'Science',
    pattern: /\b(Astronomy|Biochemistry|Biolog|Pathobiology|Biomedical|Biophysics|Bioinformatics|Biotechnology|Botany|Chemistry|Climate|Earth Sciences?|Earth and Space|Geolog|Geophysics|Geosciences|Mathematic|Microbiology|Physics|Statistics|Ocean|Marine|Medical Sciences|Environmental Science|Forensic Science|Forensic|Neuroscience|Animal Science|Agriculture|Agricultural|Forestry|\bPlant\b|Zoology|Genetics|Molecular|Sustainability|Sustainable Development|Veterinary|Food Science|Food Technology|Natural Resources|Multidisciplinary Science|Earth and Environmental|Soil|Sustainable Plant|Complexity Science|Complex Systems|\bScience\b|\bSciences\b)/i,
  },
];

const FALLBACK = 'Прочее';

export function classifyFaculty(title: string): string {
  for (const rule of RULES) {
    if (rule.pattern.test(title)) return rule.faculty;
  }
  return FALLBACK;
}
