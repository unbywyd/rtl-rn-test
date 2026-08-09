# RTL Test Plan

Every test states: **what we believe**, **how to check it**, and **what would disprove it**.
A test only counts as passed when the on-screen result is recorded in `RESULTS.md`.

**Environment:** Expo SDK 57 · RN 0.86.2 · Fabric · he/en/ru/ar

> Findings are **version-pinned**. RN RTL behavior has changed repeatedly (0.74 Yoga 3.0,
> 0.75 `supportsRtl` gating, 0.76 Fabric default, 0.77–0.78 backport gap). Do not generalize
> a 0.86.2 result to other versions without re-testing.

---

## How to read a result

| Symbol | Meaning |
| --- | --- |
| ✅ | Behaves as the guide claims |
| ❌ | Contradicts the guide — **highest value, record verbatim** |
| ⚠️ | Works but with a caveat worth documenting |
| 🔀 | Differs between iOS and Android |

---

## T1 — Baseline auto-mirroring

**Claim (guide R1a):** with zero `isRTL` in the code, RN mirrors `flexDirection: 'row'`,
`justifyContent: 'flex-start'`, `marginStart`, `paddingStart`, `start`.

**Procedure:** Open *Baseline*. Every row is written with logical props only. Switch he ↔ en.

**Expect:** In Hebrew every element sits at the right; in English at the left. No code change.

**Disproves the guide if:** anything stays put across the switch.

---

## T2 — Double-flip demo (R0 / R2)

**Claim:** `isRTL ? 'flex-end' : 'flex-start'` is a bug, not a fix — RN already mirrors.

**Procedure:** *DoubleFlip* shows the same row twice: correct (`flex-start`) and
"AI-style" (`isRTL ? 'flex-end' : 'flex-start'`). Compare in Hebrew.

**Expect:** The correct row hugs the right; the double-flipped row lands on the **left** — visibly wrong.

**Why it matters:** This is the single screenshot that teaches the skill's most important rule.

---

## T3 — `<Text>` default alignment

**Claim (guide R3):** default `textAlign: 'auto'`; Android resolves from **text content**,
iOS from the **app bundle localization**.

**Procedure:** *TextAlign* renders Hebrew, English and mixed strings with **no** `textAlign`,
next to explicit variants.

**Expect on Android:** Hebrew right, English left — independent of app language.
**Expect on iOS:** both follow the bundle → Hebrew may drift **left**. 🔀

**This is the test the whole exercise started from.**

---

## T4 — First-strong heuristic (research C5)

**Claim:** Android uses `TEXT_DIRECTION_FIRST_STRONG` with **LTR fallback**, so a Hebrew string
starting with a digit / Latin word / emoji left-aligns even on Android.

**Procedure:** *TextAlign* renders Hebrew strings prefixed with `123`, `iPhone`, `🚀`, `+972`, and `"`.

**Expect:** Those rows left-align on Android while a plain Hebrew string right-aligns.

**If true:** "Android is fine without textAlign" is wrong and the guide must say so.

---

## T5 — `TextInput` alignment & numeric caret

**Claim (R3):** `TextInput` needs an explicit `textAlign`; Android has a known numeric caret bug (#33483).

**Procedure:** *Inputs* shows inputs with and without `textAlign`. Type Hebrew, then digits.

**Expect:** Without `textAlign`, the caret starts on the wrong side. With it, correct.
**Watch for:** caret not moving left while typing digits in an RTL input.

---

## T6 — Always-LTR content (R5)

**Claim:** phone/email/URL must be forced LTR; U+200E fixes placeholders.

**Procedure:** *Inputs* renders `+972 54-123-4567`, an email and a URL — plain, and LRM-wrapped.

**Expect:** Unmarked phone renders with **reordered digit groups** in RTL; the LRM version is correct.

---

## T7 — Signed numbers / math bidi (RN #54713)

**Claim:** on Android RTL, `-123.456` renders as `123.456-` and `12 - 13 = 25` reverses.
Research could not settle whether this is a bug or correct UAX #9.

**Procedure:** *Numbers* renders signed numbers, temperatures, prices, math — raw and isolated.

**Expect:** Sign moves to the wrong side when unisolated; LRM/LRI fixes it. iOS unaffected. 🔀

**Widens R5** if confirmed: prices and deltas need isolation, not just phones.

---

## T8 — Logical property families (research C8)

**Claims:** (a) `marginInline*`/`paddingInline*`/`insetInline*` flip like `*Start`/`*End`;
(b) `*Block*` is vertical and never flips; (c) **`borderInlineStartWidth` does not exist → silent no-op**.

**Procedure:** *LogicalProps* renders one box per family with a coloured border/margin.

**Expect:** Inline family mirrors; Block family does not; the `borderInlineStartWidth` box shows
**no border at all** — proving the silent no-op.

---

## T9 — `start`/`end` precedence trap (C7)

**Claim:** `start` beats `left`, `right` **and `end`**; `end` beats only `left`/`right`.
So merging a base style with a `left` override silently produces dead code.

**Procedure:** *LogicalProps* renders boxes with deliberately conflicting pairs, each labelled
with which value *should* win.

**Expect:** The `left` override is ignored when `start` is present.

---

## T10 — `direction: 'ltr'` island (open question Q2)

**Claim:** unsettled. Docs list `direction` with no platform annotation; one issue says Android
no-ops (old arch). Under Fabric it is parsed in shared C++, so it *should* work.

**Procedure:** *DirectionIsland* wraps an LTR island inside an RTL screen using `direction: 'ltr'`,
beside the `row-reverse` workaround.

**Expect if it works:** the island lays out LTR while the page stays RTL.
**Also verify:** `I18nManager.isRTL` stays `true` inside the island — `direction` must not change it.

---

## T11 — Language switch, same direction

**Claim (R7):** only a *direction change* needs a restart. he → ar must switch instantly.

**Procedure:** *Language* screen, switch he → ar.

**Expect:** Text changes immediately, **no reload**, layout stays RTL.

---

## T12 — Direction flip + reload (open question Q1) ⭐

**Claim under test:** `reloadAppAsync()` from the **`expo`** package — with **no `expo-updates`** —
applies the RTL flip. The guide currently claims `expo-updates` is mandatory; research says that is wrong,
but **no source proves the RTL flip works via `reloadAppAsync`**.

**Procedure:** *Language* screen, switch he → en. The screen shows the pre-reload state
(`I18nManager.isRTL`, `forceRTL` target) and the post-reload state.

**Expect if the correction holds:** one reload, and the app comes back in the correct direction.
**Expect if the guide was right:** direction does not apply until a manual kill + relaunch.

**This single test decides guide correction C1.** Record it precisely.

---

## T13 — `android:supportsRtl` gating (Android only)

**Claim:** since RN 0.75, `I18nUtil.isRTL()` is gated on `android:supportsRtl="true"`;
without it `forceRTL` **silently no-ops**.

**Procedure:** After prebuild, confirm the flag in `android/app/src/main/AndroidManifest.xml`.
Optionally flip it to `false`, rebuild, and confirm RTL dies completely.

**Expect:** Expo's template supplies `true`. With `false`, everything reverts to LTR and JS gets no signal.

---

## T14 — Shadows (open question Q3)

**Claim (research C11):** `shadowOffset` is iOS-only, so negating its `width` is a no-op on Android.
But `boxShadow` exists in 0.86 types — the finding may be outdated.

**Procedure:** *Shadows* renders `shadowOffset`, `elevation`, and `boxShadow` boxes side by side.

**Expect:** Determine which actually render on Android at 0.86, and whether any mirror in RTL.

---

## iOS-only tests (Phase 2)

### T15 — iOS bundle vs content alignment ⭐
The counterpart of T3. Compare the *TextAlign* screen against the Android screenshot.
**Expect:** unmarked Hebrew drifts left on iOS while it right-aligned on Android. 🔀

### T16 — Bundle localization effect
Add `he` to `supportedLocales` / `CFBundleLocalizations`, rebuild, re-check T15.
**Question:** does declaring the locale change the default alignment?

### T17 — `writingDirection` under Fabric
Research (#51235) says it regressed to a no-op on iOS Fabric.
**Procedure:** *TextAlign* has a `writingDirection`-only row. Does it change anything?

### T18 — First launch after install ⭐
The "works on the second launch" problem. **Delete the app**, reinstall, launch once.
**Expect:** correct direction on the very first frame, with the reload hidden under the splash.

### T19 — `expo-localization` plugin `forcesRTL`
Compare the plugin (`{ supportsRTL: true, forcesRTL: true }`) with a hand-written AppDelegate patch.
**Expect:** the plugin is sufficient — proving the custom plugin (guide C3) unnecessary.

### T20 — `start`/`end` absolute positioning on iOS
paper#3542 reported `start`/`end` failing for absolute positioning on iOS.
**Procedure:** *LogicalProps* has absolutely-positioned boxes using both `start` and `left`.

---

## Recording results

For each test append to `RESULTS.md`:

```md
### T3 — Text default alignment
- **Platform:** Android 14 / Pixel 7 · RN 0.86.2
- **Result:** ✅ / ❌ / ⚠️ / 🔀
- **Observed:** <what was actually on screen>
- **Screenshot:** screenshots/t3-android.png
- **Implication:** <what changes in the guide>
```

Record failures and surprises in the most detail — those are what the skill is for.
