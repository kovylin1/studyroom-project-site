// Degree-level inference from a program title.
//
// Recognises UK, US and AU/NZ degree abbreviations plus full-word forms.
// The original Kaplan mapper only knew UK codes (BSc/MSc/BEng) and silently
// defaulted everything else to "master" — so US bachelor's (BS / BA / BSE) and
// US master's (MS / MFA / MSW) landed on the wrong level. This util is the
// single source of truth used both by the live scraper (kaplan-feed) and the
// one-off backfill so old data and future scrapes stay in sync.
//
// Returns `null` when the title gives no confident signal — the caller then
// falls back to numeric level metadata or its own default. Order matters:
// PhD → foundation/pathway → master → bachelor (most-specific first, and
// "Pre-Master's" must read as foundation, not master).
//
// AMBIGUOUS CODES WE DELIBERATELY DO NOT MATCH: bare "MA" (Master of Arts in
// England/US, but an UNDERGRADUATE degree at Scottish ancient universities —
// Aberdeen/St Andrews/Glasgow/Edinburgh), and integrated "MEng"/"MArch"/"MSci"
// (entered as undergraduate, awarded at master's level). Title alone can't
// resolve these — we return null so the caller uses numeric source metadata.

export type InferredLevel = 'foundation' | 'bachelor' | 'master' | 'phd';

const PHD = /\bph\.?\s?d\b|\bd\.?phil\b|doctoral|doctor of philosophy|\bed\.?d\b|\bd\.?b\.?a\b|\bd\.?n\.?p\b/;

const FOUNDATION =
  /foundation|international year one|pre-?master|pre-?bachelor|pre-?university|\bpathway\b/;

// Unambiguous TAUGHT postgraduate codes only (no MA / MEng / MArch — see note).
// UK: MSc MBA LLM MRes MPhil MMus MSt
// US: MS MFA MSW MSN MPH MPA MPP MEd
const MASTER =
  /\bm\.?\s?sc\b|\bm\.?\s?s\b|\bm\.?b\.?a\b|\bm\.?g\.?b\b|\bl\.?l\.?m\b|\bm\.?\s?res\b|\bm\.?\s?phil\b|\bm\.?\s?fa\b|\bm\.?\s?sw\b|\bm\.?\s?sn\b|\bm\.?\s?ph\b|\bm\.?\s?pa\b|\bm\.?\s?pp\b|\bm\.?\s?ed\b|\bm\.?mus\b|\bm\.?st\b|master of|master'?s|master in|postgraduate|\bpg\s?dip\b|\bpg\s?cert\b/;

// UK: BSc BA BEng LLB BMus BArch BEd
// US: BS BSE BBA BSBA BFA BSN BSW BCom
const BACHELOR =
  /\bb\.?\s?sc\b|\bb\.?\s?a\b|\bb\.?\s?s\b|\bb\.?\s?eng\b|\bb\.?b\.?a\b|\bb\.?s\.?b\.?a\b|\bb\.?\s?fa\b|\bb\.?\s?sn\b|\bb\.?\s?sw\b|\bb\.?com\b|\bl\.?l\.?b\b|\bb\.?mus\b|\bb\.?\s?arch\b|\bb\.?\s?ed\b|\bb\.?\s?se\b|bachelor|undergraduate/;

export function inferLevelFromTitle(rawTitle: string): InferredLevel | null {
  // Normalise curly apostrophes and HTML entities so "master's", "master’s"
  // and "master&#8217;s" all match the same way.
  const normalised = String(rawTitle ?? '')
    .toLowerCase()
    .replace(/[‘’ʼ]|&#8217;|&#039;|&#39;|&rsquo;|&apos;/g, "'");
  const t = ` ${normalised} `;
  if (PHD.test(t)) return 'phd';
  if (FOUNDATION.test(t)) return 'foundation';
  if (MASTER.test(t)) return 'master';
  if (BACHELOR.test(t)) return 'bachelor';
  return null;
}
