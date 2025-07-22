import eslint from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', '*.js', '*.mjs', '*.cjs']
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        ...globals.node,
        ...globals.mocha
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...typescriptEslint.configs['recommended-type-checked'].rules,
      '@typescript-eslint/no-unused-vars': ['error', {
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': true,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': 'error',
      'curly': 'error'
    }
  },
  // WebView用設定（React + TypeScript）
  {
    files: ['webview/**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './webview/tsconfig.json',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        acquireVsCodeApi: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...typescriptEslint.configs.recommended.rules,
      ...typescriptEslint.configs['recommended-type-checked'].rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      
      // TypeScript関連
      '@typescript-eslint/no-unused-vars': ['error', {
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': true,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
      
      // React関連
      'react/prop-types': 'off', // TypeScriptを使用するためprop-typesは不要
      'react/react-in-jsx-scope': 'off', // React 17+ automatic runtimeでは不要
      
      // 一般的なルール
      'no-console': 'warn',
      'eqeqeq': 'error',
      'curly': 'error'
    }
  }
];