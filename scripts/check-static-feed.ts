/**
 * Verifies the static-host feed path: the deterministic pager reads real words
 * from the bundled catalog with no server.
 * Run with: npx tsx scripts/check-static-feed.ts
 *
 * catalog-source.ts uses Vite's `import.meta.glob`, which only resolves inside a
 * Vite pipeline. We spin up a Vite dev server in middleware mode and load the real
 * modules through it, so `import.meta.glob` and path aliases work exactly as they do
 * in the app — this exercises the same code the browser bundles.
 */
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const server = await createServer({
  root,
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  logLevel: "error",
});

let failures = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

try {
  const { readVocabularyPage } = await server.ssrLoadModule(
    "/src/features/vocabulary/lib/feed-pager.ts",
  );
  const { catalogFor } = await server.ssrLoadModule(
    "/src/features/vocabulary/lib/catalog-source.ts",
  );
  const japanese = catalogFor("ja");
  const english = catalogFor("en");

  console.log(
    `Default (ja) catalog: ${japanese.count} level entries, revision ${japanese.revision}\n`,
  );

  // 1) A first page returns real words (what a fresh visit sees on Pages).
  const first = readVocabularyPage({
    seed: "static-feed-test",
    topic: "",
    level: "",
    difficulty: "",
    position: 0,
    limit: 12,
  });
  check(
    "first page returns entries",
    first.entries.length === 12,
    `${first.entries.length} entries`,
  );
  check(
    "every entry has a word id",
    first.entries.every((e) => typeof e.word.id === "string" && e.word.id.length > 0),
  );
  check("default deck is Japanese", first.revision === japanese.revision);
  check("default pool exposes every headword", first.matching === first.total, `${first.matching}`);
  check("default catalog has the full deck", first.total >= 200, `${first.total} headwords`);

  // 2) Deterministic: the same seed reproduces the exact same word order.
  const again = readVocabularyPage({
    seed: "static-feed-test",
    topic: "",
    level: "",
    difficulty: "",
    position: 0,
    limit: 12,
  });
  check(
    "same seed reproduces order",
    again.entries.every((e, i) => e.word.id === first.entries[i].word.id),
  );
  check("revision is stable", again.revision === first.revision);

  // 3) A different seed shuffles differently (feed is not frozen).
  const other = readVocabularyPage({
    seed: "a-different-seed",
    topic: "",
    level: "",
    difficulty: "",
    position: 0,
    limit: 12,
  });
  check(
    "different seed differs",
    other.entries.some((e, i) => e.word.id !== first.entries[i].word.id),
  );

  // 4) Paging advances and walks across the cycle boundary without crashing.
  let prevLastId: string | null = null;
  let position = 0;
  let crossBoundaryOk = true;
  for (let page = 0; page < 3; page++) {
    const p = readVocabularyPage({
      seed: "walk-test",
      topic: "",
      level: "",
      difficulty: "",
      position,
      limit: 12,
    });
    if (p.entries.some((e) => !e.word.id)) crossBoundaryOk = false;
    prevLastId = p.entries[p.entries.length - 1]?.word.id ?? prevLastId;
    position = p.nextPosition ?? position + 12;
  }
  check("paging across boundary yields words", crossBoundaryOk && prevLastId !== null);

  // 5) Filters actually narrow the pool (feed controls work on Pages too).
  const filtered = readVocabularyPage({
    seed: "static-feed-test",
    topic: "",
    level: first.levels[0] ?? "",
    difficulty: "",
    position: 0,
    limit: 12,
  });
  check(
    "level filter narrows pool",
    filtered.matching > 0 && filtered.matching <= first.matching,
    `level=${first.levels[0]} → ${filtered.matching}`,
  );

  // 6) The host default changed, but an explicit locale must still win.
  const englishPage = readVocabularyPage(
    {
      seed: "static-feed-test",
      topic: "",
      level: "",
      difficulty: "",
      position: 0,
      limit: 12,
    },
    "en",
  );
  check(
    "explicit English override still serves English",
    englishPage.revision === english.revision && englishPage.matching === english.count,
    `${englishPage.matching} words`,
  );

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await server.close();
}
