/**
 * Reliable direction source.
 *
 * WHY THIS EXISTS — measured, not theoretical:
 * On RN 0.86.2 Android, `I18nManager.isRTL` is a startup snapshot computed at
 * NATIVE MODULE CONSTRUCTION (`I18nManagerModule.kt:26`) and then cached in JS
 * at module load (`I18nManager.js`). It is never re-read. Verified on an
 * emulator (API 34, locales en-US and he-IL) and on a physical Galaxy S21 Ultra
 * (Android 15, locale ru-RU): the layout renders fully mirrored while
 * `I18nManager.isRTL === false`, on first launch AND after cold restarts, in
 * both debug and release builds.
 *
 * Consequences:
 *   - Gating LAYOUT on isRTL is not just redundant, it is unreliable — it can be
 *     wrong in the direction that yields LTR layout inside an RTL screen.
 *   - The LEGITIMATE exceptions (directional icons, TextInput.textAlign, index
 *     math) also cannot trust isRTL. They need a source that reflects what is
 *     actually rendered.
 *
 * The app's own language state is that source: the app decided the language, so
 * it knows the direction it asked for. Yoga honours the same decision via the
 * persisted native flag.
 */

import { I18nManager } from 'react-native';
import i18n from 'i18next';
import { isRTLLanguage } from '../i18n';

export type DirectionSource = 'language' | 'i18nManager';

/** Direction derived from the app's language — trustworthy. */
export function directionFromLanguage(): boolean {
  return isRTLLanguage(i18n.language);
}

/** Direction as reported by RN — may be a stale startup snapshot. */
export function directionFromI18nManager(): boolean {
  return I18nManager.isRTL;
}

export function resolveDirection(source: DirectionSource): boolean {
  return source === 'language' ? directionFromLanguage() : directionFromI18nManager();
}

/** True when the two sources disagree — the exact bug condition we measured. */
export function sourcesDisagree(): boolean {
  return directionFromLanguage() !== directionFromI18nManager();
}
