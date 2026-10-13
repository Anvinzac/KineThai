/** Public navigation and stream/presentation controls. Exports: FeedControls. Depends on: router, presets, difficulty tracks, transport types. */
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ChevronDown,
  Clapperboard,
  Library,
  Pause,
  Play,
  Settings,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { COMMUNITY_AVAILABLE } from "@/lib/feature-flags";
import { EcosystemMenu } from "@/features/ecosystem/components/EcosystemMenu";
import { ECOSYSTEM_STORE_AVAILABLE } from "@/lib/feature-flags";
import { stylePool, themePool } from "../lib/presets";
import { DIFFICULTY_ALL, formatLevelBand, countTrackWords, tracksFor } from "../lib/difficulty";
import { CEFR_LEVELS, HSK_LEVELS, type NarrativeStyle } from "../lib/schema";
import type { HistoryStats } from "../lib/history";
import {
  douyinStyleLabel,
  douyinStyleLabelVi,
  posLabel,
  styleLabel,
  styleLabelVi,
  themeLabel,
  themeLabelVi,
  topicLabel,
  topicLabelVi,
} from "../lib/i18n";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeLabel, type Locale } from "../lib/locale";
import { setLocale, useLocale } from "../lib/useLocale";
import { difficultyCopy, t } from "../lib/ui-copy";
import { siteBrand, type TargetLocale } from "../lib/target-language";
import { useAmbientSound } from "../hooks/useAmbientSound";
import type {
  FeedPage,
  Presentation,
  ReadingPace,
  VocabularyFilters,
  VisualDialect,
} from "../types";
import { usePresence } from "@/hooks/use-presence";

const PACE_OPTIONS: { id: ReadingPace }[] = [{ id: "slow" }, { id: "normal" }, { id: "fast" }];

/** Matches the exit keyframes' duration (--dur-quick) in vocabulary.css. */
const POPUP_EXIT_MS = 180;

/**
 * Invisible full-screen catcher behind a popup. A tap on it only dismisses, so it can
 * never also turn the card page underneath the way a document-level listener let it.
 */
function PopupScrim({ closing, onDismiss }: { closing: boolean; onDismiss: () => void }) {
  return (
    <div
      className="vocab-popup-scrim"
      data-closing={closing || undefined}
      aria-hidden="true"
      onClick={onDismiss}
    />
  );
}

/** Gap between a trigger and its list, and the margin kept from the sheet's edges. */
const PICKER_GAP = 6;
const PICKER_INSET = 10;
/** Matches .vocab-picker-list max-height: the tallest a list gets when there is room. */
const PICKER_MAX_HEIGHT = 240;
/** Shortest a list may be shrunk to while still sitting clear of its trigger. */
const PICKER_MIN_HEIGHT = 140;

/**
 * Keep a picker's list next to its trigger yet wholly inside the visible part of the
 * options sheet, which scrolls and clips. Below the trigger is preferred; above is
 * used when below is short and above has more room; when neither side holds the
 * whole list it shrinks into the roomier side (its rows scroll), and only when even
 * that side is cramped is it slid over the trigger to fit. Horizontally it starts at the trigger's
 * left edge and is nudged back from either side. Writes styles straight onto the list
 * so a sheet scroll or resize re-places it without a React render.
 */
function useContainedPicker(
  open: boolean,
  rootRef: RefObject<HTMLDivElement | null>,
  listRef: RefObject<HTMLDivElement | null>,
  /** Anything that changes the list's rows, so a grown or shrunk list is re-placed. */
  contentKey?: unknown,
) {
  useLayoutEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    const list = listRef.current;
    const trigger = root?.querySelector<HTMLElement>(".vocab-picker-trigger");
    if (!root || !list || !trigger) return;
    const sheet = root.closest<HTMLElement>(".vocab-options");

    const place = () => {
      const sheetRect = sheet?.getBoundingClientRect();
      const left = Math.max(sheetRect?.left ?? 0, 0) + PICKER_INSET;
      const right = Math.min(sheetRect?.right ?? innerWidth, innerWidth) - PICKER_INSET;
      const top = Math.max(sheetRect?.top ?? 0, 0) + PICKER_INSET;
      const bottom = Math.min(sheetRect?.bottom ?? innerHeight, innerHeight) - PICKER_INSET;
      const anchor = trigger.getBoundingClientRect();
      const origin = root.getBoundingClientRect();

      list.style.maxWidth = `${Math.max(0, right - left)}px`;
      const width = list.offsetWidth;
      const border = list.offsetHeight - list.clientHeight;
      const wanted = Math.min(list.scrollHeight + border, PICKER_MAX_HEIGHT);
      let height = Math.min(wanted, Math.max(0, bottom - top));

      const below = bottom - (anchor.bottom + PICKER_GAP);
      const above = anchor.top - PICKER_GAP - top;
      let y: number;
      let side: "below" | "above";
      if (below >= height) {
        y = anchor.bottom + PICKER_GAP;
        side = "below";
      } else if (above >= height) {
        y = anchor.top - PICKER_GAP - height;
        side = "above";
      } else if (Math.max(above, below) >= PICKER_MIN_HEIGHT) {
        side = above > below ? "above" : "below";
        height = Math.max(above, below);
        y = side === "below" ? anchor.bottom + PICKER_GAP : anchor.top - PICKER_GAP - height;
      } else {
        side = above > below ? "above" : "below";
        const preferred =
          side === "below" ? anchor.bottom + PICKER_GAP : anchor.top - PICKER_GAP - height;
        y = Math.min(Math.max(preferred, top), bottom - height);
      }
      const x = Math.min(Math.max(anchor.left, left), right - width);

      list.style.top = `${y - origin.top}px`;
      list.style.left = `${x - origin.left}px`;
      list.style.maxHeight = `${height}px`;
      list.dataset.side = side;
    };

    place();
    sheet?.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      sheet?.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [open, rootRef, listRef, contentKey]);
}

/**
 * Theme allow-list, deliberately the inverse of a single choice: every theme starts
 * picked and the reader only ever UNPICKS the ones they dislike, so the stream keeps
 * rotating (mix semantics) instead of wearing one skin forever. Each row leads with a
 * live gradient swatch — a theme IS its colors, and a name alone can't show that.
 * Stored as "mix" while everything is picked, else a comma-joined id list.
 */
/**
 * Single-select dropdown in the sheet's own skin.
 *
 * A native <select> was styled to match while closed, but the list it opens belongs to the
 * OS — the iOS wheel, the desktop menu — and no stylesheet can reach inside it, so the one
 * part a reader actually looks at never matched the app. This is the theme picker's popover
 * with one choice instead of many, so topic, theme and style all open the same thing.
 *
 * @param label Caption above the trigger
 * @param value Current option id
 * @param options Rows to choose from, in display order
 * @param onChange Called with the chosen id
 */
function OptionPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const current = options.find((option) => option.id === value) ?? options[0];
  const presence = usePresence(open, POPUP_EXIT_MS);
  useContainedPicker(open, rootRef, listRef, options.length);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div
      className="vocab-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span className="vocab-picker-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className="vocab-picker-trigger"
        onClick={() => setOpen((value2) => !value2)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="vocab-picker-summary">{current?.label}</span>
        <ChevronDown size={15} />
      </button>
      {presence.mounted && (
        <div
          ref={listRef}
          className="vocab-picker-list"
          role="listbox"
          aria-labelledby={labelId}
          data-closing={presence.closing || undefined}
        >
          {options.map((option) => {
            const on = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={on}
                data-on={on || undefined}
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
              >
                <span className="vocab-picker-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
  dialect,
  uiLocale,
}: {
  value: string;
  onChange: (theme: string) => void;
  /** Which collection the allow-list is read against; the Douyin pool on the zh host. */
  dialect?: VisualDialect;
  /** UI locale for the palette names (KineThai overlay; defaults to Vietnamese). */
  uiLocale?: Locale;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const pool = useMemo(() => themePool("mix", dialect), [dialect]);
  const allIds = useMemo(() => pool.map((theme) => theme.id), [pool]);
  const selected = useMemo(() => {
    const ids = value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return new Set(ids.length && !ids.includes("mix") ? ids : allIds);
  }, [value, allIds]);
  const isAll = selected.size === allIds.length;
  // Pool order keeps the chips and the joined value stable across toggles.
  const pickedThemes = useMemo(
    () => pool.filter((theme) => selected.has(theme.id)),
    [pool, selected],
  );
  const presence = usePresence(open, POPUP_EXIT_MS);
  useContainedPicker(open, rootRef, listRef, isAll);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      // The stream must always have something to wear: the last theme stays pinned.
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next.size === allIds.length ? "mix" : allIds.filter((id2) => next.has(id2)).join(","));
  }

  const summary = isAll
    ? t(uiLocale ?? DEFAULT_LOCALE, "theme.mix")
    : pickedThemes.length === 1
      ? themeLabel(pickedThemes[0].id, pickedThemes[0].label, uiLocale)
      : `${pickedThemes.length}/${allIds.length}`;

  return (
    <div
      className="vocab-picker"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <span className="vocab-picker-label" id={labelId}>
        {t(uiLocale ?? DEFAULT_LOCALE, "theme.label")}
      </span>
      <button
        type="button"
        className="vocab-picker-trigger"
        onClick={() => (open ? setOpen(false) : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="vocab-theme-chips" aria-hidden="true">
          {pickedThemes.slice(0, 3).map((theme) => (
            <span key={theme.id} style={{ background: theme.paint }} />
          ))}
        </span>
        <span className="vocab-picker-summary">{summary}</span>
        <ChevronDown size={15} />
      </button>
      {presence.mounted && (
        <div
          ref={listRef}
          className="vocab-picker-list"
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={labelId}
          data-closing={presence.closing || undefined}
        >
          {pool.map((theme) => {
            const on = selected.has(theme.id);
            return (
              <button
                key={theme.id}
                type="button"
                role="option"
                aria-selected={on}
                data-on={on || undefined}
                onClick={() => toggle(theme.id)}
              >
                <span className="vocab-theme-swatch" style={{ background: theme.paint }} />
                <span className="vocab-picker-option-label">
                  {themeLabel(theme.id, theme.label, uiLocale)}
                </span>
              </button>
            );
          })}
          {!isAll && (
            <button type="button" className="vocab-picker-reset" onClick={() => onChange("mix")}>
              {t(uiLocale ?? DEFAULT_LOCALE, "theme.reset")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type DifficultyOption = {
  id: string;
  label: string;
  hint: string;
  band: string;
};

/**
 * The dropdown's rows: an explicit "all" escape hatch ahead of the ten tracks. In the
 * multi-select the "all" row means an EMPTY selection (no restriction), so clearing
 * every track returns to it. Each row shows its level band as a chip ahead of the name
 * and its real word count at the trailing edge. The rows are static per locale, so the
 * list renders before the first feed page resolves; the counts arrive with that page.
 */
function buildDifficultyOptions(locale: TargetLocale, uiLocale?: Locale): DifficultyOption[] {
  const tracks = tracksFor(locale);
  const allLevels = locale === "zh" ? HSK_LEVELS : CEFR_LEVELS;
  return [
    {
      id: DIFFICULTY_ALL,
      label: t(uiLocale ?? DEFAULT_LOCALE, "difficulty.all"),
      hint: t(uiLocale ?? DEFAULT_LOCALE, "difficulty.allHint"),
      band: formatLevelBand(allLevels),
    },
    ...tracks.map((track) => ({
      id: track.id,
      label: difficultyCopy(uiLocale ?? DEFAULT_LOCALE, track.id).label || track.label,
      hint: difficultyCopy(uiLocale ?? DEFAULT_LOCALE, track.id).hint || track.hint,
      band: formatLevelBand(track.levels),
    })),
  ];
}

/** Split a committed `difficulty` value into its track ids, in canonical order. */
function parseDifficulty(value: string, tracks: readonly { id: string }[]): string[] {
  const seen = new Set(
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return tracks.map((track) => track.id).filter((id) => seen.has(id));
}

/**
 * Summarise a selection for the trigger line: none → 🤯 "all", one → that track's
 * emoji and label, several → 🧩 "mixed" over the union band.
 */
function describeSelection(
  ids: string[],
  tracks: ReturnType<typeof tracksFor>,
  uiLocale?: Locale,
): { emoji: string; label: string; band: string } {
  if (!ids.length)
    return { emoji: "🤯", label: t(uiLocale ?? DEFAULT_LOCALE, "difficulty.all"), band: "" };
  const selected = tracks.filter((track) => ids.includes(track.id));
  if (selected.length === 1) {
    const track = selected[0]!;
    return {
      emoji: track.emoji,
      label: difficultyCopy(uiLocale ?? DEFAULT_LOCALE, track.id).label || track.label,
      band: formatLevelBand(track.levels),
    };
  }
  const levels = [...new Set(selected.flatMap((track) => track.levels))];
  return {
    emoji: "🧩",
    label: t(uiLocale ?? DEFAULT_LOCALE, "difficulty.mixed"),
    band: formatLevelBand(levels),
  };
}

/**
 * Difficulty picker whose trigger IS the page title: the brand sits where it always
 * did and the tagline slot reports the current selection, so the control needs no
 * separate button. It is multi-select — rows toggle into a draft and a "Done" button
 * commits it, so browsing choices never re-shuffle the live stream until confirmed. A
 * listbox rather than a native select so each row can carry its emoji, HSK band and
 * Vietnamese gloss, and so tap targets stay large.
 * Open state lives in the parent: the toolbar-level popup guardrail needs to know the
 * sheet is out, and one popup can never stay open while another is being reached for.
 * @param props Current comma-joined selection, change handler, and open state
 * @returns Brand trigger plus its popup list
 */
function DifficultyDropdown({
  value,
  onChange,
  open,
  onOpenChange,
  levelCounts,
  catalogLevels,
  total,
  locale,
  uiLocale,
}: {
  value: string;
  onChange: (next: string) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Words per CEFR level from the feed; undefined until the first page has loaded. */
  levelCounts?: FeedPage["levelCounts"];
  /** Levels the catalog has any word for: decides which tracks are on offer at all. */
  catalogLevels?: FeedPage["levels"];
  /** Every word under the current topic; undefined until the first page has loaded. */
  total?: number;
  /** Visited address's deck locale: the brand title follows the host (hoa.* → hoa.chayLá). */
  locale?: TargetLocale;
  /** UI locale for catalog labels (KineThai overlay; Japanese by default). */
  uiLocale: Locale;
}) {
  const ui = uiLocale;
  const listId = useId();
  const activeLocale = locale ?? "en";
  const tracks = tracksFor(activeLocale);
  const options = useMemo(() => buildDifficultyOptions(activeLocale, ui), [activeLocale, ui]);
  const committed = useMemo(() => parseDifficulty(value, tracks), [value, tracks]);
  const summary = describeSelection(committed, tracks, ui);
  const [draft, setDraft] = useState<Set<string>>(() => new Set(committed));
  const [cursor, setCursor] = useState(0);
  // "Done" stays hidden until the reader picks a row this session, then fades in.
  const [touched, setTouched] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const close = (restoreFocus: boolean) => {
    onOpenChange(false);
    if (restoreFocus) trigger.current?.focus();
  };
  // Multi-select edits a draft; only "Done" commits it, so a tap never re-shuffles the
  // live stream until the reader confirms.
  const toggle = (id: string) =>
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setDraft(new Set());
  // Every figure in the list is the catalog's own count — what the stream will actually
  // serve for that choice — not a placeholder. A row's number is the words at its levels;
  // the "tất cả" row shows the size of whatever is picked so far (the UNION of the picked
  // tracks' levels: tracks overlap, so adding their sizes would double-count), and the
  // whole topic again once nothing is picked. undefined = the first page has not arrived.
  const countFor = (id: string): number | undefined => {
    if (!levelCounts || !catalogLevels) return undefined;
    if (id !== DIFFICULTY_ALL) return countTrackWords([id], levelCounts, catalogLevels);
    return draft.size > 0 ? countTrackWords(draft, levelCounts, catalogLevels) : total;
  };
  const pickRow = (id: string) => {
    // Shared by tap and keyboard: an empty track cannot be chosen by either.
    if (id !== DIFFICULTY_ALL && countFor(id) === 0) return;
    setTouched(true);
    if (id === DIFFICULTY_ALL) selectAll();
    else toggle(id);
  };
  const commit = () => {
    onChange(
      tracks
        .filter((track) => draft.has(track.id))
        .map((track) => track.id)
        .join(","),
    );
    close(true);
  };
  const openAt = () => {
    setDraft(new Set(committed));
    setCursor(0);
    setTouched(false);
    onOpenChange(true);
  };

  // Move focus into the list once it mounts so arrow keys work without a tab stop.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const presence = usePresence(open, POPUP_EXIT_MS);
  // The visible title is the host's brand, never a hardcoded default: the deck and
  // the document title already follow the visited address, and so must this one.
  const brand = siteBrand(locale ?? "en");

  return (
    <div className="vocab-difficulty" data-no-gesture>
      {/* The title doubles as the trigger; the tagline slot reports the current pick. */}
      <button
        ref={trigger}
        type="button"
        className="vocab-brand"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${brand.lead}${brand.accent} — ${t(ui, "difficulty.aria", { label: summary.label })}`}
        onClick={() => (open ? close(true) : openAt())}
      >
        {/* The title needs its own wrapper: .vocab-brand is a column flex, so a bare
            text node plus a span would become two stacked flex items and break
            "hoa.chayLá" across two lines. */}
        <span className="vocab-brand-name">
          {brand.lead}
          <span>{brand.accent}</span>
        </span>
        <small>
          {/* Single nowrap line, taken out of flow in CSS so it can read in full
              without pushing the gear or the centred controls. */}
          <span className="vocab-difficulty-current">
            <span className="vocab-difficulty-current-emoji" aria-hidden="true">
              {summary.emoji}
            </span>
            {summary.label}
            {summary.band ? ` · ${summary.band}` : ""}
          </span>
          <ChevronDown size={12} data-open={open || undefined} aria-hidden="true" />
        </small>
      </button>
      {presence.mounted && <PopupScrim closing={presence.closing} onDismiss={() => close(false)} />}
      {presence.mounted && (
        <div
          className="vocab-difficulty-pop"
          data-closing={presence.closing || undefined}
          inert={presence.closing || undefined}
        >
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-multiselectable
            tabIndex={-1}
            className="vocab-difficulty-options"
            aria-label={t(ui, "difficulty.label")}
            aria-activedescendant={`${listId}-opt-${cursor}`}
            onKeyDown={(event) => {
              switch (event.key) {
                case "Escape":
                  event.preventDefault();
                  close(true);
                  break;
                case "ArrowDown":
                  event.preventDefault();
                  setCursor((index) => (index + 1) % options.length);
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  setCursor((index) => (index - 1 + options.length) % options.length);
                  break;
                case "Home":
                  event.preventDefault();
                  setCursor(0);
                  break;
                case "End":
                  event.preventDefault();
                  setCursor(options.length - 1);
                  break;
                case "Enter":
                case " ":
                  event.preventDefault();
                  pickRow(options[cursor]!.id);
                  break;
                default:
                  break;
              }
            }}
          >
            {options.map((option, index) => {
              const isSelected =
                option.id === DIFFICULTY_ALL ? draft.size === 0 : draft.has(option.id);
              const count = countFor(option.id);
              // A track the catalog cannot serve yet (its defining level has no words) shows
              // 0 and is greyed: it stays on the ladder as a promise, but cannot be picked.
              const unavailable = count === 0 && option.id !== DIFFICULTY_ALL;
              return (
                <li
                  key={option.id}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  data-active={isSelected || undefined}
                  data-cursor={index === cursor || undefined}
                  aria-disabled={unavailable || undefined}
                  className="vocab-difficulty-option"
                  onClick={() => {
                    pickRow(option.id);
                    setCursor(index);
                  }}
                  onMouseEnter={() => setCursor(index)}
                >
                  <span className="vocab-difficulty-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <span className="vocab-difficulty-option-label">
                    {/* The chip slot always renders, and every chip carries the same width
                        whether it holds "A2" or "A1–A2", so all the level names after it
                        begin on one vertical line. */}
                    <span
                      className="vocab-difficulty-band"
                      data-empty={option.band ? undefined : true}
                      aria-hidden={option.band ? undefined : true}
                    >
                      {option.band}
                    </span>
                    {option.label}
                  </span>
                  {/* key=count re-mounts the figure whenever the sum moves, which is what
                      (re)triggers the spring-and-flash CSS entrance on it. */}
                  <span className="vocab-difficulty-count" aria-hidden="true" key={count}>
                    {count === undefined ? "–" : count.toLocaleString("vi-VN")}
                  </span>
                </li>
              );
            })}
          </ul>
          {/* Floating confirm bar: a gradient fade lets the last rows read through it as
              they scroll beneath, while Library and Done stay clickable above. */}
          <div className="vocab-difficulty-foot">
            <Link
              to="/feed/library"
              className="vocab-difficulty-library"
              onClick={() => close(false)}
            >
              <Library size={16} aria-hidden="true" />
              {t(ui, "addWord")}
            </Link>
            {touched && (
              <button type="button" className="vocab-difficulty-done" onClick={commit}>
                {t(ui, "difficulty.done")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Control word selection separately from appearance. @param props Settings and callbacks. @returns Public header and options panel. */
export function FeedControls({
  metadata,
  filters,
  presentation,
  onFilters,
  onPresentation,
  onShuffle,
  open,
  onOpen,
  reducedMotion,
  historyStats,
  onClearHistory,
  onExport,
  locale,
}: {
  metadata?: FeedPage;
  filters: VocabularyFilters;
  presentation: Presentation;
  onFilters: (value: VocabularyFilters) => void;
  onPresentation: (value: Presentation) => void;
  onShuffle: () => void;
  open: boolean;
  onOpen: (value: boolean) => void;
  reducedMotion: boolean;
  historyStats: HistoryStats;
  onClearHistory: () => void;
  /** Open the video-export studio. Passed only for admins; absent, the control is not rendered. */
  onExport?: () => void;
  /** Visited address's deck locale; the brand title follows it (undefined → English). */
  locale?: TargetLocale;
}) {
  const ui = useLocale();
  const panelId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const toolbar = useRef<HTMLElement>(null);
  const ambient = useAmbientSound();
  const close = () => {
    onOpen(false);
    toggleButton.current?.focus();
  };
  const options = usePresence(open, POPUP_EXIT_MS);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [ecoOpen, setEcoOpen] = useState(false);
  // Guardrail while any sheet is out: the first tap on anything outside the open
  // popup — the gear, the title, a transport icon, the dock, even the empty toolbar —
  // only hides the sheet. It never also acts as a press of the control underneath,
  // so two popups can never overlap or trade places in one tap; the next tap works
  // normally. document capture (not the toolbar element) because the dock and the
  // scrims live outside the header; taps inside the sheets pass through untouched,
  // and keyboard events are not intercepted at all.
  // The listeners stay mounted for the whole session and read state through refs:
  // closing on pointerdown would otherwise re-run the effect and REMOVE the click
  // listener before the same gesture's click arrives, letting the tapped button
  // fire anyway (verified as a real leak). Instead the intercepted pointerdown arms
  // a one-shot that swallows exactly that trailing click — within a short window,
  // so a drag that never produces a click cannot eat the next real tap.
  const armedRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  const swallowClickBefore = useRef(0);
  useEffect(() => {
    armedRef.current = open || difficultyOpen;
    onOpenRef.current = onOpen;
  });
  useEffect(() => {
    function onInterceptPointerDown(event: PointerEvent) {
      if (!armedRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      // instanceof Element, not HTMLElement: tapping a row's svg glyph must count as
      // inside the sheet too.
      if (target.closest(".vocab-options, .vocab-difficulty-pop")) return;
      event.preventDefault();
      event.stopPropagation();
      swallowClickBefore.current = event.timeStamp;
      setDifficultyOpen(false);
      onOpenRef.current(false);
    }
    function onInterceptClick(event: MouseEvent) {
      const armedAt = swallowClickBefore.current;
      if (!armedAt) return;
      swallowClickBefore.current = 0;
      // Only the click of the dismissing gesture itself — same time origin as
      // PointerEvent.timeStamp in every modern browser.
      if (event.timeStamp - armedAt > 700) return;
      event.preventDefault();
      event.stopPropagation();
    }
    document.addEventListener("pointerdown", onInterceptPointerDown, true);
    document.addEventListener("click", onInterceptClick, true);
    return () => {
      document.removeEventListener("pointerdown", onInterceptPointerDown, true);
      document.removeEventListener("click", onInterceptClick, true);
    };
  }, []);

  // Opening the app fan pauses the stream: the reader is looking at the menu, so
  // letting words keep turning behind it would lose them one per tick. Closing
  // restores whatever autoplay was before, rather than forcing it on.
  const resumeAfterEco = useRef(false);
  const toggleEco = useCallback(
    (next: boolean) => {
      setEcoOpen(next);
      if (next) {
        resumeAfterEco.current = presentation.autoplay;
        if (presentation.autoplay) onPresentation({ ...presentation, autoplay: false });
      } else if (resumeAfterEco.current) {
        resumeAfterEco.current = false;
        onPresentation({ ...presentation, autoplay: true });
      }
    },
    [presentation, onPresentation],
  );
  // The options sheet is notched around whichever control owns the top-right
  // corner, so it needs that control's real width — .vocab-icon-button is 44px
  // but shrinks to 34 and then 30 at narrower widths, and a hard-coded half
  // would leave the cut-out off the button on every small screen.
  useEffect(() => {
    const host = toolbar.current;
    if (!host) return;
    const corner = host.querySelector<HTMLElement>(".vocab-corner-button, .eco-trigger");
    if (!corner) return;
    const sync = () => host.style.setProperty("--vocab-corner", `${corner.offsetWidth}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(corner);
    return () => observer.disconnect();
  }, []);

  /** The stream is only really playing while autoplay is on AND motion is allowed. */
  const playing = presentation.autoplay && !reducedMotion;
  return (
    <header className="vocab-toolbar" ref={toolbar}>
      <div className="vocab-toolbar-row">
        {/* Left: just the title, which is the difficulty trigger. Settings moved
            to the top-right corner — see the right column. */}
        <div className="vocab-toolbar-left">
          <DifficultyDropdown
            value={filters.difficulty}
            onChange={(difficulty) => onFilters({ ...filters, difficulty })}
            open={difficultyOpen}
            onOpenChange={setDifficultyOpen}
            levelCounts={metadata?.levelCounts}
            catalogLevels={metadata?.levels}
            total={metadata?.topicTotal}
            locale={locale}
            uiLocale={ui}
          />
        </div>
        {/* Centre: the three transport controls as bare icons split by two hairlines,
            centred on the top edge. */}
        <div className="vocab-player-controls">
          <button
            className="vocab-icon-button"
            type="button"
            disabled={reducedMotion}
            onClick={() => onPresentation({ ...presentation, autoplay: !presentation.autoplay })}
            aria-label={playing ? t(ui, "player.pause") : t(ui, "player.play")}
            aria-pressed={playing}
            data-active={playing || undefined}
          >
            {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} />}
          </button>
          <span className="vocab-control-sep" aria-hidden="true" />
          <button
            className="vocab-icon-button"
            type="button"
            onClick={ambient.toggle}
            aria-label={ambient.enabled ? t(ui, "player.mute") : t(ui, "player.unmute")}
            aria-pressed={ambient.enabled}
            data-active={ambient.enabled || undefined}
          >
            {ambient.enabled ? <Volume2 size={19} fill="currentColor" /> : <VolumeX size={19} />}
          </button>
          <span className="vocab-control-sep" aria-hidden="true" />
          <button
            className="vocab-icon-button"
            type="button"
            onClick={() => {
              onShuffle();
              ambient.nextTrack();
            }}
            aria-label={t(ui, "player.shuffle")}
          >
            <Shuffle size={19} />
          </button>
          {onExport && (
            <button
              className="vocab-icon-button vocab-export-open"
              type="button"
              onClick={onExport}
              aria-label={t(ui, "player.export")}
              title={t(ui, "player.export")}
            >
              <Clapperboard size={19} />
            </button>
          )}
        </div>
        {/* Right: the corner control. While the sibling apps are unannounced the
            app panel is gone entirely and Settings takes the corner; when the
            store ships, the corner goes back to the app panel and Settings
            becomes a tile inside it. Either way the sheet pops from HERE. */}
        {ECOSYSTEM_STORE_AVAILABLE ? (
          <EcosystemMenu
            open={ecoOpen}
            onOpenChange={toggleEco}
            reducedMotion={reducedMotion}
            onOpenSettings={() => onOpen(true)}
          />
        ) : (
          <button
            className="vocab-icon-button vocab-corner-button"
            type="button"
            ref={toggleButton}
            onClick={() => (open ? close() : onOpen(true))}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t(ui, "options.close") : t(ui, "options.open")}
            data-active={open || undefined}
          >
            {open ? <X size={19} /> : <Settings size={19} />}
          </button>
        )}
      </div>
      {options.mounted && <PopupScrim closing={options.closing} onDismiss={() => onOpen(false)} />}
      {options.mounted && (
        <section
          id={panelId}
          className="vocab-options"
          data-closing={options.closing || undefined}
          inert={options.closing || undefined}
          aria-label={t(ui, "options.title")}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <p className="vocab-options-summary">
            {metadata
              ? t(ui, "catalog.summary", { count: metadata.total.toLocaleString() })
              : t(ui, "catalog.loading")}{" "}
            {t(ui, "catalog.cycle")}
          </p>
          <div className="vocab-options-secondary">
            <span className="vocab-group-label">{t(ui, "options.secondary")}</span>
            <div className="vocab-select-grid">
              <OptionPicker
                label={t(ui, "topic.label")}
                value={filters.topic}
                options={[
                  { id: "", label: t(ui, "topic.all") },
                  ...(metadata?.topics ?? []).map((topic) => ({
                    id: topic,
                    label: topicLabel(topic, ui),
                  })),
                ]}
                onChange={(topic) => onFilters({ ...filters, topic })}
              />
              <ThemePicker
                value={presentation.theme}
                onChange={(theme) => onPresentation({ ...presentation, theme })}
                dialect={presentation.dialect}
                uiLocale={ui}
              />
              <OptionPicker
                label={t(ui, "style.label")}
                value={presentation.style}
                options={[
                  { id: "mix", label: t(ui, "style.mix") },
                  ...stylePool(presentation.dialect).map((style) => ({
                    id: style.id,
                    label:
                      presentation.dialect === "douyin"
                        ? douyinStyleLabel(style.id, style.label, ui)
                        : styleLabel(style.id, style.label, ui),
                  })),
                ]}
                onChange={(style) =>
                  onPresentation({ ...presentation, style: style as NarrativeStyle | "mix" })
                }
              />
              <OptionPicker
                label={t(ui, "language.label")}
                value={ui}
                options={SUPPORTED_LOCALES.map((code) => ({
                  id: code,
                  label: localeLabel(code),
                }))}
                onChange={(code) => setLocale(code as Locale)}
              />
            </div>
          </div>
          <label className="vocab-autoplay">
            <input
              type="checkbox"
              checked={presentation.advance !== false && !reducedMotion}
              disabled={reducedMotion}
              onChange={(event) =>
                onPresentation({ ...presentation, advance: event.target.checked })
              }
            />{" "}
            {t(ui, "advance.label")}
          </label>
          <p className="vocab-options-summary">
            {reducedMotion
              ? t(ui, "autoplay.reduced")
              : presentation.advance === false
                ? t(ui, "advance.replayHint")
                : t(ui, "advance.flowHint")}
          </p>
          <div className="vocab-pace" role="radiogroup" aria-label={t(ui, "pace.aria")}>
            <span className="vocab-pace-label">{t(ui, "pace.label")}</span>
            <div className="vocab-pace-options">
              {PACE_OPTIONS.map((option) => {
                const on = (presentation.pace ?? "fast") === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    data-on={on || undefined}
                    disabled={reducedMotion}
                    onClick={() => onPresentation({ ...presentation, pace: option.id })}
                  >
                    {t(ui, `pace.${option.id}`)}
                  </button>
                );
              })}
            </div>
          </div>
          {/* The Douyin dialect only exists on the Chinese host: it swaps the whole
              visual language — palettes, motion presets and highlight reskin — and
              deactivates the default one, so it is offered nowhere else. */}
          {locale === "zh" && (
            <label className="vocab-autoplay vocab-dialect">
              <input
                type="checkbox"
                checked={presentation.dialect === "douyin"}
                onChange={(event) =>
                  onPresentation({
                    ...presentation,
                    // A dialect flip invalidates an allow-list picked from the other
                    // pool; "mix" reopens the full new collection instead.
                    theme: "mix",
                    dialect: event.target.checked ? "douyin" : "default",
                  })
                }
              />{" "}
              {t(ui, "dialect.label")}
              <small className="vocab-dialect-note">{t(ui, "dialect.note")}</small>
            </label>
          )}
          <div className="vocab-memory" aria-label={t(ui, "memory.aria")}>
            <span className="vocab-group-label">{t(ui, "memory.label")}</span>
            <p className="vocab-options-summary">
              {t(ui, "memory.stats", {
                today: historyStats.distinctToday,
                three: historyStats.distinct3d,
                week: historyStats.distinct7d,
              })}
            </p>
            <button type="button" className="vocab-memory-clear" onClick={onClearHistory}>
              {t(ui, "memory.forget")}
            </button>
          </div>
          <nav aria-label={t(ui, "nav.aria")} className="vocab-site-links">
            {/* Community is not open to readers yet; only the button is hidden, the
                /community route still resolves. Flip COMMUNITY_AVAILABLE to bring it back. */}
            {COMMUNITY_AVAILABLE && <Link to="/community">{t(ui, "nav.community")}</Link>}
            {/* Temporarily hidden at request: "Đăng nhập" and "Về với từ vựng" leave the
                sheet for now — uncomment (both live together) to bring them back. The
                /auth route and the close behaviour are untouched.
            <Link to="/auth">Đăng nhập</Link>
            <button type="button" onClick={close}>
              Về với từ vựng
            </button>
            */}
          </nav>
        </section>
      )}
    </header>
  );
}
