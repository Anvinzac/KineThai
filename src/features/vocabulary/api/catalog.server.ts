/** Server-only merged catalog and the paging entry the HTTP boundary uses.
 *
 * The actual paging math now lives in the environment-free `../lib/feed-pager`,
 * shared with the static-host client fallback (`../api/feed.ts`) so a deployed
 * feed permutes words exactly as SSR does. This module stays the server-facing
 * seam: it re-exports the pager's `MAX_POSITION`/`readVocabularyPage` plus the
 * static merged catalog, so the HTTP boundary imports one symbol set as before
 * and the `*.server.ts` boundary is preserved for import protection.
 *
 * Exports: catalog, MAX_POSITION, readVocabularyPage
 * Depends on: ../lib/feed-pager, ../lib/catalog-source
 */
export { catalog } from "../lib/catalog-source";
export { MAX_POSITION, readVocabularyPage } from "../lib/feed-pager";
