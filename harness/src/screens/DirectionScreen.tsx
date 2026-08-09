/**
 * T10 — The `direction` style prop (open research question Q2).
 *
 * Docs list `direction: 'inherit' | 'ltr' | 'rtl'` with NO platform annotation,
 * but one old issue (#41289, RN 0.68, closed "Unsupported Version") claims it
 * no-ops on Android. Under Fabric it is parsed in shared C++, so it SHOULD work
 * on both platforms now. Unsettled — this screen decides it.
 *
 * Also verifies the important subtlety: `direction` changes Yoga resolution only.
 * It must NOT change I18nManager.isRTL, so anything keyed off isRTL (icons,
 * TextInput.textAlign) will NOT follow the island.
 */

import React from 'react';
import { ScrollView, Text, View, StyleSheet, I18nManager, Platform } from 'react-native';
import { Section, Box, Expect, Mono, C } from '../ui/kit';

export default function DirectionScreen() {
  const isRTL = I18nManager.isRTL;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T10 · direction prop</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(isRTL)}
      </Mono>

      <Section title="Page default (inherits app direction)" hint="Reference row.">
        <View style={st.track}>
          <Box label="1" />
          <Box label="2" />
          <Box label="3" />
        </View>
        <Expect text="RTL: 1 is rightmost." />
      </Section>

      <Section
        title="⭐ direction: 'ltr' island"
        hint="If this works, it is the clean primitive for pinning LTR content."
      >
        <View style={[st.track, { direction: 'ltr' } as any]}>
          <Box label="1" style={{ backgroundColor: C.boxB }} />
          <Box label="2" style={{ backgroundColor: C.boxB }} />
          <Box label="3" style={{ backgroundColor: C.boxB }} />
        </View>
        <Expect text="Should read 1·2·3 LEFT-to-right even while the app is RTL." />
        <Expect text="If identical to the reference row, `direction` no-ops here." />
      </Section>

      <Section title="direction: 'rtl' island inside the page" hint="The inverse check.">
        <View style={[st.track, { direction: 'rtl' } as any]}>
          <Box label="1" />
          <Box label="2" />
          <Box label="3" />
        </View>
        <Expect text="Should read 1·2·3 RIGHT-to-left even when the app is LTR." />
      </Section>

      <Section
        title="row-reverse workaround (portable alternative)"
        hint="What the guide currently recommends for pinning LTR content."
      >
        <View style={[st.track, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Box label="1" style={{ backgroundColor: C.boxA }} />
          <Box label="2" style={{ backgroundColor: C.boxA }} />
          <Box label="3" style={{ backgroundColor: C.boxA }} />
        </View>
        <Expect text="Compare against the direction:'ltr' island — do they match?" />
      </Section>

      <Section
        title="isRTL is NOT affected by direction"
        hint="Critical subtlety: icons/textAlign keyed off isRTL will not follow an island."
      >
        <View style={[st.track, { direction: 'ltr' } as any]}>
          <Text style={st.t}>Inside an ltr island, isRTL still reads: {String(I18nManager.isRTL)}</Text>
        </View>
        <Expect text="This value must stay the app-level value, proving the caveat." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  track: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  t: { fontSize: 12, color: C.text },
});
