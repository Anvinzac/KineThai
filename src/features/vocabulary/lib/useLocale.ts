/**
 * Client-side active-locale store, synced to the `?lang=` URL query param and
 * remembered on-device.
 *
 * The vocabulary feed renders client-side from the catalog words (which already
 * carry any per-locale `localized` overlays), so the selected locale never needs to
 * reach the server — it is purely a view concern read here and written by the picker
 * in FeedControls.
 *
 * Resolution order: explicit `?lang=` → stored device choice → DEFAULT_LOCALE
 * ("ja"). Storing the choice means a reader who picks Vietnamese stays on
 * Vietnamese; only a first visit (no param, nothing stored) lands on Japanese.
 *
 * Exports: useLocale, setLocale, getLocale, readLocaleChoice
 * Depends on: locale, react (useSyncExternalStore)
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, toLocale, type Locale } from "./locale";

/** localStorage key holding the reader's UI-language choice. */
export const LOCALE_CHOICE_KEY = "kinetic.vocab.locale";

/**
 * Read the stored UI-language choice.
 * @returns The stored locale, or null when nothing was ever chosen or storage
 *   is unavailable. Unknown values are dropped rather than trusted.
 */
export function readLocaleChoice(): Locale | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LOCALE_CHOICE_KEY);
    return raw && isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Remember a UI-language choice; never throws. @param locale The locale to store. */
function writeLocaleChoice(locale: Locale): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LOCALE_CHOICE_KEY, locale);
  } catch {
    // Quota or privacy mode — the picker simply resets next visit.
  }
}

function initialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const param = new URLSearchParams(window.location.search).get("lang");
  // An explicit param always wins (and is remembered for next time).
  if (param && isLocale(param)) {
    writeLocaleChoice(param);
    return param;
  }
  return readLocaleChoice() ?? DEFAULT_LOCALE;
}

let current: Locale = initialLocale();

const listeners = new Set<() => void>();
function emit(): void {
  for (const listener of listeners) listener();
}

/** Current active locale (non-reactive read). */
export function getLocale(): Locale {
  return current;
}

/** Set the active locale and reflect it in the URL without adding history entries. */
export function setLocale(locale: Locale): void {
  current = locale;
  // Remembered on-device so the next visit reopens in the chosen language.
  writeLocaleChoice(locale);
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (locale === DEFAULT_LOCALE) url.searchParams.delete("lang");
    else url.searchParams.set("lang", locale);
    window.history.replaceState(null, "", url);
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reactive active locale for components. The server snapshot is always the default so
 * the first client render matches SSR (no hydration mismatch); after mount the client
 * snapshot reads the URL and re-renders to the selected locale if different. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}
