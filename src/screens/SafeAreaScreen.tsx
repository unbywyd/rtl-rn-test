/**
 * T21 / T22 / T23 — Safe area, system bars and keyboard.
 *
 * The things AI agents most reliably forget when building an RN screen:
 *   T21  the status bar / camera cutout at the top
 *   T22  the gesture bar or nav buttons at the bottom
 *   T23  the keyboard covering the focused input
 *
 * Plus the RTL-specific trap that makes this belong in an RTL guide at all:
 *   insets.left / insets.right are PHYSICAL edges. They do NOT mirror under RTL.
 *   Applying insets.left as paddingStart is wrong in one of the two directions.
 *
 * Every box here is labelled with the live inset values so a screenshot proves
 * whether the padding was actually applied.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TextInput,
  StyleSheet,
  Platform,
  StatusBar,
  useWindowDimensions,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Section, Expect, Mono, C } from '../ui/kit';

export default function SafeAreaScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [focused, setFocused] = useState(false);

  return (
    // MEASURED BUG (Galaxy S21 Ultra, Android 15): a plain ScrollView left the
    // focused input covered by the keyboard. dumpsys showed mInputShown=true with
    // mServedView=null — the IME was open but bound to nothing.
    //
    // android:windowSoftInputMode="adjustResize" is NOT sufficient under
    // edge-to-edge (mandatory on Android 15): the window no longer resizes, so RN
    // never learns the keyboard's height. KeyboardAwareScrollView reads the real
    // IME insets and scrolls the focused field into view.
    <KeyboardAwareScrollView
      contentContainerStyle={[st.page, { paddingBottom: 48 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={16}
    >
      <Text style={st.h1}>T21/T22/T23 · Safe area &amp; keyboard</Text>

      <Section title="Live inset values" hint="These are what every layout below must respect.">
        <Mono>top: {insets.top}</Mono>
        <Mono>bottom: {insets.bottom}</Mono>
        <Mono>left: {insets.left} · right: {insets.right}</Mono>
        <Mono>
          screen: {Math.round(width)}×{Math.round(height)}
        </Mono>
        <Mono>
          StatusBar.currentHeight: {String(StatusBar.currentHeight ?? 'n/a')} ({Platform.OS})
        </Mono>
        <Expect text="bottom > 0 means a gesture bar exists — content must clear it." />
      </Section>

      <Section
        title="⚠️ RTL trap: insets.left/right are PHYSICAL"
        hint="They do NOT mirror. Mapping left→start is wrong in one direction."
      >
        <View style={[st.demo, { paddingStart: insets.left }]}>
          <Text style={st.t}>paddingStart: insets.left ({insets.left}) — WRONG in RTL</Text>
        </View>
        <View
          style={[
            st.demoOk,
            {
              paddingStart: I18nManager.isRTL ? insets.right : insets.left,
              paddingEnd: I18nManager.isRTL ? insets.left : insets.right,
            },
          ]}
        >
          <Text style={st.t}>direction-mapped insets — correct</Text>
        </View>
        <Expect text="On a notched phone in landscape the two differ visibly." />
        <Expect text="This is one of the few places isRTL is genuinely required." />
      </Section>

      <Section
        title="T21 · Top edge"
        hint="Content must not sit under the status bar / cutout."
      >
        <View style={st.badBox}>
          <Text style={st.t}>No top padding — would hide under the status bar</Text>
        </View>
        <View style={[st.okBox, { paddingTop: insets.top > 0 ? 12 : 12 }]}>
          <Text style={st.t}>Handled by the SafeAreaView wrapper in App.tsx</Text>
        </View>
        <Expect text="Scroll to the very top: the header must be fully visible." />
      </Section>

      <Section
        title="T22 · Bottom edge (gesture bar)"
        hint="The most-forgotten one: the last element hidden behind the nav bar."
      >
        <View style={st.badBox}>
          <Text style={st.t}>A button with no bottom inset would be unreachable</Text>
        </View>
        <View style={st.okBox}>
          <Text style={st.t}>
            Bottom inset ({insets.bottom}) is applied ONCE, by the ScrollView below
          </Text>
        </View>
        <Expect text="Scroll to the very bottom: the last card must clear the gesture bar." />
      </Section>

      <Section
        title="T23 · Keyboard"
        hint="Focus this input. It must not be covered by the keyboard."
      >
        <TextInput
          style={[st.input, focused && st.inputFocused]}
          placeholder="Tap here — does the keyboard cover this?"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Expect text="The field must stay visible while the keyboard is open." />
        <Expect text="Android: check with both gesture nav and 3-button nav." />
      </Section>

      <Section title="Edge-to-edge" hint="Android 15 forces edge-to-edge; insets are mandatory.">
        <Mono>Android 15+ ignores window-fitting flags — insets are the only correct answer.</Mono>
        <Expect text="If bottom inset is 0 on a gesture-nav device, edge-to-edge is misconfigured." />
      </Section>

      {/* Deliberate filler so the bottom edge can actually be scrolled to. */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={st.filler}>
          <Text style={st.t}>filler {i + 1}</Text>
        </View>
      ))}

      {/*
        NOTE — measured bug, kept as documentation:
        This card previously ALSO carried `marginBottom: insets.bottom` while the
        ScrollView's contentContainerStyle already added `insets.bottom`. The inset
        was applied twice (~144dp of dead space instead of ~96dp on a Galaxy S21).

        Rule: apply the bottom inset in exactly ONE place — normally the scroll
        container's contentContainerStyle. Double-counting is the quieter half of
        the safe-area mistake; forgetting it entirely is the loud half.
      */}
      <View style={st.lastCard}>
        <Text style={st.lastText}>LAST ELEMENT — must be fully visible</Text>
      </View>
    </KeyboardAwareScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  demo: {
    backgroundColor: '#fde4e0',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f0b0a5',
  },
  demoOk: {
    backgroundColor: '#dff3e6',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#9ed6b4',
  },
  badBox: {
    backgroundColor: '#fde4e0',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0b0a5',
  },
  okBox: {
    backgroundColor: '#dff3e6',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#9ed6b4',
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    backgroundColor: C.bg,
  },
  inputFocused: { borderColor: C.accent, borderWidth: 2 },
  filler: {
    backgroundColor: C.card,
    borderRadius: 8,
    padding: 16,
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  lastCard: {
    backgroundColor: C.accent,
    borderRadius: 10,
    padding: 18,
    marginTop: 10,
  },
  lastText: { color: '#fff', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  t: { fontSize: 13, color: C.text },
});
