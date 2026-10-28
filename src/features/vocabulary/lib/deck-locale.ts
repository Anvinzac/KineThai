/**
 * The answer language of the deck on screen, for the few leaf views that name things in
 * it (the grammar section's native terms). Provided once by the feed page, which already
 * resolved it from the address; anywhere without a provider reads the default target.
 *
 * Exports: DeckLocaleContext
 * Depends on: react, ./target-language
 */
import { createContext } from "react";
import { DEFAULT_TARGET, type TargetLocale } from "./target-language";

export const DeckLocaleContext = createContext<TargetLocale>(DEFAULT_TARGET);
