/**
 * CJK post-reveal coda: draws each Han character stroke-by-stroke (笔顺) so the learner
 * watches the building blocks assemble, instead of popping whole characters the way the
 * Latin letter coda pops letters. Strokes paint in the card's accent colour over a faint
 * ink outline guide, and each character completes left-to-right.
 *
 * Hanzi Writer and the vendored stroke JSON are imported HERE (not in lib/hanzi.ts) on
 * purpose: the card lazy-loads this module only when a Han answer reaches its coda, so
 * neither the library nor the ~130KB dataset ever enters the English feed chunk.
 *
 * Exports: HanziStrokeSpelling
 * Depends on: hanzi-writer, ../data/hanzi-strokes.json, ../lib/hanzi
 */

import { useLayoutEffect, useMemo, useRef } from "react";
import HanziWriter from "hanzi-writer";
import type { CharacterJson, CharDataLoaderFn } from "hanzi-writer";
import strokeData from "../data/hanzi-strokes.json";
import { getStrokeDrawBudgetSeconds, solveStrokeTiming } from "../lib/hanzi";

/** Vendored per-character stroke outlines, keyed by the character itself. */
const STROKES = strokeData as unknown as Record<string, CharacterJson>;

/** A single Han character; the coda renders one writer per character. */
const HAN = /\p{Script=Han}/u;

/** Synchronous loader over the bundled data — no CDN, no network, fully deterministic. */
const charDataLoader: CharDataLoaderFn = (char, _onLoad, onError) => {
  const data = STROKES[char];
  if (data) return data;
  // Coverage is guaranteed at build time (scripts/build-hanzi-strokes.ts + the regression
  // guard); this only fires if a deck ships a character the dataset was not rebuilt for.
  onError(new Error(`No bundled stroke data for "${char}"`));
};

/** Resolve a card-scoped CSS custom property to a concrete rgb() via a throwaway probe. */
function resolveColor(host: HTMLElement, variable: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = `var(${variable})`;
  host.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value || fallback;
}

/** Attach an alpha channel to a computed rgb()/rgba() colour string. */
function withAlpha(rgb: string, alpha: number): string {
  const parts = rgb.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return rgb;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}

/**
 * Draw the answered Han word stroke by stroke.
 * @param props.word Revealed answer (one or more Han characters).
 * @param props.reducedMotion When true, show the finished characters with no animation.
 * @returns Centred stroke-drawing overlay.
 */
export function HanziStrokeSpelling({
  word,
  reducedMotion,
}: {
  word: string;
  reducedMotion: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chars = useMemo(() => Array.from(word).filter((ch) => HAN.test(ch)), [word]);
  const totalStrokes = useMemo(
    () => chars.reduce((sum, ch) => sum + (STROKES[ch]?.strokes.length ?? 0), 0),
    [chars],
  );

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || chars.length === 0) return;
    // Copy the ref once: React may have swapped cellRefs.current by cleanup time.
    const cells = cellRefs.current;
    let cancelled = false;

    const accent = resolveColor(host, "--vocab-accent", "rgb(94, 234, 212)");
    const accentAlt = resolveColor(host, "--vocab-accent-alt", accent);
    const ink = resolveColor(host, "--vocab-ink", "rgb(255, 255, 255)");
    // The card already allotted this coda a fixed draw budget from the character count;
    // split it across the real strokes so the drawing finishes inside the page.
    const timing = solveStrokeTiming(totalStrokes, getStrokeDrawBudgetSeconds(word) * 1000);

    const computeBox = () => {
      const gap = 10;
      const available = host.clientWidth - 32 - gap * (chars.length - 1);
      const per = Math.floor(available / chars.length);
      return Math.max(56, Math.min(200, per > 0 ? per : 160));
    };
    let box = computeBox();
    const pad = () => Math.round(box * 0.06);

    const writers = chars.map((char, index) => {
      const cell = cells[index];
      if (!cell) return null;
      cell.replaceChildren();
      return HanziWriter.create(cell, char, {
        width: box,
        height: box,
        padding: pad(),
        charDataLoader,
        // The drawing process is the accent: strokes paint in it over a faint ink guide.
        strokeColor: accent,
        drawingColor: accent,
        highlightColor: accentAlt,
        outlineColor: withAlpha(ink, 0.18),
        highlightOnComplete: !reducedMotion,
        showOutline: !reducedMotion,
        showCharacter: reducedMotion,
        strokeAnimationSpeed: timing.strokeAnimationSpeed,
        delayBetweenStrokes: timing.delayBetweenStrokes,
      });
    });

    if (!reducedMotion) {
      void (async () => {
        for (let index = 0; index < writers.length; index += 1) {
          if (cancelled) return;
          const writer = writers[index];
          if (!writer) continue;
          await writer.animateCharacter();
          if (cancelled || index === writers.length - 1) return;
          // A short beat between characters so a multi-character word reads as two draws.
          await new Promise((resolve) => setTimeout(resolve, 160));
        }
      })();
    }

    const observer = new ResizeObserver(() => {
      const next = computeBox();
      if (next === box) return;
      box = next;
      for (const writer of writers)
        writer?.updateDimensions({ width: box, height: box, padding: pad() });
    });
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      for (const cell of cells) cell?.replaceChildren();
    };
    // chars/totalStrokes derive from word; box is measured imperatively, not state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, reducedMotion]);

  return (
    <div className="vocab-stroke" ref={hostRef} aria-hidden="true">
      <p className="vocab-spelling-label">Viết lại từng nét</p>
      <p className="sr-only" lang="zh">
        {word}
      </p>
      <div className="vocab-stroke-row" lang="zh">
        {chars.map((char, index) => (
          <div
            key={`${char}-${index}`}
            className="vocab-stroke-char"
            ref={(element) => {
              cellRefs.current[index] = element;
            }}
          />
        ))}
      </div>
    </div>
  );
}
