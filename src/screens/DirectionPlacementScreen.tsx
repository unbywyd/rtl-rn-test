/**
 * T29 — WHERE does `direction` have to sit to actually take effect?
 *
 * T10 proved `direction: 'rtl'` works on iOS. T28 then wrapped the whole app in
 * a `<View style={{direction}}>` and NOTHING flipped — because every screen's
 * root is a `ScrollView`, and the flip appeared not to cross it.
 *
 * That diagnosis was inferred, not measured. This screen measures it: the same
 * three-box row is rendered five times, identical except for WHERE `direction:
 * 'rtl'` is applied. Whichever rows read `3 2 1` are the placements that work.
 *
 * Read the result as: the highest-level row that flips is the shallowest place
 * a real app has to put it.
 */

import React, { useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Platform, Pressable, I18nManager } from 'react-native';
import { Section, Expect, Mono, C } from '../ui/kit';

/** The probe: source order 1·2·3. Reads 1·2·3 in LTR, 3·2·1 when mirrored. */
function Probe() {
  return (
    <View style={st.row}>
      {['1', '2', '3'].map((n) => (
        <View key={n} style={st.box}>
          <Text style={st.boxText}>{n}</Text>
        </View>
      ))}
    </View>
  );
}

const RTL = { direction: 'rtl' } as const;

export default function DirectionPlacementScreen() {
  // G/H: the decisive pair — direction driven by STATE, toggled after mount.
  //
  // The toggle flips between EXPLICIT 'rtl' and EXPLICIT 'ltr'. It deliberately
  // does NOT use `undefined` for the off state: `undefined` means "inherit",
  // and since this screen sits inside a DirectionProvider that is already rtl,
  // both states would render mirrored and the button would look broken while
  // working perfectly. Measured that exact false negative on the first run.
  const [on, setOn] = useState(false);
  const dyn = { direction: on ? 'rtl' : 'ltr' } as const;

  return (
    // NOTE: this ScrollView deliberately carries NO direction. Rows A–F set it
    // locally so each row reports its own placement; if the screen itself were
    // rtl, every row would inherit it and the whole comparison would read
    // "everything works" regardless of placement — which is exactly the false
    // positive the first run of this screen produced.
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T29 · Where must `direction` go?</Text>
      <Mono>
        platform={Platform.OS} · isRTL={String(I18nManager.isRTL)}
      </Mono>
      <Expect text="Every row below is the SAME markup. Only the placement of direction:'rtl' differs." />
      <Expect text="A row that reads 3·2·1 has been mirrored. A row that reads 1·2·3 has not." />

      <Section
        title="A · on a nested ScrollView (style prop)"
        hint="A scroller of its own, carrying direction:'rtl'."
      >
        <ScrollView style={[st.innerScroll, RTL]}>
          <Probe />
        </ScrollView>
        <Expect text="If this reads 3·2·1, putting direction on a scroller works." />
      </Section>

      <Section
        title="B · on a plain View wrapping the row"
        hint="The nearest possible ancestor — the T10 shape, known to work."
      >
        <View style={RTL}>
          <Probe />
        </View>
        <Expect text="Control. This one MUST read 3·2·1 — T10 already measured it." />
      </Section>

      <Section
        title="C · two plain Views up (does it inherit?)"
        hint="direction on a grandparent, nothing in between."
      >
        <View style={RTL}>
          <View>
            <Probe />
          </View>
        </View>
        <Expect text="If 3·2·1, direction inherits normally through plain Views." />
      </Section>

      <Section
        title="D · across a nested ScrollView"
        hint="direction OUTSIDE, an inner scroller in between — the T28 failure shape."
      >
        <View style={RTL}>
          <ScrollView style={st.innerScroll}>
            <Probe />
          </ScrollView>
        </View>
        <Expect text="⭐ THE DECIDING ROW. If this reads 1·2·3 while C reads 3·2·1, a ScrollView blocks inheritance." />
      </Section>

      <Section
        title="E · on the inner ScrollView's contentContainerStyle"
        hint="The other node a ScrollView owns."
      >
        <ScrollView style={st.innerScroll} contentContainerStyle={RTL}>
          <Probe />
        </ScrollView>
        <Expect text="If D fails but E works, contentContainerStyle is the correct placement." />
      </Section>

      <Section title="F · no direction anywhere (baseline)" hint="Whatever the app default is.">
        <Probe />
        <Expect text="Compare every row above against this one." />
      </Section>

      <Section
        title="⭐ G/H · direction driven by STATE (the T28 shape)"
        hint="Rows A–F are static — the node is BORN with direction. These two are toggled after mount."
      >
        <Pressable onPress={() => setOn((v) => !v)} style={st.btn}>
          <Text style={st.btnText}>
            direction = {on ? "'rtl'" : "'ltr'"} · TAP TO SWITCH
          </Text>
        </Pressable>

        <Text style={st.lbl}>G · style mutated on an existing node</Text>
        <View style={dyn}>
          <Probe />
        </View>

        <Text style={st.lbl}>H · same, but key={'{dir}'} forces a remount</Text>
        <View key={on ? 'rtl' : 'ltr'} style={dyn}>
          <Probe />
        </View>

        <Expect text="⭐ Both rows must TRACK the button: 3·2·1 while 'rtl', 1·2·3 while 'ltr'." />
        <Expect text="If G tracks it, mutating direction on a live node works — no remount needed." />
        <Expect text="If only H tracks it, direction applies at node CREATION and needs key={dir}." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 60 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8 },
  box: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: C.boxA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxText: { fontSize: 15, fontWeight: '700', color: C.text },
  innerScroll: { maxHeight: 70 },
  lbl: { fontSize: 11, color: C.dim, marginTop: 6 },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  btnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
