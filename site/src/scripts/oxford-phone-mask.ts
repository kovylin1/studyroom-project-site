// Lightweight KZ phone mask: +7 (___) ___-__-__
// Exposes attachPhoneMask(input) and isPhoneValid(value), and also assigns them
// to window so inline form code in [slug].astro can use them.

const FULL_LEN = 10;

function getDigits(value: string): string {
  let d = (value || '').replace(/\D+/g, '');
  if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1);
  return d.slice(0, FULL_LEN);
}

function format(digits: string): string {
  const slots = ['_', '_', '_', '_', '_', '_', '_', '_', '_', '_'];
  for (let i = 0; i < digits.length && i < FULL_LEN; i += 1) slots[i] = digits[i];
  return `+7 (${slots[0]}${slots[1]}${slots[2]}) ${slots[3]}${slots[4]}${slots[5]}-${slots[6]}${slots[7]}-${slots[8]}${slots[9]}`;
}

export function attachPhoneMask(input: HTMLInputElement | null): void {
  if (!input) return;

  function update(): void {
    if (!input) return;
    const digits = getDigits(input.value);
    input.value = format(digits);
  }

  input.addEventListener('focus', () => {
    if (!input.value || input.value === '') input.value = format('');
    requestAnimationFrame(() => {
      const i = input.value.indexOf('_');
      const pos = i >= 0 ? i : input.value.length;
      try {
        input.setSelectionRange(pos, pos);
      } catch {
        /* noop */
      }
    });
  });

  input.addEventListener('input', update);

  input.addEventListener('blur', () => {
    const digits = getDigits(input.value);
    if (digits.length === 0) input.value = '';
  });
}

export function isPhoneValid(value: string): boolean {
  return getDigits(value).length === FULL_LEN;
}

declare global {
  interface Window {
    attachPhoneMask?: typeof attachPhoneMask;
    isPhoneValid?: typeof isPhoneValid;
  }
}
window.attachPhoneMask = attachPhoneMask;
window.isPhoneValid = isPhoneValid;
