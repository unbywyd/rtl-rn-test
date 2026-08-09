/**
 * Shared strings. Kept in one file so every language has provably the same keys.
 * Test strings are chosen to exercise bidi edge cases, not for realism.
 */

export type Dict = {
  appTitle: string;
  screens: Record<
    'baseline' | 'doubleFlip' | 'textAlign' | 'inputs' | 'numbers' | 'logical' | 'direction' | 'shadows' | 'language',
    string
  >;
  correct: string;
  wrong: string;
  label: string;
  placeholderName: string;
  placeholderPhone: string;
  placeholderEmail: string;
  currentLanguage: string;
  restartNeeded: string;
  sampleSentence: string;
};
