/**
 * T27 — Line height and vertical text centering.
 *
 * Added during the iOS session, after the T25 blur screenshot accidentally
 * exposed a vertical-centering bug that the Android pass had never surfaced
 * (see RESULTS.md "T26"). The failure mode is the single most common iOS text
 * complaint: text is clipped, or sits off-centre, inside buttons and inputs —
 * while the same code looks correct on Android.
 *
 * There are three separate mechanisms at play, and they are routinely confused
 * with each other. Each section isolates ONE of them:
 *
 *   1. `justifyContent` is not inherited      — the T26 bug, pure layout
 *   2. `lineHeight` vs `fontSize`             — cross-platform, but the box
 *                                               grows/clips differently
 *   3. `verticalAlign` / `textAlignVertical`  — ANDROID-ONLY per the RN docs,
 *                                               so it silently does nothing here
 *
 * Documented platform facts (reactnative.dev/docs/text-style-props):
 *   - `lineHeight` has NO platform annotation -> cross-platform
 *   - `includeFontPadding`, `textAlignVertical`, `verticalAlign` -> "Android"
 *
 * Every block states its expectation on screen so a screenshot stands alone.
 */

import React from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  StyleSheet,
  Platform,
  I18nManager,
} from 'react-native';
import { Section, Expect, Mono, C } from '../ui/kit';

/** A fixed-height box, the shape a button or input actually has in a real UI. */
function Slot({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={st.slot}>
      <Text style={st.slotLabel}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Screenshot helper. There is no `adb shell input swipe` equivalent on iOS 26
 * (see RESULTS.md B2), so a tall screen cannot be scrolled from the host to be
 * captured section by section. Setting SHOW_ONLY to a section number renders
 * that section alone, which fits one viewport and can be captured unattended.
 * `null` renders the whole screen, which is the normal mode.
 */
const SHOW_ONLY: number | null = null;

const only = (n: number) => SHOW_ONLY === null || SHOW_ONLY === n;

export default function LineHeightScreen() {
  const HE = 'שלום עולם';
  const MIX = 'שלום World 123';

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T27 · Line height &amp; vertical centering</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(I18nManager.isRTL)}
      </Mono>

      {/* ---------------------------------------------------------------- 1 */}
      <Section
        title="1 · justifyContent is NOT inherited"
        hint="The T26 bug, reduced. Both boxes set justifyContent:'center'; only the wrapper differs."
      >
        <Slot label="A · text is a DIRECT child of the centering box">
          <View style={st.frame}>
            <Text style={st.plain}>centered</Text>
          </View>
        </Slot>

        <Slot label="B · same box, one absoluteFill wrapper in between">
          <View style={st.frame}>
            <View style={StyleSheet.absoluteFill}>
              <Text style={st.plain}>centered?</Text>
            </View>
          </View>
        </Slot>

        <Slot label="C · wrapper given its own justifyContent — the fix">
          <View style={st.frame}>
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
              <Text style={st.plain}>centered</Text>
            </View>
          </View>
        </Slot>

        <Expect text="A centred. B pinned to the TOP — the wrapper is a new flex container and inherits no alignment. C centred again." />
        <Expect text="textAlign:'center' would NOT fix B. It only governs the horizontal axis." />
      </Section>

      {/* ---------------------------------------------------------------- 2 */}
      <Section
        title="2 · lineHeight vs fontSize — clipping"
        hint="fontSize 16 in every row. Only lineHeight changes. Backgrounds show the real text box."
      >
        <Slot label="no lineHeight (baseline for comparison)">
          <Text style={[st.marked, { fontSize: 16 }]}>Ág Q pçy — שלום</Text>
        </Slot>

        <Slot label="lineHeight 16 — EQUAL to fontSize">
          <Text style={[st.marked, { fontSize: 16, lineHeight: 16 }]}>Ág Q pçy — שלום</Text>
        </Slot>

        <Slot label="lineHeight 12 — SMALLER than fontSize">
          <Text style={[st.marked, { fontSize: 16, lineHeight: 12 }]}>Ág Q pçy — שלום</Text>
        </Slot>

        <Slot label="lineHeight 28 — comfortably larger">
          <Text style={[st.marked, { fontSize: 16, lineHeight: 28 }]}>Ág Q pçy — שלום</Text>
        </Slot>

        <Expect text="Watch the ascenders/descenders (Á, g, Q, ç, y) and the Hebrew. lineHeight <= fontSize is where clipping appears." />
        <Expect text="Hebrew glyphs are taller than Latin at the same fontSize — a lineHeight that is safe for English can clip Hebrew." />
      </Section>

      {/* ---------------------------------------------------------------- 3 */}
      <Section
        title="3 · lineHeight centring inside a fixed-height box"
        hint="The button case. Box height is 48 in all three; only the centring METHOD differs."
      >
        <Slot label="A · flex centring (justifyContent), no lineHeight">
          <View style={st.btn}>
            <Text style={st.btnText}>{HE}</Text>
          </View>
        </Slot>

        <Slot label="B · no flex centring, lineHeight = box height (48)">
          <View style={st.btnNoCenter}>
            <Text style={[st.btnText, { lineHeight: 48 }]}>{HE}</Text>
          </View>
        </Slot>

        <Slot label="C · BOTH flex centring and lineHeight 48">
          <View style={st.btn}>
            <Text style={[st.btnText, { lineHeight: 48 }]}>{HE}</Text>
          </View>
        </Slot>

        <Expect text="B is the 'lineHeight = height' trick. Record whether it centres exactly on iOS or sits low/high." />
        <Expect text="C is the combination people write when B looks wrong. Check whether it double-corrects." />
      </Section>

      {/* ---------------------------------------------------------------- 4 */}
      <Section
        title="4 · verticalAlign / textAlignVertical — Android-only"
        hint="Docs annotate BOTH as Android. On iOS these should be silent no-ops."
      >
        <Slot label="verticalAlign: 'top'">
          <View style={st.btnNoCenter}>
            <Text style={[st.btnText, { verticalAlign: 'top' }]}>{HE}</Text>
          </View>
        </Slot>

        <Slot label="verticalAlign: 'middle'">
          <View style={st.btnNoCenter}>
            <Text style={[st.btnText, { verticalAlign: 'middle' }]}>{HE}</Text>
          </View>
        </Slot>

        <Slot label="verticalAlign: 'bottom'">
          <View style={st.btnNoCenter}>
            <Text style={[st.btnText, { verticalAlign: 'bottom' }]}>{HE}</Text>
          </View>
        </Slot>

        <Expect text="If all three render IDENTICALLY, verticalAlign is a no-op on this platform — as the docs' Android tag implies." />
        <Expect text="A silent no-op is the danger: the style is accepted, so it reads as working in review." />
      </Section>

      {/* ---------------------------------------------------------------- 5 */}
      <Section
        title="5 · TextInput vertical alignment"
        hint="The other half of the complaint. Fixed height 52, single line."
      >
        <Slot label="A · height only, no vertical handling">
          <TextInput style={st.input} defaultValue={MIX} />
        </Slot>

        <Slot label="B · paddingVertical 0 (the usual attempted fix)">
          <TextInput style={[st.input, { paddingVertical: 0 }]} defaultValue={MIX} />
        </Slot>

        <Slot label="C · lineHeight 20 added">
          <TextInput style={[st.input, { lineHeight: 20 }]} defaultValue={MIX} />
        </Slot>

        <Slot label="D · placeholder only (empty value)">
          <TextInput style={st.input} placeholder={MIX} />
        </Slot>

        <Expect text="Compare the text baseline against the box in all four. Record whether the caret and the text share a centre." />
        <Expect text="Also check D: an empty input's placeholder can sit differently from real text." />
      </Section>

      {/* ---------------------------------------------------------------- 6 */}
      <Section
        title="6 · Multi-line clipping with numberOfLines"
        hint="Where lineHeight and truncation interact — the second-most-common report."
      >
        <Slot label="numberOfLines=2, lineHeight 14 (tight)">
          <Text numberOfLines={2} style={[st.marked, { fontSize: 16, lineHeight: 14 }]}>
            {`${MIX} ${MIX} ${MIX} ${MIX}`}
          </Text>
        </Slot>

        <Slot label="numberOfLines=2, lineHeight 24 (roomy)">
          <Text numberOfLines={2} style={[st.marked, { fontSize: 16, lineHeight: 24 }]}>
            {`${MIX} ${MIX} ${MIX} ${MIX}`}
          </Text>
        </Slot>

        <Expect text="Check whether row 1 clips vertically (lines colliding)." />

        {/* The rows above proved too short to truncate on a 440dp screen, so no
            ellipsis ever rendered and the RTL side question went unanswered.
            These force truncation: numberOfLines={1} in a deliberately narrow
            box, one per script. */}
        <Slot label="⭐ numberOfLines=1, NARROW box — Hebrew (forces truncation)">
          <Text numberOfLines={1} style={[st.marked, st.narrow]}>
            {`${HE} ${HE} ${HE} ${HE} ${HE}`}
          </Text>
        </Slot>

        <Slot label="⭐ numberOfLines=1, NARROW box — English (control)">
          <Text numberOfLines={1} style={[st.marked, st.narrow]}>
            Truncate me please, this line is far too long to fit in the box
          </Text>
        </Slot>

        <Slot label="⭐ numberOfLines=1, NARROW box — mixed script">
          <Text numberOfLines={1} style={[st.marked, st.narrow]}>
            {`${MIX} ${MIX} ${MIX} ${MIX}`}
          </Text>
        </Slot>

        <Slot label="numberOfLines=2, NARROW box — Hebrew, ellipsis on line 2">
          <Text numberOfLines={2} style={[st.marked, st.narrow]}>
            {`${HE} ${HE} ${HE} ${HE} ${HE}`}
          </Text>
        </Slot>

        <Expect text="⭐ THE QUESTION: which SIDE does the … land on? In RTL the text starts at the right, so the ellipsis must be on the LEFT." />
        <Expect text="If the Hebrew row puts … on the RIGHT while the English row puts it on the RIGHT too, truncation ignores direction." />
      </Section>

      {/* ---------------------------------------------------------------- 7 */}
      <Section
        title="7 · Pressable button, the real-world shape"
        hint="Everything above combined, as it is actually written in product code."
      >
        <Pressable style={st.realBtn}>
          <Text style={st.realBtnText}>{HE}</Text>
        </Pressable>

        <Pressable style={st.realBtn}>
          <Text style={[st.realBtnText, { lineHeight: 18 }]}>{HE}</Text>
        </Pressable>

        <Pressable style={st.realBtn}>
          <Text style={st.realBtnText}>Save · שמור · 123</Text>
        </Pressable>

        <Expect text="These use flex centring only — the pattern that is correct on BOTH platforms." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 60 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },

  slot: { gap: 4 },
  slotLabel: { fontSize: 11, color: C.dim },

  // A fixed box with centring, so a failure is visible against a known edge.
  frame: {
    height: 56,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    paddingHorizontal: 10,
  },
  plain: { fontSize: 14, color: C.text },

  // A tinted background reveals the text box itself, not just the glyphs.
  marked: {
    color: C.text,
    backgroundColor: C.boxA,
    borderRadius: 4,
  },
  // Narrow enough that any of the strings below is guaranteed to overflow,
  // so truncation actually fires and an ellipsis is rendered.
  narrow: { width: 180, fontSize: 15 },

  btn: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.boxA,
  },
  // Same box WITHOUT flex centring, so the text style alone decides placement.
  btnNoCenter: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: C.boxB,
  },
  btnText: { fontSize: 15, fontWeight: '600', color: C.text },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
  },

  realBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.accent,
  },
  realBtnText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});
