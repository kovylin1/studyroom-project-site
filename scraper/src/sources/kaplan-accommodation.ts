// Kaplan accommodation page scraper.
//
// Kaplan organizes accommodation per *college*, not per *university*. The
// college slug must be discovered from the main partner page (e.g.
// `university-of-glasgow` → `glasgow-international-college`), so this module
// takes the main partner URL and resolves the accommodation URL by parsing
// `<a href="*/accommodation/*">` links on that page.
//
// Returns a single Kaplan Living residence per uni (Kaplan publishes one
// starting price + one feature list per partner). Some partners do not host a
// Kaplan accommodation page (HTTP 404 or no matching link); in that case the
// fields come back null/empty and cli.ts falls back to a generic TBD card.

import { load } from 'cheerio';

export interface KaplanAccommodationResult {
  accommodationUrl: string | null;
  residence: string | null;
  priceLabel: string | null;
  priceFrom: number | null;
  priceCurrency: 'GBP' | null;
  contractNote: string | null;
  features: string[];
  photoUrl: string | null;
}

const FETCH_OPTS = {
  headers: {
    'User-Agent': 'StudyRoom-Scraper/0.1 (+https://studyroom.kz)',
    Accept: 'text/html,application/xhtml+xml',
  },
};

const EMPTY_RESULT: KaplanAccommodationResult = {
  accommodationUrl: null,
  residence: null,
  priceLabel: null,
  priceFrom: null,
  priceCurrency: null,
  contractNote: null,
  features: [],
  photoUrl: null,
};

function resolveAccommodationHref($: ReturnType<typeof load>, baseUrl: string): string | null {
  const candidates = new Set<string>();
  $('a[href*="/accommodation/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (!href.includes('where-to-study/')) return;
    candidates.add(href);
  });
  for (const href of candidates) {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      // skip malformed
    }
  }
  return null;
}

function parsePrice(label: string): { value: number | null; currency: 'GBP' | null } {
  // Matches "From £8,330", "£12,500", "£ 8330", etc. Captures the first GBP figure.
  const m = label.match(/£\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return { value: null, currency: null };
  const num = Number.parseFloat(m[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return { value: null, currency: null };
  return { value: num, currency: 'GBP' };
}

function extractFeatures($: ReturnType<typeof load>): string[] {
  const heading = $('h2, h3').filter((_, el) => /what\W*s\s*included/i.test($(el).text())).first();
  if (heading.length === 0) return [];
  const features: string[] = [];
  const stopTags = new Set(['h2', 'h3']);
  let current = heading.next();
  while (current.length > 0 && features.length < 12) {
    if (stopTags.has((current[0] as { tagName?: string }).tagName ?? '')) break;
    current.find('li').each((_, li) => {
      const text = $(li).text().replace(/\s+/g, ' ').trim();
      if (text && text.length >= 6 && text.length < 160) features.push(text);
    });
    current = current.next();
  }
  return Array.from(new Set(features));
}

function extractResidenceName($: ReturnType<typeof load>): string | null {
  const candidates: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (/^(Explore )?Kaplan Living\b/i.test(t)) candidates.push(t.replace(/^Explore /i, '').trim());
    else if (/\bInternational College accommodation\b/i.test(t)) candidates.push(t);
  });
  if (candidates.length > 0) return candidates[0];
  const h1 = $('h1').first().text().trim();
  return h1 || null;
}

function extractHeroPhoto($: ReturnType<typeof load>, baseUrl: string): string | null {
  const themed = $('img[alt]').filter((_, el) => {
    const alt = ($(el).attr('alt') || '').toLowerCase();
    return /residen|studio|room|bed|kitchen/.test(alt);
  });
  const target = themed.length > 0 ? themed.first() : $('main img, article img, .accommodation img').first();
  const src = target.attr('src') ?? target.attr('data-src') ?? null;
  if (!src) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function scrapeKaplanAccommodation(mainPartnerUrl: string): Promise<KaplanAccommodationResult> {
  // Step 1: load the main partner page, find the accommodation link.
  const mainRes = await fetch(mainPartnerUrl, FETCH_OPTS);
  if (!mainRes.ok) return EMPTY_RESULT;
  const mainHtml = await mainRes.text();
  const $main = load(mainHtml);
  const accommodationUrl = resolveAccommodationHref($main, mainPartnerUrl);
  if (!accommodationUrl) return EMPTY_RESULT;

  // Step 2: fetch the accommodation page. 404 is expected for some partners.
  const accRes = await fetch(accommodationUrl, FETCH_OPTS);
  if (!accRes.ok) return { ...EMPTY_RESULT, accommodationUrl };
  const accHtml = await accRes.text();
  const $ = load(accHtml);

  // Step 3: extract price.
  let priceLabel: string | null = null;
  let contractNote: string | null = null;
  $('p, strong, span, td, li').each((_, el) => {
    if (priceLabel) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 220) return;
    if (!/£\s*\d{1,3}(?:[,]\d{3})/.test(text)) return;
    priceLabel = text;
  });
  if (priceLabel) {
    const m = priceLabel.match(/based on[^.]*/i);
    contractNote = m ? m[0].replace(/[.\s]+$/, '') : null;
  }
  const { value: priceFrom, currency: priceCurrency } = priceLabel
    ? parsePrice(priceLabel)
    : { value: null, currency: null };

  const residence = extractResidenceName($);
  const features = extractFeatures($);
  const photoUrl = extractHeroPhoto($, accommodationUrl);

  return {
    accommodationUrl,
    residence,
    priceLabel,
    priceFrom,
    priceCurrency,
    contractNote,
    features,
    photoUrl,
  };
}
