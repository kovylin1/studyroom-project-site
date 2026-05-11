// Subtle scroll-reveal — pure progressive enhancement.
// Auto-tags section heads, cards, benefits and CTAs with `.reveal`,
// then flips `.is-visible` once they enter the viewport.
// Respects `prefers-reduced-motion`.

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tag(): void {
  const selectors = [
    '.section__head',
    '.benefit',
    '.card',
    '.review',
    '.gallery__tile',
    '.location__frame',
    '.requirements__col',
    '.description__body',
    '.cta-inline',
    '.cta-final',
    '.hero__inner > div',
    '.hero__cover',
  ];
  document.querySelectorAll<HTMLElement>(selectors.join(',')).forEach((node, i) => {
    node.classList.add('reveal');
    node.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
  });
}

function run(): void {
  tag();

  if (prefersReduced || !('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((n) => n.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );

  document.querySelectorAll('.reveal').forEach((n) => io.observe(n));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(run));
} else {
  requestAnimationFrame(run);
}
