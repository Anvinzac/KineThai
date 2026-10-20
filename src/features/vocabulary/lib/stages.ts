/** Explicit clue stages and answer masking (never infer pages from line breaks). Exports: buildStages, completeUsage, splitEmphasisMarkers. Depends on: schema, word-joiner, hanzi script detection, kinetic-text emphasis types, locale + i18n + clues (KineThai overlay). */
import {
  getTextPageWordLimit,
  isLikelyJapaneseText,
  type EmphasisVariant,
} from "@/features/kinetic-text";
import { answerPattern, type NarrativeStyle, type VocabularyWord } from "./schema";
import { isHanAnswer } from "./hanzi";
import { paginateText } from "@/features/post-player";
import { resolveClue } from "./clues";
import { hanLettersSentence, leadLabel, lettersSentence, stageLabel } from "./i18n";
import { paginateJapaneseChunks, parseJapaneseMarkup } from "./ja-text";
import { BASE_LOCALE, DEFAULT_LOCALE, type Locale } from "./locale";
import { splitWordJoiners, stripWordJoiners } from "./word-joiner";

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
  lang: "vi" | "en" | "zh" | "ja" | "th" | "ko" | "fil";
  reveal?: boolean;
  /** Emphasis phrases extracted from /word/ markers in the source text field. */
  dataEmphasis?: string[];
  /**
   * Words the source text joined (see ./word-joiner), each written with plain spaces.
   * Their syllables are one word and must stay on one line.
   */
  boundPhrases?: string[];
  /** Second highlight drawn with its own effect, independent of `dataEmphasis`. */
  secondaryEmphasis?: { phrase: string; variant: EmphasisVariant };
  /**
   * Token indexes (into `text`) at which an authored Japanese chunk begins. The measured
   * layout treats them as phrase edges: a line ends on one when it can, and never one
   * 文節 beside one. Absent on unphrased pages.
   */
  phraseEdges?: number[];
};

/** A stage plus the not-yet-paginated Japanese chunks it was parsed from. */
type BuiltStage = LearningStage & { japaneseChunks?: string[][] };

/**
 * Parse /word/ emphasis markers and word joins from a text field.
 * Returns the clean text (markers stripped, joins written as plain spaces), the list of
 * marked phrases, and the joined words that must stay whole. A kana-bearing field is
 * Japanese: its `_`/`=` are drawn flush (the joined unit becomes one token) and its `|`
 * chunks are kept so pages can break only on a whole phrase.
 */
function parseEmphasisMarkers(text: string): {
  clean: string;
  markers: string[];
  bound: string[];
  chunks?: string[][];
} {
  const markers: string[] = [];
  const unmarked = text.replace(/\/([^/]+)\//g, (_, word) => {
    markers.push(word.trim());
    return word.trim();
  });
  if (isLikelyJapaneseText(unmarked)) {
    const parsed = parseJapaneseMarkup(unmarked);
    return {
      clean: parsed.text,
      // A highlight is matched token by token: keep the 文節 boundaries its display
      // form drops, so a phrase spanning several 文節 still lines up with the page.
      markers: markers.map((marker) => parseJapaneseMarkup(marker).text).filter(Boolean),
      bound: [],
      chunks: parsed.chunks,
    };
  }
  const { text: clean, bound } = splitWordJoiners(unmarked);
  return { clean, markers: markers.map(stripWordJoiners), bound };
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

/** Create the supplied seven-stage flow, skipping absent optional content. @param word Catalog entry. @param style Narrative preset. @param locale UI locale — Japanese by default; Vietnamese base when untranslated. @returns Ordered stages. */
export function buildStages(
  word: VocabularyWord,
  style: NarrativeStyle,
  locale: Locale = DEFAULT_LOCALE,
): LearningStage[] {
  const mask = (text: string) => text.replace(answerPattern(word.word), "_____");
  // The answer language drives <p lang> and font selection on the pages that render the
  // target script: a Han deck writes its usage sentence and reveal in Chinese, not English.
  const answerLang = isHanAnswer(word.word) ? "zh" : "en";
  // Clue pages render in the selected UI locale; stub locales degrade to the
  // Vietnamese base (BASE_LOCALE) via resolveClue + the i18n label fallbacks.
  const clueLang: LearningStage["lang"] =
    locale === BASE_LOCALE || resolveClue(word, "def", locale) !== word.defVi
      ? locale
      : BASE_LOCALE;
  const stages: BuiltStage[] = [];
  // The active locale's overlay can carry a clue the base never had — a Japanese-led
  // deck has no Vietnamese lead — so presence is decided after resolution.
  const lead = resolveClue(word, "lead", locale) || word.leadVi;
  if (lead) {
    const { clean, markers, bound, chunks } = parseEmphasisMarkers(lead);
    stages.push({
      id: "lead",
      label: leadLabel(style, locale),
      text: mask(clean),
      lang: clueLang,
      dataEmphasis: markers.length ? markers : undefined,
      boundPhrases: bound.length ? bound : undefined,
      japaneseChunks: chunks,
    });
  }
  {
    const { clean, markers, bound, chunks } = parseEmphasisMarkers(
      resolveClue(word, "def", locale) || word.defVi,
    );
    stages.push({
      id: "definition",
      label: stageLabel("definition", locale),
      text: mask(clean),
      lang: clueLang,
      dataEmphasis: markers.length ? markers : undefined,
      boundPhrases: bound.length ? bound : undefined,
      japaneseChunks: chunks,
    });
  }
  const hanCount = (word.word.match(/\p{Script=Han}/gu) ?? []).length;
  if (hanCount > 0) {
    // Chinese: the first character would give away half a 2-character word, so the
    // clue is the character count plus the first pinyin letter.
    const pinyinInitial = (word.ipa?.trim()[0] ?? "").toUpperCase();
    stages.push({
      id: "letters",
      label: stageLabel("letters", locale),
      text: hanLettersSentence(hanCount, pinyinInitial, locale),
      lang: clueLang,
      secondaryEmphasis: pinyinInitial
        ? { phrase: pinyinInitial, variant: INITIAL_EMPHASIS_VARIANT }
        : undefined,
    });
  }
  const count = (word.word.match(/\p{L}/gu) ?? []).length;
  const initial = word.word[0].toUpperCase();
  if (hanCount === 0)
    stages.push({
      id: "letters",
      label: stageLabel("letters", locale),
      text: lettersSentence(count, initial, locale),
      lang: clueLang,
      // The count keeps the primary mark on purpose — getWordImportance scores a
      // standalone number above everything so the digits always win this sentence.
      // The initial is added as a second, differently-drawn mark rather than
      // replacing it, so one page carries both facts.
      secondaryEmphasis: { phrase: initial, variant: INITIAL_EMPHASIS_VARIANT },
    });
  const example = word.usage[0];
  if (example) {
    const { clean: enClean, markers: enMarkers, bound: enBound } = parseEmphasisMarkers(example.en);
    const { clean: viClean } = parseEmphasisMarkers(
      resolveClue(word, "hint", locale) || example.vi,
    );
    stages.push({
      id: "usage",
      label: stageLabel("usage", locale),
      text: mask(enClean),
      secondary: mask(viClean),
      lang: answerLang,
      dataEmphasis: enMarkers.length ? enMarkers : undefined,
      boundPhrases: enBound.length ? enBound : undefined,
    });
  }
  const guess = resolveClue(word, "guess", locale) || word.anticipateVi;
  if (guess) {
    const { clean, markers, bound, chunks } = parseEmphasisMarkers(guess);
    stages.push({
      id: "anticipation",
      label: stageLabel("anticipation", locale),
      text: mask(clean),
      lang: clueLang,
      dataEmphasis: markers.length ? markers : undefined,
      boundPhrases: bound.length ? bound : undefined,
      japaneseChunks: chunks,
    });
  }
  stages.push({
    id: "reveal",
    label: stageLabel("reveal", locale),
    text: word.word,
    lang: answerLang,
    reveal: true,
  });
  return stages.flatMap((stage) => {
    const { japaneseChunks, ...base } = stage;
    if (base.reveal) return [base];
    if (japaneseChunks) {
      // Japanese pages take whole authored chunks: a page break is never mid-phrase.
      return paginateJapaneseChunks(japaneseChunks, getTextPageWordLimit(base.text)).map(
        (page, index) => ({
          ...base,
          id: `${base.id}-${index}`,
          text: mask(page.text),
          phraseEdges: page.phraseEdges.length > 0 ? page.phraseEdges : undefined,
        }),
      );
    }
    // Pages break like lines: never one word away from a comma, full stop or semicolon.
    return paginateText(base.text, { keepPhraseEdges: true }).map((text, index) => ({
      ...base,
      id: `${base.id}-${index}`,
      text,
    }));
  });
}
