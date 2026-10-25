/**
 * The full-screen celebration that plays when a streak milestone is earned.
 *
 * The milestone's medal (./StreakMedal, in its tier metal) drops in
 * over a dimmed, blurred feed, with a ray burst, a shockwave, sparkles, falling confetti
 * and a count-up to the number of days. It covers the feed, so the feed is suspended for
 * as long as it is on screen (VocabularyFeedPage folds `celebrating` into `suspended`):
 * the next word waits behind it instead of playing out unseen.
 *
 * Decorative and CSS-driven, like RevealBurst: no framer-motion, no entrance clock. It is
 * not part of the kinetic word sequence, so usePausableEntrance would do nothing for it —
 * that hook only reads a clock WordSequenceText provides. The per-piece randomness is a
 * fixed seed, so every render of the same milestone is the same picture.
 *
 * It retires on timers, never on `animationend`. The blanket `prefers-reduced-motion` rule
 * in vocabulary.css sets `animation: none` on everything under the shell, so an
 * animationend listener never fires for a reduced-motion reader and the overlay would hold
 * the feed suspended forever. Every animated layer's resting style is therefore its final
 * frame (or hidden, for confetti and sparks), so the static picture is still complete; a
 * reader who turned animations off still earned the milestone and should still see it.
 *
 * It dismisses on "Tiếp tục", Escape, a tap anywhere once armed, or on its own after
 * STREAK_CELEBRATION_MS — the feed is often running hands-free, and a reader who has put
 * the phone down should come back to words, not a modal. The auto-close length is passed
 * into CSS as a custom property for the countdown bar, so the bar and the timer cannot
 * drift apart.
 *
 * Word milestones (lib/level-progress) reuse it whole: they pass `badge`, which swaps the
 * metal, the unit on the medal and the words, and keeps every bit of the choreography.
 *
 * Exports: StreakCelebration, STREAK_CELEBRATION_MS, CelebrationBadge
 * Depends on: React, ./StreakMedal, ../lib/streak-tiers, vocabulary.css
 */

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { STREAK_TIER_LABEL, streakBlurb, streakTier, type StreakTier } from "../lib/streak-tiers";
import { StreakMedal } from "./StreakMedal";

/** What a non-streak milestone shows in place of the streak's metal, unit and words. */
export type CelebrationBadge = { tier: StreakTier; unit: string; title: string; blurb: string };

/** How long the celebration holds the screen before closing on its own. */
export const STREAK_CELEBRATION_MS = 7000;
/** The closing fade; matches .vocab-streak-flash[data-leaving] in vocabulary.css. */
const EXIT_MS = 420;
/**
 * Taps are ignored this long after mount. The milestone lands the instant a word ends,
 * often while a thumb is already on its way to the next one; that tap should not be the
 * thing that throws the medal away before it has landed.
 */
const ARM_MS = 900;
/** The count-up from 0 to the milestone, starting as the medal settles. */
const COUNT_DELAY_MS = 380;
const COUNT_MS = 950;

/** Deterministic 0..1 noise, so the confetti is the same picture on every render. */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const CONFETTI = Array.from({ length: 46 }, (_, i) => ({
  x: noise(i + 1) * 100,
  delay: 300 + noise(i + 51) * 1500,
  dur: 2600 + noise(i + 101) * 1900,
  sway: (noise(i + 151) - 0.5) * 140,
  spin: 360 + noise(i + 201) * 900,
  shape: (["strip", "square", "dot", "strip"] as const)[i % 4],
  hue: i % 6,
}));

const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5 + (noise(i + 301) - 0.5) * 14,
  dist: 0.5 + noise(i + 351) * 0.34,
  size: 5 + noise(i + 401) * 5,
  hue: i % 6,
}));

/** Twinkles around the medal: [left %, top %, size px, delay ms]. */
const TWINKLES: [number, number, number, number][] = [
  [8, 18, 18, 900],
  [88, 12, 14, 1250],
  [94, 58, 20, 1600],
  [4, 66, 13, 2000],
  [72, 92, 15, 1400],
  [22, 94, 11, 2300],
  [50, -4, 12, 1800],
];

function Twinkle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" />
    </svg>
  );
}

/**
 * @param days - The milestone's number: days for a streak, words for a word badge
 * @param reducedMotion - Skip the count-up and the closing fade
 * @param onDone - Called once the celebration has fully left the screen
 * @param badge - A word milestone's metal, unit and words; absent for a streak
 */
export function StreakCelebration({
  days,
  reducedMotion,
  onDone,
  badge,
}: {
  days: number;
  reducedMotion: boolean;
  onDone: () => void;
  badge?: CelebrationBadge;
}) {
  const tier = badge?.tier ?? streakTier(days);
  const uid = useId().replace(/:/g, "");
  const [leaving, setLeaving] = useState(false);
  const [shown, setShown] = useState(reducedMotion ? days : 0);
  const mountedAt = useRef(Date.now());
  const root = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);

  const leave = useCallback(() => {
    if (leaveTimer.current !== undefined) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(onDone, reducedMotion ? 0 : EXIT_MS);
  }, [onDone, reducedMotion]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Auto-close after STREAK_CELEBRATION_MS.
  useEffect(() => {
    const id = window.setTimeout(leave, STREAK_CELEBRATION_MS);
    return () => window.clearTimeout(id);
  }, [leave]);

  // Escape closes immediately; focus moves to the dialog so a keyboard reader is inside it.
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        leave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  // Count the face up from 0 to `days` as the medal settles.
  useEffect(() => {
    if (reducedMotion) {
      setShown(days);
      return;
    }
    let frame = 0;
    const delay = window.setTimeout(() => {
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / COUNT_MS);
        const eased = 1 - (1 - t) ** 3;
        setShown(Math.max(1, Math.round(eased * days)));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, COUNT_DELAY_MS);
    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [days, reducedMotion]);

  return (
    <div
      ref={root}
      className="vocab-streak-flash"
      data-tier={tier}
      data-leaving={leaving || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      aria-describedby={`${uid}-blurb`}
      tabIndex={-1}
      style={{ "--celebration-ms": `${STREAK_CELEBRATION_MS}ms` } as CSSProperties}
      onClick={() => {
        if (Date.now() - mountedAt.current >= ARM_MS) leave();
      }}
    >
      {/* Falling confetti across the whole screen. */}
      <div className="vocab-streak-flash-confetti" aria-hidden="true">
        {CONFETTI.map((p, i) => (
          <i
            key={i}
            data-shape={p.shape}
            data-hue={p.hue}
            style={
              {
                "--x": `${p.x}%`,
                "--delay": `${p.delay}ms`,
                "--dur": `${p.dur}ms`,
                "--sway": `${p.sway}px`,
                "--spin": `${p.spin}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="vocab-streak-flash-body">
        <div className="vocab-streak-flash-stage" aria-hidden="true">
          <div className="vocab-streak-flash-rays" />
          <div className="vocab-streak-flash-glow" />
          <div className="vocab-streak-flash-ring" />
          <div className="vocab-streak-flash-ring" data-second="" />

          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="vocab-streak-flash-spark"
              data-hue={s.hue}
              style={
                {
                  "--angle": `${s.angle}deg`,
                  "--dist": s.dist,
                  "--size": `${s.size}px`,
                } as CSSProperties
              }
            />
          ))}

          {TWINKLES.map(([left, top, size, delay], i) => (
            <span
              key={i}
              className="vocab-streak-flash-twinkle"
              style={
                {
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  "--delay": `${delay}ms`,
                } as CSSProperties
              }
            >
              <Twinkle />
            </span>
          ))}

          <div className="vocab-streak-flash-float">
            <StreakMedal
              days={days}
              value={shown}
              tier={tier}
              unit={badge?.unit}
              className="vocab-streak-flash-medal"
            />
          </div>
        </div>

        <div className="vocab-streak-flash-copy">
          <span className="vocab-streak-flash-tier">{STREAK_TIER_LABEL[tier]}</span>
          <h2 className="vocab-streak-flash-title" id={`${uid}-title`}>
            {badge?.title ?? `Chuỗi ${days} ngày liên tiếp!`}
          </h2>
          <p className="vocab-streak-flash-caption" id={`${uid}-blurb`}>
            {badge?.blurb ?? streakBlurb(days)}
          </p>
          <button
            type="button"
            className="vocab-streak-flash-cta"
            onClick={(e) => {
              e.stopPropagation();
              leave();
            }}
          >
            Tiếp tục
          </button>
        </div>
      </div>

      <div className="vocab-streak-flash-timer" aria-hidden="true" />
    </div>
  );
}
