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

**The exceptions are broken too — measured, not assumed.** In the Hebrew UI, the directional
arrow written as the textbook-correct
```jsx
transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }]
```
rendered **identical to the unflipped arrow** — both pointing right, in a right-to-left UI.
`isRTL` was `false`, so `scaleX` resolved to `1` and no flip occurred. The same screen showed
the `row-reverse` demo rows rendering identically for the same reason.

So `isRTL` fails in **both** roles at once:
- as a layout gate → produces LTR inside RTL (or masks a bug, see R1b),
- as the direction source for the *legitimate* exceptions → icons never flip,
  `textAlign` picks the wrong side, carousel indices are not inverted.

**Rule for the agent:**
> Never gate layout on `isRTL` — RN mirrors layout on its own, and the flag can be **wrong**.
> And for the cases that genuinely need a direction (directional icons, `TextInput.textAlign`,
> index math), **still do not read `I18nManager.isRTL`**. Derive direction from the app's own
> language state, which is the value the app actually decided:
> ```js
> const isRTL = ['he', 'ar'].includes(i18n.language);   // trustworthy
> // NOT: I18nManager.isRTL                              // startup snapshot, may be stale
> ```

**Why this matters:** this is the strongest possible argument for the "don't touch RTL, it
already works" position — and it goes further than expected. Layout mirrored correctly *while
the flag said otherwise*, and every piece of code that trusted the flag was wrong.

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

## R8 · A reload mechanism is required — but `expo-updates` is NOT

**Status:** ✅ measured, Galaxy S21 Ultra, project deliberately built **without** `expo-updates`

**What was measured:** switching `en → he` in-app flipped the direction correctly. The app
reloaded once, came back in Hebrew, and rendered fully mirrored — header right-aligned,
tab bar running right-to-left. `package.json` contains no `expo-updates`.

The reload used `reloadAppAsync()`, re-exported from the core **`expo`** package
(`expo-modules-core`), documented to work in both release and debug builds.

**Rule for the agent:**
> `I18nManager.forceRTL()` writes a native flag; it does **not** re-lay-out the running JS
> context. The new direction applies only after the bundle reloads — this is the real cause
> of "RTL only works the second time the app opens".
>
> A reload mechanism is therefore **mandatory**, but `expo-updates` specifically is **not**.
> Prefer `reloadAppAsync()` from `expo`. Reload only when the direction actually changed:
> a same-direction switch (he → ar, en → ru) must be instant with no reload.
>
> Defer the reload past first mount (~250ms) — calling it during first render is a
> documented crash/no-op hazard (expo#10598, expo#21347).

**Corrects the prior guide**, which claimed the JS approach "cannot work" without
`expo-updates`. It can. The failing project was missing *any* reload mechanism, which is a
different diagnosis with a different fix.

---

## R9 · `adjustResize` does not survive edge-to-edge — the keyboard covers the input

**Status:** ✅ measured AND fix verified on device (Galaxy S21 Ultra, Android 15)

**What was measured:** tapping the input in T23 opened the keyboard **on top of the field**.
After applying the fix below and reinstalling, the focused field stays visible — confirmed
by the user on the same device. This rule is backed by a full broken → diagnosed → fixed →
verified cycle, not by reading documentation.
`dumpsys input_method` showed the contradiction precisely:
```
mInputShown=true          ← keyboard is open
mServedView=null          ← bound to no view
```
The manifest already had `android:windowSoftInputMode="adjustResize"`, and it was not enough.

**Why:** edge-to-edge is mandatory on Android 15. The window no longer resizes when the IME
appears, so RN never learns the keyboard's height and a plain `ScrollView` cannot scroll the
focused field into view. This is exactly the same failure family as safe-area insets: the
system stopped resizing the window, and layout must read insets instead.

**Rule for the agent:**
> On Android 15+, `windowSoftInputMode="adjustResize"` alone does **not** keep a focused
> input visible. Wrap the tree in `KeyboardProvider` and use `KeyboardAwareScrollView`
> (`react-native-keyboard-controller`), which reads real IME insets.
>
> Merely installing the package does nothing — **`KeyboardProvider` must wrap the tree**, the
> same silent-no-op trap as forgetting `SafeAreaProvider` (R3).
>
> Diagnostic: if `dumpsys input_method` reports `mInputShown=true` with `mServedView=null`,
> the IME is open but bound to nothing — a layout/provider problem, not an input problem.

**Generalisation worth stating in the skill:** Android 15 removed the two implicit
conveniences RN layouts historically leaned on — window fitting for system bars, and window
resizing for the keyboard. Both must now be handled explicitly through insets.

---

## R10 · A TextInput inside any nested scroller needs an explicit owner

**Status:** ✅ measured, 10-case matrix, Galaxy S21 Ultra (Android 15). Every case marked
"should work" passed; every case marked "likely fails" failed. The prediction was exact.

**Results:**

| # | Wrapper | Result |
| --- | --- | --- |
| 1 | Bare `View`, no scroll | ✅ works |
| 2 | Plain `ScrollView` | ❌ **fails** |
| 3 | `KeyboardAvoidingView` + `ScrollView` | ❌ fails |
| 4 | `KeyboardAwareScrollView` | ✅ works |
| 5 | `ScrollView` nested in `KeyboardAwareScrollView` | ❌ fails |
| 6 | Field at end of long content | ✅ works |
| 7 | `TextInput` in `FlatList` | ❌ fails |
| 8 | `TextInput` in `Modal` | ❌ fails |
| 9 | Plain `TextInput` in bottom sheet | ❌ fails |
| 9b | `BottomSheetTextInput` in bottom sheet | ✅ works |
| 10 | Multiline `TextInput` | ✅ works |

**The pattern:** exactly one actor must own scrolling the focused field into view. Three
can claim it and they conflict —
1. the **system** (`adjustResize`) — dead under edge-to-edge on Android 15,
2. **`ScrollView`**'s internal focus logic — unreliable, and lost entirely when nested,
3. a **keyboard-aware container** reading real IME insets — the only reliable one.

Failure happens when zero actors own it (case 2), when two fight (case 3), or when the
field sits in a scroller the aware-container does not control (cases 5 and 7).

**Rule for the agent:**
> Never leave a `TextInput` inside a bare `ScrollView`, a nested scroller, or a `FlatList`
> and assume the keyboard will be handled. Give the field an explicit owner:
> - normal screens → `KeyboardAwareScrollView` (`react-native-keyboard-controller`)
> - **do not** stack `KeyboardAvoidingView` around a `ScrollView` — they double-compensate
> - **never nest** a scroller inside the keyboard-aware container and put a field in it
> - `FlatList` with inputs → use the library's aware list, not a plain `FlatList`
> - `Modal` → it has its own window; give it its own keyboard handling
> - **bottom sheet → `BottomSheetTextInput`, never plain `TextInput`** (measured: the plain
>   one fails and the sheet-specific one works, in the same sheet, side by side)

**This is the most common real-world case:** production forms live in sheets and modals,
which is exactly where the plain component fails.

---

## R1b · The double-flip bug can be MASKED by the `isRTL` bug — and that is worse

**Status:** ✅ measured, Hebrew UI, Galaxy S21 Ultra

**What was measured:** in the T2 screen with the app in Hebrew, the deliberately-wrong row
(`justifyContent: isRTL ? 'flex-end' : 'flex-start'`) rendered at the **right** edge —
i.e. it *looked correct*, identical to the properly-written row beside it.

**Why:** `isRTL` read `false` (R1), so the ternary picked `flex-start`, which happens to be
the right answer. Two bugs cancelled out.

**Why this matters more than the plain double flip:**
> Wrong direction code can look correct on the device you are testing on, because the flag
> it depends on is itself wrong. It will start rendering incorrectly the moment `isRTL`
> becomes accurate — a different RN version, a different platform, or a device where the
> startup snapshot resolves `true`.

**Rule for the agent:**
> Do not treat "it looks right on my device" as evidence that direction-dependent code is
> correct. Code that branches on `isRTL` for layout is wrong **even when the screenshot
> looks fine** — verify by reading the code, not the render. The only safe layout code has
> no direction branch in it at all.

---

## R11 · Three providers that silently do nothing if forgotten

**Status:** ✅ observed across this build

`SafeAreaProvider`, `KeyboardProvider` and `GestureHandlerRootView` share a failure mode:
install the package, use its components, and **nothing happens** — no error, no warning.
`useSafeAreaInsets()` returns zeros; keyboard-aware containers do not react; a bottom sheet
does not open.

**Rule for the agent:**
> When adding `react-native-safe-area-context`, `react-native-keyboard-controller` or
> `@gorhom/bottom-sheet`, wrap the root in the matching provider in the same edit.
> A missing provider produces silent misbehaviour, not a crash — so it is invisible in
> review and only shows up on device.

Related, verified here: on **Expo SDK 57** `babel-preset-expo` already includes the
reanimated/worklets babel plugin. Adding a hand-written `babel.config.js` for it **breaks
the bundler** (`Cannot read properties of undefined (reading 'transformFile')`). Do not
copy the old "add the reanimated plugin last" advice into a modern Expo project.

---

## R12 · On Android, text alignment follows LAYOUT DIRECTION — not text content

**Status:** ✅ measured, both halves, controlled probe strings. Galaxy S21 Ultra, Android 15,
RN 0.86.2 / Fabric.

**This refutes the most widely-cited claim about RN text alignment.** The RN 2016 blog says
*"In Android, the default text alignment depends on the language of the text content"*. On
this version it does not.

**Both halves, same device, no `textAlign` anywhere:**

| App language | String | Rendered |
| --- | --- | --- |
| `en` (LTR) | `שלום עולם` (pure Hebrew) | **left** |
| `he` (RTL) | `Hello world` (pure English) | **right** |

The text followed the app's **layout direction** in both cases, ignoring the script entirely.

**The first-strong probes settle it.** In the Hebrew app, all four rendered **right**,
identically to plain Hebrew:

| Probe | Rendered |
| --- | --- |
| `שלום עולם` (plain) | right |
| `123 שלום עולם` (digit-leading) | right |
| `iPhone שלום עולם` (Latin-leading) | right |
| `🚀 שלום עולם` (emoji-leading) | right |

If Android were using `TEXT_DIRECTION_FIRST_STRONG` with an LTR fallback, the digit-,
Latin- and emoji-leading strings would have gone **left**. They did not. There is no
content-based resolution happening here at all.

**Rule for the agent:**
> Do not repeat "Android aligns text by content, iOS by app bundle" — on RN 0.86.2 with
> Fabric, Android aligns by **layout direction**, exactly like a normal RTL-aware layout.
>
> The practical advice is unchanged and is what matters: **set `textAlign` explicitly**
> whenever a string's direction must not depend on the surrounding layout — always-LTR
> data such as phone numbers, emails, URLs, IBANs and code. Derive the value from the app's
> language state (R1), never from `I18nManager.isRTL`.

**Caveat:** iOS is not yet measured. The iOS half of this comparison is the main open item
for the Mac session, and the old claim may still hold there — but the Android half of it is
now disproven on current RN.

**Corollary measured in the same pass (T17): `writingDirection` does NOT control alignment.**
Two identical Hebrew strings, one with `writingDirection: 'rtl'` and one with `'ltr'`, no
`textAlign` on either, rendered **identically** (both right-aligned) on Android.

> Never offer `writingDirection` as an alternative to `textAlign`. It affects bidi ordering
> within a string, not the alignment of the block. `textAlign` is the only property that
> decides which edge text sits against.

Also confirmed here: an explicit `textAlign` **overrides layout direction** — a
`textAlign: 'left'` row stayed left-aligned inside the RTL screen. That is what makes it the
correct tool for always-LTR data.

---

## Pending — measured but not yet conclusive
- **Fabric reload fix** present in both 0.81.5 and 0.86.2 (`_updateLayoutContext` count 4).
- **`boxShadow`** exists cross-platform in 0.86 types — the "shadowOffset is iOS-only"
  research finding may be stale. Not yet visually confirmed.
