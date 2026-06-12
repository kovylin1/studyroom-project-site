// site/src/i18n/utils.ts
import { ui, defaultLocale as DEFAULT } from './ui';

export type Locale = 'ru' | 'en' | 'kk';
export const locales: Locale[] = ['ru', 'en', 'kk'];
export const defaultLocale: Locale = DEFAULT;

/** Не-дефолтные локали — для getStaticPaths префиксных роутов. */
export function getLocalePaths(): Locale[] {
  return locales.filter((l) => l !== defaultLocale);
}

/** Локаль из URL: /en/... → 'en', /kk/... → 'kk', иначе дефолт. */
export function getLocaleFromUrl(url: URL): Locale {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  return (locales as string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** t(key) с фоллбэком на дефолтную локаль, затем на сам ключ. */
export function useTranslations(locale: Locale) {
  return function t(key: string): string {
    return ui[locale]?.[key] ?? ui[defaultLocale]?.[key] ?? key;
  };
}

/**
 * Строит путь к той же странице в другой локали.
 * Снимает текущий префикс локали (если есть) и добавляет новый (если не дефолт).
 * '/' и '/oxford' для en → '/en' и '/en/oxford'; для ru → '/' и '/oxford'.
 */
export function localizeUrl(pathname: string, target: Locale): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length && (locales as string[]).includes(parts[0])) parts.shift();
  const base = parts.join('/');
  if (target === defaultLocale) return '/' + base;
  return '/' + [target, base].filter(Boolean).join('/');
}
