/**
 * T3 / T4 / T17 — Text alignment.
 *
 * T3: default textAlign is 'auto'. The claim under test is that Android resolves
 *     it from the TEXT CONTENT while iOS resolves it from the APP BUNDLE's
 *     localization — so unmarked Hebrew drifts LEFT on iOS but not on Android.
 *
 * T4: Android's heuristic is TEXT_DIRECTION_FIRST_STRONG with an LTR fallback,
 *     so Hebrew starting with a digit / Latin word / emoji should left-align on
 *     Android too. If true, "Android is fine without textAlign" is wrong.
 *
 * T17: writingDirection is claimed to have regressed to a no-op on iOS Fabric.
 *
 * Compare the SAME screenshot across platforms — that is the whole point.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager, Platform } from 'react-native';
import { Section, Expect, Mono, C } from '../ui/kit';

const HE = 'שלום עולם';
const EN = 'Hello world';

// First-strong probes: each begins with a non-Hebrew "strong-ish" character.
const PROBES: { label: string; value: string }[] = [
  { label: 'plain Hebrew', value: HE },
  { label: 'digit-leading', value: `123 ${HE}` },
  { label: 'latin-leading', value: `iPhone ${HE}` },
  { label: 'emoji-leading', value: `🚀 ${HE}` },
  { label: 'plus-leading', value: `+972 ${HE}` },
  { label: 'quote-leading', value: `"${HE}"` },
  { label: 'plain English', value: EN },
];

function Ruler({ children }: { children: React.ReactNode }) {
  // A full-width bordered box makes the alignment unambiguous in a screenshot.
  return <View style={st.ruler}>{children}</View>;
}

export default function TextAlignScreen() {
  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T3/T4/T17 · Text alignment</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(I18nManager.isRTL)}
      </Mono>

      <Section
        title="T3 · No textAlign at all (default 'auto')"
        hint="THE key comparison. Screenshot on both platforms and diff."
      >
        <Ruler>
          <Text style={st.t}>{HE}</Text>
        </Ruler>
        <Ruler>
          <Text style={st.t}>{EN}</Text>
        </Ruler>
        <Expect text="Android: Hebrew right, English left (content-based)." />
        <Expect text="iOS: both may follow the bundle → Hebrew may drift LEFT." />
      </Section>

      <Section
        title="T4 · First-strong heuristic probes (no textAlign)"
        hint="If Android is content-based with LTR fallback, non-Hebrew leading chars break it."
      >
        {PROBES.map((p) => (
          <View key={p.label} style={st.probeRow}>
            <Text style={st.probeLabel}>{p.label}</Text>
            <Ruler>
              <Text style={st.t}>{p.value}</Text>
            </Ruler>
          </View>
        ))}
        <Expect text="Any probe that left-aligns on Android disproves 'Android is always fine'." />
      </Section>

      <Section
        title="Explicit textAlign — the recommended fix"
        hint="Portable across platforms and versions."
      >
        <Ruler>
          <Text style={[st.t, { textAlign: 'right' }]}>{HE} · textAlign:'right'</Text>
        </Ruler>
        <Ruler>
          <Text style={[st.t, { textAlign: 'left' }]}>{EN} · textAlign:'left'</Text>
        </Ruler>
        <Expect text="Both must obey regardless of platform or app language." />
      </Section>

      <Section
        title="T17 · writingDirection only (no textAlign)"
        hint="iOS-only prop. Research says it no-ops under Fabric (RN #51235)."
      >
        <Ruler>
          <Text style={[st.t, { writingDirection: 'rtl' }]}>{HE} · writingDirection:'rtl'</Text>
        </Ruler>
        <Ruler>
          <Text style={[st.t, { writingDirection: 'ltr' }]}>{HE} · writingDirection:'ltr'</Text>
        </Ruler>
        <Expect text="If these look identical, writingDirection does NOT control alignment." />
      </Section>

      <Section
        title="Mixed content (do NOT pin direction here)"
        hint="Pinning a direction on mixed script reorders segments incorrectly."
      >
        <Ruler>
          <Text style={st.t}>רחוב Dizengoff 42, תל אביב</Text>
        </Ruler>
        <Ruler>
          <Text style={[st.t, { writingDirection: 'rtl' }]}>
            רחוב Dizengoff 42, תל אביב · forced rtl
          </Text>
        </Ruler>
        <Expect text="Compare segment order — forcing may scramble the street number." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  ruler: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    backgroundColor: C.card,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  t: { fontSize: 15, color: C.text },
  probeRow: { gap: 3 },
  probeLabel: { fontSize: 10, color: C.dim },
});
