/**
 * T10 — The `direction` style prop (open research question Q2).
 *
 * Docs list `direction: 'inherit' | 'ltr' | 'rtl'` with NO platform annotation,
 * but one old issue (#41289, RN 0.68, closed "Unsupported Version") claims it
 * no-ops on Android. Under Fabric it is parsed in shared C++, so it SHOULD work
 * on both platforms now. Unsettled — this screen decides it.
 *
 * Also verifies the important subtlety: `direction` changes Yoga resolution only.
 * It must NOT change I18nManager.isRTL, so anything keyed off isRTL — a
 * mirrored icon, a carousel index — will NOT follow the island.
 *
 * `textAlign` is NOT one of those things, despite an earlier note here saying
 * so. It is resolved by Yoga, so `direction` mirrors it. T30 at the bottom of
 * this screen measures that directly instead of inferring it from the flag.
 */

import React from 'react';
import { ScrollView, Text, TextInput, View, StyleSheet, I18nManager, Platform } from 'react-native';
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
        hint="Critical subtlety: icons keyed off isRTL will not follow an island."
      >
        <View style={[st.track, { direction: 'ltr' } as any]}>
          <Text style={st.t}>Inside an ltr island, isRTL still reads: {String(I18nManager.isRTL)}</Text>
        </View>
        <Expect text="This value must stay the app-level value, proving the caveat." />
      </Section>

      {/*
        T30 — the gap this screen used to have.

        The section above proves `isRTL` does not follow an island, and the
        header of this file drew a conclusion from that: "anything keyed off
        isRTL (icons, TextInput.textAlign) will NOT follow the island".

        That is right for icons and wrong for textAlign, and the difference
        was never measured — the old section checked the VALUE of a flag, not
        where any text landed. textAlign is not "keyed off isRTL" at all: it
        is resolved by Yoga, and `direction` mirrors it exactly like it
        mirrors flex-start.

        Latin strings on purpose. Hebrew right-aligns under either behaviour,
        which is precisely how a wrong textAlign hides (R13).
      */}
      <Section
        title="T30 · does an explicit textAlign follow a direction island?"
        hint="Read the EDGE each row sits against, not the words."
      >
        <View style={[st.track, st.stack, { direction: 'rtl' } as any]}>
          <Text style={st.t}>rtl island / no textAlign</Text>
          <Text style={[st.t, { textAlign: 'left' }]}>rtl island / textAlign left</Text>
          <Text style={[st.t, { textAlign: 'right' }]}>rtl island / textAlign right</Text>
        </View>
        <View style={[st.track, st.stack, { direction: 'ltr' } as any]}>
          <Text style={st.t}>ltr island / no textAlign</Text>
          <Text style={[st.t, { textAlign: 'left' }]}>ltr island / textAlign left</Text>
          <Text style={[st.t, { textAlign: 'right' }]}>ltr island / textAlign right</Text>
        </View>
        <Expect text="If textAlign OVERRIDES direction, 'left' sits left in both islands. If direction MIRRORS it, 'left' sits right inside the rtl island." />
      </Section>

      {/*
        T30d — the DEFAULT, with the script varied.

        iOS and Android disagree on exactly one row: a <Text> with NO textAlign
        inside an rtl island. Android puts it right (layout direction); iOS puts
        it left. The hypothesis is that iOS resolves a missing textAlign as
        NSTextAlignmentNatural — first-strong character — so a Latin string
        reads LTR and lands left regardless of the island, while Android Fabric
        resolves the default from layout direction and ignores the script.

        That is testable: pair each Latin row with a Hebrew one. If the script
        changes the answer, the resolution is content-based; if it does not, it
        is direction-based. Every row here deliberately has NO textAlign.

        Note the trap this closes. R13 says Hebrew content hides a wrong
        textAlign — true. T30/T30b used Latin for exactly that reason. But
        Latin has the mirror-image blind spot: it hides a content-based
        DEFAULT. Neither script alone can measure this row.
      */}
      {/* T30g — is the ISLAND itself the discriminator?

          T30d measured bare Hebrew <Text> inside islands: always physically
          left on iOS. But T27's truncation rows measured a bare Hebrew <Text>
          with NO island anywhere in its ancestry, and it hugged RIGHT. Both
          cannot be the universal rule.

          The only structural difference is the island's presence, so these
          rows vary exactly that and nothing else: same string, same width,
          same numberOfLines, one outside any island and one inside an rtl
          island. Width/truncation is held constant so it cannot be the
          explanation either. */}
      <Section
        title="T30g · bare Hebrew Text: island vs no island"
        hint="Same string, same width, same numberOfLines. Only the island differs."
      >
        <Text style={st.t}>A · NO island, plain screen, no textAlign:</Text>
        <Text numberOfLines={1} style={[st.t, st.narrowBox]}>
          {'שלום עולם שלום עולם שלום עולם שלום עולם'}
        </Text>
        <Text style={st.t}>B · same, but inside direction:'rtl':</Text>
        <View style={[st.track, st.stack, { direction: 'rtl' } as any]}>
          <Text numberOfLines={1} style={[st.t, st.narrowBox]}>
            {'שלום עולם שלום עולם שלום עולם שלום עולם'}
          </Text>
        </View>
        <Text style={st.t}>C · full width, NO island (T30d's shape, no truncation):</Text>
        <Text style={st.t}>{'שלום עולם ללא יישור'}</Text>
        <Expect text="If A hugs right and B hugs left, the ISLAND is the discriminator and R30 needs 'inside a direction island' as a precondition. If both hug left, T27's table is stale." />
      </Section>

      <Section
        title="T30d · no textAlign at all — does the SCRIPT decide?"
        hint="Every row here omits textAlign. Only the string and the island differ."
      >
        <View style={[st.track, st.stack, { direction: 'rtl' } as any]}>
          <Text style={st.t}>rtl island / latin / no textAlign</Text>
          <Text style={st.t}>אי אי אי / עברית / no textAlign</Text>
          <TextInput style={[st.t, st.input]} defaultValue="rtl / input latin / none" />
          <TextInput style={[st.t, st.input]} defaultValue="אי אי אי / קלט עברית / none" />

          {/* T30e — the EMPTY field. A placeholder is not the field's value, so
              it may not go through the same resolution the value does. This is
              the state a form is in before anyone touches it, which makes it
              the state a user judges the screen by. */}
          <TextInput
            style={[st.t, st.input]}
            placeholder="אי אי אי / מציין מקום עברית / none"
            placeholderTextColor={C.dim}
          />
          <TextInput
            style={[st.t, st.input]}
            placeholder="latin placeholder / none"
            placeholderTextColor={C.dim}
          />
        </View>
        <View style={[st.track, st.stack, { direction: 'ltr' } as any]}>
          <Text style={st.t}>ltr island / latin / no textAlign</Text>
          <Text style={st.t}>אי אי אי / עברית / no textAlign</Text>
        </View>

        {/* T30g — NO island at all.
            T27 §6b measured a bare Hebrew <Text> with no textAlign hugging the
            RIGHT on iOS, in the plain screen. T30d measured the same thing
            landing LEFT — but inside a direction island. The island's presence
            is the only difference between the two setups, so these rows put a
            bare <Text> next to the island ones and let the pair be read in a
            single screenshot. Same styles, no `direction` anywhere above them. */}
        <View style={st.stack}>
          <Text style={st.t}>NO island / latin / no textAlign</Text>
          <Text style={st.t}>אי אי אי / עברית / no textAlign</Text>
        </View>
        <Expect text="If the DEFAULT is content-based (first-strong), the Hebrew rows sit RIGHT and the Latin rows LEFT in BOTH islands — the island stops mattering. If it is direction-based, both scripts follow the island: right in rtl, left in ltr. T30e: the two PLACEHOLDER rows say whether an empty field resolves like its own value (first-strong) or like everything else. T30g: the last pair has NO island at all — if the Hebrew row hugs right there and left in the islands above, the island's presence is what changes the default." />
      </Section>

      {/*
        T30b — the same question for the cases T30 leaves open.

        T30 covers a <Text> one level under the island. These are the places
        the answer could plausibly differ, and each one is a real screen
        pattern rather than a synthetic case.
      */}
      <Section
        title="T30b · TextInput, nesting, and 'center' inside an rtl island"
        hint="Same island, harder cases. Every row should follow the same rule as T30."
      >
        <View style={[st.track, st.stack, { direction: 'rtl' } as any]}>
          {/* A TextInput resolves alignment in native text machinery, not in
              the same path as <Text> — worth its own row. Placeholder AND
              value: R21 measured placeholders following layout direction, but
              not inside a direction island. */}
          <TextInput
            style={[st.t, st.input, { textAlign: 'left' }]}
            placeholder="input / placeholder / align left"
            placeholderTextColor={C.dim}
          />
          <TextInput
            style={[st.t, st.input, { textAlign: 'left' }]}
            defaultValue="input / value / align left"
          />

          {/* Depth: does the mirroring survive intermediate Views that carry
              no direction of their own? A real screen is never one level. */}
          <View>
            <View>
              <Text style={[st.t, { textAlign: 'left' }]}>nested 2 deep / align left</Text>
            </View>
          </View>

          {/* 'center' has no start/end sense, so it must be untouched — if it
              shifts, the mirroring is not a simple start/end swap. */}
          <Text style={[st.t, { textAlign: 'center' }]}>align center (must not move)</Text>

          {/* Always-LTR data: the case that legitimately wants the physical
              value. Inside rtl, 'right' is the START edge, which is where an
              LTR value belongs. The isolate fixes character order (R14); this
              row is about the BLOCK. */}
          <Text style={[st.t, { textAlign: 'right' }]}>{'⁦+972 54-123-4567⁩'}</Text>

          {/* T30c — the other half of the TextInput claim.
              The rows above only show that 'left' lands left on an input. That
              is not enough to say "not mirrored": it is also what a BROKEN or
              IGNORED property looks like. These two decide it. If 'right' lands
              right and 'center' centres, the input is honouring the physical
              value; if 'right' also landed left, the property is being dropped. */}
          <TextInput
            style={[st.t, st.input, { textAlign: 'right' }]}
            defaultValue="input / value / align right"
          />
          <TextInput
            style={[st.t, st.input, { textAlign: 'center' }]}
            defaultValue="input / value / align center"
          />
          {/* And the control: no textAlign at all. Whatever an input defaults
              to inside an rtl island is what a screen gets when the property is
              simply forgotten — worth knowing, since that is the common case. */}
          <TextInput style={[st.t, st.input]} defaultValue="input / value / NO textAlign" />
        </View>
        <Expect text="Rows 1-3 should sit at the END (right) like T30's 'left' row. 'center' must stay centred. The phone row should sit at the START (left) and read +972 54-123-4567 left-to-right. T30c: if the input honours the physical value, 'right' sits RIGHT and 'center' centres; if 'right' also sat left the property is being ignored, not kept." />
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  stack: { flexDirection: 'column', alignItems: 'stretch' },
  input: { borderWidth: 1, borderColor: C.dim, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
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
  narrowBox: { width: 180, fontSize: 15, backgroundColor: C.boxA, borderRadius: 4 },
});
