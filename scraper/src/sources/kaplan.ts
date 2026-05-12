import { load } from 'cheerio';
import { createHash } from 'node:crypto';

export interface KaplanScrapeResult {
  sourceUrl: string;
  sourceHash: string;
  description: string | null;
  descriptionParagraphs: string[];
  heroImageUrl: string | null;
  keyFacts: string[];
  feesUrl: string | null;
  fetchedAt: string;
}

export async function scrapeKaplanUni(uniUrl: string): Promise<KaplanScrapeResult> {
  const response = await fetch(uniUrl, {
    headers: {
      'User-Agent': 'StudyRoom-Scraper/0.1 (+https://studyroom.kz)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error('Fetch ' + uniUrl + ' returned HTTP ' + response.status);
  }

  const html = await response.text();
  const $ = load(html);

  // Collect multiple paragraphs for the "About this university" section.
  // Kaplan partner pages use a few different markup variants across unis, so
  // walk a prioritized selector list and harvest candidate `<p>` blocks.
  // Skip boilerplate (cookie banners, footer copy, link-only blurbs).
  // Short "ranking" lines like "5th in the UK (Times Good University Guide 2025)"
  // come through as <p> too — we route those to keyFacts instead so the
  // paragraphs array stays narrative prose.
  const SKIP_PHRASES = [
    'cookies',
    'cookie policy',
    'privacy policy',
    'we use cookies',
    'request a brochure',
    'speak to an adviser',
    'sign up',
    'newsletter',
  ];
  const PARA_SELECTORS = [
    '.university-description p',
    '[class*="about"] p',
    'main article p',
    'main section p',
    'main p',
  ];
  const FACT_PATTERNS: RegExp[] = [
    /^(joint\s+)?\d+(st|nd|rd|th)\s+in\s+the\s+(uk|world)/i,      // "5th in the UK", "Joint 31st in the UK"
    /^(top|ranked)\s+\d+/i,                                       // "Top 100", "Ranked 76"
    /^over\s+[\d,]+\s+(students|alumni|graduates|staff)/i,        // "Over 30,000 students"
    /^#?\d+\s+in\s+(the\s+)?(usa|uk|world|canada|australia)/i,    // "#1 in the USA", "1 in Canada"
    /^\d+\s+(years\s+of|nobel)/i,                                 // "550 years of history"
  ];
  // Facts are short, atomic statements (ranking + source in parens). A
  // narrative paragraph that *starts* with a founding year is still prose,
  // not a fact — distinguish by length. Real facts top out around 90 chars
  // ("Joint 22nd in the UK (Times Higher Education World University Rankings by Subject 2026)" = 88).
  const isFact = (text: string): boolean =>
    text.length < 100 && FACT_PATTERNS.some((re) => re.test(text));

  const seenTexts = new Set<string>();
  const descriptionParagraphs: string[] = [];
  const extraFacts: string[] = [];
  for (const sel of PARA_SELECTORS) {
    if (descriptionParagraphs.length >= 4) break;
    $(sel).each((_, el) => {
      if (descriptionParagraphs.length >= 4) return false;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 40) return;
      const lower = text.toLowerCase();
      if (SKIP_PHRASES.some((p) => lower.includes(p))) return;
      if (seenTexts.has(text)) return;
      seenTexts.add(text);
      if (isFact(text)) {
        extraFacts.push(text);
        return;
      }
      if (text.length < 60) return; // narrative prose threshold
      descriptionParagraphs.push(text);
      return;
    });
  }
  const description = descriptionParagraphs[0] ?? null;

  const heroImg = $('main img, header img').first().attr('src') ?? null;
  const heroImageUrl = heroImg ? new URL(heroImg, uniUrl).toString() : null;

  const keyFacts: string[] = [];
  $('.key-facts li, .university-facts li, ul.facts li').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80) keyFacts.push(text);
  });
  // Fold in fact-like <p> blocks (rankings, founding year, etc.) that the
  // paragraph harvester routed away from narrative prose.
  for (const fact of extraFacts) {
    if (!keyFacts.includes(fact)) keyFacts.push(fact);
  }

  // Discover the "Fees and dates" link — that page holds the program/tuition tables.
  const feesHref = $('a[href*="fees-and-dates"]').first().attr('href') ?? null;
  const feesUrl = feesHref ? new URL(feesHref, uniUrl).toString() : null;

  return {
    sourceUrl: uniUrl,
    sourceHash: 'sha256:' + createHash('sha256').update(html).digest('hex').slice(0, 16),
    description,
    descriptionParagraphs,
    heroImageUrl,
    keyFacts,
    feesUrl,
    fetchedAt: new Date().toISOString(),
  };
}
