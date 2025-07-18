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

- **TypeScript** - 型安全性を確保した開発
- **VSCode Extension API** - Extension の基盤
- **Node.js** - 実行環境（VSCode内蔵）

### 主要ライブラリ

- **js-yaml** ✅ - YAMLファイルの読み書き（実装済み）
- **mocha + tsx** ✅ - テストフレームワーク（実装済み）
- **crypto (Node.js標準)** ✅ - SHA-256ハッシュ計算（実装済み）
- **micromatch** ✅ - glob パターンマッチング（実装済み）
- **ajv** (予定) - YAMLスキーマのバリデーション
- **React** (WebView用・予定) - リッチなUI構築用
- **青空文庫パーサー** (予定) - 将来的な実装予定

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│                  VSCode Extension                │
├─────────────────────────────────────────────────┤
│  Presentation Layer                             │
│  ├─ TreeDataProvider (左サイドバー)             │
│  │   └─ TreeDragAndDropController ✅ (D&D対応)  │
│  ├─ WebView Provider (詳細画面)                 │
│  └─ Commands (コマンドパレット)                 │
├─────────────────────────────────────────────────┤
│  Business Logic Layer                           │
│  ├─ CharacterService ✅ (キャラクター管理)      │
│  ├─ ForeshadowingService ✅ (伏線管理)          │
│  ├─ ReferenceManager ✅ (参照関係管理)          │
│  ├─ ReviewService ✅ (レビュー管理)             │
│  ├─ HashService ✅ (ハッシュ計算)               │
│  ├─ MetaYamlUtils ✅ (meta.yaml管理)            │
│  ├─ DialogoiYamlService ✅ (dialogoi.yaml管理)  │
│  ├─ ProjectCreationService ✅ (プロジェクト作成) │
│  ├─ File Watcher (予定) (ファイル監視)          │
│  └─ Validation Service (バリデーション)         │
├─────────────────────────────────────────────────┤
│  Abstraction Layer ✅ (DI Container)            │
│  ├─ ServiceContainer (DI管理)                  │
│  ├─ VSCodeServiceContainer (本番環境)          │
│  └─ TestServiceContainer (テスト環境)          │
├─────────────────────────────────────────────────┤
│  Data Access Layer ✅ (Repository Pattern)     │
│  ├─ FileRepository ✅ (抽象基底クラス)         │
│  ├─ VSCodeFileRepository ✅ (本番実装)         │
│  ├─ MockFileRepository ✅ (テスト実装)         │
│  ├─ Uri Interface                               │
│  ├─ YAML Parser/Writer                          │
│  └─ Cache Manager                               │
└─────────────────────────────────────────────────┘
```

## 依存関係注入（DI）アーキテクチャ ✅

### 設計思想

このプロジェクトでは **VSCode依存の局所化** と **テスト可能性の向上** を目的として、依存関係注入（Dependency Injection）パターンを採用しています。

### 主要な抽象化レイヤー

#### 1. FileRepository (抽象基底クラス)
```typescript
export abstract class FileRepository {
  abstract existsSync(uri: Uri): boolean;
  abstract readFileSync(uri: Uri, encoding?: BufferEncoding): string;
  abstract writeFileSync(uri: Uri, data: string | Buffer, encoding?: BufferEncoding): void;
  // ... その他のファイル操作メソッド
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
- `vscode.workspace.fs` およびNode.js `fs` モジュールを使用
- 実際のファイルシステムとの相互作用を担当
- VSCode環境でのみ動作

#### 2. MockFileRepository (テスト環境)
- インメモリでファイルシステムを模擬
- 単体テストでの高速実行を実現
- VSCode環境に依存しない

### DI Container

#### ServiceContainer
```typescript
export class ServiceContainer {
  private static instance: ServiceContainer;
  
  getFileRepository(): FileRepository { ... }
  getCharacterService(): CharacterService { ... }
  getForeshadowingService(): ForeshadowingService { ... }
  // ... その他のサービス取得メソッド
}
```

#### VSCodeServiceContainer (本番環境初期化)
```typescript
export class VSCodeServiceContainer {
  static async initialize(): Promise<ServiceContainer> {
    const container = ServiceContainer.getInstance();
    const fileRepository = new VSCodeFileRepository();
    container.setFileRepository(fileRepository);
    return container;
  }
}
```

#### TestServiceContainer (テスト環境初期化)
```typescript
export class TestServiceContainer {
  static create(): ServiceContainer {
    const container = new ServiceContainer();
    const mockFileRepository = new MockFileRepository();
    container.setFileRepository(mockFileRepository);
    return container;
  }
}
```

### 利点

1. **テスト可能性**: MockFileRepositoryにより、ファイルシステムに依存しない高速なテストが可能
2. **VSCode依存の局所化**: ビジネスロジックからVSCode固有のコードを分離
3. **保守性**: インターフェースを変更せずに実装を差し替え可能
4. **型安全性**: TypeScriptの型システムを活用した安全なコード
5. **Repository パターン**: データアクセスロジックを抽象化する標準的なパターン

### 使用方法

#### サービスクラスでの使用
```typescript
export class CharacterService {
  constructor(private fileRepository: FileRepository) {}
  
  extractDisplayName(fileAbsolutePath: string): string {
    const uri = this.fileRepository.createFileUri(fileAbsolutePath);
    if (this.fileRepository.existsSync(uri)) {
      const content = this.fileRepository.readFileSync(uri, 'utf8');
      // ... 処理
    }
    return fileName;
  }
}
```

#### 拡張機能での初期化
```typescript
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // VSCode環境でServiceContainerを初期化
  await VSCodeServiceContainer.initialize();
  
  // 以降、ServiceContainerから各サービスを取得して使用
  const treeDataProvider = new DialogoiTreeDataProvider();
  // ...
}
```

## 主要コンポーネント

### 1. TreeDataProvider ✅

- 小説の階層構造をツリー表示（実装済み）
- `meta.yaml` に基づいた順序制御（実装済み）
- アイコンによる視覚的な種別表示（実装済み）
- ツールチップによる詳細情報表示（実装済み）
- ドラッグ&ドロップによる並び替え（予定）

### 2. WebView Provider

- ファイル詳細情報の表示・編集
- タグ管理UI
- 参照関係の可視化
- 将来的にはプレビュー機能も実装

### 3. File System Watcher

- ファイルの変更を監視
- `meta.yaml` との同期を維持
- 外部エディタでの変更にも対応

### 4. Metadata Manager ✅

- `meta.yaml` の読み書き（実装済み）
- 基本的なバリデーション（実装済み）
- 参照整合性チェック（実装済み）
- 高度なスキーマバリデーション（予定）

### 5. ReferenceManager ✅

- シングルトンパターンによる参照関係の一元管理（実装済み）
- 双方向参照の自動追跡（実装済み）
- ファイル存在チェック機能（実装済み）
- Map構造による高速な参照関係検索（実装済み）

### 6. FileRepository ✅ (旧 FileOperationService)

- ファイル・ディレクトリの作成・削除・名前変更（実装済み）
- タグ操作（追加・削除・一括設定）（実装済み）
- 参照操作（追加・削除・一括設定）（実装済み）
- アトミックなmeta.yaml更新（実装済み）
- Repository パターンによるデータアクセス層の抽象化（実装済み）

### 7. ReviewService ✅

- レビューファイルの作成・読み込み・保存（実装済み）
- レビュー追加・更新・削除操作（実装済み）
- レビューステータス管理（実装済み）
- スレッド機能（コメント追加）（実装済み）
- レビューサマリー生成（実装済み）

### 8. HashService ✅

- SHA-256ハッシュ計算（実装済み）
- ファイル内容の変更検知（実装済み）
- ハッシュ値の解析・比較（実装済み）

## データフロー

1. **初期化**
   - Extension 起動時に小説ルートディレクトリを検索
   - `dialogoi.yaml` の存在確認とプロジェクトルート特定
   - `meta.yaml` を再帰的に読み込み

2. **表示**
   - TreeDataProvider がメタデータを元にツリー構築
   - ユーザーがノードを選択
   - WebView または標準エディタで内容表示

3. **更新**
   - ユーザーが変更を加える
   - Metadata Manager が `meta.yaml` を更新
   - File Watcher が変更を検知してUIを更新

## 開発計画

### Phase 1: 基本機能実装 (MVP) ✅ **完了**
- [x] Extension の基本構造構築
- [x] TreeView による階層表示
- [x] `meta.yaml` の読み書き
- [x] 基本的なファイル操作（作成、削除、並び替え）
- [x] ファイル名変更機能
- [x] 包括的なテストスイート

### Phase 2: メタデータ管理 ✅ **完了**
- [x] タグシステムの実装
- [x] 参照関係の管理
- [x] ファイルハッシュ変更検知システム
- [x] レビュー機能の基本実装
- [x] dialogoi.yaml の仕様策定と実装
- [x] プロジェクト新規作成機能の実装

### Phase 3: 高度な機能
- [ ] WebView による詳細画面
- [ ] 伏線管理の可視化
- [ ] 検索・フィルタリング機能

### Phase 4: 外部連携
- [ ] Dialogoi MCP サーバとの連携
- [ ] エクスポート機能
- [ ] プレビュー機能

## セキュリティ考慮事項

- ファイルアクセスは指定されたディレクトリ内に制限
- YAMLパース時のインジェクション対策
- WebView でのXSS対策

## パフォーマンス考慮事項

- 大規模な小説（数百話）への対応
- `meta.yaml` のキャッシング
- 遅延読み込みの実装
- ファイル監視の最適化

## 拡張性

- プラグインアーキテクチャの検討
- カスタムメタデータフィールドの追加
- 外部ツールとの連携API