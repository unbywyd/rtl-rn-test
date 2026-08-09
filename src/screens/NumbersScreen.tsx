/**
 * T7 — Signed numbers and math under RTL bidi (RN #54713).
 *
 * Reported: on Android RTL, `-123.456` renders as `123.456-` and
 * `12 - 13 = 25` renders reversed. Research could not settle whether this is a
 * bug or correct UAX #9 output (the digits themselves are NOT reversed, which
 * suggests correct bidi newly applied rather than corruption).
 *
 * Either way the fix is the same: isolate numeric runs. If confirmed, this
 * WIDENS the guide's Rule 5 from phone/email to prices, deltas and temperatures.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager, Platform } from 'react-native';
import { Section, Expect, Mono, C } from '../ui/kit';

const LRM = '‎'; // U+200E
const LRI = '⁦'; // U+2066 LEFT-TO-RIGHT ISOLATE
const PDI = '⁩'; // U+2069 POP DIRECTIONAL ISOLATE

const CASES: { label: string; raw: string }[] = [
  { label: 'negative number', raw: '-123.456' },
  { label: 'positive signed', raw: '+42' },
  { label: 'math expression', raw: '12 - 13 = 25' },
  { label: 'temperature', raw: '-5°C' },
  { label: 'price', raw: '-99.90 ₪' },
  { label: 'percent delta', raw: '-12.5%' },
  { label: 'range', raw: '10-20' },
  { label: 'in sentence', raw: 'הטמפרטורה היא -5°C היום' },
];

function iso(s: string) {
  return LRI + s + PDI;
}

export default function NumbersScreen() {
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T7 · Numbers &amp; bidi</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(I18nManager.isRTL)}
      </Mono>

      <Section
        title="Raw vs LRM vs isolate"
        hint="Compare each triple. Any difference means bidi is reordering the sign."
      >
        {CASES.map((c) => (
          <View key={c.label} style={st.group}>
            <Text style={st.lbl}>{c.label}</Text>
            <View style={st.ruler}>
              <Text style={st.t}>raw: {c.raw}</Text>
            </View>
            <View style={st.ruler}>
              <Text style={st.t}>
                LRM: {LRM}
                {c.raw}
              </Text>
            </View>
            <View style={st.ruler}>
              <Text style={st.t}>isolate: {iso(c.raw)}</Text>
            </View>
          </View>
        ))}
        <Expect text="If 'raw' shows the sign on the wrong side and isolate fixes it, #54713 reproduces." />
      </Section>

      <Section title="Intl formatting" hint="Does Intl output need isolation too?">
        <View style={st.ruler}>
          <Text style={st.t}>
            he-IL currency: {new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(-99.9)}
          </Text>
        </View>
        <View style={st.ruler}>
          <Text style={st.t}>
            en-US currency: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(-99.9)}
          </Text>
        </View>
        <View style={st.ruler}>
          <Text style={st.t}>date he-IL: {new Intl.DateTimeFormat('he-IL').format(new Date(2026, 7, 9))}</Text>
        </View>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  group: { gap: 3, marginBottom: 8 },
  lbl: { fontSize: 10, color: C.dim },
  ruler: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  t: { fontSize: 14, color: C.text },
});
