# Dialogoi メタデータ構造設計変更計画

このドキュメントは Dialogoi のメタデータ構造を `.dialogoi/` ディレクトリに集約する実装計画です。複数セッションを跨いで開発を行うため、このドキュメントを見れば作業内容が完全に把握できるよう記載しています。

## 1. 変更の概要

### 1.1 現状の問題点

現在のDialogoiは各ディレクトリに以下のファイルを配置しています：
- `.dialogoi-meta.yaml` - 各ディレクトリのメタデータ
- `.{filename}.comments.yaml` - 各ファイルのコメント

**問題点：**
- 隠しファイルがプロジェクト全体に散在し、管理が煩雑
- Dialogoi関連ファイルの一括削除・バックアップが困難
- ユーザーのコンテンツとメタデータが混在

### 1.2 新しい構造

すべてのDialogoi関連ファイルを `.dialogoi/` ディレクトリに集約します：

```
novel/
├── .dialogoi/                          # Dialogoi管理ディレクトリ
│   ├── dialogoi.yaml                   # プロジェクト設定
│   ├── dialogoi-meta.yaml              # ルートディレクトリのメタデータ
│   ├── contents/
│   │   ├── dialogoi-meta.yaml          # contents/のメタデータ
│   │   ├── .chapter1.txt.comments.yaml # コメントファイル
│   │   ├── .chapter2.txt.comments.yaml
│   │   └── otherstories/
│   │       └── dialogoi-meta.yaml
│   └── settings/
│       ├── dialogoi-meta.yaml
│       ├── .setting1.md.comments.yaml
│       ├── characters/
│       │   ├── dialogoi-meta.yaml
│       │   └── .character1.md.comments.yaml
│       └── foreshadowings/
│           └── dialogoi-meta.yaml
├── README.md
├── contents/                           # ユーザーのコンテンツ（クリーン）
│   ├── README.md
│   ├── chapter1.txt
│   ├── chapter2.txt
│   └── otherstories/
│       ├── a.txt
│       └── b.txt
└── settings/
    ├── setting1.md
    ├── characters/
    │   └── character1.md
    └── foreshadowings/
        └── foreshadowing1.md
```

## 2. 採用する実装方式

### 2.1 案3を採用：ディレクトリ構造の再現

**選定理由：**
1. 現在の分散型アーキテクチャを維持でき、実装変更が最小限
2. パス解決ロジックの変更のみで実現可能
3. パフォーマンス特性が変わらない（局所的な更新が可能）
4. 段階的な実装・テストが可能

### 2.2 実装の基本方針

- 既存のビジネスロジックは変更しない
- パス解決は新規サービスクラス（DialogoiPathService）で実装
- Repository層は純粋なファイル操作のみを担当
- 後方互換性は考慮しない（新規実装のみ対応）

## 3. 実装詳細

### 3.1 DialogoiPathService の設計

新規サービスクラス `DialogoiPathService` でDialogoi固有のパス変換を担当します。

#### クラス設計
```typescript
export class DialogoiPathService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * 実際のディレクトリパスから.dialogoi/内のメタデータパスを取得
   * @param targetPath プロジェクト内の実際のディレクトリパス
   * @return .dialogoi/内のメタデータファイルパス
   * 
   * 例：
   * - /project/contents → /project/.dialogoi/contents/dialogoi-meta.yaml
   * - /project → /project/.dialogoi/dialogoi-meta.yaml
   */
  resolveMetaPath(targetPath: string): string {
    const projectRoot = this.getProjectRoot();
    if (targetPath === projectRoot) {
      return path.join(projectRoot, '.dialogoi', 'dialogoi-meta.yaml');
    }
    const relativePath = path.relative(projectRoot, targetPath);
    return path.join(projectRoot, '.dialogoi', relativePath, 'dialogoi-meta.yaml');
  }

  /**
   * 実際のファイルパスから.dialogoi/内のコメントファイルパスを取得
   * @param filePath プロジェクト内の実際のファイルパス
   * @return .dialogoi/内のコメントファイルパス
   * 
   * 例：
   * - /project/contents/chapter1.txt → /project/.dialogoi/contents/.chapter1.txt.comments.yaml
   */
  resolveCommentPath(filePath: string): string {
    const projectRoot = this.getProjectRoot();
    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const relativeDir = path.relative(projectRoot, dir);
    
    if (relativeDir === '') {
      return path.join(projectRoot, '.dialogoi', `.${filename}.comments.yaml`);
    }
    return path.join(projectRoot, '.dialogoi', relativeDir, `.${filename}.comments.yaml`);
  }

  /**
   * .dialogoi/内の必要なディレクトリ構造を作成
   * @param targetPath 実際のディレクトリパス
   */
  async ensureDialogoiDirectory(targetPath: string): Promise<void> {
    const metaPath = this.resolveMetaPath(targetPath);
    const metaDir = path.dirname(metaPath);
    const metaDirUri = this.fileRepository.createDirectoryUri(metaDir);
    
    if (!(await this.fileRepository.existsAsync(metaDirUri))) {
      await this.fileRepository.createDirectoryAsync(metaDirUri);
    }
  }

  private getProjectRoot(): string {
    // VSCodeワークスペースの第1フォルダーを取得
    // 実装は既存の他サービスと同様のパターンを使用
  }
}
```

### 3.2 各サービスクラスでの利用パターン

#### MetaYamlServiceImpl での利用例
```typescript
export class MetaYamlServiceImpl implements MetaYamlService {
  constructor(
    private fileRepository: FileRepository,
    private dialogoiPathService: DialogoiPathService // 新たに依存注入
  ) {}

  private getMetaYamlPath(dirAbsolutePath: string): string {
    // 旧: path.join(dirAbsolutePath, '.dialogoi-meta.yaml')
    // 新: DialogoiPathService経由でパス変換
    return this.dialogoiPathService.resolveMetaPath(dirAbsolutePath);
  }

  async saveMetaYamlAsync(dirAbsolutePath: string, metaYaml: MetaYaml): Promise<void> {
    // 保存前にディレクトリ構造を自動作成
    await this.dialogoiPathService.ensureDialogoiDirectory(dirAbsolutePath);
    
    const metaYamlPath = this.getMetaYamlPath(dirAbsolutePath);
    // 既存の保存ロジック
  }
}
```

#### CommentService での利用例
```typescript
export class CommentService {
  constructor(
    private fileRepository: FileRepository,
    private dialogoiPathService: DialogoiPathService, // 新たに依存注入
    // ... その他の依存関係
  ) {}

  private getCommentFileUri(targetRelativeFilePath: string): Uri {
    const absoluteFilePath = path.join(this.workspaceRoot.fsPath, targetRelativeFilePath);
    const commentAbsolutePath = this.dialogoiPathService.resolveCommentPath(absoluteFilePath);
    return this.fileRepository.createFileUri(commentAbsolutePath);
  }
}
```

## 4. 影響を受けるモジュール

包括的な調査の結果、**25以上のファイル**が影響を受けることが判明しました。

### 4.1 最優先（必須修正）

1. **package.json**
   - VSCodeの起動条件を `.dialogoi/dialogoi.yaml` に変更

2. **FileRepository (抽象クラス)**
   - `resolveMetaPath()` メソッドの追加
   - `resolveCommentPath()` メソッドの追加

3. **VSCodeFileRepository**
   - 上記メソッドの実装

4. **DialogoiYamlServiceImpl**
   - `DIALOGOI_YAML_FILENAME` を `.dialogoi/dialogoi.yaml` に変更
   - プロジェクトルート判定の更新

5. **MetaYamlServiceImpl**
   - パス解決を新しいメソッドに置き換え
   - `.dialogoi-meta.yaml` → `.dialogoi/` 内での管理

6. **CommentService**
   - コメントファイルのパス解決を更新
   - `.{filename}.comments.yaml` → `.dialogoi/` 内での管理

### 4.2 高優先（UI・監視対応）

7. **FileDetailsViewProvider**
   - ファイル監視パターンの更新
   - `.dialogoi-meta.yaml` → `.dialogoi/**/*.yaml`

8. **DialogoiTreeDataProvider**
   - ツリー表示での新しいパス構造対応

9. **ProjectSettingsWebviewPanel**
   - WebView内でのdialogoi.yamlパス参照更新

10. **CommentsViewProvider**
    - コメントファイル監視の更新

### 4.3 中優先（プロジェクト管理）

11. **ProjectSetupService / ProjectAutoSetupService**
    - プロジェクト初期化フローの更新
    - `.dialogoi/` ディレクトリ作成処理

12. **ProjectSettingsService**
    - プロジェクト作成・設定管理の更新

13. **DialogoiSettingsService**
    - VSCode除外設定の更新

14. **CoreFileServiceImpl**
    - ディレクトリ作成時の処理を更新

### 4.4 その他のサービス（間接的影響）

以下のサービスは直接修正不要ですが、テスト更新が必要：
- FileManagementService, MetadataService, ReferenceService
- FileStatusService, FileChangeNotificationService

### 4.5 ユーティリティ・型定義

15. **DialogoiYamlUtils / MetaYamlUtils**
    - コメント内のファイルパス参照更新

### 4.6 テストファイル（25+ファイル）

**重要なテストファイル：**
- DialogoiYamlServiceImpl.test.ts
- MetaYamlServiceImpl.test.ts  
- CommentService.test.ts
- ReferenceService.test.ts
- DialogoiSettingsService.test.ts
- 他20+のテストファイル

### 4.7 WebViewコンポーネント（軽微な影響）

- FileDetailsApp, CommentsApp, ProjectSettingsApp
- 主にAPIを通じてデータを取得するため直接修正は最小限

## 5. 実装手順

### Phase 1: 基盤層の実装（FileRepository）

**目的**: パス変換の基盤を作る

1. FileRepository 抽象クラスに新しいメソッドを追加
2. VSCodeFileRepository に実装を追加
3. jest-mock-extended によるモック実装パターンを適用
4. 単体テストの作成

### Phase 2: メタデータ管理の移行

**目的**: メタデータファイルを `.dialogoi/` に移行

1. MetaYamlServiceImpl のパス解決を更新
2. ディレクトリ作成時の自動生成処理を更新
3. 既存テストの修正
4. 統合テストの実施

### Phase 3: コメントシステムの移行

**目的**: コメントファイルを `.dialogoi/` に移行

1. CommentService のパス解決を更新
2. コメントファイル作成時のディレクトリ自動生成
3. 既存テストの修正

### Phase 4: プロジェクト管理の更新

**目的**: プロジェクト初期化・設定管理の対応

1. DialogoiYamlServiceImpl の更新
2. ProjectSetupService / ProjectAutoSetupService の更新
3. ProjectSettingsService の更新
4. DialogoiExplorer のファイル監視パターンの更新
5. VSCode設定の更新

### Phase 5: 最終確認とクリーンアップ

**目的**: 全体の動作確認と仕上げ

1. サンプルプロジェクトでの動作確認
2. パフォーマンステスト
3. ドキュメントの更新

## 6. テスト計画

### 6.1 単体テスト

各サービスの単体テストで以下を確認：
- パス変換の正確性
- エッジケース（ルートディレクトリ、深い階層）
- 異常系（不正なパス）

### 6.2 統合テスト

実際のファイル操作シナリオで確認：
- ファイル作成時のメタデータ生成
- ディレクトリ移動時のメタデータ移行
- コメント追加・削除

### 6.3 手動テスト

VSCode上での実際の操作：
- TreeViewでの表示確認
- ファイル操作の応答性
- エラーメッセージの適切性

## 7. 注意事項

### 7.1 後方互換性について

- **後方互換性は考慮しない**
- 既存プロジェクトの移行スクリプトは提供しない
- 新規プロジェクトのみ新構造を使用

### 7.2 除外パターンの更新

`.dialogoi/` ディレクトリは以下から除外する必要があります：
- VSCodeのファイルエクスプローラー（TreeViewには表示しない）
- VSCodeの検索対象（設定で除外）

### 7.3 バージョン管理について

`.dialogoi/` ディレクトリは**gitで管理すべきです**：
- プロジェクトの重要なメタデータを含む
- チーム開発時の情報共有に必要
- `.vscode/` や `.claude/` と同様の扱い

ただし、将来的に以下のようなディレクトリが追加された場合は除外を検討：
- `.dialogoi/cache/` - キャッシュデータ（.gitignoreに追加）
- `.dialogoi/tmp/` - 一時ファイル（.gitignoreに追加）

### 7.4 パフォーマンスへの配慮

- ディレクトリ作成は必要時のみ（遅延作成）
- 深い階層でも高速に動作するようパス計算を最適化

## 8. TODO リスト

以下のTODOリストに従って実装を進めます。各項目にはPhaseと推定時間を記載しています。

### Phase 1: 基盤層の実装（推定: 3時間） ✅ **完了**

- [x] **1.1** package.json の修正
  - `workspaceContains:**/dialogoi.yaml` → `workspaceContains:**/.dialogoi/dialogoi.yaml`
  - DialogoiSettingsService の除外パターンを `**/.dialogoi/**` に統一

- [x] **1.2** DialogoiPathService クラスの作成
  - 新規サービスクラス: Dialogoi固有のパス変換ロジックを担当
  - FileRepository を依存注入で受け取る設計
  
- [x] **1.3** DialogoiPathService にメソッドを実装
  - `resolveMetaPath(targetPath: string): string` - メタデータファイルパス変換
  - `resolveCommentPath(filePath: string): string` - コメントファイルパス変換
  - `ensureDialogoiDirectory(targetPath: string): Promise<void>` - ディレクトリ自動作成
  - FileRepository.getProjectRoot() 経由でプロジェクトルート取得（VSCode依存の適切な局所化）

- [x] **1.4** ServiceContainer に DialogoiPathService を追加
  - `getDialogoiPathService(): DialogoiPathService` メソッドの実装
  - FileRepository の依存注入設定
  - resetメソッドでの初期化処理

- [x] **1.5** FileRepository から不適切なメソッドを削除
  - `resolveMetaPath()` と `resolveCommentPath()` を削除
  - Repository層を純粋なファイル操作のみに戻す
  - `getProjectRoot(): string` メソッドを追加（VSCode依存の適切な局所化）

- [x] **1.6** DialogoiPathService のテストを作成
  - jest-mock-extended による FileRepository のモック化
  - 正常系: ルート、サブディレクトリ、深い階層のテスト（15テストケース）
  - エッジケース: プロジェクト外パス、特殊文字、エラーハンドリング（10テストケース）
  - 全685テストが通過、品質保証完了

**Phase 1 完了時の技術的成果:**
- **アーキテクチャ改善**: Repository層とService層の責務分離を実現
- **VSCode依存の局所化**: FileRepository.getProjectRoot()でVSCode APIアクセスを適切に制限
- **新規サービス実装**: DialogoiPathService（78行、3メソッド、包括的テスト）
- **品質向上**: ForeshadowingService.test.tsをjest-mock-extendedパターンに統一
- **設定統一**: 除外パターン3つ→1つへの集約、VSCode起動条件の更新

### Phase 2: メタデータ管理の移行（推定: 4時間）

- [ ] **2.1** MetaYamlServiceImpl にDialogoiPathService を依存注入
  - コンストラクタに DialogoiPathService を追加
  - ServiceContainer での注入設定

- [ ] **2.2** MetaYamlServiceImpl の `getMetaYamlPath()` を更新
  - DialogoiPathService.resolveMetaPath() を使用するよう変更

- [ ] **2.3** MetaYamlServiceImpl の `saveMetaYamlAsync()` を更新
  - 保存前に DialogoiPathService.ensureDialogoiDirectory() を呼び出し

- [ ] **2.4** CoreFileServiceImpl の `createDirectory()` を更新
  - 新しいパス構造でメタデータを作成
  - DialogoiPathService の利用

- [ ] **2.5** MetaYamlService のテストを修正
  - `mock<DialogoiPathService>()` によるモック化対応
  - 新しいパス構造での動作確認

### Phase 3: コメントシステムの移行（推定: 3時間）

- [ ] **3.1** CommentService にDialogoiPathService を依存注入  
  - コンストラクタに DialogoiPathService を追加
  - ServiceContainer での注入設定

- [ ] **3.2** CommentService の `getCommentFilePath()` を更新
  - DialogoiPathService.resolveCommentPath() を使用

- [ ] **3.3** CommentService の `ensureCommentFile()` を更新
  - DialogoiPathService.ensureDialogoiDirectory() でディレクトリ作成

- [ ] **3.4** CommentService の `deleteCommentFile()` を更新
  - 新しいパスからファイルを削除

- [ ] **3.5** CommentService のテストを修正
  - `mock<DialogoiPathService>()` によるモック化対応
  - 新しいパス構造での全機能の動作確認

### Phase 4: UI・監視システムの更新（推定: 5時間）

- [ ] **4.1** DialogoiYamlServiceImpl の更新
  - `DIALOGOI_YAML_FILENAME` を `.dialogoi/dialogoi.yaml` に変更
  - `isDialogoiProjectRootAsync()` でプロジェクト判定を更新
  - `findProjectRootAsync()` の検索ロジックを更新

- [ ] **4.2** FileDetailsViewProvider の更新
  - ファイル監視パターンを `.dialogoi/**/*.yaml` に変更
  - 旧パターン `**/.dialogoi-meta.yaml` を削除

- [ ] **4.3** DialogoiTreeDataProvider の更新
  - ツリー表示での新しいパス構造対応
  - メタデータファイル参照の更新

- [ ] **4.4** ProjectSettingsWebviewPanel の更新
  - WebView内でのdialogoi.yamlパス参照を更新

- [ ] **4.5** CommentsViewProvider の更新
  - コメントファイル監視パターンの更新

- [ ] **4.6** ProjectSetupService の初期化フローを更新
  - `.dialogoi/` ディレクトリの作成
  - `dialogoi.yaml` を `.dialogoi/` 内に作成
  - Phase間の依存関係を確認

- [ ] **4.7** ProjectAutoSetupService の更新
  - 自動セットアップ時の `.dialogoi/` 対応
  - メタデータファイル作成処理の確認

- [ ] **4.8** ProjectSettingsService の更新
  - プロジェクト作成処理での新しいパス構造対応
  - 設定ファイル管理の更新

- [ ] **4.9** DialogoiSettingsService のVSCode設定を更新
  - `files.exclude` パターンを新しい構造に対応
  - 旧 `**/.dialogoi-reviews/**` パターンを削除し `.dialogoi/**` に統一

### Phase 5: テスト修正とユーティリティ更新（推定: 4時間）

- [ ] **5.1** 重要なテストファイルの修正
  - DialogoiYamlServiceImpl.test.ts - ファイルパス変更対応
  - MetaYamlServiceImpl.test.ts - メタファイルパス変更対応
  - CommentService.test.ts - コメントファイルパス変更対応
  - ReferenceService.test.ts - プロジェクト構造テストデータ更新

- [ ] **5.2** ユーティリティクラスの更新
  - DialogoiYamlUtils.ts - コメント内のファイルパス参照更新
  - MetaYamlUtils.ts - コメント内のファイルパス参照更新


- [ ] **5.3** 残りのテストファイル修正（20+ファイル）
  - 各サービステストでの新しいパス構造対応
  - モック実装の更新

- [ ] **5.4** 統合テストの実施
  - プロジェクト作成から基本操作まで一連の流れを確認
  - 既存プロジェクトと新プロジェクトの動作確認

### Phase 6: 最終確認とクリーンアップ（推定: 2時間）

- [ ] **6.1** サンプルプロジェクト（examples/sample-novel）での動作確認
  - 全機能が正常に動作することを確認
  - 新しいディレクトリ構造への更新

- [ ] **6.2** パフォーマンステストの実施
  - 100ファイル規模のプロジェクトで応答性を確認

- [ ] **6.3** ドキュメントの更新
  - README.md - 新しいディレクトリ構造の説明を追加
  - CLAUDE.md - 開発者向けの新構造の説明を追加

- [ ] **6.4** 最終的な `npm run check-all` の実行
  - 全テスト・Lint・型チェックが通ることを確認

## 9. 完了条件

以下のすべてが満たされた時点で、このタスクは完了とします：

1. すべてのDialogoi関連ファイルが `.dialogoi/` に集約されている
2. 既存の全機能が新しい構造で正常に動作する
3. 全テストが通過する（`npm run check-all`）
4. パフォーマンスの劣化がない
5. ドキュメントが更新されている

## 10. 将来の拡張可能性

この構造により、以下の拡張が容易になります：

- `.dialogoi/cache/` - キャッシュデータの保存
- `.dialogoi/history/` - 変更履歴の保存
- `.dialogoi/backups/` - 自動バックアップ
- `.dialogoi/templates/` - ユーザー定義テンプレート

これらは本実装の範囲外ですが、ディレクトリ構造はこれらを考慮して設計されています。