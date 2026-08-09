/**
 * T24 — Keyboard matrix.
 *
 * The same TextInput in ten different wrappers, to find exactly which
 * combinations stop keeping the focused field visible.
 *
 * Why this screen exists: "the input stops working once it's inside a
 * scrollable view" is a real, repeatedly-observed failure. The cause is that
 * three different actors can be responsible for moving the field into view, and
 * they conflict:
 *   1. the system    — resizes the window (adjustResize). Dead under edge-to-edge.
 *   2. ScrollView    — has internal focus-scroll logic that breaks when nested.
 *   3. KeyboardAware — reads real IME insets itself.
 *
 * Each case below is labelled with what SHOULD happen. Tap each field in turn;
 * a case fails if the field ends up behind the keyboard.
 *
 * NOTE: cases are deliberately NOT all fixed. Broken cases are the deliverable —
 * they are what the skill needs to warn about.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  I18nManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import BottomSheet, { BottomSheetView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { C } from '../ui/kit';

const isRTL = I18nManager.isRTL;

function Case({
  n,
  title,
  expect,
  danger,
  children,
}: {
  n: number;
  title: string;
  expect: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[st.case, danger && st.caseDanger]}>
      <Text style={st.caseTitle}>
        {n}. {title}
      </Text>
      <Text style={[st.caseExpect, danger && st.caseExpectDanger]}>{expect}</Text>
      {children}
    </View>
  );
}

function Field({ label }: { label: string }) {
  const [v, setV] = useState('');
  return (
    <TextInput
      style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
      placeholder={label}
      value={v}
      onChangeText={setV}
    />
  );
}

export default function KeyboardMatrixScreen() {
  const insets = useSafeAreaInsets();
  const [modalOpen, setModalOpen] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    sheetRef.current?.expand();
  }, []);

  return (
    <View style={st.root}>
      <KeyboardAwareScrollView
        contentContainerStyle={[st.page, { paddingBottom: 48 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <Text style={st.h1}>T24 · Keyboard matrix</Text>
        <Text style={st.note}>
          Tap each field. It FAILS if the keyboard covers it. Scroll down — later cases are
          the interesting ones.
        </Text>

        {/* 1 — the trivial baseline */}
        <Case n={1} title="Bare View (no scroll)" expect="Should work — nothing to scroll.">
          <Field label="case 1" />
        </Case>

        {/* 2 — the classic reported failure */}
        <Case
          n={2}
          title="Plain ScrollView, no keyboard handling"
          expect="LIKELY FAILS on Android 15 — window no longer resizes under edge-to-edge."
          danger
        >
          <ScrollView style={st.innerScroll} keyboardShouldPersistTaps="handled">
            <View style={st.spacer} />
            <Field label="case 2 — inside plain ScrollView" />
            <View style={st.spacer} />
          </ScrollView>
        </Case>

        {/* 3 — the "standard" RN answer that often double-compensates */}
        <Case
          n={3}
          title="KeyboardAvoidingView + ScrollView"
          expect="May fail or double-compensate: KAV shrinks while ScrollView also scrolls."
          danger
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={st.innerScroll}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={st.spacer} />
              <Field label="case 3 — KAV + ScrollView" />
              <View style={st.spacer} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Case>

        {/* 4 — the known-good approach */}
        <Case
          n={4}
          title="KeyboardAwareScrollView (this screen's own container)"
          expect="Should work — reads real IME insets."
        >
          <Field label="case 4 — direct child of KeyboardAwareScrollView" />
        </Case>

        {/* 5 — nesting, where focus tracking usually dies */}
        <Case
          n={5}
          title="ScrollView nested inside KeyboardAwareScrollView"
          expect="LIKELY FAILS — the outer container cannot scroll a field held by an inner scroller."
          danger
        >
          <ScrollView style={st.innerScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <View style={st.spacer} />
            <Field label="case 5 — nested scroll" />
            <View style={st.spacer} />
          </ScrollView>
        </Case>

        {/* 6 — a field far down a long page */}
        <Case
          n={6}
          title="Field at the end of long content"
          expect="Boundary case: nothing below it to scroll into."
        >
          <Field label="case 6 — see the bottom of this screen too" />
        </Case>

        {/* 7 — virtualized list */}
        <Case
          n={7}
          title="TextInput inside a FlatList"
          expect="Virtualization + focus is its own failure mode."
          danger
        >
          <FlatList
            style={st.innerScroll}
            data={[0, 1, 2]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            keyExtractor={(i) => String(i)}
            renderItem={({ item }) =>
              item === 1 ? (
                <Field label="case 7 — inside FlatList" />
              ) : (
                <View style={st.spacer} />
              )
            }
          />
        </Case>

        {/* 8 — modal has its own window */}
        <Case
          n={8}
          title="TextInput inside a Modal"
          expect="Modals get their own window — IME insets may not reach it."
          danger
        >
          <Pressable style={st.btn} onPress={() => setModalOpen(true)}>
            <Text style={st.btnText}>Open modal</Text>
          </Pressable>
        </Case>

        {/* 9 — the most common production case */}
        <Case
          n={9}
          title="TextInput inside a bottom sheet"
          expect="Must use BottomSheetTextInput, not TextInput. Plain TextInput typically fails."
          danger
        >
          <Pressable style={st.btn} onPress={openSheet}>
            <Text style={st.btnText}>Open bottom sheet</Text>
          </Pressable>
        </Case>

        {/* 10 — growing input */}
        <Case
          n={10}
          title="Multiline TextInput"
          expect="Grows while typing — the visible area must follow the caret."
        >
          <TextInput
            style={[st.input, st.multiline, { textAlign: isRTL ? 'right' : 'left' }]}
            placeholder="case 10 — type several lines"
            multiline
          />
        </Case>

        <View style={st.lastCard}>
          <Text style={st.lastText}>END OF MATRIX</Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Case 8 — modal */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={[st.modalBody, { paddingTop: insets.top + 20, paddingBottom: insets.bottom }]}>
          <Text style={st.h1}>Case 8 · Modal</Text>
          <Text style={st.note}>
            Tap the field. Does the keyboard cover it? Modals have their own window.
          </Text>
          <View style={st.spacerBig} />
          <Field label="case 8 — inside Modal" />
          <Pressable style={st.btn} onPress={() => setModalOpen(false)}>
            <Text style={st.btnText}>Close</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Case 9 — bottom sheet */}
      {sheetOpen && (
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={['55%']}
          enablePanDownToClose
          onClose={() => setSheetOpen(false)}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
        >
          <BottomSheetView style={st.sheetBody}>
            <Text style={st.caseTitle}>Case 9 · Bottom sheet</Text>
            <Text style={st.note}>Compare the two fields below.</Text>

            <Text style={st.caseExpectDanger}>Plain TextInput — usually fails:</Text>
            <TextInput
              style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
              placeholder="plain TextInput in sheet"
            />

            <Text style={st.caseExpect}>BottomSheetTextInput — the correct one:</Text>
            <BottomSheetTextInput
              style={[st.input, { textAlign: isRTL ? 'right' : 'left' }]}
              placeholder="BottomSheetTextInput"
            />
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  page: { padding: 14, gap: 10 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  note: { fontSize: 12, color: C.dim, marginBottom: 4 },
  case: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    backgroundColor: C.bg,
  },
  caseDanger: { borderColor: '#f0b0a5', backgroundColor: '#fffaf9' },
  caseTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  caseExpect: { fontSize: 11, color: C.good },
  caseExpectDanger: { fontSize: 11, color: C.bad },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  innerScroll: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: C.card,
  },
  spacer: { height: 60 },
  spacerBig: { height: 220 },
  btn: {
    backgroundColor: C.accent,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalBody: { flex: 1, padding: 16, gap: 10, backgroundColor: C.bg },
  sheetBody: { flex: 1, padding: 16, gap: 8 },
  lastCard: { backgroundColor: C.accent, borderRadius: 10, padding: 16, marginTop: 8 },
  lastText: { color: '#fff', fontWeight: '800', textAlign: 'center' },
});
