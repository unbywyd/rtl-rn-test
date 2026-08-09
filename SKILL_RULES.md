# Verified Rules → Skill

Rules that survived measurement on real devices. **Nothing enters this file without
evidence.** Each rule carries what was measured, where, and what it changes for an agent.

Anything unverified stays in `TEST_PLAN.md` until a device settles it.

**Baseline:** Expo SDK 57 · RN 0.86.2 · Fabric · Galaxy S21 Ultra (Android 15) + Pixel 6 Pro emulator (API 34)

---

## R1 · `I18nManager.isRTL` is unreliable — do not gate layout on it

**Status:** ✅ measured, 6 configurations, 2 devices

**What was measured:** the app rendered a fully mirrored RTL layout while
`I18nManager.isRTL === false`, in every configuration tried:

| Build | Device | System locale | Launch | Layout | `isRTL` |
| --- | --- | --- | --- | --- | --- |
| debug | emulator | en-US | 1st + cold | mirrored | `false` |
| release | emulator | en-US | fresh + cold | mirrored | `false` |
| release | emulator | he-IL | fresh | mirrored | `false` |
| release | **Galaxy S21 Ultra, Android 15** | ru-RU | 1st + cold | mirrored | `false` |

Native state proved the flag was actually set:
```xml
<boolean name="RCTI18nUtil_forceRTL" value="true" />
```

**Root cause (RN 0.86.2 source):**
- `I18nManagerModule.kt:26` computes `isRTL` at **native module construction**, before JS runs.
- `I18nManager.js` snapshots it once at module load and never re-reads it.
- `I18nUtil.kt:66` checks `Locale.getAvailableLocales()[0]` — an arbitrary JVM locale
  table entry, **not** the device's preferred locale.

**Rule for the agent:**
> Never gate layout on `isRTL`. It is not merely redundant — it can be **wrong**, in the
> direction that silently produces LTR layout inside an RTL screen. For the few genuine
> exceptions (directional icons, `TextInput.textAlign`, index math), derive direction from
> the app's own language state, not from `I18nManager.isRTL`.

**Why this matters:** this is the strongest possible argument for the "don't touch RTL,
it already works" position. Layout mirrored correctly *while the flag said otherwise*.

---

## R2 · Apply a safe-area inset in exactly ONE place

**Status:** ✅ measured, Galaxy S21 Ultra (Android 15)

**What was measured:** the final card cleared the nav bar but left ~144dp of dead space
instead of ~96dp, because the bottom inset was applied twice:
```jsx
contentContainerStyle={{ paddingBottom: 48 + insets.bottom }}  // once
<View style={{ marginBottom: insets.bottom }}>                  // again
```

**Two symmetrical failure modes, both bugs:**

| Mode | Symptom | Visibility |
| --- | --- | --- |
| Forgot the inset | content sits under the nav bar | loud, caught immediately |
| **Counted it twice** | large dead gap | **quiet, ships unnoticed** |

**Rule for the agent:**
> Apply each safe-area inset exactly once — normally in the scroll container's
> `contentContainerStyle`. An agent told merely "remember safe area" reliably produces the
> double-count. State the *single place*, not the reminder.

---

## R3 · `SafeAreaView` must come from `react-native-safe-area-context`

**Status:** ✅ verified in code; RN's own export is documented iOS-only

**Rule for the agent:**
> Import `SafeAreaProvider` and `SafeAreaView` from `react-native-safe-area-context`, never
> from `react-native` — RN's own `SafeAreaView` is iOS-only and a silent no-op on Android.
> Without `SafeAreaProvider` wrapping the tree, `useSafeAreaInsets()` returns zeros and
> every inset-aware layout silently degrades.

---

## R4 · `insets.left` / `insets.right` are PHYSICAL — they do not mirror

**Status:** ✅ verified on device (`left: 0 · right: 0` portrait; needs a landscape/notch
pass to show a visible difference)

**Rule for the agent:**
> Safe-area insets are physical screen edges and are **not** direction-aware. Mapping
> `insets.left → paddingStart` is correct in LTR and wrong in RTL. Map them through the
> current direction:
> ```jsx
> paddingStart: isRTL ? insets.right : insets.left,
> paddingEnd:   isRTL ? insets.left  : insets.right,
> ```
> This is one of the few places a direction check is genuinely required — and per R1, that
> check must not come from `I18nManager.isRTL`.

---

## R5 · Insets are dp, not pixels

**Status:** ✅ measured — `screen: 384×853 dp` on a physical 1080×2400 panel (density ≈ 2.8)

**Rule for the agent:**
> `insets.bottom: 48` is ~134 physical pixels at density 2.8. A small-looking inset number
> is a large visual band. Never dismiss an inset as negligible because the number is small.

---

## R6 · `textAlign` accepts no `start` / `end`

**Status:** ✅ verified in installed types, two RN versions

```ts
// RN 0.86.2 — types/public/ReactNativeRenderer.d.ts:630
textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify' | undefined;
```
Also absent in 0.81.5. Merged to RN `main` (PR #57201) but shipped in no release yet.

**Rule for the agent:**
> Use logical properties (`marginStart`, `paddingEnd`, `start`, `end`) for **layout**, but
> **never** write `textAlign: 'start'` — it is not a valid value and fails silently, leaving
> text on the wrong side. Use an explicit `'left' | 'right'` decision instead.
> This is the exact bug produced by mechanically applying the web CSS logical-property
> rewrite to React Native.

---

## R7 · `android:supportsRtl="true"` is a hard prerequisite

**Status:** ✅ verified in generated manifest + plugin output

Since RN 0.75, `I18nUtil.isRTL()` is gated on this flag as the outermost AND. Without it
`forceRTL` **silently no-ops** with no JS-visible signal. Expo's prebuild supplies it, and
the `expo-localization` plugin additionally writes:
```xml
<string name="ExpoLocalization_supportsRTL">true</string>
<string name="ExpoLocalization_forcesRTL">false</string>
```

**Rule for the agent:**
> When "forceRTL does nothing on Android" is reported, check `android:supportsRtl="true"`
> in the manifest **first**, before touching any JS. Also prefer the `expo-localization`
> config plugin over a hand-written AppDelegate patch — the plugin covers **both**
> platforms; a custom AppDelegate plugin is iOS-only and silently does nothing on Android.

---

## Pending — measured but not yet conclusive

- **T3/T4 text alignment.** In an English (LTR) app, Hebrew strings with no `textAlign`
  rendered **left**-aligned on Android — including plain Hebrew with no leading Latin
  character. This does **not** match the widely-cited "Android aligns by text content"
  claim. Needs the Hebrew-app half before any rule is written.
- **Fabric reload fix** present in both 0.81.5 and 0.86.2 (`_updateLayoutContext` count 4).
- **`boxShadow`** exists cross-platform in 0.86 types — the "shadowOffset is iOS-only"
  research finding may be stale. Not yet visually confirmed.
