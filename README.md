# rtl-rn-test

A React Native app that **measures** right-to-left behaviour on real devices, plus every
result, screenshot and conclusion it produced.

This is the evidence. The deliverable built from it is a Claude Code skill, kept in its own
repository so it can be installed without dragging this history along:

**→ [unbywyd/claude-skill-rtl-react-native](https://github.com/unbywyd/claude-skill-rtl-react-native)**

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric)
**Devices:** Galaxy S21 Ultra (Android 15) · iPhone 16 Pro Max (iOS 26.5.2) · Pixel 6 Pro emulator

---

## Why

A research pass over the RN docs, Yoga docs, GitHub issues and community posts produced a
list of claims about RTL in React Native. Rather than trust them, this app tested them on
hardware.

**Eight of those claims turned out to be false** — including three from official sources.

### The headline findings

- **`I18nManager.isRTL` cannot be trusted.** On Android it reads `false` while the layout is
  fully mirrored; on iOS `forceRTL` never applies at all. Code branching on it is wrong on
  both platforms — and a wrong flag can make broken code *look* correct on the device you
  happen to be holding.
- **`forceRTL()` + reload has no working configuration on iOS**, verified on a Release build
  with Metro killed and the app freshly installed.
- **Driving direction from app state via the `direction` style prop works on both
  platforms**, in both directions, with a live language switch and no reload.
- **On Android, text alignment follows layout direction, not text content** — the opposite of
  the most widely-cited claim about it.
- **A leading `+` in a phone number migrates to the end inside RTL text.** `textAlign` does
  not fix it; only BiDi isolation does. That corrupts data users act on.

Full list: [`harness/SUMMARY.md`](harness/SUMMARY.md).

---

## Running the harness

```bash
cd harness
npm install

npx expo prebuild --platform android && npx expo run:android
npx expo prebuild --platform ios && npx expo run:ios      # macOS
```

A **dev build is required.** Expo Go resets RTL preferences on launch, so anything measured
there is meaningless.

15 tabs, each stating its expectation on screen so a screenshot is self-documenting
evidence:

| Tab | Question it answers |
| --- | --- |
| T1 Base | Does RN mirror logical properties with zero `isRTL`? |
| T2 Flip | Does the `isRTL` ternary actually break layout? |
| T3 Text | Do iOS and Android disagree on default text alignment? |
| T5 Input | Direction-source comparison — the clearest single demonstration |
| T7 Num | Do signed numbers reorder under RTL bidi? |
| T8 Logic | Logical-property families, precedence traps, silent no-ops |
| T10 Dir | Where does the `direction` prop work? |
| T12 Lang | Can direction change without `expo-updates`, or without a reload at all? |
| T21 Safe | Safe-area insets, system bars, edge-to-edge |
| T24 Kbd | 10-case keyboard matrix — which wrappers hide the focused field |
| T25 Blur | What Android requires that iOS forgives |
| T27 Line | Why text is clipped or off-centre in buttons |
| T29 Where | Where `direction` must sit to take effect |

---

## Documents

| File | What is in it |
| --- | --- |
| [`SUMMARY.md`](harness/SUMMARY.md) | What works, what doesn't, what was disproven |
| [`SKILL_RULES.md`](harness/SKILL_RULES.md) | Every rule with the measurement behind it |
| [`RESULTS.md`](harness/RESULTS.md) | Per-test observations, screenshot by screenshot |
| [`TEST_PLAN.md`](harness/TEST_PLAN.md) | Procedures and pass/fail criteria |
| [`TODO.md`](harness/TODO.md) | What is closed, what remains |
| [`MAC_INSTRUCTIONS.md`](harness/MAC_INSTRUCTIONS.md) | iOS session handoff |

Tooling built along the way:

- `harness/tools/eslint-plugin-rtl/` — 6 lint rules, unit-tested (also shipped with the skill)
- `harness/scripts/capture-tab.py` — Android scroll-and-stitch screenshot capture
- `harness/scripts/ios-screenshot.sh` — iOS 26 capture, where `idevicescreenshot` and
  `devicectl` both fail

---

## Method

1. **Nothing is asserted without a measurement.** Unverified rules stay in `TEST_PLAN.md`
   until a device settles them.
2. **Findings are version-pinned.** RN's RTL behaviour changed in 0.74, 0.75, 0.76,
   0.77–0.78 and 0.80. Do not generalise without re-testing.
3. **Surprises are the deliverable.** A failed expectation is recorded, not fixed away.
4. **Both directions, both platforms, opposite-script content.** Direction bugs are
   invisible when tested only with the app's own script.

Contributions welcome — especially results from other RN versions, other devices, or tests
this harness does not yet cover.

---

## Build note

Expo SDK 57 does not compile on **Xcode 26.2** out of the box — `expo-modules-jsi` hits a
Swift 6.2 type-inference error (`abs(_:)` no longer resolves against a `@usableFromInline`
global).

**Already fixed here:** `harness/patches/expo-modules-jsi+57.0.4.patch`, applied
automatically via `postinstall: patch-package`. A clean `npm install` builds. See finding
**B1** in `harness/RESULTS.md` for the diagnosis.

⚠️ Public repository. No secrets, credentials, or code from private projects.
