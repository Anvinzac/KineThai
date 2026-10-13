/**
 * Assert the Chinese feed's ambient pool is real, reachable only from the zh scope,
 * and unreachable from the default feed — the seam added with ZH_AMBIENT_SOURCES.
 *
 * The bug class this locks in is POOL LEAKAGE: a scoped pool is only as good as every
 * path that can hand a track to the player, so the guard asserts both runtime routing
 * (play / next / tier-exhaustion / setSources under each scope, against a fake Audio)
 * and the source-level guards (the zh branch in the pool getter, the zh stop in
 * switchPool, the zh guards in setSources and refreshRemoteTracks, and the two call
 * sites that bind the scope from the visited host's locale).
 *
 * Usage: npm run check:ambient-zh
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  AMBIENT_SOURCES,
  FALLBACK_SOURCES,
  ZH_AMBIENT_SOURCES,
  getAmbientPlayer,
} from "../src/features/vocabulary/lib/ambient.ts";

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string => readFileSync(join(here, "..", relative), "utf8");

const failures: string[] = [];
const rows: string[] = [];

function check(name: string, pass: boolean): void {
  rows.push(`${pass ? "PASS" : "FAIL"}  ${name}`);
  if (!pass) failures.push(name);
}

// A minimal HTMLAudioElement stand-in: the player only needs pause/play/load/src.
class FakeAudio {
  src: string | null = "unset";
  paused = true;
  volume = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  addEventListener(): void {}
  removeEventListener(): void {}
  play(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  load(): void {}
  removeAttribute(name: string): void {
    if (name === "src") this.src = null;
  }
}

async function main(): Promise<void> {
  // --- 1. The zh pool itself: big enough to rotate, and every entry a direct MP3 ---
  check(
    `zh pool holds at least 10 tracks (has ${ZH_AMBIENT_SOURCES.length})`,
    ZH_AMBIENT_SOURCES.length >= 10,
  );
  check(
    "every zh track is an https .mp3 on upload.wikimedia.org",
    ZH_AMBIENT_SOURCES.every(
      (source) =>
        source.url.startsWith("https://upload.wikimedia.org/") && source.url.endsWith(".mp3"),
    ),
  );
  check(
    "every zh track carries a display name and a tempo",
    ZH_AMBIENT_SOURCES.every((source) => source.name.trim().length > 0 && source.bpm > 0),
  );
  check(
    "no duplicate URLs inside the zh pool",
    new Set(ZH_AMBIENT_SOURCES.map((source) => source.url)).size === ZH_AMBIENT_SOURCES.length,
  );

  // --- 2. Disjointness: neither default tier contains a Chinese track ---
  const zhUrls = new Set(ZH_AMBIENT_SOURCES.map((source) => source.url));
  check(
    "no zh URL appears in the hardcoded fallback tier",
    !FALLBACK_SOURCES.some((source) => zhUrls.has(source.url)),
  );
  check(
    "no zh URL appears in the swappable primary tier",
    !AMBIENT_SOURCES.some((source) => zhUrls.has(source.url)),
  );
  check(
    "no default-tier URL appears in the zh pool",
    !ZH_AMBIENT_SOURCES.some((source) =>
      [...FALLBACK_SOURCES, ...AMBIENT_SOURCES].some((other) => other.url === source.url),
    ),
  );

  // --- 3. Runtime routing under a fake Audio element ---
  (globalThis as unknown as { Audio: unknown }).Audio = FakeAudio;
  const player = getAmbientPlayer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internals = player as any;

  player.play();
  const defaultUrl = internals.pool[internals.sourceIndex]?.url as string | undefined;
  check("default scope plays from the default tiers", !!defaultUrl && !zhUrls.has(defaultUrl));

  player.setScope("zh");
  check("setScope to zh silences a track from the old family", player.currentSource === null);

  player.play();
  check(
    "zh scope plays only Chinese tracks",
    !!player.currentSource && zhUrls.has(internals.pool[internals.sourceIndex]?.url),
  );

  // Rotation must stay inside the family it started in.
  let stayedInZh = true;
  for (let step = 0; step < ZH_AMBIENT_SOURCES.length + 2; step += 1) {
    player.next();
    if (!zhUrls.has(internals.pool[internals.sourceIndex]?.url)) stayedInZh = false;
  }
  check("error-skip rotation never leaves the zh pool", stayedInZh);

  // Exhausting the zh pool must go silent, not borrow the default tiers.
  internals.consecutiveErrors = ZH_AMBIENT_SOURCES.length;
  internals.onError();
  check(
    "an exhausted zh pool stops instead of falling back to default music",
    player.currentSource === null && internals.usingFallback === false,
  );

  // Admin DB tracks are the main feed's tier; under zh they must be refused.
  player.play();
  player.setSources([{ url: "https://example.invalid/admin-track.mp3", name: "admin", bpm: 100 }]);
  check(
    "setSources is refused while scoped to zh",
    !internals.pool.some(
      (source: { url: string }) => source.url === "https://example.invalid/admin-track.mp3",
    ),
  );
  player.setScope("default");
  player.setSources([{ url: "https://example.invalid/admin-track.mp3", name: "admin", bpm: 100 }]);
  check(
    "setSources still applies once back in the default scope",
    internals.pool.some(
      (source: { url: string }) => source.url === "https://example.invalid/admin-track.mp3",
    ),
  );
  player.stop();
  player.forceReleaseForReload();

  // --- 4. Source-level guards: the seams a refactor would silently drop ---
  const ambientSrc = read("src/features/vocabulary/lib/ambient.ts");
  check(
    "source: the pool getter routes zh to ZH_AMBIENT_SOURCES",
    ambientSrc.includes('if (this.scope === "zh") return ZH_AMBIENT_SOURCES;'),
  );
  check(
    "source: switchPool stops under zh instead of flipping tiers",
    /private switchPool\(\): void \{\s*if \(this\.scope === "zh"\) \{\s*this\.stop\(\);/.test(
      ambientSrc,
    ),
  );
  check(
    "source: setSources guards the zh scope",
    /setSources\(sources: AudioSource\[\]\): void \{\s*if \(this\.scope === "zh"\) return;/.test(
      ambientSrc,
    ),
  );
  check(
    "source: refreshRemoteTracks never fetches for the zh scope",
    ambientSrc.includes('if (getAmbientPlayer().currentScope === "zh") return;'),
  );

  const hookSrc = read("src/features/vocabulary/hooks/useAmbientSound.ts");
  check(
    "source: the hook takes a scope and binds it before any play decision",
    hookSrc.includes('export function useAmbientSound(\n  scope: AmbientScope = "default",') &&
      hookSrc.indexOf("player.setScope(scope);") > -1 &&
      hookSrc.indexOf("player.setScope(scope);") < hookSrc.indexOf("shouldPlayAmbient("),
  );

  const controlsSrc = read("src/features/vocabulary/components/FeedControls.tsx");
  check(
    "source: FeedControls binds the scope from the visited host's locale",
    // The call now also carries the transport-pause arg, so match the scope argument by
    // its prefix (through the ternary's closing quote) rather than a full one-line call.
    controlsSrc.includes('useAmbientSound(locale === "zh" ? "zh" : "default"'),
  );
}

main()
  .then(() => {
    console.log(rows.join("\n"));
    if (failures.length) {
      console.error(
        `\n${failures.length} ambient zh-pool failure(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`\n${rows.length} ambient zh-pool assertions passed.`);
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
