import next from 'eslint-config-next';

/**
 * ESLint flat config.
 *
 * `eslint-config-next` v16 ships a flat config array directly, so no
 * `FlatCompat` shim is needed.
 */
const config = [
  {
    ignores: ['.next/**', 'database/generated/**', 'node_modules/**', 'storage/**'],
  },
  ...next,
];

export default config;
