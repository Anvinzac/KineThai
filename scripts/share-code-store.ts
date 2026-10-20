/**
 * Deck-side share-code bookkeeping, shared by the importer (`import-vocabulary.ts`),
 * which stamps a code on every word as its pack lands, and the whole-deck repair pass
 * (`assign-share-codes.ts`) for decks authored before that.
 *
 * Append-only by construction: a word that already carries a code is never touched,
 * and a code that has ever been issued is never handed to another word, because codes
 * travel in chat messages and have to keep meaning the same word forever. The ledger
 * (data/share-codes.json) remembers codes belonging to words that have since left a
 * deck, so they can never be recycled onto a new answer.
 *
 * Codes are unique PER DECK, not globally. A deck is what one host serves — the
 * English deck is `catalog.json` merged with every pack in `data/packs`, and each
 * other locale is its own directory (see lib/catalog-source). The same code may
 * therefore mean different words on different domains, which is the price of keeping
 * 32,768 codes available to each of them.
 *
 * Depends on: ../src/features/vocabulary/lib/share-code
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHARE_CODE_SPACE,
  isShareCode,
  normalizeShareCode,
  randomShareCode,
} from "../src/features/vocabulary/lib/share-code";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA = resolve(here, "../src/features/vocabulary/data");
export const LEDGER = join(DATA, "share-codes.json");

export type ShareWord = { id: string; shareCode?: string };
export type ShareDeck = { words?: ShareWord[] };
/** locale -> code -> word id, including ids no longer served by that deck. */
export type ShareLedger = Record<string, Record<string, string>>;

/** Every file that contributes words to one deck, in the order catalog-source merges them. */
export function deckFiles(locale: string): string[] {
  const packs = (dir: string) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith(".json"))
          .sort()
          .map((name) => join(dir, name))
      : [];
  return locale === "en"
    ? [join(DATA, "catalog.json"), ...packs(join(DATA, "packs"))]
    : packs(join(DATA, locale));
}

/** The ledger, or an empty one on first run / the pre-locale format. */
export function readLedger(): ShareLedger {
  try {
    return JSON.parse(readFileSync(LEDGER, "utf8")) as ShareLedger;
  } catch {
    return {};
  }
}

export function writeLedger(ledger: ShareLedger): void {
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
}

export function readDecks(locale: string): { file: string; deck: ShareDeck }[] {
  return deckFiles(locale).map((file) => ({
    file,
    deck: JSON.parse(readFileSync(file, "utf8")) as ShareDeck,
  }));
}

/**
 * What a deck may no longer hand out, plus the reverse map that lets a re-imported
 * word keep the code it already has.
 */
export type CodePool = {
  /** Deck the pool belongs to; only used to label errors. */
  locale: string;
  /** Every code already issued on this deck: ledger history and live words. */
  taken: Set<string>;
  /** The locale's ledger entry being written, code -> word id. */
  issued: Record<string, string>;
  /** Existing word id -> code, so an import preserves codes it recognizes. */
  byId: Map<string, string>;
};

export function createCodePool(
  locale: string,
  ledger: ShareLedger,
  decks: readonly { deck: ShareDeck }[],
): CodePool {
  const issued = (ledger[locale] ??= {});
  const taken = new Set(Object.keys(issued));
  const byId = new Map<string, string>();
  for (const { deck } of decks) {
    for (const word of deck.words ?? []) {
      if (!word.shareCode) continue;
      const code = normalizeShareCode(word.shareCode);
      if (!isShareCode(code))
        throw new Error(
          `[${locale}] "${word.id}" carries a malformed share code "${word.shareCode}"`,
        );
      if (issued[code] && issued[code] !== word.id)
        throw new Error(
          `[${locale}] share code ${code} already means "${issued[code]}"; cannot reassign it to "${word.id}"`,
        );
      word.shareCode = code;
      taken.add(code);
      issued[code] = word.id;
      if (!byId.has(word.id)) byId.set(word.id, code);
    }
  }
  // Codes whose word left the deck still belong to that id if it ever comes back.
  for (const [code, id] of Object.entries(issued)) if (!byId.has(id)) byId.set(id, code);
  return { locale, taken, issued, byId };
}

/** One unused code, drawn against the pool. Most of the space can be taken, so retry. */
function drawCode(pool: CodePool): string {
  let code = randomShareCode();
  while (pool.taken.has(code)) code = randomShareCode();
  return code;
}

/**
 * Give every code-less word a code: the one its id already owns when the deck (or the
 * ledger) knows it — so a re-import never breaks a link already shared — otherwise a
 * fresh draw. Mutates the words and the pool; the caller persists the deck files and
 * the ledger.
 * @param words Deck words to stamp, in place.
 * @param pool Pool from `createCodePool` for the same deck.
 * @returns How many words got a brand-new code.
 */
export function assignShareCodes(words: readonly ShareWord[], pool: CodePool): number {
  const missing = words.filter((word) => !word.shareCode && !pool.byId.has(word.id)).length;
  if (pool.taken.size + missing > SHARE_CODE_SPACE)
    throw new Error(
      `[${pool.locale}] share code space exhausted: ${pool.taken.size} issued + ${missing} needed > ${SHARE_CODE_SPACE}. ` +
        `The format has to grow a character, which invalidates every code already shared.`,
    );

  let assigned = 0;
  for (const word of words) {
    let code = word.shareCode ? normalizeShareCode(word.shareCode) : pool.byId.get(word.id);
    if (code) {
      if (!isShareCode(code))
        throw new Error(
          `[${pool.locale}] "${word.id}" carries a malformed share code "${word.shareCode}"`,
        );
      if (pool.issued[code] && pool.issued[code] !== word.id)
        throw new Error(
          `[${pool.locale}] share code ${code} already means "${pool.issued[code]}"; cannot reassign it to "${word.id}"`,
        );
    } else {
      code = drawCode(pool);
      assigned += 1;
    }
    word.shareCode = code;
    pool.taken.add(code);
    pool.issued[code] = word.id;
    if (!pool.byId.has(word.id)) pool.byId.set(word.id, code);
  }
  return assigned;
}
