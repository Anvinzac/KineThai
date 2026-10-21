/**
 * The pronunciation strip: IPA and the katakana reading on one line, with the part of
 * speech trailing them. Kept in one component so the feed, the saved list and the
 * challenge page cannot drift apart.
 *
 * Exports: WordPronunciation
 * Depends on: ../lib/schema
 */
import type { VocabularyWord } from "../lib/schema";

/** Render the phonetic guides that exist for a word. @param props Word plus display options. */
export function WordPronunciation({
  word,
  showPos = false,
  className,
}: {
  word: Pick<VocabularyWord, "ipa" | "kana" | "pos">;
  /** Include the part of speech after the phonetics. */
  showPos?: boolean;
  className?: string;
}) {
  const hasPhonetic = Boolean(word.ipa || word.kana);
  if (!hasPhonetic && !(showPos && word.pos)) return null;

  return (
    <p className={className ? `vocab-pronunciation ${className}` : "vocab-pronunciation"}>
      {word.ipa && (
        <span className="vocab-pronunciation-chip" data-phonetic="ipa">
          <span className="vocab-pronunciation-label" aria-hidden="true">
            IPA
          </span>
          <span className="vocab-pronunciation-value" lang="en">
            {word.ipa}
          </span>
        </span>
      )}
      {word.kana && (
        <span className="vocab-pronunciation-chip" data-phonetic="kana">
          <span className="vocab-pronunciation-label" aria-hidden="true">
            KANA
          </span>
          <span className="vocab-pronunciation-value" lang="ja">
            {word.kana}
          </span>
        </span>
      )}
      {showPos && word.pos && (
        <span className="vocab-pronunciation-pos" lang="en">
          {word.pos}
        </span>
      )}
    </p>
  );
}
