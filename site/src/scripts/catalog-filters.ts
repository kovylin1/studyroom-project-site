interface CatalogFilterState {
  q: string;
  country: string;
  levels: Set<string>;
  faculties: Set<string>;
  maxTuition: number | null;
  maxIelts: number | null;
  hasScholarship: boolean;
}

const FORM_ID = 'catalog-filters';
const GRID_ID = 'catalog-grid';
const EMPTY_ID = 'catalog-empty';
const COUNT_ID = 'catalog-count';
const PANEL_ID = 'catalog-filters-panel';
const TOGGLE_ID = 'catalog-filters-toggle';
const BADGE_ID = 'catalog-filters-count';
const RESULT_ID = 'catalog-filters-result';

function readState(form: HTMLFormElement): CatalogFilterState {
  const fd = new FormData(form);
  const levels = new Set<string>();
  for (const value of fd.getAll('level')) {
    if (typeof value === 'string' && value.length > 0) {
      levels.add(value);
    }
  }

  const faculties = new Set<string>();
  for (const value of fd.getAll('faculty')) {
    if (typeof value === 'string' && value.length > 0) {
      faculties.add(value);
    }
  }

  const maxTuitionRaw = fd.get('maxTuition');
  const maxIeltsRaw = fd.get('maxIelts');

  return {
    q: String(fd.get('q') ?? '').trim().toLowerCase(),
    country: String(fd.get('country') ?? ''),
    levels,
    faculties,
    maxTuition: maxTuitionRaw ? Number(maxTuitionRaw) : null,
    maxIelts: maxIeltsRaw ? Number(maxIeltsRaw) : null,
    hasScholarship: fd.get('hasScholarship') === 'on',
  };
}

function cardMatches(card: HTMLElement, state: CatalogFilterState): boolean {
  if (state.q) {
    const name = card.dataset.name ?? '';
    if (!name.includes(state.q)) {
      return false;
    }
  }

  if (state.country && card.dataset.country !== state.country) {
    return false;
  }

  if (state.levels.size > 0) {
    const cardLevels = (card.dataset.levels ?? '').split(',').filter(Boolean);
    const overlap = cardLevels.some((level) => state.levels.has(level));
    if (!overlap) {
      return false;
    }
  }

  if (state.faculties.size > 0) {
    const cardFaculties = (card.dataset.faculties ?? '').split(',').filter(Boolean);
    const overlap = cardFaculties.some((faculty) => state.faculties.has(faculty));
    if (!overlap) {
      return false;
    }
  }

  if (state.maxTuition !== null) {
    const tuitionMin = Number(card.dataset.tuitionMin ?? '0');
    if (tuitionMin > state.maxTuition) {
      return false;
    }
  }

  if (state.maxIelts !== null) {
    const ieltsRaw = card.dataset.ielts;
    if (ieltsRaw) {
      const ielts = Number(ieltsRaw);
      if (ielts > state.maxIelts) {
        return false;
      }
    }
  }

  if (state.hasScholarship && card.dataset.scholarship !== '1') {
    return false;
  }

  return true;
}

function countActiveFilters(state: CatalogFilterState, form: HTMLFormElement): number {
  let n = 0;
  // The hero search input is "q" — count it only if a filter (it lives in the
  // hero, not the pulldown, but the badge should reflect ALL active filters).
  if (state.q) n += 1;
  if (state.country) n += 1;
  if (state.levels.size > 0) n += 1;
  if (state.faculties.size > 0) n += 1;
  // Treat the tuition slider as "active" only when it's not at the default max.
  const rangeEl = form.elements.namedItem('maxTuition');
  if (rangeEl instanceof HTMLInputElement && state.maxTuition !== null) {
    const max = Number(rangeEl.max);
    if (Number.isFinite(max) && state.maxTuition < max) n += 1;
  }
  if (state.maxIelts !== null) n += 1;
  if (state.hasScholarship) n += 1;
  return n;
}

function updateBadge(activeCount: number, visible: number, total: number): void {
  const badge = document.getElementById(BADGE_ID);
  if (badge) {
    if (activeCount === 0) {
      badge.hidden = true;
      badge.textContent = '';
    } else {
      badge.hidden = false;
      badge.textContent = String(activeCount);
    }
  }
  const result = document.getElementById(RESULT_ID);
  if (result) {
    result.textContent = total === 0 ? '' : `${visible} из ${total}`;
  }
}

function applyFilters(form: HTMLFormElement): void {
  const state = readState(form);
  const grid = document.getElementById(GRID_ID);
  const empty = document.getElementById(EMPTY_ID);
  const count = document.getElementById(COUNT_ID);
  if (!grid) {
    return;
  }

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.uni-card'));
  let visible = 0;
  for (const card of cards) {
    const match = cardMatches(card, state);
    card.style.display = match ? '' : 'none';
    if (match) {
      visible += 1;
    }
  }

  if (empty) {
    empty.hidden = visible !== 0;
  }
  if (count) {
    count.textContent = String(visible);
  }

  syncRangeOutput(form);
  syncUrl(state);
  updateBadge(countActiveFilters(state, form), visible, cards.length);
}

function wireToggle(): void {
  const btn = document.getElementById(TOGGLE_ID);
  const panel = document.getElementById(PANEL_ID);
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    const isOpen = panel.dataset.open === 'true';
    panel.dataset.open = isOpen ? 'false' : 'true';
    btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });
}

function syncRangeOutput(form: HTMLFormElement): void {
  const range = form.elements.namedItem('maxTuition');
  const out = form.elements.namedItem('maxTuitionOut');
  if (range instanceof HTMLInputElement && out instanceof HTMLOutputElement) {
    out.textContent = Number(range.value).toLocaleString('ru-RU');
  }
}

function syncUrl(state: CatalogFilterState): void {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.country) params.set('country', state.country);
  if (state.levels.size > 0) params.set('level', Array.from(state.levels).join(','));
  if (state.faculties.size > 0) params.set('faculty', Array.from(state.faculties).join(','));
  if (state.maxTuition !== null) params.set('maxTuition', String(state.maxTuition));
  if (state.maxIelts !== null) params.set('maxIelts', String(state.maxIelts));
  if (state.hasScholarship) params.set('hasScholarship', '1');

  const next = params.toString();
  const href = next ? `${location.pathname}?${next}` : location.pathname;
  history.replaceState(null, '', href);
}

function restoreFromUrl(form: HTMLFormElement): void {
  const params = new URLSearchParams(location.search);
  const setValue = (name: string, value: string): void => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.value = value;
    }
  };

  const q = params.get('q');
  if (q) setValue('q', q);

  const country = params.get('country');
  if (country) setValue('country', country);

  const facultiesParam = params.get('faculty');
  if (facultiesParam) {
    const wanted = new Set(facultiesParam.split(',').filter(Boolean));
    const inputs = form.querySelectorAll<HTMLInputElement>('input[name="faculty"]');
    for (const input of inputs) {
      input.checked = wanted.has(input.value);
    }
  }

  const levels = params.get('level');
  if (levels) {
    const wanted = new Set(levels.split(',').filter(Boolean));
    const inputs = form.querySelectorAll<HTMLInputElement>('input[name="level"]');
    for (const input of inputs) {
      input.checked = wanted.has(input.value);
    }
  }

  const maxTuition = params.get('maxTuition');
  if (maxTuition) setValue('maxTuition', maxTuition);

  const maxIelts = params.get('maxIelts');
  if (maxIelts) setValue('maxIelts', maxIelts);

  const hasScholarship = params.get('hasScholarship');
  const scholarshipInput = form.elements.namedItem('hasScholarship');
  if (scholarshipInput instanceof HTMLInputElement) {
    scholarshipInput.checked = hasScholarship === '1';
  }
}

function init(): void {
  const form = document.getElementById(FORM_ID);
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  restoreFromUrl(form);
  applyFilters(form);
  wireToggle();

  // If the URL restored an active filter (e.g. ?country=... opened via share),
  // open the pulldown so the user sees what's already filtering the grid.
  const initialState = readState(form);
  if (countActiveFilters(initialState, form) > 0) {
    const panel = document.getElementById(PANEL_ID);
    const btn = document.getElementById(TOGGLE_ID);
    if (panel && btn) {
      panel.dataset.open = 'true';
      btn.setAttribute('aria-expanded', 'true');
    }
  }

  form.addEventListener('input', () => applyFilters(form));
  form.addEventListener('change', () => applyFilters(form));
  form.addEventListener('reset', () => {
    requestAnimationFrame(() => applyFilters(form));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
