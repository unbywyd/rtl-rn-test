/**
 * RTL lint config.
 *
 * The rules encode failures measured on real devices in this repo — see
 * RESULTS.md and SKILL_RULES.md. They are all silent bugs at runtime, so a
 * linter is the only place they get caught before shipping.
 *
 * Run: npm run lint:rtl
 *
 * NOTE: `src/screens/**` is deliberately exempt. Those screens *demonstrate*
 * the bugs on purpose — flagging them would be flagging the test fixtures.
 */

const rtl = require('./tools/eslint-plugin-rtl');

module.exports = [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      'tools/**',
      // The test screens render the wrong patterns on purpose — that is their job.
      'src/screens/**',
    ],
    languageOptions: {
      // TS/TSX needs a TypeScript-aware parser; the rules themselves are
      // plain-AST and work identically on JS.
      parser: require('@typescript-eslint/parser'),
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { rtl },
    rules: {
      'rtl/no-isrtl': 'error',
      'rtl/no-physical-styles': 'error',
      'rtl/no-dead-logical-props': 'error',
      'rtl/no-direction-ternary': 'error',
      'rtl/require-bidi-isolate': 'warn',
    },
  },
];
