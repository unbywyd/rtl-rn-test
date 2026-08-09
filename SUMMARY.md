# Android Results — What Works and What Doesn't

Everything below was measured on real hardware. Nothing is quoted from documentation unless
the measurement disagreed with it, in which case both are stated.

**Environment:** Expo SDK 57 · RN 0.86.2 · New Architecture (Fabric) · TypeScript
**Devices:** Samsung Galaxy S21 Ultra (Android 15, arm64, locale `ru-RU`) — primary ·
Pixel 6 Pro emulator (API 34, locales `en-US` and `he-IL`) — cross-check
**Languages exercised:** `he`, `ar`, `en`

Status: **Android complete.** iOS not started — see `MAC_INSTRUCTIONS.md`.

---

## ✅ Works — verified on device

| Area | Verified behaviour |
| --- | --- |
| **RTL layout mirroring** | `flexDirection: 'row'`, `justifyContent`, `alignItems` all mirror automatically with **zero `isRTL` in the code** |
| **Logical spacing** | `marginStart` · `paddingStart` · `borderStartWidth` · `start`/`end` mirror correctly |
| **`*Inline*` family** | `marginInlineStart` · `paddingInlineStart` work, confirmed in both directions |
| **`left`/`right` auto-swap** | `left: 0` renders at the right edge in RTL — `doLeftAndRightSwapInRTL` is on by default |
| **Absolute positioning** | `start`/`end` behaved identically to `left`/`right`; paper#3542 did **not** reproduce |
| **`gap` / `rowGap` / `columnGap`** | render correctly in RTL, evenly spaced |
| **`direction` style prop** | **works on Android under Fabric** — an `ltr` island inside an RTL page really is LTR |
| **Explicit `textAlign`** | overrides layout direction; the correct tool for always-LTR data |
| **Language switch, same direction** | `he → ar` is instant, **no reload**, layout stays RTL |
| **Language switch, direction flip** | `en → he` applies correctly via `reloadAppAsync()` — **without `expo-updates`** |
| **Restart-loop guard** | the persisted one-shot guard is what prevents an infinite restart loop |
| **Safe-area insets** | `top 27.38` / `bottom 48` live and correct; edge-to-edge properly configured on Android 15 |
| **Keyboard handling** | `KeyboardProvider` + `KeyboardAwareScrollView` keeps the focused field visible |
| **`elevation`** | renders on Android; symmetric, so nothing to mirror |
| **`boxShadow`** | **renders on Android** — a cross-platform directional shadow now exists |
| **Blur** | **real blur on Android**, but only with all four conditions met (see below) |
| **`android:supportsRtl`** | present by default via Expo prebuild; `expo-localization` plugin writes both string resources |

---

## ❌ Broken, missing, or silently wrong

| Area | What actually happens |
| --- | --- |
| **`I18nManager.isRTL`** | **Reads `false` while the layout is fully mirrored.** 8 configurations, 2 devices, debug + release, 3 system locales. It is a startup snapshot that never updates in-process. |
| **Everything keyed off `isRTL`** | Directional icons never flip · `TextInput.textAlign` picks the wrong side · `row-reverse` overrides do nothing · `boxShadow` correction does nothing |
| **`textAlign: 'start'`** | Not a valid value on 0.86.2 — fails silently, leaving text on the wrong side |
| **`borderInlineStartWidth`** | **Does not exist.** No border, no error, no warning. Only `borderStartWidth`/`borderEndWidth` exist |
| **`writingDirection`** | Does **not** control alignment — `'rtl'` and `'ltr'` rendered identically |
| **`shadowOffset`** | Does not render on Android at all, so direction-correcting it is a no-op |
| **A leading `+` in a phone number** | Migrates to the end inside RTL text: `+972 54-123-4567` → `54-123-4567 972+`. **`textAlign` does not fix it** |
| **Signed values inside RTL sentences** | The sign detaches; isolating the *whole line* does not help — only the value itself |
| **`@react-native-community/blur`** | **Hard native crash** on RN 0.86 (`NoSuchMethodError`), takes down the whole screen, uncatchable from JS |
| **`TextInput` in a plain `ScrollView`** | Keyboard covers the field — `adjustResize` no longer works under edge-to-edge |
| **`TextInput` in nested scroller / `FlatList` / `Modal` / bottom sheet** | All fail; a bottom sheet needs `BottomSheetTextInput` |
| **Missing providers** | `SafeAreaProvider` · `KeyboardProvider` · `GestureHandlerRootView` — each fails **silently** when forgotten |
| **Blur without all four conditions** | Renders a translucent tint. Only the missing `blurTarget` warns; the rest fail in silence |

---

## Claims that turned out to be WRONG

These were in the guide or the research corpus and did **not** survive measurement.

| Claim | Reality on RN 0.86.2 / Android |
| --- | --- |
| *"`expo-updates` is mandatory for a JS RTL flip"* | **False.** `reloadAppAsync()` from the core `expo` package works. |
| *"On Android, text alignment follows the language of the content"* | **False.** It follows **layout direction**. An `en` app left-aligned pure Hebrew; a `he` app right-aligned pure English. |
| *"Android uses a first-strong heuristic with LTR fallback"* | **Not observed.** Digit-, Latin- and emoji-leading Hebrew all aligned identically to plain Hebrew. |
| *"`writingDirection` is an alternative to `textAlign`"* | **False.** It does not affect alignment. |
| *"RN #54713: Android RTL reorders `-123.456`"* | **Did not reproduce** in that form — signed numbers in an LTR context are fine. |
| *"`shadowOffset` is iOS-only so RTL correction is pointless"* | **Half right.** True for `shadowOffset`, but `boxShadow` now gives a cross-platform directional shadow. |
| *"`direction` no-ops on Android"* | **False** under Fabric. (The cited issue was RN 0.68, closed as unsupported.) |
| *"`isRTL` is redundant for layout but fine for icons/textAlign"* | **Understated.** It is not merely redundant — it is **unreliable in both roles**. |

---

## The four blur conditions (all mandatory, three silent)

```jsx
const targetRef = useRef<View>(null);

<View style={styles.wrap}>
  <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
    <ContentToBlur />
  </BlurTargetView>
  <BlurView
    blurTarget={targetRef}          // 3 — the ONLY one that warns if missing
    blurMethod="dimezisBlurView"    // 1 — defaults to 'none' on Android
    intensity={50}
    style={styles.panel}            // 4 — SIBLING of the target, never a child
  />
</View>
```

Test at a **mid** intensity. At `100` a correct blur looks like a flat opaque slab and cannot
be told apart from a solid fill.

---

## The single most important finding

`I18nManager.isRTL` cannot be trusted, and **layout does not need it**.

The screen with **no direction logic at all** (T1) rendered perfectly. The screen that used
`isRTL` "correctly" (T2) was broken in three separate ways at once. Worse, a wrong `isRTL`
can make broken code *look* correct — and the bug is **invisible on same-script content**, so
a Hebrew app tested with Hebrew strings can look flawless while its direction logic is wrong.

Derive direction from the app's own language state:
```js
const isRTL = ['he', 'ar'].includes(i18n.language);   // trustworthy
// NOT: I18nManager.isRTL                              // startup snapshot, may be stale
```

---

## Test coverage

**Closed on Android:** T1 · T2 · T3 · T4 · T5 · T6 · T7 · T8 · T9 · T10 · T11 · T12 · T13 ·
T14 · T17 · T20 · T21 · T22 · T23 · T24 (10-case matrix) · T25 (blur)

**Not yet run:** the entire iOS half — T15, T16, T18, T19 plus re-running everything above.
See `MAC_INSTRUCTIONS.md`.

Full rule list with evidence: `SKILL_RULES.md` (19 rules).
Detailed per-test observations: `RESULTS.md`.
