/**
 * Compile a WordCrawler deck into the served vocabulary data.
 *
 * Usage:
 *   npm run vocab:import -- <deck.json>                # rewrite the base catalog.json
 *   npm run vocab:import -- <deck.json> --pack <name>  # compile a read-only provider pack
 *                                                      #   → data/packs/<name>.json
 *   npm run vocab:import -- <deck.json> --pack <name> --staged
 *                                                      # compile a pack but keep it OUT of
 *                                                      #   the served feed: → data/packs/incoming/
 *
 * Both modes validate through normalizeDeck (which throws on a duplicate id, a leaked
 * answer or a malformed field) and write atomically via a temp file + rename, so the
 * previous file stays intact if anything fails. The feed merges catalog.json with every
 * data/packs/*.json at load time (lib/catalog-source.ts); packs never overwrite the
 * admin-editable base — on a shared id/headword the base wins.
 *
 * A 0B multi-level Japanese deck (`levels: { JSEC, JHIGH, JCOLL, JPRIM? }`) is split into
 * one flat pack per reader level. With `--pack <stem>`, every level lands as
 * `<stem>-<level>`; `--level <CODE>` imports just that level under the given pack name.
 * Flat decks keep the one-output path above. The generated ids are `<word>-<level>`, so
 * the same English word can keep one card at each level when the feed merges the packs.
 *
 * A `--staged` pack lands in `data/packs/incoming/`, one level below the
 * `data/packs/*.json` glob the loader globs (that pattern is non-recursive), so the words
 * are embedded in the repo and validated but stay invisible to the feed. Moving the file
 * up into `data/packs/` and rebuilding is the whole activation step — no code changes.
 *
 * Every word lands with a share code: a re-imported id keeps the code the deck (or the
 * ledger) already gave it, so a link already in a chat keeps working, and a new id draws
 * a fresh code recorded in data/share-codes.json. Run scripts/assign-share-codes.ts only
 * to repair decks authored before stamping existed.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  JP_LEVELS,
  normalizeDeck,
  splitJapaneseDeck,
  type JapaneseLevel,
} from "../src/features/vocabulary/lib/schema.ts";
import {
  assignShareCodes,
  createCodePool,
  readDecks,
  readLedger,
  writeLedger,
} from "./share-code-store.ts";

const USAGE =
  "Usage: npm run vocab:import -- <WordCrawler JSON path> [--pack <name>] [--locale <zh|ko|ja>] [--level <JPRIM|JSEC|JHIGH|JCOLL>] [--staged]";

// Split off an optional `--pack <name>`; what remains must be exactly one deck path.
const argv = process.argv.slice(2);
// `--staged` is a modifier on `--pack`: write the compiled pack into the non-globbed
// incoming/ folder so it is embedded but not served. Pulled out first so it can't shift
// the `--pack` index below.
const staged = argv.includes("--staged");
if (staged) argv.splice(argv.indexOf("--staged"), 1);
// `--locale <code>` routes a pack into data/<code>/ — a separate deck served only on that
// language's domain (lib/target-language.ts), never merged into the English feed.
const localeAt = argv.indexOf("--locale");
let locale: string | undefined;
if (localeAt !== -1) {
  locale = argv[localeAt + 1];
  argv.splice(localeAt, locale ? 2 : 1);
  if (!locale || !/^(zh|ko|ja)$/.test(locale)) throw new Error("--locale must be zh, ko or ja");
}
// `--level <CODE>` selects one reader level. On a 0B deck it imports that level alone;
// on a flat deck it stamps the level, which is useful for a single-level export.
const levelAt = argv.indexOf("--level");
let requestedLevel: JapaneseLevel | undefined;
if (levelAt !== -1) {
  const rawLevel = argv[levelAt + 1]?.toUpperCase();
  argv.splice(levelAt, rawLevel ? 2 : 1);
  if (!rawLevel || !(JP_LEVELS as readonly string[]).includes(rawLevel)) {
    throw new Error("--level must be JPRIM, JSEC, JHIGH or JCOLL");
  }
  requestedLevel = rawLevel as JapaneseLevel;
}
const packAt = argv.indexOf("--pack");
let packName: string | undefined;
if (packAt !== -1) {
  packName = argv[packAt + 1];
  argv.splice(packAt, packName ? 2 : 1);
}
const source = argv[0];

/** Restrict a pack name to a filesystem-safe slug so a provider name can't escape data/packs. */
function packSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Invalid pack name "${name}"; use letters, digits, - or _`);
  return slug;
}

/** Output path for one compiled deck; the base catalog has no slug. */
function outputPath(slug: string | null): string {
  return fileURLToPath(
    new URL(
      slug
        ? locale
          ? `../src/features/vocabulary/data/${locale}/${slug}.json`
          : `../src/features/vocabulary/data/packs/${staged ? "incoming/" : ""}${slug}.json`
        : "../src/features/vocabulary/data/catalog.json",
      import.meta.url,
    ),
  );
}

/** Stamp one reader level onto every entry of a flat deck. */
function withLevel(input: unknown, level: JapaneseLevel): unknown {
  const root = Array.isArray(input) ? { words: input } : input;
  if (!root || typeof root !== "object") return input;
  const words = (root as { words?: unknown }).words;
  if (!Array.isArray(words)) return input;
  return {
    ...(root as Record<string, unknown>),
    words: words.map((word) =>
      word && typeof word === "object" && !Array.isArray(word)
        ? { ...(word as Record<string, unknown>), level }
        : word,
    ),
  };
}

if (!source || argv.length !== 1 || (packAt !== -1 && !packName)) {
  console.error(USAGE);
  process.exitCode = 1;
} else if (staged && !packName) {
  console.error("--staged only applies with --pack <name>; the base catalog is always served.");
  process.exitCode = 1;
} else {
  try {
    const input = resolve(source);
    if ((await stat(input)).size > 100 * 1024 * 1024)
      throw new Error("Deck exceeds the 100 MiB import limit");
    const parsed = JSON.parse(await readFile(input, "utf8")) as unknown;
    const split = splitJapaneseDeck(parsed);

    // Work out every output before touching a file: nested decks emit one job per level.
    const jobs: { input: unknown; slug: string | null }[] = [];
    if (split) {
      if (requestedLevel) {
        const chosen = split.find((deck) => deck.level === requestedLevel);
        if (!chosen) {
          throw new Error(
            `Deck has no ${requestedLevel} level (found ${split.map((deck) => deck.level).join(", ")})`,
          );
        }
        jobs.push({ input: chosen.input, slug: packName ? packSlug(packName) : null });
      } else {
        if (!packName) {
          throw new Error(
            "A multi-level deck needs --pack <stem> (one pack per level) or --level <LEVEL>.",
          );
        }
        const fullSlug = packSlug(packName);
        const stem = fullSlug.replace(/-(jprim|jsec|jhigh|jcoll)$/i, "") || fullSlug;
        for (const deck of split) {
          jobs.push({ input: deck.input, slug: packSlug(`${stem}-${deck.level}`) });
        }
      }
    } else {
      jobs.push({
        input: requestedLevel ? withLevel(parsed, requestedLevel) : parsed,
        slug: packName ? packSlug(packName) : null,
      });
    }

    const outputs = new Set<string>();
    for (const job of jobs) {
      const output = outputPath(job.slug);
      if (outputs.has(output)) throw new Error(`Two levels would write the same file: ${output}`);
      outputs.add(output);
    }

    // Stamp codes before the revision is computed: they are part of the served deck, and
    // re-importing the same ids must reproduce the same file byte for byte. All levels of
    // one nested deck share the locale's code pool, so their codes stay unique together.
    const deckLocale = locale ?? "en";
    const ledger = readLedger();
    const pool = createCodePool(deckLocale, ledger, readDecks(deckLocale));
    const prepared = jobs.map((job) => {
      const catalog = normalizeDeck(job.input);
      const shares = assignShareCodes(catalog.words, pool);
      const revision = createHash("sha256")
        .update(JSON.stringify(catalog))
        .digest("hex")
        .slice(0, 24);
      return { ...job, catalog, shares, revision, output: outputPath(job.slug) };
    });
    writeLedger(ledger);

    for (const item of prepared) {
      await mkdir(dirname(item.output), { recursive: true });
      // The old file remains intact if validation or writing fails. Rename is atomic here.
      const temporary = `${item.output}.${randomUUID()}.tmp`;
      await writeFile(
        temporary,
        `${JSON.stringify({ revision: item.revision, ...item.catalog }, null, 2)}\n`,
        { flag: "wx" },
      );
      await rename(temporary, item.output);

      const shown = relative(process.cwd(), item.output);
      const shareNote = item.shares
        ? `${item.shares} share code${item.shares === 1 ? "" : "s"} assigned; `
        : "";
      if (item.slug) {
        const stagedNote =
          staged && !locale
            ? "Embedded and validated, but NOT served — move it into data/packs/ and rebuild/restart to display."
            : "Restart dev / rebuild to serve.";
        const prefix = staged && !locale ? "Staged pack" : "Compiled pack";
        console.log(
          `${prefix} "${item.slug}": ${item.catalog.count} words; ${shareNote}revision ${item.revision} → ${shown}. ${stagedNote}`,
        );
      } else {
        console.log(
          `Imported ${item.catalog.count} distinct words; ${shareNote}revision ${item.revision}. Rebuild/deploy to publish.`,
        );
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Vocabulary import failed");
    process.exitCode = 1;
  }
}
