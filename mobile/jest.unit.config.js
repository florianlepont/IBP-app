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
    '^react-native-svg$': '<rootDir>/test/react-native-svg.mock.ts',
    '\\.(png|jpg|jpeg|gif|webp)$': '<rootDir>/test/image.mock.ts',
  },
  globals: {
    __DEV__: true,
  },
};
