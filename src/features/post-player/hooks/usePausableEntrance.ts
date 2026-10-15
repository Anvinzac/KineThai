/**
 * Pausable framer-motion entrances for the kinetic word sequence.
 *
 * framer-motion has no pause: a page's staggered word entrance kept running while an
 * overlay covered the feed, so closing it revealed (or flashed through) words the reader
 * never saw arrive. WordSequenceText owns one entrance clock per page; each animated
 * element stops on pause and, on resume, restarts with its delay shortened by the
 * entrance time already played — so the sequence continues where it stopped.
 *
 * Exports: EntranceClockContext, useEntranceClock, usePausableEntrance
 * Depends on: framer-motion, React
 */

import { useAnimationControls, type TargetAndTransition, type Transition } from "framer-motion";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from "react";

type EntranceClock = {
  paused: boolean;
  /** Seconds of entrance this page has actually played (pauses excluded). */
  getPlayed: () => number;
};

export const EntranceClockContext = createContext<EntranceClock>({
  paused: false,
  getPlayed: () => 0,
});

/**
 * Page-level clock that only advances while the page plays.
 * @param paused Whether playback is paused.
 * @param resetKey Changes whenever a new entrance starts (page / replay / static flip).
 * @returns Context value for EntranceClockContext.
 */
export function useEntranceClock(paused: boolean, resetKey: string): EntranceClock {
  const clock = useRef({ played: 0, since: null as number | null, key: "" });
  // Layout effects of this (parent) component run before the children's passive
  // effects, so every word reads an up-to-date clock when it starts or resumes.
  useLayoutEffect(() => {
    const now = performance.now();
    const current = clock.current;
    if (current.key !== resetKey) {
      clock.current = { played: 0, since: paused ? null : now, key: resetKey };
      return;
    }
    if (paused) {
      if (current.since !== null) {
        current.played += now - current.since;
        current.since = null;
      }
    } else if (current.since === null) {
      current.since = now;
    }
  }, [paused, resetKey]);
  return useMemo(
    () => ({
      paused,
      getPlayed: () => {
        const { played, since } = clock.current;
        return (played + (since === null ? 0 : performance.now() - since)) / 1000;
      },
    }),
    [paused],
  );
}

/**
 * Drive one element's entrance so it honours the page clock.
 * @param target Variant label or target values the element settles to.
 * @param transition The entrance transition (its `delay` is measured from page start).
 * @param enabled False for static renders; the element then animates nothing.
 * @returns Controls to pass to the element's `animate` prop.
 */
export function usePausableEntrance(
  target: string | TargetAndTransition,
  transition: Transition,
  enabled: boolean,
) {
  const controls = useAnimationControls();
  const { paused, getPlayed } = useContext(EntranceClockContext);
  const latest = useRef({ target, transition });
  latest.current = { target, transition };
  useEffect(() => {
    if (!enabled) return;
    if (paused) {
      controls.stop();
      return;
    }
    const { target: to, transition: base } = latest.current;
    const delay = Math.max(0, (Number(base.delay) || 0) - getPlayed());
    void controls.start(to as never, { ...base, delay });
  }, [paused, enabled, controls, getPlayed]);
  return controls;
}
