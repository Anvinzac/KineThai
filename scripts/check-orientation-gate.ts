/**
 * Orientation gate: the master switch is on, and the gate is mounted exactly where it
 * belongs. The recurring failure is the master constant alone being flipped to `false`
 * for landscape testing and shipped that way; the second is the mount topology drifting.
 *
 * - /feed (VocabularyFeedPage) has its own landscape layout and must NOT mount the gate.
 * - The post-player surfaces only letterbox a 9:16 card, so each must mount it.
 *
 * Set ALLOW_ORIENTATION_GATE_OFF=1 to accept a `false` master on purpose (local testing).
 * Run: npm run check:orientation-gate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const config = read("src/lib/orientation-gate.ts");
const master = /export const ORIENTATION_GATE_ENABLED = (true|false);/.exec(config)?.[1];
assert.ok(master, "ORIENTATION_GATE_ENABLED declaration not found in src/lib/orientation-gate.ts");
if (master === "false" && process.env.ALLOW_ORIENTATION_GATE_OFF !== "1") {
  assert.fail(
    "ORIENTATION_GATE_ENABLED is false — the post-player surfaces would show landscape ungated. " +
      "Restore it to true (or set ALLOW_ORIENTATION_GATE_OFF=1 for a deliberate local run).",
  );
}
console.log(`OK — master switch is ${master}`);

const GATED = [
  "src/features/social/components/FeedPage.tsx",
  "src/features/social/components/PostPermalinkPage.tsx",
  "src/features/profile/components/ProfilePage.tsx",
];
for (const path of GATED) {
  const source = read(path);
  assert.match(source, /useOrientationGate\(\)/, `${path} no longer calls useOrientationGate()`);
  assert.match(source, /<OrientationGate\b/, `${path} no longer renders <OrientationGate>`);
}
console.log(`OK — gate mounted on ${GATED.length} post-player surfaces`);

const feed = read("src/features/vocabulary/components/VocabularyFeedPage.tsx");
assert.doesNotMatch(
  feed,
  /useOrientationGate|<OrientationGate\b/,
  "VocabularyFeedPage mounts the orientation gate again; /feed has its own landscape layout",
);
console.log("OK — /feed is ungated (own landscape layout)");

console.log("\nAll orientation-gate checks passed.");
