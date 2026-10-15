/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: KineticText, DEFAULT_TEXT_PAGE_WORD_LIMIT, VIETNAMESE_TEXT_PAGE_WORD_LIMIT, expandEmphasisToBoundPhrases, getBoundPhraseEmphasisSeed, getBoundPhraseStartIndex, getHanTokens, getSpecialPoeticWordIndexes, getTextPageWordLimit, getHanLayoutMetrics, getVietnameseCanvasInnerWidth, getVietnameseCharBudgetForLine, getVietnameseLayoutMetrics, getVietnameseWordLines, isLikelyChineseText, isLikelyVietnameseText, repairSplitCompoundEmphasis, VietnameseLayoutMetrics, ...
 * Depends on: ./components/KineticText, ./lib/text-language, ./lib/text-language
 */

export { KineticText } from "./components/KineticText";

export {
  DEFAULT_TEXT_PAGE_WORD_LIMIT,
  VIETNAMESE_TEXT_PAGE_WORD_LIMIT,
  expandEmphasisToBoundPhrases,
  getBoundPhraseEmphasisSeed,
  getBoundPhraseStartIndex,
  getDataEmphasisWordIndexes,
  getDataEmphasisWordSpans,
  getEmphasisPhraseKeysForLayout,
  getEmphasizedRunPhraseKeys,
  getHanCharBudgetForLine,
  getHanLayoutMetrics,
  getHanTokens,
  getSpecialPoeticWordIndexes,
  getTextPageWordLimit,
  getVietnameseCanvasInnerWidth,
  getVietnameseCharBudgetForLine,
  getVietnameseLayoutMetrics,
  getVietnameseWordLines,
  isLikelyChineseText,
  isLikelyVietnameseText,
  repairSplitCompoundEmphasis,
  SHORT_SENTENCE_MAX_WORDS,
  countSentenceWords,
  limitShortSentenceEmphasis,
  MAX_MEASURED_SEGMENTS,
  getPunctuationPhraseEdges,
  isBreakOneWordFromEdge,
  solveMeasuredLines,
} from "./lib/text-language";
export type {
  MeasuredLineBounds,
  MeasuredLineOptions,
  MeasuredLines,
  MeasuredSegment,
  VietnameseLayoutMetrics,
  VietnameseLineLayoutOptions,
  WordLine,
  WordSegment,
} from "./lib/text-language";

export { getStableNumber } from "./lib/stable-hash";
export { getWordAnchorKey, getWords } from "./lib/words";
export {
  getKineticTextLayoutMode,
  getMeasuredTextWidth,
  getWidestLineWidth,
  getWidestWordWidth,
  hasVisibleStickerAccent,
} from "./lib/layout";
export type { KineticTextLayoutMode } from "./lib/layout";
export { getLoopAnimation, TEMPO_LOOP_SECONDS } from "./lib/loop";
export {
  EMPHASIS_VARIANTS,
  NON_LUMINOUS_EMPHASIS_VARIANTS,
  getAuraColor,
  getEmphasisInnerAnimation,
  getEmphasisTextShadow,
  getEmphasisVariant,
  getRunEmphasisStyle,
  isDimEmphasisColor,
  isWhiteLikeColor,
} from "./lib/emphasis";
export type { EmphasisVariant } from "./lib/emphasis";
