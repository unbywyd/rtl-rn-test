/**
 * T14 — Shadows (open research question Q3).
 *
 * Research claim C11: shadowOffset/shadowRadius/shadowOpacity are iOS-only, so
 * negating shadowOffset.width for RTL is a silent no-op on Android (which uses
 * `elevation`, a symmetric shadow with no horizontal component).
 *
 * But RN 0.86 types DO expose cross-platform `boxShadow`, so C11 may be stale.
 * This screen renders all three so the answer is visible per platform.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager, Platform } from 'react-native';
import { Section, Expect, Mono, C } from '../ui/kit';

export default function ShadowsScreen() {
  const isRTL = I18nManager.isRTL;
  const dx = 10;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T14 · Shadows</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(isRTL)}
      </Mono>

      <Section title="shadowOffset (iOS-only per research)" hint="width: +10, not direction-corrected.">
        <View style={[st.card, st.iosShadow]}>
          <Text style={st.t}>shadowOffset width +{dx}</Text>
        </View>
        <View
          style={[
            st.card,
            st.iosShadow,
            { shadowOffset: { width: isRTL ? -dx : dx, height: 4 } },
          ]}
        >
          <Text style={st.t}>shadowOffset direction-corrected</Text>
        </View>
        <Expect text="On Android both should look identical (no shadow / elevation-less)." />
      </Section>

      <Section title="elevation (Android)" hint="Symmetric material shadow — no horizontal component.">
        <View style={[st.card, { elevation: 6 }]}>
          <Text style={st.t}>elevation: 6</Text>
        </View>
        <Expect text="Renders on Android. Cannot express a direction, so nothing to mirror." />
      </Section>

      <Section title="boxShadow (cross-platform in RN 0.86 types)" hint="Does it render, and does it mirror?">
        <View style={[st.card, { boxShadow: `${dx}px 4px 8px rgba(0,0,0,0.35)` } as any]}>
          <Text style={st.t}>boxShadow 10px 4px</Text>
        </View>
        <View
          style={[
            st.card,
            { boxShadow: `${isRTL ? -dx : dx}px 4px 8px rgba(0,0,0,0.35)` } as any,
          ]}
        >
          <Text style={st.t}>boxShadow direction-corrected</Text>
        </View>
        <Expect text="If boxShadow renders on Android, research finding C11 is outdated." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  card: {
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 10, height: 4 },
  },
  t: { fontSize: 13, color: C.text },
});
