/**
 * Groups a saved-word list into sections a reader can actually scan, then chunks each
 * section into folders of at most FOLDER_CAP words.
 *
 * Two lenses, both asked for: the day a word was saved, and its CEFR level. Words with no
 * recoverable date collect in one clearly-labelled last group rather than being invented
 * a day. Folder splitting is what keeps a busy group from turning into one long scroll.
 *
 * Labels are localized via `t`/`difficultyCopy`-style copy in ui-copy.ts; every function
 * takes the active locale so the grouping reads in the reader's language.
 *
 * Exports: FOLDER_CAP, GroupMode, GROUP_MODES, WordFolder, WordGroup, dayLabel,
 *   groupSavedWords
 * Depends on: ./schema (LEVELS), ./saved-words (type only), ./ui-copy, ./locale
 */

import { LEVELS } from "./schema";
import type { SavedWord } from "./saved-words";
import { t, type CopyKey } from "./ui-copy";
import { DEFAULT_LOCALE, type Locale } from "./locale";

/** Hard ceiling on how many words one folder may hold. */
export const FOLDER_CAP = 15;

export type GroupMode = "day" | "level";

/** The grouping switch's options, in the order they are offered. */
export const GROUP_MODES: { id: GroupMode }[] = [{ id: "day" }, { id: "level" }];

/** CEFR code → the ui-copy key naming that band. */
const BAND_KEY: Record<string, CopyKey> = {
  A1: "saved.band.A1",
  A2: "saved.band.A2",
  B1: "saved.band.B1",
  B2: "saved.band.B2",
  C1: "saved.band.C1",
  C2: "saved.band.C2",
};

export type WordFolder = {
  id: string;
  /** "" when the group holds a single folder, so the group label is not repeated. */
  label: string;
  words: SavedWord[];
};

export type WordGroup = {
  id: string;
  label: string;
  /** Quiet second line, e.g. the localized name of a CEFR band. */
  hint?: string;
  count: number;
  folders: WordFolder[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const day = new Date(ts);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/**
 * Calendar-day label: the three relative words a reader thinks in, then a plain
 * day/month, gaining a year only once the words stop applying across one.
 * @param ts - Any timestamp inside the day
 * @param now - Reference "today"
 * @param locale - Active content locale
 * @returns Short label
 */
export function dayLabel(ts: number, now: number, locale: Locale = DEFAULT_LOCALE): string {
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY_MS);
  if (days <= 0) return t(locale, "saved.day.today");
  if (days === 1) return t(locale, "saved.day.yesterday");
  if (days === 2) return t(locale, "saved.day.before");
  const date = new Date(ts);
  const label = `${date.getDate()}/${date.getMonth() + 1}`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? label
    : `${label}/${date.getFullYear()}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let at = 0; at < items.length; at += size) parts.push(items.slice(at, at + size));
  return parts;
}

/** Split one group's words into folders, skipping the extra heading when there is only one. */
function toFolders(groupId: string, words: SavedWord[], locale: Locale): WordFolder[] {
  if (words.length <= FOLDER_CAP) return [{ id: `${groupId}#1`, label: "", words }];
  return chunk(words, FOLDER_CAP).map((part, index) => ({
    id: `${groupId}#${index + 1}`,
    label: t(locale, "saved.folder", { n: index + 1 }),
    words: part,
  }));
}

/** Newest save first; undated words keep the order the device saved them in. */
function byNewestSave(a: SavedWord, b: SavedWord): number {
  if (a.savedAt && b.savedAt) return b.savedAt - a.savedAt;
  if (a.savedAt) return -1;
  if (b.savedAt) return 1;
  return 0;
}

function makeGroup(
  id: string,
  label: string,
  words: SavedWord[],
  locale: Locale,
  hint?: string,
): WordGroup {
  return { id, label, hint, count: words.length, folders: toFolders(id, words, locale) };
}

function groupByDay(words: SavedWord[], now: number, locale: Locale): WordGroup[] {
  const buckets = new Map<number, SavedWord[]>();
  const undated: SavedWord[] = [];
  for (const entry of words) {
    if (!entry.savedAt) {
      undated.push(entry);
      continue;
    }
    const day = startOfDay(entry.savedAt);
    const bucket = buckets.get(day);
    if (bucket) bucket.push(entry);
    else buckets.set(day, [entry]);
  }
  const groups = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([day, list]) =>
      makeGroup(`day-${day}`, dayLabel(day, now, locale), [...list].sort(byNewestSave), locale),
    );
  if (undated.length)
    groups.push(makeGroup("day-undated", t(locale, "saved.undated"), undated, locale));
  return groups;
}

function groupByLevel(words: SavedWord[], locale: Locale): WordGroup[] {
  const buckets = new Map<string, SavedWord[]>();
  for (const entry of words) {
    const level = entry.word.level || t(locale, "saved.unlevelled");
    const bucket = buckets.get(level);
    if (bucket) bucket.push(entry);
    else buckets.set(level, [entry]);
  }
  const rank = (level: string) => {
    const at = (LEVELS as readonly string[]).indexOf(level);
    return at === -1 ? LEVELS.length : at;
  };
  return [...buckets.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([level, list]) =>
      makeGroup(
        `level-${level}`,
        level,
        [...list].sort(byNewestSave),
        locale,
        BAND_KEY[level] ? t(locale, BAND_KEY[level]!) : undefined,
      ),
    );
}

/**
 * Group and folder a saved-word list.
 * @param words - The active tab's words
 * @param mode - Day or level
 * @param locale - Active content locale for every label
 * @param now - Reference time for the relative day labels
 * @returns Groups in reading order, each split into folders of at most FOLDER_CAP words
 */
export function groupSavedWords(
  words: SavedWord[],
  mode: GroupMode,
  locale: Locale = DEFAULT_LOCALE,
  now: number = Date.now(),
): WordGroup[] {
  return mode === "day" ? groupByDay(words, now, locale) : groupByLevel(words, locale);
}
