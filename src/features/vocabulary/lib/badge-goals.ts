/**
 * The badges a reader has not earned yet, ranked by how close they are, and the plain
 * words for what each one asks.
 *
 * Every badge ladder offers one next rung: the streak's next milestone in days, and for
 * the overall count and each difficulty track, the next 100-word target (or the scope's
 * own size at the end). A rung's distance is in days — days left on the streak, and for
 * words the words left at ASSUMED_DAILY_WORDS a day — so a streak and a word count can be
 * compared at all. Ties go to the broadest goal first: overall words, then the streak,
 * then the tracks in ladder order, easiest first.
 *
 * Exports: ASSUMED_DAILY_WORDS, BadgeGoal, nextBadgeGoals, badgeGoalCriteria,
 *   badgeGoalProgress
 * Depends on: ./level-progress, ./streak, ./word-badges, ./difficulty,
 *   ./target-language, ./locale
 */

import { formatLevelBand, tracksFor } from "./difficulty";
import {
  milestoneKey,
  milestonesReached,
  scopeProgress,
  type LevelProgress,
  type ProgressScope,
} from "./level-progress";
import type { Locale } from "./locale";
import type { VocabularyLevel } from "./schema";
import { DAY_MIN_WORDS, MILESTONES } from "./streak";
import { DAILY_GOALS, type DailyGoal } from "./daily-goal";
import type { TargetLocale } from "./target-language";
import { ALL_SCOPE, scopeLabel } from "./word-badges";

/** A reading pace for comparing a word target with a streak; one short session a day. */
export const ASSUMED_DAILY_WORDS = 20;

/** A badge, earned or not, with where the reader stands on it. */
export type BadgeGoal =
  | { kind: "streak"; days: number; current: number }
  | { kind: "words"; scope: string; words: number; complete: boolean; seen: number }
  /** A daily goal: `times` days met so far, `today` words finished today. */
  | { kind: "daily"; goal: DailyGoal; times: number; today: number };

/** The next unearned rung of every scope's ladder, words passed included as "earned". */
function nextWordGoals(
  scopes: readonly ProgressScope[],
  seen: LevelProgress,
  levelCounts: Partial<Record<VocabularyLevel, number>>,
  earned: ReadonlySet<string>,
): BadgeGoal[] {
  const goals: BadgeGoal[] = [];
  for (const scope of scopes) {
    const progress = scopeProgress(scope.levels, seen, levelCounts);
    if (progress.total <= 0) continue;
    // Every rung the scope has, finished or not: milestonesReached over the full size.
    const ladder = milestonesReached(scope.id, progress.total, progress.total);
    const next = ladder.find((rung) => !earned.has(milestoneKey(rung)));
    if (next) goals.push({ kind: "words", ...next, seen: progress.seen });
  }
  return goals;
}

/**
 * @param input.streakEarned Streak milestones already earned, in days
 * @param input.streakNow The current run, in days
 * @param input.wordEarned Word milestone keys already earned
 * @param input.scopes Every scope word progress is counted over, "all" first
 * @param input.seen Seen words per level
 * @param input.levelCounts Words per level in the catalog
 * @param limit How many to return
 * @returns The closest unearned badges, closest first
 * @pure true
 */
export function nextBadgeGoals(
  input: {
    streakEarned: readonly number[];
    streakNow: number;
    wordEarned: ReadonlySet<string>;
    scopes: readonly ProgressScope[];
    seen: LevelProgress;
    levelCounts: Partial<Record<VocabularyLevel, number>>;
    /** The daily goals: days each has been met, and words finished today. */
    daily?: { times: Record<DailyGoal, number>; today: number };
  },
  limit = 5,
): BadgeGoal[] {
  const ranked: { goal: BadgeGoal; days: number; order: number }[] = [];
  // The first badges there are to earn: one good day. Each daily goal is offered until it
  // is first met — the smallest one not yet met, so 25 appears once 10 has been and 50
  // after that — and then counts up on the shelf instead of holding a slot here for good.
  const nextDaily = input.daily && DAILY_GOALS.find((goal) => input.daily!.times[goal] === 0);
  if (input.daily && nextDaily) {
    ranked.push({
      goal: { kind: "daily", goal: nextDaily, times: 0, today: input.daily.today },
      days: 1,
      order: -1,
    });
  }
  const streakDays = MILESTONES.find((days) => !input.streakEarned.includes(days));
  if (streakDays !== undefined) {
    ranked.push({
      goal: { kind: "streak", days: streakDays, current: input.streakNow },
      days: Math.max(1, streakDays - input.streakNow),
      order: 1,
    });
  }
  const words = nextWordGoals(input.scopes, input.seen, input.levelCounts, input.wordEarned);
  words.forEach((goal, index) => {
    if (goal.kind !== "words") return;
    ranked.push({
      goal,
      days: Math.max(0, Math.ceil((goal.words - goal.seen) / ASSUMED_DAILY_WORDS)),
      // "all" is first among the scopes; it sorts ahead of the streak, the tracks after.
      order: goal.scope === ALL_SCOPE ? 0 : 2 + index,
    });
  });
  return ranked
    .sort((a, b) => a.days - b.days || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.goal);
}

/** @returns What a badge asks of the reader, in one or two sentences. */
export function badgeGoalCriteria(
  goal: BadgeGoal,
  locale: TargetLocale,
  uiLocale: Locale = "vi",
): string {
  if (uiLocale === "ja") {
    if (goal.kind === "daily") {
      return `1日に異なる単語を ${goal.goal} 語最後まで学習します。達成した日ごとに回数が1つ増えます（連続でなくても構いません）。`;
    }
    if (goal.kind === "streak") {
      return `毎日少なくとも ${DAY_MIN_WORDS} 語を、${goal.days} 日連続で学習します。1日休むとカウントは最初からになります。`;
    }
    const any = "同じ単語を何度見ても1語として数えられます。";
    if (goal.scope === ALL_SCOPE) {
      return goal.complete
        ? `すべてのレベルにわたって、デッキ内の全 ${goal.words} 語を学習します。${any}`
        : `レベルを問わず、異なる単語を ${goal.words} 語学習します。${any}`;
    }
    const track = tracksFor(locale).find((entry) => entry.id === goal.scope);
    const name = scopeLabel(goal.scope, locale, uiLocale);
    const band = track ? `（${formatLevelBand(track.levels)}）` : "";
    return goal.complete
      ? `${name}${band} の全 ${goal.words} 語を学習します。${any}`
      : `${name}${band} の異なる単語を ${goal.words} 語学習します。${any}`;
  }
  if (uiLocale === "th") {
    if (goal.kind === "daily") {
      return `เรียนคำศัพท์ที่ไม่ซ้ำกันครบ ${goal.goal} คำในหนึ่งวัน ทุกวันที่ทำได้ เหรียญจะนับเพิ่มหนึ่งครั้งโดยไม่จำเป็นต้องติดต่อกัน`;
    }
    if (goal.kind === "streak") {
      return `เรียนอย่างน้อยวันละ ${DAY_MIN_WORDS} คำ ติดต่อกัน ${goal.days} วัน หากเว้นหนึ่งวัน สถิติจะเริ่มนับใหม่`;
    }
    const any = "แต่ละคำนับเพียงครั้งเดียวไม่ว่าจะเจอกี่ครั้งก็ตาม";
    if (goal.scope === ALL_SCOPE) {
      return goal.complete
        ? `ดูคำศัพท์ครบทั้งหมด ${goal.words} คำในชุด ทุกระดับ ${any}`
        : `ดูคำศัพท์ที่ไม่ซ้ำกันครบ ${goal.words} คำ ในระดับใดก็ได้ ${any}`;
    }
    const track = tracksFor(locale).find((entry) => entry.id === goal.scope);
    const name = scopeLabel(goal.scope, locale, uiLocale);
    const band = track ? ` (${formatLevelBand(track.levels)})` : "";
    return goal.complete
      ? `ดูคำศัพท์ครบทั้งหมด ${goal.words} คำของ ${name}${band} ${any}`
      : `ดูคำศัพท์ที่ไม่ซ้ำกันครบ ${goal.words} คำใน ${name}${band} ${any}`;
  }
  if (goal.kind === "daily") {
    return `Học xong ${goal.goal} từ khác nhau trong một ngày. Mỗi ngày đạt được, huy hiệu đếm thêm một lần — không cần liền nhau.`;
  }
  if (goal.kind === "streak") {
    return `Học ít nhất ${DAY_MIN_WORDS} từ mỗi ngày, ${goal.days} ngày liền nhau. Bỏ một ngày, chuỗi sẽ bắt đầu lại từ đầu.`;
  }
  const any = "Mỗi từ chỉ tính một lần, dù bạn gặp lại bao nhiêu lần.";
  if (goal.scope === ALL_SCOPE) {
    return goal.complete
      ? `Xem hết toàn bộ ${goal.words} từ trong bộ, ở mọi trình độ. ${any}`
      : `Xem ${goal.words} từ khác nhau, ở bất kỳ trình độ nào. ${any}`;
  }
  const track = tracksFor(locale).find((entry) => entry.id === goal.scope);
  const name = scopeLabel(goal.scope, locale, "vi");
  const band = track ? ` (${formatLevelBand(track.levels)})` : "";
  return goal.complete
    ? `Xem hết ${goal.words} từ của ${name}${band}. ${any}`
    : `Xem ${goal.words} từ khác nhau thuộc ${name}${band}. ${any}`;
}

/** @returns Where the reader stands on a badge: "Chuỗi hiện tại: 2 ngày", "Đã xem: 37/100 từ". */
export function badgeGoalProgress(goal: BadgeGoal, uiLocale: Locale = "vi"): string {
  if (uiLocale === "ja") {
    if (goal.kind === "daily") {
      const today = `今日: ${Math.min(goal.today, goal.goal)}/${goal.goal} 語`;
      return goal.times > 0 ? `${goal.times} 回達成 · ${today}` : today;
    }
    if (goal.kind === "streak")
      return `現在の連続記録: ${Math.min(goal.current, goal.days)}/${goal.days} 日`;
    return `学習済み: ${Math.min(goal.seen, goal.words)}/${goal.words} 語`;
  }
  if (uiLocale === "th") {
    if (goal.kind === "daily") {
      const today = `วันนี้: ${Math.min(goal.today, goal.goal)}/${goal.goal} คำ`;
      return goal.times > 0 ? `ทำได้แล้ว ${goal.times} ครั้ง · ${today}` : today;
    }
    if (goal.kind === "streak")
      return `สถิติปัจจุบัน: ${Math.min(goal.current, goal.days)}/${goal.days} วัน`;
    return `ดูแล้ว: ${Math.min(goal.seen, goal.words)}/${goal.words} คำ`;
  }
  if (goal.kind === "daily") {
    const today = `Hôm nay: ${Math.min(goal.today, goal.goal)}/${goal.goal} từ`;
    return goal.times > 0 ? `Đã đạt ${goal.times} lần · ${today}` : today;
  }
  if (goal.kind === "streak")
    return `Chuỗi hiện tại: ${Math.min(goal.current, goal.days)}/${goal.days} ngày`;
  return `Đã xem: ${Math.min(goal.seen, goal.words)}/${goal.words} từ`;
}
