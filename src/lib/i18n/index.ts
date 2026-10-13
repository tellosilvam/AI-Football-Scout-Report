import type { Lang } from '../ai/schema';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';

export type Dict = typeof en;
const DICTS: Record<Lang, Dict> = { en, es, fr, pt };

export const LANG_LABEL: Record<Lang, string> = { en: 'English', es: 'Español', fr: 'Français', pt: 'Português' };

export function isLang(x: string | undefined): x is Lang {
  return x === 'en' || x === 'es' || x === 'fr' || x === 'pt';
}

export function t(lang: Lang): Dict {
  return DICTS[lang];
}

/** `{name}` interpolation. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function pickLang(acceptLanguage: string | null): Lang {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return 'en';
}
