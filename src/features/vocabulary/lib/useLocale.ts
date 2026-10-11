/**
 * Client-side active-locale store, synced to the `?lang=` URL query param.
 *
 * The vocabulary feed renders client-side from the catalog words (which already
 * carry any per-locale `localized` overlays), so the selected locale never needs to
 * reach the server — it is purely a view concern read here and written by the picker
 * in FeedControls. Falls back to DEFAULT_LOCALE ("vi") when the param is absent or
 * unsupported.
 *
 * Exports: useLocale, setLocale, getLocale
 * Depends on: locale, react (useSyncExternalStore)
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, toLocale, type Locale } from "./locale";

let current: Locale =
  typeof window !== "undefined"
    ? toLocale(new URLSearchParams(window.location.search).get("lang"))
    : DEFAULT_LOCALE;

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
