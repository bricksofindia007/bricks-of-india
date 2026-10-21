// ESLint 9 flat config. Next 16 removed `next lint`, so lint runs `eslint src` directly.
// Next 16's eslint-config-next exports flat configs: core-web-vitals and typescript (same presets as before),
// plus the rule overrides from the previous .eslintrc.json.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

export default [
  { ignores: ['.next/**', '.open-next/**', 'node_modules/**', 'public/**'] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'react/no-unescaped-entities': 'off',
      // eslint-plugin-react-hooks v7 (new with eslint-config-next 16) flags two patterns the site uses on purpose:
      // set-state-in-effect: the "mounted" flag that avoids hydration mismatches (9 components);
      // purity: Date.now() in the review page render (the site's freshness copy). Warn for now; a rewrite is a separate change.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
];
