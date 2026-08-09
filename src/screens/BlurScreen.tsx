/**
 * T25 — Blur.
 *
 * Blur is the effect designers add most freely and that behaves worst on
 * Android. Historically `expo-blur` was iOS-only and rendered as a flat
 * translucent rectangle on Android; `@react-native-community/blur` needed
 * different props per platform; and both interact badly with elevation,
 * overflow and screenshots.
 *
 * This screen answers, on a real device:
 *   1. Does expo-blur actually blur on Android, or just tint?
 *   2. Does @react-native-community/blur behave differently?
 *   3. Does blur intensity respond at all on Android?
 *   4. Does blur clip correctly with borderRadius / overflow hidden?
 *   5. Does blur survive over an image vs over a solid colour?
 *   6. Is blurred content still readable (the actual design risk)?
 *   7. Does it cost anything visible on scroll?
 *
 * Nothing here is RTL-specific — blur has no direction — but the same
 * "looks fine on iOS, degrades silently on Android" failure family is exactly
 * what the skill is about.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { BlurView as ExpoBlurView, BlurTargetView } from 'expo-blur';
import { Section, Expect, Mono, C } from '../ui/kit';

// A busy backdrop makes it obvious whether pixels are actually being blurred
// rather than merely covered by a translucent sheet.
function Backdrop({ children }: { children?: React.ReactNode }) {
  return (
    <View style={st.backdrop}>
      <View style={st.stripes}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              st.stripe,
              { backgroundColor: i % 2 ? '#2f6fed' : '#ffd166' },
            ]}
          />
        ))}
      </View>
      <Text style={st.backdropText}>SHARP TEXT BEHIND — 12345</Text>
      {children}
    </View>
  );
}

export default function BlurScreen() {
  const [intensity, setIntensity] = useState(50);
  const { width } = useWindowDimensions();

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T25 · Blur</Text>
      <Mono>platform={Platform.OS} · screen width={Math.round(width)}dp</Mono>

      <Section
        title="1 · expo-blur over a striped backdrop"
        hint="If the stripes stay sharp under the panel, it is a tint, not a blur."
      >
        <Text style={st.lbl}>A · default, no BlurTargetView</Text>
        <Backdrop>
          <ExpoBlurView intensity={intensity} tint="light" style={st.overlay}>
            <Text style={st.overlayText}>default · {intensity}</Text>
          </ExpoBlurView>
        </Backdrop>

        <Text style={st.lbl}>B · blurMethod set, still no BlurTargetView</Text>
        <Backdrop>
          <ExpoBlurView
            intensity={intensity}
            tint="light"
            blurMethod="dimezisBlurView"
            style={st.overlay}
          >
            <Text style={st.overlayText}>blurMethod only · {intensity}</Text>
          </ExpoBlurView>
        </Backdrop>

        <Text style={st.lbl}>C · BlurTargetView + blurMethod (the correct Android setup)</Text>
        <BlurTargetView style={st.backdrop}>
          <View style={st.stripes}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={[st.stripe, { backgroundColor: i % 2 ? '#2f6fed' : '#ffd166' }]}
              />
            ))}
          </View>
          <Text style={st.backdropText}>SHARP TEXT BEHIND — 12345</Text>
          <ExpoBlurView
            intensity={intensity}
            tint="light"
            blurMethod="dimezisBlurView"
            style={st.overlay}
          >
            <Text style={st.overlayText}>with BlurTargetView · {intensity}</Text>
          </ExpoBlurView>
        </BlurTargetView>

        <Expect text="MEASURED: on Android blur needs BOTH blurMethod AND a BlurTargetView wrapping the content." />
        <Expect text="A and B only tint. Only C should smear the stripes." />
      </Section>

      <Section
        title="2 · @react-native-community/blur — CRASHES on RN 0.86"
        hint="MEASURED: this library takes the whole screen down. Kept as documentation."
      >
        <View style={st.crashNote}>
          <Text style={st.crashTitle}>java.lang.NoSuchMethodError</Text>
          <Text style={st.crashBody}>
            No virtual method setupWith(ViewGroup) in class eightbitlab.com.blurview.BlurView
          </Text>
          <Text style={st.crashBody}>
            Thrown from BlurViewManagerImpl.createViewInstance during Fabric preallocateView —
            so the entire tab crashes, not just the blur.
          </Text>
        </View>
        <Expect text="Use expo-blur on RN 0.86 / New Architecture. This library is unmaintained against it." />
      </Section>

      <Section
        title="3 · Intensity response"
        hint="Tap to change. On Android intensity is often ignored or quantised."
      >
        <View style={st.row}>
          {[0, 25, 50, 80, 100].map((v) => (
            <Pressable
              key={v}
              onPress={() => setIntensity(v)}
              style={[st.chip, intensity === v && st.chipActive]}
            >
              <Text style={[st.chipText, intensity === v && st.chipTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>
        <Backdrop>
          <ExpoBlurView intensity={intensity} tint="light" style={st.overlay}>
            <Text style={st.overlayText}>intensity = {intensity}</Text>
          </ExpoBlurView>
        </Backdrop>
        <Expect text="Step through 0 → 100. If 0 and 100 look the same, intensity is ignored." />
      </Section>

      <Section
        title="4 · Clipping: borderRadius + overflow"
        hint="Blur views notoriously ignore parent clipping on Android."
      >
        <View style={st.clipParent}>
          <Backdrop />
          <ExpoBlurView intensity={intensity} tint="dark" style={st.overlayFull}>
            <Text style={[st.overlayText, { color: '#fff' }]}>rounded 24 + overflow hidden</Text>
          </ExpoBlurView>
        </View>
        <Expect text="The blur must be clipped to the rounded corners, not spill past them." />
      </Section>

      <Section
        title="5 · Dark tint over light content"
        hint="Tint direction is a common source of unreadable text."
      >
        <Backdrop>
          <ExpoBlurView intensity={intensity} tint="dark" style={st.overlay}>
            <Text style={[st.overlayText, { color: '#fff' }]}>dark tint · white text</Text>
          </ExpoBlurView>
        </Backdrop>
        <Expect text="Text must stay readable at EVERY intensity, including 0." />
      </Section>

      <Section
        title="6 · The real risk: readability at intensity 0"
        hint="If blur silently fails, does the design still work?"
      >
        <Backdrop>
          <ExpoBlurView intensity={0} tint="light" style={st.overlay}>
            <Text style={st.overlayText}>intensity 0 — worst case fallback</Text>
          </ExpoBlurView>
        </Backdrop>
        <Expect text="This is what Android users may see if blur degrades. Is it acceptable?" />
        <Expect text="If unreadable here, the design depends on an effect that is not guaranteed." />
      </Section>

      <Section title="7 · Nested blur" hint="Two blur layers stacked — a known performance and artefact trap.">
        <Backdrop>
          <ExpoBlurView intensity={intensity} tint="light" style={st.overlay}>
            <ExpoBlurView intensity={intensity} tint="dark" style={st.nested}>
              <Text style={[st.overlayText, { color: '#fff' }]}>nested blur</Text>
            </ExpoBlurView>
          </ExpoBlurView>
        </Backdrop>
        <Expect text="Watch for black boxes, flicker, or the inner layer not compositing." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 60, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  backdrop: {
    height: 130,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  stripes: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  stripe: { flex: 1 },
  backdropText: {
    textAlign: 'center',
    fontWeight: '900',
    fontSize: 16,
    color: '#111',
  },
  overlay: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 35,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayFull: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { fontSize: 13, fontWeight: '700', color: C.text },
  lbl: { fontSize: 11, color: C.dim, marginTop: 6 },
  clipParent: {
    height: 130,
    borderRadius: 24,
    overflow: 'hidden',
  },
  nested: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 13, color: C.text },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  crashNote: {
    backgroundColor: '#fde4e0',
    borderWidth: 1,
    borderColor: '#f0b0a5',
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  crashTitle: { fontSize: 13, fontWeight: '800', color: '#c0392b' },
  crashBody: { fontSize: 11, color: C.text, fontFamily: 'monospace' },
});
