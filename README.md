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

Static checks are done (see RESULTS.md). Android and iOS runtime passes are pending.

⚠️ This is a public repository. It contains no secrets, credentials, or code from private
projects.
