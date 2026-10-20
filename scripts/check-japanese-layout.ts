/**
 * Japanese deck format: the reader strips the display marks, draws 文節 flush, breaks
 * pages only on whole chunks, and treats a chunk edge as a phrase edge in line layout.
 * Run: npx tsx scripts/check-japanese-layout.ts
 */
import assert from "node:assert/strict";
import {
  getJapaneseLayoutMetrics,
  getWords,
  isLikelyJapaneseText,
  solveMeasuredLines,
  type MeasuredLineBounds,
  type MeasuredSegment,
} from "../src/features/kinetic-text";
import {
  paginateJapaneseChunks,
  parseJapaneseMarkup,
  stripJapaneseMarks,
} from "../src/features/vocabulary/lib/ja-text";
import { encodeWordJoiners } from "../src/features/vocabulary/lib/word-joiner";
import { buildStages } from "../src/features/vocabulary/lib/stages";
import { normalizeDeck } from "../src/features/vocabulary/lib/schema";
import type { VocabularyWord } from "../src/features/vocabulary/lib/schema";

// ── Detection: kana is the signal; Vietnamese, English and Chinese never trigger.
assert.equal(isLikelyJapaneseText("目を とじるだけで、"), true);
assert.equal(isLikelyJapaneseText("カタカナ"), true);
assert.equal(isLikelyJapaneseText("Chất lỏng trong suốt"), false);
assert.equal(isLikelyJapaneseText("a quiet morning"), false);
assert.equal(isLikelyJapaneseText("他很诚实。"), false);
console.log("OK — kana marks a Japanese page");

// ── Display: spaces, `_`, `=` and `|` never reach a reader.
const marked = "まだ 見た=ことの ない ものを | 頭の 中で | 思いうかべる=こと。";
assert.equal(stripJapaneseMarks(marked), "まだ見たことのないものを頭の中で思いうかべること。");
// Full-width space and the encoder's stand-in characters are display marks too.
assert.equal(stripJapaneseMarks("まだ\u3000見た\u00a0こと\u2060の"), "まだ見たことの");
console.log("OK — Japanese prose carries no display marks");

// ── Parsing: `_`/`=` join a token; `|` starts a chunk at a token index.
const imagined = parseJapaneseMarkup(marked);
assert.deepEqual(imagined.chunks, [
  ["まだ", "見たことの", "ない", "ものを"],
  ["頭の", "中で"],
  ["思いうかべること。"],
]);
assert.equal(imagined.text, "まだ 見たことの ない ものを 頭の 中で 思いうかべること。");
assert.deepEqual(imagined.phraseEdges, [4, 6]);
assert.deepEqual(parseJapaneseMarkup("気が_付く | 見えて=くる"), {
  text: "気が付く 見えてくる",
  chunks: [["気が付く"], ["見えてくる"]],
  phraseEdges: [1],
});
// A base field has already been through the catalog encoder: its joins are NBSP/WJ,
// which must stay inside the token rather than split it. (The `|` edge is gone there.)
assert.deepEqual(parseJapaneseMarkup(encodeWordJoiners("気が_付く 見えて=くる")).chunks, [
  ["気が付く", "見えてくる"],
]);
console.log("OK — marks are read as tokens and phrase edges");

// ── Pagination: a short field stays whole; a long one splits only between chunks.
const short = parseJapaneseMarkup("どこから | 飛び立つのかな？");
assert.equal(paginateJapaneseChunks(short.chunks, 7).length, 1);

const chunks = [
  ["あ", "い", "う"],
  ["え", "お", "か"],
  ["き", "く", "け"],
  ["さ", "し", "す"],
  ["せ", "そ", "た。"],
];
const pages = paginateJapaneseChunks(chunks, 7);
assert.deepEqual(
  pages.map((page) => getWords(page.text).length),
  [6, 6, 3],
);
assert.deepEqual(pages[0]!.phraseEdges, [3]);
assert.deepEqual(pages[1]!.phraseEdges, [3]);
assert.deepEqual(pages[2]!.phraseEdges, []);
// Reassembling the pages loses nothing, and no page starts inside a chunk.
assert.deepEqual(
  pages.flatMap((page) => getWords(page.text)),
  chunks.flat(),
);
console.log("OK — pages break only on whole chunks");

// ── Metrics: 文節 are packed flush and every token survives in order.
const tokens = ["まだ", "見たことの", "ない", "ものを", "頭の", "中で", "思いうかべること。"];
const layout = getJapaneseLayoutMetrics(tokens, 390, 48);
assert.deepEqual(
  layout.lines.flatMap((line) => line.segments.flatMap((seg) => seg.words.map((w) => w.text))),
  tokens,
);
assert.ok(layout.lines.length >= 2, "a seven-token clue should wrap");
assert.ok(layout.suggestedFitScale <= 1);
console.log("OK — Japanese tokens pack into staggered lines with no gap");

// ── Phrase edges in the solver: a break on the edge wins; zero gap fits one more unit.
function segments(count: number, widthEm = 1): MeasuredSegment[] {
  return Array.from({ length: count }, (_, index) => ({
    segment: { key: String(index), words: [{ text: `t${index}`, index }] },
    widthEm,
    heightEm: 1.25,
  }));
}
const bounds = (gapEm: number): MeasuredLineBounds => ({
  lineWidthPx: 4.1,
  hardHeightPx: 3.2,
  budgetHeightPx: 3.2,
  budgetLineEm: 1.25,
  maxFontPx: 100,
  floorFontPx: 10,
  gapEm,
  lineGapEm: 0,
});
const lengths = (solved: ReturnType<typeof solveMeasuredLines>) =>
  solved ? solved.lines.map((line) => line.segments.length) : [];

// A break one 文節 before the edge would fit three-and-three; the edge itself wins.
assert.deepEqual(lengths(solveMeasuredLines(segments(6), bounds(0), { phraseEdges: [4] })), [4, 2]);
// With the Vietnamese gap the same page only fits three per line, and the edge is there.
assert.deepEqual(
  lengths(solveMeasuredLines(segments(6), bounds(0.24), { phraseEdges: [3] })),
  [3, 3],
);
console.log("OK — a phrase edge is preferred over a break one 文節 away");

// ── End to end: a Japanese-led word (no Vietnamese lead) still builds every clue stage.
const word = {
  id: "airport",
  word: "airport",
  pos: "noun",
  ipa: "/ˈeə.pɔːt/",
  defVi: "Sân bay",
  leadVi: "",
  anticipateVi: "",
  localized: {
    ja: {
      lead: "スーツケースを /引いて 荷物検査を/ 通り、 | 出発ロビーで 待つ。",
      def: chunks.map((chunk) => chunk.join(" ")).join(" | "),
      guess: "どこから | 飛び立つのかな？",
    },
  },
  usage: [],
  emphasis: [],
} as unknown as VocabularyWord;

const stages = buildStages(word, "detective", "ja");
const definitionPages = stages.filter((stage) => stage.id.startsWith("definition"));
assert.equal(definitionPages.length, 3, "a 15-token definition should make three pages");
assert.deepEqual(
  definitionPages.map((page) => page.text.split(/\s+/).length),
  [6, 6, 3],
);
assert.deepEqual(definitionPages[0]!.phraseEdges, [3]);
assert.deepEqual(definitionPages[1]!.phraseEdges, [3]);
for (const page of definitionPages) {
  assert.ok(!/[_=|]/.test(page.text), `display marks leaked: ${page.text}`);
}
assert.ok(
  stages.some((stage) => stage.id.startsWith("lead")),
  "a Japanese-only lead renders",
);
assert.ok(
  stages.some((stage) => stage.id.startsWith("anticipation")),
  "a Japanese-only hook renders",
);
console.log("OK — buildStages carries Japanese pages, chunks and edges");

// ── A flat generated deck (defJa/leadJa/anticipateJa/usageJa/emphasisJa) is lifted
//    into the schema: marks stay on localized.ja for the reader, base fields are clean.
const flatDeck = [
  {
    word: "airport",
    pos: "noun",
    ipa: "/ˈeə.pɔːt/",
    kanjiTier: 1,
    meaningJa: "空港",
    defJa: "飛行機が 飛び立ち、 | 人を 乗せたり | 降ろしたり する 場所。",
    leadJa: "スーツケースを 引いて | 荷物検査を 通り、 | 出発ロビーで 待つ。",
    anticipateJa: "どこから | 飛び立つのかな？",
    usageEn: "We arrived at the _____ two hours early.",
    usageJa: "わたしたちは | 二時間 早く | 空港に 着いた。",
    topics: ["travel"],
    exams: ["toeic"],
    emphasisJa: ["飛び立ち", "荷物検査"],
  },
];
const [flatWord] = normalizeDeck(flatDeck).words;
assert.equal(flatWord!.id, "airport");
assert.equal(flatWord!.defVi, "飛行機が飛び立ち、人を乗せたり降ろしたりする場所。");
assert.equal(
  flatWord!.localized?.ja?.def,
  "飛行機が 飛び立ち、 | 人を 乗せたり | 降ろしたり する 場所。",
);
assert.equal(flatWord!.usage[0]?.vi, "わたしたちは二時間早く空港に着いた。");
assert.equal(flatWord!.usage[0]?.glosses?.ja, "わたしたちは | 二時間 早く | 空港に 着いた。");
assert.deepEqual(flatWord!.emphasis, ["飛び立ち", "荷物検査"]);
const flatStages = buildStages(flatWord!, "detective", "ja");
const flatDefinition = flatStages.find((stage) => stage.id.startsWith("definition"));
assert.deepEqual(flatDefinition?.phraseEdges, [2, 4]);
assert.ok(!/[_=|]/.test(flatDefinition!.text), "flat deck marks leaked into the page");
assert.ok(
  flatStages.some((stage) => stage.id.startsWith("lead")),
  "the flat lead reaches the reader",
);
console.log("OK — a flat generated Japanese deck normalizes and plays");

console.log("\nAll Japanese layout checks passed.");
