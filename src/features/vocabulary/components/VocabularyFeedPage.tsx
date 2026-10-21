/** Public vocabulary page orchestration. Exports: VocabularyFeedPage. Depends on: controls, stream, reduced-motion preference, font readiness, track rotation. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import { useShellHeightVar } from "@/hooks/use-shell-height-var";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { DIFFICULTY_ALL } from "../lib/difficulty";
import { isJapaneseLevel, type VocabularyLevel } from "../lib/schema";
import { SHORT_VIEWPORT_MAX_H } from "../lib/landscape-geometry";
import { useIsAdmin } from "@/features/admin/hooks/useIsAdmin";
import { useFontsReady } from "../hooks/useFontsReady";
import { useTrackRotation } from "../hooks/useTrackRotation";
import { useViewHistory } from "../hooks/useViewHistory";
import { getActiveVocabWording } from "@/features/admin/api/wording.functions";
import { FeedControls } from "./FeedControls";
import { VocabularyStream } from "./VocabularyStream";
import { SavedDrawer } from "./SavedDrawer";
import { DifficultyOnboarding } from "./DifficultyOnboarding";
import { fetchVocabularyPage } from "../api/feed";
import { readDifficultyChoice, writeDifficultyChoice } from "../lib/difficulty-choice";
import { readDialectChoice, writeDialectChoice } from "../lib/dialect-choice";
import { readPreferences, writePreferences } from "@/features/settings/lib/preferences";
import { DEFAULT_TARGET, type TargetLocale } from "../lib/target-language";
import { CUSTOM_PACK_EVENT, clearCustomPack, readCustomPack } from "../lib/custom-pack";
import { Link } from "@tanstack/react-router";
import "../vocabulary.css";

function newSeed(): string {
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

/** Every word, no category and no difficulty track. */
const ALL_FILTERS: VocabularyFilters = { topic: "", level: "", difficulty: DIFFICULTY_ALL };

/**
 * Open the word stream without authentication or persistent storage.
 * @param props.locale Visited address's deck locale; the toolbar title follows it.
 * @returns Public feed and preferences.
 */
export function VocabularyFeedPage({ locale }: { locale?: TargetLocale }) {
  const [prefs] = useState(() => readPreferences());
  // Use targetLanguage from preferences if set, otherwise use the host-based locale.
  const effectiveLocale: TargetLocale =
    (prefs.targetLanguage as TargetLocale) || locale || DEFAULT_TARGET;
  // Settings only exposes the Japanese proficiency for a Japanese deck.
  // A non-empty level seeds the level filter only; difficulty remains independent.
  const preferredJapaneseLevel: VocabularyLevel | "" =
    effectiveLocale === "ja" && isJapaneseLevel(prefs.japaneseLevel) ? prefs.japaneseLevel : "";
  const [seed, setSeed] = useState(newSeed);
  const [filters, setFilters] = useState<VocabularyFilters>(ALL_FILTERS);
  const [presentation, setPresentation] = useState<Presentation>(() => ({
    theme: "mix",
    style: "mix",
    autoplay: true,
    advance: true,
    pace: "normal",
    // Only the Chinese host honors the stored Douyin-dialect preference; every
    // other address renders the default visuals even on a device that switched.
    dialect: effectiveLocale === "zh" ? readDialectChoice() : "default",
  }));
  // The dialect is a device-level preference: remember it the moment it flips so
  // the next visit to this host opens in the same visual language.
  const handlePresentation = useCallback(
    (next: Presentation) => {
      if (next.dialect !== presentation.dialect) writeDialectChoice(next.dialect ?? "default");
      setPresentation(next);
    },
    [presentation.dialect],
  );
  // Keep the Settings proficiency in step with a level chosen from the feed itself.
  // Difficulty choices never write this preference.
  const rememberJapaneseLevel = useCallback(
    (level: VocabularyFilters["level"]) => {
      if (effectiveLocale !== "ja") return;
      const japaneseLevel = isJapaneseLevel(level) ? level : "";
      const current = readPreferences();
      if (current.japaneseLevel === japaneseLevel) return;
      writePreferences({ ...current, japaneseLevel });
    },
    [effectiveLocale],
  );
  const [metadata, setMetadata] = useState<FeedPage>();
  // "pending" until the stored choice has been read (storage is not readable while the
  // page is server-rendered), then either the first-load level picker or the feed. The
  // stream is not mounted before that, so it never starts on "every level" only to be
  // thrown away a moment later for the level the reader actually keeps.
  const [stage, setStage] = useState<"pending" | "onboarding" | "feed">("pending");
  // Imported pack (browser-only). Its own levels may not match a stored track, so it
  // skips onboarding, plays every word, and keeps theme/style on random mix.
  const [packName, setPackName] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const pack = readCustomPack();
      setPackName(pack?.catalog.name ?? null);
      if (pack) {
        setFilters(ALL_FILTERS);
        setPresentation((p) => ({ ...p, theme: "mix", style: "mix" }));
        setStage("feed");
      }
      setSeed(newSeed());
    };
    window.addEventListener(CUSTOM_PACK_EVENT, sync);
    return () => window.removeEventListener(CUSTOM_PACK_EVENT, sync);
  }, []);
  useEffect(() => {
    const pack = readCustomPack();
    if (pack) {
      setPackName(pack.catalog.name);
      setStage("feed");
      return;
    }
    const stored = readDifficultyChoice(effectiveLocale);
    // The Settings level seeds only the level filter; the stored difficulty choice is
    // applied alongside it, never replaced by it.
    if (preferredJapaneseLevel) {
      setFilters({
        ...ALL_FILTERS,
        level: preferredJapaneseLevel,
        difficulty: stored ?? DIFFICULTY_ALL,
      });
      setStage("feed");
      return;
    }
    if (stored === null) {
      // Japanese is the app's default deck. A first-time reader should see the
      // complete catalog immediately, not a level picker that hides words until
      // they choose; the difficulty menu can still narrow the stream afterwards.
      if (effectiveLocale === "ja") {
        setFilters(ALL_FILTERS);
        setStage("feed");
        return;
      }
      setStage("onboarding");
      return;
    }
    setFilters((current) => ({ ...current, difficulty: stored }));
    setStage("feed");
  }, [effectiveLocale, preferredJapaneseLevel]);
  // The picker needs the catalog's level counts and sample words before any stream exists.
  // They ride on every feed page, so one small, unfiltered request supplies them.
  const { data: ladder } = useQuery({
    queryKey: ["vocab-level-ladder", effectiveLocale],
    queryFn: ({ signal }) =>
      fetchVocabularyPage(
        {
          seed: "level-ladder",
          filters: ALL_FILTERS,
          cursor: { position: 0 },
          signal,
        },
        effectiveLocale,
      ),
    enabled: stage === "onboarding",
    staleTime: Infinity,
  });
  const pickDifficulty = useCallback((difficulty: string) => {
    writeDifficultyChoice(difficulty);
    setFilters((current) => ({ ...current, difficulty }));
    setSeed(newSeed());
    setStage("feed");
  }, []);
  // The saved drawer suspends the feed behind it rather than navigating away.
  const [savedOpen, setSavedOpen] = useState(false);
  // The landscape chrome measures itself against this, not against dvh, and the
  // short-viewport tier is keyed on the same measurement (data-short-viewport).
  const shell = useRef<HTMLElement>(null);
  useShellHeightVar(shell, { shortMaxHeight: SHORT_VIEWPORT_MAX_H });
  const [optionsOpen, setOptionsOpen] = useState(false);
  // Video export is an admin tool; for everyone else the control is never rendered
  // and the studio's code is never downloaded.
  const isAdmin = useIsAdmin();
  const [exportOpen, setExportOpen] = useState(false);
  const openExport = useCallback(() => {
    setOptionsOpen(false);
    setExportOpen(true);
  }, []);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const viewHistory = useViewHistory();
  const reducedMotion = !!useReducedMotion();
  // No rotate-to-portrait gate here: the feed has its own landscape layout (two-column
  // answer page, compact chrome, measured shell height). The post-player surfaces, which
  // only letterbox, keep theirs. Keep the screen lit while the feed is open.
  useScreenWakeLock(true);
  // The stream still mounts and fetches while fonts load; only the text is held.
  const fontsReady = useFontsReady();
  // Each word that comes on screen is logged to the viewing history and counted
  // towards the current music track's run.
  const music = useTrackRotation();
  const recordView = viewHistory.record;
  // Fetch the active wording preset for the reveal button label
  const { data: activeWording } = useQuery({
    queryKey: ["vocab-active-wording"],
    queryFn: getActiveVocabWording,
    staleTime: 60_000, // Cache for 1 minute
  });
  const handleRecordView = useCallback(
    (wordId: string) => {
      recordView(wordId);
      music.wordStarted();
    },
    [recordView, music],
  );
  const shuffle = () => {
    setSeed(newSeed());
    setOptionsOpen(false);
  };
  if (stage !== "feed") {
    return (
      <main className="vocabulary-shell" ref={shell}>
        {stage === "onboarding" && (
          <DifficultyOnboarding
            metadata={ladder}
            locale={effectiveLocale}
            onPick={pickDifficulty}
          />
        )}
      </main>
    );
  }
  return (
    <main className="vocabulary-shell" ref={shell}>
      <FeedControls
        metadata={metadata}
        filters={filters}
        locale={effectiveLocale}
        presentation={presentation}
        onFilters={(value) => {
          // Confirming a picker without changing anything is not a new stream. A fresh
          // seed remounts the whole feed on a different word, so "Xong" on an untouched
          // difficulty list — or re-picking the topic already chosen — used to throw away
          // the word on screen for no reason the reader could see.
          if (
            value.topic === filters.topic &&
            value.level === filters.level &&
            value.difficulty === filters.difficulty
          )
            return;
          if (value.difficulty !== filters.difficulty) writeDifficultyChoice(value.difficulty);
          if (value.level !== filters.level) rememberJapaneseLevel(value.level);
          setFilters(value);
          setSeed(newSeed());
        }}
        onPresentation={handlePresentation}
        open={optionsOpen}
        onOpen={setOptionsOpen}
        reducedMotion={reducedMotion}
        historyStats={viewHistory.stats}
        onClearHistory={viewHistory.clear}
        onExport={isAdmin ? openExport : undefined}
      />
      {packName && (
        <div className="vocab-custom-pack-chip" role="status">
          <Link to="/feed/library" className="vocab-custom-pack-name">
            Gói của bạn: {packName}
          </Link>
          <button type="button" onClick={clearCustomPack} aria-label="Thoát gói của bạn">
            ×
          </button>
        </div>
      )}
      <SavedDrawer open={savedOpen} onOpenChange={setSavedOpen} />
      <VocabularyStream
        key={`${packName ?? ""}:${seed}:${filters.topic}:${filters.level}:${filters.difficulty}`}
        seed={seed}
        filters={filters}
        locale={effectiveLocale}
        presentation={presentation}
        reducedMotion={reducedMotion}
        suspended={optionsOpen || savedOpen || !fontsReady || exportOpen}
        exportOpen={isAdmin && exportOpen}
        onCloseExport={closeExport}
        history={viewHistory.history}
        onRecordView={handleRecordView}
        onWordEnding={music.wordEnding}
        onClearHistory={viewHistory.clear}
        onMetadata={setMetadata}
        onRestart={shuffle}
        onClearFilters={() => {
          writeDifficultyChoice(ALL_FILTERS.difficulty);
          rememberJapaneseLevel("");
          setFilters(ALL_FILTERS);
        }}
        revealButtonLabel={activeWording?.reveal_button}
        onToggleAutoplay={() => setPresentation((p) => ({ ...p, autoplay: !p.autoplay }))}
      />
    </main>
  );
}
