/**
 * T1 — Baseline auto-mirroring.
 *
 * Contains ZERO isRTL. Everything here should mirror purely because RN/Yoga
 * mirrors logical properties. If any row fails to move when switching he <-> en,
 * the guide's R1a auto-flip list is wrong.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager } from 'react-native';
import { Section, Row, Box, Expect, Mono, C } from '../ui/kit';

export default function BaselineScreen() {
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T1 · Baseline (no isRTL anywhere)</Text>
      <Mono>isRTL = {String(I18nManager.isRTL)}</Mono>

      <Section title="flexDirection: 'row'" hint="Source order 1·2·3 should read from the start edge.">
        <Row>
          <Box label="1" />
          <Box label="2" />
          <Box label="3" />
        </Row>
        <Expect text="RTL: 1 is rightmost. LTR: 1 is leftmost." />
      </Section>

      <Section title="justifyContent" hint="flex-start = start edge, flex-end = end edge.">
        <View style={[st.track, { justifyContent: 'flex-start' }]}>
          <Box label="flex-start" />
        </View>
        <View style={[st.track, { justifyContent: 'flex-end' }]}>
          <Box label="flex-end" style={{ backgroundColor: C.boxB }} />
        </View>
        <Expect text="RTL: flex-start hugs RIGHT, flex-end hugs LEFT." />
      </Section>

      <Section title="alignItems in a column" hint="Same mirroring on the cross axis.">
        <View style={[st.column, { alignItems: 'flex-start' }]}>
          <Box label="alignItems: flex-start" />
        </View>
        <View style={[st.column, { alignItems: 'flex-end' }]}>
          <Box label="alignItems: flex-end" style={{ backgroundColor: C.boxB }} />
        </View>
      </Section>

      <Section title="marginStart / paddingStart" hint="Logical spacing should move to the other side.">
        <View style={st.track}>
          <Box label="marginStart: 40" style={{ marginStart: 40 }} />
        </View>
        <View style={st.track}>
          <Box label="paddingStart: 40" style={{ paddingStart: 40 }} />
        </View>
        <Expect text="The gap appears on the RIGHT in RTL." />
      </Section>

      <Section title="borderStartWidth" hint="Documented logical border property.">
        <Box
          label="borderStartWidth: 6"
          style={{ borderStartWidth: 6, borderColor: C.accent, backgroundColor: C.card }}
        />
        <Expect text="The thick border is on the RIGHT in RTL." />
      </Section>

      <Section title="Absolute: start / end" hint="'start' maps to left in LTR, right in RTL.">
        <View style={st.abs}>
          <Box label="start: 0" style={[st.absBox, { start: 0 }]} />
        </View>
        <View style={st.abs}>
          <Box label="end: 0" style={[st.absBox, { end: 0, backgroundColor: C.boxB }]} />
        </View>
        <Expect text="Known soft spot (RN #8137) — verify carefully on both platforms." />
      </Section>

      <Section title="left / right (auto-swap)" hint="Swapped by default via doLeftAndRightSwapInRTL.">
        <View style={st.abs}>
          <Box label="left: 0" style={[st.absBox, { left: 0 }]} />
        </View>
        <Expect text="If this does NOT move in RTL, the auto-swap default is off." />
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
  column: {
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
