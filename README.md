# rtl-rn-test

Two things live here:

| | What | For whom |
| --- | --- | --- |
| **[`harness/`](harness/)** | A React Native test app that measures RTL behaviour on real devices, plus every result and screenshot | Anyone verifying RTL behaviour on their own RN version, or re-running these tests |
| **[`skill/`](skill/)** | A Claude Code skill built from the verified findings | Anyone who wants an AI agent to write correct RTL code |

**Environment measured:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric)
**Devices:** Galaxy S21 Ultra (Android 15) · iPhone 16 Pro Max (iOS 26.5.2) · Pixel 6 Pro emulator

---

## Why this exists

Most RTL bugs in React Native are not caused by RTL being hard. They are caused by
developers — and especially AI agents — **re-mirroring what the framework already
mirrored**, and by a set of failures that are completely silent.

A research pass over the RN docs, Yoga docs, GitHub issues and community posts produced a
list of claims about RTL. This repo tested them on hardware. **Eight of those claims turned
out to be false**, including three that came from official sources.

### The headline findings

- **`I18nManager.isRTL` cannot be trusted.** On Android it reads `false` while the layout is
  fully mirrored; on iOS `forceRTL` never applies at all. Code that branches on it is wrong
  on both platforms — and a wrong flag can make broken code *look* correct.
- **`forceRTL()` + reload has no working configuration on iOS**, verified on a Release build
  with Metro killed and the app freshly installed.
- **Driving direction from app state via the `direction` style prop works on both platforms**,
  in both directions, with a live language switch and no reload. That is the recommended
  pattern, and it is what the skill teaches.
- **On Android, text alignment follows layout direction, not text content** — the opposite of
  the most widely-cited claim about it.
- **A leading `+` in a phone number migrates to the end inside RTL text.** `textAlign` does
  not fix it; only BiDi isolation does. This corrupts data users act on.

Full list: [`harness/SUMMARY.md`](harness/SUMMARY.md).

---

## `skill/` — the Claude Code skill

```
skill/rtl-react-native/
├── SKILL.md                      # the rules, ~200 lines
├── references/
│   ├── rules.md                  # every rule with its evidence
│   └── recipes.md                # copy-paste patterns
└── assets/
    ├── direction.tsx             # DirectionProvider + useDirection
    └── eslint-plugin-rtl/        # 6 lint rules, unit-tested
```

Install:

```bash
cp -r skill/rtl-react-native ~/.claude/skills/          # all projects
# or
cp -r skill/rtl-react-native <project>/.claude/skills/  # one project
```

It triggers on RTL work — Hebrew/Arabic layouts, `I18nManager`, mirrored mockups, or
symptoms like *"RTL only works on the second launch"* and *"the + moved to the end of the
phone number"*.

**The lint plugin matters as much as the prose.** Every bug measured here is silent —
no error, no warning, wrong result. Guidance gets forgotten; a lint error does not.

---

## `harness/` — the test app

```bash
cd harness
npm install

npx expo prebuild --platform android && npx expo run:android
npx expo prebuild --platform ios && npx expo run:ios      # macOS
```

A **dev build is required.** Expo Go resets RTL preferences on launch, so RTL measured
there is meaningless.

15 test tabs, each stating its expectation on screen so a screenshot is self-documenting
evidence. Highlights:

| Tab | Question it answers |
| --- | --- |
| T2 Flip | Does the `isRTL` ternary actually break layout? |
| T3 Text | Do iOS and Android disagree on default text alignment? |
| T5 Input | Direction-source comparison — the clearest single demonstration |
| T12 Lang | Can direction change without `expo-updates`, or without a reload at all? |
| T24 Kbd | 10-case keyboard matrix — which wrappers hide the focused field |
| T25 Blur | What Android requires that iOS forgives |
| T27 Line | Why text is clipped or off-centre in buttons |
| T29 Where | Where `direction` must sit to take effect |

Documents:

- [`SUMMARY.md`](harness/SUMMARY.md) — what works, what doesn't, what was disproven
- [`SKILL_RULES.md`](harness/SKILL_RULES.md) — every rule with its evidence
- [`RESULTS.md`](harness/RESULTS.md) — per-test observations
- [`TEST_PLAN.md`](harness/TEST_PLAN.md) — procedures and pass/fail criteria
- [`TODO.md`](harness/TODO.md) — what is closed and what remains

Also included: `scripts/capture-tab.py` (Android scroll-and-stitch capture) and
`scripts/ios-screenshot.sh` (iOS 26 capture, where `idevicescreenshot` and `devicectl` both
fail).

---

## Method

1. **Nothing is asserted without a measurement.** Rules that could not be verified stay in
   `TEST_PLAN.md` until a device settles them.
2. **Findings are version-pinned.** RN's RTL behaviour changed in 0.74, 0.75, 0.76,
   0.77–0.78 and 0.80. Do not generalise across versions without re-testing.
3. **Surprises are the deliverable.** A failed expectation is recorded, not fixed away.
4. **Both directions, both platforms, opposite-script content.** Direction bugs are
   invisible when tested only with the app's own script.

---

## Build note

Expo SDK 57 does not compile on **Xcode 26.2** out of the box — `expo-modules-jsi` hits a
Swift 6.2 type-inference error. The fix is patched in `node_modules`, which any
`npm install` erases. See finding **B1** in `harness/RESULTS.md`; it still needs a
`patch-package` entry to be reproducible.

⚠️ Public repository. No secrets, credentials, or code from private projects.
