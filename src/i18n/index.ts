/**
 * i18n + RTL bootstrap.
 *
 * Deliberately mirrors the production pattern under test:
 *   - init synchronously with a fallback so t() never crashes during first render
 *   - do NOT decide direction at import time (the stored language is async)
 *   - decide direction once, after the real language resolves
 *   - reload the bundle when the direction actually flipped, guarded against loops
 *
 * The open question this exists to answer (T12): can `reloadAppAsync()` from the
 * core `expo` package apply an RTL flip WITHOUT `expo-updates` installed?
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en';
import he from './locales/he';
import ru from './locales/ru';
import ar from './locales/ar';
export type { Dict } from './locales';

export const RTL_LANGUAGES = ['he', 'ar'] as const;
export const SUPPORTED = ['en', 'he', 'ru', 'ar'] as const;
export type Lang = (typeof SUPPORTED)[number];

const LANG_KEY = 'test-rtl.language';
const GUARD_KEY = 'test-rtl.rtlRestartGuard';

export const isRTLLanguage = (code: string) =>
  (RTL_LANGUAGES as readonly string[]).includes(code);

// Enable RTL, but do NOT force a direction here — the stored language is not
// known yet. Forcing from the fallback causes "English text in RTL layout".
I18nManager.allowRTL(true);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he },
    ru: { translation: ru },
    ar: { translation: ar },
  },
  lng: 'he',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;

export async function getStoredLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

export async function saveLanguage(lang: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore — test app
  }
}

async function getGuard(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUARD_KEY)) === '1';
  } catch {
    return false;
  }
}

async function setGuard(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(GUARD_KEY, v ? '1' : '0');
  } catch {
    // ignore
  }
}

/** Diagnostics rendered on the Language screen so results are observable on-device. */
export type BootstrapInfo = {
  storedLanguage: string | null;
  resolvedLanguage: string;
  isRTLBefore: boolean;
  shouldBeRTL: boolean;
  flagFlipped: boolean;
  guardWasSet: boolean;
  needsRestart: boolean;
};

/**
 * Apply the persisted language and align the native RTL flag with it.
 * Returns diagnostics plus whether the caller must reload before mounting.
 */
export async function bootstrapLanguage(): Promise<BootstrapInfo> {
  const isRTLBefore = I18nManager.isRTL;
  const stored = await getStoredLanguage();
  const resolved =
    stored && (SUPPORTED as readonly string[]).includes(stored) ? stored : i18n.language;

  if (resolved !== i18n.language) {
    await i18n.changeLanguage(resolved);
  }

  const shouldBeRTL = isRTLLanguage(resolved);
  const guardWasSet = await getGuard();
  let flagFlipped = false;
  let needsRestart = false;

  if (I18nManager.isRTL !== shouldBeRTL && Platform.OS !== 'web') {
    I18nManager.forceRTL(shouldBeRTL);
    flagFlipped = true;

    // forceRTL does not re-lay-out the running JS context. Reload once —
    // but never loop if the reload fails to apply the flag.
    if (!guardWasSet) {
      await setGuard(true);
      needsRestart = true;
    }
  } else {
    await setGuard(false);
  }

  return {
    storedLanguage: stored,
    resolvedLanguage: resolved,
    isRTLBefore,
    shouldBeRTL,
    flagFlipped,
    guardWasSet,
    needsRestart,
  };
}
