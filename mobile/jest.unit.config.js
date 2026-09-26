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
    // supercluster 9 is ESM-only; ts-jest runs CommonJS, so load its UMD build (hoisted to the
    // root node_modules by 01.9-19). Metro resolves the ESM entry in the app.
    '^supercluster$': '<rootDir>/../node_modules/supercluster/dist/supercluster.js',
  },
  globals: {
    __DEV__: true,
  },
  // Ratchet (phase 01.3, D-09; raised in phases 01.5 and 01.9): floor of values measured on 2026-09-26. Raise these when
  // coverage improves; never lower them. Regenerate with node scripts/coverage-by-directory.js mobile.
  coverageThreshold: {
    global: { statements: 100, lines: 100 },
    // Mounted by src/state/render-counts.test.tsx (phase 01.9-01). Raised in 01.9-09 and confirmed
    // at the 01.9-31 gate: App.tsx is a thin shell, fully rendered by src/state/contexts.test.tsx.
    './App.tsx': { statements: 100, branches: 100, functions: 100, lines: 100 },
    // Contexts and assembler (01.9-09) and the French catalogue (01.9-05), at the measured floor (C-8).
    './src/state/': { statements: 96, branches: 75, functions: 90, lines: 97 },
    // Route components and navigation helpers (01.9-18), at the measured floor (C-8).
    './src/navigation/': { statements: 100, branches: 98, functions: 100, lines: 100 },
    // Branches measured after merging the wave-2 catalogue sections (plural and optional-name
    // ternaries such as `n === 1 ? ... : ...` are not all exercised yet).
    './src/i18n/': { statements: 100, branches: 73, functions: 100, lines: 100 },
    './src/api/': { statements: 95, branches: 97, functions: 91, lines: 95 },
    './src/app/': { statements: 86, branches: 73, functions: 93, lines: 91 },
    './src/components/': { statements: 22, branches: 11, functions: 10, lines: 22 },
    './src/hooks/': { statements: 90, branches: 78, functions: 94, lines: 90 },
    './src/screens/': { statements: 46, branches: 33, functions: 40, lines: 46 },
    './src/storage/': { statements: 92, branches: 81, functions: 91, lines: 94 },
    './src/ui/': { statements: 44, branches: 29, functions: 31, lines: 46 },
  },
};
