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

> Fill in after running on device. Template at the bottom.

_(pending)_

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
