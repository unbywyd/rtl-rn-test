# Results

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric) · TypeScript 6

Legend: ✅ matches the guide · ❌ contradicts it · ⚠️ works with a caveat · 🔀 platform difference

> All findings are **pinned to RN 0.86.2**. RN's RTL behavior changed in 0.74, 0.75, 0.76,
> 0.77–0.78 and 0.80. Do not generalize without re-testing.

---

## Static checks (verified on Windows, no device needed)

### S1 — `textAlign` accepted values ✅
- **Source:** `node_modules/react-native/types/public/ReactNativeRenderer.d.ts:630`
- **Observed:** `textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify' | undefined;`
- **Result:** ✅ **No `start`/`end`.** Confirms guide R8 on this version.
- **Implication:** `textAlign: 'start'` is invalid here. Research said it merged to main
  (PR #57201) but had not shipped — 0.86.2 confirms it still has not. Keep R8, but state
  it as version-conditional.

### S2 — Fabric iOS reload fix present ✅
- **Command:** `grep -c "_updateLayoutContext" node_modules/react-native/React/Fabric/Surface/RCTFabricSurface.mm`
- **Observed:** `4` (3 = unpatched, 4 = patched)
- **Result:** ✅ This version is **outside** the 0.77.0–0.78.2 backport gap.
- **Implication:** iOS reload-applies-direction should work here. If T12/T18 fail on iOS
  anyway, the cause is NOT the known Fabric bug.

### S3 — `boxShadow` exists cross-platform ⚠️
- **Source:** `StyleSheetTypes.d.ts:516` → `boxShadow?: ReadonlyArray<BoxShadowValue> | string`
- **Result:** ⚠️ Research finding C11 ("shadowOffset is iOS-only, so RTL correction is a
  no-op on Android") may be **outdated** — a cross-platform shadow API now exists.
- **Next:** T14 must determine whether `boxShadow` renders on Android and whether it mirrors.

### S4 — `direction` style prop present ✅
- **Source:** `StyleSheetTypes.d.ts:114` → `direction?: 'inherit' | 'ltr' | 'rtl'`
- **Result:** ✅ Present in types with **no platform annotation**.
- **Next:** T10 must determine whether it actually works on Android under Fabric
  (research open question Q2 — sources contradict each other).

---

## Android runtime results

**Device:** Android emulator, Pixel 6 Pro, API 34 · device locale `en-US` · app language `he`
**Build:** debug dev-client, Metro-served

### T2 — Double flip ✅ (with an important surprise)
- **Result:** ✅ the demo works — but see the ⚠️ below, which is a more valuable finding.
- **Observed:** With the app in Hebrew, the whole UI is mirrored: headings right-aligned,
  the `flex-start` box sits at the **right** edge, and the `row` of 1·2·3 reads **3 2 1**
  left-to-right (i.e. 1 is rightmost). Correct RTL.
- **Screenshot:** `screenshots/t2-android-doubleflip.png`

### ❌⭐ **MAJOR FINDING: layout is mirrored while `I18nManager.isRTL === false`**

This was not on the test list. It is the most important result so far and it is
**reproducible across a cold start**.

- **Observed:** the header prints `android · he · isRTL=false` and the T2 screen prints
  `I18nManager.isRTL = false`, **yet Yoga has fully mirrored the layout** — headings
  right-aligned, `flex-start` box at the right edge, `row` of 1·2·3 rendering 1 at the right.
- **Persisted native state proves the flag IS set:**
  ```xml
  <!-- /data/data/com.rtltest.app/shared_prefs/com.facebook.react.modules.i18nmanager.I18nUtil.xml -->
  <boolean name="RCTI18nUtil_allowRTL" value="true" />
  <boolean name="RCTI18nUtil_forceRTL" value="true" />
  ```
- **Mechanism, confirmed in RN 0.86.2 source**
  (`Libraries/ReactNative/I18nManager.js`):
  ```js
  const i18nConstants = getI18nManagerConstants();   // read ONCE at module load
  export default {
    getConstants: () => i18nConstants,               // never re-reads
    forceRTL: (v) => NativeI18nManager.forceRTL(v),   // writes native, does NOT update the cache
  }
  ```
  `isRTL` is a **module-load snapshot**. `forceRTL()` writes through to native (and Yoga
  picks it up on the next layout pass), but the JS-visible constant keeps its old value
  **for the entire JS session** — a Metro reload re-runs the module, but that did not
  resolve it here either, because the dev-client's reload path did not re-instantiate the
  constant in a fresh JS context.
- **Result:** ❌ This **contradicts how the guide describes the model.** The guide treats
  "the flag" as one thing that is either applied or not. In reality there are **two
  values that can disagree**: the native/Yoga layout direction, and the cached JS `isRTL`.

**Consequences for the guide — significant:**

1. **It strengthens the central thesis empirically.** Layout mirrored correctly while
   `isRTL` read `false`. Any code gating layout on `isRTL` would have produced **LTR
   layout inside an RTL screen** here. This is the double-flip bug, caught in the wild, on
   a clean project, with no contrived setup.
2. **The T2 demo rows currently look identical**, because the ternary evaluated `false` →
   `flex-start`, coincidentally matching the correct row. The teaching screenshot needs a
   session where both values agree — see "next steps".
3. **Everything keyed off `isRTL` is out of sync with the layout in this state:**
   directional icons, `TextInput.textAlign`, carousel index math. This is the *worst*
   failure mode, because layout is right and the manual corrections are wrong.
4. **This is a strong argument for not keying anything off `isRTL` when avoidable** — the
   value is not a reliable live view of the layout direction.

**Still to determine:** whether a true process-level cold start (rather than the dev-client
relaunch used here) makes `isRTL` agree. The `am force-stop` + relaunch performed here did
**not**. If a release build behaves differently, that difference itself belongs in the guide.

- **Screenshots:** `screenshots/t2-android-doubleflip.png`, `screenshots/t2-android-coldstart.png`

### T13 — `android:supportsRtl` ✅ (static)
- **Observed:** `android:supportsRtl="true"` present in the generated
  `android/app/src/main/AndroidManifest.xml`.
- **Also:** the `expo-localization` plugin wrote both string resources:
  `ExpoLocalization_supportsRTL=true`, `ExpoLocalization_forcesRTL=false`.
- **Implication:** Expo's prebuild satisfies the RN 0.75+ gating requirement by default.
  Confirms the plugin does real work on Android — supporting research correction C3 that a
  hand-written iOS-only AppDelegate plugin is the inferior option.

---

## iOS runtime results

> Filled in during the Mac session. See `MAC_INSTRUCTIONS.md`.

_(pending)_

---

## Cross-platform differences (🔀)

> The most valuable section. Any test where iOS and Android disagree goes here.

_(pending)_

---

## Guide corrections proven / disproven

| # | Question | Verdict | Evidence |
| --- | --- | --- | --- |
| Q1 | Does `reloadAppAsync()` apply an RTL flip without expo-updates? | pending | T12 |
| Q2 | Does `direction: 'ltr'` work on Android under Fabric? | pending | T10 |
| Q3 | Is `shadowOffset` still iOS-only, or does `boxShadow` supersede it? | partial (S3) | T14 |
| Q4 | Is Android signed-number reordering real on 0.86? | pending | T7 |
| Q5 | Does iOS `<Text>` default-align from the bundle, not content? | pending | T3/T15 |
| Q6 | Does `writingDirection` do anything on iOS Fabric? | pending | T17 |
| R8 | Is `textAlign: 'start'` invalid? | ✅ **confirmed** | S1 |

---

## Template

```md
### T<N> — <name>
- **Platform:** Android 14 / Pixel 7 (or iOS 18 / iPhone 15)
- **App language:** he
- **Result:** ✅ / ❌ / ⚠️ / 🔀
- **Observed:** <what was literally on screen>
- **Screenshot:** screenshots/t<N>-<platform>.png
- **Implication:** <what changes in the guide>
```
