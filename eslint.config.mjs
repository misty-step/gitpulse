import nextPlugin from 'eslint-config-next';

export default [
  {
    ignores: [
      '.next/**',
      '.convex/**',
      'convex/_generated/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      '*.config.*',
      '*.tsbuildinfo',
    ],
  },
  ...nextPlugin,
];
