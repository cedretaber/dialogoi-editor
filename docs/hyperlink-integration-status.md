# ハイパーリンク統合機能 - 実装状況と今後の作業

## 完了済みの作業（Phase 1-5）

### ✅ Phase 1: WebView参照操作の完全実装
- FileDetailsViewProviderの機能完成
- 参照ファイルを開く機能（相対パス→絶対パス変換）
- WebViewからExtensionへのメッセージング

### ✅ Phase 2: プロジェクトルート相対パス基盤の構築
- ProjectLinkUpdateServiceの統合
- ファイル移動・改名時の自動リンク更新
- ServiceContainerの拡張（novelRootAbsolutePath対応）

### ✅ Phase 3: 本文ファイルの表示改善
- 「登場人物」と「関連設定」への分類表示
- CharacterServiceによるファイル種別判定
- TreeViewツールチップの改善

### ✅ Phase 4: ハイパーリンク抽出システム
- FilePathMapService実装（プロジェクト内ファイルマップ管理）
- HyperlinkExtractorService実装（マークダウンリンク抽出）
- ServiceContainer/TestServiceContainerへの統合

### ✅ Phase 5: リアルタイム更新とUI改善
- ReferenceManagerへのハイパーリンク統合
  - ReferenceEntry構造（source: 'manual' | 'hyperlink'）
  - updateFileHyperlinkReferences、updateFileAllReferencesメソッド
- ファイル保存時の自動更新（onDidSaveTextDocument）
- UI改善（🔗アイコンによる視覚的区別）
- WebViewアーキテクチャ問題の調査（docs/webview-refactoring-plan.md）

## 現在の状態

### 技術的課題
1. **WebViewアーキテクチャの問題**
   - FileDetailsViewProviderでHTMLが文字列として埋め込まれている（1000行超）
   - WebView内のJavaScriptからTypeScriptクラスへアクセスできない
   - メンテナンス性・テスタビリティが低い

2. **一時的な対応**
   - updateFileDetailsメソッドで参照データを事前取得
   - postMessageでreferenceDataとして渡す
   - WebView側では渡されたデータを使用（ReferenceManager直接アクセスは不可）

### テストの状態
- 276個のテストが全て成功
- npm run check-all が全て通過
- ReferenceManagerテストは新しいReferenceEntry構造に対応済み
- TreeViewFilterServiceテストも修正済み

## 今後の作業

### Phase 6: ドラッグ&ドロップ機能（未実装）
- TreeViewからエディタへのドラッグ&ドロップ
- 本文ファイル：referencesに自動追加
- 設定ファイル：カーソル位置にハイパーリンク挿入

### WebViewリファクタリング（推奨）
docs/webview-refactoring-plan.md に従って：
1. HTML/CSS/JSの分離
2. TypeScript化とテスト追加
3. Reactの導入（将来的）

## 再開時の注意点

### 1. プロジェクト構造の確認
```bash
# 依存関係のインストール
npm install

# 全体チェック
npm run check-all
```

### 2. 主要ファイルの場所
- ReferenceManager: `src/services/ReferenceManager.ts`
- FileDetailsViewProvider: `src/views/FileDetailsViewProvider.ts`
- HyperlinkExtractorService: `src/services/HyperlinkExtractorService.ts`
- FilePathMapService: `src/services/FilePathMapService.ts`

### 3. 未解決の課題
- WebView内でのキャラクター判定（現在はパス名での暫定判定）
- CharacterServiceをWebViewで使用できない問題
- 大規模プロジェクトでのパフォーマンステスト未実施

### 4. git status
```
M .claude/settings.json
M docs/ROADMAP.md
M examples/sample-novel/contents/.dialogoi-meta.yaml
M src/commands/characterCommands.ts
M src/commands/foreshadowingCommands.ts
M src/di/ServiceContainer.ts
M src/di/TestServiceContainer.ts
M src/extension.ts
M src/services/CharacterService.test.ts
M src/services/CharacterService.ts
M src/services/FileOperationService.ts
M src/services/ReferenceManager.test.ts
M src/services/ReferenceManager.ts
M src/services/TreeViewFilterService.ts
M src/tree/DialogoiTreeDataProvider.ts
M src/views/FileDetailsViewProvider.ts
?? docs/hyperlink-integration-plan-v2.md
?? docs/hyperlink-integration-plan.md
?? docs/hyperlink-integration-status.md
?? docs/project-root-path-investigation.md
?? docs/webview-refactoring-plan.md
?? src/services/FilePathMapService.test.ts
?? src/services/FilePathMapService.ts
?? src/services/HyperlinkExtractorService.test.ts
?? src/services/HyperlinkExtractorService.ts
?? src/services/ProjectLinkUpdateService.test.ts
?? src/services/ProjectLinkUpdateService.ts
?? src/services/ProjectPathNormalizationService.test.ts
?? src/services/ProjectPathNormalizationService.ts
```

## 推奨される次のステップ

1. **WebViewリファクタリング**を先に実施
   - HTML/CSS/JSの分離で保守性向上
   - TypeScript化で型安全性確保
   - テスト可能な構造への移行

2. **Phase 6のドラッグ&ドロップ機能**
   - WebViewリファクタリング後の方が実装しやすい
   - より洗練されたUI/UXを提供可能

3. **パフォーマンス最適化**
   - 大規模プロジェクトでの動作検証
   - 必要に応じてインクリメンタル更新の実装