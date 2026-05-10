import { load } from 'cheerio';
import { createHash } from 'node:crypto';

export interface KaplanScrapeResult {
  sourceUrl: string;
  sourceHash: string;
  description: string | null;
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

  const descCandidate =
    $('.university-description p').first().text().trim() ||
    $('main article p').first().text().trim() ||
    $('main p').first().text().trim();
  const description = descCandidate.length >= 40 ? descCandidate : null;

  const heroImg = $('main img, header img').first().attr('src') ?? null;
  const heroImageUrl = heroImg ? new URL(heroImg, uniUrl).toString() : null;

  const keyFacts: string[] = [];
  $('.key-facts li, .university-facts li, ul.facts li').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 80) keyFacts.push(text);
  });

  // Discover the "Fees and dates" link — that page holds the program/tuition tables.
  const feesHref = $('a[href*="fees-and-dates"]').first().attr('href') ?? null;
  const feesUrl = feesHref ? new URL(feesHref, uniUrl).toString() : null;

  return {
    sourceUrl: uniUrl,
    sourceHash: 'sha256:' + createHash('sha256').update(html).digest('hex').slice(0, 16),
    description,
    heroImageUrl,
    keyFacts,
    feesUrl,
    fetchedAt: new Date().toISOString(),
  };
}
