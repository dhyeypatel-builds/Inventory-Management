import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: '<rootDir>/test/jsdom-environment.cjs',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}', '<rootDir>/test/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Interaction-heavy tests (radix-select + userEvent, full-app route renders)
  // are timing-sensitive. Give per-test headroom and cap workers so CPU
  // oversubscription doesn't push them past their async timeouts.
  testTimeout: 15000,
  maxWorkers: '50%',
  moduleNameMapper: {
    // Must precede the generic "@/" mapping so the Vite-only env module is
    // swapped for a Jest-safe stub (avoids `import.meta` in CommonJS).
    '^@/shared/api/env$': '<rootDir>/test/env-mock.ts',
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          allowImportingTsExtensions: false,
          verbatimModuleSyntax: false,
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
      },
    ],
  },
};

export default config;
