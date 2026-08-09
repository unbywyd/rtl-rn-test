/**
 * RTL test harness.
 *
 * The startup path deliberately mirrors the production pattern under test:
 *   1. i18n initializes synchronously with a fallback (t() never crashes).
 *   2. bootstrapLanguage() resolves the stored language and aligns the native
 *      RTL flag with it — the ONLY place direction is decided at startup.
 *   3. If the flag actually flipped, reload once before mounting the tree, so
 *      the user never sees a wrong-direction frame. Guarded against loops.
 *
 * Everything the tests need to judge is rendered on-screen (see LanguageScreen).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  I18nManager,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import './src/i18n';
import { bootstrapLanguage, type BootstrapInfo } from './src/i18n';
import { reloadApp } from './src/lib/reload';
import { C } from './src/ui/kit';

import BaselineScreen from './src/screens/BaselineScreen';
import DoubleFlipScreen from './src/screens/DoubleFlipScreen';
import TextAlignScreen from './src/screens/TextAlignScreen';
import InputsScreen from './src/screens/InputsScreen';
import NumbersScreen from './src/screens/NumbersScreen';
import LogicalPropsScreen from './src/screens/LogicalPropsScreen';
import DirectionScreen from './src/screens/DirectionScreen';
import ShadowsScreen from './src/screens/ShadowsScreen';
import LanguageScreen from './src/screens/LanguageScreen';

type TabKey =
  | 'baseline'
  | 'doubleFlip'
  | 'textAlign'
  | 'inputs'
  | 'numbers'
  | 'logical'
  | 'direction'
  | 'shadows'
  | 'language';

const TABS: { key: TabKey; short: string }[] = [
  { key: 'doubleFlip', short: 'T2 Flip' },
  { key: 'textAlign', short: 'T3 Text' },
  { key: 'language', short: 'T12 Lang' },
  { key: 'baseline', short: 'T1 Base' },
  { key: 'inputs', short: 'T5 Input' },
  { key: 'numbers', short: 'T7 Num' },
  { key: 'logical', short: 'T8 Logic' },
  { key: 'direction', short: 'T10 Dir' },
  { key: 'shadows', short: 'T14 Shadow' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>('doubleFlip');
  const [info, setInfo] = useState<BootstrapInfo | null>(null);

  const boot = useCallback(async () => {
    const result = await bootstrapLanguage();
    setInfo(result);

    if (result.needsRestart) {
      // Direction flipped. Reload before mounting so the first visible frame
      // is already correct. reload.ts defers ~250ms to dodge the documented
      // first-mount reload hazard (expo#10598 / expo#21347).
      await reloadApp('rtl-bootstrap');
      return;
    }
    setReady(true);
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  if (!ready) {
    return (
      <View style={st.splash}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={st.splashText}>Resolving language & direction…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar style="dark" />
      <Header />
      <TabBar tab={tab} setTab={setTab} />
      <View style={st.content}>
        {tab === 'baseline' && <BaselineScreen />}
        {tab === 'doubleFlip' && <DoubleFlipScreen />}
        {tab === 'textAlign' && <TextAlignScreen />}
        {tab === 'inputs' && <InputsScreen />}
        {tab === 'numbers' && <NumbersScreen />}
        {tab === 'logical' && <LogicalPropsScreen />}
        {tab === 'direction' && <DirectionScreen />}
        {tab === 'shadows' && <ShadowsScreen />}
        {tab === 'language' && (
          <LanguageScreen bootstrapInfo={JSON.stringify(info, null, 1)} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Header() {
  const { t, i18n } = useTranslation();
  return (
    <View style={st.header}>
      <Text style={st.title}>{t('appTitle')}</Text>
      <Text style={st.sub}>
        {Platform.OS} · {i18n.language} · isRTL={String(I18nManager.isRTL)}
      </Text>
    </View>
  );
}

function TabBar({ tab, setTab }: { tab: TabKey; setTab: (k: TabKey) => void }) {
  return (
    <View style={st.tabBarWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabBar}>
        {TABS.map((tb) => (
          <Pressable
            key={tb.key}
            onPress={() => setTab(tb.key)}
            style={[st.tab, tab === tb.key && st.tabActive]}
          >
            <Text style={[st.tabText, tab === tb.key && st.tabTextActive]}>{tb.short}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: C.bg },
  splashText: { fontSize: 13, color: C.dim },
  header: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 11, color: C.dim, marginTop: 2 },
  tabBarWrap: { borderBottomWidth: 1, borderBottomColor: C.border },
  tabBar: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: { backgroundColor: C.accent, borderColor: C.accent },
  tabText: { fontSize: 12, color: C.text },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  content: { flex: 1 },
});
