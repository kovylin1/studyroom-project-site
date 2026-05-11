// Expand/collapse interaction for .program-card elements.
// Each program card has a `.program-card__toggle` button that flips
// the parent card's `.is-open` class and updates ARIA state + label.

(() => {
  document.querySelectorAll<HTMLElement>('.program-card').forEach((card) => {
    const toggle = card.querySelector<HTMLButtonElement>('.program-card__toggle');
    const details = card.querySelector<HTMLElement>('.program-card__details');
    const label = card.querySelector<HTMLElement>('.program-card__toggle-label');
    if (!toggle || !details) return;

    toggle.addEventListener('click', () => {
      const open = card.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      details.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (label) label.textContent = open ? 'Свернуть' : 'Подробнее';
    });
  });
})();
