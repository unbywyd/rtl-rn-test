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

- [ ] **T1–T14** repeated on iOS
- [ ] **T15** iOS bundle-localization effect on `<Text>` default alignment (**the key iOS test**)
- [ ] **T16** `CFBundleLocalizations` / `supportedLocales` — does adding `he` change defaults?
- [ ] **T17** `writingDirection` — no-op under Fabric? (RN #51235)
- [ ] **T18** First-launch-after-install direction (the "works on second launch" problem)
- [ ] **T19** `expo-localization` plugin `forcesRTL` on iOS
- [ ] **T20** `start`/`end` absolute positioning divergence (paper #3542)

---

## Phase 3 — Back on Windows

- [ ] Merge iOS results
- [ ] Re-run Android for anything changed on Mac
- [ ] Update `RESULTS.md` with the final matrix
- [ ] Correct `d:\whatidog\docs\RTL_I18N_GUIDE.md` from evidence
- [ ] Build the Claude Code skill from verified rules only

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
