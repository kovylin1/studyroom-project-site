interface FilterState {
  q: string;
  country: string;
  levels: Set<string>;
  faculties: Set<string>;
  fields: Set<string>;
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
const COMPARE_BAR_ID = 'compare-bar';
const COMPARE_COUNT_ID = 'compare-count';
const COMPARE_NAMES_ID = 'compare-names';
const COMPARE_CTA_ID = 'compare-cta';
const COMPARE_CLEAR_ID = 'compare-clear';
const COMPARE_STORAGE_KEY = 'studyroom.compare';
const COMPARE_MAX = 3;

function readState(form: HTMLFormElement): FilterState {
  const fd = new FormData(form);
  const levels = new Set<string>();
  for (const value of fd.getAll('level')) {
    if (typeof value === 'string' && value) levels.add(value);
  }
  const faculties = new Set<string>();
  for (const value of fd.getAll('faculty')) {
    if (typeof value === 'string' && value) faculties.add(value);
  }
  const fields = new Set<string>();
  for (const value of fd.getAll('field')) {
    if (typeof value === 'string' && value) fields.add(value);
  }
  return {
    q: String(fd.get('q') ?? '').trim().toLowerCase(),
    country: String(fd.get('country') ?? ''),
    levels,
    faculties,
    fields,
    maxTuition: fd.get('maxTuition') ? Number(fd.get('maxTuition')) : null,
    maxIelts: fd.get('maxIelts') ? Number(fd.get('maxIelts')) : null,
    hasScholarship: fd.get('hasScholarship') === 'on',
  };
}

function cardMatches(card: HTMLElement, state: FilterState): boolean {
  if (state.q) {
    const haystack = card.dataset.search ?? card.dataset.name ?? '';
    if (!haystack.includes(state.q)) return false;
  }
  if (state.country && card.dataset.country !== state.country) return false;

  if (state.levels.size > 0) {
    const cardLevels = (card.dataset.levels ?? '').split(',').filter(Boolean);
    if (!cardLevels.some((l) => state.levels.has(l))) return false;
  }
  if (state.faculties.size > 0) {
    const cardFaculties = (card.dataset.faculties ?? '').split(',').filter(Boolean);
    if (!cardFaculties.some((f) => state.faculties.has(f))) return false;
  }
  if (state.fields.size > 0) {
    const cardFields = (card.dataset.fields ?? '').split(',').filter(Boolean);
    if (!cardFields.some((f) => state.fields.has(f))) return false;
  }
  if (state.maxTuition !== null) {
    const tuitionMin = Number(card.dataset.tuitionMin ?? '0');
    if (tuitionMin > state.maxTuition) return false;
  }
  if (state.maxIelts !== null) {
    const ieltsRaw = card.dataset.ielts;
    if (ieltsRaw && Number(ieltsRaw) > state.maxIelts) return false;
  }
  if (state.hasScholarship && card.dataset.scholarship !== '1') return false;
  return true;
}

function countActive(state: FilterState, form: HTMLFormElement): number {
  let n = 0;
  if (state.q) n++;
  if (state.country) n++;
  if (state.levels.size > 0) n++;
  if (state.faculties.size > 0) n++;
  if (state.fields.size > 0) n++;
  const rangeEl = form.elements.namedItem('maxTuition');
  if (rangeEl instanceof HTMLInputElement && state.maxTuition !== null) {
    const max = Number(rangeEl.max);
    if (Number.isFinite(max) && state.maxTuition < max) n++;
  }
  if (state.maxIelts !== null) n++;
  if (state.hasScholarship) n++;
  return n;
}

function updateBadge(n: number, visible: number, total: number): void {
  const badge = document.getElementById(BADGE_ID);
  if (badge) {
    badge.hidden = n === 0;
    badge.textContent = n === 0 ? '' : String(n);
  }
  const result = document.getElementById(RESULT_ID);
  if (result) {
    result.textContent = total === 0 ? '' : `${visible} из ${total}`;
  }
}

function applyFilters(form: HTMLFormElement): void {
  const state = readState(form);
  const grid = document.getElementById(GRID_ID);
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.uni-card-v2'));
  let visible = 0;
  for (const card of cards) {
    const match = cardMatches(card, state);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  }

  const empty = document.getElementById(EMPTY_ID);
  if (empty) empty.hidden = visible !== 0;
  const count = document.getElementById(COUNT_ID);
  if (count) count.textContent = String(visible);

  syncRangeOutput(form);
  syncUrl(state);
  updateBadge(countActive(state, form), visible, cards.length);
}

function syncRangeOutput(form: HTMLFormElement): void {
  const range = form.elements.namedItem('maxTuition');
  const out = form.elements.namedItem('maxTuitionOut');
  if (range instanceof HTMLInputElement && out instanceof HTMLOutputElement) {
    out.textContent = Number(range.value).toLocaleString('ru-RU');
  }
}

function syncUrl(state: FilterState): void {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.country) params.set('country', state.country);
  if (state.levels.size > 0) params.set('level', Array.from(state.levels).join(','));
  if (state.faculties.size > 0) params.set('faculty', Array.from(state.faculties).join(','));
  if (state.fields.size > 0) params.set('field', Array.from(state.fields).join(','));
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
  const faculty = params.get('faculty');
  if (faculty) {
    const wanted = new Set(faculty.split(',').filter(Boolean));
    form.querySelectorAll<HTMLInputElement>('input[name="faculty"]').forEach((i) => {
      i.checked = wanted.has(i.value);
    });
  }
  const field = params.get('field');
  if (field) {
    const wanted = new Set(field.split(',').filter(Boolean));
    form.querySelectorAll<HTMLInputElement>('input[name="field"]').forEach((i) => {
      i.checked = wanted.has(i.value);
    });
  }
  const level = params.get('level');
  if (level) {
    const wanted = new Set(level.split(',').filter(Boolean));
    form.querySelectorAll<HTMLInputElement>('input[name="level"]').forEach((i) => {
      i.checked = wanted.has(i.value);
    });
  }
  const maxTuition = params.get('maxTuition');
  if (maxTuition) setValue('maxTuition', maxTuition);
  const maxIelts = params.get('maxIelts');
  if (maxIelts) setValue('maxIelts', maxIelts);
  const sch = params.get('hasScholarship');
  const schInput = form.elements.namedItem('hasScholarship');
  if (schInput instanceof HTMLInputElement) {
    schInput.checked = sch === '1';
  }
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

interface ComparePayload {
  slug: string;
  name: string;
}

function readCompare(): ComparePayload[] {
  try {
    const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.slug) : [];
  } catch {
    return [];
  }
}

function writeCompare(list: ComparePayload[]): void {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

function renderCompareBar(list: ComparePayload[]): void {
  const bar = document.getElementById(COMPARE_BAR_ID);
  const cnt = document.getElementById(COMPARE_COUNT_ID);
  const names = document.getElementById(COMPARE_NAMES_ID);
  const cta = document.getElementById(COMPARE_CTA_ID) as HTMLAnchorElement | null;
  if (!bar) return;
  if (list.length === 0) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  if (cnt) cnt.textContent = `${list.length} / ${COMPARE_MAX}`;
  if (names) names.textContent = list.map((x) => x.name).join(' · ');
  if (cta) {
    cta.href = `/compare?ids=${list.map((x) => encodeURIComponent(x.slug)).join(',')}`;
  }
}

function syncCheckboxes(list: ComparePayload[]): void {
  const slugs = new Set(list.map((x) => x.slug));
  document.querySelectorAll<HTMLInputElement>('.uni-card-v2__compare-input').forEach((cb) => {
    cb.checked = slugs.has(cb.value);
  });
}

function wireCompare(): void {
  let list = readCompare();
  renderCompareBar(list);
  syncCheckboxes(list);

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains('uni-card-v2__compare-input')) return;

    const card = t.closest<HTMLElement>('.uni-card-v2');
    if (!card) return;
    const slug = t.value;
    const name = card.querySelector('.uni-card-v2__name')?.textContent ?? slug;

    if (t.checked) {
      if (list.length >= COMPARE_MAX) {
        t.checked = false;
        alert(`Можно сравнивать до ${COMPARE_MAX} университетов одновременно. Уберите один, чтобы добавить новый.`);
        return;
      }
      if (!list.find((x) => x.slug === slug)) {
        list = [...list, { slug, name }];
      }
    } else {
      list = list.filter((x) => x.slug !== slug);
    }
    writeCompare(list);
    renderCompareBar(list);
  });

  const clearBtn = document.getElementById(COMPARE_CLEAR_ID);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      list = [];
      writeCompare(list);
      renderCompareBar(list);
      syncCheckboxes(list);
    });
  }
}

function init(): void {
  const form = document.getElementById(FORM_ID);
  if (!(form instanceof HTMLFormElement)) return;

  restoreFromUrl(form);
  applyFilters(form);
  wireToggle();
  wireCompare();

  const initial = readState(form);
  if (countActive(initial, form) > 0) {
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
