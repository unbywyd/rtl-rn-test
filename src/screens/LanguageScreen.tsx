/**
 * T11 / T12 — Language switching and the reload question.
 *
 * T11: a same-direction switch (he -> ar) must NOT restart.
 * T12: a direction-flipping switch (he -> en) must apply the new direction.
 *
 * ⭐ The decisive question: this project does NOT install expo-updates. If the
 * direction applies after `reloadAppAsync()` from the core `expo` package, then
 * the guide's claim that expo-updates is MANDATORY is wrong.
 *
 * Everything needed to judge that is rendered on-screen so a screenshot is
 * sufficient evidence.
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View, StyleSheet, Pressable, I18nManager, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Section, Row, Chip, Expect, Mono, C } from '../ui/kit';
import { SUPPORTED, isRTLLanguage, saveLanguage, type Lang } from '../i18n';
import { probeReloadStrategies, reloadApp, type ReloadStrategy } from '../lib/reload';

const LAST_ACTION_KEY = 'test-rtl.lastAction';

type LastAction = {
  from: string;
  to: string;
  directionChanged: boolean;
  isRTLAtSwitch: boolean;
  strategy: ReloadStrategy | 'not-reloaded' | 'live-direction';
  at: string;
};

export default function LanguageScreen({
  bootstrapInfo,
  liveDir,
  onToggleLiveDir,
}: {
  bootstrapInfo: string;
  liveDir: boolean;
  onToggleLiveDir: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [lastAction, setLastAction] = useState<LastAction | null>(null);
  const strategies = probeReloadStrategies();

  useEffect(() => {
    AsyncStorage.getItem(LAST_ACTION_KEY).then((raw) => {
      if (raw) {
        try {
          setLastAction(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const switchTo = async (target: Lang) => {
    const current = i18n.language;
    if (target === current) return;

    const directionChanged = isRTLLanguage(current) !== isRTLLanguage(target);

    // Persist BEFORE reloading — code after reloadAppAsync may never run.
    await saveLanguage(target);
    await i18n.changeLanguage(target);

    const action: LastAction = {
      from: current,
      to: target,
      directionChanged,
      isRTLAtSwitch: I18nManager.isRTL,
      strategy: 'not-reloaded',
      at: new Date().toISOString().slice(11, 19),
    };

    if (!directionChanged) {
      // T11: same direction — must NOT reload.
      await AsyncStorage.setItem(LAST_ACTION_KEY, JSON.stringify(action));
      setLastAction(action);
      return;
    }

    if (liveDir) {
      // T28: direction comes from app state via the `direction` prop (R22).
      // No forceRTL, no reload — the language change alone re-renders the
      // content island with the new direction. The whole point of the
      // experiment is that nothing else is needed.
      action.strategy = 'live-direction';
      await AsyncStorage.setItem(LAST_ACTION_KEY, JSON.stringify(action));
      setLastAction(action);
      return;
    }

    // T12: direction flipped. Set the native flag, record what we did, reload.
    I18nManager.forceRTL(isRTLLanguage(target));
    action.strategy = 'pending' as ReloadStrategy;
    await AsyncStorage.setItem(LAST_ACTION_KEY, JSON.stringify(action));

    const used = await reloadApp('rtl-direction-change');
    // Only reached if the reload silently failed.
    action.strategy = used;
    await AsyncStorage.setItem(LAST_ACTION_KEY, JSON.stringify(action));
    setLastAction(action);
  };

  const langIsRTL = isRTLLanguage(i18n.language);
  const inSync = langIsRTL === I18nManager.isRTL;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.h1}>T11/T12 · {t('screens.language')}</Text>

      <Section title="Live state" hint="The direction flag must match the language.">
        <Row>
          <Chip label={`lang: ${i18n.language}`} />
          <Chip label={`isRTL: ${String(I18nManager.isRTL)}`} />
          <Chip
            label={inSync ? 'IN SYNC' : 'MISMATCH'}
            tone={inSync ? 'good' : 'bad'}
          />
        </Row>
        <Mono>platform={Platform.OS} · expo-updates NOT installed</Mono>
        <Expect text="MISMATCH does NOT mean the layout is wrong — check the layout itself." />
        <Expect text="Measured: layout mirrors correctly while this flag reads false (R1)." />
      </Section>

      <Section
        title="⭐ T28 · Live direction from app state (R22)"
        hint="direction: dir on the content island, derived from the language. No forceRTL, no reload."
      >
        <Row>
          <Pressable
            onPress={() => onToggleLiveDir(!liveDir)}
            style={[st.btn, liveDir && st.btnActive]}
          >
            <Text style={[st.btnText, liveDir && st.btnTextActive]}>
              {liveDir ? 'LIVE DIRECTION: ON' : 'LIVE DIRECTION: OFF'}
            </Text>
          </Pressable>
        </Row>
        <Mono>
          island dir={liveDir ? (langIsRTL ? 'rtl' : 'ltr') : 'native (flag)'} · isRTL=
          {String(I18nManager.isRTL)}
        </Mono>
        <Expect text="ON: switching he↔en must flip EVERY tab instantly, with no reload and isRTL unchanged." />
        <Expect text="The chrome (header/tab bar) is deliberately outside the island and must NOT flip." />
        <Expect text="isRTL-keyed code (T2 blocks 2-4, T5 ternaries) must STILL be wrong — direction does not fix the flag." />
      </Section>

      <Section title="Switch language" hint="he→ar: no restart. he→en: direction flip + reload.">
        <View style={st.grid}>
          {SUPPORTED.map((l) => {
            const active = l === i18n.language;
            const flips = isRTLLanguage(l) !== langIsRTL;
            return (
              <Pressable
                key={l}
                onPress={() => switchTo(l)}
                style={[st.btn, active && st.btnActive]}
              >
                <Text style={[st.btnText, active && st.btnTextActive]}>
                  {l.toUpperCase()}
                </Text>
                <Text style={st.btnSub}>
                  {isRTLLanguage(l) ? 'RTL' : 'LTR'}
                  {flips ? ' · flips' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section
        title="⭐ T12 · Reload strategies available"
        hint="expo-updates is deliberately NOT installed in this project."
      >
        {strategies.map((s) => (
          <Row key={s.strategy}>
            <Chip label={s.strategy} tone={s.available ? 'good' : 'bad'} />
            <Text style={st.small}>{s.available ? 'available' : 'unavailable'}</Text>
          </Row>
        ))}
        <Expect text="If reloadAppAsync is available AND the flip applies, guide correction C1 is proven." />
      </Section>

      <Section title="Last switch (survives reload)" hint="Read this right after the app comes back.">
        {lastAction ? (
          <>
            <Mono>
              {lastAction.from} → {lastAction.to} at {lastAction.at}
            </Mono>
            <Mono>directionChanged={String(lastAction.directionChanged)}</Mono>
            <Mono>isRTL at switch={String(lastAction.isRTLAtSwitch)}</Mono>
            <Mono>isRTL now={String(I18nManager.isRTL)}</Mono>
            <Mono>strategy={lastAction.strategy}</Mono>
            <Expect text="If 'isRTL now' matches the new language, the reload applied the flip." />
          </>
        ) : (
          <Text style={st.small}>No switch recorded yet.</Text>
        )}
      </Section>

      <Section title="Bootstrap diagnostics (this launch)" hint="Captured before the tree mounted.">
        <Mono>{bootstrapInfo}</Mono>
      </Section>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 14, paddingBottom: 48, gap: 6 },
  h1: { fontSize: 20, fontWeight: '800', color: C.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    minWidth: 78,
  },
  btnActive: { backgroundColor: C.accent, borderColor: C.accent },
  btnText: { fontSize: 14, fontWeight: '700', color: C.text },
  btnTextActive: { color: '#fff' },
  btnSub: { fontSize: 10, color: C.dim },
  small: { fontSize: 12, color: C.dim },
});
