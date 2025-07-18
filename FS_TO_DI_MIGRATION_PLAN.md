# fs → FileOperationService DI 移行計画

## 目的
VSCodeのファイル操作を抽象化し、テスタビリティを向上させるため、直接的なfs使用をFileOperationServiceのDIパターンに移行する。

## 現在の進捗状況

### ✅ 完了済み

1. **抽象化レイヤーの作成**
   - `src/interfaces/Uri.ts` - VSCodeのUri型を抽象化
   - `src/interfaces/FileOperationService.ts` - ファイル操作の抽象クラス
   - `src/services/VSCodeFileOperationService.ts` - VSCode実装
   - `src/services/MockFileOperationService.ts` - テスト用モック実装
   - `src/di/ServiceContainer.ts` - DIコンテナ

2. **サービスクラスの修正**
   - `src/services/CharacterService.ts` - staticメソッドからインスタンスメソッドに変更、DIでFileOperationServiceを受け取る
   - `src/services/ForeshadowingService.ts` - 同様にインスタンスメソッドに変更
   - `src/services/ReferenceManager.ts` - initializeメソッドでFileOperationServiceを受け取るよう修正
   - `src/utils/MetaYamlUtils.ts` - 静的メソッドにoptional FileOperationServiceパラメータを追加

3. **テストの修正開始**
   - `src/services/CharacterService.test.ts` - MockFileOperationServiceを使用するよう修正済み

### 🔄 進行中

4. **テストファイルの修正**
   - `src/services/CharacterService.test.ts` ✅ 完了
   - `src/services/ForeshadowingService.test.ts` ⏳ 次に実行
   - `src/services/FileOperationService.test.ts` ⏳ 実装の変更に合わせて修正が必要
   - `src/services/ReferenceManager.test.ts` ⏳ MockFileOperationServiceを使用するよう修正が必要

### 📋 未完了

5. **コマンドファイルの修正**
   - `src/commands/characterCommands.ts` - ServiceContainerを使用してサービスを取得
   - `src/commands/foreshadowingCommands.ts` - 同様にServiceContainerを使用
   - その他のコマンドファイル

6. **TreeDataProviderの修正**
   - `src/tree/DialogoiTreeDataProvider.ts` - ServiceContainerを使用してサービスを取得

7. **ExtensionのMain関数の修正**
   - `src/extension.ts` - ServiceContainerの初期化

## 詳細な作業計画

### Phase 1: 残りのテストファイル修正

#### 1.1 ForeshadowingService.test.ts
- MockFileOperationServiceを使用するよう修正
- ForeshadowingServiceをインスタンス化
- ファイル操作をモック経由で実行

#### 1.2 FileOperationService.test.ts
- VSCodeFileOperationServiceの具象実装をテスト
- 実際のファイル操作ではなく、モック経由でのテスト
- または、VSCodeFileOperationServiceの統合テストとして残す

#### 1.3 ReferenceManager.test.ts
- MockFileOperationServiceを使用
- initializeメソッドでFileOperationServiceを渡す
- ファイル存在チェック等をモック経由で実行

### Phase 2: コマンドファイルの修正

#### 2.1 characterCommands.ts
```typescript
// 修正前
const result = FileOperationService.setCharacterImportance(dirPath, fileName, importance);

// 修正後
const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
const result = fileOperationService.setCharacterImportance(dirPath, fileName, importance);
```

#### 2.2 foreshadowingCommands.ts
```typescript
// 修正前
const isValidStart = ForeshadowingService.validatePath(novelRoot, start);

// 修正後
const foreshadowingService = ServiceContainer.getInstance().getForeshadowingService();
const isValidStart = foreshadowingService.validatePath(novelRoot, start);
```

### Phase 3: TreeDataProviderの修正

#### 3.1 DialogoiTreeDataProvider.ts
- ServiceContainerからサービスを取得
- 静的メソッド呼び出しをインスタンスメソッド呼び出しに変更
- 例：
```typescript
// 修正前
const displayName = CharacterService.extractDisplayName(fileAbsolutePath);

// 修正後
const characterService = ServiceContainer.getInstance().getCharacterService();
const displayName = characterService.extractDisplayName(fileAbsolutePath);
```

### Phase 4: Extension初期化の修正

#### 4.1 extension.ts
- ServiceContainerの初期化を追加
- VSCode環境でのFileOperationServiceの設定

### Phase 5: 最終調整とテスト

#### 5.1 統合テストの実行
- 全てのテストが通ることを確認
- TypeScriptコンパイルエラーの解決

#### 5.2 コードレビューと最適化
- 不要なコードの削除
- 型安全性の向上
- パフォーマンスの確認

## 修正が必要なファイル一覧

### 🔥 優先度：高（エラーの原因）
1. `src/commands/characterCommands.ts`
2. `src/commands/foreshadowingCommands.ts`
3. `src/tree/DialogoiTreeDataProvider.ts`
4. `src/services/ForeshadowingService.test.ts`
5. `src/services/FileOperationService.test.ts`
6. `src/services/ReferenceManager.test.ts`

### 🔸 優先度：中（テストとビルド）
1. `src/extension.ts`
2. その他のコマンドファイル
3. 残りのテストファイル

### 🔹 優先度：低（最適化）
1. `src/services/ReviewService.test.ts`
2. 型定義の最適化
3. パフォーマンスの改善

## 注意事項

1. **後方互換性**: MetaYamlUtils.tsでは一時的にfsのフォールバックを残している
2. **テスト分離**: MockFileOperationServiceを使用してテストを完全に分離
3. **DIの徹底**: ServiceContainerを通じてサービスを取得
4. **型安全性**: TypeScriptの型チェックを活用してエラーを防止

## 次のステップ

1. `src/services/ForeshadowingService.test.ts`の修正から再開
2. エラーが多いコマンドファイルとTreeDataProviderの修正
3. 統合テストの実行とエラー解決
4. コードレビューと最適化

## 完了の定義

- [ ] すべてのTypeScriptコンパイルエラーが解決
- [ ] すべてのテストが通る
- [ ] ESLintエラーが0件
- [ ] VSCode拡張機能が正常に動作する
- [ ] ファイル操作がVSCodeFileOperationServiceまたはMockFileOperationServiceを通じて実行される