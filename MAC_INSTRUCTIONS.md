# Mac / iOS Session — Instructions

**Read `SUMMARY.md` first, then this file.** The Android half is complete; you are running
the iOS half and the cross-platform comparison.

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric)
**Repo:** https://github.com/unbywyd/rtl-rn-test — ⚠️ **public. No secrets, ever.**

---

## Why this exists

A deep research pass produced a set of claims about React Native RTL. The Android half of
this harness **disproved eight of them** (see "Claims that turned out to be WRONG" in
`SUMMARY.md`). Several of those claims were specifically about iOS, or asserted a platform
difference — and those are exactly what you are here to settle.

**Do not "fix" surprising behaviour. A surprising result is the deliverable.** Record it.

---

## Setup

```bash
git clone https://github.com/unbywyd/rtl-rn-test.git
cd rtl-rn-test
npm install

npx expo prebuild --platform ios --clean
npx expo run:ios          # or open ios/*.xcworkspace in Xcode
```

A **dev build is required**. Do NOT use Expo Go — it resets RTL preferences on launch, so any
RTL result measured there is meaningless.

The app opens on the **T2 Flip** tab. The tab bar scrolls horizontally; all 12 tabs are there.

---

## ⭐ Priority 1 — Does `I18nManager.isRTL` lie on iOS too?

**This is the single most important question of the entire iOS session.**

On Android, `isRTL` read `false` in **every** configuration tested (8 runs, 2 devices, debug
and release, 3 system locales) **while the layout was fully mirrored**. Root cause: the
constant is computed at native module construction and cached in JS at module load, and never
re-read.

iOS has a **different native implementation** (`RCTI18nUtil`, not `I18nUtil.kt`), so it may
behave completely differently.

**How to check:** the header on every screen prints `isRTL=…`. Switch the app to Hebrew
(**T12 Lang** → HE) and read it.

| If iOS shows | Meaning |
| --- | --- |
| `isRTL=true` with mirrored layout | **Platform difference** — the bug is Android-only. Rule R1 must be rewritten as platform-specific. |
| `isRTL=false` with mirrored layout | Confirms R1 cross-platform. The rule stands as written. |

Then open **T5 Input** — it renders the same `textAlign` twice, once from `I18nManager.isRTL`
and once from the app language, labelled. If they differ on iOS, the flag lies there too.

**Also check T2 Flip:** on Android the arrows in block 4 did **not** flip, and the
"double-flipped" row accidentally looked correct. If iOS flips the arrows properly, that is
the same platform difference showing up.

---

## ⭐ Priority 2 — Text alignment (T3 Text)

The most-cited claim in the whole corpus, from the RN 2016 blog:

> *"In iOS, the default text alignment depends on the active language bundle. In Android it
> depends on the language of the text content."*

**The Android half of that is now disproven.** On RN 0.86.2, Android aligned by **layout
direction**, not by content: an `en` app left-aligned pure Hebrew, and a `he` app
right-aligned pure English. The first-strong probes (digit-, Latin-, emoji-leading Hebrew) all
aligned identically to plain Hebrew — no content heuristic at all.

**Your job:** the iOS half.

1. Open **T3 Text** with the app in **English**. Screenshot the "No textAlign" section.
2. Switch to **Hebrew** (T12 Lang → HE). Screenshot the same section.
3. Compare against `screenshots/he-t3-text.png` (Android, Hebrew).

**Record:** does unmarked Hebrew drift **left** on iOS in an English app? Does unmarked
English go **right** in a Hebrew app? If iOS follows the app bundle rather than layout
direction, the platform difference is real — just not the one the blog described.

### T16 — does bundle localisation change it?

If iOS behaves differently, test whether declaring the locale fixes it:

```jsonc
// app.json → expo.ios
"infoPlist": { "CFBundleLocalizations": ["en", "he", "ar", "ru"] }
```

Rebuild, re-check T3. **Record:** did declaring `he` change the default alignment? This
decides whether the guide states bundle localisation as a hard prerequisite.

### T17 — `writingDirection` under Fabric

On Android it does **nothing** — `'rtl'` and `'ltr'` rows rendered identically. Research
(RN #51235) claims it also regressed to a no-op on iOS Fabric. The bottom section of
**T3 Text** has that comparison. **Record whether the two rows differ.**

---

## ⭐ Priority 3 — First launch after install (T18)

The problem that started this whole investigation: *"RTL only works the second time."*

1. **Delete the app from the device** (not just close it).
2. Reinstall and launch **once**.
3. Watch the very first frame.

The app reloads under its own splash when direction flips, guarded against loops. On Android
this worked. **Record whether iOS shows a correct first frame, a wrong-direction flash, or
requires a manual relaunch.**

---

## Priority 4 — Everything else, per tab

Work through the tabs and fill in the iOS column. Screenshot each in **both** Hebrew and
English. What to look for, given the Android result:

| Tab | Android result | What to check on iOS |
| --- | --- | --- |
| **T1 Base** | 8 logical properties all mirror, zero `isRTL` | Same? Especially absolute `start`/`end` — paper#3542 reported iOS-specific breakage (**T20**) |
| **T2 Flip** | double-flip masked; arrows did not flip | Do the arrows flip on iOS? |
| **T5 Input** | `textAlign` from `isRTL` was wrong; from language correct | Does the difference exist on iOS? |
| **T6 Phone** | `+972…` became `54-123-4567 972+`; LRM fixed it | Same corruption? Same fix? |
| **T7 Num** | signed numbers fine in LTR context, corrupt inside RTL sentences | Same? (research said iOS unaffected) |
| **T8 Logic** | `borderInlineStartWidth` silently absent; `start` beats `left` | Same? |
| **T10 Dir** | `direction` prop **works** | Does it work on iOS too? |
| **T12 Lang** | `reloadAppAsync()` applied the flip **without** `expo-updates` | **Critical** — does the reload apply direction on iOS? |
| **T14 Shadow** | `shadowOffset` inert, `boxShadow` renders | On iOS `shadowOffset` should render — does it mirror? |
| **T21 Safe** | insets correct, double-inset bug found and fixed | Notch/Dynamic Island values; `insets.left/right` in **landscape** (non-zero there) |
| **T24 Kbd** | 10-case matrix: 6 fail, 4 pass, exactly as predicted | Which cases fail on iOS? Likely different |
| **T25 Blur** | needs 4 conditions; `BlurTargetView` required | On iOS blur should work without `BlurTargetView` — confirm |

---

## T19 — `expo-localization` plugin vs a hand-written AppDelegate patch

The original guide recommended a custom config plugin patching `AppDelegate.swift`. Research
says `expo-localization`'s built-in props do the same on **both** platforms and are strictly
better. Android already confirmed the plugin writes real string resources.

```jsonc
["expo-localization", { "supportsRTL": true, "forcesRTL": true }]
```

Set `forcesRTL: true`, rebuild, launch with the app language set to **English**.

**Record:** is the layout RTL from the first frame with no reload? If yes, a custom
AppDelegate plugin is unnecessary.

⚠️ Set `forcesRTL` back to `false` afterwards — it breaks the runtime-switching tests.

---

## Recording results

Append to `RESULTS.md`:

```md
### T<N> — <name>
- **Platform:** iOS 18 / iPhone 15 Pro · RN 0.86.2
- **App language:** he
- **Result:** ✅ / ❌ / ⚠️ / 🔀
- **Observed:** <what was literally on screen>
- **Screenshot:** screenshots/t<N>-ios.png
- **Implication:** <what changes in the rules>
```

Save screenshots as `screenshots/t<N>-ios.png`.

**Any 🔀 (platform difference) is the most valuable kind of finding** — the whole point of the
iOS pass. Add those to `SUMMARY.md` too.

Promote a rule into `SKILL_RULES.md` only once it is backed by an actual measurement.

---

## When you are done

```bash
git add -A
git commit -m "iOS results"
git push
```

The Windows session then merges both halves, re-verifies anything that changed, and builds
the Claude Code skill from **verified rules only**.

---

## Ground rules

1. **Public repo — never commit secrets.** No keystores, provisioning profiles, tokens, or
   code copied from private projects.
2. **Do not change test semantics to make a test pass.** If a test is wrong, note it.
3. **Record contradictions loudly.** iOS disagreeing with Android is a finding, not a problem.
4. **Everything is pinned to RN 0.86.2 / SDK 57.** RN's RTL behaviour changed in 0.74, 0.75,
   0.76, 0.77–0.78 and 0.80 — do not generalise across versions.
5. **Take screenshots at mid values**, not extremes — the blur test showed that `intensity=100`
   makes a correct result indistinguishable from a broken one.
