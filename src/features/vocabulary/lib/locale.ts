/**
 * Locale registry for the vocabulary feed. The feed is locale-parametric: every
 * leading phrase (lead / meaning / hint / guess) may be supplied per locale, and the
 * client prefers the selected locale, falling back to the Vietnamese base.
 *
 * INVARIANT — only the leading phrases are localized. The card always ENDS on the
 * English `word` (the reveal page), which is the anchor and is never translated. A
 * locale therefore never changes what the answer is, only the scaffolding around it.
 *
 * Adding a language later is DATA-ONLY: populate `localized.<code>` / `glosses.<code>`
 * on each word and add a label set in `i18n.ts`. No rendering code changes.
 *
 * Exports: Locale, SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, isLocale, toLocale
 * Depends on: none (leaf module)
 */

/** A supported UI/content locale. `vi` is the data fallback every word guarantees. */
export type Locale = "vi" | "th" | "zh" | "ko" | "ja" | "fil";

/** Locales the UI may offer. Order is the display order in the language picker. */
export const SUPPORTED_LOCALES: readonly Locale[] = ["ja", "vi", "th", "zh", "ko", "fil"];

/**
 * The UI default: what renders when no `?lang=` is present. This is Japanese —
 * the app opens in Japanese. Distinct from BASE_LOCALE below (the data fallback).
 */
export const DEFAULT_LOCALE: Locale = "ja";

/** The data fallback every word is guaranteed to carry (Vietnamese `*Vi` fields). */
export const BASE_LOCALE: Locale = "vi";

/** End-user names shown in the language picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  vi: "Tiếng Việt",
  th: "ไทย",
  zh: "中文",
  ko: "한국어",
  ja: "日本語",
  fil: "Filipino",
};

/** Flag glyph shown before each language name in the picker (no reading required). */
export const LOCALE_FLAGS: Record<Locale, string> = {
  vi: "🇻🇳",
  th: "🇹🇭",
  zh: "🇨🇳",
  ko: "🇰🇷",
  ja: "🇯🇵",
  fil: "🇵🇭",
};

/** Flag + name label for a locale, e.g. "🇹🇭 ไทย". */
export function localeLabel(code: Locale): string {
  return `${LOCALE_FLAGS[code]} ${LOCALE_NAMES[code]}`;
}

/** Type guard: is an unknown string a supported locale? */
export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Coerce an arbitrary string to a locale, falling back to the default. */
export function toLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}
