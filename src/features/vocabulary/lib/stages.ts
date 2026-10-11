/** Explicit clue stages and answer masking (never infer pages from line breaks). Exports: buildStages, completeUsage, splitEmphasisMarkers. Depends on: schema, kinetic-text emphasis types, clues, i18n, locale. */
import type { EmphasisVariant } from "@/features/kinetic-text";
import { answerPattern, type NarrativeStyle, type VocabularyWord } from "./schema";
import { paginateText } from "@/features/post-player";
import { resolveClue } from "./clues";
import { leadLabel, stageLabel, lettersSentence } from "./i18n";
import type { Locale } from "./locale";

/**
 * Effect used for the starting initial on the letter-count clue. `frame` draws a
 * box around the glyph, which is the one variant that reads as a container for a
 * single letter rather than as a recolor, so it stays visibly distinct from the
 * mark the letter count already carries.
 */
const INITIAL_EMPHASIS_VARIANT: EmphasisVariant = "frame";

export type LearningStage = {
  id: string;
  label: string;
  text: string;
  secondary?: string;
  lang: Locale | "en";
  reveal?: boolean;
  /** Emphasis phrases extracted from /word/ markers in the source text field. */
  dataEmphasis?: string[];
  /** Second highlight drawn with its own effect, independent of `dataEmphasis`. */
  secondaryEmphasis?: { phrase: string; variant: EmphasisVariant };
};

/**
 * Parse /word/ emphasis markers from a text field.
 * Returns the clean text (markers stripped) and the list of marked phrases.
 */
function parseEmphasisMarkers(text: string): { clean: string; markers: string[] } {
  const markers: string[] = [];
  const clean = text.replace(/\/([^/]+)\//g, (_, word) => {
    markers.push(word.trim());
    return word.trim();
  });
  return { clean, markers };
}

/**
 * Split a deck text field on its /word/ emphasis markers, for surfaces that render
 * the sentence as prose rather than as kinetic text. The markers are an authoring
 * convention and must never reach the screen as literal slashes.
 * @param text - Source field, possibly carrying /word/ markers
 * @returns Ordered runs; `marked` is true for a phrase that sat between markers
 * @pure true
 */
export function splitEmphasisMarkers(text: string): { text: string; marked: boolean }[] {
  const parts: { text: string; marked: boolean }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(/\/([^/]+)\//g)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ text: text.slice(cursor, start), marked: false });
    parts.push({ text: match[1]!.trim(), marked: true });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts;
}

/** Fill a deck's deliberate answer blank. @param text Example sentence. @param word Target. @returns Completed sentence. */
export function completeUsage(text: string, word: string): string {
  return text.replace(/_{2,}/g, word);
}

/** Create the supplied seven-stage flow, skipping absent optional content. @param word Catalog entry. @param style Narrative preset. @param locale Selected content locale (leading phrases localized; reveal stays English). @returns Ordered stages. */
export function buildStages(
  word: VocabularyWord,
  style: NarrativeStyle,
  locale: Locale,
): LearningStage[] {
  const mask = (text: string) => text.replace(answerPattern(word.word), "_____");
  const stages: LearningStage[] = [];
  const lead = resolveClue(word, "lead", locale);
  if (lead) {
    const { clean, markers } = parseEmphasisMarkers(lead);
    stages.push({
      id: "lead",
      label: leadLabel(style, locale),
      text: mask(clean),
      lang: locale,
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  {
    const { clean, markers } = parseEmphasisMarkers(resolveClue(word, "def", locale));
    stages.push({
      id: "definition",
      label: stageLabel("definition", locale),
      text: mask(clean),
      lang: locale,
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  const count = (word.word.match(/\p{L}/gu) ?? []).length;
  const initial = word.word[0].toUpperCase();
  stages.push({
    id: "letters",
    label: stageLabel("letters", locale),
    text: lettersSentence(count, initial, locale),
    lang: locale,
    // The count keeps the primary mark on purpose — getWordImportance scores a
    // standalone number above everything so the digits always win this sentence.
    // The initial is added as a second, differently-drawn mark rather than
    // replacing it, so one page carries both facts.
    secondaryEmphasis: { phrase: initial, variant: INITIAL_EMPHASIS_VARIANT },
  });
  const example = word.usage[0];
  if (example) {
    const { clean: enClean, markers: enMarkers } = parseEmphasisMarkers(example.en);
    const { clean: viClean } = parseEmphasisMarkers(resolveClue(word, "hint", locale));
    stages.push({
      id: "usage",
      label: stageLabel("usage", locale),
      text: mask(enClean),
      secondary: mask(viClean),
      lang: "en",
      dataEmphasis: enMarkers.length ? enMarkers : undefined,
    });
  }
  const guess = resolveClue(word, "guess", locale);
  if (guess) {
    const { clean, markers } = parseEmphasisMarkers(guess);
    stages.push({
      id: "anticipation",
      label: stageLabel("anticipation", locale),
      text: mask(clean),
      lang: locale,
      dataEmphasis: markers.length ? markers : undefined,
    });
  }
  stages.push({
    id: "reveal",
    label: stageLabel("reveal", locale),
    text: word.word,
    lang: "en",
    reveal: true,
  });
  return stages.flatMap((stage) => {
    if (stage.reveal) return [stage];
    return paginateText(stage.text).map((text, index) => ({
      ...stage,
      id: `${stage.id}-${index}`,
      text,
    }));
  });
}
