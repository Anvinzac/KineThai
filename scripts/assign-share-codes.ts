/**
 * Assign a share code to every deck word that does not have one yet.
 *
 * `npm run vocab:import` already stamps codes on every word as its pack lands, so
 * this is the whole-deck repair pass: run it after pulling a deck that predates
 * code stamping, or after hand-editing one. Append-only by construction: a word
 * that already carries a code is never touched, and a code that has ever been
 * issued is never handed to another word, because codes travel in chat messages
 * and have to keep meaning the same word forever. The ledger
 * (data/share-codes.json) remembers codes belonging to words that have since left
 * a deck, so they can never be recycled onto a new answer.
 *
 * Usage: npx tsx scripts/assign-share-codes.ts [--dry]
 * Depends on: ./share-code-store, ../src/features/vocabulary/lib/share-code
 */

import { writeFileSync } from "node:fs";
import { SHARE_CODE_SPACE } from "../src/features/vocabulary/lib/share-code";
import {
  assignShareCodes,
  createCodePool,
  deckFiles,
  readDecks,
  readLedger,
  writeLedger,
} from "./share-code-store";

const LOCALES = ["en", "zh", "ko", "ja"];
const dry = process.argv.includes("--dry");
const ledger = readLedger();

let totalAssigned = 0;
for (const locale of LOCALES) {
  const files = deckFiles(locale);
  if (!files.length) continue;
  const decks = readDecks(locale);
  const pool = createCodePool(locale, ledger, decks);

  let assigned = 0;
  for (const { file, deck } of decks) {
    const before = assigned;
    assigned += assignShareCodes(deck.words ?? [], pool);
    if (assigned > before && !dry) writeFileSync(file, `${JSON.stringify(deck, null, 2)}\n`);
  }

  totalAssigned += assigned;
  console.log(
    `${dry ? "[dry] " : ""}${locale}: ${assigned} assigned, ${pool.taken.size} issued of ${SHARE_CODE_SPACE} (${files.length} file(s))`,
  );
}

if (!dry) writeLedger(ledger);
console.log(`${dry ? "[dry] would assign" : "Assigned"} ${totalAssigned} code(s) in total`);
