# Dialogoi Editor アーキテクチャ設計書

## 開発方針

### VSCode Extension として実装する理由

1. **開発効率の最大化**
   - エディタのコア機能（構文ハイライト、検索置換、自動保存等）の実装が不要
   - VSCode の優れたエディタ実装をそのまま活用可能

2. **ユーザビリティ**
   - VSCode 経由での簡単なインストール
   - 自然なマルチプラットフォーム対応（Windows/Mac/Linux）
   - 既存のショートカットキーやワークフローの活用

3. **保守性**
   - エディタ本体の更新はMicrosoft側で対応
   - 小説管理機能の開発に集中可能

## 技術スタック

### コア技術

- **TypeScript** - 型安全性を確保した開発（strict mode）
- **VSCode Extension API** - Extension の基盤
- **Node.js** - 実行環境（VSCode内蔵）

### 主要ライブラリ

- **js-yaml** - YAMLファイルの読み書き
- **mocha + tsx** - テストフレームワーク（サーバーサイド）
- **crypto (Node.js標準)** - SHA-256ハッシュ計算
- **micromatch** - glob パターンマッチング
- **React** - WebView UI構築
- **@testing-library/react** - Reactコンポーネントテスト
- **happy-dom** - テスト用DOM環境

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│                  VSCode Extension                │
├─────────────────────────────────────────────────┤
│  Presentation Layer                             │
│  ├─ TreeDataProvider                            │
│  │   └─ TreeDragAndDropController               │
│  ├─ WebView UI (React実装)                     │
│  │   ├─ FileDetailsViewProvider                 │
│  │   ├─ CommentsViewProvider                    │
│  │   ├─ ProjectSettingsWebviewPanel             │
│  │   └─ Reactコンポーネント群                  │
│  │       ├─ FileDetailsApp                      │
│  │       ├─ CommentsApp                         │
│  │       └─ ProjectSettingsApp                  │
│  └─ Commands                                    │
│      ├─ dialogoiCommands                        │
│      ├─ editorCommentCommands                   │
│      └─ dropCommands                            │
├─────────────────────────────────────────────────┤
│  Business Logic Layer                           │
│  ├─ CharacterService                            │
│  ├─ CommentService                              │
│  ├─ DialogoiSettingsService                     │
│  ├─ DialogoiTemplateService                     │
│  ├─ DialogoiYamlService                         │
│  ├─ DropHandlerService                          │
│  ├─ FileChangeNotificationService               │
│  ├─ FileManagementService                       │
│  ├─ FileOperationService                        │
│  ├─ FilePathMapService                          │
│  ├─ FileStatusService                           │
│  ├─ FileTypeConversionService (NEW)             │
│  ├─ FileTypeDetectionService                    │
│  ├─ ForeshadowingService                        │
│  ├─ HashService                                 │
│  ├─ HyperlinkExtractorService                   │
│  ├─ MetaYamlService                             │
│  ├─ ProjectAutoSetupService                     │
│  ├─ ProjectCreationService (DEPRECATED)         │
│  ├─ ProjectLinkUpdateService                    │
│  ├─ ProjectPathNormalizationService             │
│  ├─ ProjectPathService                          │
│  ├─ ProjectSetupService                         │
│  ├─ ProjectSettingsService                      │
│  ├─ ReferenceManager                            │
│  └─ TreeViewFilterService                       │
├─────────────────────────────────────────────────┤
│  Abstraction Layer (DI Container)               │
│  ├─ ServiceContainer                            │
│  ├─ VSCodeServiceContainer                      │
│  └─ TestServiceContainer                        │
├─────────────────────────────────────────────────┤
│  Data Access Layer (Repository Pattern)        │
│  ├─ FileRepository (抽象基底クラス)             │
│  │   ├─ VSCodeFileRepository (本番実装)        │
│  │   └─ MockFileRepository (テスト実装)        │
│  ├─ SettingsRepository                          │
│  │   ├─ VSCodeSettingsRepository                │
│  │   └─ MockSettingsRepository                  │
│  ├─ EventEmitterRepository                      │
│  │   ├─ VSCodeEventEmitterRepository            │
│  │   └─ MockEventEmitterRepository              │
│  └─ Uri Interface                               │
└─────────────────────────────────────────────────┘
```

## 依存関係注入（DI）アーキテクチャ

### 設計思想

このプロジェクトでは **VSCode依存の局所化** と **テスト可能性の向上** を目的として、依存関係注入（Dependency Injection）パターンを採用しています。

### レイヤー設計の基本原則

#### サービス層（/src/services/）の責務
- **純粋なビジネスロジックの実装**
- **VSCode APIへの直接アクセス禁止**
- **単体テスト可能な設計**
- **依存関係注入パターンの使用**

#### コマンド層（/src/commands/）の責務
- **VSCodeとの連携・UI操作**
- **ユーザーインターフェース制御**
- **サービス層のビジネスロジックを利用**

#### プロバイダー層（/src/providers/、/src/views/）の責務
- **VSCode Extension API の具象実装**
- **TreeDataProvider、WebViewProvider等の実装**
- **UI表示ロジックとイベント処理**

### 実装例とパターン

#### ✅ 良い例：services/はビジネスロジックのみ
```typescript
// services/DropHandlerService.ts
export class DropHandlerService {
  constructor(
    private metaYamlService: MetaYamlService,
    private pathNormalizationService: ProjectPathNormalizationService
  ) {}
  
  handleDrop(targetPath: string, droppedData: DroppedFileInfo): DropResult {
    // 純粋なビジネスロジック
    // VSCode依存なし
    return { success: true, insertText: '[link](path)' };
  }
}
```

#### ✅ 良い例：commands/でVSCodeとサービスを連携
```typescript
// commands/editorCommentCommands.ts
export function registerEditorCommentCommands(context: vscode.ExtensionContext) {
  const commentService = ServiceContainer.getInstance().getCommentService();
  
  const addCommentCommand = vscode.commands.registerCommand(
    'dialogoi.addCommentFromSelection',
    async () => {
      const editor = vscode.window.activeTextEditor; // VSCode API使用
      // ビジネスロジックはサービス層に委譲
      await commentService.addCommentAsync(relativePath, options);
    }
  );
  
  context.subscriptions.push(addCommentCommand);
}
```

### 主要な抽象化レイヤー

#### 1. FileRepository (抽象基底クラス)
```typescript
export abstract class FileRepository {
  abstract existsAsync(uri: Uri): Promise<boolean>;
  abstract readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string>;
  abstract writeFileAsync(uri: Uri, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  abstract renameAsync(oldUri: Uri, newUri: Uri): Promise<void>;
  abstract deleteAsync(uri: Uri): Promise<void>;
  abstract createDirectoryAsync(uri: Uri): Promise<void>;
  abstract readDirectoryAsync(uri: Uri): Promise<DirectoryEntry[]>;
  abstract statAsync(uri: Uri): Promise<FileStats>;
  abstract createFileUri(path: string): Uri;
  abstract readExtensionResource(relativePath: string): string;
}
```

#### 2. Uri Interface
```typescript
export interface Uri {
  readonly scheme: string;
  readonly authority: string;
  readonly path: string;
  readonly fsPath: string;
  toString(): string;
  toJSON(): object;
}
```

### 具象実装

#### 1. VSCodeFileRepository (本番環境)
- `vscode.workspace.fs` APIを使用した完全非同期実装
- 実際のファイルシステムとの相互作用を担当
- VSCode環境でのみ動作

#### 2. MockFileRepository (テスト環境)
- インメモリでファイルシステムを模擬
- 単体テストでの高速実行を実現（517テスト）
- VSCode環境に依存しない

### DI Container

#### ServiceContainer
シングルトンパターンによる依存関係の一元管理：

```typescript
export class ServiceContainer {
  private static instance: ServiceContainer;
  
  getFileRepository(): FileRepository
  getCharacterService(): CharacterService
  getCommentService(): CommentService
  getDialogoiYamlService(): DialogoiYamlService
  getForeshadowingService(): ForeshadowingService
  getHashService(): HashService
  getMetaYamlService(): MetaYamlService
  getReferenceManager(): ReferenceManager
  // ... その他のサービス取得メソッド
}
```

## 主要サービスの概要

### 1. FileOperationService
ファイル・ディレクトリの基本操作を提供：
- 作成・削除・名前変更・移動
- タグ・参照の操作
- メタデータとの同期管理

### 2. MetaYamlService
`.dialogoi-meta.yaml`ファイルの管理：
- 読み込み・保存・バリデーション
- ファイル情報の追加・削除・更新
- タグ・参照関係の管理

### 3. CommentService
コメント・TODO機能の管理：
- GitHub風行番号形式（#L42, #L4-L7）対応
- マークダウン対応コメントの作成・編集・削除
- ステータス管理（open/resolved）
- ファイルハッシュによる変更検知

### 4. ProjectAutoSetupService ✅ 実装完了
プロジェクト自動セットアップ機能：
- 再帰的ディレクトリスキャン
- .dialogoi-meta.yaml自動生成
- README.md自動生成（minimal/detailed）
- 全ファイル自動登録（除外パターン対応）
- ファイル種別自動判定

### 5. ProjectSetupService ✅ 実装完了
高レベルプロジェクト作成オーケストレーター：
- DialogoiYamlService + ProjectAutoSetupServiceの統合
- 循環依存を回避した適切なアーキテクチャ
- 新規プロジェクト作成 + 自動セットアップ
- 既存プロジェクトへの自動セットアップ適用
- 詳細な進行状況レポート

### 6. FileTypeDetectionService ✅ 実装完了
ファイル種別自動判定：
- 拡張子ベース判定（.txt→content, .md→setting）
- ディレクトリベース判定（contents/→content系）
- 除外パターン処理（glob対応）
- ProjectCreationServiceから機能抽出・改良

### 7. FileTypeConversionService ✅ 実装完了
ファイル種別変更機能：
- content ↔ setting間の変更
- プロジェクト内ファイル検索・更新
- meta.yamlファイルの安全な更新
- TreeView・WebView即座更新

### 8. ProjectPathService ✅ 実装完了
プロジェクトパス管理：
- プロジェクトルート検索・検証
- 相対パス・絶対パス変換
- PathUtilsの単一責任化リファクタリング

### 9. DialogoiYamlService
プロジェクト設定（`dialogoi.yaml`）の管理：
- プロジェクト作成・読み込み・保存
- プロジェクトルート検索
- バリデーション

### 10. ReferenceManager
参照関係の一元管理：
- 手動参照とハイパーリンク参照の統合
- 双方向参照の自動追跡
- 存在チェック機能

### 11. ForeshadowingService
伏線管理機能：
- 複数の「張る」位置と「回収」位置の管理
- 伏線状態の追跡（planned/partially_planted/fully_planted/resolved/error）
- ファイル存在確認

### 12. HashService
ファイル変更検知：
- SHA-256ハッシュ計算
- ファイル内容の変更検知
- コメント・参照の整合性保持

## WebView UI アーキテクチャ

### React統合
- **TypeScript完全対応**: 型安全なメッセージング
- **モジュラー設計**: アプリ別コンポーネント分離
- **包括的テスト**: 242のReactコンポーネントテスト

### WebViewアプリケーション

#### 1. FileDetailsApp
ファイル詳細情報の表示・編集：
- BasicInfoSection: ファイル基本情報
- TagSection: タグ管理UI
- ReferenceSection: 参照関係表示
- CharacterSection: キャラクター設定
- ForeshadowingSection: 伏線管理

#### 2. CommentsApp
コメント・TODO管理：
- CommentItem: 個別コメント表示・編集
- MarkdownRenderer: マークダウンレンダリング
- インライン編集とプレビュー機能

#### 3. ProjectSettingsApp
プロジェクト設定管理：
- ビジュアル設定編集
- リアルタイムバリデーション
- 自動保存機能

## データフロー

### 1. 初期化フロー
```
Extension起動
  ↓
VSCodeServiceContainer.initialize()
  ↓
DialogoiYamlService.findProjectRootAsync()
  ↓
MetaYamlService.loadMetaYamlAsync() (再帰的)
  ↓
TreeDataProvider初期化
  ↓
WebView Provider登録
```

### 2. ファイル操作フロー
```
ユーザー操作 (TreeView/WebView)
  ↓
Command実行
  ↓
Service層でビジネスロジック処理
  ↓
FileRepository経由でファイル操作
  ↓
MetaYamlService.saveMetaYamlAsync()
  ↓
FileChangeNotificationService.notify()
  ↓
UI更新（TreeView/WebView）
```

### 3. コメント追加フロー
```
エディタ選択範囲 → 右クリック
  ↓
editorCommentCommands.addCommentFromSelection
  ↓
CommentService.addCommentAsync()
  ↓
ファイルハッシュ計算・posted_by取得
  ↓
コメントファイル保存
  ↓
CommentsViewProvider.updateView()
  ↓
React WebView更新・編集モード開始
```

## テスト戦略

### 1. サーバーサイドテスト（517テスト）
- 全サービスクラスの完全テストカバレッジ
- MockFileRepository使用による高速実行
- TypeScript strict mode準拠

### 2. Reactコンポーネントテスト（223テスト）
- React Testing Library + Happy-DOM
- VSCode APIモック実装
- ユーザー操作シミュレーション

### 3. 統合テスト
- ServiceContainer経由の実際のワークフロー
- WebView ↔ Extension間の通信テスト
- エラーハンドリングと復旧処理

## パフォーマンス考慮事項

### 1. ファイル操作
- 非同期処理による応答性確保
- バッチ処理によるメタデータ更新最適化
- ファイル監視の効率化

### 2. UI表示
- 仮想化による大量データ表示対応
- 遅延読み込みとキャッシング
- リアルタイム更新の最適化

### 3. メモリ管理
- WeakMapによる循環参照回避
- 適切なリスナー削除とクリーンアップ
- MockRepositoryによるテスト時メモリ効率

## アーキテクチャ改善（2025年1月）

### 循環依存解決とサービス統合

**問題:** 従来のProjectCreationServiceとDialogoiYamlServiceの間に循環依存の課題があった

**解決策:** ProjectSetupServiceによる統合オーケストレーター導入
```
階層構造:
ProjectSetupService (高レベル統合)
├─ DialogoiYamlService (基本プロジェクト作成)
└─ ProjectAutoSetupService (自動セットアップ)
    ├─ MetaYamlService
    ├─ FileTypeDetectionService
    └─ DialogoiYamlService (除外パターン取得)
```

**利点:**
- 循環依存の完全解決
- 単一責任原則の徹底
- テスト可能性の向上
- 将来の機能拡張に対する柔軟性

### 機能分割とモジュール化

**ProjectCreationService → 3つのサービスに分割:**
1. **FileTypeDetectionService**: ファイル種別判定ロジックの抽出
2. **ProjectAutoSetupService**: 自動セットアップ機能の実装
3. **ProjectSetupService**: 高レベルオーケストレーション

**メリット:**
- 各サービスの責務が明確
- 個別のテストが容易
- 再利用性の向上

## セキュリティ考慮事項

### 1. ファイルアクセス制御
- プロジェクトルート配下への制限
- パストラバーサル攻撃対策
- 適切な権限チェック

### 2. データバリデーション
- YAMLパース時のインジェクション対策
- 入力値の適切なサニタイゼーション
- スキーマベースバリデーション

### 3. WebView セキュリティ
- Content Security Policy (CSP) 設定
- XSS攻撃対策
- 安全なHTMLエスケープ処理

## 拡張性とメンテナンス

### 1. モジュラー設計
- 明確な責務分離
- インターフェースベースの設計
- プラグイン対応の検討

### 2. コード品質
- ESLint strict設定（max-warnings: 0）
- Prettier自動フォーマット
- 包括的型チェック

### 3. ドキュメント
- コード内ドキュメント
- APIドキュメント自動生成
- アーキテクチャ決定記録（ADR）