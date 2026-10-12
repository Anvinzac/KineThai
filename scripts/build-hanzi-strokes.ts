/**
 * Vendor the Han stroke dataset the CJK spelling coda draws from.
 *
 * The coda animates each Chinese answer stroke-by-stroke (笔顺) with Hanzi Writer,
 * which needs per-character outline paths + medians that Unicode alone cannot give.
 * Rather than fetch them from a CDN at runtime, this script scans every deck the feed
 * can serve, collects the Han characters it actually contains, and copies just those
 * characters' stroke data out of `hanzi-writer-data` into one bundled JSON. The result
 * is offline, deterministic and small (only served characters, not the ~9000-char set).
 *
 * Re-run whenever a CJK deck is added or edited:
 *   npx tsx scripts/build-hanzi-strokes.ts
 *
 * Output: src/features/vocabulary/data/hanzi-strokes.json  ({ [char]: { strokes, medians, radStrokes? } })
 * Attribution: stroke outlines derive from Make Me a Hanzi (Arphic Public License) via
 * the hanzi-writer-data package; see docs/cjk-korean-hint-equivalents.md.
 * Depends on: hanzi-writer-data, node:fs, node:path, node:url, node:crypto
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dataDir = resolve(here, "../src/features/vocabulary/data");
const outPath = join(dataDir, "hanzi-strokes.json");

/** A single Han character; Hangul and kana are out of scope for this coda. */
const HAN = /\p{Script=Han}/u;

type StrokeEntry = { strokes: string[]; medians: number[][][]; radStrokes?: number[] };

/** Every .json deck the feed can serve: base catalog, provider packs and each locale folder. */
function collectDecks(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) found.push(...collectDecks(full));
    else if (name.endsWith(".json") && name !== "hanzi-strokes.json") found.push(full);
  }
  return found;
}

const chars = new Set<string>();
for (const file of collectDecks(dataDir)) {
  const deck = JSON.parse(readFileSync(file, "utf8")) as { words?: { word?: string }[] };
  for (const entry of deck.words ?? []) {
    for (const ch of Array.from(entry.word ?? "")) if (HAN.test(ch)) chars.add(ch);
  }
}

const out: Record<string, StrokeEntry> = {};
const missing: string[] = [];
for (const ch of [...chars].sort()) {
  let data: StrokeEntry | undefined;
  try {
    data = require(`hanzi-writer-data/${ch}.json`) as StrokeEntry;
  } catch {
    data = undefined;
  }
  if (!data?.strokes?.length) {
    missing.push(ch);
    continue;
  }
  out[ch] = data.radStrokes
    ? { strokes: data.strokes, medians: data.medians, radStrokes: data.radStrokes }
    : { strokes: data.strokes, medians: data.medians };
}

if (missing.length) {
  console.error(
    `Missing stroke data for ${missing.length} character(s): ${missing.join(" ")}. ` +
      `Install/refresh hanzi-writer-data or drop them from the deck.`,
  );
  process.exitCode = 1;
}

// Atomic write: the previous dataset survives if anything above threw.
const temporary = `${outPath}.${randomUUID()}.tmp`;
writeFileSync(temporary, `${JSON.stringify(out)}\n`);
renameSync(temporary, outPath);
console.log(
  `Wrote ${Object.keys(out).length} Han character(s) → src/features/vocabulary/data/hanzi-strokes.json` +
    (missing.length ? ` (${missing.length} missing, see above)` : ""),
);
