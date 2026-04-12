import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: false }],
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/modules/**/index.ts',
    '!src/api/**/index.ts',
    '!src/infrastructure/**/index.ts',
    '!src/modules/*/**', // exclude module-level folder aggregates
    '!src/api/mobile/**',
    '!src/api/public/**',
  ],
  coverageDirectory: './coverage',
  coverageThreshold: {
    global: {
      branches: 74,
      functions: 86,
      lines: 86,
      statements: 86,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
