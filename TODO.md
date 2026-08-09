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
- [ ] Push to GitHub (**only on explicit user command**)

---

## Phase 1 — Android (Windows) — 14 tests

Static checks already done at scaffold time:

- [x] **S1** `textAlign` types accept only `auto|left|right|center|justify` — **no `start`/`end`** on 0.86.2 → confirms guide R8
- [x] **S2** Fabric reload fix present (`_updateLayoutContext` count = 4) → not affected by the 0.77/0.78 backport gap
- [x] **S3** `boxShadow` exists in 0.86 types → research finding C11 (shadowOffset iOS-only) may be outdated
- [x] **S4** `direction` style prop present in types (`inherit|ltr|rtl`)

Runtime tests — see TEST_PLAN.md for the full procedure:

- [ ] **T1** Baseline auto-mirroring (no `isRTL` anywhere)
- [~] **T2** Double-flip demo (proves R0/R2) — layout mirrors correctly, but see ⭐ below
- [!] **T0 (unplanned)** ⭐ **`isRTL` reads `false` while Yoga mirrors the layout.**
      Native prefs show `forceRTL=true`; `I18nManager.js` caches `isRTL` at module load and
      never re-reads it. The two values disagree for the whole JS session. **Contradicts the
      guide's single-flag model.** See RESULTS.md.
- [ ] **T3** `<Text>` default alignment — Android content-based?
- [ ] **T4** First-strong heuristic (digit/latin/emoji-leading Hebrew)
- [ ] **T5** `TextInput` alignment + numeric caret
- [ ] **T6** Always-LTR content (phone/email) + LRM marks
- [ ] **T7** Signed numbers / math bidi (RN #54713)
- [ ] **T8** Logical props: `*Inline*` family, `borderInlineStartWidth` no-op, `*Block*` decoy
- [ ] **T9** `start`/`end` precedence trap
- [ ] **T10** `direction: 'ltr'` island — does it work on Android Fabric? (research open question #2)
- [ ] **T11** Language switch, same direction (he→ar) — must NOT restart
- [ ] **T12** Language switch, direction flip (he→en) — `reloadAppAsync` applies RTL? (**open question C1**)
- [ ] **T13** `android:supportsRtl` gating (RN 0.75+ silent no-op)
- [ ] **T14** Shadows: `shadowOffset` vs `elevation` vs `boxShadow`

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
| Q1 | Does `reloadAppAsync()` (from `expo`, no expo-updates) actually apply an RTL flip? | Guide correction C1 |
| Q2 | Does `direction: 'ltr'` work on Android under Fabric? | Guide C13 |
| Q3 | Is `shadowOffset` still iOS-only, or does `boxShadow` supersede it on 0.86? | Guide C11 |
| Q4 | Is Android signed-number reordering real on 0.86? | Guide new-exception |
| Q5 | Does iOS `<Text>` really default-align from the bundle, not content? | Guide R3 — **the highest-value one** |
| Q6 | Does `writingDirection` do anything on iOS Fabric? | Guide C4 |

---

## Rules for this repo

1. **Evidence over assertion.** Every checkbox needs a screenshot or copied on-screen output.
2. **Record surprises loudly.** A failed expectation is more valuable than a confirmation.
3. **Note the version.** Findings are pinned to RN 0.86.2 / SDK 57 and may not hold elsewhere.
4. **Never push without an explicit instruction from the user.**
