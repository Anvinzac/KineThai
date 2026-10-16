/**
 * Reader-imported vocabulary pack, kept only in this browser (localStorage) — never uploaded.
 * While a pack is active the feed pages through it locally instead of the server deck.
 *
 * Exports: CustomPack, parseCustomPack, loadCustomPackFromUrl, readCustomPack, writeCustomPack,
 *   clearCustomPack, readCustomPage, CUSTOM_PACK_EVENT
 * Depends on: ./schema (normalizeDeck), ./word-joiner, ./paging
 */
import { normalizeDeck, type Catalog } from "./schema";
import { withWordJoiners } from "./word-joiner";
import { readCatalogPage } from "./paging";
import type { FeedPage, FeedRequest } from "../types";

const KEY = "vocab.customPack.v1";
export const CUSTOM_PACK_EVENT = "vocab-custom-pack-change";
/** Same ceiling as the CLI importer would choke on in localStorage. */
const MAX_BYTES = 4 * 1024 * 1024;

export type CustomPack = { catalog: Catalog; source: string; importedAt: number };

function hash(text: string): string {
  let h = 0x811c9dc5;
  let out = "";
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) + round;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

/** Validate raw JSON text against the default deck format. Throws a readable message on failure. */
export function parseCustomPack(text: string, source: string): CustomPack {
  if (text.length > MAX_BYTES) throw new Error("Gói quá lớn (tối đa 4 MB).");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Tệp không phải JSON hợp lệ.");
  }
  const deck = normalizeDeck(json);
  if (!deck.count) throw new Error("Gói không có từ nào.");
  return {
    catalog: { revision: hash(JSON.stringify(deck)), ...deck },
    source,
    importedAt: Date.now(),
  };
}

/** Fetch a pack straight from a public URL (the host must allow cross-origin reads). */
export async function loadCustomPackFromUrl(url: string): Promise<CustomPack> {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Đường dẫn không hợp lệ.");
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("Chỉ hỗ trợ liên kết http/https.");
  let response: Response;
  try {
    response = await fetch(parsed.toString(), { credentials: "omit" });
  } catch {
    throw new Error("Không tải được liên kết (máy chủ có thể chặn truy cập chéo).");
  }
  if (!response.ok) throw new Error(`Liên kết trả về lỗi ${response.status}.`);
  return parseCustomPack(await response.text(), parsed.toString());
}

let cache: { raw: string | null; pack: CustomPack | null } | null = null;

/** @returns The active imported pack, or null. Browser-only. */
export function readCustomPack(): CustomPack | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (cache && cache.raw === raw) return cache.pack;
  let pack: CustomPack | null = null;
  try {
    if (raw) {
      const stored = JSON.parse(raw) as CustomPack;
      pack = { ...stored, catalog: withWordJoiners(stored.catalog) };
    }
  } catch {
    pack = null;
  }
  cache = { raw, pack };
  return pack;
}

/** Make a pack the active feed source. */
export function writeCustomPack(pack: CustomPack) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pack));
  } catch {
    throw new Error("Trình duyệt không đủ chỗ lưu gói này.");
  }
  window.dispatchEvent(new Event(CUSTOM_PACK_EVENT));
}

/** Return the feed to the built-in deck. */
export function clearCustomPack() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CUSTOM_PACK_EVENT));
}

/** Page the active pack locally, or null when none is active. */
export function readCustomPage(input: FeedRequest): FeedPage | null {
  const pack = readCustomPack();
  return pack ? readCatalogPage(pack.catalog, input) : null;
}
