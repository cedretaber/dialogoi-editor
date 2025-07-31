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
- **Jest + jest-mock-extended** - テストフレームワーク（型安全なモック生成）
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
│  ├─ CoreFileService                             │
│  ├─ DialogoiSettingsService                     │
│  ├─ DialogoiTemplateService                     │
│  ├─ DialogoiYamlService                         │
│  ├─ DropHandlerService                          │
│  ├─ FileChangeNotificationService               │
│  ├─ FileManagementService                       │
│  ├─ FilePathMapService                          │
│  ├─ FileStatusService                           │
│  ├─ FileTypeConversionService                   │
│  ├─ ForeshadowingService                        │
│  ├─ HyperlinkExtractorService                   │
│  ├─ MetadataService                             │
│  ├─ MetaYamlService                             │
│  ├─ ProjectAutoSetupService                     │
│  ├─ ProjectLinkUpdateService                    │
│  ├─ ProjectPathService                          │
│  ├─ ProjectSetupService                         │
│  ├─ ProjectSettingsService                      │
│  ├─ ReferenceService                            │
│  └─ TreeViewFilterService                       │
├─────────────────────────────────────────────────┤
│  Abstraction Layer (DI Container)               │
│  ├─ ServiceContainer                            │
│  └─ VSCodeServiceContainer                      │
├─────────────────────────────────────────────────┤
│  Data Access Layer (Repository Pattern)        │
│  ├─ FileRepository (抽象基底クラス)             │
│  │   └─ VSCodeFileRepository (本番実装)        │
│  ├─ SettingsRepository                          │
│  │   └─ VSCodeSettingsRepository                │
│  ├─ EventEmitterRepository                      │
│  │   └─ VSCodeEventEmitterRepository            │
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

#### プロバイダー層（/src/providers/、/src/panels/、/src/tree/）の責務
- **VSCode Extension API の具象実装**
- **TreeDataProvider、WebViewProvider等の実装**
- **UI表示ロジックとイベント処理**

##### ディレクトリ使い分け
- **providers/** - サイドバーパネル用のWebViewプロバイダー
  - `CommentsViewProvider.ts`: コメント・TODO管理
  - `FileDetailsViewProvider.ts`: ファイル詳細情報表示
- **tree/** - TreeView専用のデータプロバイダー
  - `DialogoiTreeDataProvider.ts`: ファイルツリー表示
- **panels/** - メインエディタ領域のWebViewパネル管理
  - `ProjectSettingsWebviewPanel.ts`: プロジェクト設定画面

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
  getReferenceService(): ReferenceService
  // ... その他のサービス取得メソッド
}
```

## 主要サービスの概要

### 1. CoreFileService
ファイル・ディレクトリの基本操作：
- 作成・削除・名前変更・移動・順序変更
- ファイル内容の読み書き（低レベルAPI）
- メタデータとの同期管理

### 2. MetadataService
メタデータ専用操作：
- タグ操作：addTag, removeTag, setTags
- 参照操作：addReference, removeReference, setReferences
- 汎用メタデータ更新：updateMetaYaml

### 3. MetaYamlService
`.dialogoi-meta.yaml`ファイルの管理：
- 読み込み・保存・バリデーション
- ファイル情報の追加・削除・更新

### 4. CommentService
コメント・TODO機能の管理：
- GitHub風行番号形式（#L42, #L4-L7）対応
- マークダウン対応コメントの作成・編集・削除
- ステータス管理（open/resolved）
- ファイルハッシュによる変更検知

### 5. FileManagementService
ファイル管理操作と業務ロジック：
- 未管理ファイルのmeta.yaml追加・削除
- 欠損ファイルの作成（テンプレート対応）
- キャラクター操作：setCharacterImportance, setMultipleCharacters, removeCharacter
- 伏線操作：setForeshadowing, removeForeshadowing

### 6. DialogoiYamlService
プロジェクト設定（`dialogoi.yaml`）の管理：
- プロジェクト作成・読み込み・保存
- プロジェクトルート検索・判定
- バリデーション・除外パターン取得

### 7. ReferenceService
参照関係の一元管理：
- 手動参照とハイパーリンク参照の統合
- 双方向参照の自動追跡
- 存在チェック・整合性保持

### 8. ForeshadowingService
伏線管理機能：
- 複数の「張る」位置と「回収」位置の管理
- 伏線状態の追跡（planned/partially_planted/fully_planted/resolved/error）
- ファイル存在確認・バリデーション

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

### 1. サーバーサイドテスト（600+テスト）
- 全サービスクラスの完全テストカバレッジ
- jest-mock-extended による型安全なモック生成
- TypeScript strict mode準拠

### 2. Reactコンポーネントテスト（200+テスト）
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
- テスト時のメモリ効率最適化

## テストアーキテクチャ

### 1. モックパターン
- **jest-mock-extended** を使用した型安全なモック生成
- `MockProxy<T>` による自動的なメソッドスタブ
- コンストラクタインジェクションによる明示的な依存性注入

### 2. テスト構造
```typescript
describe('ServiceName テストスイート', () => {
  let service: ServiceName;
  let mockDependency: MockProxy<DependencyType>;

  beforeEach(() => {
    mockDependency = mock<DependencyType>();
    service = new ServiceName(mockDependency);
  });
});
```

### 3. 廃止された仕組み (2025-01-31)
- TestServiceContainer: 全サービステストがjest-mock-extendedに移行
- MockRepositoryクラス群: MockProxy<T>パターンで代替
- ServiceContainer.initializeForTesting(): 不要になり削除

## 最新のアーキテクチャ改善 (2025-01-31)

### 依存関係注入の統一化
- **コンストラクタ注入パターンの統一**: 全サービスが明示的な依存関係注入を採用
- **ServiceContainer の完全リファクタリング**: シングルトンパターンによる統一管理
- **ReferenceManager → ReferenceService**: 命名規則の統一とインターフェース分離

### テストアーキテクチャの大幅改善
- **jest-mock-extended完全移行**: MockProxy<T>による型安全なモック生成
- **TestServiceContainer削除**: 複雑な仕組みを廃止してシンプルな依存注入へ
- **テスト数向上**: 517→600+テストに増加（品質改善と機能追加）

### 主要な変更点
```typescript
// 旧: TestServiceContainer使用
const container = TestServiceContainer.create();
const service = container.getCommentService();

// 新: jest-mock-extended使用
const mockRepo = mock<FileRepository>();
const service = new CommentService(mockRepo);
```


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

## UI層ディレクトリ構造ガイド

### ディレクトリ構成と責務

```
src/
├── providers/        # サイドバーWebViewプロバイダー
├── tree/            # TreeViewデータプロバイダー
├── panels/          # メインエディタWebViewパネル
└── commands/        # VSCodeコマンド登録

webview/             # React UIコンポーネント（src/外）
├── components/      # Reactコンポーネント群
├── types/          # TypeScript型定義
└── hooks/          # カスタムフック
```

### 新機能追加時のガイドライン

#### サイドバーに新しいパネルを追加する場合
1. `src/providers/`に新しい`*ViewProvider.ts`を作成
2. `webview/components/`に対応するReactコンポーネントを作成
3. `extension.ts`でプロバイダーを登録

#### メインエディタに新しいパネルを追加する場合
1. `src/panels/`に新しい`*Panel.ts`を作成
2. `webview/`に新しいエントリーポイント`*.tsx`を作成
3. `src/commands/`で開くコマンドを定義

#### TreeViewを拡張する場合
1. `src/tree/DialogoiTreeDataProvider.ts`を更新
2. ビジネスロジックは必ず`src/services/`に実装
3. VSCode API依存部分のみTreeDataProviderに残す

### 命名規則とベストプラクティス

- **providers/**: `*ViewProvider.ts`（例：CommentsViewProvider）
- **panels/**: `*Panel.ts`または`*WebviewPanel.ts`（例：ProjectSettingsWebviewPanel）
- **tree/**: `*TreeDataProvider.ts`（例：DialogoiTreeDataProvider）
- **webview/components/**: PascalCase（例：FileDetailsApp）

### よくある間違いと回避方法

❌ **間違い**: providers/にメインエディタ用のパネルを作成
✅ **正解**: panels/にメインエディタ用パネルを作成

❌ **間違い**: tree/にビジネスロジックを実装
✅ **正解**: services/にビジネスロジックを実装し、tree/から呼び出す

❌ **間違い**: webview/をsrc/内に配置
✅ **正解**: webview/はプロジェクトルート直下に配置