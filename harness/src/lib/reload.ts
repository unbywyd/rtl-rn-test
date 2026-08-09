/**
 * Reload strategies — the subject of test T12.
 *
 * The guide under revision claims `expo-updates` is MANDATORY for a JS-driven
 * RTL flip to apply. Research disputes this, pointing at `reloadAppAsync()`
 * re-exported from the core `expo` package. No source in the research corpus
 * demonstrates it actually applying an RTL flip, so we test it here.
 *
 * NOTE: this project deliberately does NOT install expo-updates. If the flip
 * works, the guide's "mandatory" wording is wrong.
 */

import { DevSettings, Platform } from 'react-native';

export type ReloadStrategy = 'expo-reloadAppAsync' | 'devsettings' | 'none';

export type ReloadAttempt = {
  strategy: ReloadStrategy;
  available: boolean;
  error?: string;
};

/** Probe which strategies exist in this build, without invoking them. */
export function probeReloadStrategies(): ReloadAttempt[] {
  const out: ReloadAttempt[] = [];

  try {
    // Re-exported from expo-modules-core. Documented to work in release AND debug.
    const expo = require('expo');
    out.push({
      strategy: 'expo-reloadAppAsync',
      available: typeof expo?.reloadAppAsync === 'function',
    });
  } catch (e) {
    out.push({
      strategy: 'expo-reloadAppAsync',
      available: false,
      error: String(e),
    });
  }

  out.push({
    strategy: 'devsettings',
    available: typeof DevSettings?.reload === 'function' && Platform.OS !== 'web',
  });

  return out;
}

/**
 * Reload the JS bundle. Prefers `reloadAppAsync` from `expo`.
 *
 * Deferred by ~250ms: calling a reload during first mount is a documented
 * crash/no-op hazard (expo#10598, expo#21347 — iOS crashes on first launch),
 * and the same fix is the accepted answer in react-native-restart#42, a thread
 * whose original complaint was forceRTL not applying on iOS.
 */
export async function reloadApp(reason: string): Promise<ReloadStrategy> {
  await new Promise((r) => setTimeout(r, 250));

  try {
    const expo = require('expo');
    if (typeof expo?.reloadAppAsync === 'function') {
      await expo.reloadAppAsync(reason);
      return 'expo-reloadAppAsync';
    }
  } catch {
    // fall through
  }

  try {
    if (typeof DevSettings?.reload === 'function') {
      DevSettings.reload(reason);
      return 'devsettings';
    }
  } catch {
    // fall through
  }

  return 'none';
}
