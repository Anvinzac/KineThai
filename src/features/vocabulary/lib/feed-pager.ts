/**
 * Pure, environment-free vocabulary paging logic.
 *
 * This is the deterministic page reader extracted so it can run identically on
 * the server (SSR / Nitro / Cloudflare) and in the browser. It holds no
 * dependency on a runtime, a request, or the network — only the static merged
 * catalogs (`./catalog-source`, one per answer language) and pure math. That
 * makes it the single implementation both the SSR server route
 * (`api/catalog.server.ts`) and the static-host client fallback (`api/feed.ts`)
 * share, so a deployed feed permutes words exactly as the server does.
 *
 * The deck follows the visited address exactly like the server: `catalogFor`
 * serves the answer language's deck (`en` on unknown hosts, which is what a
 * static host always is), so the static fallback can never disagree with SSR.
 *
 * Exports: MAX_POSITION, readVocabularyPage
 * Depends on: ./catalog-source, ./schema, ./difficulty, ./random, ./target-language, ../types
 */

import { catalogFor } from "./catalog-source";
import type { Catalog, VocabularyLevel } from "./schema";
import { LEVEL_SAMPLE_PRIORITY, difficultyLevels } from "./difficulty";
import { randomGenerator } from "./random";
import type { TargetLocale } from "./target-language";
import type { FeedPage, FeedRequest } from "../types";

/** The feed permutes the same pool forever; `nextPosition` only stops here. */
export const MAX_POSITION = 1_000_000_000_000;

const pools = new Map<string, Uint32Array>();
const orders = new Map<string, Uint32Array>();
const totals = new WeakMap<Catalog, number>();

/** Unique headwords in a catalog; Japanese decks carry one card per reader level. */
function uniqueHeadwords(catalog: Catalog): number {
  const cached = totals.get(catalog);
  if (cached !== undefined) return cached;
  const heads = new Set<string>();
  for (const word of catalog.words) heads.add(word.word.toLowerCase());
  totals.set(catalog, heads.size);
  return heads.size;
}

function remember(cache: Map<string, Uint32Array>, key: string, value: Uint32Array, cap: number) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > cap) cache.delete(cache.keys().next().value!);
  return value;
}

/**
 * Resolve the level filters into one admitted set.
 * @param catalog Deck being paged (its levels decide which tracks are servable)
 * @param level Exact CEFR level, or "" for any
 * @param difficulty Difficulty track id(s), or "" for any
 * @returns The admitted levels, or null when no level filter applies
 * @pure true
 */
function allowedLevels(catalog: Catalog, level: string, difficulty: string): Set<string> | null {
  // The catalog's own levels decide which tracks can be served at all — the same rule the
  // picker greys rows by, so a track shown at 0 streams nothing even if asked for by URL.
  const band = difficultyLevels(difficulty, catalog.levels);
  if (!level) return band ? new Set<string>(band) : null;
  if (!band) return new Set<string>([level]);
  // Both given: intersect, so an exact level outside the chosen track's band
  // admits nothing rather than silently ignoring one of the two filters.
  return band.includes(level as VocabularyLevel) ? new Set<string>([level]) : new Set<string>();
}

function matchingPool(
  catalog: Catalog,
  topic: string,
  level: string,
  difficulty: string,
): Uint32Array {
  // Revision in the key: each locale deck has its own word indices.
  const key = `${catalog.revision}:${topic}:${level}:${difficulty}`;
  const existing = pools.get(key);
  if (existing) return remember(pools, key, existing, 64);
  const allowed = allowedLevels(catalog, level, difficulty);
  // A Japanese deck carries one card per reader level for the same English word. A
  // single-level track admits only one, but "all levels" (or several tracks) would
  // otherwise repeat the word on every card. Keep one card per headword, preferring the
  // generator's JHIGH default; elsewhere the rule is still first-pack-wins.
  const matches = new Map<string, number>();
  catalog.words.forEach((word, index) => {
    // A word carries several usage domains; the legacy single `topic` is the fallback
    // for a deck compiled before the axis became multi-valued.
    if (topic && !(word.topics?.includes(topic) ?? word.topic === topic)) return;
    // A word with no CEFR level cannot belong to any band, so a filtered stream
    // excludes it while an unfiltered one still offers it.
    if (allowed && !(word.level && allowed.has(word.level))) return;
    const head = word.word.toLowerCase();
    const previous = matches.get(head);
    if (
      previous === undefined ||
      (word.level === "JHIGH" && catalog.words[previous]!.level !== "JHIGH")
    ) {
      matches.set(head, index);
    }
  });
  return remember(pools, key, Uint32Array.from(matches.values()), 64);
}

/** Sample words kept per level: enough for every track that shares a top level. */
const LEVEL_SAMPLES = 4;
const levelTallies = new Map<
  string,
  {
    counts: Partial<Record<VocabularyLevel, number>>;
    samples: FeedPage["levelSamples"];
    total: number;
  }
>();

/**
 * Count the catalog's words per CEFR level under one topic. This is what sizes the
 * difficulty picker, and it is taken with the SAME topic test `matchingPool` uses, so a
 * track's figure is by construction the number of words choosing it will stream.
 *
 * Sample selection is two-pass per level: priority words named in LEVEL_SAMPLE_PRIORITY
 * are looked up by name first (wherever they appear in the merged catalog), then any
 * remaining slots are filled in catalog order.
 * @param catalog Deck being paged
 * @param topic Topic slug, or "" for every topic
 * @returns Per-level counts plus the topic's full size (unlevelled words included)
 */
function levelTally(catalog: Catalog, topic: string) {
  const key = `${catalog.revision}:${topic}`;
  const cached = levelTallies.get(key);
  if (cached) return cached;
  const counts: Partial<Record<VocabularyLevel, number>> = {};
  const samples: FeedPage["levelSamples"] = {};
  const heads = new Set<string>();
  // Index every matching word per level so the priority pass can look up by name.
  const byLevel = new Map<VocabularyLevel, typeof catalog.words>();
  for (const word of catalog.words) {
    if (topic && !(word.topics?.includes(topic) ?? word.topic === topic)) continue;
    heads.add(word.word.toLowerCase());
    if (!word.level) continue;
    counts[word.level] = (counts[word.level] ?? 0) + 1;
    if (!byLevel.has(word.level)) byLevel.set(word.level, []);
    byLevel.get(word.level)!.push(word);
  }
  for (const [level, words] of byLevel) {
    const priority = LEVEL_SAMPLE_PRIORITY[level] ?? [];
    const picked: FeedPage["levelSamples"][VocabularyLevel] = [];
    const already = new Set<string>();
    // Pass 1: priority words in declared order, matched case-sensitively.
    for (const name of priority) {
      if (picked.length >= LEVEL_SAMPLES) break;
      const w = words.find((x) => x.word === name && !already.has(name));
      if (w) {
        picked.push({ word: w.word, defVi: w.defVi.replace(/\//g, "") });
        already.add(w.word);
      }
    }
    // Pass 2: fill remaining slots in catalog order, skipping already-picked.
    for (const w of words) {
      if (picked.length >= LEVEL_SAMPLES) break;
      if (already.has(w.word)) continue;
      picked.push({ word: w.word, defVi: w.defVi.replace(/\//g, "") });
    }
    samples[level] = picked;
  }
  const tally = { counts, samples, total: heads.size };
  if (levelTallies.size > 32) levelTallies.clear();
  levelTallies.set(key, tally);
  return tally;
}

function rawOrder(size: number, seed: string, cycle: number): Uint32Array {
  // With two words a fixed alternating order is the only way to avoid adjacent repeats.
  const orderCycle = size <= 2 ? 0 : cycle;
  const key = `${seed}:${size}:${orderCycle}`;
  const cached = orders.get(key);
  if (cached) return remember(orders, key, cached, 32);
  const order = Uint32Array.from({ length: size }, (_, index) => index);
  const random = randomGenerator(key);
  for (let index = size - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [order[index], order[other]] = [order[other], order[index]];
  }
  return remember(orders, key, order, 32);
}

function indexAt(size: number, seed: string, position: number): number {
  const cycle = Math.floor(position / size);
  let offset = position % size;
  const order = rawOrder(size, seed, cycle);
  // For n >= 3, swapping only the first two leaves the last element unchanged.
  // Thus the previous RAW last element is sufficient; no recursive cycle walk is needed.
  if (size >= 3 && cycle > 0 && offset < 2) {
    const previous = rawOrder(size, seed, cycle - 1);
    if (order[0] === previous[size - 1]) offset = 1 - offset;
  }
  return order[offset];
}

/**
 * Read a deterministic page without writes or external services.
 * @param input Validated cursor/filters
 * @param locale Answer-language deck, resolved from the visited host by the caller
 * @returns Page plus catalog metadata
 */
export function readVocabularyPage(input: FeedRequest, locale: TargetLocale = "en"): FeedPage {
  const catalog = catalogFor(locale);
  const { seed, position, topic, level, difficulty, limit } = input;
  const pool = matchingPool(catalog, topic, level, difficulty);
  const tally = levelTally(catalog, topic);
  const streamKey = `${catalog.revision}:${seed}:${topic}:${level}:${difficulty}`;
  const entries = pool.length
    ? Array.from({ length: limit }, (_, offset) => {
        const absolute = position + offset;
        return {
          occurrenceId: `${streamKey}:${absolute}`,
          position: absolute,
          cycle: Math.floor(absolute / pool.length),
          word: catalog.words[pool[indexAt(pool.length, streamKey, absolute)]],
        };
      })
    : [];
  return {
    entries,
    seed,
    revision: catalog.revision,
    position,
    previousPosition: position > 0 && pool.length ? Math.max(0, position - limit) : null,
    nextPosition: pool.length && position + limit <= MAX_POSITION ? position + limit : null,
    total: uniqueHeadwords(catalog),
    matching: pool.length,
    levelCounts: tally.counts,
    levelSamples: tally.samples,
    topicTotal: tally.total,
    name: catalog.name,
    topics: catalog.topics,
    levels: catalog.levels,
  };
}
