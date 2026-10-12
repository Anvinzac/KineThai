/**
 * The reader's visual-dialect choice, remembered on this device.
 *
 * Only the Chinese (hoa.*) host ever offers the Douyin dialect, and the stored value
 * is only honored there — an "en" visit keeps the default visuals even if the same
 * device previously switched a Chinese stream, so the preference can never leak
 * across languages.
 *
 * Exports: DIALECT_CHOICE_KEY, readDialectChoice, writeDialectChoice
 * Depends on: ../types (VisualDialect)
 */

import type { VisualDialect } from "../types";

export const DIALECT_CHOICE_KEY = "kinetic.vocab.dialect";

/**
 * Read the stored dialect.
 * @returns "douyin" when the reader switched the default visuals off, otherwise
 *   "default". Unknown values and unavailable storage both fall back quietly.
 */
export function readDialectChoice(): VisualDialect {
  try {
    if (typeof localStorage === "undefined") return "default";
    return localStorage.getItem(DIALECT_CHOICE_KEY) === "douyin" ? "douyin" : "default";
  } catch {
    return "default";
  }
}

/** Remember a dialect choice; never throws. @param dialect The dialect to store. */
export function writeDialectChoice(dialect: VisualDialect): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(DIALECT_CHOICE_KEY, dialect);
  } catch {
    // Quota or privacy mode — the toggle simply resets next visit.
  }
}
