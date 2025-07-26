# 手動ファイル管理機能実装計画

## 概要

既存の小説ファイルを段階的にDialogoi管理対象に追加する機能を実装する。
自動一括取り込みではなく、ユーザが個別・選択的に管理対象を追加できる仕組みを提供。

**重要**: 現在の`ProjectCreationService`は実装されているが実際には使用されていない。
実際のプロジェクト作成は`DialogoiYamlService.createDialogoiProjectAsync`が使用され、これは`dialogoi.yaml`のみを作成する。

## ユースケース

### 基本フロー
1. **新規プロジェクト作成**: dialogoi.yaml生成のみ（現在実装済み）
2. **段階的ファイル取り込み**: ユーザが個別に管理対象を追加
   - 管理対象外ファイルの可視化
   - 個別ファイル・ディレクトリの追加
   - 一括追加オプション
3. **Dialogoi利用開始**: 管理対象となったファイルでの作業

### 想定される実用シナリオ

#### シナリオ1: 小規模プロジェクト（手動選択）
- 数十ファイル程度
- ユーザが重要なファイルのみを選択的に管理対象に追加
- 一時ファイルや草稿は意図的に管理対象外のまま維持

#### シナリオ2: 大規模プロジェクト（一括+除外）
- 数百〜数千ファイル
- ディレクトリ単位での一括追加
- 除外パターンによる自動フィルタリング
- その後の個別微調整

#### シナリオ3: 段階的移行
- 既存の複雑なディレクトリ構造
- 重要なディレクトリから順次移行
- 各段階での動作確認後に次のディレクトリを追加

## ファイル状態の分類

TreeViewでは以下の3つの状態のファイル・ディレクトリを表示：

### 1. 管理対象ファイル（正常）
- `.dialogoi-meta.yaml`に記載 + 実際に存在
- **表示**: 通常のアイコン・色
- **操作**: 開く、編集、削除等すべて可能

### 2. 管理対象外ファイル（未追加）
- `.dialogoi-meta.yaml`に未記載 + 実際に存在
- **表示**: グレーアウト、専用アイコン
- **操作**: 「管理対象に追加」、プレビュー等

### 3. 欠損ファイル（エラー状態）
- `.dialogoi-meta.yaml`に記載 + 実際には不存在
- **表示**: 赤字、取り消し線、エラーアイコン
- **操作**: 
  - 「ファイルを作成」
  - 「管理対象から削除」（.dialogoi-meta.yamlから除去）

## 実装計画

### Phase A: TreeView拡張（ファイル状態可視化）

#### A1: DialogoiTreeDataProviderの拡張
- **目標**: 3つの状態すべてのファイルを表示
- **実装内容**:
  - 実際のファイルシステムと`.dialogoi-meta.yaml`の内容を比較
  - ファイル状態（managed/untracked/missing）の判定ロジック
  - 状態別のTreeItemを生成

#### A2: 視覚表現の実装
- **目標**: 状態が一目で分かる表示
- **実装内容**:
  - 管理対象外: `$(file-submodule)` アイコン + グレー色
  - 欠損ファイル: `$(error)` アイコン + 赤字 + 取り消し線
  - ツールチップで状態説明

#### A3: パフォーマンス最適化
- **目標**: 大量ファイルでも快適な動作
- **実装内容**:
  - ファイル状態のキャッシング
  - 差分更新による再描画最適化

### Phase B: 基本操作機能

#### B1: 個別ファイル追加機能
- **目標**: 管理対象外ファイルを個別に追加
- **実装内容**:
  - 右クリックメニュー「Dialogoi管理対象に追加」
  - ファイル種別選択ダイアログ（content/setting）
  - `.dialogoi-meta.yaml`への自動追記
  - TreeView自動更新

#### B2: 欠損ファイル対応機能
- **目標**: 欠損ファイルの解決
- **実装内容**:
  - 右クリックメニュー「ファイルを作成」
  - 右クリックメニュー「管理対象から削除」
  - 作成時のテンプレート選択（本文/設定用）

### Phase C: 高度な機能

#### C1: ディレクトリ一括追加
- **目標**: ディレクトリ内ファイルの一括管理
- **実装内容**:
  - ディレクトリ右クリック「内容を一括追加」
  - ファイル種別の一括指定UI
  - プレビュー機能（追加されるファイル一覧）
  - 除外パターン適用

#### C2: ディレクトリ管理ファイル自動生成
- **目標**: Dialogoi管理要件の自動満足
- **実装内容**:
  - 親の`.dialogoi-meta.yaml`に追加時、子ディレクトリの管理ファイル生成
  - `.dialogoi-meta.yaml`のテンプレート生成
  - `README.md`の自動生成
  - 既存ファイル上書き確認

## 技術実装詳細

### 1. ファイル状態判定ロジック

```typescript
enum FileStatus {
  Managed,     // meta.yamlに記載 + 存在
  Untracked,   // meta.yamlに未記載 + 存在  
  Missing      // meta.yamlに記載 + 不存在
}

interface FileStatusInfo {
  status: FileStatus;
  metaEntry?: MetaFileEntry;  // meta.yamlのエントリ
  fsEntry?: FileSystemEntry;  // 実際のファイル
}
```

### 2. TreeDataProvider改修点

```typescript
class DialogoiTreeDataProvider {
  // 新規メソッド
  private async getFileStatusMap(dirPath: string): Promise<Map<string, FileStatusInfo>>
  private createTreeItemForStatus(name: string, status: FileStatusInfo): vscode.TreeItem
  
  // 既存メソッド改修
  getChildren() // 3状態すべてのファイルを返すよう変更
}
```

### 3. コマンド実装

```typescript
// 新規コマンド
- dialogoi.addFileToManagement
- dialogoi.addDirectoryToManagement  
- dialogoi.createMissingFile
- dialogoi.removeMissingFile
- dialogoi.bulkAddDirectory
```

### 4. 新規サービス

```typescript
class FileManagementService {
  addFileToManagement(filePath: string, type: 'content' | 'setting'): Promise<boolean>
  removeFileFromManagement(filePath: string): Promise<boolean>
  createMissingFile(filePath: string, template?: string): Promise<boolean>
  bulkAddDirectory(dirPath: string, options: BulkAddOptions): Promise<BulkAddResult>
}
```

## 実装順序

### Sprint 1: 基盤整備（A1-A2）
1. ファイル状態判定ロジックの実装
2. TreeDataProviderの拡張
3. 基本的な視覚表現

### Sprint 2: 基本操作（A3, B1-B2）
1. パフォーマンス最適化
2. 個別ファイル追加機能
3. 欠損ファイル対応機能

### Sprint 3: 高度機能（C1-C2）
1. ディレクトリ一括追加
2. 自動生成機能
3. UI/UX最適化

## 成功指標

### 機能面
- [ ] 3つの状態すべてのファイルが適切に表示される
- [ ] 管理対象外ファイルを個別追加できる
- [ ] 欠損ファイルを解決できる
- [ ] ディレクトリ一括追加が動作する

### パフォーマンス面
- [ ] 100ファイル以下: 1秒以内でTreeView更新
- [ ] 1000ファイル以下: 3秒以内でTreeView更新

### UX面
- [ ] ファイル状態が直感的に理解できる
- [ ] 誤操作を防ぐ適切な確認ダイアログ
- [ ] 操作後の状態変化が即座に反映される

## リスク管理

### 技術リスク
- **大量ファイル時のパフォーマンス**: キャッシング・遅延読み込みで対策
- **ファイル状態の不整合**: 定期的な状態検証機能で対策

### UXリスク  
- **操作の複雑化**: 段階的機能公開・適切なデフォルト値で対策
- **視覚情報の過多**: 必要最小限の情報表示・設定での切り替えで対策

## 要検討事項・設計上の課題

### 1. ファイル種別の自動判定改善

#### 現在の判定ロジック
```typescript
// ProjectCreationService内
if (extension === '.md') return 'content';
else if (extension === '.txt') return 'setting';
else return 'setting'; // デフォルト
```

#### 改善案
- **ディレクトリ名による判定**: 
  - `characters/` → すべてsetting（ただしcharacterメタデータ付与）
  - `contents/`, `chapters/` → すべてcontent
  - `settings/`, `world/` → すべてsetting
- **ファイル名パターン判定**:
  - `*_setting.md`, `world_*.md` → setting
  - `chapter*.md`, `episode*.md` → content
- **ユーザー選択の尊重**: 自動判定を上書き可能なUI

#### 議論点
- デフォルトの拡張子判定で十分か？
- ディレクトリ名による判定を採用するか？
- 判定ルールのカスタマイズ機能は必要か？

### 2. 除外パターンとの連携

#### 現在の除外パターン（デフォルト）
```yaml
exclude_patterns:
  - ".*"                 # 隠しファイル・ディレクトリ
  - ".DS_Store"          # macOS システムファイル
  - "*.tmp"              # 一時ファイル
  - "node_modules"       # Node.js 依存関係
  # など18パターン
```

#### 連携機能案
1. **除外ファイルの非表示**: TreeViewに表示しない（シンプル）
2. **除外ファイル表示トグル**: 「除外ファイル表示」設定での切り替え
3. **除外状態の視覚化**: 除外ファイルも表示するが異なる見た目

#### 議論点
- 除外ファイルをTreeViewに表示するべきか？
- 表示する場合、どのような視覚的区別をするか？
- ユーザーが除外パターンを一時的に無視する機能は必要か？

### 3. ディレクトリ管理要件の自動満足

Dialogoi管理対象ディレクトリの3要件：
1. 親ディレクトリの`.dialogoi-meta.yaml`に登録
2. ディレクトリ内に`.dialogoi-meta.yaml`が存在
3. ディレクトリ内にREADMEファイルが存在

#### 自動生成機能案
```typescript
interface DirectoryAutoSetupOptions {
  createMetaYaml: boolean;      // .dialogoi-meta.yamlの自動生成
  createReadme: boolean;        // READMEファイルの自動生成
  overwriteExisting: boolean;   // 既存ファイルの上書き許可
  readmeTemplate: 'minimal' | 'detailed' | 'custom';
}
```

#### 議論点
- 自動生成はデフォルトで有効にするか？
- 既存ファイルがある場合の上書き確認方法は？
- READMEテンプレートのバリエーションは何が必要か？
- ユーザーがカスタムテンプレートを設定できるべきか？

### 4. 一括操作の詳細仕様

#### ディレクトリ一括追加の選択肢
1. **種別統一**: すべてのファイルを同じ種別（content/setting）として追加
2. **拡張子ベース**: 拡張子による自動判定を適用
3. **ディレクトリベース**: ディレクトリ名による判定を適用
4. **個別確認**: ファイルごとに種別確認ダイアログを表示

#### プレビュー機能
- 追加されるファイル一覧表示
- 自動判定された種別の表示
- 除外されるファイルの表示
- 推定される処理時間の表示

#### 議論点
- どの選択肢をデフォルトにするか？
- プレビュー機能はどの程度詳細にするか？
- 大量ファイル（1000個以上）での性能問題対策は？

### 5. ProjectCreationServiceの扱い

#### 現状
- 高機能だが実際には使用されていない
- 既存ファイルスキャン・自動判定ロジックが含まれている
- テストは存在する

#### 選択肢
1. **完全削除**: コードを削除し、新機能で置き換え
2. **部分的活用**: 有用な部分（自動判定ロジックなど）のみ抽出
3. **統合**: 新機能に既存ロジックを統合
4. **共存**: 手動追加機能と自動一括機能の両方を提供

#### 議論点
- 既存のテストコードを維持するか？
- 自動一括機能への需要はあるか？
- コードの複雑性 vs 機能の豊富さのバランスは？

### 6. パフォーマンス設計

#### 懸念される場面
- 大量ファイル（1000個以上）でのTreeView表示
- ディレクトリ一括追加での処理時間
- リアルタイムでのファイル状態更新

#### 対策案
1. **遅延読み込み**: 可視範囲のファイルのみ先に表示
2. **バックグラウンド処理**: 一括操作の非同期実行
3. **プログレス表示**: 長時間処理の進捗表示
4. **キャンセル機能**: 長時間処理の中断機能

#### 議論点
- 許容可能な処理時間の基準は？
- UIの応答性 vs 機能の完全性のバランスは？
- エラー時のロールバック機能は必要か？

### 7. ユーザビリティ設計

#### 誤操作防止
- 一括削除の確認ダイアログ
- 重要ファイルの誤削除警告
- 操作のUNDO機能

#### 学習コストの軽減
- ツールチップでの操作ガイド
- 初回使用時のウォークスルー
- 段階的機能公開（基本→高度な機能）

#### 議論点
- どの操作に確認ダイアログを表示するか？
- UNDO機能の実装範囲は？
- 新規ユーザー向けのガイド機能は必要か？

## 次のステップ

### 即座に実装可能（技術的にクリア）
1. **FileStatusService**: ファイル状態判定ロジック
2. **TreeDataProvider基本拡張**: 3状態ファイルの表示
3. **基本的な視覚表現**: アイコン・色の差別化

### 設計検討が必要
1. **除外パターン連携方針**: 表示/非表示の仕様
2. **ファイル種別判定改善**: 自動判定ルールの詳細
3. **ProjectCreationService扱い**: 削除/活用/統合の決定

### ユーザビリティテストが必要
1. **一括追加のUI流れ**: プレビュー→確認→実行の流れ
2. **エラー状態の対処方法**: 欠損ファイルの解決手順
3. **パフォーマンス基準**: 許容可能な処理時間の検証

### 実装順序（推奨）
1. **Phase A1-A2**: 基本的なファイル状態表示（議論不要部分）
2. **設計検討セッション**: 上記の要検討事項の決定
3. **Phase A3-B2**: 検討結果を反映した実装
4. **ユーザビリティテスト**: 実際の使用感の検証
5. **Phase C1-C2**: 高度機能の実装

## 実装進捗

### ✅ 完了済み（2025-01-26）

#### A1: 基盤整備
- [x] **FileStatusService実装**: ファイル状態判定ロジック完成
  - 3つの状態（Managed/Untracked/Missing）の判定
  - `.dialogoi-meta.yaml`と実際のファイルシステムの比較
  - 除外パターンとの連携基盤
  - DialogoiTreeItemとの変換機能

- [x] **DIコンテナ統合**: FileStatusServiceの依存関係解決
  - ServiceContainer、TestServiceContainer両方に対応
  - MetaYamlService、FileRepositoryとの依存関係設定
  - テスト環境での利用準備完了

### ✅ 完了済み（2025-01-26）

#### A2: TreeDataProvider拡張
- [x] **`DialogoiTreeDataProvider.loadMetaYaml`をFileStatusService使用に変更**: 完了
  - FileStatusServiceによる3状態ファイル検出
  - 除外パターンとの連携（選択肢A: 表示しない）
  - DialogoiYamlServiceからの除外パターン取得機能追加
- [x] **3状態すべてのファイルを表示するロジック実装**: 完了
  - 管理対象（Managed）、未追跡（Untracked）、欠損（Missing）の統合表示
  - ファイル状態に基づくTreeItem変換
- [x] **既存のキャッシング機能との統合**: 完了
  - 既存のキャッシュメカニズムを維持
  - ファイル状態情報を含む詳細ログ出力

#### A3: 視覚表現実装
- [x] **ファイル状態別のアイコン・色設定**: 完了
  - 欠損ファイル: エラーアイコン + 赤色 + "(存在しません)" 表示
  - 未追跡ファイル: file-submodule アイコン + グレー色 + "(管理対象外)" 表示
  - 管理対象ファイル: 従来のアイコン表示
- [x] **ファイル状態別のコンテキストメニュー対応**: 完了
  - `dialogoi-file-missing`, `dialogoi-file-untracked` コンテキスト値設定
  - 将来的な右クリックメニュー拡張に対応
- [x] **DialogoiTreeItem拡張**: 完了
  - `isUntracked`, `isMissing` フラグ追加
  - FileStatusServiceとの連携強化

#### A4: テスト作成と品質保証
- [x] **FileStatusService単体テスト**: 19テストケースで全機能をカバー
  - `getFileStatusList()`: 10テスト（状態判定、除外処理、ソート等）
  - `statusInfoToTreeItem()`: 4テスト（TreeItem変換）
  - `isExcluded()`: 5テスト（除外パターンマッチング）
- [x] **レガシーテスト修正**: review_count → comments フィールド移行対応
  - MetaYamlService、MetaYamlUtilsテストの古いアサーション修正
- [x] **コード品質**: TypeScript strict mode + ESLint max-warnings 0 準拠

### ✅ 完了済み（2025-01-26）

#### B1: 個別ファイル追加機能 
**目標**: 管理対象外ファイルを個別に管理対象に追加
- [x] **右クリックメニュー「Dialogoi管理対象に追加」**: 完了
  - 管理対象外ファイル（viewItem=dialogoi-file-untracked）に専用メニュー追加
  - FileManagementService.addFileToManagement()で処理
- [x] **ファイル種別選択ダイアログ（content/setting）**: 完了
  - vscode.window.showQuickPickによる直感的な選択UI
  - 各種別の説明付き（content=本文ファイル(.txt)、setting=設定ファイル(.md)）
- [x] **`.dialogoi-meta.yaml`への自動追記**: 完了
  - MetaYamlServiceとの連携で安全な更新処理
  - 既存エントリとの重複チェック付き
- [x] **TreeView自動更新**: 完了
  - 処理成功時のtreeDataProvider.refresh()による即座の反映

#### B2: 欠損ファイル対応機能  
**目標**: 欠損ファイルの解決
- [x] **右クリックメニュー「ファイルを作成」**: 完了
  - 欠損ファイル（viewItem=dialogoi-file-missing）に専用メニュー追加
  - FileManagementService.createMissingFile()で処理
  - 作成後の自動ファイルオープン機能付き
- [x] **右クリックメニュー「管理対象から削除」**: 完了
  - 同じく欠損ファイルに「管理対象から削除」メニュー追加
  - FileManagementService.removeFileFromManagement()で処理
- [x] **作成時のテンプレート選択（本文/設定用）**: 完了
  - 拡張子別デフォルトテンプレート（.md, .txt, その他）
  - カスタムテンプレート対応（generateDefaultContent()メソッド）
- [x] **ファイル削除時の確認ダイアログ**: 完了
  - vscode.window.showWarningMessage()によるモーダル確認
  - 「ファイル自体は削除されません」の説明付き

#### B3: テスト・品質保証
- [x] **FileManagementService単体テスト**: 15テストケースで全機能をカバー
  - `addFileToManagement()`: 5テスト（正常追加、エラーケース等）
  - `removeFileFromManagement()`: 3テスト（正常削除、エラーケース等）
  - `createMissingFile()`: 5テスト（作成、テンプレート、エラーケース等）
  - エラーハンドリング: 2テスト（無効パス処理等）
- [x] **DIコンテナ統合**: ServiceContainer、TestServiceContainer両対応
  - FileManagementServiceの依存関係解決（FileRepository + MetaYamlService）
- [x] **コード品質**: TypeScript strict mode + ESLint max-warnings 0 準拠

### ✅ 完了済み（2025-01-27）

#### B4: 実機テスト・制限事項の確認
- [x] **ディレクトリの管理対象外表示**: 完了
  - `untracked_directory` がグレーアウト表示で正常に動作確認
  - `type: 'subdirectory'` + `isUntracked: true` による適切な分類
  - 除外パターン `'.*'` による隠しファイル・ディレクトリの非表示確認
- [x] **現在の制限事項の明確化**: 完了
  - ディレクトリ自体の管理対象追加: 未対応（Phase C1で実装予定）
  - 管理対象外ディレクトリ内ファイルの追加: エラー（親ディレクトリ未管理のため）
  - 手動回避手順の文書化完了

### 🔄 次のステップ（Phase C: 高度な機能）

#### C1: ディレクトリ一括追加
**目標**: ディレクトリ内ファイルの一括管理
- [ ] ディレクトリ右クリック「内容を一括追加」
- [ ] ファイル種別の一括指定UI
- [ ] プレビュー機能（追加されるファイル一覧）
- [ ] 除外パターン適用

#### C2: ディレクトリ管理ファイル自動生成
**目標**: Dialogoi管理要件の自動満足
- [ ] 親の`.dialogoi-meta.yaml`に追加時、子ディレクトリの管理ファイル生成
- [ ] `.dialogoi-meta.yaml`のテンプレート生成
- [ ] `README.md`の自動生成
- [ ] 既存ファイル上書き確認

### 📋 Phase B技術実装詳細（完了済み）

#### 新規コマンド（実装完了）
```typescript
- dialogoi.addFileToManagement     // 管理対象外ファイルを追加
- dialogoi.createMissingFile       // 欠損ファイルを作成  
- dialogoi.removeMissingFile       // 欠損ファイルを管理対象から削除
```

#### 新規サービス（実装完了）
```typescript
class FileManagementService {
  addFileToManagement(filePath: string, type: 'content' | 'setting'): Promise<FileManagementResult>
  removeFileFromManagement(filePath: string): Promise<FileManagementResult>
  createMissingFile(filePath: string, template?: string): Promise<FileManagementResult>
}

interface FileManagementResult {
  success: boolean;
  message: string;
  error?: Error;
}
```

#### package.jsonメニュー拡張（実装完了）
```json
"menus": {
  "view/item/context": [
    {
      "when": "view == dialogoi-explorer && viewItem == dialogoi-file-untracked",
      "command": "dialogoi.addFileToManagement",
      "group": "10_management"
    },
    {
      "when": "view == dialogoi-explorer && viewItem == dialogoi-file-missing", 
      "command": "dialogoi.createMissingFile",
      "group": "10_management"
    },
    {
      "when": "view == dialogoi-explorer && viewItem == dialogoi-file-missing",
      "command": "dialogoi.removeMissingFile", 
      "group": "10_management"
    }
  ]
}
```

### 📝 実装メモ

#### FileStatusService設計判断
```typescript
// 採用したアプローチ
interface FileStatusInfo {
  name: string;
  absolutePath: string;
  status: FileStatus;
  metaEntry?: DialogoiTreeItem;    // 管理対象の場合のメタ情報
  isDirectory?: boolean;           // 実在ファイルの種別
}
```

**判断理由**:
- TreeDataProviderとの互換性を保持
- 既存のDialogiTreeItem構造を活用
- パフォーマンスを考慮した最小限の情報取得

#### TreeDataProvider統合の設計決定

**除外パターン連携**: 選択肢A（表示しない）を採用
```typescript
// DialogoiYamlService.getExcludePatternsAsync() 新規追加
const excludePatterns = await dialogoiYamlService.getExcludePatternsAsync(this.novelRoot);
const filteredStatusList = statusList.filter(statusInfo => {
  return !fileStatusService.isExcluded(statusInfo.name, excludePatterns);
});
```

**視覚表現**: VSCode ThemeIconとThemeColorを活用
```typescript
// 欠損ファイル
item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
// 未追跡ファイル  
item.iconPath = new vscode.ThemeIcon('file-submodule', new vscode.ThemeColor('disabledForeground'));
```

**DialogoiTreeItem拡張**: 最小限のフラグ追加
- `isUntracked?: boolean` - 未追跡ファイルの識別
- `isMissing?: boolean` - 欠損ファイルの識別

#### 除外パターン処理
- 現時点では基本的なマッチング実装（`.*`, `*.tmp`等）
- 将来的にminimatachライブラリ等への移行を検討

#### パフォーマンス考慮事項
- 既存のキャッシュメカニズム（1秒間）を維持
- ファイル状態判定の追加処理時間は最小限
- 詳細なログ出力で状態別ファイル数を確認可能

### 🤔 実装検討事項

#### 1. 除外ファイルの表示方針（✅ 決定済み）
**採用**: 選択肢A（除外ファイルを表示しない）
- シンプルで分かりやすいUI
- パフォーマンスが良好
- 必要に応じて将来的に表示切り替え機能を追加可能

```typescript
// 実装済み: loadMetaYaml内で除外ファイルをフィルタリング  
const filteredStatusList = statusList.filter(statusInfo => {
  return !fileStatusService.isExcluded(statusInfo.name, excludePatterns);
});
```

#### 2. パフォーマンス最適化のタイミング
現在の実装は基本的なキャッシングのみ。大量ファイル対応は必要に応じて後から追加：

- 1000ファイル以下: 現在の実装で十分
- 1000ファイル以上: 遅延読み込み、仮想化等を検討

#### 3. エラーハンドリング戦略
FileStatusServiceでのファイルアクセスエラー処理：

```typescript
// 現在の実装：警告ログ出力のみ
catch (error) {
  console.warn(`ディレクトリ読み込みエラー: ${directoryPath}`, error);
}

// 検討中：ユーザーへのエラー表示
// 但しTreeView更新頻度が高いため、過度な通知は避ける
```