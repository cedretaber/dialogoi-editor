/** @type {import('jest').Config} */
module.exports = {
  // TypeScript対応
  preset: 'ts-jest',
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: [
    '<rootDir>/src/**/*.test.ts'
  ],

  // TypeScriptの設定
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'node',
        jsx: 'react-jsx'
      }
    }]
  },

  // ESMサポート
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // React Testing Library設定
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.ts',
    'webview/**/*.tsx',
    '!src/**/*.test.ts',
    '!webview/**/*.test.tsx',
    '!src/test/**',
    '!**/node_modules/**'
  ],

  // モジュール解決
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // テストタイムアウト
  testTimeout: 8000,

  // 並列実行
  maxWorkers: '50%',

  // Verbose出力
  verbose: false,

  // レポーター設定
  reporters: ['default']
};