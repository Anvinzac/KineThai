/**
 * Regression guard for the Han (Chinese) packed-line layout.
 *
 * A sample Chinese sentence carries no spaces, so whitespace tokenizing used to leave
 * the whole usage sentence as ONE unbreakable token — a single shrunken line. Han pages
 * must instead pack through the Vietnamese staggered-line renderer: per-character
 * tokens, punctuation never opening a line, several indented lines filling the scene,
 * and the solo reveal still pinned to exactly one line.
 *
 * Usage: npx tsx scripts/check-han-line-break.ts
 * Depends on: ../src/features/kinetic-text (Han lines + emphasis keys),
 *             ../src/features/post-player/components/WordSequenceText
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_CANVAS } from "../src/features/canvas";
import {
  getEmphasisPhraseKeysForLayout,
  getHanCharBudgetForLine,
  getHanLayoutMetrics,
  getHanTokens,
  getVietnameseCanvasInnerWidth,
  isLikelyChineseText,
} from "../src/features/kinetic-text";
import { WordSequenceText } from "../src/features/post-player/components/WordSequenceText";

const sentence = "搬到新城市后，他觉得很_____。";

// ── 1. Script detection boundaries ──────────────────────────────────────────
assert.equal(isLikelyChineseText(sentence), true, "a Chinese sample sentence is Chinese");
assert.equal(isLikelyChineseText("我去銀行看看。"), true, "traditional Han too");
assert.equal(
  isLikelyChineseText("Những buổi chiều mùa thu gió thổi nhè nhẹ."),
  false,
  "Vietnamese is not Chinese",
);
assert.equal(isLikelyChineseText("resilient"), false, "English is not Chinese");
assert.equal(isLikelyChineseText("Gồm 2 chữ Hán, bắt đầu bằng J"), false, "a Vi clue stays Vi");
assert.equal(isLikelyChineseText("看看"), true, "two glyphs are enough to pack");
assert.equal(isLikelyChineseText("水"), false, "a lone glyph never flips a Latin page");

// ── 2. Tokenization: one glyph per token, punctuation glued, blanks whole ────
const tokens = getHanTokens(sentence);
assert.equal(tokens.join(""), sentence.replace(/\s+/g, ""), "tokens reconstruct the text");
assert.equal(
  tokens.some((token) => /^[，。！？、；：]/.test(token)),
  false,
  "no token opens with closing punctuation, so no line can start with it",
);
assert(
  tokens.some((token) => token.includes("_____")),
  "a masked blank stays one whole token like the Vietnamese pages treat it",
);
assert.equal(tokens[5], "后，", "clause punctuation rides the glyph before it");

// ── 3. Packing: many short staggered lines, Vietnamese cascade ───────────────
const canvasWidth = 390;
const fontSize = 64;
const { lines, suggestedFitScale } = getHanLayoutMetrics(tokens, canvasWidth, fontSize);
assert(lines.length >= 3, `a 11-token sentence breaks into many lines (got ${lines.length})`);
assert.deepEqual(
  lines.map((line) => line.indentEm),
  lines.map((_line, index) => [0, 0.22, 0.38, 0.5][Math.min(index, 3)]),
  "Han pages take the exact Vietnamese indent cascade",
);
const inner = getVietnameseCanvasInnerWidth(canvasWidth);
for (let index = 0; index < lines.length; index += 1) {
  const visible =
    lines[index].segments.reduce(
      (total, segment) => total + segment.words.reduce((n, word) => n + word.text.length, 0),
      0,
    ) + Math.max(0, lines[index].segments.length - 1);
  const capacity = getHanCharBudgetForLine(index, inner, fontSize);
  assert(
    visible <= capacity + 6,
    `line ${index} stays within the packer's widest forced reach (${visible} <= ${capacity} + 6)`,
  );
}
assert(suggestedFitScale > 0 && suggestedFitScale <= 1, "fit scale is a shrink, never a guess");

// ── 4. Data-annotated Han phrases bind like Vietnamese compounds ─────────────
const phraseKeys = getEmphasisPhraseKeysForLayout(["诚实"]);
assert.deepEqual(phraseKeys, [["诚", "实"]], "a Han annotation splits per glyph");
const honestLines = getHanLayoutMetrics(
  getHanTokens("她敢站出来说话，真诚实。"),
  canvasWidth,
  fontSize,
  1,
  phraseKeys,
).lines;
const glued = honestLines.some((line) =>
  line.segments.some(
    (segment) =>
      segment.words.some((word) => word.text.startsWith("诚")) &&
      segment.words.some((word) => word.text.startsWith("实")),
  ),
);
assert(glued, "an annotated Han word never straddles two lines");

// ── 5. The renderer really draws packed lines for a Han page ─────────────────
const hanMarkup = renderToStaticMarkup(
  createElement(WordSequenceText, {
    spec: { ...DEFAULT_CANVAS, text: sentence, size: 64 },
    playKey: 0,
    paused: true,
    revealed: true,
    canvasWidth,
  }),
);
const renderedLines = (hanMarkup.match(/data-kinetic-line=""/g) ?? []).length;
assert(
  renderedLines === lines.length,
  `WordSequenceText draws every packed Han line (${renderedLines} vs ${lines.length})`,
);
assert(
  hanMarkup.includes("line-height:1.04"),
  "Han pages take the Vietnamese tight leading, not the Latin 0.9",
);
assert.equal(
  (hanMarkup.match(/data-kinetic-word-index=/g) ?? []).length,
  tokens.length,
  "every Han glyph lands as its own animated word",
);

// ── 6. A Han reveal stays a solo single-line unit ────────────────────────────
const revealMarkup = renderToStaticMarkup(
  createElement(WordSequenceText, {
    spec: { ...DEFAULT_CANVAS, text: "银行", size: 96 },
    fitAsUnit: true,
    playKey: 0,
    paused: true,
    revealed: true,
    canvasWidth,
  }),
);
assert(!revealMarkup.includes("data-kinetic-line"), "a solo reveal is never packed into lines");
assert(revealMarkup.includes("flex-wrap:nowrap"), "a solo reveal is pinned to one line");
assert.equal(
  (revealMarkup.match(/data-kinetic-word-index=/g) ?? []).length,
  1,
  "the revealed word remains one intact unit",
);

console.log(`OK — Han sentence "${sentence}" packs into ${lines.length} staggered lines.`);
console.log("All hanzi-line-break checks passed.");
