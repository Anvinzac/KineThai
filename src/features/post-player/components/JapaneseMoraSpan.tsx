/**
 * One mora of a Japanese 文節, animated as its own entrance beat.
 *
 * A Japanese page reveals syllable by syllable: WordSequenceWord splits each 文節 into
 * mora units (getJapaneseMoraTokens) and renders one of these per unit, so the cascade
 * flows across the whole page while the 文節 keeps a single emphasis effect and a single
 * measured width. Each span owns its entrance through the page clock, exactly like a
 * word does elsewhere, so it pauses and resumes with the page.
 *
 * Exports: JapaneseMoraSpan
 * Depends on: framer-motion, post-player entrances, usePausableEntrance
 */

import { motion } from "framer-motion";
import type { ReactElement } from "react";
import {
  getEntranceHidden,
  getEntranceRest,
  getEntranceTransition,
  type ResolvedEntranceStyle,
} from "../lib/entrances";
import { usePausableEntrance } from "../hooks/usePausableEntrance";

export type JapaneseMoraSpanProps = {
  /** One mora unit (a single kana/kanji glyph, with any punctuation glued to it). */
  unit: string;
  entranceStyle: ResolvedEntranceStyle;
  important: boolean;
  /** The 文節 index — all its mora share one hidden-pose direction so they move as a family. */
  wordIndex: number;
  /** Seconds from page start before this mora begins its entrance. */
  delay: number;
  /** Entrance length, seconds. */
  duration: number;
  timeScale: number;
  staticRender: boolean;
};

/**
 * Render one mora with its own pausable entrance.
 * @param props - JapaneseMoraSpanProps fields
 * @returns Rendered UI
 */
export function JapaneseMoraSpan({
  unit,
  entranceStyle,
  important,
  wordIndex,
  delay,
  duration,
  timeScale,
  staticRender,
}: JapaneseMoraSpanProps): ReactElement {
  const hidden = getEntranceHidden(entranceStyle, important, wordIndex);
  const transition = getEntranceTransition(entranceStyle, delay, duration, timeScale);
  // A static render (a revealed page, or the measuring pass) shows the mora at rest, so
  // the 文節 keeps the exact width the layout measured and honours reduced motion.
  const ownsEntrance = !staticRender;
  const controls = usePausableEntrance("show", transition, ownsEntrance);
  return (
    <motion.span
      initial={ownsEntrance ? "hidden" : undefined}
      animate={ownsEntrance ? controls : undefined}
      variants={{ hidden, show: getEntranceRest(hidden) }}
      transition={transition}
      style={{ display: "inline-block", whiteSpace: "nowrap" }}
    >
      {unit}
    </motion.span>
  );
}
