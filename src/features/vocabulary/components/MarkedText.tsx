/**
 * Deck sentences rendered as prose. Deck text carries two authoring conventions —
 * /word/ emphasis markers and a ____ answer blank — that the kinetic stages
 * consume but that must never reach a reader as literal slashes or underscores.
 *
 * Exports: MarkedText, FilledUsage
 * Depends on: React, ../lib/stages
 */
import { Fragment } from "react";
import { isLikelyJapaneseText } from "@/features/kinetic-text";
import { stripJapaneseMarks } from "../lib/ja-text";
import { splitEmphasisMarkers } from "../lib/stages";

/**
 * Render a deck sentence with its /markers/ turned into highlights.
 * At most ONE mark per sentence: the first highlighted phrase gets the underline;
 * any subsequent markers are rendered as plain text, so a sentence never has
 * duplicate highlights fighting for attention.
 *
 * Japanese prose is drawn the way its kinetic pages are: the spacing and `_`/`=`/`|`
 * marks that exist only to tokenise are removed, so none of them reaches a reader.
 * @param props.text - Source field, possibly carrying /word/ markers
 * @returns Inline prose
 */
export function MarkedText({ text }: { text: string }) {
  const parts = splitEmphasisMarkers(text);
  const japanese = isLikelyJapaneseText(text);
  const display = (value: string) => (japanese ? stripJapaneseMarks(value) : value);
  let highlighted = false;
  return (
    <>
      {parts.map((part, index) => {
        // Only the FIRST marked run gets the highlight; the rest stay plain.
        const shouldHighlight = part.marked && !highlighted;
        if (part.marked) highlighted = true;
        return shouldHighlight ? (
          <mark key={index} className="vocab-def-mark">
            {display(part.text)}
          </mark>
        ) : (
          <Fragment key={index}>{display(part.text)}</Fragment>
        );
      })}
    </>
  );
}

/**
 * Render an example with its answer blank filled in and the answer picked out.
 * @param props.text - Example sentence with a ____ blank
 * @param props.word - The answer that fills it
 * @returns Inline prose
 */
export function FilledUsage({ text, word }: { text: string; word: string }) {
  const runs = text.split(/_{2,}/);
  return (
    <>
      {runs.map((run, index) => (
        <Fragment key={index}>
          <MarkedText text={run} />
          {index < runs.length - 1 && <mark className="vocab-def-answer">{word}</mark>}
        </Fragment>
      ))}
    </>
  );
}
