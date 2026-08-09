/**
 * T5 / T6 — TextInput alignment and always-LTR content.
 *
 * T5: layout mirrors automatically, but text alignment INSIDE an input does not.
 *     Also probes the Android numeric-caret defect (RN #33483).
 * T6: phone/email/URL are always LTR even in RTL UI. U+200E (LRM) fixes
 *     placeholders that would otherwise render with reordered digit groups.
 */

import React, { useState } from 'react';
import { ScrollView, Text, View, TextInput, StyleSheet, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Section, Expect, Mono, C } from '../ui/kit';
import { directionFromLanguage } from '../lib/direction';

const LRM = '‎';

export default function InputsScreen() {
  const { t } = useTranslation();

  // MEASURED: I18nManager.isRTL reads false even in a fully mirrored RTL app
  // (R1), so `textAlign: I18nManager.isRTL ? 'right' : 'left'` — the textbook
  // fix — left the text left-aligned inside an Arabic UI. Derive direction from
  // the app's own language instead; that is the value the app actually chose.
  const isRTL = directionFromLanguage();
  const flagSaysRTL = I18nManager.isRTL;
  const [v, setV] = useState('');

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T5/T6 · Inputs</Text>
      <Mono>direction from language = {String(isRTL)} ← trustworthy</Mono>
      <Mono>I18nManager.isRTL = {String(flagSaysRTL)} ← may be stale</Mono>

      <Section
        title="⭐ Direction source comparison"
        hint="The same textAlign written two ways. Only one is correct."
      >
        <Text style={st.lbl}>textAlign from I18nManager.isRTL (the textbook fix)</Text>
        <TextInput
          style={[st.input, { textAlign: flagSaysRTL ? 'right' : 'left' }]}
          placeholder="broken when the flag is stale"
          placeholderTextColor={C.dim}
        />
        <Text style={st.lbl}>textAlign from the app language (correct)</Text>
        <TextInput
          style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
          placeholder="follows the real direction"
          placeholderTextColor={C.dim}
        />
        <Expect text="If these differ, I18nManager.isRTL is lying — see R1." />
      </Section>

      <Section
        title="T5 · With and without textAlign"
        hint="Type Hebrew in each. Watch where the caret starts."
      >
        <Text style={st.lbl}>No textAlign (default 'auto')</Text>
        <TextInput
          style={st.input}
          placeholder={t('placeholderName')}
          placeholderTextColor={C.dim}
          value={v}
          onChangeText={setV}
        />

        <Text style={st.lbl}>Explicit textAlign (recommended)</Text>
        <TextInput
          style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
          placeholder={t('placeholderName')}
          placeholderTextColor={C.dim}
        />
        <Expect text="Without textAlign the caret/placeholder sits on the wrong side in RTL." />
      </Section>

      <Section
        title="T5b · Numeric caret (Android defect RN #33483)"
        hint="Type digits into an RTL-aligned input."
      >
        <TextInput
          style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
          keyboardType="number-pad"
          placeholder="12345"
          placeholderTextColor={C.dim}
        />
        <Expect text="Watch whether the caret advances correctly while typing numbers." />
      </Section>

      <Section
        title="T6 · Phone — always LTR"
        hint="Digit groups must never reorder. This is data corruption, not cosmetics."
      >
        <Text style={st.lbl}>Plain (no LTR handling)</Text>
        <TextInput style={st.input} placeholder={t('placeholderPhone')} placeholderTextColor={C.dim} keyboardType="phone-pad" />

        <Text style={st.lbl}>Forced LTR + LRM placeholder</Text>
        <TextInput
          style={[st.input, { textAlign: 'left' }]}
          placeholder={LRM + t('placeholderPhone')} placeholderTextColor={C.dim}
          keyboardType="phone-pad"
        />
        <Expect text="Compare '+972 54-123-4567' in both. The plain one may reorder." />
      </Section>

      <Section title="T6b · Email and URL" hint="Same rule as phone numbers.">
        <TextInput style={st.input} placeholder={t('placeholderEmail')} placeholderTextColor={C.dim} keyboardType="email-address" autoCapitalize="none" />
        <TextInput
          style={[st.input, { textAlign: 'left' }]}
          placeholder={LRM + 'https://example.com/path?q=1'} placeholderTextColor={C.dim}
          autoCapitalize="none"
        />
      </Section>

      <Section
        title="T6c · LTR field inside RTL row"
        hint="The one legitimate row-reverse override: icon must follow the pinned field."
      >
        <View style={[st.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={st.icon}>☎</Text>
          <TextInput
            style={[st.input, { flex: 1, textAlign: 'left' }]}
            placeholder={LRM + t('placeholderPhone')} placeholderTextColor={C.dim}
            keyboardType="phone-pad"
          />
        </View>
        <Expect text="Icon stays visually adjacent to the LTR field." />
      </Section>

      <Section title="Static rendering of LTR data in RTL text" hint="Not an input — plain Text.">
        <Text style={st.t}>טלפון: +972 54-123-4567</Text>
        <Text style={st.t}>טלפון: {LRM}+972 54-123-4567</Text>
        <Expect text="Second line (LRM-marked) should keep the digit groups in order." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  lbl: { fontSize: 11, color: C.dim, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
    // MEASURED: without an explicit placeholderTextColor the placeholder was
    // invisible on this device (Samsung One UI renders it near-white on a white
    // field). Always set it — an invisible placeholder also hides where the
    // caret/alignment actually is, which masks RTL bugs.
  },
  row: { alignItems: 'center', gap: 8 },
  icon: { fontSize: 20 },
  t: { fontSize: 15, color: C.text },
});
