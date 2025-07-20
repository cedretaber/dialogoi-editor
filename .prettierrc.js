module.exports = {
  // デフォルト設定（src/用）
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  
  // ディレクトリ別設定
  overrides: [
    {
      // WebView用設定
      files: ['webview/**/*.{ts,tsx,js,jsx}'],
      options: {
        semi: true,
        trailingComma: 'es5',
        singleQuote: true,
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        bracketSpacing: true,
        bracketSameLine: false,
        arrowParens: 'always',
        endOfLine: 'lf',
        jsxSingleQuote: true
      }
    }
  ]
};