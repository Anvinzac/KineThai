/**
 * Japanese (kana-bearing) page support: detection and zero-gap packed lines.
 *
 * Japanese is written without spaces. The deck's ASCII spaces only separate 文節 for
 * tokenising; the reader draws them flush, so the line packer joins segments with no
 * gap at all and a line may break between any two 文節. Glyphs themselves cost a full
 * em, unlike the ~0.58em average of Vietnamese letters.
 *
 * Exports: isLikelyJapaneseText, getJapaneseCharBudgetForLine, getJapaneseLayoutMetrics
 * Depends on: ./page-metrics
 */

import {
  getVietnameseCanvasInnerWidth,
  getVietnameseLineIndentEm,
  getVietnameseWordLines,
  suggestPackedFitScale,
} from "./page-metrics";
import type { VietnameseLayoutMetrics } from "./types";

/** Hiragana or katakana. Kanji alone is ambiguous (Chinese has no kana), so it never triggers. */
const KANA = /[\u3040-\u30ff\uff66-\uff9f]/u;
/** A CJK glyph is about one em wide; the Latin average is 0.58em. */
const JAPANESE_AVG_CHAR_WIDTH_EM = 1;
const JAPANESE_LINE_SIDE_PAD_EM = 0.12;
/**
 * Soft ceiling on glyphs per line. Japanese has no spaces, so a wide page would
 * otherwise pack a whole clue onto one long line; ten glyphs keeps the block tall and
 * the line comfortably readable. The measured layout re-breaks from real widths.
 */
const JAPANESE_MAX_CHARS_PER_LINE = 10;

/**
 * True when the text contains kana. The reader uses this to refuse Japanese pages to
 * the Chinese per-glyph packer (kanji-heavy clue text can look Chinese) and to draw
 * the words flush instead of with Vietnamese inter-word gaps.
 * @param text - page text in either form
 * @returns true when at least one hiragana or katakana character is present
 * @pure true
 */
export function isLikelyJapaneseText(text: string): boolean {
  return KANA.test(text);
}

/**
 * Visible-character budget for one Japanese line at a given canvas width.
 * @param lineIndex - zero-based line
 * @param canvasInnerWidthPx - usable inner width, px
 * @param fontSizePx - font size the budget is counted at, px
 * @returns Soft glyph capacity for that line
 * @pure true
 */
export function getJapaneseCharBudgetForLine(
  lineIndex: number,
  canvasInnerWidthPx: number,
  fontSizePx: number,
): number {
  const indentEm = getVietnameseLineIndentEm(lineIndex);
  const availablePx =
    canvasInnerWidthPx - indentEm * fontSizePx - fontSizePx * JAPANESE_LINE_SIDE_PAD_EM;
  const charWidthPx = Math.max(fontSizePx * JAPANESE_AVG_CHAR_WIDTH_EM, 1);
  return Math.min(JAPANESE_MAX_CHARS_PER_LINE, Math.max(3, Math.floor(availablePx / charWidthPx)));
}

/**
 * Pack Japanese tokens (文節) into the shared staggered lines, drawn flush.
 * @param words - display tokens, one per 文節
 * @param canvasWidthPx - canvas width, px
 * @param fontSizePx - starting font size, px
 * @param visualScaleGuard - allowance for enlarged emphasised words
 * @param phraseKeys - data-annotated phrases kept unbreakable on a line
 * @returns Lines + suggestedFitScale
 * @pure true
 */
export function getJapaneseLayoutMetrics(
  words: string[],
  canvasWidthPx: number,
  fontSizePx: number,
  visualScaleGuard = 1,
  phraseKeys?: readonly (readonly string[])[],
): VietnameseLayoutMetrics {
  const innerWidth = getVietnameseCanvasInnerWidth(canvasWidthPx);
  const getLineCapacity = (lineIndex: number) =>
    getJapaneseCharBudgetForLine(lineIndex, innerWidth, fontSizePx);
  const lines = getVietnameseWordLines(words, {
    getLineCapacity,
    phraseKeys,
    gapUnits: 0,
    pairReach: false,
  });
  return {
    lines,
    suggestedFitScale: suggestPackedFitScale(lines, getLineCapacity, visualScaleGuard, 0),
  };
}
