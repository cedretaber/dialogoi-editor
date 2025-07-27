# プロジェクト自動セットアップ機能実装計画

## 概要

新しい小説プロジェクト作成時に、ルートディレクトリから再帰的にファイルをスキャンし、すべてのファイルを自動的にDialogoi管理対象に登録する機能を実装する。ユーザは初期設定なしですぐに執筆を開始でき、その後必要に応じて個別のファイル設定を調整できる。

## 新方針の背景

### 旧方針（廃止）：ディレクトリ単位の一括追加
- ユーザが手動でディレクトリを選択して一括追加
- WebViewによるプレビュー機能
- 複雑なUI操作が必要

### 新方針：プロジェクト作成時の自動セットアップ
- プロジェクト作成時に全ファイルを自動登録
- ユーザの手動操作は最小限
- その後の個別調整で細かいカスタマイズに対応

## 実装結果

### ✅ Phase 1: 既存機能の整理・削除（完了）

#### 1.1 ディレクトリ一括追加機能の削除
```
削除完了：
- src/webviews/BulkAddDirectoryProvider.ts
- src/commands/bulkAddDirectoryCommands.ts
- src/services/FileManagementService.bulkAddDirectory()
- webview/components/BulkAddDirectoryApp/
- webview/bulkAddDirectory.tsx
- webview/bulkAddDirectory.html
- webview/bulkAddDirectory.css
- package.json内の関連コマンド・メニュー
- 関連テストコード
```

#### 1.2 不要なインターフェース・型定義の削除
```
削除完了：
- src/interfaces/BulkAddDirectory.ts
- BulkAddFilePreview関連の型
- BulkAddDirectoryMessage関連の型
```

#### 1.3 WebViewビルド設定の整理
```
package.jsonから削除完了：
- webview:build:bulkAddDirectory
- webview:buildで該当箇所を削除
```

### ✅ Phase 2: プロジェクト作成時自動ファイル登録機能の強化（完了）

#### ✅ 2.1 再帰的ディレクトリスキャン機能（実装完了）
```typescript
// 実装済み: src/services/ProjectAutoSetupService.ts
class ProjectAutoSetupService {
  /**
   * プロジェクトルートから再帰的にファイルをスキャンし、
   * 各ディレクトリに.dialogoi-meta.yamlを配置
   */
  async setupProjectStructure(
    projectRoot: string, 
    options?: Partial<DirectorySetupOptions>
  ): Promise<SetupResult>;
  
  /**
   * 全ファイルを自動的に管理対象に登録
   */
  async registerAllFiles(
    projectRoot: string, 
    options?: Partial<FileRegistrationOptions>
  ): Promise<RegistrationResult>;
}
```

#### 2.2 ディレクトリ管理ファイル自動生成
- **処理手順**:
  1. ルートから再帰的にディレクトリを辿る
  2. 各ディレクトリに`.dialogoi-meta.yaml`を配置（既存ファイルは上書きしない）
  3. READMEファイルがない場合は基本的なものを生成

```typescript
interface DirectorySetupOptions {
  createMetaYaml: boolean;      // .dialogoi-meta.yamlの自動生成
  createReadme: boolean;        // READMEファイルの自動生成
  overwriteExisting: boolean;   // 既存ファイルの上書き許可（基本false）
  readmeTemplate: 'minimal' | 'detailed';
}
```

#### 2.3 全ファイル自動登録機能
- **処理手順**:
  1. 再度ルートから再帰的にディレクトリを辿る
  2. 各ディレクトリで以下を実行：
     - READMEファイルの有無を調査、なければ追加
     - 該当ディレクトリの`.dialogoi-meta.yaml`にファイルを追加
     - 除外対象ファイルはスキップ（READMEファイル、コメントファイル、無視条件に合致するファイル）
     - ファイル種別は既存の自動判別機能を使用

```typescript
interface FileRegistrationOptions {
  excludePatterns: string[];        // 除外パターン
  fileTypeDetection: 'extension';   // 種別判定方法（現在は拡張子ベースのみ）
  createReadmeIfMissing: boolean;   // README自動生成
}
```

### ✅ Phase 3: 個別ファイル種別変更機能の実装（完了）

#### ✅ 3.1 右クリックメニューに種別変更機能追加（実装完了）
```typescript
// 実装済みコマンド
- dialogoi.convertFileType    // ファイル種別変更（content ↔ setting）
```

**実装内容:**
- `src/commands/fileTypeConversionCommands.ts` - コマンドハンドラ実装
- `package.json` - コンテキストメニュー統合
- TreeViewの管理対象ファイルで右クリックメニュー表示

#### ✅ 3.2 種別変換機能の実装（実装完了）
```typescript
// 実装済み: src/services/FileTypeConversionService.ts
interface FileTypeConversionService {
  /**
   * ファイルの種別を変更（content ↔ setting）
   */
  convertFileType(filePath: string, newType: 'content' | 'setting'): Promise<ConversionResult>;
  
  /**
   * ファイルの現在の種別を取得
   */
  getCurrentFileType(filePath: string): Promise<'content' | 'setting' | null>;
  
  /**
   * ファイルが種別変更可能かチェック
   */
  isFileTypeConvertible(filePath: string): Promise<boolean>;
}
```

**技術実装:**
- meta.yamlファイルの更新処理
- プロジェクト内ファイル検索機能
- 再帰的なディレクトリ検索
- ファイル変更通知システム連携

#### ✅ 3.3 種別変更UI（実装完了）
- **対象**: 管理対象ファイル（content または setting）
- **操作**: 右クリック → 「種別を変更」
- **動作**: 自動で逆の種別に変更（content → setting / setting → content）
- **確認**: 変更内容の確認ダイアログ表示
- **更新**: TreeViewとファイル詳細パネルの即座更新

### ✅ Phase 4: プロジェクト作成フローの統合（完了）

#### ✅ 4.1 ProjectSetupServiceによる統合アーキテクチャ（実装完了）
**循環依存を回避した新しいアーキテクチャ:**
```typescript
// 実装済み: src/services/ProjectSetupService.ts
class ProjectSetupService {
  constructor(
    private dialogoiYamlService: DialogoiYamlService,
    private projectAutoSetupService: ProjectAutoSetupService
  ) {}

  /**
   * 新規プロジェクト作成 + 自動セットアップ
   */
  async createDialogoiProjectWithSetup(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
    options?: ProjectSetupOptions
  ): Promise<ProjectSetupResult>;

  /**
   * 既存プロジェクトに自動セットアップを適用
   */
  async setupExistingProject(
    projectRootAbsolutePath: string,
    options?: ProjectSetupOptions
  ): Promise<ProjectSetupResult>;
}
```

**統合処理フロー:**
1. `DialogoiYamlService.createDialogoiProjectAsync()` - dialogoi.yaml作成
2. `ProjectAutoSetupService.setupProjectStructure()` - ディレクトリ構造セットアップ
3. `ProjectAutoSetupService.registerAllFiles()` - 全ファイル自動登録

#### ✅ 4.2 プロジェクト作成時のユーザーオプション（実装完了）
```typescript
// 実装済み: src/services/ProjectSetupService.ts
interface ProjectSetupOptions {
  autoRegisterFiles?: boolean;           // 自動ファイル登録（デフォルト: true）
  createDirectoryStructure?: boolean;    // ディレクトリ構造自動生成（デフォルト: true）
  fileTypeDetection?: 'extension';       // ファイル種別判定方法
  excludePatterns?: string[];            // カスタム除外パターン
  readmeTemplate?: 'minimal' | 'detailed'; // READMEテンプレート
}
```

## 実装状況サマリー

### ✅ 完了済み機能（Sprint 1-3）
1. **ディレクトリ一括追加機能の完全削除** - 複雑なWebView UIを排除
2. **ProjectAutoSetupService実装** - 自動プロジェクト構造セットアップ
3. **ProjectSetupService実装** - 高レベル統合オーケストレーター
4. **FileTypeConversionService実装** - 個別ファイル種別変更機能（content ↔ setting）
5. **循環依存解決** - アーキテクチャの最適化
6. **包括的テストカバレッジ** - 517個のサーバサイドテスト + 223個のReactテスト

### 🔄 次期実装予定（Sprint 4-5）
1. **プログレス表示機能** - 長時間処理の可視化
2. **エラーハンドリング強化** - より親切なエラーメッセージ
3. **C2-基本機能** - ディレクトリ管理ファイル自動生成（上書きなし）

### 📊 品質指標
- **型安全性**: TypeScript strict mode 完全準拠
- **コード品質**: ESLint max-warnings 0
- **テストカバレッジ**: 全主要機能をカバー
- **ビルド**: 全チェック通過（typecheck + lint + format + test:all + webview:build）

## 技術実装詳細

### 1. 既存コードからの機能抽出

#### FileTypeDetectionServiceの活用
```typescript
// 既存のProjectCreationServiceから自動判定ロジックを抽出
class FileTypeDetectionService {
  detectFileType(filePath: string): 'content' | 'setting' {
    const extension = path.extname(filePath).toLowerCase();
    // .txt → content (本文ファイル)
    // .md → setting (設定ファイル)  
    // その他 → setting (デフォルト)
    return extension === '.txt' ? 'content' : 'setting';
  }
}
```

#### 除外パターンの統一
```typescript
// DialogoiYamlServiceから除外パターンを取得
const excludePatterns = await dialogoiYamlService.getExcludePatternsAsync(projectRoot);

// 追加の除外対象
const additionalExcludes = [
  '*.dialogoi-meta.yaml',     // 管理ファイル自体
  '*README.md',               // READMEファイル
  '*.comments.yaml',          // コメントファイル
];
```

### 2. 新規サービスの設計

#### ProjectAutoSetupService
```typescript
class ProjectAutoSetupService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private fileTypeDetectionService: FileTypeDetectionService,
    private dialogoiYamlService: DialogoiYamlService,
  ) {}

  async setupProjectStructure(projectRoot: string): Promise<SetupResult> {
    // 1. ディレクトリツリーを再帰的にスキャン
    // 2. 各ディレクトリに.dialogoi-meta.yamlを生成
    // 3. READMEファイルの生成
  }

  async registerAllFiles(projectRoot: string): Promise<RegistrationResult> {
    // 1. 再帰的にファイルをスキャン
    // 2. 除外パターンの適用
    // 3. ファイル種別の自動判定
    // 4. 各ディレクトリの.dialogoi-meta.yamlに追加
  }

  private async scanDirectoryRecursively(dirPath: string): Promise<DirectoryTree>
  private async createMetaYamlIfNotExists(dirPath: string): Promise<boolean>
  private async createReadmeIfNotExists(dirPath: string): Promise<boolean>
}
```

#### FileTypeConversionService  
```typescript
class FileTypeConversionService {
  constructor(
    private metaYamlService: MetaYamlService,
    private dialogoiYamlService: DialogoiYamlService,
  ) {}

  async convertFileType(filePath: string, newType: 'content' | 'setting'): Promise<ConversionResult> {
    // 1. ファイルが存在することを確認
    // 2. 現在の種別を取得
    // 3. .dialogoi-meta.yamlの該当エントリを更新
    // 4. TreeViewを更新
  }
}
```

### 3. 依存関係注入の拡張

#### ServiceContainerへの追加
```typescript
// ServiceContainer.ts
private setupServices(): void {
  // 既存サービス...
  
  // 新規サービス
  this.projectAutoSetupService = new ProjectAutoSetupService(
    this.fileRepository,
    this.metaYamlService,
    this.fileTypeDetectionService,
    this.dialogoiYamlService,
  );
  
  this.fileTypeConversionService = new FileTypeConversionService(
    this.metaYamlService,
    this.dialogoiYamlService,
  );
}
```

### 4. エラーハンドリングとロールバック

#### 処理失敗時の対応
```typescript
interface SetupResult {
  success: boolean;
  message: string;
  createdFiles: string[];      // 作成されたファイル一覧
  failedOperations: string[];  // 失敗した操作一覧
  rollbackInfo?: RollbackInfo; // ロールバック用情報
}

interface RollbackInfo {
  filesToDelete: string[];     // 作成されたファイル（削除対象）
  originalMetaYamls: Record<string, any>; // 変更前のmeta.yaml内容
}
```

## ユーザー体験の設計

### 1. プロジェクト作成時のフロー

#### 従来のフロー
1. VSCodeでフォルダを開く
2. コマンドパレット → "Dialogoi: 新しい小説を開始"
3. `dialogoi.yaml`が作成される
4. **手動でファイルを一つずつ追加（面倒）**

#### 新しいフロー
1. VSCodeでフォルダを開く
2. コマンドパレット → "Dialogoi: 新しい小説を開始"
3. `dialogoi.yaml`が作成される
4. **全ファイルが自動的に管理対象に登録される（自動）**
5. **すぐに執筆開始可能**

### 2. 作成後の調整フロー

#### ファイル種別の調整
- TreeViewで管理対象ファイルを右クリック
- "種別を変更" → content/settingを選択
- 即座に反映

#### 管理対象からの除外
- 既存の機能を活用
- "管理対象から削除" で個別除外可能

### 3. プログレス表示

#### 大量ファイル処理時
```typescript
// vscode.window.withProgress を使用
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "Dialogoiプロジェクトセットアップ中...",
  cancellable: true
}, async (progress, token) => {
  // セットアップ処理
  progress.report({ message: "ディレクトリ構造を作成中..." });
  await setupProjectStructure(projectRoot);
  
  progress.report({ message: "ファイルを登録中..." });
  await registerAllFiles(projectRoot);
});
```

## 実装順序

### Sprint 1: クリーンアップと準備（優先度: 高）✅ **完了**
1. **既存ディレクトリ一括追加機能の削除**
   - [x] BulkAddDirectoryProvider等の削除
   - [x] package.jsonからコマンド・メニュー削除
   - [x] WebViewファイルの削除
   - [x] 関連テストの削除
   
2. **FileTypeDetectionServiceの実装**
   - [x] ProjectCreationServiceから自動判定ロジックを抽出
   - [x] 単体テストの作成
   - [x] ServiceContainerへの統合

### Sprint 2: 自動セットアップ機能の実装（優先度: 高）✅ **完了**
1. **ProjectAutoSetupServiceの実装**
   - [x] 再帰的ディレクトリスキャン
   - [x] .dialogoi-meta.yamlの自動生成
   - [x] READMEファイルの自動生成
   - [x] 全ファイル自動登録機能
   - [x] 包括的なテストスイート作成（11テスト）
   
2. **プロジェクト作成フローの統合** 🔄 **次のタスク**
   - [ ] DialogoiYamlService.createDialogoiProjectAsyncの拡張
   - [ ] プログレス表示の実装
   - [ ] エラーハンドリングの実装

### Sprint 3: 種別変換機能の実装（優先度: 中）✅ **完了**
1. **FileTypeConversionServiceの実装**
   - [x] content ↔ setting 変換機能
   - [x] 単体テストの作成（15テスト）
   - [x] プロジェクト内ファイル検索機能
   - [x] 再帰的ディレクトリ検索
   
2. **UI統合**
   - [x] 右クリックメニューに種別変更追加
   - [x] コマンドハンドラの実装
   - [x] TreeView自動更新
   - [x] ファイル詳細パネル即座更新

### Sprint 4: 品質保証と最適化（優先度: 低）
1. **テスト作成**
   - [ ] ProjectAutoSetupServiceのテスト
   - [ ] 統合テストの作成
   - [ ] エラーケースのテスト
   
2. **パフォーマンス最適化**
   - [ ] 大量ファイル時の処理時間測定
   - [ ] 必要に応じた最適化実装

## 成功指標

### 機能面
- [x] プロジェクト作成時に全ファイルが自動登録される
- [x] ファイル種別が適切に自動判定される
- [x] ファイル種別の手動変更が可能
- [x] 除外パターンが正しく適用される

### パフォーマンス面
- [ ] 100ファイル以下: 3秒以内でセットアップ完了
- [ ] 1000ファイル以下: 10秒以内でセットアップ完了

### UX面
- [x] プロジェクト作成後すぐに執筆開始可能
- [x] 種別変更が直感的に操作可能
- [ ] エラー発生時の適切な情報表示

## リスク管理

### 技術リスク
- **大量ファイル時のパフォーマンス**: バッチ処理・プログレス表示で対策
- **ファイルシステムエラー**: 適切なエラーハンドリング・ロールバック機能で対策
- **既存ファイルの誤上書き**: 既存ファイル保護・確認ダイアログで対策

### UXリスク
- **予期しない自動登録**: 明確な処理内容表示・設定での無効化で対策
- **誤った種別判定**: 簡単な手動修正機能で対策

## 設計判断の記録

### 1. 自動セットアップの範囲
**採用**: 全ファイルを一度に自動登録
**理由**: ユーザビリティ優先、後から個別調整可能

### 2. ファイル種別判定方法
**採用**: 拡張子ベースの判定（.txt→content、.md→setting）
**理由**: シンプルで予測しやすい、既存実装との整合性

### 3. 既存ファイルの扱い
**採用**: 上書きしない（安全性優先）
**理由**: データ消失リスクの回避、後方互換性の保持

### 4. ディレクトリ一括追加機能の廃止
**理由**: 
- ユーザビリティが複雑
- 自動セットアップで同等の価値を提供可能
- コードベースの簡素化

この計画により、ユーザーは複雑な手動設定なしにDialogoiを利用開始でき、その後の細かい調整も直感的に行えるようになります。