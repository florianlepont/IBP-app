module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  collectCoverageFrom: [
    '<rootDir>/App.tsx',
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.test.tsx',
  ],
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
  },
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/test/vector-icons.mock.ts',
    '^expo-sqlite$': '<rootDir>/test/expo-sqlite.mock.ts',
    '^expo-haptics$': '<rootDir>/test/expo-haptics.mock.ts',
    '^expo-crypto$': '<rootDir>/test/expo-crypto.mock.ts',
    '^expo-file-system/legacy$': '<rootDir>/test/expo-file-system-legacy.mock.ts',
    '^expo-image-manipulator$': '<rootDir>/test/expo-image-manipulator.mock.ts',
    '^expo-image$': '<rootDir>/test/expo-image.mock.ts',
    '^react-native-svg$': '<rootDir>/test/react-native-svg.mock.ts',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/test/image.mock.ts',
  },
  globals: {
    __DEV__: true,
  },
  // Ratchet (phase 01.3, D-09): floor of values measured on 2026-09-24. Raise these when
  // coverage improves; never lower them. Regenerate with node scripts/coverage-by-directory.js mobile.
  coverageThreshold: {
    global: { statements: 100, lines: 100 },
    './src/api/': { statements: 92, branches: 91, functions: 85, lines: 93 },
    './src/app/': { statements: 61, branches: 55, functions: 45, lines: 63 },
    './src/components/': { statements: 6, branches: 0, functions: 0, lines: 6 },
    './src/hooks/': { statements: 82, branches: 65, functions: 80, lines: 83 },
    './src/screens/': { statements: 9, branches: 3, functions: 6, lines: 9 },
    './src/storage/': { statements: 56, branches: 35, functions: 68, lines: 58 },
    './src/ui/': { statements: 29, branches: 28, functions: 21, lines: 30 },
  },
};
