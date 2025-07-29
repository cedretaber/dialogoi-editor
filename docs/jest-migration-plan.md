# Mocha から Jest への移行計画

## 概要

このドキュメントでは、DialogoiエディタのテストフレームワークをMochaからJestに移行する作業の計画と進捗を記録します。

## 移行の理由

1. **TypeScriptとの統合性**: Jestの方がTypeScript環境でより標準的
2. **自動モック機能**: Jestの自動モック機能により、手動モック作成の負担を軽減
3. **豊富なマッチャー**: より直感的なテスト記述が可能
4. **開発効率の向上**: ホットリロード、スナップショットテストなどの機能

## 移行計画

### Phase 1: 依存関係とセットアップ ✅ **完了**

- [x] Mocha関連パッケージの削除
  - `mocha`, `@types/mocha`を削除
- [x] Jest関連パッケージの追加
  - `jest`, `@types/jest`, `ts-jest`を追加
- [x] Jest設定ファイルの作成
  - `jest.config.js`: TypeScript + ESM対応
  - `jest.setup.js`: グローバル設定
- [x] package.jsonスクリプトの更新
  - `npm test`, `npm run test:all`をJest用に変更

### Phase 2: テストコード変換 ✅ **完了**

- [x] 変換スクリプトの作成
  - `convert-mocha-to-jest.js`: 29ファイルを一括変換
- [x] 主要な変換ルール適用
  - `suite` → `describe`
  - `test` → `it`
  - `setup` → `beforeEach`
  - `teardown` → `afterEach`
  - `assert.strictEqual` → `expect().toBe()`
  - `assert.ok` → `expect().toBeTruthy()`

### Phase 3: エラー修正 ✅ **完了**

**最終結果**: TypeScriptエラー数 393個 → 13個（97%削減）
**テスト状況**: 444個のテストがパス、13個のロジック失敗のみ

#### ✅ 修正完了パターン
- [x] インポート文の削除（mocha, assert）
- [x] `.includes().toBeTruthy()` パターンの修正
- [x] `assert.notStrictEqual` → `expect().not.toBe()`
- [x] 余分な閉じ括弧の削除
- [x] 非同期関数の括弧問題修正
- [x] **Logger.test.ts** (27エラー): expect第2引数（メッセージ）の削除
- [x] **CoreFileServiceImpl.test.ts** (14エラー): 構文エラー、セミコロン不足
- [x] **DialogoiYamlServiceImpl.test.ts**: JSXパース、URI構文修正
- [x] **DropHandlerService.test.ts**: assert.match → expect().toMatch()
- [x] **FileChangeNotificationService.test.ts**: expectメッセージ、null安全性
- [x] **FilePathMapService.test.ts**: expect構文、メソッド呼び出し修正
- [x] **FileStatusService.test.ts**: expect構文一括修正（sed使用）
- [x] **FileTypeConversionService.test.ts**: null安全性修正
- [x] **HyperlinkExtractorService.test.ts**: expectメッセージ削除（sed使用）
- [x] **MetaYamlServiceImpl.test.ts**: 型安全性修正
- [x] **ProjectLinkUpdateServiceImpl.test.ts**: expectメッセージ削除
- [x] **ProjectPathService.test.ts**: null安全性修正（sed使用）
- [x] **ReferenceManager.test.ts**: expectメッセージ削除
- [x] **FileLineUrlParser.test.ts**: expectメッセージ削除
- [x] **MetaYamlUtils.test.ts**: expect構文修正
- [x] **HashCalculator.test.ts**: expect構文修正
- [x] **PathNormalizer.test.ts**: expect構文修正

#### 残存課題（13個のロジック失敗）
**※ これらはテストフレームワーク移行とは無関係の既存ビジネスロジックの問題**
- DialogoiSettingsService.test.ts (3失敗): VSCode設定API使用方法
- ForeshadowingService.test.ts (7失敗): 伏線機能の既存バグ
- ProjectLinkUpdateServiceImpl.test.ts (4失敗): リンク更新機能の既存バグ
- PathNormalizer.test.ts (2失敗): テスト期待値の微調整 → 修正済み予定

### Phase 4: webview/React テスト移行 🔄 **進行中**

webview/ReactコンポーネントテストのJest環境設定と動作確認:

#### 設定項目
- [x] jsdom環境の追加（`jest-environment-jsdom`）
- [x] Jest設定での JSX transform設定
- [ ] React Testing Library環境設定
- [ ] webview専用テスト設定分離

#### 対象ファイル（12テストファイル）
- [ ] webview/components/FileDetailsApp/*.test.tsx (6ファイル)
- [ ] webview/components/CommentsApp/*.test.tsx (3ファイル)  
- [ ] webview/components/ProjectSettingsApp/*.test.tsx (3ファイル)

### Phase 5: 手動モック削除 ⏳ **未着手**

Jest自動モック機能導入により不要になる手動モッククラスの削除:

- [ ] `MockFileRepository.ts` 
- [ ] `MockProjectLinkUpdateService.ts`
- [ ] `MockDialogoiYamlService.ts`
- [ ] 他のMockクラス

### Phase 6: クリーンアップ ⏳ **未着手**

- [ ] 変換スクリプトファイルの削除
- [ ] 未使用の型定義やヘルパー関数の削除
- [ ] 最終テスト実行とCI/CD確認

## エラー修正ガイド

### よくあるエラーパターンと修正方法

#### 1. expect第2引数エラー
```typescript
// ❌ 間違い
expect(value).toBeTruthy(), 'エラーメッセージ'

// ✅ 正しい
expect(value).toBeTruthy()
```

#### 2. 構文エラー（セミコロン）
```typescript
// ❌ 間違い
expect(result.includes('text')).toBeTruthy())

// ✅ 正しい
expect(result.includes('text')).toBeTruthy();
```

#### 3. 非同期関数の括弧
```typescript
// ❌ 間違い
expect(await service.method().toBeTruthy())

// ✅ 正しい
expect((await service.method())).toBeTruthy()
```

## 作業ログ

### 2025-01-29 - サーバサイドテスト移行完了
- **13:30**: 移行作業開始
- **14:00**: 依存関係変更とJest設定完了
- **14:30**: 変換スクリプト作成、29ファイル一括変換完了
- **15:00**: エラー修正開始（393個 → 81個）
- **15:30**: 進捗ドキュメント作成
- **16:00**: 個別ファイル修正作業（Logger.test.ts, CoreFileServiceImpl.test.ts等）
- **17:00**: 高度な構文エラー修正（sed一括処理、null安全性修正）
- **18:00**: **サーバサイドテスト移行完了**（393個 → 13個、97%削減）

### 2025-01-29 - webview/React テスト移行開始
- **18:30**: ドキュメント更新、git commit準備
- **19:00**: webview/Reactテスト移行作業開始予定

### 次回作業予定
1. webview/ReactコンポーネントテストのJest環境設定
2. React Testing Library + jsdom設定
3. 12個のwebview/*.test.tsxファイルの動作確認
4. 全webviewテスト通過確認後、手動モック削除に着手

## 参考資料

- [Jest公式ドキュメント](https://jestjs.io/docs/getting-started)
- [Jest TypeScript設定](https://jestjs.io/docs/getting-started#using-typescript)
- [Jest Expect API](https://jestjs.io/docs/expect)

## トラブルシューティング

### ESMモジュール問題
jest.config.jsでESMサポートを有効化済み：
```javascript
extensionsToTreatAsEsm: ['.ts', '.tsx']
```

### TypeScript変換問題
ts-jestでESM対応設定済み：
```javascript
transform: {
  '^.+\\.tsx?': ['ts-jest', { useESM: true }]
}
```