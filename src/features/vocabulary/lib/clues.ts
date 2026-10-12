/**
 * Resolve a localized leading phrase for a word in the selected locale, with a
 * graceful fallback to the Vietnamese base. The four phrases are:
 *   lead   → localized.lead[locale]   (fallback leadVi)
 *   def    → localized.def[locale]    (fallback defVi)
 *   guess  → localized.guess[locale]  (fallback anticipateVi)
 *   hint   → usage[0].glosses[locale] (fallback usage[0].vi)
 *
 * For the base locale (`vi`) the legacy `*Vi` fields ARE the source, so we never
 * require `localized.vi` to exist. Any other locale falls back to Vietnamese when it
 * has not been authored yet, so unimplemented languages degrade to Vietnamese rather
 * than to blanks.
 *
 * Exports: ClueField, resolveClue
 * Depends on: schema (type), locale (type)
 */

import type { Locale } from "./locale";
import { BASE_LOCALE } from "./locale";
import type { VocabularyWord } from "./schema";

/** The four localized leading phrases (the reveal `word` is handled separately). */
export type ClueField = "lead" | "def" | "guess" | "hint";

/** Resolve the phrase text for a locale. Never returns undefined — empty string when absent.
 * The requested locale wins; when it has not been authored, fall back to the
 * Vietnamese base (BASE_LOCALE), never to a blank. */
export function resolveClue(word: VocabularyWord, field: ClueField, locale: Locale): string {
  if (locale !== BASE_LOCALE) {
    if (field === "hint") {
      const gloss = word.usage[0]?.glosses?.[locale];
      if (gloss) return gloss;
    } else {
      const localized = word.localized?.[locale]?.[field];
      if (localized) return localized;
    }
  }
  switch (field) {
    case "lead":
      return word.leadVi ?? "";
    case "def":
      return word.defVi ?? "";
    case "guess":
      return word.anticipateVi ?? "";
    case "hint":
      return word.usage[0]?.vi ?? "";
  }
}
