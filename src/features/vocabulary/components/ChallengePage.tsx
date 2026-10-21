/**
 * The page a challenge link opens: a word held back as a mystery, with a box to
 * guess it.
 *
 * The point of the whole feature is that the LINK gives nothing away, so nothing
 * here may either until the reader has had a go: the answer is not in the heading,
 * the URL, or the page metadata (see the route's head — a link preview that
 * printed the word would end the game in the chat thread).
 *
 * Exports: ChallengePage
 * Depends on: router, findWordByShareCode, answerPattern, vocabulary.css
 */

import { Link, useParams } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { findWordByShareCode } from "../lib/saved-words";
import { resolveClue } from "../lib/clues";
import { t } from "../lib/ui-copy";
import { useLocale } from "../lib/useLocale";
import { MarkedText } from "./MarkedText";
import { WordPronunciation } from "./WordPronunciation";
import "../vocabulary.css";

/** Compare a guess the way a person means it: case and spacing do not count. */
function matches(guess: string, answer: string): boolean {
  const tidy = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return tidy(guess) === tidy(answer);
}

/**
 * Guess-the-word page for a shared code.
 * @returns The mystery, or a "code not found" state.
 */
export function ChallengePage(): React.ReactElement {
  const { code = "" } = useParams({ strict: false }) as { code?: string };
  const ui = useLocale();
  const word = useMemo(() => findWordByShareCode(code), [code]);
  const [guess, setGuess] = useState("");
  const [wrong, setWrong] = useState(0);
  const [solved, setSolved] = useState(false);

  if (!word) {
    return (
      <main className="vocabulary-shell vocab-challenge-shell">
        <div className="vocab-challenge-card">
          <h1 className="vocab-challenge-title">{t(ui, "challenge.notFoundTitle")}</h1>
          <p className="vocab-challenge-body">
            {t(ui, "challenge.notFoundBody", { code: code.toUpperCase() })}
          </p>
          <Link className="vocab-light-button" to="/feed">
            {t(ui, "challenge.openFeed")}
          </Link>
        </div>
      </main>
    );
  }

  const letters = word.word.replace(/[^\p{L}]/gu, "").length;
  const initial = word.word[0]?.toUpperCase() ?? "";
  // Resolve before testing: a Japanese-led deck has a localized lead and no base one.
  const clue = resolveClue(word, "lead", ui);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!word || solved) return;
    if (matches(guess, word.word)) setSolved(true);
    else setWrong((count) => count + 1);
  }

  return (
    <main className="vocabulary-shell vocab-challenge-shell">
      <div className="vocab-challenge-card">
        <p className="vocab-challenge-eyebrow">{t(ui, "challenge.eyebrow")}</p>

        {/* The clue, never the answer. */}
        {clue && (
          <p className="vocab-challenge-clue" lang={ui}>
            <MarkedText text={clue} />
          </p>
        )}
        <p className="vocab-challenge-hint">
          {t(ui, "challenge.hint", { count: letters, initial })}
        </p>

        {solved ? (
          <div className="vocab-challenge-answer">
            <h1 className="vocab-challenge-word" lang="en">
              {word.word}
            </h1>
            <WordPronunciation word={word} className="vocab-challenge-pronunciation" />
            <p className="vocab-challenge-def" lang={ui}>
              <MarkedText
                text={ui === "ja" && word.meaningJP ? word.meaningJP : resolveClue(word, "def", ui)}
              />
            </p>
            <p className="vocab-challenge-body">{t(ui, "challenge.solved")}</p>
            <Link className="vocab-light-button" to="/feed">
              {t(ui, "challenge.learnMore")}
            </Link>
          </div>
        ) : (
          <form className="vocab-challenge-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="vocab-guess">
              {t(ui, "challenge.guessLabel")}
            </label>
            <input
              id="vocab-guess"
              className="vocab-challenge-input"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              placeholder={t(ui, "challenge.guessPlaceholder")}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              lang="en"
            />
            <button
              className="vocab-challenge-send"
              type="submit"
              aria-label={t(ui, "challenge.send")}
            >
              <Send size={17} />
            </button>
            {wrong > 0 && (
              <p className="vocab-challenge-wrong" role="status">
                {t(ui, "challenge.wrong", { count: wrong })}
              </p>
            )}
          </form>
        )}

        <Link className="vocab-challenge-back" to="/feed">
          <ArrowLeft size={15} aria-hidden="true" />
          {t(ui, "challenge.back")}
        </Link>
      </div>
    </main>
  );
}
