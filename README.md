# rtl-rn-test

A minimal React Native / Expo app built for one purpose: **settling open questions about
RTL behavior empirically**, instead of arguing from documentation that is thin,
contradictory, or version-stale.

**Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric)**

---

## Why

A deep research pass over the RN docs, Yoga docs, GitHub issues and community sources
produced 13 proposed corrections to an internal RTL engineering guide. Several of them:

- rest on community blog posts rather than official documentation,
- contradict each other across sources,
- or are version-specific in ways that may not hold on current RN.

Rather than guess, this app renders each disputed behavior on screen, on both platforms,
and the observed result becomes the source of truth.

The verified output eventually becomes a reusable skill for AI coding agents — which is
the real motivation, because **AI agents get RTL wrong in a specific, repeatable way**
(see the T2 screen).

---

## The headline question

Most RTL bugs in React Native are not caused by RTL being hard. They are caused by
developers — and especially LLMs — **re-mirroring what RN already mirrored**.

An RTL mockup is *already* flipped. Reading "the element is on the right" off that image
and writing `flex-end` produces a double flip, and the element lands on the left.

The **T2 Double Flip** screen demonstrates this in one screenshot. That screenshot is the
whole reason this repo exists.

---

## Test screens

| Tab | Tests | Question |
| --- | --- | --- |
| T2 Flip | T2 | Does the `isRTL` ternary actually break layout? |
| T3 Text | T3, T4, T17 | Do iOS and Android disagree on default text alignment? |
| T12 Lang | T11, T12 | Can direction flip without `expo-updates`? |
| T1 Base | T1 | Does RN mirror logical properties with zero `isRTL`? |
| T5 Input | T5, T6 | `TextInput` alignment, phone/email forced LTR |
| T7 Num | T7 | Do signed numbers reorder under RTL bidi? |
| T8 Logic | T8, T9, T20 | `*Inline*` family, precedence traps, silent no-ops |
| T10 Dir | T10 | Does the `direction` style prop work on Android? |
| T14 Shadow | T14 | `shadowOffset` vs `elevation` vs `boxShadow` |
| T27 Line | T27 | Why is text clipped or off-centre in buttons and inputs on iOS? |
| T29 Where | T29 | Where must `direction` sit, and does it survive a runtime change? |

---

## The answer this repo arrived at

`I18nManager.forceRTL()` + reload is **not portable**. It works on Android (while `isRTL` lies about
it) and has **no working configuration on iOS** — measured in a dev build *and* in a Release build
with Metro killed and the app freshly installed.

What does work, on both platforms and in both directions, is driving direction from **app state**:

```jsx
<DirectionProvider lang={lang}>   // one wrapper, at the root
  <App />
</DirectionProvider>
```

- `src/lib/direction.tsx` — the wrapper plus `useDirection()` for the two things Yoga cannot
  inherit: mirrored icons and explicit `textAlign`
- Logical properties inside (`marginStart`, `start`/`end`, plain `'row'`) mirror automatically
- **No `isRTL` anywhere** — the flag is unreliable on Android and never becomes true on iOS
- `forceRTL` stays only in `app.json`, for the first frame before JS runs

Full reasoning: **R22** in [SKILL_RULES.md](SKILL_RULES.md). Evidence: T2/T10/T12/T18/T28/T29 in
[RESULTS.md](RESULTS.md).

## Tooling built along the way

| What | Where | Why |
| --- | --- | --- |
| **RTL linter** — 5 rules, unit-tested | [`tools/eslint-plugin-rtl/`](tools/eslint-plugin-rtl/index.js) | Every bug measured here is *silent*. Prose guidance is forgotten; a lint error is not. `npm run lint:rtl` · `npm run test:rtl-rules` (**R23**) |
| **iOS screenshot capture** | [`scripts/ios-screenshot.sh`](scripts/ios-screenshot.sh) | On iOS 26 `idevicescreenshot` and `devicectl` both fail. `pymobiledevice3 … --userspace` works with no root |
| **Android tall-screen capture** | [`scripts/capture-tab.py`](scripts/capture-tab.py) | Scroll-and-stitch via `adb`; no iOS equivalent exists |

Full procedures and pass/fail criteria: **[TEST_PLAN.md](TEST_PLAN.md)**
Progress and checklist: **[TODO.md](TODO.md)**
Findings: **[RESULTS.md](RESULTS.md)**
iOS session handoff: **[MAC_INSTRUCTIONS.md](MAC_INSTRUCTIONS.md)**

---

## Running

```bash
npm install

# Android
npx expo prebuild --platform android
npx expo run:android

# iOS (Mac only)
npx expo prebuild --platform ios
npx expo run:ios
```

**A dev build is required.** Expo Go resets RTL preferences when opening the launcher, so
RTL results measured there are meaningless.

---

## Design notes

- **No `isRTL` in layout code.** The UI kit and most screens use logical properties only,
  proving that correct RTL needs no manual mirroring. `isRTL` appears solely inside tests
  that are explicitly *about* `isRTL`.
- **`expo-updates` is deliberately not installed** — test T12 turns on whether a reload
  can be achieved without it.
- **Every screen states its expectation on-screen**, so a screenshot is self-documenting
  evidence without needing the test plan open beside it.

---

## Status

- **Android runtime pass — complete** (Galaxy S21 Ultra + Pixel 6 Pro emulator). See `SUMMARY.md`.
- **iOS runtime pass — substantially complete** (iPhone 16 Pro Max, iOS 26.5.2, Xcode 26.2).
  T2 · T3/T4 · T5 · T7 · T8/T9 · T10 · T12 · T14 · T17 · T18 · T21–T25 · T27 · T28 · T29 measured.
- **Next: re-run Android** for the tests added during the iOS session (T27, T28, T29) and for the
  ones the iOS pass could only measure in an LTR layout. Open items are listed in `TODO.md`.

⚠️ **Build note:** Expo SDK 57 does not compile on **Xcode 26.2** out of the box —
`expo-modules-jsi` hits a Swift 6.2 type-inference error. This repo patches it in `node_modules`,
which **any `npm install` erases**. See finding **B1** in `RESULTS.md`; it needs a `patch-package`
entry to be reproducible.

⚠️ This is a public repository. It contains no secrets, credentials, or code from private
projects.
