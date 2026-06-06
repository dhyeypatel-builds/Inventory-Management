/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  clearMocks: true,
  verbose: true,
  // Integration tests share a single Postgres database and assert on global
  // invariants (sequential invoice numbers, dashboard aggregates). Run suites
  // serially so cross-suite sale activity can't interleave and make those
  // assertions — or teardown — non-deterministic.
  maxWorkers: 1,
};

module.exports = config;
