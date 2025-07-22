# React コンポーネントテスト実装計画

## 📋 概要

技術的負債の解消として、現在テストが存在しないReactコンポーネント（10個）に対して包括的なテストを実装する。
既存のMochaベースのテストフレームワークとの一貫性を保ちながら、モダンなReactテストプラクティスを適用する。

## 🎯 目的

### 主な目的
- **技術的負債の解消**: テスト未実装のReactコンポーネントのテストカバレッジを確保
- **回帰防止**: UI変更時の予期しない動作変更を検出
- **品質保証**: ユーザーインタラクションの正確性を保証
- **保守性向上**: リファクタリング時の安全性確保

### 期待される効果
- バグの早期発見
- コードの信頼性向上
- 開発速度の向上（手動テスト時間の削減）
- 新規開発者のオンボーディング支援

## 📊 現状分析

### 対象コンポーネント（10個）

| コンポーネント | 優先度 | 複雑度 | 主な機能 |
|---------------|--------|--------|----------|
| TagSection.tsx | 高 | 低 | タグ追加・削除、重複チェック |
| BasicInfoSection.tsx | 高 | 低 | ファイル情報表示 |
| ReviewSection.tsx | 高 | 中 | レビュー情報表示 |
| CharacterSection.tsx | 高 | 中 | キャラクター設定表示・操作 |
| ReferenceSection.tsx | 高 | 中 | 参照関係表示・操作 |
| ForeshadowingSection.tsx | 高 | 高 | 伏線管理（植込み・回収位置） |
| FileDetailsApp.tsx | 中 | 高 | 全セクションの統合・VSCode通信 |
| ProjectSettingsApp.tsx | 中 | 高 | プロジェクト設定編集フォーム |
| index.tsx | 低 | 低 | エントリーポイント |
| projectSettings.tsx | 低 | 低 | エントリーポイント |

### 既存テスト構成
- **テストフレームワーク**: Mocha + TDD スタイル
- **既存テスト数**: 346件（全てサーバーサイド）
- **成功率**: 100%
- **テスト実行時間**: ~215ms

## 🛠️ 技術選択

### テストスタック

```typescript
// 選択されたライブラリスタック
{
  "テストフレームワーク": "Mocha (既存)",
  "DOM環境": "Happy-DOM (軽量・高速)",
  "テストライブラリ": "@testing-library/react (ユーザー重視)",
  "アサーション": "Node.js assert (既存と統一)",
  "ユーザーイベント": "@testing-library/user-event",
  "追加matcher": "@testing-library/jest-dom"
}
```

### 選択理由
1. **Mocha継続**: 既存346テストとの一貫性
2. **Happy-DOM**: JSROMより軽量で高速
3. **Testing Library**: ユーザーインタラクション重視のベストプラクティス
4. **TDDスタイル**: 既存テストコードとの統一感

## 🚀 実装フェーズ

### Phase 1: テスト基盤構築 🔧
**期間**: 1-2日  
**目標**: テスト環境の構築と基本テストの動作確認

#### 1.1 依存関係追加
```bash
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  happy-dom
```

#### 1.2 テスト環境設定
- [ ] `webview/test-setup.ts` 作成（Happy-DOM + VSCode API mock）
- [ ] `webview/test-utils.tsx` 作成（カスタムレンダー関数）
- [ ] package.jsonスクリプト追加（test:react, test:all）
- [ ] check-allスクリプトの更新

#### 1.3 基本テスト実装
- [ ] TagSection.test.tsx 作成（最もシンプルなコンポーネント）
- [ ] 基本的な表示テスト
- [ ] ユーザーインタラクションテスト
- [ ] テスト実行確認

#### 1.4 成功基準
- [ ] npm run test:react が正常実行される
- [ ] TagSectionの基本機能がテストされている
- [ ] CI/CDパイプライン（check-all）が成功する

---

### Phase 2: 主要コンポーネント実装 ⭐
**期間**: 3-4日  
**目標**: 頻繁に使用される中核コンポーネントのテスト完成

#### 2.1 BasicInfoSection.test.tsx
- [ ] ファイル情報の表示確認
- [ ] 条件付きレンダリングテスト
- [ ] エッジケース（空データ）

#### 2.2 ReviewSection.test.tsx  
- [ ] レビュー数表示の確認
- [ ] 複数レビュー種別の処理
- [ ] データなし時の表示

#### 2.3 CharacterSection.test.tsx
- [ ] キャラクター情報表示
- [ ] 重要度表示の確認
- [ ] 複数キャラクターフラグの表示
- [ ] 削除ボタンのインタラクション

#### 2.4 ReferenceSection.test.tsx
- [ ] 参照・被参照リストの表示
- [ ] 参照開く・削除アクション
- [ ] 空状態の表示

#### 2.5 成功基準
- [ ] 4つの主要コンポーネントのテストが完了
- [ ] ユーザーインタラクションが正しくテストされている
- [ ] エラーケースも含めた網羅的テスト

---

### Phase 3: 複雑なコンポーネント実装 🔥
**期間**: 4-5日  
**目標**: 高度な機能を持つコンポーネントの完全テスト

#### 3.1 ForeshadowingSection.test.tsx
- [ ] 植込み位置の追加・編集・削除
- [ ] 回収位置の設定・編集・削除
- [ ] フォーム表示・非表示切り替え
- [ ] バリデーションチェック
- [ ] 折りたたみ機能
- [ ] エラーハンドリング

#### 3.2 FileDetailsApp.test.tsx
- [ ] コンポーネント統合テスト
- [ ] VSCode API通信のモック
- [ ] 条件付きセクション表示
- [ ] ファイル選択状態の管理
- [ ] エラー状態の表示

#### 3.3 ProjectSettingsApp.test.tsx
- [ ] フォーム入力・編集
- [ ] バリデーション表示
- [ ] 自動保存機能
- [ ] エラーメッセージ表示
- [ ] タグ・除外パターン管理

#### 3.4 統合テスト
- [ ] コンポーネント間の連携テスト
- [ ] イベントバブリング確認
- [ ] パフォーマンステスト（大量データ）

#### 3.5 成功基準
- [ ] 全10コンポーネントのテストが完成
- [ ] エッジケースを含む網羅的カバレッジ
- [ ] 統合シナリオでの動作確認

---

## 📋 実装方針

### テストパターン

#### 1. 基本表示テスト
```typescript
test('コンポーネントが正しく表示される', () => {
  render(<Component {...props} />);
  assert(screen.getByText('期待されるテキスト'));
});
```

#### 2. ユーザーインタラクションテスト
```typescript
test('ボタンクリックでイベントが発火される', () => {
  const mockHandler = sinon.spy();
  render(<Component onAction={mockHandler} />);
  fireEvent.click(screen.getByRole('button'));
  assert(mockHandler.calledOnce);
});
```

#### 3. 条件付きレンダリングテスト
```typescript
test('データがある場合とない場合の表示切り替え', () => {
  const { rerender } = render(<Component data={[]} />);
  assert(screen.getByText('データがありません'));
  
  rerender(<Component data={['item1']} />);
  assert(screen.getByText('item1'));
});
```

### VSCode API モック戦略

```typescript
// test-setup.ts
(global as any).acquireVsCodeApi = () => ({
  postMessage: sinon.spy(),
  setState: sinon.spy(),
  getState: sinon.stub().returns({}),
});
```

### ファイル命名規則
- テストファイル: `ComponentName.test.tsx`
- 配置場所: コンポーネントと同じディレクトリ
- テストスイート名: `ComponentName コンポーネント`

## 🔧 開発環境設定

### package.json更新
```json
{
  "scripts": {
    "test:react": "NODE_ENV=test mocha --import=tsx --ui tdd \"webview/**/*.test.tsx\" --require webview/test-setup.ts",
    "test:all": "npm run test && npm run test:react",
    "check-all": "npm run typecheck && npm run lint && npm run format:check && npm run test:all && npm run webview:build"
  }
}
```

### テスト実行コマンド
```bash
# React コンポーネントテストのみ
npm run test:react

# 全テスト実行
npm run test:all

# 特定ファイルのテスト
npm run test:react -- --grep "TagSection"

# ウォッチモード（開発時）
npm run test:react -- --watch
```

## ✅ 品質基準

### テストカバレッジ目標
- **行カバレッジ**: 90%以上
- **分岐カバレッジ**: 85%以上
- **機能カバレッジ**: 100%（全公開関数）

### テスト品質チェック項目
- [ ] ユーザーの視点でテストが書かれている
- [ ] 実装詳細ではなく動作をテストしている  
- [ ] エッジケースとエラーケースを網羅している
- [ ] テストケース名が明確で理解しやすい
- [ ] テストが独立しており、順序に依存しない
- [ ] モックは必要最小限に留められている

### パフォーマンス目標
- [ ] 全Reactテスト実行時間: 5秒以内
- [ ] 個別コンポーネントテスト: 500ms以内
- [ ] メモリ使用量の適切な管理

## 📝 ドキュメント更新

### 更新が必要なファイル
- [ ] `docs/ROADMAP.md` - Phase 3.5bの進捗更新
- [ ] `CLAUDE.md` - テスト実行コマンドの追加
- [ ] `package.json` - scripts セクションの更新
- [ ] `.github/workflows/` - CI設定（将来的）

## 🚨 リスクと対策

### 技術的リスク

| リスク | 影響度 | 対策 |
|-------|--------|------|
| VSCode API mock の複雑性 | 中 | 段階的実装、最小限のモック |
| Happy-DOM 互換性問題 | 低 | JSDOM への切り替え準備 |
| テスト実行時間の増加 | 低 | 並列実行、効率的なセットアップ |
| 既存テストとの競合 | 低 | 別スクリプトでの実行 |

### プロジェクト進行リスク

| リスク | 影響度 | 対策 |
|-------|--------|------|
| 他機能開発との並行作業 | 中 | 小さなPRでの段階的マージ |
| テスト保守コスト増加 | 低 | シンプルで保守しやすいテスト設計 |

## 📈 成功指標

### 短期目標（各フェーズ完了時）
- [x] **Phase 1**: 基盤構築とTagSectionテスト完了 ✅ **2025-01-21完了**
- [x] **Phase 2**: 主要4コンポーネントのテスト完了 ✅ **2025-01-22完了**
- [x] **Phase 3.1**: ForeshadowingSectionテスト完了 ✅ **2025-01-22完了**
- [ ] **Phase 3.2-3.3**: 統合コンポーネントのテスト完了

## 🎉 Phase 1 実装結果 (2025-01-21)

### 技術スタック確定
- **DOMシミュレーション**: Happy-DOM + `@happy-dom/global-registrator`
- **Reactテスト**: React Testing Library + Mocha (TDDスタイル)
- **アサーション**: Node.js標準の`assert`モジュール
- **型安全性**: TypeScript strict modeでエラー0件

### テスト実装結果
- **TagSection.test.tsx**: 20テストケースで包括的カバー
  - 基本表示 (4テスト)
  - 展開・折りたたみ機能 (2テスト)
  - タグ追加機能 (6テスト)
  - 重複チェック機能 (2テスト)
  - タグ削除機能 (2テスト)
  - プロパティの型チェック (2テスト)
  - キーボードイベント (2テスト)

### CI統合結果
- **サーバサイドテスト**: 346件通過
- **Reactコンポーネントテスト**: 20件通過
- **合計**: 366件のテストが成功
- **`npm run check-all`**: TypeScript型チェック、ESLint、Prettier、テスト、WebViewビルドすべて成功

### VSCode APIモック実装
- `acquireVsCodeApi()` の型安全なモック実装
- postMessage, setState, getState メソッドのモック
- グローバル型定義でTypeScriptエラー解決

### ファイル構成
- `webview/test-setup.ts`: テスト環境のグローバル設定
- `webview/test-utils.tsx`: React Testing Libraryのカスタムラッパー
- `webview/components/TagSection.test.tsx`: 包括的テストケース

## 🎉 Phase 2-3.1 実装結果 (2025-01-22)

### 実装完了コンポーネント
- **BasicInfoSection.test.tsx**: 16テストケース
  - 基本表示、展開・折りたたみ、異なるファイル種別、エッジケース、アクセシビリティ
- **ReviewSection.test.tsx**: 18テストケース
  - レビュー統計表示、件数計算ロジック、エッジケース処理
- **CharacterSection.test.tsx**: 26テストケース
  - キャラクター情報表示、重要度種別、複数キャラクター、削除機能
- **ReferenceSection.test.tsx**: 24テストケース
  - 参照関係管理、キャラクター/設定分類、手動/ハイパーリンク参照
  - 重要なバグ修正：isExpandedステート共有問題を解決
- **ForeshadowingSection.test.tsx**: 27テストケース
  - 植込み位置CRUD、回収位置管理、フォーム状態、エッジケース

### 技術的改善点
1. **OOMキラー問題の解決**
   - ReferenceSection.tsxの空参照時の処理バグを修正
   - test-setup.tsからメモリ削減設定を削除（不要だった）
   
2. **型定義の改善**
   - ForeshadowingData型のplants/payoffをオプショナルに変更
   - より柔軟なデータ構造をサポート

3. **テスト品質の向上**
   - TDD原則の遵守：実装を修正してテストを通す（逆ではない）
   - 包括的なエッジケーステスト

### テスト実行結果
- **サーバサイドテスト**: 346件通過
- **Reactコンポーネントテスト**: 137件通過
- **合計**: 483件のテストが成功
- **実行時間**: サーバサイド ~210ms、React ~636ms

### 長期目標（実装完了後）
- [x] CI/CDパイプラインでのReactテスト自動実行 ✅
- [ ] コードレビュー時のテスト品質チェック
- [ ] 新機能開発時のテストファーストアプローチ
- [x] 開発者の信頼性向上（手動テスト時間削減） ✅

---

## 🎯 次のステップ

1. **Phase 3.2-3.3の実装**（オプション）
   - FileDetailsApp.test.tsx: 統合テスト
   - ProjectSettingsApp.test.tsx: フォーム管理テスト
2. **テスト保守性の継続的改善**
3. **新機能開発時のテストファーストアプローチ確立**

---

**注**: この実装計画は段階的な実行を前提としており、各フェーズ完了時に進捗確認とフィードバックを行います。必要に応じて計画の調整を行い、品質と実装速度のバランスを取ります。