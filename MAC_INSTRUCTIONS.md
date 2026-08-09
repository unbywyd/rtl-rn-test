# Mac / iOS Session — Instructions

**Read this first, then `TEST_PLAN.md`.** You are continuing work started on Windows.
Android results are already recorded in `RESULTS.md`; your job is the iOS half and the
cross-platform comparison.

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric)
**Repo:** https://github.com/unbywyd/rtl-rn-test — ⚠️ **public**, no secrets ever.

---

## Why this app exists

A deep research pass produced 13 proposed corrections to an RTL engineering guide
(`RTL_I18N_GUIDE.md`, kept in a separate private repo). Several rest on community
sources or contradict each other. This app settles them **empirically** rather than
by argument. The iOS half is where the most important open questions live, because
iOS is where RTL behaves differently.

**Do not "fix" surprising behavior.** A surprising result is the deliverable. Record it.

---

## Setup

```bash
git clone https://github.com/unbywyd/rtl-rn-test.git
cd rtl-rn-test
npm install

npx expo prebuild --platform ios --clean
npx expo run:ios          # or open ios/*.xcworkspace in Xcode
```

A **dev build is mandatory**. Do NOT use Expo Go — it resets RTL preferences when
opening the launcher, so RTL results there are meaningless.

---

## Your tasks, in priority order

### ⭐ 1. T15 — the iOS text-alignment question (highest value)

The guide claims: on **Android** `textAlign: 'auto'` resolves from the **text content**;
on **iOS** it resolves from the **app bundle's localization**. Consequence: Hebrew text
drifts LEFT on iOS while looking correct on Android.

- Open the **T3 Text** tab.
- Screenshot the "No textAlign at all" section.
- Compare against `screenshots/t3-android.png`.

**Record:** do the unmarked Hebrew rows align differently between platforms?

### ⭐ 2. T16 — does bundle localization change it?

If T15 confirms the bundle theory, adding the locale should change the default.

```jsonc
// app.json → expo.ios
"infoPlist": { "CFBundleLocalizations": ["en", "he", "ar", "ru"] }
```

Rebuild, re-check T3. **Record:** did declaring `he` change the default alignment?

This decides whether the guide states bundle localization as a *hard prerequisite* or
merely a nice-to-have.

### ⭐ 3. T18 — first launch after install

The original problem that started all of this: "RTL only works the second time".

1. **Delete the app from the device** (not just close it).
2. Reinstall and launch **once**.
3. Watch the very first frame.

**Record:** is the direction correct on first launch, or does it need a relaunch?
The app reloads under its own splash when direction flips — check `RESULTS.md` for what
Android did.

### 4. T12 — the reload question

This project has **no `expo-updates`**. Open the **T12 Lang** tab and switch he → en.

**Record:** after the reload, does `isRTL` match the new language ("IN SYNC" chip green)?
- If yes → the guide's "expo-updates is mandatory" claim is **wrong**.
- If it stays MISMATCH → the claim holds on iOS.

Everything needed is on-screen, including the strategy actually used.

### 5. T17 — `writingDirection` under Fabric

Research (RN #51235) says it regressed to a no-op on iOS Fabric. The **T3 Text** tab has
a section with `writingDirection` and no `textAlign`.

**Record:** do the `rtl` and `ltr` rows look identical? If so, it does nothing.

### 6. T19 — `expo-localization` plugin vs a custom AppDelegate patch

The guide currently recommends a hand-written config plugin. Research says
`expo-localization`'s built-in props do it on both platforms and are strictly better.

```jsonc
["expo-localization", { "supportsRTL": true, "forcesRTL": true }]
```

Set `forcesRTL: true`, rebuild, launch **with the app language set to English**.

**Record:** is the layout RTL from the first frame with no reload? If yes, the custom
plugin (guide correction C3) is unnecessary.

⚠️ Set `forcesRTL` back to `false` afterwards — it breaks the runtime-switching tests.

### 7. T20 — `start`/`end` absolute positioning

paper#3542 reported `start`/`end` failing for absolute positioning on iOS while working
on Android. Open **T8 Logic**, section "T20".

**Record:** do the `start:10` and `left:10` boxes land in the same place in RTL?

### 8. T1–T14 — run the rest

Work through `TEST_PLAN.md` and fill in the iOS column. Screenshot each tab in Hebrew
and in English.

---

## Recording results

Append to `RESULTS.md` using the template at the bottom of that file. For each test:

- platform + OS version + device
- ✅ / ❌ / ⚠️ / 🔀
- **what was actually on screen** — not what you expected
- screenshot path (`screenshots/t15-ios.png`)
- what it implies for the guide

Save screenshots to `screenshots/` with the naming `t<N>-ios.png`.

---

## When you are done

```bash
git add -A
git commit -m "iOS results: T1-T20"
git push
```

Then the Windows session picks it up, re-verifies anything that changed, corrects the
guide from the merged evidence, and builds the Claude Code skill from **verified rules only**.

---

## Ground rules

1. **Never push secrets.** Public repo. No keystores, tokens, provisioning profiles, or
   code copied from private projects.
2. **Do not change test semantics** to make a test pass. If a test is wrong, note it.
3. **Record contradictions loudly.** If iOS contradicts the Android result, that is a
   🔀 finding and it belongs in the guide.
4. **Note the versions.** Everything here is pinned to RN 0.86.2 / SDK 57.
