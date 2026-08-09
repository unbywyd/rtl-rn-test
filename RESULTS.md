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

**Resolved — it is NOT a dev-client artifact.** Tested exhaustively:

| Scenario | Layout | `isRTL` |
| --- | --- | --- |
| debug, first launch | mirrored ✅ | `false` ❌ |
| debug, cold restart | mirrored ✅ | `false` ❌ |
| **release**, fresh install, 1st launch | mirrored ✅ | `false` ❌ |
| **release**, cold restart (flag persisted) | mirrored ✅ | `false` ❌ |

**Root cause, traced through RN 0.86.2 Android source:**

`I18nManagerModule.kt:26` computes the constant at **native module construction**:
```kotlin
"isRTL" to I18nUtil.instance.isRTL(context)
```
`I18nManager.js` then snapshots it once at module load and never re-reads it. So the value
is fixed **before JS runs**, while `forceRTL()` writes to SharedPreferences that only the
*next* native-module construction would read.

A second, independent defect in the same file — `I18nUtil.kt:66`:
```kotlin
TextUtilsCompat.getLayoutDirectionFromLocale(Locale.getAvailableLocales()[0])
```
`isDevicePreferredLanguageRTL` reads **`Locale.getAvailableLocales()[0]`** — an arbitrary
entry from the JVM's full locale table — **not** the device's preferred locale. So the
"device language is RTL" branch is not reliably testing the device language at all.

**Net:** with device locale `en-US`, `isRTL` is computed `false` at startup and stays `false`
for the process lifetime, regardless of what the app later forces. Yoga, meanwhile, reads
the persisted native flag on each layout pass and mirrors correctly.

**Screenshots:** `t2-android-doubleflip.png`, `t2-android-coldstart.png`,
`t2-android-release-firstlaunch.png`, `t2-android-release-secondlaunch.png`,
`release-launch1.png`, `release-launch2.png`

**Hebrew system locale tested too — same result.** The emulator's `persist.sys.locale` was
set to `he-IL`, rebooted, and the release APK reinstalled fresh (no persisted flag):

| System locale | App language | Layout | `isRTL` |
| --- | --- | --- | --- |
| `en-US` | he | mirrored ✅ | `false` ❌ |
| **`he-IL`** | he | mirrored ✅ | **`false` ❌** |

So even the `isRTLAllowed && isDevicePreferredLanguageRTL` branch does not make the
constant `true` — consistent with the `Locale.getAvailableLocales()[0]` defect above,
which never actually consults the device's preferred locale.

**Screenshot:** `t2-android-hebrew-systemlocale.png`

**Physical device confirms it — no caveat remains.**

Samsung Galaxy S21 Ultra (SM-G998B), **Android 15**, arm64-v8a, system locale `ru-RU`,
release APK built for arm64, fresh install:

| Device | Android | Locale | Launch | Layout | `isRTL` |
| --- | --- | --- | --- | --- | --- |
| Emulator Pixel 6 Pro | 14 (API 34) | en-US / he-IL | 1st & cold | mirrored ✅ | `false` ❌ |
| **Galaxy S21 Ultra** | **15** | **ru-RU** | **1st** | mirrored ✅ | **`false` ❌** |
| **Galaxy S21 Ultra** | **15** | **ru-RU** | **cold restart** | mirrored ✅ | **`false` ❌** |

Reproduces identically on real hardware, a newer Android version, a different CPU
architecture and a third system locale. **The finding is general, not an emulator artifact.**

**Screenshots:** `phone-launch1.png`, `phone-launch2.png`

### Consolidated conclusion for the guide

On **Android / RN 0.86.2**, `I18nManager.isRTL` is a startup snapshot that can be `false`
for the entire process lifetime while the app renders fully mirrored. Therefore:

- **Never gate layout on `isRTL`.** Not merely "it is redundant" (the guide's current
  framing) but **"it is unreliable"** — it can be wrong in the direction that silently
  produces LTR layout inside an RTL screen.
- **`isRTL` is also unreliable for the legitimate exceptions** (icons, `textAlign`,
  index math). Those need a direction source that reflects the *actual* rendered
  direction — the app's own language state is a better source than `I18nManager.isRTL`.
- This is the strongest empirical support yet for the user's position that `isRTL` is
  overused: measured here, it was not just unnecessary — it was **factually wrong**.

### T21/T22/T23 — Safe area, system bars, keyboard (Galaxy S21 Ultra, Android 15, LTR/en)

**Live inset values on this device:**
```
top: 27.38     bottom: 48     left: 0     right: 0
screen: 384×853 dp   (physical 1080×2400 → density ≈ 2.8)
StatusBar.currentHeight: 27.38
```

- **Edge-to-edge is correctly configured** ✅ — `bottom: 48` is non-zero on a
  3-button-nav device, which is the documented signal that insets are live. Android 15
  ignores window-fitting flags entirely, so insets are the only correct mechanism.
- **Units are dp, not px.** `insets.bottom: 48` is ~134 physical pixels here. Worth
  stating in the guide: a "small" inset number is a large visual band.

### ❌ **Finding: double-counted bottom inset (the quiet half of the mistake)**
- **Observed:** the final card cleared the nav bar but left roughly twice the necessary
  gap — ~144dp of dead space instead of ~96dp.
- **Cause:** the inset was applied in two places at once — the `ScrollView`'s
  `contentContainerStyle` (`paddingBottom: 48 + insets.bottom`) *and* the card itself
  (`marginBottom: insets.bottom`).
- **Rule for the guide:** apply the bottom inset in **exactly one place**, normally the
  scroll container. There are two symmetrical failure modes and both are bugs:
  1. **Forgetting the inset** → content sits under the nav bar. Loud, obvious.
  2. **Double-counting it** → a large dead gap. Quiet, ships unnoticed.
  An agent told only "remember safe area" reliably produces mode 2.
- **Fixed in `SafeAreaScreen.tsx`**, with the original mistake kept as a code comment.
- **Screenshot:** `en-t21-safe-4-bottom.png`

### ⚠️ Observed during the same pass: content under the nav bar in other tabs
The `ScrollView`s inside the other test screens do **not** add a bottom inset, so their
last rows render under the system navigation (visible on `phone-safearea-top.png`, where
the `1 2 3` row is partly covered). That is failure mode 1, unintentionally demonstrated
by the app itself — a useful before/after pair for the skill.

### T21/T22/T23 in Hebrew (RTL) ✅ — both directions verified

Re-ran the whole safe-area screen with the app in Hebrew on the same device:

- Layout mirrored entirely on its own — headings, card text and filler labels all moved to
  the right. **No `isRTL` in any of that layout code.**
- Insets unchanged and correct: `top 27.38`, `bottom 48`, `left/right 0`.
- **The double-inset fix holds in RTL:** the final blue card sits cleanly above the nav bar
  with a single inset of clearance, versus the doubled gap measured before the fix.
- Header still reports `isRTL=false` — an eighth configuration confirming R1, now also
  after a runtime language switch and reload.

**Screenshots:** `he-t21-safe-1.png`, `he-t21-safe-3.png`, `he-t21-safe-bottom.png`

### T3 / T4 / T17 — CLOSED on Android (Galaxy S21 Ultra, Android 15, RN 0.86.2)

Four measurements, both language halves:

1. **Default alignment follows layout direction, not content** — `en` app + Hebrew string →
   left; `he` app + English string → right. Refutes the RN-blog claim. → R12
2. **First-strong probes disproved** — plain / digit-leading / Latin-leading / emoji-leading
   Hebrew all rendered right in the Hebrew app. No content-based heuristic exists here.
3. **Explicit `textAlign` overrides layout direction** — a `textAlign: 'left'` row stayed
   left inside the RTL screen. This is what makes it the correct tool for always-LTR data.
4. **`writingDirection` does NOT control alignment** — `'rtl'` and `'ltr'` rows rendered
   identically. It must not be offered as an alternative to `textAlign`.

**Mixed-content block** (`רחוב Dizengoff 42, תל אביב`): the unforced row kept its segment
order; the `forced rtl` row moved its label and disturbed the ordering. This is the same
mechanism that breaks phone numbers — Latin text and digits inside RTL text are *weak*
characters that bind to the surrounding direction.

**Screenshots:** `he-t3-text.png`, `he-t5-phone.png`, `he-t3-mixed.png`

### T11 / T12 — CLOSED (Galaxy S21 Ultra, Android 15)

**T12 — direction flip `en → he`:** ✅
```
en → he    directionChanged=true    strategy=expo-reloadAppAsync
```
One reload, direction applied, layout came back mirrored. **`expo-updates` is not installed
in this project** — proving the earlier "expo-updates is mandatory" claim wrong. → R8

**T11 — same-direction switch `he → ar`:** ✅
```
he → ar    directionChanged=false    strategy=not-reloaded
```
Text switched to Arabic instantly, layout stayed RTL, **no reload**. Confirms that only a
direction *change* justifies a restart — reloading on every language switch would needlessly
destroy screen state.

**Bootstrap diagnostics — the restart-loop guard is load-bearing:** ✅
```
isRTLBefore: false   shouldBeRTL: true
flagFlipped: true    guardWasSet: true    needsRestart: false
```
The standard condition "flag disagrees with language → flip and restart" is true on *every*
launch, because `isRTL` never becomes `true` (R1). Only the persisted guard prevented an
infinite restart loop. → R8b

**Screenshots:** `he-t12-lang.png`, `he-t12-diagnostics.png`, `ar-t11-samedirection.png`

### T1 — Baseline auto-mirroring ✅ (Arabic RTL, Galaxy S21 Ultra)

The cleanest demonstration of the whole thesis. With **zero `isRTL` in the code**:

| Property | Written as | Rendered in RTL |
| --- | --- | --- |
| `flexDirection` | `'row'` | 1·2·3 reads with **1 rightmost** ✅ |
| `justifyContent` | `'flex-start'` | hugs the **right** edge ✅ |
| `justifyContent` | `'flex-end'` | hugs the **left** edge ✅ |
| `alignItems` | `flex-start` / `flex-end` | mirrored on the cross axis ✅ |

**And the header reads `isRTL = false` throughout.** Yoga mirrored everything correctly while
the JS flag claimed otherwise — so the screen with **no** direction logic is correct, while
T2, which uses `isRTL` "properly", is broken.

This is the empirical core of the skill: **RTL layout works on its own.** Touching it is not
merely redundant, it is actively harmful, because the flag most code reaches for is wrong.

Second half of the screen — every documented logical property mirrored correctly:

| Property | Rendered in RTL |
| --- | --- |
| `marginStart: 40` | gap on the **right** ✅ |
| `paddingStart: 40` | gap on the **right** ✅ |
| `borderStartWidth: 6` | thick border on the **right** ✅ |
| `start: 0` (absolute) | pinned **right** ✅ |
| `end: 0` (absolute) | pinned **left** ✅ |

Notably **absolute positioning with `start`/`end` works** — a known historical soft spot
(RN #8137, and paper#3542 reported iOS-specific breakage). On RN 0.86.2 / Android it is
correct. The iOS half of that remains open for the Mac session.

**`left` / `right` auto-swap confirmed:** a box with `left: 0` rendered pinned to the
**right** edge, so `doLeftAndRightSwapInRTL` is on by default. Physical `left`/`right` are
therefore **not broken** in RTL — they mirror. Prefer `start`/`end` for a different reason:
they state intent and do not depend on a runtime flag that any code can disable via
`swapLeftAndRightInRTL(false)`.

**Eight properties verified, all correct, with zero `isRTL` in the code:**
`flexDirection` · `justifyContent` · `alignItems` · `marginStart` · `paddingStart` ·
`borderStartWidth` · `start`/`end` · `left`/`right`

Tested in **Arabic**, confirming the behaviour is not Hebrew-specific.

**Screenshots:** `ar-current.png`, `ar-t1-base-2.png`, `ar-t1-base-3.png`

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

### Environment (Mac session)

- **Device:** iPhone 16 Pro Max (`iPhone17,2`), iOS **26.5.2**, physical hardware
- **Host:** macOS 25.4 (Darwin 25.4.0), **Xcode 26.2** (17C52), CocoaPods 1.17.0, Node 22.15.0
- **Build:** `npx expo prebuild --platform ios --clean` → `npx expo run:ios --device <udid>`
- **Metro:** port **8082** (8081 was occupied by an unrelated project)

### B1 — Build blocker: `expo-modules-jsi` fails to compile on Xcode 26.2

- **Result:** ❌ **blocker, patched locally**
- **Observed:** `npx expo run:ios` aborted with `xcodebuild` exit code **65**:

  ```
  node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift:53:50
  guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {
                                                 ^ type of expression is ambiguous without a type annotation
  ```

- **Cause:** the free function `abs(_:)` compared against a `@usableFromInline` global inside an
  `@usableFromInline` function. Swift 6.2 (Xcode 26.2) no longer resolves the overload here; older
  Swift versions did, which is why SDK 57 ships this untouched.
- **Fix:** replace the free `abs()` with the typed `.magnitude` property so the type is explicit —
  numerically identical for `Double`:

  ```swift
  let magnitude: Double = milliseconds.magnitude
  guard milliseconds.isFinite, magnitude <= maxJavaScriptDateMilliseconds else {
  ```

- **Caveat:** the edit lives in `node_modules/` and is **erased by any `npm install`**. It needs a
  `patch-package` entry (or an SDK bump) before this is reproducible on a clean checkout.
- **Implication:** not an RTL finding, but a **toolchain finding** worth carrying into the skill —
  Expo SDK 57 + Xcode 26.2 does not build out of the box. Any agent told to "just run `expo run:ios`"
  on this stack hits a Swift type-inference error with no obvious link to Expo.

### B2 — Screenshot capture on iOS 26 — solved, but only one tool works

- **Result:** ✅ **solved** (three of four approaches are dead ends)
- **Observed:** the Android half automated captures with `adb screencap` (see `scripts/capture-tab.py`).
  There is **no equivalent that works unprivileged on iOS 26**:
  - `idevicescreenshot` (libimobiledevice 1.4.0) → `Could not start screenshotr service: Invalid service`,
    even with Developer Mode enabled and a DDI already mounted (`ideviceimagemounter list` → `Status: Complete`).
    iOS 17+ moved developer services behind an RSD tunnel that the classic lockdown client cannot reach.
  - `xcrun devicectl` → **has no screenshot subcommand at all** (`copy`, `info`, `install`, `notification`,
    `orientation`, `process`, `reboot`, `sysdiagnose`, `uninstall`).
  - `pymobiledevice3 developer dvt screenshot` → by default demands a root `remote tunneld` daemon
    (`Unable to connect to Tunneld. You can start one using: sudo …`). **But the `--userspace` flag
    opens the tunnel without root**, which is the whole solution:

    ```bash
    python3 -m pymobiledevice3 developer dvt screenshot out.png --userspace
    ```

- **Tool shipped:** `scripts/ios-screenshot.sh <name>` → `screenshots/<name>.png`. No sudo, no daemon,
  runs unattended. Verified: 1320×2868 PNG off an iPhone 16 Pro Max.
- **Implication:** an `adb screencap`-shaped automation loop **does** port to iOS 26, but only through
  `pymobiledevice3 --userspace`. Every other documented route (libimobiledevice, devicectl, plain
  pymobiledevice3) fails, and the failure messages point at DDI mounting — a red herring, since the DDI
  was already mounted. Worth carrying into the skill verbatim: the fix is a flag, not a mount.
- **Not yet ported:** the Android `scripts/capture-tab.py` scroll-and-stitch flow. iOS has no
  `adb shell input swipe` equivalent here, so tall screens still need per-viewport captures.

### T25 — Blur (expo-blur) 🔀 **platform difference confirmed**

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · Expo SDK 57 · Fabric
- **App language:** he (header read `ios · he · isRTL=false`)
- **Result:** 🔀 **iOS disagrees with Android — all three variants blur**
- **Observed:** on the striped blue/yellow backdrop, at `intensity={50}`:

  | Variant | Android | **iOS** |
  | --- | --- | --- |
  | **A** — default, no `BlurTargetView` | tint only, stripes stay sharp | ✅ **real blur**, stripes smeared |
  | **B** — `blurMethod` set, no `BlurTargetView` | tint only | ✅ **real blur** |
  | **C** — `BlurView` as sibling of `BlurTargetView` (docs pattern) | ✅ the only one that blurs | ✅ real blur |

  In variant C the deliberately sharp control text *behind* the panel ("SHARP TEXT BEHIND — 12345")
  renders crisp above the blurred region, confirming the smearing is a genuine backdrop blur and not
  an opacity tint.
- **Screenshot:** `screenshots/t25-blur-ios.png` (compare `screenshots/t25-blur-sibling-final.png`)
- **Implication — and this is the important half:** the "four mandatory blur conditions" in
  `SUMMARY.md` are an **Android** requirement, but the correct rule is **not** "iOS is more relaxed,
  so relax the rule there". It is the opposite.

  **iOS is permissive; Android is strict. The permissive platform hides the bug.**

  A developer (or an LLM) writing variant **A** on iOS sees a perfect blur, ships it, and it is
  **broken on Android** — where it silently degrades to a flat tint with no warning, no error, and no
  crash. Testing on iOS alone cannot catch this. Variant **C** is the only one that works on **both**.

  So the rule is: **always write variant C**, unconditionally, with no `Platform.OS` branch. It is
  redundant on iOS and mandatory on Android; the redundancy costs nothing and is the entire reason it
  is safe. Only the strict platform can validate the pattern — a green result on the permissive one is
  not evidence.
- **Note:** the on-screen expectation text still reads "A and B only tint. Only C should smear the
  stripes" — that is the **Android** prediction, left in place deliberately. On iOS it is falsified,
  which is exactly the kind of result this harness is built to surface.

### T26 (unplanned) — vertical centering lost inside `BlurTargetView` 🔀

Spotted while reading the T25 screenshot: in block **C** the "SHARP TEXT BEHIND — 12345" control text
sits **pinned to the top** of the striped panel, while in blocks **A** and **B** the same text is
vertically centered. On Android it was centered in all three.

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · Fabric
- **Result:** 🔀 **platform difference — a real layout bug, not a rendering artifact**
- **Root cause (read from source, not guessed):** the centering never comes from the text. It comes
  from the parent's `justifyContent: 'center'`. In A/B the text is a direct child of `Backdrop`
  (`st.backdrop` → `justifyContent: 'center'`, [BlurScreen.tsx:217-223](src/screens/BlurScreen.tsx#L217-L223)).
  In C the text is **not** a child of `st.cWrap`; it is a child of `BlurTargetView`, which is styled
  `StyleSheet.absoluteFill` ([BlurScreen.tsx:95](src/screens/BlurScreen.tsx#L95)) and carries **no**
  `justifyContent`. So `cWrap`'s centering ([BlurScreen.tsx:250-256](src/screens/BlurScreen.tsx#L250-L256))
  applies to `BlurTargetView` as a whole — which already fills the box — and never reaches the text.
  `st.backdropText` sets only `textAlign: 'center'` (horizontal); it has nothing to do with the
  vertical axis ([BlurScreen.tsx:226-231](src/screens/BlurScreen.tsx#L226-L231)).
- **Why Android hid it:** on Android blocks A and B never blurred, so C was the only panel anyone
  compared against — with no correctly-centered sibling on screen, the misalignment had nothing to be
  measured against. iOS blurring **all three** put a correct and an incorrect panel side by side and
  made it obvious. A platform difference in one feature (blur) exposed a latent layout bug in another.
- **Fix:** give the absolutely-positioned wrapper its own centering, rather than relying on the
  grandparent — an `absoluteFill` layer is a new flex container and inherits **no** alignment:

  ```jsx
  <BlurTargetView ref={targetRef} style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
  ```

- **Implication for the skill — this generalizes well beyond blur:** inserting **any** wrapper between
  a centering parent and its text silently breaks vertical centering, because `justifyContent` is not
  inherited; it only ever affects direct children. `StyleSheet.absoluteFill` wrappers are the common
  offender since they *look* like transparent pass-throughs but are full flex containers. The failure
  is **silent** — no warning, no error, and it survives review because `textAlign: 'center'` is present
  and reads as "this text is centered", when it only governs the horizontal axis.
- **Status:** **not yet fixed in the repo.** Left in place so the bug is reproducible; the screenshot
  `screenshots/t25-blur-ios.png` is the evidence. Fixing it would also change what T25 renders, so it
  should be a deliberate, separately-recorded edit.

### T24 — red-box error on entering the tab (`VirtualizedLists ... nested`)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · Fabric
- **Result:** ⚠️ **expected failure firing loudly — not a regression**
- **Observed:** switching to the **T24 Kbd** tab immediately raises a red error banner, before any
  field is touched. Metro logs it as:

  ```
  ERROR  VirtualizedLists should never be nested inside plain ScrollViews with the same
  orientation because it can break windowing and other functionality - use another
  VirtualizedList-backed container instead.
  ```

- **Screenshot:** `screenshots/t24-error-ios.png`
- **Cause:** **case 7** of the matrix — a `FlatList` ([KeyboardMatrixScreen.tsx:180](src/screens/KeyboardMatrixScreen.tsx#L180))
  rendered inside the screen's own `KeyboardAwareScrollView` ([KeyboardMatrixScreen.tsx:92](src/screens/KeyboardMatrixScreen.tsx#L92)).
  Same orientation, so RN's nesting guard fires. The case is marked `danger` and captioned
  *"Virtualization + focus is its own failure mode"* — **the nesting is the test**, deliberately written
  to fail.
- **Why it matters anyway:** the Android pass recorded case 7 as a *keyboard* failure. The error fires
  at **mount**, for every visitor to the tab, regardless of the keyboard — so on iOS it also masks the
  screen behind a banner and obscures the later cases until dismissed. The Android run never reported
  the banner itself, so whether this is a platform difference or simply went unrecorded is **open**.
- **Action:** none for the harness — do not "fix" it (MAC_INSTRUCTIONS ground rule 2). But the banner
  must be dismissed before T24's remaining cases can be screenshotted.
- **Skill note:** the warning says `ScrollView`, while the actual parent here is
  `KeyboardAwareScrollView`. **Any** scroll container triggers it — the wording sends people hunting
  for a literal `<ScrollView>` that does not exist in the file.

### T24 case 10 — multiline `TextInput` scrolls to the CARET, not the whole field 🔀

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · `react-native-keyboard-controller` 1.21.9
- **Result:** 🔀 **platform difference — both "pass", but not equally**
- **Observed:** focusing the multiline field lifts the content just enough to clear the **first line
  and the caret**. The rest of the textarea stays **under the keyboard** — only one input row is
  visible above it. On **Android the whole textarea was lifted clear**.
- **Screenshot:** `screenshots/t24-textarea-keyboard-ios.png`
- **Assessment:** technically a pass by the matrix's own criterion (*"the visible area must follow the
  caret"* — it does, and typing stays visible). But the **usable** result differs: on iOS the user sees
  a one-line slit into a multi-line field; on Android they see the field.
- **Cause:** `KeyboardAwareScrollView` is configured with `bottomOffset={16}`
  ([KeyboardMatrixScreen.tsx:95](src/screens/KeyboardMatrixScreen.tsx#L95)). The offset is measured
  from the **caret position**, not the field's bottom edge. For a single-line input the two coincide,
  so the distinction never shows up — it only appears once the field is taller than one line. Android's
  IME-inset path lifted by the element instead, so the same config produced a different result.
- **Fix for product code:** for multiline fields set `bottomOffset` to roughly the field's height
  (or the height you want kept visible), rather than a small constant tuned on single-line inputs.
- **Implication — a third failure shape.** Not "works vs broken" like T25, and not "silent no-op" like
  T27 §4, but **works-differently**: both platforms satisfy the test, and a screenshot from either one
  alone looks correct. This is the kind that survives *both* code review and a single-platform QA pass,
  and only shows up as a user complaint.
- **Status:** the Android observation is carried from the earlier pass (recorded as "10-case matrix:
  6 fail, 4 pass, exactly as predicted"), where case 10 was a pass. The *degree* of lift was not
  recorded then — **re-measure case 10 on Android** before treating the difference as settled.

### T24 case 9 — bottom sheet: the WHOLE sheet rises on iOS 🔀

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · `@gorhom/bottom-sheet` 5.2.14
- **Result:** 🔀 **works-differently** (same shape as case 10)
- **Observed:** focusing `BottomSheetTextInput` lifts the **entire sheet** upward — the sheet's whole
  body, both fields and all its empty space travel above the keyboard, leaving a large blank gap
  between the fields and the keyboard. On **Android the keyboard rose slightly and the field sat just
  above it**, with the sheet itself largely in place.
- **Screenshot:** `screenshots/t24-sheet-keyboard-ios.png`
- **Assessment:** a pass on both — the field is visible and typable either way. But the *motion* is
  different: iOS translates the container, Android adjusts around the field.
- **Cause:** `keyboardBehavior="interactive"` ([KeyboardMatrixScreen.tsx:262](src/screens/KeyboardMatrixScreen.tsx#L262)).
  On iOS this maps to moving the sheet with the keyboard; the Android path resolves the inset
  differently. Both are "correct" implementations of the same prop.
- **Product implication:** a sheet sized by `snapPoints` (here `'55%'`) that is translated wholesale
  can push its own header off-screen, or — as here — open a dead gap. If the sheet's top content must
  stay visible while typing, `keyboardBehavior` has to be chosen per platform, or the sheet sized so
  the lift is harmless.
- **Also visible:** the plain `TextInput` and the `BottomSheetTextInput` both render; the matrix's
  point is that only the latter behaves under focus. Not yet exercised — **case 9's plain field still
  needs to be focused on iOS** to confirm it fails the way the caption predicts.
- **Status:** the Android side is carried from the earlier pass. **Re-measure case 9 on Android** to
  pin the difference precisely.

### ⭐ T2 — Double flip / Priority 1 (`isRTL`) — **RTL never applied at all on iOS**

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · Fabric · app language `he`
- **Result:** ❌ **the layout is LTR.** Not a double-flip result — a *no-flip* result
- **Screenshots:** `screenshots/t2-flip-ios-{1,2}.png`

**Observed** (app language Hebrew, header reads `isRTL = false`):

| Block | Expectation in RTL | Actual on iOS |
| --- | --- | --- |
| 1 · `justifyContent: 'flex-start'`, no `isRTL` | box at the **RIGHT** edge | ❌ box at the **LEFT** |
| 2 · the `isRTL` ternary ("double flip") | box on the LEFT — visibly wrong | box on the LEFT (for the *wrong reason* — see below) |
| 3 · plain `'row'` vs `'row-reverse'` ternary | the two rows must **differ** | ❌ **identical** — both read `1·2·3` left→right |
| 4 · arrow, `scaleX: isRTL ? -1 : 1` | second arrow mirrored | ❌ **both point right**, identical |

**Interpretation — this is NOT the Android finding repeated.**

On Android, `isRTL` read `false` **while Yoga mirrored the layout**: the flag lied, and the layout was
right. On iOS, `isRTL` reads `false` **and the layout is genuinely LTR**. The flag is *honest* here.
The failure has moved: the direction was never applied in the first place.

Consequence for **Q7** ("does `isRTL` lie on iOS too?"): **on this evidence, no** — flag and layout
agree. But the question cannot be closed yet, because the app never reached an RTL state; a flag that
correctly reports `false` about an LTR layout has not been tested against a mirrored one.

Every "wrong" block on this screen therefore renders wrong for a **reason the test did not intend**.
Blocks 2, 3 and 4 all depend on `isRTL` being `true` to demonstrate their failure; with `isRTL=false`
the ternaries take their LTR branch and the demo is inert. **Block 2 "landing on the left" is a false
pass** — it lands there because nothing flipped, not because it double-flipped.

**✅ Confirmed on device — T12 bootstrap diagnostics** (`screenshots/t12-lang-ios-{1,2}.png`):

```json
{ "storedLanguage": null,   "resolvedLanguage": "he",
  "isRTLBefore": false,     "shouldBeRTL": true,
  "flagFlipped": true,      "guardWasSet": true,
  "needsRestart": false }
```

This is the whole failure, stated by the app itself:

- `shouldBeRTL: true` + `flagFlipped: true` → **`forceRTL(true)` was called.** The language layer did
  its job.
- `isRTLBefore: false` → the process came up LTR **even though a previous launch had already forced
  the flag** (the guard proves a previous attempt happened). So `forceRTL` **did not survive the
  reload**.
- `guardWasSet: true` → the one-shot anti-loop guard was already set, so `needsRestart: false` —
  the retry was **suppressed by design**. The app settles in LTR permanently.
- `storedLanguage: null` is the sting: **no language was ever persisted**, yet the guard *was*. The
  guard outlived the thing it was guarding. The app is now in a state where it will never retry, and
  never had a stored preference to retry for.

So the failing step is precisely: **`I18nManager.forceRTL()` does not take effect across
`reloadAppAsync()` on iOS.** On Android the same code path applied the flip (T12 passed there) — this
is a **🔀 platform difference in the reload mechanism itself**, not in the language logic.

**Why the direction was not applied — mechanism (source reading, consistent with the above):**
`bootstrapLanguage()` ([src/i18n/index.ts:115-126](src/i18n/index.ts#L115-L126)) calls
`I18nManager.forceRTL(true)` and then requests **one** reload, protected by a persisted one-shot
guard. If that reload does not bring the process back with the flag applied, `guardWasSet` is already
`true`, the second attempt is suppressed by design (the anti-loop guard), and the app settles in LTR
permanently. On Android the flip survived the reload; on iOS — on this run — it evidently did not.

⚠️ **One confound remains: the dev-client launch path.** This session launches via an
`expo-development-client` deep link pointed at Metro. `reloadAppAsync()` in a dev build reloads the
**JS bundle** without restarting the native process — and on iOS `forceRTL` writes
`NSUserDefaults` (`AppleTextDirection` / `AppleTextDirectionRTL`), which UIKit reads when the window
is initialised. A JS-only reload plausibly never re-reads it. **This does not change the measured
result — it changes its scope:** proven for dev builds, unproven for production launches.

**✅ Guard eliminated as a cause — a full clean cycle was run.** The app was switched `he → en → he`
from T12, which persists the language and rewrites the guard. Metro logged both reloads. Result
(`screenshots/en-t12-lang-ios.png`, `screenshots/he-return-t12-ios.png`):

| | after `he → en` | after `en → he` |
| --- | --- | --- |
| `storedLanguage` | `"en"` ✅ persisted | `"he"` ✅ persisted |
| `shouldBeRTL` | `false` | **`true`** |
| `flagFlipped` | `false` (nothing to do) | **`true`** — `forceRTL(true)` called |
| `isRTLBefore` | `false` ✅ correct | **`false`** ❌ still LTR |
| "Last switch" | `directionChanged=true`, `strategy=expo-reloadAppAsync` | `directionChanged=true`, **`isRTL at switch=false → isRTL now=false`** |

The `he → en` leg **succeeded** — language persisted, direction already matched, no flip needed. The
`en → he` leg called `forceRTL(true)`, ran `reloadAppAsync()`, came back — and `isRTL` was **still
`false`**. T2 re-checked after the cycle: still LTR (`START` at the left, both `1·2·3` rows identical).

**So the one-shot guard was never the real cause.** With a persisted language and a freshly written
guard, the flip still does not survive the reload. The failing step is isolated beyond doubt:

> **`I18nManager.forceRTL()` does not take effect across `reloadAppAsync()` on iOS.**

**🌐 External research — this is a known, officially-fixed-yet-still-reported bug class:**

- **[facebook/react-native#48311](https://github.com/facebook/react-native/issues/48311)** — "[New Arch]
  RTL to LTR Layout Direction Change Requires App Termination" — **exactly our symptom**, closed as
  Fixed.
- **[facebook/react-native PR #49455](https://github.com/facebook/react-native/pull/49455)** — the fix:
  `RCTFabricSurface.mm` now calls `_updateLayoutContext` when the surface view is recreated, so a
  bundle reload honors a changed direction. Landed ~Feb 2025, backported to 0.76.
  **Our static check S2 found this code present in RN 0.86.2** (`_updateLayoutContext` count = 4) —
  yet the measured behaviour is the unfixed one. Community follow-ups (through mid-2025) likewise
  report the fix working inconsistently: `isRTL` not updating, apps reverting to the old direction
  without full termination.
- **[expo/expo#39752](https://github.com/expo/expo/issues/39752)** — open, SDK 54 / RN 0.81.4: dynamic
  RTL switching still does not apply without a restart; the accepted workaround is
  `Updates.reloadAsync()` from **expo-updates** (a full React-host relaunch), not the dev-client
  reload path.
- Community workarounds in circulation: **key-prop remount** of the root after `forceRTL`
  ([GeekyAnts](https://geekyants.com/blog/implementing-right-to-left-rtl-support-in-expo-without-restarting-the-app));
  **[expo-rtl](https://dev.to/ibrahimtarhini01/why-does-react-native-make-you-restart-the-app-just-to-switch-language-i-fixed-it-2pn2)** —
  a package that abandons the native flag entirely and propagates direction via React context,
  flipping styles in JS. The latter is philosophically identical to our R22 `direction`-from-state
  approach, implemented one layer higher.

**Synthesis:** the dev-client measurement is consistent with the fix's own mechanism — #49455 hooks
**surface recreation**, and the reload path this session exercises evidently reaches bootstrap before
the recreated surface picks up the new direction (or does not recreate the surface the way the fix
expects). It also explains the split in the wild: reports cluster around dev workflows and JS
reloads, while `Updates.reloadAsync()` (full host relaunch) and cold starts are reported working.
**T18 (release build, home-screen launch) remains the deciding test.**

**T18 setup (release run).** To make the release test a real first-launch test, the app was
**uninstalled** first — otherwise the stored language (`he`), the restart guard and the `liveDir`
toggle all survive and the run measures a warm start, not a cold one. `liveDir` defaults to `false`
on a fresh install, so the release build exercises the **classic `forceRTL` + reload path**, which is
exactly the mechanism under test.

**✅ T18 RESULT — measured. It is NOT a dev-client artifact.**

- **Build:** Release configuration, JS bundle embedded, **Metro killed** (`curl localhost:8082` → no
  response), app **uninstalled first** so this is a true first-launch-after-install
- **Screenshots:** `screenshots/t18-release-launch1.png`, `screenshots/t18-release-t2.png`
- **Observed:** header `ios · he · isRTL=false · dir=native`. T2 renders **fully LTR** — `START` at
  the left edge, both `1·2·3` rows identical, arrow unflipped. **Identical to the dev-client result.**

| Hypothesis | Verdict |
| --- | --- |
| Dev-client artifact (JS reload never recreates the surface) | ❌ **disproven** — release behaves the same |
| `forceRTL` + `reloadAppAsync()` is broken on iOS generally | ✅ **confirmed** |

**So the conventional pattern cannot be recommended on iOS at all** — not "works in production but
not in dev". RN#49455's fix is present in this build (static check S2 verified
`_updateLayoutContext`), and the flip still does not land. This matches the open
[expo#39752](https://github.com/expo/expo/issues/39752) rather than the closed RN issue.

**Caveat on scope:** what is disproven is `forceRTL` + **`reloadAppAsync()`** (the core `expo`
package). `Updates.reloadAsync()` from **expo-updates** performs a full React-host relaunch and is
reported working by the community; this project deliberately does not install expo-updates, so that
path remains **unmeasured here**. The distinction matters: the failing ingredient is plausibly the
*reload mechanism*, not `forceRTL` itself.

**This makes R22 the recommendation rather than an alternative.** `direction` from app state was
measured working in both builds, both directions, on both platforms — while the conventional path
now has zero working configurations on iOS in this harness.

**Two competing explanations, and they need different fixes:**

| | If it is the dev-client | If it is iOS itself |
| --- | --- | --- |
| Cause | JS reload does not restart the native window | `forceRTL` needs a full process restart on iOS, always |
| Fix | nothing — production is fine | `forceRTL` + reload is **not viable on iOS**; direction must come from elsewhere |
| Distinguished by | **T18: release build, launched from the home screen, no Metro** | same test |

**Next steps — top priority of the iOS session:**
1. ✅ ~~Read `bootstrapInfo`~~ — done, above. The guard suppressed the retry; `forceRTL` did not
   survive the reload.
2. **Clear the stuck state and force a fresh attempt:** switch `he → en` then `en → he` from T12.
   That rewrites the guard and re-runs the flip with `storedLanguage` actually set this time.
3. **T18 — release build from the home screen.** This is what separates the two explanations above,
   and it is the only way the result becomes a statement about iOS rather than about dev builds.
4. **T10 Dir — test the `direction` style prop on iOS.** If it works (it does on Android Fabric, R16),
   it is a **complete replacement** for the `forceRTL` + reload + guard machine: direction applied
   declaratively from app state, no restart, identical on both platforms. That would make this entire
   failure mode irrelevant rather than merely fixed.
5. Only then answer Q7. **T3 Text, T5 Input, T7 Num, T8 Logic and T1 Base are blocked** until the app
   can be brought into a genuinely RTL state — their results are meaningless in an LTR layout.

### T1 — Baseline logical properties (LTR half only)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · app language `he`, **layout LTR** (T2 blocker)
- **Result:** ⚪ **inconclusive by design** — the screen tests *mirroring*, and nothing was mirrored
- **Screenshot:** `screenshots/t1-base-ios-ltr-1.png`
- **Observed:** every logical property resolved to its **LTR** meaning, consistently:
  - `flexDirection: 'row'` → `1·2·3` left→right
  - `justifyContent: 'flex-start'` → left edge · `'flex-end'` → right edge
  - `alignItems: 'flex-start'` / `'flex-end'` → same on the cross axis
  - `marginStart: 40` → indents from the **left**
- **What this does and does not establish:** it confirms the logical properties are wired up and
  resolve correctly — but **in LTR that is the trivial case**, where `start` = `left`. The entire
  point of T1 is that these mirror *without* `isRTL`, and mirroring cannot be observed here.
  **This is a baseline for later comparison, not a T1 result.**
- **Lower sections** (`screenshots/t1-base-ios-ltr-2.png`) — all consistent with LTR:
  - `paddingStart: 40` → gap on the **left**
  - `borderStartWidth: 6` → thick border on the **left**
  - **T20** · `start: 0` → **left** edge · `end: 0` → **right** edge
  - `left: 0` → left edge
- **T20 / paper#3542** — the reported iOS-specific `start`/`end` absolute-positioning breakage
  **does not reproduce in LTR**: `start` and `end` resolved to opposite edges correctly. But LTR is
  the case where `start` ≡ `left`, so this is a **weak negative** — the bug, if real, would show up
  under RTL. Not yet settled.
- **Re-run required** once the app reaches RTL. Everything on this screen is a baseline, not a result.

### T5 / T5b / T6 / T6b / T6c — Inputs (LTR state — mostly inconclusive, one real result)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · app language `he`, **layout LTR** (T2 blocker)
- **Screenshots:** `screenshots/t5-input-ios-{1,2}.png`

**✅ T5b — the numeric-caret defect (RN #33483) does NOT reproduce on iOS.** Digits typed into an
RTL-aligned input (`textAlign: 'right'`, explicit) produced `12345` in the correct order with the
caret advancing normally. **On Android the caret sat at the end of the placeholder and then jumped to
the start on the first keystroke.** 🔀 — a genuine platform difference, and one of the few results on
this screen that the LTR state does not invalidate, because the field's alignment is set explicitly
rather than inherited from layout direction.

**⚪ Everything else on this screen is inconclusive — and two observations that look like iOS bugs are
not.** Both have the same cause: `isRTL === false`, so every `isRTL` ternary takes its **LTR branch**.

| Observation | Looks like | Actually |
| --- | --- | --- |
| **T6** — both phone fields render LTR, though on Android one was RTL | iOS broke the plain field | Field 1 sets **no** `textAlign` (`auto` → left in an LTR layout); field 2 sets `'left'` explicitly. In LTR the two **coincide**. On Android they differed because the layout was mirrored. [InputsScreen.tsx:93-100](src/screens/InputsScreen.tsx#L93-L100) |
| **T6c** — the `row-reverse` override did not reverse | iOS ignores `row-reverse` | The style is `flexDirection: isRTL ? 'row-reverse' : 'row'` ([InputsScreen.tsx:118](src/screens/InputsScreen.tsx#L118)). With `isRTL=false` it evaluates to plain `'row'` — **the reverse was never requested.** Same masking effect as T2 blocks 2–4 |

**✅ T6 static text — the `+` corruption reproduces on iOS, and LRM fixes it.** The last section is
plain `<Text>`, not an input, and it is **valid despite the LTR blocker**: the bidi context comes from
the Hebrew *inside the string*, not from the layout direction.

```
without LRM:  טלפון: 54-123-4567 972+     ← the "+" migrated to the END, groups reordered
with LRM:     טלפון: +972 54-123-4567     ← correct
```

Identical to the Android measurement (R14), including the fix. **This is data corruption, not
cosmetics** — and it happens in an LTR layout, so "we don't support RTL" is not protection. Any
Hebrew/Arabic string containing a phone number needs the LRM mark regardless of app direction.

**This is the T2 blocker propagating.** Neither is evidence about iOS; both are evidence that the app
is in LTR. `+972 54-123-4567` also did not reorder in either field — expected, since digit reordering
is an RTL-context effect. **The whole screen needs a re-run under RTL**, at which point T6's two
fields should diverge and T6c's reverse should engage.

**Method note worth keeping:** an `isRTL` ternary does not fail loudly when the flag is wrong — it
silently renders the *other* branch, which looks like a working layout. Three separate screens (T2,
T5, T25) produced "results" that were really just the LTR branch. When `isRTL` is untrustworthy,
**every** ternary keyed off it becomes an unreadable test.

### T14 — Shadows: the exact mirror image of Android (Q3)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · layout LTR
- **Result:** 🔀 **platform difference — each platform's dead property is the other's working one**
- **Screenshot:** `screenshots/t14-shadow-ios-1.png`

| Property | Android | **iOS** |
| --- | --- | --- |
| `shadowOffset` (+ `shadowColor`/`Opacity`/`Radius`) | ❌ inert, renders nothing | ✅ **renders** — visible offset shadow |
| `elevation: 6` | ✅ renders (symmetric material shadow) | ❌ **renders nothing** |
| `boxShadow: '10px 4px …'` | ✅ renders | ✅ **renders** |

**Q3 answered.** `boxShadow` is the **only** shadow property that renders on both platforms — it is
the cross-platform directional shadow, and research finding C11 ("shadowOffset is iOS-only, so
direction-correcting it is a no-op") is **outdated**: on RN 0.86.2 there is a portable alternative.

**Practical rule:** use `boxShadow` for anything directional. Reach for `shadowOffset` /`elevation`
only when a platform-specific look is wanted — and remember each is dead on the other platform, with
**no warning**. Another instance of the silent-no-op class.

⚠️ **The direction-correction halves are inconclusive.** Both "direction-corrected" rows render
identically to their uncorrected twins — but the correction is written as
`width: isRTL ? -dx : dx` ([ShadowsScreen.tsx:34](src/screens/ShadowsScreen.tsx#L34)), and with
`isRTL=false` it evaluates to the **same value**. Nothing was corrected. Whether a shadow offset
mirrors correctly under RTL is **untested**; re-run once the app reaches RTL.

### ⭐⭐ T10 — the `direction` style prop WORKS on iOS (Q2) — and it is the fix for the T2 blocker

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · **Fabric** · `isRTL = false`, page LTR
- **Result:** ✅ **works in both directions, with no reload and no `forceRTL`**
- **Screenshot:** `screenshots/t10-dir-ios-1.png`

| Block | Rendered |
| --- | --- |
| Page default (inherits app direction) | `1 2 3` left→right — LTR reference |
| `direction: 'ltr'` island | `1 2 3` left→right — matches reference (correct: page is already LTR) |
| **`direction: 'rtl'` island** | **`3 2 1`, hugging the RIGHT edge** ✅ |
| `row-reverse` workaround | `1 2 3` left→right |

**Why this matters more than the other results in this session.**

The `rtl` island produced a genuinely mirrored layout **inside a process where
`I18nManager.isRTL === false` and `forceRTL` never took effect**. So direction can be applied:

- without `forceRTL`,
- without `reloadAppAsync()`,
- without a process restart,
- without the one-shot guard,
- **and without `isRTL` being correct** — the flag that both platforms mishandle is not in the path
  at all.

That is precisely the machinery that failed in T2/T12. `direction` bypasses all of it.

**Q2 answered on both platforms:** works on Android Fabric (R16) *and* iOS Fabric. It is the one
direction primitive that has now been measured working on both.

**Proposed rule (needs the RTL re-run to confirm the inverse case):**

> Drive direction **declaratively from app state**, not from the global flag:
> ```jsx
> const dir = isRTLLanguage(lang) ? 'rtl' : 'ltr';
> <View style={{ direction: dir, flex: 1 }}>…</View>
> ```
> Applies instantly on language change, needs no restart, and behaves identically on both platforms.
> Keep `forceRTL` only for what genuinely requires the native flag (system UI, first-frame direction
> before JS runs).

**⚠️ The essential caveat, confirmed on screen: `isRTL` is NOT affected by `direction`.** The last
section reports *"Inside an ltr island, isRTL still reads: false"* — the flag stays at its app-level
value regardless of any island. Consequences:

- `direction` changes **layout**, not the flag. Anything keyed off `isRTL` — mirrored icons
  (`scaleX`), `textAlign` chosen by ternary, `row-reverse` overrides — **will not follow the island**
  and will point the wrong way inside it.
- This makes `direction` and `isRTL` **two independent sources of truth** that can silently disagree.
  It is another reason to derive everything from one place — the app language — rather than mixing
  the two.
- Inside an island, pair `direction` with **explicit** `textAlign` and explicit icon orientation.
  Do not rely on inheritance for anything that reads the flag.

⚠️ **Not yet verified:** whether a `direction: 'ltr'` island inside a genuinely **RTL** page pins its
content LTR. This run could only test the `rtl`-inside-LTR direction, since the app is stuck LTR. The
`ltr` island rendering identically to the reference is **not** evidence — the page was already LTR, so
that block is currently a tautology. The `row-reverse` workaround block is equally uninformative here
for the same reason. Re-run once the app reaches RTL.

### ⭐ T28 — `direction` from app state: works, but does NOT cross `ScrollView`

The R22 experiment, implemented and run: `DirectionProvider`
([src/lib/direction.tsx](src/lib/direction.tsx)) wraps the content island in a `flex:1` `View` with
`direction` derived from the app language, toggleable from T12.

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · language `he` · `isRTL=false` · toggle **ON**
- **Result:** ⚠️ **partial — the wrapper applies, but the flip does not reach the screens**
- **Screenshots:** `screenshots/t28-live-on.png` (toggle + header `dir=rtl (state)`),
  `screenshots/t28-rtl-t27.png`

**Observed:** the header correctly reports `dir=rtl (state)` and the toggle persists across reloads.
But **T27 renders identically to LTR** — section titles and unmarked text stay left-aligned, boxes
unmirrored. Nothing inside the island flipped.

**First diagnosis — WRONG, and disproven by T29.** The initial guess was that `direction` cannot
cross a `ScrollView` (every screen's root is one). **T29 tested that directly and it is false.**

### T29 — where must `direction` go? Five placements, one screen

Purpose-built to settle it: the same `1·2·3` probe rendered five times, identical except for where
`direction: 'rtl'` sits. Screenshot: `screenshots/t29-placement-1.png`.

| Row | Placement | Result |
| --- | --- | --- |
| **A** | on the screen's `ScrollView` (`style`) | ✅ `3 2 1` |
| **B** | on a plain `View` wrapping the row (T10 shape) | ✅ `3 2 1` |
| **C** | two plain `View`s up — inheritance | ✅ `3 2 1` |
| **D** | **across a nested `ScrollView`** — the "failure shape" | ✅ **`3 2 1`** |

**`direction` inherits normally, including through scroll containers.** The ScrollView hypothesis is
dead. Placement is not the variable.

### ⚠️ The first T29 run was a FALSE POSITIVE — and the second diagnosis was wrong too

The screen's own `ScrollView` carried `direction: 'rtl'`, so **every row inherited it** and all of
A–F read `3 2 1` regardless of their own placement. The comparison could not have failed. Removing
it turned the screen into a real test.

**Re-run with the screen itself direction-neutral** (`screenshots/t29-clean-1.png`):

| Row | Placement | Result |
| --- | --- | --- |
| E | inner `contentContainerStyle` | `3 2 1` |
| **F** | **no `direction` anywhere — baseline** | **`3 2 1`** ⚠️ |
| G | style mutated on an existing node | `3 2 1` |
| H | `key` remount | `3 2 1` |

**Row F is the answer.** A row with no `direction` on it or on any ancestor *within the screen* still
renders mirrored — so the RTL is arriving **from above**: from `DirectionProvider`, through
`SafeAreaView`, into the screen. **The provider works.** Rows G and H flipping identically also kills
the creation-vs-update theory: mutating `direction` on a live node **does** apply.

**Two wrong diagnoses, both caught by measurement:**

| # | Hypothesis | Killed by |
| --- | --- | --- |
| 1 | `direction` cannot cross a `ScrollView` | T29 row D — it crosses fine |
| 2 | `direction` only applies at node **creation**, not update | T29 rows G vs H — both flip |

The `key={dir}` remount added to `DirectionProvider` for hypothesis 2 is therefore **not required**.
It is harmless and left in place as belt-and-braces, but it is not what makes this work.

**So why did T27 stay LTR?** Not because the provider failed — T27's content is
**direction-insensitive**: full-width blocks, no `flexDirection: 'row'` to mirror, labels with no
`textAlign`. A screen can sit inside a correctly-RTL subtree and look unchanged. **Confirmed by the
T2 run below.**

### ⭐⭐ T2 under live direction — R22 proven end-to-end

`screenshots/t2-flip-livedir.png` · language `he` · **`isRTL = false`** · `dir=rtl (state)`

| Block | Rendered | Reading |
| --- | --- | --- |
| **1** · `flex-start`, **zero `isRTL`** | `START` at the **RIGHT** edge | ✅ **the layout is genuinely mirrored** |
| **3** · plain `'row'` | `3 2 1` — right-to-left from the start edge | ✅ mirrored |
| **2** · `isRTL ? 'flex-end' : 'flex-start'` | box on the **RIGHT**, caption says it should be LEFT | ❌ ternary took the LTR branch |
| **3** · `isRTL ? 'row-reverse' : 'row'` | identical to the plain row | ❌ ternary took the LTR branch |
| **4** · `scaleX: isRTL ? -1 : 1` | arrow still points **right** in an RTL UI | ❌ ternary took the LTR branch |

**This is the whole thesis of the repo in one screenshot.**

1. **Layout written with logical properties and no `isRTL` mirrors correctly** — driven entirely by
   `direction` from app state, with the native flag still reading `false`. R22 works.
2. **Every construct keyed off `isRTL` is wrong** — and wrong *while the layout around it is right*.
   Block 2's box lands on the right because `flex-start` resolved against a mirrored container; the
   ternary that was supposed to "handle RTL" contributed nothing.
3. **`direction` fixes layout, not the flag.** Blocks 2–4 failing is not a defect in the approach —
   it is the measured justification for `useDirection()`: icons, `textAlign` and index math must be
   derived from the **language**, because `isRTL` will not follow the island.

**R22 is now verified end-to-end on iOS:** language → `direction` → mirrored layout, with no
`forceRTL`, no reload, no restart, and no dependence on `I18nManager`.

**Method lesson worth keeping:** a test whose control condition also passes is not a test. Row F
existed only as a baseline and turned out to be the single most informative row on the screen —
because it was the one that could distinguish "my wrapper works" from "something else is doing it".

### ✅ Final G/H run — both questions settled

The first G/H button toggled between `'rtl'` and **`undefined`**. `undefined` means *inherit*, and
the screen already sits inside an RTL provider — so both states rendered mirrored and the button
looked broken **while working correctly** (`screenshots/t29-gh-decisive.png` — both rows `3 2 1`
regardless of the button). A second false negative from the same root cause as the row-F false
positive: an ambient RTL the test failed to account for. Changed to toggle between explicit `'rtl'`
and explicit `'ltr'`.

**Result** (`screenshots/t29-toggle-works.png`, button reading `direction = 'ltr'`):

| Row | Rendered | Meaning |
| --- | --- | --- |
| E, F (ambient, provider-driven) | `3 2 1` | the surrounding page is RTL |
| **G** — style mutated on a live node | **`1 2 3`** | ✅ tracks the toggle |
| **H** — `key` remount | **`1 2 3`** | ✅ tracks the toggle |

**Two conclusions, both measured:**

1. **Mutating `direction` on an existing node works.** G tracks the button with no remount. The
   creation-vs-update hypothesis is dead for good, and the `key={dir}` in `DirectionProvider` is
   confirmed unnecessary (kept as harmless belt-and-braces).
2. **⭐ A `direction: 'ltr'` island inside a genuinely RTL page pins its content LTR.** This is the
   case T10 explicitly could not test (the app never reached RTL then) and it now passes: G and H
   read `1 2 3` while their surroundings read `3 2 1`. **R22's open caveat is closed** — `direction`
   is verified in *both* directions on iOS, matching Android.

### ~~The actual cause: `direction` does not apply to an EXISTING node~~ (disproven, see above)

The difference between T29 (works) and T28 (does not) is not *where* the style sits but *when*:

- **T29** uses a module-level constant — every node carries `direction` **from creation**.
- **T28** used `direction: enabled ? dir : undefined` — an inline style that **mutates on an
  already-mounted node** when the toggle flips.

So on Fabric, `direction` is honoured when a node is **created** with it, and ignored when it is
**updated** onto a node that already exists. That is the same shape as the `forceRTL` failure
(T12/RN#49455: the fix hooks *surface recreation*) — one mechanism, two symptoms.

**Fix applied** ([src/lib/direction.tsx](src/lib/direction.tsx)): give the wrapper a `key` that
changes with the direction, forcing React to mount a **fresh** host node instead of mutating the old
one.

```jsx
const key = enabled ? dir : 'native';
<View key={key} style={{ flex: 1, direction: enabled ? dir : undefined }}>
```

This is the same trick the community reaches for after `forceRTL` (the "key-prop remount"), but
applied to `direction` — and here it is cheap, because remounting one wrapper is not an app restart.

**Consequence for R22 — the rule needs a lifecycle clause, not a placement clause:**

> `direction` is applied at node **creation**. When it is derived from state that can change at
> runtime, the carrying node must be **remounted** (`key={dir}`), not merely re-styled.

⚠️ **Verification pending:** the `key` fix is written and typechecks, but the toggle has not yet been
flipped on-device *after* the change. Until a screen that previously stayed LTR is observed
flipping, the fix is reasoned-from-evidence, **not measured**.

### T8 / T9 / T20 — Logical properties

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · layout LTR
- **Screenshots:** `screenshots/t8-logic-ios-{1,2}.png`

**✅ T8c — `borderInlineStartWidth` does not exist on iOS either.** Direction-independent, so the LTR
state does not weaken it:

| Style | Result |
| --- | --- |
| `borderInlineStartWidth: 8` | ❌ **no border at all** |
| `borderStartWidth: 8` | ✅ border renders |

Confirms R15 cross-platform. **No error, no warning, no border** — the property is accepted by the
type system and silently discarded. Same silent-no-op class as `verticalAlign` (T27 §4) and
`writingDirection` on Android.

**✅ T9 — the precedence trap is confirmed on iOS.** Also direction-independent — what is tested is
which property *wins*, not which edge it resolves to:

| Style pair | Winner |
| --- | --- |
| `start: 0` + `left: 120` | **`start`** — box hugs the edge, the 120px override is dead code |
| `end: 0` + `right: 120` | **`end`** — same |

The `left`/`right` override is **silently ignored**. Someone adding `left: 120` to nudge a box gets no
effect and no diagnostic, because a logical property elsewhere in the same style outranks it.

**⚪ T8a / T8b / T20 — LTR branch only.** `marginInlineStart` / `paddingInlineStart` indent from the
left and `marginBlockStart` puts its gap on top (correct — the `*Block*` family is vertical and must
never flip). `gap` renders `A B C` evenly. **T20** (`start: 10` vs `left: 10`, paper#3542) placed both
boxes at the left edge — correct for LTR, but this is exactly the case where `start` ≡ `left`, so the
reported iOS-specific breakage **remains untested**. Re-run under RTL.

### T7 — Signed numbers inside RTL text: **reproduces on iOS** (Q4)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · layout LTR — **and the test is still valid**, because
  the bidi context comes from the Arabic *within the string*, not from layout direction
- **Result:** ✅ **Android's conclusion confirmed on iOS** — and the research claim that iOS is
  unaffected is **disproven**
- **Screenshots:** `screenshots/t7-num-ios-{1,2}.png`

**Latin-labelled lines — all safe.** Every `raw` / `LRM` / `isolate` triple rendered **identically**:
`-123.456`, `+42`, `12 - 13 = 25`, `-5°C`, `-99.90 ₪`, `-12.5%`, `10-20`. RN issue **#54713 did not
reproduce** in this form.

**Inside Arabic text — the sign detaches:**

| | Rendered |
| --- | --- |
| `raw` | `القيمة: 123.456-` ← **minus moved to the END** |
| `LRM` | `القيمة: -123.456` ✅ |
| `isolate` | `القيمة: -123.456` ✅ |

**All five value types corrupt in `raw`** (`screenshots/t7-num-ios-3.png`):

| Type | `raw` | `LRM` | `isolate` |
| --- | --- | --- | --- |
| negative | `123.456-` ❌ | `-123.456` ✅ | `-123.456` ✅ |
| positive | `42+` ❌ | `+42` ✅ | `+42` ✅ |
| temperature | `C°5-` ❌ | `-5°C` ✅ | `-5°C` ✅ |
| **price** | `99.90- ₪` ❌ | `₪ -99.90` ⚠️ **sign fixed, currency displaced** | `-99.90 ₪` ✅ |
| math | `25 = 13 - 12` ❌ **reads backwards** | `12 - 13 = 25` ✅ | `12 - 13 = 25` ✅ |

**⭐ Two refinements the Android pass did not surface:**

1. **LRM is not always sufficient — isolate is.** For `price`, LRM repaired the minus sign but pushed
   the `₪` symbol to the **wrong side** of the number. Only the isolate wrapper produced a fully
   correct result. **Rule: when a value carries its own non-digit symbol (currency, unit), use an
   isolate, not a bare LRM mark.** A bare LRM fixes the visible half of the bug and leaves the rest.
2. **The math expression reverses meaning, not just appearance.** `12 - 13 = 25` renders as
   `25 = 13 - 12`. This is not cosmetic misalignment — the statement reads as a different equation.
   The strongest available argument that this is data corruption.

**Intl formatting needs the same treatment.** `Intl.NumberFormat` output is not self-protecting:
`he-IL currency: -99.90 ₪` and `en-US currency: -$99.90` are correct only because a Latin label
leads the line. Formatting a value with `Intl` does **not** make it safe to interpolate into RTL text.

**The finding — the trigger is the CONTEXT, not the value.** The identical value `-123.456` is safe on
a line beginning `raw:` and corrupted on a line beginning `القيمة:`. The upper sections are safe only
because a Latin label opens each line and sets the paragraph direction. The **"in sentence"** row makes
this sharpest: it contains Hebrew, but the Latin `raw:` label leads, and the sign survives.

**Implications:**
- **Q4 answered.** Signed-number reordering is real on both platforms; research saying iOS is
  unaffected is wrong on RN 0.86.2 / iOS 26.
- **Isolating the whole line does not help — isolate the VALUE.** Confirmed on iOS, matching Android.
- **This is direction-independent.** It occurs in an **LTR** app. Any Arabic/Hebrew string
  interpolating a signed number, price, temperature or percentage needs the value wrapped, whether or
  not the app supports RTL. Same class as the T6 phone `+` corruption.
- **A latin-prefixed test is not a test.** Debug labels like `value:` silently neutralise the bug —
  a QA harness that prints values with Latin labels will never see it.

### T3 / T4 — Text alignment follows LAYOUT DIRECTION on iOS too (Q5)

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · app language `he`, **layout LTR** (see T2 blocker)
- **Result:** ✅ **the 2016 RN blog claim is disproven on iOS as well**
- **Screenshot:** `screenshots/t3-text-ios-ltr-1.png`

**The claim under test:** *"In iOS, the default text alignment depends on the active language
bundle. In Android it depends on the language of the text content."* The Android half was already
disproven; this is the iOS half.

**Observed** — with no `textAlign` anywhere, in an LTR layout:

| Probe (T4, all Hebrew unless noted) | Alignment |
| --- | --- |
| plain Hebrew `שלום עולם` | **left** |
| digit-leading `123 שלום עולם` | **left** |
| latin-leading `iPhone שלום עולם` | **left** |
| emoji-leading `🚀 שלום עולם` | **left** |
| plus-leading `+972 שלום עולם` | **left** |
| quote-leading `"שלום עולם"` | **left** |
| plain English | **left** |

**All seven identical.** Pure Hebrew left-aligns in an LTR layout, exactly as pure English does.

**Conclusions:**
- **No content heuristic exists on iOS.** Seven first-strong probes, deliberately varied at the
  leading character, produced zero variation. Same as Android.
- **Alignment follows layout direction, not content and not the bundle.** The app's language is `he`
  and the app is Hebrew throughout — yet the text left-aligns, because the *layout* is LTR.
- **Q5 answered — negatively.** The claimed iOS/Android split does not exist on RN 0.86.2. Both
  platforms key off layout direction.

**✅ Bundle half now settled too — `he` vs `en` compared directly.** The app was switched to English
(header `ios · en · isRTL=false`) and T3 re-captured (`screenshots/en-t3-text-ios.png`).
**Every section renders identically to the Hebrew build**: the T4 probes, the explicit-`textAlign`
pair, T17, and the mixed-content pair. Unmarked Hebrew left-aligns in an `en` bundle exactly as it did
in a `he` bundle.

**So the active bundle has no effect on default text alignment on iOS.** Both halves of the 2016 blog
claim are now disproven on both platforms:

| Claim | Verdict |
| --- | --- |
| iOS aligns by the active **language bundle** | ❌ `he` and `en` bundles produced identical output |
| Android aligns by the **content language** | ❌ disproven in the Android pass |
| *(what actually happens)* | **Both platforms align by layout direction** |

⚠️ **Remaining scope limit:** both bundles were measured in an **LTR layout** (T2 blocker). The
mirror case — whether an RTL layout right-aligns unmarked English — is still unmeasured. But the
bundle variable itself is now controlled: changing it changed nothing.

**Bonus control (`screenshots/en-t27-control.png`):** T27 §5/§6 also render identically in `en`,
including the right-aligned inputs. Those fields align from the **Hebrew leading the string**
(`שלום World 123`), not from app language — an independent confirmation of the same conclusion.

**Explicit `textAlign` still overrides everything** — the `'right'`/`'left'` pair rendered on the
correct sides regardless. It remains the portable tool for always-LTR data.

### T17 — `writingDirection` WORKS on iOS 🔀 (and RN #51235 does not reproduce)

- **Platform:** iOS 26.5.2 · Fabric · New Architecture
- **Result:** 🔀 **platform difference — and a disproven research claim**
- **Screenshot:** `screenshots/t3-text-ios-ltr-2.png`
- **Observed:** two identical Hebrew strings, **no `textAlign` on either**:
  - `writingDirection: 'rtl'` → aligned **RIGHT**
  - `writingDirection: 'ltr'` → aligned **LEFT**

  The two rows **visibly differ**.

- **Two claims fall at once:**
  1. **Android measured it as a no-op** — `'rtl'` and `'ltr'` rendered identically there (R13). On
     iOS it demonstrably controls alignment. 🔀
  2. **Research claim (RN #51235) said it regressed to a no-op on iOS Fabric.** It did not — this is
     a New Architecture build and the prop works.

- **Implication — do not "fix" R13, scope it.** The existing rule ("never offer `writingDirection`
  as an alternative to `textAlign`") stays **correct as advice**, but its stated reason was wrong.
  The accurate statement: `writingDirection` **works on iOS and is inert on Android** — which makes
  it *worse* than a pure no-op, because it is exactly the R20 asymmetry trap. Code written and
  verified on iOS looks correct, then silently loses its alignment on Android. `textAlign` remains
  the only portable answer.

- **Mixed-content warning confirmed:** the `רחוב Dizengoff 42, תל אביב` pair shows the forced-`rtl`
  row reordering segments — the street number moves relative to the name. Pinning a direction on
  mixed script scrambles it, as the section predicts.

### T21 / T22 / T23 — Safe area, gesture bar, keyboard

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · `react-native-safe-area-context` 5.7.0
- **Result:** ✅ **all three pass** — no platform difference found
- **Screenshots:** `screenshots/t21-safearea-ios-{1,2,3}.png`

**Live inset values, iOS vs Android:**

| | Android (Galaxy S21 Ultra) | **iOS (iPhone 16 Pro Max)** |
| --- | --- | --- |
| `top` | 27.38 | **62** (Dynamic Island) |
| `bottom` | 48 | **34** |
| `left` / `right` | 0 / 0 | 0 / 0 (portrait) |
| screen | — | 440×956 dp |
| `StatusBar.currentHeight` | 27.38 | **`n/a`** — Android-only API |

**Observed:**
- **T21 top edge** — header fully visible, nothing under the Dynamic Island.
- **T22 bottom edge** — the bottom inset (34) is applied **once**, by the ScrollView. The final
  "LAST ELEMENT — must be fully visible" button clears the home indicator with a clean gap.
  **The double-inset bug found and fixed during the Android pass did not reappear on iOS** — the fix
  is direction- and platform-neutral, as intended.
- **T23 keyboard** — the field stays visible when focused.

**Notes for the guide:**
- The top inset is **more than 2× larger** on this device (62 vs 27.38). Any layout that hardcodes a
  status-bar height calibrated on Android will be visibly wrong on a Dynamic Island iPhone. This is an
  argument for insets over constants that the Android-only pass could not make on its own.
- `StatusBar.currentHeight` is `undefined` on iOS — the screen prints `n/a`. Code that reads it
  without a fallback silently computes `NaN` padding.
- **Still unmeasured: `insets.left` / `insets.right` in landscape.** Both read 0 in portrait on both
  platforms, so the on-screen "RTL trap: insets.left/right are PHYSICAL" demo — the one place
  `isRTL` is genuinely required — **has not actually been exercised.** `MAC_INSTRUCTIONS.md` calls
  for landscape specifically. The two rows currently render identically because both insets are 0;
  that is not evidence the mapping is correct.

### T27 (new screen) — Line height & vertical centering

Built during the iOS session in response to T26: text clipping and lost vertical centring inside
**buttons and inputs** is the most frequently reported iOS text problem, and none of the existing
screens isolated it. Source: [LineHeightScreen.tsx](src/screens/LineHeightScreen.tsx).

- **Platform:** iOS 26.5.2 / iPhone 16 Pro Max · RN 0.86.2 · Fabric · app language `he`
- **Screenshots:** `screenshots/t27-lineheight-ios-{1,2,3,4}.png`
- **Android column: NOT YET MEASURED.** Everything below is the iOS half only. The Android pass has
  to be re-run against this screen before any of it is called a platform difference — except §4,
  where the docs already state the platform scope.

| § | Test | iOS result |
| --- | --- | --- |
| 1 | `justifyContent` through an `absoluteFill` wrapper | ❌ **B pinned to top.** T26 reproduced in isolation. A and C (wrapper given its own `justifyContent`) both centre correctly |
| 2 | `lineHeight` vs `fontSize`, clipping | ❌ **`lineHeight: 12` with `fontSize: 16` clips.** The acute on `Á` and the tops of the Hebrew are cut. `lineHeight: 16` (equal) also clips the accent. `28` is clean |
| 3 | Centring inside a fixed 48px box | ✅ **All three centre.** `lineHeight: 48` alone (B) matches flex centring (A); combining both (C) does **not** double-correct |
| 4 | `verticalAlign: top / middle / bottom` | ⚠️ **Silent no-op.** All three render identically, text at the top. Matches the docs' `Android` tag — but the style is accepted without warning |
| 5 | `TextInput` vertical alignment | ✅ A, B, C identical and vertically centred. `paddingVertical: 0` and `lineHeight: 20` change **nothing**. ⚠️ **But D — the placeholder — sits visibly higher than real text in the same box** |
| 6 | `numberOfLines={2}` + tight `lineHeight` | ⚠️ **`lineHeight: 14` overlaps lines** (rows collide vertically) |
| 6b | **ellipsis side under RTL** (added later, narrow box) | ✅ **correct — the `…` follows the text direction** |
| 7 | `Pressable` with flex centring | ✅ All three correct, including the mixed `Save · שמור · 123` |

**What this establishes**

1. **`lineHeight` ≤ `fontSize` clips on iOS.** Not "tight but fine" — glyph tops are destroyed. Since
   Hebrew glyphs are taller than Latin at the same `fontSize`, a `lineHeight` validated against English
   can clip once the string is translated. This is a concrete RTL/i18n trap, not a generic styling nit.
2. **`verticalAlign` / `textAlignVertical` are Android-only and fail silently on iOS.** The style is
   accepted, so it survives code review while doing nothing. This is the same silent-no-op failure
   class already recorded for `borderInlineStartWidth` and `writingDirection`.
3. **`lineHeight = boxHeight` is safe here but redundant.** It centred exactly, and stacking it with
   flex centring did not double-correct — but §2 shows the same property clipping when set too small,
   so flex centring remains the option with no failure mode.
4. **The `paddingVertical: 0` folk fix does nothing** on a fixed-height single-line `TextInput` on iOS —
   the field was already centred. Reaching for it means the real bug is elsewhere.
5. **Placeholder and value do not share a baseline** (§5 D). A field that looks correct while empty can
   shift its text on focus.

**⚠️ Read §3 and §5 through the asymmetry rule.** Three centring methods "worked" in §3 and three
input treatments "worked" in §5 — and that breadth is a **warning, not a reassurance**. It is the same
shape as T25, where iOS accepted all three blur variants and Android accepted one. A method that
passes here has been validated on the *permissive* platform only; §4 already proves this screen
contains at least one style that iOS accepts and does nothing with. Until the Android column is
filled, **§3 B/C and §5 B/C must be treated as unverified**, not as working alternatives.

**The rule worth promoting:** centre with `justifyContent` on the **direct** parent. It is the only
method here that worked with no caveat — on a `View` and a `Pressable`, for Hebrew, Latin and mixed
content — and the only one that relies on plain flexbox rather than a text-metric side effect.
`verticalAlign` is Android-only, `lineHeight` is a clipping risk (§2), and `paddingVertical: 0` is a
no-op. Pick the method with **no failure mode on either platform**, not the one that happens to render
correctly on the device in front of you.

### ✅ T27 §6b — ellipsis side under RTL: **correct on iOS**

The first §6 attempt failed as a test: both strings fitted, so `numberOfLines` never truncated and no
ellipsis rendered. Re-run with `numberOfLines={1}` in a deliberately narrow (180dp) box, one row per
script. Screenshot: `screenshots/t27-ellipsis-ios.png`.

| Row | Rendered | Ellipsis |
| --- | --- | --- |
| Hebrew | `שלום עולם שלום עולם שלו…` — text hugs the **right** | **LEFT** ✅ |
| English (control) | `Truncate me please, this…` — text hugs the **left** | **RIGHT** ✅ |
| Mixed script | `W… שלום World 123 שלום` | at the reading end of the run ✅ |
| Hebrew, `numberOfLines={2}` | wraps, truncates on line 2 | LEFT ✅ |

**The `…` follows the direction of the text, not a fixed physical side.** Truncation removes the
*end* of the string in its own reading order, which is the correct behaviour and needs no
intervention — no `textAlign`, no `isRTL`, no per-language special case.

Notably this worked **while the layout was LTR and `isRTL=false`** — the ellipsis is placed from the
paragraph direction of the string itself (same mechanism as T3/T4 alignment and the T7 bidi
reordering), not from the app's direction flag.

**Follow-ups this screen did not settle**
- Re-run all seven sections on Android to fill the comparison column.
- §2 needs the clipping threshold pinned per script — the exact `lineHeight`/`fontSize` ratio at which
  Hebrew starts clipping is not yet measured.

---

## Cross-platform differences (🔀)

> The most valuable section. Any test where iOS and Android disagree goes here.

| # | Area | Android | iOS | Consequence for the guide |
| --- | --- | --- | --- | --- |
| **T12** ⭐ | `forceRTL()` + `reloadAppAsync()` | Flip **applied** after the reload — layout became RTL (this is what disproved guide claim C1) | ❌ **Flip does not survive the reload.** `flagFlipped: true`, yet the process returns `isRTLBefore: false`; the one-shot guard then suppresses the retry and the app stays LTR forever | The `forceRTL` + reload + guard pattern is **not portable**. Scoped to dev builds so far — T18 (release, home-screen launch) decides whether it is an iOS trait or a dev-client artifact. |
| **T2** ⭐ | `I18nManager.isRTL` truthfulness | Reads `false` **while the layout is mirrored** — the flag lies | Reads `false` **and the layout really is LTR** — the flag is honest | The Android bug looks **Android-specific**. But Q7 is not closed: iOS never reached an RTL state, so the flag was never tested against a mirrored layout. |
| **T17** | `writingDirection` | **No-op** — `'rtl'` and `'ltr'` render identically | **Works** — `'rtl'` aligns right, `'ltr'` left | Worse than a plain no-op: it is the R20 trap. Verified on iOS it looks correct, then silently loses alignment on Android. `textAlign` stays the only portable tool. Also disproves RN #51235 (claimed iOS-Fabric no-op). |
| **T10** ⭐ | `direction` style prop | ✅ works (R16) | ✅ **works** — an `rtl` island rendered `3 2 1` right-aligned inside an LTR page, with `isRTL=false` and no reload | The **one** direction primitive measured working on both. Bypasses `forceRTL`/reload/guard entirely. Caveat: `isRTL` does **not** follow it — pair with explicit `textAlign` and icon orientation. |
| **T14** | Shadows | `shadowOffset` **inert**, `elevation` renders | `shadowOffset` **renders**, `elevation` **inert** | Exact mirror image. `boxShadow` renders on **both** — the only portable directional shadow. Research C11 outdated. |
| **T7** | Signed numbers in RTL text | Corrupts (sign detaches) | **Corrupts identically** — research claiming iOS is unaffected is wrong | Not a difference — a cross-platform bug. Isolate the **value**; a bare LRM is insufficient when the value carries a currency/unit symbol. |
| **T5b** | Numeric caret (RN #33483) | Caret jumped to start on first keystroke | ✅ **does not reproduce** | Android-specific. |
| **T25** | `expo-blur` | Blur needs **all four** conditions (`blurMethod`, `BlurTargetView`, `blurTarget` ref, sibling placement). Miss one → silent tint. | A bare `<BlurView intensity={50} />` **already blurs**. All three variants worked. | The four-condition rule is **Android-only**. Write it anyway (harmless on iOS), but do not describe it as universally required. |
| **T26** | Vertical centering through an `absoluteFill` wrapper | Centered (masked — A/B did not blur, so C had no correct sibling to be compared against) | Text pinned to **top**; `justifyContent` on the grandparent never reaches it | `justifyContent` affects **direct children only**. Any inserted wrapper silently breaks centering; `textAlign: 'center'` does not compensate (horizontal axis only). |
| **T27 §4** | `verticalAlign` / `textAlignVertical` | Works (documented Android prop) | **Silent no-op** — `top`/`middle`/`bottom` render identically | Android-only. Never use for cross-platform vertical centring; it is accepted without warning on iOS and does nothing. |
| **T24 §10** | Keyboard lift for a **multiline** `TextInput` | Whole textarea lifted clear of the keyboard | Lifts to the **caret** only — one visible row, rest of the field stays covered | `bottomOffset` is measured from the caret, not the field. Size it to the field's height for multiline; a constant tuned on single-line inputs is not portable. |
| **T24 §9** | Bottom sheet with `keyboardBehavior="interactive"` | Keyboard rose slightly; field settled just above it, sheet mostly in place | **The whole sheet translates upward**, opening a large gap between fields and keyboard | Same prop, two different motions. A sheet whose header must stay visible needs `keyboardBehavior` chosen per platform, or sizing that tolerates the lift. |

**Three distinct failure shapes have now appeared** — worth separating, because they need different
defences:

| Shape | Example | Why it survives review |
| --- | --- | --- |
| **Works vs broken** | T25 blur — iOS blurs, Android tints | Only the strict platform can falsify it |
| **Silent no-op** | T27 §4 `verticalAlign` on iOS | The style is accepted; nothing warns |
| **Works differently** | T24 §10 multiline lift | **Both platforms pass.** A screenshot from either looks correct on its own |

The third is the hardest: it defeats a single-platform QA pass *and* code review, and only surfaces
as a user complaint. Detecting it requires the same interaction compared side by side across
platforms — which is exactly what this harness is for.

### 🔒 The asymmetry rule — how to read every row in this table

The two platforms are **not** symmetric, and this changes how the whole comparison must be used:

> **Android is the strict platform. iOS is the permissive one. A pattern that works on iOS proves
> nothing; a pattern that works on Android is usually safe on both.**

T25 is the clean demonstration: three blur variants, **all three** work on iOS, **only one** works on
Android. Write the iOS-passing variant and the app is broken on Android — silently, with no crash and
no warning, which is precisely why it survives to production.

**Consequences for the skill:**

1. **Always write the intersection**, never the per-platform minimum. Variant C is redundant on iOS
   and required on Android — write it unconditionally.
2. **Do not branch on `Platform.OS`** to "optimise away" the stricter pattern. The branch adds a code
   path that only one platform ever exercises, and the redundancy it removes was free.
3. **Verification must happen on Android.** An iOS-only pass is not evidence. The reverse is not
   symmetric: iOS still has failures Android does not (T26's centring, T27 §2's clipping), so both
   platforms are required for full coverage — but a **green iOS result alone is worthless**.
4. **Beware the reverse trap too.** iOS is not uniformly permissive — §2 clipping and §5's placeholder
   offset are iOS-specific. "Permissive" describes *which platform silently accepts a wrong pattern*,
   not which one has fewer bugs.

### ⚠️ Priority 1 — partial answer, and a blocker

**T2 Flip settled the first half:** with the app language `he`, iOS reports `isRTL = false` **and the
layout is genuinely LTR** — `flex-start` sits left, `row` and `row-reverse` render identically, the
`scaleX` arrow does not mirror. Flag and layout **agree**.

That is the **opposite** of Android, where `isRTL=false` accompanied a fully mirrored layout. So on
current evidence the Android bug (a flag that lies) is **Android-specific** — but Q7 is **not closed**,
because the iOS app never entered an RTL state. An honest `false` about an LTR layout proves nothing
about what the flag would report about a mirrored one.

**This blocks most of the remaining session.** T3 Text, T5 Input, T7 Num, T8 Logic and T1 Base all
measure RTL behaviour; in an LTR layout their results are meaningless. **Getting the app into a real
RTL state is now the top priority** — see the T2 entry for the four next steps.

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
