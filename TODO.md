# RTL Verification — TODO

Status legend: `[ ]` not started · `[~]` in progress · `[x]` verified · `[!]` failed/surprising · `[-]` N/A

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric) · TypeScript

> ⚠️ **Public repo.** No secrets, tokens, keystores, or code copied from private projects.

---

## Phase 0 — Setup (Windows)

- [x] Scaffold Expo blank-typescript app
- [x] Install deps: expo-localization, i18next, react-i18next, async-storage, expo-dev-client
- [x] Write TODO.md + TEST_PLAN.md
- [x] Build i18n layer (he/en/ru/ar, direction-aware)
- [x] Build all test screens (9 screens)
- [x] Typecheck clean + `expo export` bundles (627 modules)
- [x] `npx expo prebuild --platform android`
- [x] Build + install on Android emulator (Pixel 6 Pro, API 34)
- [x] git init + first commit
- [x] Push to GitHub

---

## Phase 1 — Android (Windows) — 14 tests

Static checks already done at scaffold time:

- [x] **S1** `textAlign` types accept only `auto|left|right|center|justify` — **no `start`/`end`** on 0.86.2 → confirms guide R8
- [x] **S2** Fabric reload fix present (`_updateLayoutContext` count = 4) → not affected by the 0.77/0.78 backport gap
- [x] **S3** `boxShadow` exists in 0.86 types → research finding C11 (shadowOffset iOS-only) may be outdated
- [x] **S4** `direction` style prop present in types (`inherit|ltr|rtl`)

Runtime tests — see TEST_PLAN.md for the full procedure:

- [x] **T1** Baseline auto-mirroring — 8 logical properties, zero `isRTL`, all correct
- [x] **T2** Double-flip demo — masked by the isRTL bug; arrows did not flip either
- [!] **T0 (unplanned)** ⭐ **`isRTL` reads `false` while Yoga mirrors the layout.**
      Native prefs show `forceRTL=true`; `I18nManager.js` caches `isRTL` at module load and
      never re-reads it. The two values disagree for the whole JS session. **Contradicts the
      guide's single-flag model.** See RESULTS.md.
- [x] **T3** Text alignment — follows LAYOUT DIRECTION, not content. Blog claim disproven
- [x] **T4** First-strong probes — no content heuristic exists on 0.86.2
- [x] **T5** TextInput alignment — direction-source comparison proves the isRTL bug
- [x] **T6** Phone `+` migrates to the end; LRM + textAlign together fix it
- [x] **T7** #54713 did not reproduce; isolate the VALUE, not the line
- [x] **T8** `borderInlineStartWidth` silently absent; `start` beats `left`
- [x] **T9** Precedence trap confirmed in both directions
- [x] **T10** `direction` prop WORKS on Android Fabric — settles research Q2
- [x] **T11** he→ar instant, no reload
- [x] **T12** `reloadAppAsync()` applies the flip WITHOUT expo-updates — C1 disproven
- [x] **T13** `android:supportsRtl=true` present via Expo prebuild
- [x] **T14** `shadowOffset` inert on Android; `boxShadow` renders

---

- [x] **T21/T22/T23** Safe area, system bars, keyboard — double-inset bug found and fixed
- [x] **T24** Keyboard matrix — 10 cases, predictions exact
- [x] **T25** Blur — needs 4 conditions; community/blur crashes

**Android phase complete.** See `SUMMARY.md`.

---

## Phase 2 — iOS (Mac)

Handoff doc: `MAC_INSTRUCTIONS.md`

**Session started.** Device: iPhone 16 Pro Max, iOS 26.5.2 · Xcode 26.2 · dev build installed and
running against Metro on port 8082. See "iOS runtime results" in `RESULTS.md`.

Setup findings (both recorded in RESULTS.md):

- [x] **B1** Build blocker — `expo-modules-jsi` fails to compile on **Xcode 26.2** (Swift 6.2 type
      inference). Patched in `node_modules`; ⚠️ **needs `patch-package`** or it is lost on next install
- [x] **B2** Screenshot tooling — `idevicescreenshot` and `devicectl` both dead on iOS 26.
      `pymobiledevice3 ... --userspace` works with **no root**. Wrapper: `scripts/ios-screenshot.sh`

Results so far:

- [x] **T25** Blur — 🔀 **all three variants blur on iOS**; Android needed all four conditions
- [x] **T26** (unplanned) — 🔀 vertical centring lost through an `absoluteFill` wrapper
- [x] **T27** (new screen) — line height / vertical centring matrix, 7 sections. iOS half done
- [x] **T24** — red-box `VirtualizedLists nested` banner on mount (expected failure, case 7)
- [x] **T24 case 10** — 🔀 multiline field lifts to the **caret** on iOS (one visible row), whole
      textarea on Android. `bottomOffset` measures from the caret, not the element
- [x] **R20/R21** promoted to `SKILL_RULES.md` — the platform-asymmetry meta-rule and the
      `justifyContent`-is-not-inherited rule
- [x] **T21/T22/T23** Safe area — ✅ all pass. Top inset **62** vs Android's 27.38; no double-inset
- [!] **T2 / T12** ⭐ **BLOCKER** — the app never reaches RTL on iOS. `forceRTL(true)` is called
      (`flagFlipped: true`) but does **not survive `reloadAppAsync()`**; the one-shot guard then
      suppresses the retry (`guardWasSet: true`, `needsRestart: false`) and it stays LTR permanently.
      🔀 Android applied the same flip successfully

Measured in the **LTR** state (valid where noted, re-run required otherwise):

- [x] **T3/T4** ⭐ **Q5 answered — negatively.** Seven first-strong probes (digit-, latin-, emoji-,
      plus-, quote-leading Hebrew) all aligned **identically left**. **No content heuristic exists on
      iOS either.** The 2016 blog claim is now disproven on *both* platforms — alignment follows
      layout direction. (Bundle half needs the RTL re-run.)
- [!] **T17** 🔀 **`writingDirection` WORKS on iOS** — `'rtl'` aligns right, `'ltr'` left, rows differ.
      On Android it was a total no-op. **Also disproves RN #51235.** This is the R20 trap in its
      purest form: verified on iOS it looks right, then silently loses alignment on Android
- [~] **T1** Base — LTR baseline only; all logical properties resolve correctly, but `start` ≡ `left`
      in LTR so **mirroring was not tested**. **T20** (`start`/`end` absolute, paper#3542) did **not**
      reproduce — weak negative, needs RTL

- [x] **T7** ⭐ **Q4 answered.** Signed numbers **do** corrupt on iOS inside Arabic text
      (`القيمة: 123.456-`); LRM and isolate both fix it. **Research claiming iOS is unaffected is
      wrong.** Trigger is the surrounding RTL **context**, not the value — Latin-labelled lines are
      all safe, which is why a debug harness that prints `value: -123.456` never sees the bug
- [x] **T6 static text** — the `+` corruption reproduces on iOS (`טלפון: 54-123-4567 972+`), LRM fixes
      it. **Happens in an LTR app** — "we don't support RTL" is not protection
- [x] **T5b** 🔀 numeric caret (RN #33483) does **not** reproduce on iOS; on Android the caret jumped
      to the start on first keystroke
- [~] **T5/T6/T6c** inputs — inconclusive. Both "iOS bugs" spotted (two LTR phone fields, dead
      `row-reverse`) are **`isRTL=false` taking the LTR branch**, not iOS defects

- [x] **T10** ⭐⭐ **Q2 answered — `direction` WORKS on iOS.** An `rtl` island rendered `3 2 1`
      right-aligned inside an LTR page, **with `isRTL=false`, no `forceRTL`, no reload**. This is the
      candidate replacement for the whole flip mechanism. ⚠️ `isRTL` does **not** follow `direction`
- [x] **T14** 🔀 **Q3 answered.** Exact mirror of Android: `shadowOffset` **renders** on iOS,
      `elevation` is **inert**. `boxShadow` renders on **both** — the only portable directional shadow
- [x] **T8c/T9** — `borderInlineStartWidth` absent on iOS too; `start` beats `left` (both
      direction-independent, so valid despite the blocker)

**Blocked until the app can be put into a real RTL state** — results in an LTR layout are meaningless:

- [ ] **T1** Base (re-run) · **T3** Text (bundle half) · **T5/T6c** Input (re-run) · **T8a/T8b** ·
      **T20** (real test) · **T14** direction-correction halves · **T10** `ltr`-island-inside-RTL

**Unblocking, in order:**

- [x] ~~Switch `he → en → he` to clear the stuck guard~~ — **done, and it did NOT help.** Language
      persisted (`storedLanguage: "he"`), guard rewritten, `flagFlipped: true`, `reloadAppAsync` ran
      (Metro logged both reloads) — and `isRTL` came back `false` with an LTR layout. **The guard was
      never the cause; `forceRTL` simply does not survive a JS reload on iOS**
- [x] **R22 written** — the unifying rule: drive direction from **app state via `direction`**, not
      from `forceRTL` + reload. It is the only mechanism measured working on both platforms
- [x] **T28/T29** ⭐⭐ **R22 PROVEN end-to-end on iOS.** `DirectionProvider`
      ([src/lib/direction.tsx](src/lib/direction.tsx)) → T2 renders **fully mirrored** (`START` right,
      rows `3·2·1`) with `isRTL=false`, **no forceRTL, no reload, no restart**
- [x] **T29** settled the mechanics: `direction` **inherits through `ScrollView`**, **applies on
      live-node update** (no `key` remount needed), and an **`ltr` island inside an RTL page works** —
      the last open caveat in R22
- [x] Two of my own hypotheses **disproven by measurement** (ScrollView blocks inheritance;
      direction binds only at node creation). Both false. Recorded in RESULTS.md, incl. the false
      positive that produced them: the test screen carried ambient RTL, so its control row passed too
- [x] **R23 · lint plugin** — [tools/eslint-plugin-rtl](tools/eslint-plugin-rtl/index.js): 5 rules, all
      with RuleTester tests, canary-verified (7 bad patterns → 7 diagnostics), repo lints clean.
      `npm run lint:rtl` · `npm run test:rtl-rules`
- [x] **T18** ⭐ **DECIDED — not a dev-client artifact.** Release build, Metro killed, app freshly
      installed: still `isRTL=false`, T2 still fully LTR. `forceRTL` + `reloadAppAsync()` has **no
      working configuration on iOS** here, RN#49455's fix notwithstanding.
      ⚠️ Unmeasured: `Updates.reloadAsync()` from expo-updates (not installed in this project)
- [ ] **T10 Dir** on iOS — if the `direction` prop works (it does on Android, R16), it **replaces**
      the whole `forceRTL` + reload + guard machine and makes this failure mode irrelevant

- [ ] **T1–T14** repeated on iOS
- [ ] **T15** iOS bundle-localization effect on `<Text>` default alignment (**the key iOS test**)
- [ ] **T16** `CFBundleLocalizations` / `supportedLocales` — does adding `he` change defaults?
- [ ] **T17** `writingDirection` — no-op under Fabric? (RN #51235)
- [ ] **T18** First-launch-after-install direction (the "works on second launch" problem)
- [ ] **T19** `expo-localization` plugin `forcesRTL` on iOS
- [ ] **T20** `start`/`end` absolute positioning divergence (paper #3542)

---

## Phase 3 — Back on Windows

**Start here.** The iOS session is written up in `RESULTS.md` ("iOS runtime results") and the rules
it produced are **R20–R23** in `SKILL_RULES.md`. Read those two before running anything.

**New since the Android pass** — three screens and two tools that Android has never seen:

- [ ] **T27 Line** (`src/screens/LineHeightScreen.tsx`) — line height / vertical centring, 7 sections.
      iOS column only. Its §3 and §5 report several methods "working", which under **R20** means
      **unverified**, not safe — Android is the strict platform and is what can falsify them
  - [ ] **§2 clipping (R21b)** — confirm `lineHeight ≤ fontSize` clips on Android too, and pin the
        threshold per script. Hebrew clipped at `lineHeight: 16 / fontSize: 16` on iOS
  - [x] **§6b ellipsis side — ANSWERED on iOS.** The `…` follows the text direction (Hebrew: left,
        English: right), placed from the string paragraph direction, not the app flag. **Needs no RTL
        handling at all.** Re-confirm on Android
- [ ] **T28** — `DirectionProvider` (`src/lib/direction.tsx`), toggle on the T12 tab. Verify the
      R22 pattern mirrors on Android too, and that `isRTL` still does **not** follow the island
- [ ] **T29 Where** (`src/screens/DirectionPlacementScreen.tsx`) — 8 rows: placement (A–F) and
      runtime toggle (G/H). Confirm `direction` inherits through `ScrollView` and applies on
      live-node update on Android as it does on iOS
- [ ] **Lint plugin** (`tools/eslint-plugin-rtl/`) — `npm run lint:rtl`, `npm run test:rtl-rules`.
      Both should stay green; the rules are platform-independent

**Re-measure on Android** (iOS could only test these in an LTR layout, so its results are weak):

- [ ] **T20** — `start`/`end` absolute positioning under **real RTL**. paper#3542 claimed an
      iOS-specific break; iOS could not test it and Android's earlier pass did not reproduce it
- [ ] **T24 case 9/10** — the *degree* of keyboard lift (sheet translation, multiline caret-vs-field).
      The earlier Android run recorded pass/fail but not how far things moved; the 🔀 rows in
      "Cross-platform differences" depend on that detail
- [ ] **T14** direction-correction halves — both rendered identically on iOS only because
      `isRTL=false` made the correction a no-op

**Then:**

- [ ] Add a `patch-package` entry for the B1 Swift fix so a clean checkout builds on Xcode 26.2
- [ ] Update `RESULTS.md` with the final matrix
- [ ] Correct `d:\whatidog\docs\RTL_I18N_GUIDE.md` from evidence
- [ ] Build the Claude Code skill from verified rules only — **ship the lint plugin with it** (R23)

---

## Open questions this repo must settle

Carried from the deep research. These are the reason the app exists.

| # | Question | Blocks |
| --- | --- | --- |
| Q1 | Does `reloadAppAsync()` apply an RTL flip without expo-updates? | ✅ **YES** — C1 was wrong |
| Q2 | Does `direction: 'ltr'` work on Android under Fabric? | ✅ **YES** — works both ways |
| Q3 | Is `shadowOffset` iOS-only, or does `boxShadow` supersede it? | ✅ `shadowOffset` inert; `boxShadow` renders |
| Q4 | Is Android signed-number reordering real on 0.86? | ✅ Not as reported — context is the trigger |
| Q5 | Does iOS `<Text>` default-align from the bundle, not content? | ⏳ **iOS — still open, highest value** |
| Q6 | Does `writingDirection` do anything on iOS Fabric? | ⏳ **iOS — still open** (does nothing on Android) |
| Q7 | Does `I18nManager.isRTL` lie on iOS too? | ⏳ **iOS — the top question** (it does on Android) |

---

## Rules for this repo

1. **Evidence over assertion.** Every checkbox needs a screenshot or copied on-screen output.
2. **Record surprises loudly.** A failed expectation is more valuable than a confirmation.
3. **Note the version.** Findings are pinned to RN 0.86.2 / SDK 57 and may not hold elsewhere.
4. **Never push without an explicit instruction from the user.**
