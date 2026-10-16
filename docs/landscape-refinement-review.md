# Landscape Mode — Review & Refinement Plan

> Status: **implemented (uncommitted)** — R1, R2, R3, R4, R6 landed; R5 shipped as derived
> geometry (`lib/landscape-geometry.ts`) rather than live band measurement; R7 shipped as
> `npm run check:landscape` + `npm run check:orientation-gate`. Open: R8 toolbar audit, F9
> non-Latin two-column check, real-device pass. Headless probe (9 viewports, 568×320 → 1280×700
> plus 390×844): tier attribute flips exactly at 560/561, `/feed` never shows the gate, clue text
> stays above `progress − foot` everywhere, details never touch the chrome, and the two-column
> answer now sits 6–7px from its burst — the same offset portrait has (was ~30px at 844×390).
>
> Original note: written against working tree `5f4be92` + the then-uncommitted landscape work.
> Line references below were correct at writing time and may drift.

---

## 1. Where landscape stands today

### 1.1 The layered history

| Layer | Commit / state | What it does |
|---|---|---|
| Orientation gate | `7d79947`, restored in `f5144c8` | "Rotate to portrait" overlay on touch + short-landscape, behind a two-level kill switch (`src/lib/orientation-gate.ts`) |
| Proportional reveal split | `8e9a3c4` | Wide cards split free height between word band and meaning panel via `--vocab-reveal-*` vars; frame emphasis suppressed (`allowFrameEmphasis={!landscape}`); fit-loop crash fixed with pixel tolerance |
| Clue-page fit fix | landscape unlock session | `getVocabularyTextHeightBudget` reserves `getTextSafeInsets` instead of the fixed 320px portrait chrome on wide cards (`presets.ts:497-516`) |
| Bottom chrome band | `@media (max-height: 560px)` tier | Chrome compressed into ~15% of screen height; derived variable stack `--vocab-chrome-*` (`vocabulary.css:5326-5361`) |
| Onboarding gauge flip | `604910e` | Horizontal rail via `data-landscape` + matchMedia, axis-aware pointer mapping, gradient angle owned by inline `--rung-scale` (`vocabulary.css:3996-4170`) |
| Empty-vault scene | landscape vault tier | Keys + bubbles only, jar/chips dropped (`vocabulary.css:3477+`) |
| Backdrop drift fix | `@media (orientation: landscape) and (max-height: 560px)` | Widens the gradient strip so page turns don't show two scenes meeting (`vocabulary.css:1668-1672`) |
| **In progress (uncommitted)** | working tree | ① two-column answer page (`data-reveal-split="two-column"`), ② `--vocab-vh` measured shell height replacing `15dvh`, ③ reaction counts side-by-side in short landscape |

### 1.2 The three in-flight pieces

**① Two-column answer page** — `VocabularyCard.tsx:163-177, 453-466, 770-777, 890-906`
When `wideCard && height <= 560` the card publishes `data-reveal-split="two-column"` and
`--vocab-word-col: 46%`; CSS cuts the word band to the left column and gives the meaning
panel the full-height right column (`vocabulary.css:5450-5490`). The answer word is fitted
against `revealCanvasWidth = round(textWidth * 0.46)` so fit and geometry share one number.

**② `--vocab-vh` measured height** — `src/hooks/use-shell-height-var.ts`
ResizeObserver + `orientationchange` + `visualViewport.resize` keep `--vocab-vh` equal to the
shell's laid-out height; the chrome band reads `max(calc(var(--vocab-vh, 100dvh) * 0.15), 72px)`
instead of `15dvh` (`vocabulary.css:5340`). Motivation is sound: dvh can report the previous
orientation for a frame or more after rotation on iOS/Android.

**③ Reaction counts side-by-side** — `vocabulary.css:5362-5395`
In short landscape the count label moves next to its glyph (row flex) because the 6px chrome
inset clipped the stacked 17px hang. A dedicated fade keyframe replaces the roll-in that
carries a centring translate.

### 1.3 Orientation truth-sources (currently four)

1. CSS `@media (orientation: landscape)` — viewport-based, flips first.
2. CSS `@media (max-height: 560px / 620px)` tiers — viewport-based.
3. JS `landscape = width > height` and `twoColumn = … height <= 560` — **card-box** measured via ResizeObserver (`VocabularyCard.tsx:454-462`).
4. `data-landscape` on onboarding — matchMedia state (`DifficultyOnboarding.tsx`).

They agree in steady state (the card fills the viewport) but can disagree transiently during
rotation and URL-bar animation. The new `data-reveal-split` design is the good pattern: **CSS
restates nothing, JS owns the decision** (see §3, R2 — the chrome tiers should follow it).

---

## 2. Findings — ordered by expected impact

### F1. `TWO_COLUMN_REVEAL_Y = 50` does not centre the word in its usable space (HIGH)

The band is deliberately stretched by the fit pipeline's asymmetric reserved margins
(`TEXT_SAFE_TOP_PX = 72`, `TEXT_SAFE_BOTTOM_PX = 132`, `playback-timing.ts:22-23`):

```
band top    = --vocab-reveal-head − 72  = 0
band bottom = 100% − head − word − 132  (word = --vocab-reveal-free in two-column)
band height = free + 72 + 132 = free + 204
usable area = band[72 … height−132]     → centre at 72 + free/2 from card top
```

Worked example, iPhone-class landscape **844×390** (chrome band 72 → chrome-top 72, head 72,
foot 12): `free = 390 − 72 − 72 − 12 = 234`; band height `438`; usable centre `189px` = **43.2%**
of the band. But `revealY` is a percentage of the *band* height, and the new constant passes
**50%** → word centre at `219px`, i.e. **30px below** the usable centre (147px clearance above,
87px below). The fraction only approaches 50% when `free ≈ 800px`, which no landscape phone
reaches.

Corroborating evidence inside the same feature: the burst CSS for two-column uses
`top: calc(var(--vocab-reveal-head) + var(--vocab-reveal-free) / 2)` (`vocabulary.css:5488`) —
the *usable* centre, 189px. So the celebration bursts 30px above the word it celebrates.

Note `WIDE_REVEAL_Y = 43` (stacked landscape) already encodes exactly this asymmetry
compensation; its comment ("the centre of the shorter band") shows the 43 was measured, not
guessed. The two-column comment ("a full-height column centres its word") re-derived 50 from
the column being full-height, but the *band* is still stretched asymmetrically.

**Proposed fix (pick one, verify visually):**
- **a.** `TWO_COLUMN_REVEAL_Y = 43` (reuse `WIDE_REVEAL_Y`; the fraction is 43–44% across the
  whole 320–560px height range — compute `(72 + free/2) / (free + 204)` at both ends).
- **b.** Make the two-column band symmetric instead: in the `[data-reveal-split]` rule set
  `top: calc(var(--vocab-reveal-head) - 72px)` **and** add a matching `+72` compensation on the
  bottom so usable space centres in the band, then 50 is honest. (Riskier: touches the fit
  pipeline's margin contract.)
- **c.** Long-term: stop passing magic percentages — have `VocabularyStage` measure the band
  rect and compute `revealY` from `(usableTop + usableBottom) / 2` (see R5).

Option **a** is a one-constant change and matches the stacked-landscape precedent.

### F2. The gate master switch is OFF and marked "restore before deploying" (HIGH — ship blocker)

`src/lib/orientation-gate.ts`:

```ts
/** !!! TEMPORARILY OFF FOR LANDSCAPE TESTING — RESTORE TO `true` BEFORE DEPLOYING. !!! */
export const ORIENTATION_GATE_ENABLED = false;
```

With the master off, **every** gated surface (vocabulary feed, FeedPage, PostPermalink,
Profile) shows kinetic content ungated in landscape — including the post-player surfaces that
have *no* landscape treatment (they letterbox into a centred 9:16 card, per the
portrait-only-surfaces architecture). The vocabulary feed is the only surface that has earned
ungated landscape.

**Decision needed before the next deploy** (this supersedes the recorded decision
"rotate-to-portrait gate chosen over landscape reflow", which was made when landscape was
explicitly deferred):
- **Ship landscape on /feed:** keep the gate **narrowed to the surfaces that still need it**
  (post-player/social/profile) rather than global — e.g. per-surface `useOrientationGate({surface})`
  or simply unmount it from `VocabularyFeedPage` again and leave the other three mounted with
  the master back at `true`. The three-layer seam already supports this; only the mount
  topology changes.
- **Or** keep the global gate on and treat landscape as dev-only (status quo ante).

Either way: flip the constant back to `true` (or delete the temporary comment) **in the same
commit** that decides the topology, and add a guard so a `false` master can't reach `main`
silently — e.g. a `scripts/check-orientation-gate.ts` that fails when
`ORIENTATION_GATE_ENABLED === false` unless an env/opt-out is present, wired like the other
`check:*` scripts.

### F3. Two clue-page reservations disagree with the real chrome (MEDIUM)

On a wide card the clue text budget reserves `getTextSafeInsets(height)` =
`max(72, 9%H) + max(132, 17%H)` (`presets.ts:511-515`). At 390px tall that's **204px**, but the
actual furniture is toolbar head **72px** + chrome-top **72px** = 144px. The clue page therefore
gives away ~60px (≈15% of the card) it doesn't need to — text lands smaller than it could.

The 132px bottom inset is a post-player constant (stage label + comment furniture), not a
vocabulary one. Now that the vocabulary chrome is a derived, *measured* stack
(`--vocab-chrome-top`), the reservation can read the same truth:

**Proposed fix:** add a vocabulary-specific reserve, e.g.
`getFeedChromeReserve(height) = head(72) + chromeTop(height)` where `chromeTop` mirrors the CSS
band formula (`max(0.15·h, 72)` → inset+bar+gap+progress), used by
`getVocabularyTextHeightBudget` when `width > height`. Keep `min(reservedHeight, …)` clamp
semantics so export (passes 0) and portrait (320) stay byte-identical. Add the pair
(CSS formula ↔ TS formula) to a guard script (R7) so they can't drift.

Bonus consistency: with F1 fixed, the reveal word and clue text will both be sized against the
same real free space.

### F4. `560` lives in five places, in two unit systems (MEDIUM)

The short-landscape threshold appears as:
- JS `SHORT_LANDSCAPE_MAX_H = 560` (card box height, `VocabularyCard.tsx:173`)
- CSS `@media (max-height: 560px)` chrome tier (`vocabulary.css:5326`)
- CSS `@media (orientation: landscape) and (max-height: 560px)` reaction counts (`:5371`)
- CSS same query for vault scene (`:3477`, `:3560`) and backdrop drift (`:1668`)

Media queries measure the **viewport**; the JS constant measures the **card**. They coincide
today (card fills the shell fills the viewport) but diverge exactly in the situations
`--vocab-vh` was invented for: rotation settle frames, URL-bar transitions, and any future
inset/padding between shell and card. A frame where CSS says "short landscape" but React has
not flipped `twoColumn` renders the stacked reveal geometry with the compacted chrome — survivable,
but it's the class of bug the hook's own doc comment calls out.

**Proposed fix (pattern already proven by `data-reveal-split`):** have
`useShellHeightVar` (or the card) also publish a `data-short-viewport` attribute on the shell
when the *measured* height ≤ 560, and rewrite the three `@media (orientation: landscape) and
(max-height: 560px)` blocks as `.vocabulary-shell[data-short-viewport] …` selectors (the
orientation condition is implied: measured height ≤ 560 with width > height — or keep
`(orientation: landscape)` media AND the attribute for belt-and-braces). One truth source, no
restated breakpoints — same contract the two-column block already boasts
("Nothing here restates the breakpoint").

Cheaper interim: a `check:*` script asserting `SHORT_LANDSCAPE_MAX_H` equals every `560` in
`vocabulary.css` (regex scan), so the copies can't drift silently.

### F5. `WIDE_REVEAL_Y` / `PORTRAIT_REVEAL_Y` are magic couplings to CSS geometry (MEDIUM, same family as F1)

`revealY` percentages (34 / 43 / 50) are only correct as long as the CSS band formulas
(`head − 72` top, `head + word + 132` bottom) keep their exact shape. Nothing enforces that —
a CSS tweak to `--vocab-reveal-head` silently moves the band centre away from the JS constant.
F1 is what this looks like when it bites.

**Proposed fix (when touching this code next, not urgent on its own):** compute the answer's
centre from the laid-out band: `VocabularyStage` already holds refs; read
`bandEl.getBoundingClientRect()` after the CSS applies and pass
`(usableTop + usableHeight / 2) / bandHeight * 100` down instead of a constant. The constants
then become first-paint estimates only — the same "estimate seeds the first pass, measurement
owns the rest" doctrine the measured-lines work established for clue pages. This also removes
the transient CSS-flips-before-React mismatch for reveal placement.

### F6. Toolbar has no landscape tier (LOW–MEDIUM, verify first)

`.vocab-toolbar` (`vocabulary.css:78+`) has no `@media (orientation: landscape)` block; the
reveal geometry hard-assumes a 72px head (`--vocab-reveal-head: 72px`). On a 390px-tall card
the toolbar's brand + tagline + control grid keep their portrait heights, and the tagline /
difficulty popover pair is absolutely-offset-coupled (per recorded architecture memory). If any
toolbar element actually exceeds 72px in landscape (larger dynamic-type setting, translated
brand on the zh/ko domains, options sheet open state), it overlaps the word band.

**Action:** measure toolbar height in landscape on the device matrix (§5). If it fits under 72
with margin, document the invariant in the CSS comment and add it to the guard script; if not,
either compact the toolbar under the short-viewport attribute (F4) or promote
`--vocab-reveal-head` to a measured value the card publishes (same pattern as `--vocab-vh`).

### F7. Reaction-count landscape rule: minor hygiene (LOW)

`vocabulary.css:5371-5395` — two consecutive `.vocab-reaction-count` blocks inside the same
media query (positioning reset, then animation-name). Works, but:
- Merge into one rule; keep the two comments as comment lines inside it.
- `vocab-reaction-count-fade` animates only opacity — confirm the reduced-motion kill-switch
  (`.vocabulary-shell * { animation: none !important }`, `vocabulary.css:5561`) leaves the count
  *visible* (it does — `animation: none` drops it to its base state; verify base `opacity` is 1
  and the fade isn't `forwards`-dependent; the stacked keyframe is, so check the base rule).
- The side-by-side layout widens the emoji row: with 3 reactions + counts, verify no wrap or
  overlap with the reveal pill / report button at 568×320 (smallest common landscape).

### F8. `useShellHeightVar` micro-refinements (LOW)

The hook is well-guarded (change-only writes, >0 check, dvh fallback for SSR/first paint).
Optional polish:
- **Coalesce writes in a rAF**: ResizeObserver + `visualViewport.resize` + `orientationchange`
  can each fire within one frame during rotation; a rAF latch would write once. Cheap, purely
  cosmetic for invalidation count.
- **Name/scope**: it writes a `--vocab-` property but lives in the generic `src/hooks/` with a
  generic name. Either take the property name as a parameter (`useMeasuredHeightVar(ref, "--vocab-vh")`)
  or move it into `src/features/vocabulary/hooks/`. Preference: parameterize — the post-player
  surfaces will want the same trick if they ever get landscape treatment.
- **`orientationchange` is deprecated** in favor of `screen.orientation` `change` events; both
  are belt-and-braces alongside the ResizeObserver, keeping it is fine, but a comment noting the
  redundancy intent would prevent a future "cleanup" from removing the wrong listener.
- Consider publishing width too (`--vocab-vw`): the two-column JS decision could then move to
  CSS entirely if ever wanted, and F4's attribute can derive from the same hook.

### F9. Two-column + non-Latin decks (LOW, verify)

The split applies to any short-landscape card regardless of locale. For the zh (hoa) domain the
answer is Han glyphs and the coda is `HanziStrokeSpelling`; the word column at 46% of ~800px is
generous, but verify: Douyin dialect chrome (seal frame replaced by underline in landscape via
`allowFrameEmphasis={!landscape}` — already handled), the zh ambient/toolbar variants, and that
`--vocab-word-col` doesn't starve a 4-character Han answer's stroke animation. One probe run on
the zh host in landscape covers it (§5).

### F10. Meaning panel: long-definition behaviour in two-column (LOW, verify)

The panel now runs full height (`max-height: calc(100% − head − chrome-top − gap)`), which is
the whole point — but the inner scroll reset (`details.current.scrollTop = 0` on stage change,
`VocabularyStage.tsx:~168`) and the `max-height: 620px` compact-padding tiers were tuned for
the stacked panel. With ~306px of usable height at 390px, an 11-word definition + example +
pronunciation should fit without scroll; a maximal C1 entry (long `defVi` + `leadVi` + usage)
may still scroll. Verify with the longest entries in the 635-word catalog (C1/C2 decks) rather
than the B1 samples.

### F11. Post-player surfaces now inconsistent with /feed (PRODUCT, not code)

If landscape ships ungated on /feed (F2), a user rotating mid-session goes from a
true-landscape vocabulary card to a letterboxed 9:16 post card on /community. That asymmetry is
defensible (the kinetic renderer is single-aspect; recorded decision) but should be a *stated*
product position, and the recorded decision memory
("rotate-to-portrait gate chosen over landscape reflow") must be updated once F2 is decided —
it currently says the gate applies to the vocabulary feed too.

---

## 3. Refinement backlog (suggested order)

| # | Change | Files | Effort | Risk |
|---|---|---|---|---|
| R1 | F1: `TWO_COLUMN_REVEAL_Y` 50 → 43 (or derive) | `VocabularyCard.tsx` | trivial | low — verify burst/word alignment visually |
| R2 | F4: measured `data-short-viewport` attribute replaces `max-height: 560` media tiers; keep `560` in one exported constant | `use-shell-height-var.ts`, `vocabulary.css`, `VocabularyCard.tsx` | small | medium — restates 3 CSS blocks; probe afterwards |
| R3 | F2: decide gate topology; restore master `true` (or narrow gate to post-player surfaces); add `check:orientation-gate` guard | `orientation-gate.ts`, `VocabularyFeedPage.tsx`, new script | small | **ship blocker if skipped** |
| R4 | F3: vocabulary-specific chrome reserve for wide-card clue fit, mirroring the CSS band formula | `presets.ts` | small | medium — changes landscape clue font sizes; run `check:measured-lines` + pagination checks |
| R5 | F5: band-measured `revealY` (retires all three magic constants) | `VocabularyStage.tsx`, `WordSequenceText` contract | medium | medium — first-paint estimate path must stay |
| R6 | F7/F8: reaction rule merge; hook rAF coalesce + parameterize property name | `vocabulary.css`, `use-shell-height-var.ts` | trivial | low |
| R7 | New `scripts/check-landscape-chrome.ts`: headless-compute the chrome stack + reveal geometry across the §5 matrix from the *real* stylesheet (the equivalence-measurement method used for the chrome-band task), asserting: chrome-top lands on band, word centre ≈ usable centre ±4px, burst centre == word centre, panel never overlaps chrome | new script | medium | none (guard only) |
| R8 | F6: toolbar landscape audit → invariant comment or compaction | `vocabulary.css` | small (after measuring) | low |

R1, R3, R6 are same-session material. R2+R4 belong together (one truth source for chrome
geometry, consumed by both CSS and the fit reserve). R5 subsumes R1 if done first — if R5 is
scheduled soon, skip R1's constant tweak and go straight to measurement; otherwise do R1 now.

---

## 4. Things that are already right (don't "fix")

- **Attribute-owned two-column CSS.** `[data-reveal-split="two-column"]` blocks restate no
  breakpoint and live outside the landscape media query; JS owns the decision and publishes the
  column width. This is the pattern R2 generalizes.
- **`revealCanvasWidth` coupling.** Fitting the answer against the same 46% the band is cut to
  removes a whole drift class; keep the single `WIDE_WORD_COLUMN` constant as the source.
- **`--vocab-vh` design.** Measured-height-over-dvh with a dvh fallback for SSR/first paint is
  the correct fix for rotation-frame chrome; the change-only write guard avoids layout thrash.
- **Chrome band derivation.** The inset/bar/gap/progress stack with `min`/`max` priority order
  (gap absorbs, bar compacts last) survived equivalence testing at 15.0% across the matrix;
  the 72px floor meeting the ratio at the 560 ceiling is continuous by construction.
- **`min(reservedHeight, insets)` clamp** in `getVocabularyTextHeightBudget` keeps portrait and
  export byte-identical — preserve that property in R4.
- **Fit-loop crash guard** (pixel tolerance + `MAX_FIT_PASSES`) from `8e9a3c4` protects every
  orientation flip; don't retune it while doing landscape work.

---

## 5. Verification plan (for the "verify later" pass)

### 5.1 Automated probe matrix

Reuse the CDP headless-Chrome harness pattern from the landscape-unlock session (temporary
script under `/tmp`, screenshots to `/tmp` only — root-level probe PNGs are gitignored but
should not be recreated). Per viewport, on a paused (frozen) card:

| Viewport | Class | Expect |
|---|---|---|
| 844×390 | iPhone 14/15 landscape | two-column; chrome-top 72; word centre == burst centre (F1 check: currently 189 vs 219 → **fails until R1**) |
| 932×430 | Pro Max landscape | two-column; chrome band 64.5–72 boundary; panel ≥ 300px usable |
| 568×320 | SE landscape | two-column at floor; bar compacted ≤ 33px; reaction row (3 counts + pill + report) fits without wrap |
| 740×360 | mid Android landscape | two-column; clue font ≥ portrait-equivalent after R4 |
| 800×560 / 800×561 | threshold straddle | 560 → two-column + compact chrome; 561 → stacked + portrait chrome (documents the step, R2 makes both sides measured) |
| 1024×768 | iPad landscape | stacked proportional (no two-column), frame emphasis still suppressed |
| 1280×700 | desktop window | stacked; fit-loop guard exercised (was a crash site) |
| 390×844 | portrait control | all outputs byte-identical to pre-change (diff computed styles against HEAD stylesheet like the chrome-band task did) |

Measurements to assert (getComputedStyle / rects): `--vocab-chrome-top`, band rect,
word centre vs usable centre vs burst centre, `.vocab-reveal-details` rect vs chrome rect
(no overlap), reaction count fully inside card, longest C1 definition scroll state (F10).

### 5.2 Rotation dynamics (the class `--vocab-vh` exists for)

- Portrait → landscape → portrait round-trip on a **frozen card**: font size and band rect
  return to the original values (idempotency was proven before; re-prove with two-column added).
- Rotate **mid-reveal** and **mid-spelling-coda**: no overlap frames beyond one, burst follows
  the word column after settle.
- Safari iOS: rotate with the URL bar expanded, then scroll to collapse it — chrome band must
  track the measured shell, not jump by the URL-bar delta.
- Android Chrome: same, plus in-app "hide toolbar" gesture if available.

### 5.3 Manual device pass

- Real iPhone + real Android in landscape: two-column reveal, reaction tap targets (44px row
  kept?), emoji burst origin, saved drawer pull in landscape (drawer geometry was tuned in
  portrait — check handle and sheet height against the 15% chrome band), options sheet,
  onboarding gauge (already shipped, regression only), zh host once (F9).
- Reduced motion ON: rotation still re-lays-out (no animation), reaction count visible (F7).
- Report panel open in landscape two-column: its `bottom: calc(inset + bar + 10px)` cap vs the
  right-column panel — confirm no z-order or overlap surprise.

### 5.4 Regression gates already in repo

`npm run check:word-joiners`, `check:measured-lines`, `check:text-pagination`,
`check:vietnamese-line-fit`, `npx tsc --noEmit`, scoped `eslint`, `prettier --check` on touched
files, `npm run build` (two-column CSS ships in the same bundle; no glob concerns).

---

## 6. Open questions (answers change the backlog)

1. **Is landscape shipping?** (F2/R3) If yes → gate topology decision + memory update (F11).
   If it remains an experiment, R2/R4 can wait and only R1+R6 are worth landing.
2. **Does the 561–700px height band (foldables, iPad portrait-ish windows) deserve the
   two-column treatment too?** Currently stacked there by design ("a landscape desktop window
   is tall enough"); a foldable at 673×480… wait, that's >560 height? No: 480 height → two-column.
   The real gap is ~561–640 heights where stacked `free*0.5` still yields a ~2-line panel.
   Consider raising `SHORT_LANDSCAPE_MAX_H` to 640 *after* R2 makes the threshold measured,
   and re-running the matrix at 620/640 straddles.
3. **Should the stacked `WIDE_REVEAL_Y = 43` and two-column share one derived value?** (R5
   answers yes by construction.)
4. **Export studio:** `[data-export]` is excluded from every landscape rule and `exportLayout`
   blocks two-column — confirmed by code reading, but one export smoke test in a landscape
   browser window is cheap insurance.

---

## 7. One-paragraph summary

The landscape work is architecturally sound and converging on the right doctrine — *measured
values over viewport units, JS-owned decisions published as attributes, CSS that restates no
breakpoints*. The highest-value fixes are small: the two-column word sits ~30px below its own
celebration burst because `TWO_COLUMN_REVEAL_Y = 50` ignores the band's asymmetric 72/132
stretch (43 is the measured answer, or derive it); the orientation-gate master switch is still
flipped off with a "restore before deploying" warning that must become an explicit ship
decision; and the clue-page fit reserves 204px of chrome where only 144px exists, costing
landscape clue text ~15% of its size. Everything else is hygiene (one truth source for the 560
threshold, reaction-rule merge, hook parameterization) plus a headless geometry guard that
would have caught the reveal-Y mismatch mechanically.
