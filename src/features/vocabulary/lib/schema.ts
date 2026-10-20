/** WordCrawler validation and normalized catalog contract. Exports: schemas/types, normalizeDeck. Depends on: zod, ja-text. */
import { z } from "zod";
import { parseJapaneseMarkup, stripJapaneseMarks } from "./ja-text";
import type { TargetLocale } from "./target-language";

/** CEFR levels — used by the English (and ko/ja) vocabulary pages. */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
/** HSK 3.0 (2021) proficiency levels — the official Chinese word-frequency standard for the hoa domain. */
export const HSK_LEVELS = [
  "HSK1",
  "HSK2",
  "HSK3",
  "HSK4",
  "HSK5",
  "HSK6",
  "HSK7",
  "HSK8",
  "HSK9",
] as const;
/** Master enum accepted by the word schema; covers both proficiency systems. */
export const LEVELS = [...CEFR_LEVELS, ...HSK_LEVELS] as const;
export const STYLE_IDS = ["detective", "speed", "confession", "minimal"] as const;
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
/** The localized leading phrases for one locale (lead / meaning / guess). */
const localizedWord = z.object({
  lead: z.string().trim().max(400).optional(),
  def: z.string().trim().min(2).max(400),
  guess: z.string().trim().max(400).optional(),
});
/** A map of locale code → trimmed localized string (used for usage glosses). */
const localizedText = () =>
  z.record(z.enum(["vi", "th", "zh", "ko", "ja", "fil"]), z.string().trim().max(400)).optional();
/** A grouping-axis value: lowercase slug, no spaces, so it is safe in a URL filter. */
const taxonomySlug = (max: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(max)
    .regex(/^[a-z0-9-]+$/);
// Crawler-produced Vietnamese emphasis annotations (deck field `emphasis`, converted
// from the crawler's internal emphasisVi). Meaningful phrases only: trimmed,
// letter-bearing, short enough to be a compound phrase rather than a sentence.
const emphasisPhrase = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((phrase) => /\p{L}/u.test(phrase), "Emphasis phrases must contain letters")
  .refine(
    (phrase) => phrase.split(/\s+/).filter(Boolean).length <= 6,
    "Emphasis phrases must be at most 6 words",
  );
const wordSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  word: z
    .string()
    .trim()
    .min(1)
    .max(64)
    // An English headword (2+ chars, letters with inner ' or -) or a Chinese one
    // (one or more Han characters) for a locale deck served on its own domain.
    .regex(/^(?:(?=.{2})[a-zA-Z]+(?:['’-][a-zA-Z]+)*|\p{Script=Han}+)$/u),
  /**
   * The short handle used to share this word as a challenge (`/w/K7F`). Assigned
   * once by scripts/assign-share-codes.ts and then permanent: codes escape into
   * chat threads and must keep meaning the same word forever. Optional on the
   * type so a deck authored before codes existed still parses; check:share-codes
   * is what requires every PUBLISHED word to carry one.
   */
  shareCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-HJKMNP-TV-Z]{3}$/)
    .optional(),
  defVi: z.string().trim().min(2).max(400),
  leadVi: optionalText(240),
  anticipateVi: optionalText(180),
  /** Per-locale overlays for the leading phrases. `vi` is the base (the `*Vi` fields
   * above); any other locale here is preferred over the base when selected. Adding a
   * language is data-only — populate this and a label set in i18n.ts. */
  localized: z.record(z.enum(["vi", "th", "zh", "ko", "ja", "fil"]), localizedWord).optional(),
  emphasis: z.array(emphasisPhrase).max(6).optional(),
  pos: optionalText(40),
  ipa: optionalText(120),
  topic: z
    .string()
    .trim()
    .toLowerCase()
    .max(60)
    .regex(/^[a-z0-9-]*$/)
    .optional()
    .default("general"),
  // The canonical usage axis. `topic` above stays as the first of these, so readers and
  // scripts written against the single-value field keep working.
  topics: z.array(taxonomySlug(60)).max(6).optional(),
  /** Exam and competition targets this word is prepared for. */
  exams: z.array(taxonomySlug(40)).max(8).optional(),
  level: z.enum(LEVELS).optional(),
  style: z.enum(STYLE_IDS).optional(),
  chars: z.number().int().nonnegative().optional(),
  initial: z.string().max(4).optional(),
  usage: z
    .array(
      z.object({
        en: z.string().trim().min(1).max(400),
        vi: optionalText(400),
        /** Per-locale contextual gloss of the example (the "hint" phrase). `vi` is the
         * base `vi` field; other locales overlay it when selected. */
        glosses: localizedText(),
      }),
    )
    .max(5)
    .optional()
    .default([]),
});
const deckSchema = z.object({
  meta: z
    .object({ name: optionalText(160) })
    .passthrough()
    .optional(),
  words: z.array(wordSchema).min(1, "The deck must contain at least one word").max(100_000),
});
export type VocabularyWord = z.infer<typeof wordSchema>;
export type VocabularyLevel = (typeof LEVELS)[number];
export type NarrativeStyle = (typeof STYLE_IDS)[number];
export type LevelSystem = "cefr" | "hsk";

/** Which proficiency standard applies to a deck locale. */
export function levelSystemFor(locale: TargetLocale): LevelSystem {
  return locale === "zh" ? "hsk" : "cefr";
}
export type Catalog = {
  revision: string;
  name: string;
  count: number;
  topics: string[];
  levels: VocabularyLevel[];
  words: VocabularyWord[];
};

/** Match a target as a whole word, preserving Unicode boundaries. @param word English target. @returns Global regex. */
export function answerPattern(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu");
}

/**
 * Normalize emphasis annotations: NFC + whitespace collapse, deduplicated by a
 * case-insensitive key that keeps diacritics (so "những"/"nhưng" stay distinct).
 * The first occurrence wins and is kept verbatim for exact downstream matching.
 * @param phrases Raw deck annotations.
 * @returns Normalized deduplicated phrases, or undefined when none survive.
 */
function normalizeEmphasisPhrases(phrases?: string[]): string[] | undefined {
  if (!phrases?.length) return undefined;
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const phrase of phrases) {
    const value = phrase.normalize("NFC").trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized.length ? normalized : undefined;
}

/**
 * Lift a flat Japanese deck into the schema. The new generator writes `defJa`,
 * `leadJa`, `anticipateJa`, `usageJa` and `emphasisJa` with no Vietnamese base, while
 * the app reads `localized.ja` and requires a base definition. The raw marked text goes
 * on `localized.ja` (the reader parses `_`, `=` and `|` itself); the base fields get
 * the display form, so a locale without an overlay and every non-kinetic surface still
 * read Japanese with no marks.
 *
 * @param entry - one raw deck word
 * @param index - position in the deck, for a deterministic fallback id
 * @returns The entry with `localized.ja`, base fields, usage and emphasis filled
 * @pure true
 */
function withFlatJapanese(entry: Record<string, unknown>, index: number): Record<string, unknown> {
  const defJa = typeof entry.defJa === "string" ? entry.defJa.trim() : "";
  if (!defJa) return entry;

  const localized =
    entry.localized && typeof entry.localized === "object"
      ? { ...(entry.localized as Record<string, unknown>) }
      : {};
  const existing =
    localized.ja && typeof localized.ja === "object"
      ? { ...(localized.ja as Record<string, unknown>) }
      : {};
  // A nested overlay was authored deliberately; the flat alias must not overwrite it.
  if (typeof existing.def === "string" && existing.def.trim()) return entry;

  const leadJa = typeof entry.leadJa === "string" ? entry.leadJa.trim() : "";
  const guessJa = typeof entry.anticipateJa === "string" ? entry.anticipateJa.trim() : "";
  const usageJa = typeof entry.usageJa === "string" ? entry.usageJa.trim() : "";
  const usageEn = typeof entry.usageEn === "string" ? entry.usageEn.trim() : "";
  localized.ja = {
    ...existing,
    def: defJa,
    ...(leadJa ? { lead: leadJa } : {}),
    ...(guessJa ? { guess: guessJa } : {}),
  };

  let usage = Array.isArray(entry.usage) ? [...entry.usage] : [];
  if (usage.length === 0 && usageEn) usage = [{ en: usageEn }];
  if (usage.length > 0 && usageJa) {
    const example =
      usage[0] && typeof usage[0] === "object" ? { ...(usage[0] as Record<string, unknown>) } : {};
    const glosses =
      example.glosses && typeof example.glosses === "object"
        ? { ...(example.glosses as Record<string, unknown>) }
        : {};
    usage[0] = {
      ...example,
      vi:
        typeof example.vi === "string" && example.vi.trim()
          ? example.vi
          : stripJapaneseMarks(usageJa),
      glosses: { ...glosses, ja: usageJa },
    };
  }

  const emphasisJa = Array.isArray(entry.emphasisJa)
    ? entry.emphasisJa
        .filter((phrase): phrase is string => typeof phrase === "string" && phrase.trim() !== "")
        // The page matches emphasis token by token; keep the 文節 boundaries.
        .map((phrase) => parseJapaneseMarkup(phrase).text)
    : [];

  const headword = typeof entry.word === "string" ? entry.word : "";
  const id =
    typeof entry.id === "string" && entry.id.trim()
      ? entry.id
      : headword
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/gu, "-")
          .replace(/^-+|-+$/g, "") || `ja-${index}`;

  return {
    ...entry,
    id,
    defVi:
      typeof entry.defVi === "string" && entry.defVi.trim()
        ? entry.defVi
        : stripJapaneseMarks(defJa),
    leadVi:
      typeof entry.leadVi === "string" && entry.leadVi.trim()
        ? entry.leadVi
        : stripJapaneseMarks(leadJa),
    anticipateVi:
      typeof entry.anticipateVi === "string" && entry.anticipateVi.trim()
        ? entry.anticipateVi
        : stripJapaneseMarks(guessJa),
    localized,
    usage,
    emphasis: entry.emphasis ?? (emphasisJa.length ? emphasisJa : undefined),
  };
}

/** Validate the complete deck before allowing any output. @param input Untrusted JSON. @returns Normalized content without a revision. */
export function normalizeDeck(input: unknown): Omit<Catalog, "revision"> {
  // A reader-imported pack and a flat Japanese deck may be a bare array; both compile
  // like the `{ words }` root the served packs use.
  const root = Array.isArray(input) ? { words: input } : input;
  const rawWords =
    root && typeof root === "object" ? (root as { words?: unknown }).words : undefined;
  const prepared = Array.isArray(rawWords)
    ? {
        ...(root as Record<string, unknown>),
        words: rawWords.map((entry, index) =>
          entry && typeof entry === "object" && !Array.isArray(entry)
            ? withFlatJapanese(entry as Record<string, unknown>, index)
            : entry,
        ),
      }
    : root;
  const parsed = deckSchema.safeParse(prepared);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"),
    );
  }
  const ids = new Set<string>();
  const targets = new Set<string>();
  const errors: string[] = [];
  const words = parsed.data.words.map((entry, index) => {
    const word = entry.word.normalize("NFC").toLowerCase().replaceAll("’", "'");
    const id = entry.id.toLowerCase();
    if (ids.has(id)) errors.push(`words.${index}.id: Duplicate ID ${id}`);
    if (targets.has(word)) errors.push(`words.${index}.word: Duplicate word ${word}`);
    if (answerPattern(word).test(entry.anticipateVi)) {
      errors.push(`words.${index}.anticipateVi: Contains the English answer`);
    }
    // The same leak rule applies to every localized overlay of the guess phrase, so a
    // non-Vietnamese locale can never hand the answer away.
    for (const [locale, overlay] of Object.entries(entry.localized ?? {})) {
      const guess = overlay?.guess;
      if (guess && answerPattern(word).test(guess)) {
        errors.push(`words.${index}.localized.${locale}.guess: Contains the English answer`);
      }
    }
    for (const usage of entry.usage ?? []) {
      for (const [locale, gloss] of Object.entries(usage.glosses ?? {})) {
        if (gloss && answerPattern(word).test(gloss)) {
          errors.push(`words.${index}.usage.glosses.${locale}: Contains the English answer`);
        }
      }
    }
    ids.add(id);
    targets.add(word);
    // The multi-valued axis is canonical. A deck carrying only the legacy single
    // `topic` is lifted into it, and `topic` is always restated as the first entry so
    // the two can never disagree.
    const topics = [...new Set(entry.topics?.length ? entry.topics : [entry.topic || "general"])];
    return {
      ...entry,
      id,
      word,
      topic: topics[0]!,
      topics,
      exams: entry.exams?.length ? [...new Set(entry.exams)] : undefined,
      chars: (word.match(/\p{L}/gu) ?? []).length,
      initial: word[0].toUpperCase(),
      emphasis: normalizeEmphasisPhrases(entry.emphasis),
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  return {
    name: parsed.data.meta?.name || "WordCrawler vocabulary",
    count: words.length,
    topics: [...new Set(words.flatMap((word) => word.topics))].sort(),
    levels: LEVELS.filter((level) => words.some((word) => word.level === level)),
    words,
  };
}

/**
 * Compact, stable FNV-1a hash rendered as hex. Used to derive one revision for a
 * merged catalog so pagination stays deterministic for a given set of inputs without
 * pulling in node:crypto on the client.
 *
 * One FNV-1a pass is only 32 bits, so a wider digest is built by re-running the pass
 * over a round-salted copy of the input and concatenating the blocks: the merged
 * revision then has the same shape as every stored one (`scripts/import-vocabulary.ts`
 * writes a 24-hex sha256 slice, and the feed endpoint validates that shape), which
 * matters because the server echoes this value back as the pagination cursor and a
 * short revision there rejects every page after the first.
 * @param input Any string
 * @param hexChars Digest width, in hex characters (8 per FNV-1a round)
 * @returns Lowercase hex digest of the requested width
 * @pure true
 */
function stableHash(input: string, hexChars = 24): string {
  let digest = "";
  for (let round = 0; digest.length < hexChars; round += 1) {
    const stream = `${round}:${input}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < stream.length; index += 1) {
      hash ^= stream.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    digest += hash.toString(16).padStart(8, "0");
  }
  return digest.slice(0, hexChars);
}

/**
 * Merge compiled catalogs — the admin-editable base plus any number of read-only
 * third-party packs — into the single catalog the feed serves. Words are de-duplicated
 * by id and by headword with the FIRST catalog winning, so the base always overrides a
 * provider pack that ships the same word. `count`, `topics`, `levels`, `revision` and
 * `name` are recomputed from the merged words so filters and deterministic pagination
 * reflect the union rather than any one input.
 * @param catalogs - base catalog first, then packs in a stable (sorted-by-path) order
 * @returns One merged Catalog
 * @pure true
 */
export function mergeCatalogs(...catalogs: Catalog[]): Catalog {
  const seenIds = new Set<string>();
  const seenWords = new Set<string>();
  const words: VocabularyWord[] = [];
  for (const source of catalogs) {
    for (const word of source.words) {
      const id = word.id.toLowerCase();
      const head = word.word.toLowerCase();
      // First pack wins: a duplicate id or headword from a later pack is dropped so the
      // feed never shows the same word twice and reaction/storage keys stay unambiguous.
      if (seenIds.has(id) || seenWords.has(head)) continue;
      seenIds.add(id);
      seenWords.add(head);
      words.push(word);
    }
  }
  const base = catalogs[0];
  const revision = stableHash(
    catalogs.map((catalog) => `${catalog.revision}:${catalog.count}`).join("|"),
  );
  const name =
    catalogs.length > 1
      ? `${base?.name ?? "WordCrawler vocabulary"} + ${catalogs.length - 1} pack${
          catalogs.length > 2 ? "s" : ""
        }`
      : (base?.name ?? "WordCrawler vocabulary");
  return {
    revision,
    name,
    count: words.length,
    topics: [
      ...new Set(words.flatMap((word) => (word.topics?.length ? word.topics : [word.topic]))),
    ].sort(),
    levels: LEVELS.filter((level) => words.some((word) => word.level === level)),
    words,
  };
}
