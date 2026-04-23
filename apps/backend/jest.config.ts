import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { diagnostics: false }],
  },
  collectCoverageFrom: [
    "src/**/*.(t|j)s",
    "!src/modules/**/index.ts",
    "!src/api/**/index.ts",
    "!src/infrastructure/**/index.ts",
    "!src/modules/*/**", // exclude module-level folder aggregates
    "!src/api/mobile/**",
    "!src/api/public/**",
  ],
  coverageDirectory: "./coverage",
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 91,
      lines: 90,
      statements: 90,
    },
  },
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@carekit/shared/constants/feature-keys$":
      "<rootDir>/src/__mocks__/@carekit/shared/constants/feature-keys.ts",
  },
};

export default config;
