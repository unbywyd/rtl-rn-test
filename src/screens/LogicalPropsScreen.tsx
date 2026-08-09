/**
 * T8 / T9 / T20 — Logical property families and their traps.
 *
 * T8a: *Inline* family (marginInlineStart etc.) should flip like *Start.
 * T8b: *Block* family is VERTICAL and must never flip — it looks symmetric but isn't.
 * T8c: borderInlineStartWidth does NOT exist → silent no-op. The box shows no border.
 * T9:  precedence — `start` beats `left`, `right` AND `end`.
 * T20: iOS absolute positioning with start/end (paper#3542).
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager, Platform } from 'react-native';
import { Section, Box, Expect, Mono, C } from '../ui/kit';

export default function LogicalPropsScreen() {
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T8/T9/T20 · Logical properties</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(I18nManager.isRTL)}
      </Mono>

      <Section title="T8a · *Inline* family" hint="Should mirror exactly like marginStart/paddingStart.">
        <View style={st.track}>
          <Box label="marginInlineStart: 40" style={{ marginInlineStart: 40 } as any} />
        </View>
        <View style={st.track}>
          <Box label="paddingInlineStart: 40" style={{ paddingInlineStart: 40 } as any} />
        </View>
        <Expect text="Gap on the RIGHT in RTL. If it stays left, the family is unsupported here." />
      </Section>

      <Section
        title="T8b · *Block* family is a decoy"
        hint="marginBlockStart == marginTop. Vertical. Must NOT flip horizontally."
      >
        <View style={st.track}>
          <Box label="marginBlockStart: 20" style={{ marginBlockStart: 20 } as any} />
        </View>
        <Expect text="The gap must be on TOP in both directions — never on a side." />
      </Section>

      <Section
        title="T8c · borderInlineStartWidth does not exist"
        hint="Only borderStartWidth/borderEndWidth exist. This should render NO border."
      >
        <Box
          label="borderInlineStartWidth: 8 (expected: no border)"
          style={
            {
              borderInlineStartWidth: 8,
              borderColor: C.bad,
              backgroundColor: C.card,
            } as any
          }
        />
        <Box
          label="borderStartWidth: 8 (expected: border shows)"
          style={{ borderStartWidth: 8, borderColor: C.good, backgroundColor: C.card }}
        />
        <Expect text="If the first box has no border, the silent no-op is confirmed." />
      </Section>

      <Section
        title="T9 · Precedence trap"
        hint="`start` beats left/right/end. A `left` override becomes dead code."
      >
        <View style={st.abs}>
          <Box
            label="start:0 + left:120 → start wins"
            style={[st.absBox, { start: 0, left: 120 }]}
          />
        </View>
        <View style={st.abs}>
          <Box
            label="end:0 + right:120 → end wins"
            style={[st.absBox, { end: 0, right: 120, backgroundColor: C.boxB }]}
          />
        </View>
        <Expect text="Both boxes hug an edge. The 120px override is ignored." />
      </Section>

      <Section
        title="T20 · Absolute positioning: start vs left"
        hint="paper#3542 reported start/end failing for absolute positioning on iOS."
      >
        <View style={st.abs}>
          <Box label="position start: 10" style={[st.absBox, { start: 10 }]} />
        </View>
        <View style={st.abs}>
          <Box
            label="position left: 10"
            style={[st.absBox, { left: 10, backgroundColor: C.boxB }]}
          />
        </View>
        <Expect text="In RTL both should sit RIGHT. If 'start' misbehaves on iOS only, C7 is confirmed." />
      </Section>

      <Section title="Gap / rowGap / columnGap" hint="Not direction-specific, but confirm nothing breaks.">
        <View style={[st.track, { gap: 12 }]}>
          <Box label="A" />
          <Box label="B" />
          <Box label="C" />
        </View>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  track: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  abs: {
    height: 46,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  absBox: { position: 'absolute', top: 6 },
});
