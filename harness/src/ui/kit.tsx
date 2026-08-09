/**
 * Minimal UI primitives for the test screens.
 *
 * IMPORTANT: this kit is written with LOGICAL properties only and contains no
 * `isRTL` in any layout value. That is deliberate — the screens must demonstrate
 * that correct RTL needs no manual mirroring. Any `isRTL` in this repo appears
 * only inside a test that is explicitly about `isRTL`.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';

export const C = {
  bg: '#ffffff',
  card: '#f6f7f9',
  border: '#d9dde3',
  text: '#11161c',
  dim: '#5b6672',
  good: '#0f7b3f',
  bad: '#c0392b',
  warn: '#b7791f',
  accent: '#2f6fed',
  boxA: '#cfe3ff',
  boxB: '#ffd9cf',
} as const;

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {hint ? <Text style={s.sectionHint}>{hint}</Text> : null}
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  // Plain 'row' — RN mirrors this automatically under RTL.
  return <View style={[s.row, style]}>{children}</View>;
}

export function Chip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  const toneStyle =
    tone === 'good' ? s.chipGood : tone === 'bad' ? s.chipBad : tone === 'warn' ? s.chipWarn : undefined;
  return (
    <View style={[s.chip, toneStyle]}>
      <Text style={s.chipText}>{label}</Text>
    </View>
  );
}

export function Box({
  label,
  style,
  textStyle,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[s.box, style]}>
      <Text style={[s.boxText, textStyle]}>{label}</Text>
    </View>
  );
}

/** A labelled expectation, so a screenshot is self-documenting. */
export function Expect({ text }: { text: string }) {
  return <Text style={s.expect}>▸ {text}</Text>;
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <Text style={s.mono}>{children}</Text>;
}

const s = StyleSheet.create({
  section: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: C.bg,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  sectionHint: {
    fontSize: 12,
    color: C.dim,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  sectionBody: { padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipGood: { backgroundColor: '#dff3e6', borderColor: '#9ed6b4' },
  chipBad: { backgroundColor: '#fde4e0', borderColor: '#f0b0a5' },
  chipWarn: { backgroundColor: '#fdf0d5', borderColor: '#e8c98a' },
  chipText: { fontSize: 12, color: C.text },
  box: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: C.boxA,
  },
  boxText: { fontSize: 12, color: C.text },
  expect: { fontSize: 11, color: C.accent, marginTop: 2 },
  mono: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },
});
