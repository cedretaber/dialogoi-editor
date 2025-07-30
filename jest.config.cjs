/** @type {import('jest').Config} */
module.exports = {
  // TypeScript対応
  preset: 'ts-jest',
  // デフォルト環境はNode
  testEnvironment: 'node',

  // テストファイルのパターン
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/webview/**/*.test.tsx'
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
  
  // webview用の環境設定上書き
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      testEnvironment: 'node',
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          useESM: true,
          tsconfig: {
            module: 'ESNext',
            moduleResolution: 'node'
          }
        }]
      },
    },
    {
      displayName: 'react',
      testMatch: ['<rootDir>/webview/**/*.test.tsx'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
      extensionsToTreatAsEsm: ['.ts', '.tsx'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
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
      transformIgnorePatterns: [
        '/node_modules/(?!(react-markdown|remark-gfm|bail|comma-separated-tokens|space-separated-tokens|property-information|hast-util-whitespace|remark-parse|remark-rehype|mdast-util-from-markdown|mdast-util-to-markdown|mdast-util-to-string|mdast-util-to-hast|unist-util-stringify-position|unist-util-position|unist-util-visit|unist-util-visit-parents|unist-util-is|vfile|vfile-message|micromark|micromark-util-.*|decode-named-character-reference|character-entities|unified|is-plain-obj|trough|rehype-raw)/)'
      ]
    }
  ],

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