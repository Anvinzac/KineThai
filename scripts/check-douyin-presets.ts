/**
 * Douyin-dialect preset guard: the zh-only palettes must pass the same contrast
 * audit as the main collection WITHOUT repair (authored colors == shipped colors),
 * and the dialect pools must never leak into each other.
 * Run: npx tsx scripts/check-douyin-presets.ts
 */
import assert from "node:assert/strict";
import { auditPalette, ensureReadablePalette, normalizePalette } from "../src/features/canvas";
import {
  DOUYIN_PALETTE_ROWS,
  DOUYIN_STYLES,
  DOUYIN_THEMES,
  STYLES,
  THEMES,
  choosePresentation,
  stylePool,
  themePool,
} from "../src/features/vocabulary/lib/presets";

// ── Palettes: every raw row already passes the audit, so the repair pipeline is
// a no-op and what was designed is what ships. The collection now carries ten
// rows: the original Douyin-tech / 国潮 five plus five Eastern artifact palettes
// (ink-wash, celadon, cinnabar, porcelain, plum).
assert.equal(DOUYIN_PALETTE_ROWS.length, 10, "the Douyin collection ships ten palettes");
for (const row of DOUYIN_PALETTE_ROWS) {
  const audit = auditPalette(row);
  const failed = audit.checks.filter((check) => !check.pass);
  assert.equal(
    failed.length,
    0,
    `${row.id} fails audit: ${failed.map((check) => `${check.id}=${check.value} (need ${check.required})`).join(", ")}`,
  );
  assert.deepEqual(
    ensureReadablePalette(normalizePalette(row)),
    row,
    `${row.id}: repair changed the authored colors — re-tune the row instead of shipping a repair`,
  );
}

// ── Pools: dialects never mix. ────────────────────────────────────────────────
const douyinIds = new Set(DOUYIN_THEMES.map((theme) => theme.id));
assert.equal(themePool("mix", "douyin").length, DOUYIN_THEMES.length);
assert(themePool("mix", "douyin").every((theme) => douyinIds.has(theme.id)));
assert(
  themePool("mix").every((theme) => !douyinIds.has(theme.id)),
  "the default pool must never rotate into a Douyin palette",
);
assert(
  themePool("mix", "douyin").every((theme) => THEMES.every((other) => other.id !== theme.id)),
  "Douyin themes must not exist in the default collection",
);
// A stale allow-list picked from the other pool falls back to the full dialect pool.
assert.deepEqual(
  themePool("midnight-magenta,deep-lagoon", "douyin").map((theme) => theme.id),
  [...douyinIds],
);
// A mixed allow-list keeps only the ids that exist in the dialect's collection.
assert.deepEqual(
  themePool("douyin-neon,midnight-magenta", "douyin").map((theme) => theme.id),
  ["douyin-neon"],
);

// ── Styles: same four ids (deck-authored styles and the Presentation contract
// keep working), Douyin motion, and the pools stay dialect-local. ─────────────
assert.deepEqual(
  DOUYIN_STYLES.map((style) => style.id),
  STYLES.map((style) => style.id),
  "the Douyin pool reuses the four NarrativeStyle ids",
);
assert.equal(stylePool("douyin"), DOUYIN_STYLES);
assert.equal(stylePool("default"), STYLES);
assert.equal(stylePool(undefined), STYLES);
const beatDrop = DOUYIN_STYLES.find((style) => style.id === "speed")!;
assert.equal(beatDrop.entrance, "scale");
assert.equal(beatDrop.loop, "shake");
assert.equal(beatDrop.tempo, "snappy");
assert.equal(beatDrop.rhythm, "burst");

// ── choosePresentation honors the dialect on every rotation. ─────────────────
const validStyles = new Set(STYLES.map((style) => style.id));
for (let i = 0; i < 200; i += 1) {
  const occurrence = `occ-${i}`;
  const douyin = choosePresentation(
    occurrence,
    {
      theme: "mix",
      style: "mix",
      autoplay: true,
      dialect: "douyin",
    },
    i,
  );
  assert(douyinIds.has(douyin.theme.id), `${occurrence}: default theme leaked into a Douyin card`);
  assert(validStyles.has(douyin.style.id));
  // The handwriting surprise belongs to the default dialect only.
  const source = DOUYIN_THEMES.find((theme) => theme.id === douyin.theme.id)!;
  assert.equal(douyin.theme.font, source.font, `${occurrence}: handwriting swap leaked in`);

  const normal = choosePresentation(occurrence, { theme: "mix", style: "mix", autoplay: true }, i);
  assert(!douyinIds.has(normal.theme.id), `${occurrence}: Douyin theme leaked into a default card`);
}
// A locked style id resolves within the dialect's own motion presets.
assert.equal(
  choosePresentation("locked", { theme: "mix", style: "speed", autoplay: true, dialect: "douyin" })
    .style,
  beatDrop,
);

console.log("OK — 10 Douyin palettes pass the contrast audit unrepaired.");
console.log("OK — dialect pools never leak; styles keep the four-id contract.");
console.log("All douyin-presets checks passed.");
