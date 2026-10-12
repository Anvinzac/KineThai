/**
 * Guard: a highlighted group of syllables is dressed in ONE emphasis effect.
 *
 * A Vietnamese compound is written as separate syllables, so each half is its own
 * animated span. The effect is hashed from a seed, and a syllable's seed only names the
 * compound when the pair is in the curated bound-phrase list or carried by a deck
 * annotation. Everything else — a compound the repair glued, two neighbouring picks —
 * used to hash a different effect per half, and the render layer responded by giving up
 * on the run and drawing each syllable its own. That is the defect this file forbids.
 *
 * Run: npx tsx scripts/check-emphasis-runs.ts
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CANVAS } from "../src/features/canvas";
import { VietnameseLineBlock } from "../src/features/kinetic-text/components/VietnameseLineBlock";
import { entranceVariants } from "../src/features/kinetic-text/components/preview-tempo";
import {
  getEmphasisPhraseKeysForLayout,
  getEmphasizedRunPhraseKeys,
  getEmphasisVariant,
  getVietnameseLayoutMetrics,
  isLikelyVietnameseText,
} from "../src/features/kinetic-text";
import { getDataEmphasisWordSpans } from "../src/features/kinetic-text";
import { getWords } from "../src/features/kinetic-text";
import { WordSequenceLines } from "../src/features/post-player/components/WordSequenceLines";
import { getEmphasizedWordIndexes } from "../src/features/post-player/lib/feed-emphasis";
import {
  RUN_LEVEL_VARIANTS,
  getRunEmphasis,
  resolveWordEmphasisVariant,
} from "../src/features/post-player/lib/emphasis-variant";
import { buildStages } from "../src/features/vocabulary/lib/stages";
import type { VocabularyWord } from "../src/features/vocabulary/lib/schema";
import catalog from "../src/features/vocabulary/data/catalog.json";

const EMPHASIS_COLOR = "#06FFA5";
const checks: string[] = [];

function check(name: string, pass: boolean) {
  checks.push(`${pass ? "OK  " : "FAIL"} ${name}`);
  if (!pass) process.exitCode = 1;
}

/** Contiguous highlighted tokens, broken by anything without a letter or number. */
function runsOf(indexes: Set<number>, words: string[]): number[][] {
  const hasGlyph = (word: string) => /\p{L}|\p{N}/u.test(word);
  const runs: number[][] = [];
  let run: number[] = [];
  for (let index = 0; index < words.length; index += 1) {
    if (indexes.has(index) && hasGlyph(words[index] ?? "")) run.push(index);
    else {
      if (run.length >= 2) runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/** Exactly what WordSequenceText feeds the layout and styling helpers. */
function pageKeys(words: string[], emphasized: Set<number>, dataEmphasis?: string[]) {
  return [
    ...getEmphasisPhraseKeysForLayout(dataEmphasis),
    ...getEmphasizedRunPhraseKeys(words, emphasized),
  ];
}

// ── 1. The run-key helper itself ───────────────────────────────────────────────
{
  const words = ["Cuộc", "trò", "chuyện", "hai", "bên"];
  const keys = getEmphasizedRunPhraseKeys(words, new Set([1, 2]));
  check("a run of two becomes one bound phrase key", JSON.stringify(keys) === '[["trò","chuyện"]]');

  const broken = getEmphasizedRunPhraseKeys(["im", "_____", "lặng"], new Set([0, 1, 2]));
  check("a glyph-less token breaks a run instead of joining it", broken.length === 0);

  const lone = getEmphasizedRunPhraseKeys(["một", " mình", "đơn"], new Set([0]));
  check("a lone highlighted token files no run", lone.length === 0);

  const joined = getEmphasizedRunPhraseKeys(["dễ", "hiểu."], new Set([0, 1]));
  check(
    "run keys strip boundary punctuation like every other phrase key",
    JSON.stringify(joined) === '[["dễ","hiểu"]]',
  );
}

// ── 2. A known compound keeps the effect it already had ────────────────────────
{
  const words = ["Đây", "là", "ý", "tưởng", "chung"];
  const text = words.join(" ");
  const emphasized = new Set([2, 3]);
  const keys = getEmphasizedRunPhraseKeys(words, emphasized);
  const perSyllable = [2, 3].map((index) =>
    getEmphasisVariant(
      text,
      // With no run keys of its own the pair still matches the curated list.
      words.slice(2, 4).join(" "),
      2,
      true,
    ),
  );
  const run = getRunEmphasis([2, 3], {
    words,
    text,
    emphasized,
    phraseKeys: keys,
    emphasisColor: EMPHASIS_COLOR,
  });
  check(
    "a curated compound resolves to the same effect the syllables already agreed on",
    run !== null && run.style === perSyllable[0] && perSyllable[0] === perSyllable[1],
  );
}

// ── 3. An unlisted compound that used to disagree is now one effect ────────────
{
  const words = ["Cuộc", "trò", "chuyện", "hai", "bên"];
  const text = words.join(" ");
  const emphasized = new Set([1, 2]);
  // Prove the case is non-vacuous: seeded from each syllable alone, the halves differ.
  const naive = [1, 2].map((index) => getEmphasisVariant(text, words[index]!, index, true));
  check(
    "the chosen pair really does hash two different effects per syllable",
    naive[0] !== naive[1],
  );

  const run = getRunEmphasis([1, 2], {
    words,
    text,
    emphasized,
    phraseKeys: getEmphasizedRunPhraseKeys(words, emphasized),
    emphasisColor: EMPHASIS_COLOR,
  });
  const after = [1, 2].map((index) =>
    resolveWordEmphasisVariant({
      word: words[index]!,
      index,
      words,
      text,
      emphasized,
      phraseKeys: getEmphasizedRunPhraseKeys(words, emphasized),
      emphasisColor: EMPHASIS_COLOR,
      inRun: true,
    }),
  );
  check(
    "the run settles on one effect and lifts only an effect that moves",
    run !== null &&
      run.lift === (RUN_LEVEL_VARIANTS.includes(run.style) ? run.style : null) &&
      run.style === after[0],
  );
  check(
    "once filed as a phrase, the syllables agree on it",
    after[0] !== null && after[0] === after[1],
  );
}

// ── 4. Every Vietnamese page of the shipped deck ──────────────────────────────
{
  const entries = (catalog as unknown as { words: VocabularyWord[] }).words;
  let runs = 0;
  let disagreeing = 0;
  let splitAcrossLines = 0;
  const offenders: string[] = [];

  for (const entry of entries) {
    for (const stage of buildStages(entry, "minimal")) {
      const text = stage.text;
      if (!text || !isLikelyVietnameseText(text)) continue;
      const words = getWords(text);
      const emphasized = getEmphasizedWordIndexes(words, stage.dataEmphasis);
      const secondary = stage.secondaryEmphasis;
      const secondaryEmphasized = secondary
        ? new Set(
            getDataEmphasisWordSpans(words, [secondary.phrase]).flatMap((span) =>
              Array.from({ length: span.length }, (_, offset) => span.start + offset),
            ),
          )
        : undefined;
      const keys = pageKeys(words, emphasized, stage.dataEmphasis);

      for (const run of runsOf(emphasized, words)) {
        runs += 1;
        const styles = run.map((index) =>
          resolveWordEmphasisVariant({
            word: words[index] ?? "",
            index,
            words,
            text,
            emphasized,
            phraseKeys: keys,
            secondaryEmphasized,
            secondaryVariant: secondary?.variant,
            emphasisColor: EMPHASIS_COLOR,
            inRun: true,
          }),
        );
        if (new Set(styles).size > 1) {
          disagreeing += 1;
          offenders.push(`${entry.id}/${stage.id}: ${JSON.stringify(styles)}`);
        }

        // A run split over two lines would never be drawn as one group at all.
        const lines = getVietnameseLayoutMetrics(words, 390, 64, 1, keys).lines;
        for (const line of lines) {
          for (const segment of line.segments) {
            const inSegment = run.filter((index) =>
              segment.words.some((word) => word.index === index),
            );
            if (inSegment.length > 0 && inSegment.length < run.length) splitAcrossLines += 1;
          }
        }
      }
    }
  }

  check(
    `every highlighted run of the deck agrees on one effect (${runs} runs, ${disagreeing} bad)`,
    disagreeing === 0,
  );
  check(`no highlighted run is packed apart (${splitAcrossLines} split)`, splitAcrossLines === 0);
  if (offenders.length) console.error(offenders.join("\n"));
}

// ── 5. Both renderers draw the group with a single effect ─────────────────────
{
  const words = ["Cuộc", "trò", "chuyện", "hai", "bên"];
  const spec = { ...DEFAULT_CANVAS, text: words.join(" "), size: 64 };
  const emphasized = new Set([1, 2]);
  const keys = getEmphasizedRunPhraseKeys(words, emphasized);
  const lines = getVietnameseLayoutMetrics(words, 390, 64, 1, keys).lines;
  const shared = {
    spec,
    words,
    emphasized,
    phraseKeys: keys,
    paused: true,
    textColor: "#ffffff",
    emphasisColor: EMPHASIS_COLOR,
  };

  const effectNames = (markup: string) =>
    new Set([...markup.matchAll(/kinetic-emph-([a-z]+)/g)].map((match) => match[1]));

  const feed = renderToStaticMarkup(
    createElement(WordSequenceLines, {
      ...shared,
      isVietnamese: true,
      vietnameseLines: lines,
      spotlightEmphasis: false,
      staticRender: true,
      isSolo: false,
      soloInlineScale: 1,
      leftAnchoredText: true,
      entranceStyle: "rise",
    }),
  );
  const preview = renderToStaticMarkup(
    createElement(VietnameseLineBlock, {
      ...shared,
      lines,
      playKey: 0,
      wordVariants: entranceVariants("slide", "stagger"),
      tempo: { duration: 0.5 },
      staticLayout: true,
    }),
  );

  for (const [name, markup] of [
    ["feed", feed],
    ["preview", preview],
  ] as const) {
    const effects = effectNames(markup);
    check(
      `${name}: one effect across the run (${[...effects].join(",") || "lifted overlay"})`,
      effects.size <= 1,
    );
    check(
      `${name}: the group shares one wrapper, not two boxes`,
      markup.includes('class="inline-flex relative"'),
    );
    check(`${name}: a grouped run never draws a frame box`, !markup.includes("kinetic-emph-frame"));
    assert.equal((markup.match(/data-kinetic-word-index=/g) ?? []).length, words.length);
  }
  check(
    "the feed lifts a moving effect onto the run exactly once",
    (feed.match(/data-kinetic-run=/g) ?? []).length <= 1,
  );
}

// ── 6. A page with an answer blank never underlines a word ─────────────────────
// The card draws the blank as a slot with its own baseline bar; an underlined
// neighbour lands a few px from it and the two read as one tangled stroke.
{
  const underlinesOn = (words: string[]) => {
    const text = words.join(" ");
    let underlines = 0;
    for (let index = 0; index < words.length; index += 1) {
      for (const color of [EMPHASIS_COLOR, "#3a0ca3"]) {
        const shared = { words, text, emphasized: new Set([index]), emphasisColor: color };
        const lone = resolveWordEmphasisVariant({ ...shared, word: words[index]!, index, inRun: false });
        const boxless = resolveWordEmphasisVariant({
          ...shared,
          word: words[index]!,
          index,
          inRun: false,
          allowFrame: false,
        });
        if (lone === "underline" || boxless === "underline") underlines += 1;
        if (index + 1 < words.length) {
          const pair = new Set([index, index + 1]);
          const run = getRunEmphasis([index, index + 1], { ...shared, emphasized: pair });
          if (run?.style === "underline") underlines += 1;
        }
      }
    }
    return underlines;
  };
  const sentences = [
    "She proved more _____ than anyone expected.",
    "Cô ấy luôn _____ trước mọi thử thách khó khăn.",
    "He spoke with a calm _____, even under pressure.",
    "Đừng _____ quá sớm khi kết quả chưa rõ ràng.",
    "我们 都 很 _____ 。",
  ].map((sentence) => sentence.split(" "));
  check(
    "without a blank the same pages do pick underlines (non-vacuous)",
    sentences.some((words) => underlinesOn(words.filter((word) => !word.includes("_"))) > 0),
  );
  check(
    "a page carrying a blank resolves no word or run to an underline",
    sentences.every((words) => underlinesOn(words) === 0),
  );

  const entries = (catalog as unknown as { words: VocabularyWord[] }).words;
  let blankPages = 0;
  let offending = 0;
  for (const entry of entries) {
    for (const stage of buildStages(entry, "minimal")) {
      if (!stage.text || !/_{2,}/.test(stage.text)) continue;
      blankPages += 1;
      const words = getWords(stage.text);
      const emphasized = getEmphasizedWordIndexes(words, stage.dataEmphasis);
      for (const index of emphasized) {
        const variant = resolveWordEmphasisVariant({
          word: words[index] ?? "",
          index,
          words,
          text: stage.text,
          emphasized,
          emphasisColor: EMPHASIS_COLOR,
          inRun: false,
          allowFrame: false,
        });
        if (variant === "underline") offending += 1;
      }
    }
  }
  check(
    `no deck page with a blank underlines a word (${blankPages} pages, ${offending} bad)`,
    blankPages > 0 && offending === 0,
  );
}

console.log(checks.join("\n"));
if (process.exitCode) {
  console.error("\nemphasis run guard FAILED");
} else {
  console.log(`\n${checks.length} emphasis run assertions passed`);
}
