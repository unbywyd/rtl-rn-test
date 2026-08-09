/**
 * T2 — The double-flip demo.
 *
 * This is the single most important screen in the repo. It renders the same
 * intent three ways and shows that the "AI-style" isRTL ternary lands on the
 * WRONG side, because RN has already mirrored the layout.
 *
 * Screenshot this in Hebrew. It is the teaching image for the skill.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Section, Row, Box, Expect, Mono, C } from '../ui/kit';

export default function DoubleFlipScreen() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T2 · {t('screens.doubleFlip')}</Text>
      <Mono>I18nManager.isRTL = {String(isRTL)}</Mono>

      <Section
        title="1. Correct — logical, no isRTL"
        hint="justifyContent: 'flex-start'. RN mirrors it: start = right edge in RTL."
      >
        <View style={[st.track, { justifyContent: 'flex-start' }]}>
          <Box label="START" />
        </View>
        <Expect text="In Hebrew this box must sit at the RIGHT edge." />
      </Section>

      <Section
        title="2. Wrong — the AI double flip"
        hint="isRTL ? 'flex-end' : 'flex-start' — mirrors what RN already mirrored."
      >
        <View
          style={[
            st.track,
            { justifyContent: isRTL ? 'flex-end' : 'flex-start' },
            st.wrongTrack,
          ]}
        >
          <Box label="DOUBLE-FLIPPED" style={{ backgroundColor: C.boxB }} />
        </View>
        <Expect text="In Hebrew this lands on the LEFT — visibly wrong." />
      </Section>

      <Section
        title="3. Wrong — flexDirection double flip"
        hint="isRTL ? 'row-reverse' : 'row' cancels RN's own mirroring."
      >
        <Text style={st.caption}>Correct (plain 'row'): numbers should read 1·2·3 from the start edge.</Text>
        <Row>
          <Box label="1" />
          <Box label="2" />
          <Box label="3" />
        </Row>

        <Text style={[st.caption, { marginTop: 10 }]}>
          Double-flipped ('row-reverse' under RTL): order visually reverses.
        </Text>
        <View style={[st.rowBase, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Box label="1" style={{ backgroundColor: C.boxB }} />
          <Box label="2" style={{ backgroundColor: C.boxB }} />
          <Box label="3" style={{ backgroundColor: C.boxB }} />
        </View>
        <Expect text="The two rows must differ in Hebrew and match in English." />
      </Section>

      <Section
        title="4. Legitimate isRTL — directional icon"
        hint="An arrow is opaque pixels; RN cannot know where it points. This IS a correct isRTL use."
      >
        <Row>
          <Text style={st.arrow}>➜</Text>
          <Text style={st.caption}>Not flipped — points the wrong way in RTL</Text>
        </Row>
        <Row>
          <Text style={[st.arrow, { transform: [{ scaleX: isRTL ? -1 : 1 }] }]}>➜</Text>
          <Text style={st.caption}>Flipped with scaleX — correct</Text>
        </Row>
        <Expect text="Only the second arrow points toward the reading direction." />
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
  wrongTrack: { borderColor: '#f0b0a5' },
  rowBase: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  caption: { fontSize: 12, color: C.dim },
  arrow: { fontSize: 22, color: C.text },
});
