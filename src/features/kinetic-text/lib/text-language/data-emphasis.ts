/**
 * Upstream (data-provided) emphasis phrase matching.
 *
 * Exports: getDataEmphasisWordIndexes, getDataEmphasisWordSpans, getEmphasisPhraseKeysForLayout, getEmphasizedRunPhraseKeys
 * Depends on: text-language/vietnamese-phrases (compound token keys)
 */

import { isLikelyJapaneseText } from "./japanese-text";
import { getCompoundTokenKey } from "./vietnamese-phrases";

const HAN = /\p{Script=Han}/u;
const FURIGANA = /《[^》]*》/gu;

function getJapaneseTokenKey(token: string): string {
  return getCompoundTokenKey(token.replace(FURIGANA, ""));
}

/**
 * Split a data emphasis phrase into comparison keys.
 * @param phrase - raw annotation phrase
 * @param perGlyphHan - whether Han tokens should expand into one key per glyph (true for Chinese, false for Japanese 文節)
 * @returns NFC comparison keys per token, or null when the phrase cannot match safely
 */
function getEmphasisPhraseKeys(phrase: string, perGlyphHan = true): string[] | null {
  const cleaned = perGlyphHan ? phrase : phrase.replace(FURIGANA, "");
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  // A Han annotation is written as one glued word ("诚实"), but a Han page tokenizes
  // per character — expand those tokens to one key per glyph so the phrase matches
  // the same units the packer and the renderer see. Japanese pages tokenize per 文節,
  // so a Japanese annotation ("飛び立ち", "目当て") stays one token key per 文節.
  const keys = tokens.flatMap((token) =>
    perGlyphHan && HAN.test(token) && !isLikelyJapaneseText(cleaned)
      ? // Glued punctuation ("诚实，") simply drops out; the glyphs keep the phrase whole.
        Array.from(token)
          .map(getCompoundTokenKey)
          .filter((key) => key.length > 0)
      : [getCompoundTokenKey(token)],
  );
  // Punctuation-only tokens ("—", "…") cannot anchor a meaningful emphasis
  // match, and silently dropping them would rewrite the phrase, so skip the
  // whole annotation instead.
  if (keys.some((key) => key.length === 0)) return null;
  return keys;
}

/**
 * Map data-provided emphasis phrases to exact token indexes in `words`.
 *
 * Matching is whole-token and consecutive: each annotation must occur as a run
 * of adjacent tokens, compared through NFC-normalized, lowercased,
 * punctuation-stripped keys that keep diacritics — "những" never matches
 * "nhưng" and "nền" never matches "nên". Punctuation at token boundaries
 * ("tĩnh," vs "tĩnh") is stripped safely. Every occurrence of every phrase is
 * matched; annotations absent from the text simply match nothing.
 *
 * @param words - tokenized stage text
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Matched token indexes (empty when nothing matches)
 */
export function getDataEmphasisWordIndexes(words: string[], dataEmphasis?: string[]): Set<number> {
  const matches = new Set<number>();
  for (const span of getDataEmphasisWordSpans(words, dataEmphasis)) {
    for (let offset = 0; offset < span.length; offset += 1) matches.add(span.start + offset);
  }
  return matches;
}

/**
 * Map data emphasis phrases to their exact token spans in `words`, grouped by
 * annotation. Spans come out in annotation order first, then text order, so a
 * caller can cap the page by highlighted WORDS: taking the first N spans keeps
 * the author's highest-priority annotations, and two adjacent phrases are
 * never counted as one word just because their indexes touch.
 * @param words - tokenized stage text
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Matched spans (empty when nothing matches)
 */
export function getDataEmphasisWordSpans(
  words: string[],
  dataEmphasis?: string[],
): Array<{ start: number; length: number }> {
  const spans: Array<{ start: number; length: number }> = [];
  if (!dataEmphasis?.length || words.length === 0) return spans;

  const isJapanese = isLikelyJapaneseText(words.join(" "));
  const phrases = dataEmphasis
    .map((phrase) => getEmphasisPhraseKeys(phrase, !isJapanese))
    .filter((keys): keys is string[] => keys !== null);
  if (!phrases.length) return spans;

  const wordKeys = words.map(isJapanese ? getJapaneseTokenKey : getCompoundTokenKey);

  for (const phraseKeys of phrases) {
    let matchedPhrase = false;
    for (let start = 0; start + phraseKeys.length <= wordKeys.length; start += 1) {
      if (phraseKeys.every((key, offset) => wordKeys[start + offset] === key)) {
        spans.push({ start, length: phraseKeys.length });
        matchedPhrase = true;
      }
    }
    // Japanese pages tokenize per 文節 ("離着陸し、", "目当ての", "手さえ"), while deck
    // `emphasisJa` annotations author the lexical stem ("離着陸", "目当て", "さえ").
    // When an annotation does not equal a whole 文節 token, match the 文節 (or shortest
    // consecutive 文節 run) that contains it.
    if (!matchedPhrase && isJapanese) {
      const joinedKey = phraseKeys.join("");
      if (!joinedKey) continue;
      for (let index = 0; index < wordKeys.length; index += 1) {
        if (wordKeys[index]!.includes(joinedKey)) {
          spans.push({ start: index, length: 1 });
          matchedPhrase = true;
        }
      }
      if (!matchedPhrase) {
        for (let start = 0; start < wordKeys.length; start += 1) {
          let acc = "";
          for (let length = 1; start + length <= wordKeys.length && length <= 4; length += 1) {
            acc += wordKeys[start + length - 1];
            if (acc.includes(joinedKey)) {
              const withoutFirst = wordKeys.slice(start + 1, start + length).join("");
              if (!withoutFirst.includes(joinedKey)) {
                spans.push({ start, length });
              }
              break;
            }
          }
        }
      }
    }
  }

  return spans;
}

/**
 * Convert data emphasis phrases into the token-key form the bound-phrase helpers
 * compare against, so an annotated compound ("thực sự") is treated as one
 * unbreakable word by line packing and shared emphasis styling.
 * @param dataEmphasis - optional upstream annotation phrases
 * @returns Diacritic-preserving token keys per usable phrase
 */
export function getEmphasisPhraseKeysForLayout(dataEmphasis?: string[]): string[][] {
  if (!dataEmphasis?.length) return [];
  return dataEmphasis
    .map((phrase) => getEmphasisPhraseKeys(phrase))
    .filter((keys): keys is string[] => keys !== null);
}

/**
 * Token keys for every highlighted run of two or more adjacent tokens.
 *
 * The selection layer already decided that a run reads as ONE word — through the
 * curated bound-phrase list, a compound repair, or two neighbouring picks — but
 * only the annotated phrases reach the layout and styling helpers as keys. Without
 * the runs here, a compound can still be packed onto two lines and, once split, each
 * syllable hashes its own emphasis effect. Registering the run as a bound phrase
 * makes that decision visible to everything downstream: unbreakable line packing and
 * one shared effect across all its syllables.
 * @param words - tokenized page text
 * @param emphasized - highlighted token indexes
 * @returns One diacritic-preserving key list per run of two or more tokens
 * @pure true
 */
export function getEmphasizedRunPhraseKeys(words: string[], emphasized: Set<number>): string[][] {
  // Runs break on a token with no letter or number, exactly like the renderers'
  // grouping, so trailing punctuation or a masked "_____" blank never joins a phrase.
  const hasGlyph = (word: string) => /\p{L}|\p{N}/u.test(word);
  const runs: string[][] = [];
  let run: string[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] ?? "";
    if (emphasized.has(index) && hasGlyph(word)) {
      run.push(getCompoundTokenKey(word));
      continue;
    }
    if (run.length >= 2) runs.push(run);
    run = [];
  }
  if (run.length >= 2) runs.push(run);

  return runs;
}
