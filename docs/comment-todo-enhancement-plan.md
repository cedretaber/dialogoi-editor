# 行単位コメント・TODO機能改善計画書

## 📋 概要

現在のレビュー機能を基盤として、より汎用的な「行単位コメント・TODO機能」として再設計します。単独作業でも協業でも活用できる、シンプルで実用的なコメント・タスク管理機能を実現します。

## 🎯 目標

### 主要目標
- **汎用的な機能設計**: レビュー・TODO・メモを「行単位コメント」として統一管理
- **独立したUI配置**: サイドバー内での専用パネル表示（ファイル詳細パネルの下）
- **シンプルな操作**: 複雑な設定を排除した直感的インターフェース
- **一人作業対応**: 協業がなくても有用なメモ・TODO機能

### ユーザーエクスペリエンス目標
- ファイル詳細パネルとは独立した専用領域
- レビュー・TODO・メモの区別のない統一操作
- コマンドパレット不要の直接操作
- 単独執筆でも価値のある機能

## 🔍 現状分析

### ✅ 既存実装（維持・活用）
1. **データモデル完備**
   - `Review.ts`: 基本的な型定義（簡略化して活用）
   - ReviewService: CRUD操作（CommentServiceとして改名・簡略化）

2. **バックエンドサービス完備**
   - ファイルハッシュによる変更検知
   - .dialogoi-meta.yamlとの自動連携
   - YAML形式でのデータ永続化

3. **基本コマンド実装**
   - `reviewCommands.ts`: 基本操作（簡略化して活用）

### 🔧 課題と新しい方向性
1. **UI配置の問題**: ファイル詳細内では狭く、独立性が低い
2. **機能の複雑性**: レビュー専用で、一人作業時の価値が限定的
3. **設定の煩雑さ**: レビュアー・種別設定が不要な複雑さを生む
4. **用途の限定性**: 協業前提で、個人のメモ・TODOに不向き

### 💡 新しいアプローチ
- **専用パネル化**: サイドバー内の独立したコメント・TODOパネル
- **機能統合**: レビュー・TODO・メモを「行単位コメント」として統一
- **設定簡略化**: レビュアー・種別を固定値に（拡張性は保持）
- **範囲拡張**: 複数行対応の実装（将来的に桁指定も検討）

## 🛠️ 実装計画

### Phase 1: 専用コメントパネルの作成 ✅ **2025-01-24完了**
**目標**: サイドバー内の独立したコメント・TODOパネル

#### 1.1 新しいWebViewProvider作成 ✅
```typescript
// src/providers/CommentsViewProvider.ts
export class CommentsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'dialogoi-comments';
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly commentService: CommentService // ReviewServiceをリネーム・簡略化
  ) {}
}
```

**実装内容:**
- [x] 独立したWebViewProviderを作成
- [x] package.jsonでサイドバーへの配置設定
- [x] ファイル詳細パネルとは分離した専用UI
- [x] 現在選択中ファイルのコメント自動表示

#### 1.2 データモデルの簡略化 ✅
```typescript
// src/models/Comment.ts (Review.tsから改名・簡略化)
export interface CommentItem {
  line: number;
  endLine?: number; // 複数行対応
  content: string;
  status: 'open' | 'resolved'; // シンプル化（2状態のみ）
  created_at: string;
  updated_at?: string;
  // reviewer: 'user' (固定値)
  // type: 'user' (固定値)
}

export interface CreateCommentOptions {
  line: number;
  endLine?: number; // 複数行の場合
  content: string;
}

export interface CommentFile {
  target_file: string;
  file_hash: string;
  comments: CommentItem[]; // reviewsから改名
}
```

#### 1.3 package.json設定の追加 ✅
```json
{
  "contributes": {
    "views": {
      "dialogoi-explorer": [
        {
          "id": "dialogoi-file-details",
          "name": "ファイル詳細",
          "type": "webview",
          "when": "dialogoi.projectFound"
        },
        {
          "id": "dialogoi-comments",
          "name": "コメント・TODO",
          "type": "webview",
          "when": "dialogoi.projectFound"
        }
      ]
    }
  }
}
```

**実装内容:**
- [x] サイドバー内にコメント専用パネル追加
- [x] ファイル詳細パネルの下に配置
- [x] 独立したスクロール領域
- [x] 現在ファイルのコメント自動表示

#### 1.4 CommentServiceとDI統合の完了 ✅
- [x] ReviewServiceからCommentServiceへリネーム・簡略化
- [x] ServiceContainerとTestServiceContainerへの統合
- [x] extension.tsでの登録とTreeDataProviderとの連携
- [x] 依存関係注入パターンによる疎結合設計

#### 1.5 React WebViewアーキテクチャの実装 ✅
- [x] CommentsApp Reactコンポーネントの作成
- [x] VSCode WebView API連携（useVSCodeApi hook）
- [x] TypeScript型安全なメッセージング
- [x] コメント追加・削除・ステータス切り替え機能
- [x] エラーハンドリングとバリデーション

#### 1.6 包括的テスト実装 ✅
- [x] CommentService単体テスト（25 tests）
- [x] CommentsApp Reactコンポーネントテスト（44 tests）
- [x] MockFileRepositoryとTestServiceContainer連携
- [x] React Testing Libraryベースの結合テスト
- [x] VSCode WebView通信テスト

### Phase 2: シンプルなコメント管理UI
**目標**: 簡潔で使いやすいコメント追加・管理機能

#### 2.1 CommentItem コンポーネント作成
```typescript
// webview/components/CommentItem.tsx
interface CommentItemProps {
  comment: CommentItem;
  index: number;
  onToggleStatus: (index: number) => void;
  onDelete: (index: number) => void;
  onEdit: (index: number, content: string) => void;
  onJumpToLine: (line: number, endLine?: number) => void;
  onToggleEditMode: () => void;
  isEditing: boolean;
}

interface CommentItemState {
  isEditing: boolean;
  editContent: string;
  showPreview: boolean;
}
```

**実装内容:**
- [ ] プレビュー・編集モードの切り替え機能
- [ ] マークダウンレンダリング表示
- [ ] インライン編集モード（textarea + プレビュー）
- [ ] TODOチェックボックスのインタラクティブ操作
- [ ] 行番号表示（単一行・複数行対応）
- [ ] ステータス切り替え（open ⇔ resolved のトグル）
- [ ] 削除確認機能
- [ ] 行番号クリックでファイル内ジャンプ
- [ ] マークダウン内チェックボックスの状態同期

#### 2.2 マークダウン対応とTODO機能
**マークダウンレンダリング:**
- [ ] 基本的な書式設定（**太字**、*斜体*、`コード`）
- [ ] チェックボックス対応（`- [ ] TODO項目`、`- [x] 完了項目`）
- [ ] リスト表示（番号付き・箇条書き）
- [ ] インラインコード・コードブロック対応

**TODO機能統合:**
- [ ] マークダウンチェックボックスの自動認識
- [ ] チェックボックスクリックでの状態切り替え
- [ ] TODOリスト形式での表示・管理
- [ ] 進捗表示（完了/全体の比率）

**視覚的表現:**
- [ ] 📝 未完了 (open) - 青色・円形チェックボックス
- [ ] ✅ 完了 (resolved) - 緑色・チェック済み
- [ ] マークダウンプレビューとソース表示の切り替え

**行番号表示:**
- [ ] 単一行: `行42` - クリック可能なリンク
- [ ] 複数行: `行42-45` - クリック可能なリンク
- [ ] ホバー時にファイル内容のプレビュー表示（将来的）

**コメント表示・編集:**
- [ ] プレビューモード（マークダウンレンダリング表示）
- [ ] 編集モード（生テキスト編集）
- [ ] ダブルクリックまたは編集ボタンで編集モード切り替え
- [ ] リアルタイムプレビュー（編集中の即座な反映）
- [ ] 長いコメントの折りたたみ表示
- [ ] 作成・更新日時の表示

#### 2.3 AddCommentForm コンポーネント作成
```typescript
interface AddCommentFormProps {
  onSubmit: (options: CreateCommentOptions) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  currentLine?: number; // エディタの現在行を自動入力
}
```

**実装内容:**
- [ ] 行番号入力（単一行・範囲対応）
- [ ] マークダウン対応コメント入力エリア
- [ ] リアルタイムプレビュー表示
- [ ] TODOテンプレート挿入ボタン（`- [ ] `自動挿入）
- [ ] バリデーション（行番号・コメント内容）
- [ ] エディタの現在行自動取得・入力
- [ ] マークダウンツールバー（太字・斜体・チェックボックス）

### Phase 3: VSCode統合とファイル連携
**目標**: エディタとの密接な連携機能

#### 3.1 エディタ連携機能
```typescript
// src/services/EditorIntegrationService.ts
export class EditorIntegrationService {
  getCurrentLine(): number | null;
  jumpToLine(line: number, endLine?: number): void;
  getSelectedRange(): { startLine: number; endLine: number } | null;
  addInlineComment(line: number, comment: string): void; // 将来的
}
```

**実装内容:**
- [ ] 現在のカーソル行自動取得
- [ ] コメント対象行へのジャンプ機能
- [ ] 選択範囲の自動取得（複数行コメント用）
- [ ] アクティブエディタ変更時のコメント自動更新

#### 3.2 ファイル変更検知の改善
```typescript
interface FileWatcherService {
  onFileChanged(callback: (filePath: string) => void): vscode.Disposable;
  isFileChanged(filePath: string): Promise<boolean>;
  updateFileHash(filePath: string): Promise<void>;
}
```

**実装内容:**
- [ ] ファイル保存時の自動ハッシュ更新
- [ ] コメント対象行の変更検知
- [ ] 行番号ずれの警告表示
- [ ] 変更されたファイルの一括ハッシュ更新機能

#### 3.3 コマンド統合
```typescript
// 既存のreviewCommandsを改名・簡略化
export function registerCommentCommands(
  context: vscode.ExtensionContext,
  workspaceRoot: vscode.Uri
): void {
  // 簡略化されたコマンド
  const addCommentCommand = vscode.commands.registerCommand(
    'dialogoi.addComment',
    async () => { /* 現在行にコメント追加 */ }
  );
  
  const toggleCommentCommand = vscode.commands.registerCommand(
    'dialogoi.toggleComment',
    async () => { /* 現在行のコメント状態切り替え */ }
  );
}
```

**実装内容:**
- [ ] 右クリックメニューからのコメント追加
- [ ] キーボードショートカット対応
- [ ] コマンドパレットからの操作
- [ ] 複雑な設定項目の除去

### Phase 4: テスト実装とドキュメント更新
**目標**: 品質保証と保守性確保

#### 4.1 Reactコンポーネントテスト
```typescript
// webview/components/CommentItem.test.tsx
suite('CommentItem コンポーネント', () => {
  test('コメントが正しく表示される', () => {
    const comment: CommentItem = {
      line: 42,
      content: 'テストコメント',
      status: 'open',
      created_at: '2024-01-01T00:00:00Z'
    };
    
    render(<CommentItem comment={comment} /* ... */ />);
    
    expect(screen.getByText('行42')).toBeInTheDocument();
    expect(screen.getByText('テストコメント')).toBeInTheDocument();
  });
  
  test('ステータス切り替えが動作する', async () => {
    // テスト実装
  });
});
```

**実装内容:**
- [ ] CommentItem コンポーネントテスト
- [ ] AddCommentForm コンポーネントテスト
- [ ] CommentsApp 統合テスト
- [ ] VSCode-WebView 通信テスト

#### 4.2 Service層テスト
```typescript
// src/services/CommentService.test.ts
suite('CommentService', () => {
  test('コメント追加が正しく動作する', async () => {
    // 既存ReviewServiceテストを基にした実装
  });
  
  test('複数行コメントが正しく処理される', async () => {
    // 新機能のテスト
  });
});
```

**実装内容:**
- [ ] CommentService（旧ReviewService）テスト更新
- [ ] EditorIntegrationService テスト
- [ ] FileWatcherService テスト
- [ ] 複数行コメント機能テスト

## 📝 データ移行戦略

### 既存レビューデータの互換性
```typescript
// src/services/DataMigrationService.ts
export class DataMigrationService {
  async migrateReviewToComment(reviewFile: ReviewFile): Promise<CommentFile> {
    return {
      target_file: reviewFile.target_file,
      file_hash: reviewFile.file_hash,
      comments: reviewFile.reviews.map(review => ({
        line: review.line,
        endLine: review.position ? review.line : undefined, // 複数行は後で対応
        content: review.content,
        status: review.status === 'resolved' ? 'resolved' : 'open',
        created_at: review.created_at,
        updated_at: review.created_at
        // reviewer, type, severity は削除（固定値として内部処理）
      }))
    };
  }
}
```

**移行戦略:**
- [ ] 既存*_reviews.yamlファイルの自動検出
- [ ] 新形式への自動変換（*_comments.yamlに改名）
- [ ] 不要フィールドの削除
- [ ] バックアップ作成機能

## 🎨 UI/UXデザイン

### コメントパネルのレイアウト
```css
.comments-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
  padding-bottom: 8px;
}

.comments-list {
  flex: 1;
  overflow-y: auto;
}

.comment-item {
  border-left: 3px solid var(--comment-status-color);
  padding: 8px 12px;
  margin: 4px 0;
  background: var(--vscode-editor-background);
  border-radius: 4px;
  cursor: pointer;
}

.comment-item.status-open {
  --comment-status-color: var(--vscode-notificationsInfoIcon-foreground);
}

.comment-item.status-resolved {
  --comment-status-color: var(--vscode-testing-iconPassed);
  opacity: 0.7;
}

.comment-line-link {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  font-weight: 500;
}

.comment-line-link:hover {
  text-decoration: underline;
}

.add-comment-button {
  width: 100%;
  padding: 8px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

### レスポンシブ対応
- [ ] サイドバー幅に応じた表示調整
- [ ] 長いコメントの自動折りたたみ
- [ ] モバイルライクな操作感（VSCode Web対応）

## 📊 成功基準と実装チェックリスト

### Phase 1 完了基準 ✅ **全項目完了**
- [x] CommentsViewProvider が作成され、サイドバーに表示される
- [x] package.json でのパネル配置設定が完了
- [x] 基本的なコメント表示UI が動作する
- [x] ファイル選択時のコメント自動表示が動作する
- [x] CommentServiceが完全実装され、全テストが通過
- [x] React WebViewアーキテクチャが完成
- [x] TypeScript型安全性とESLint完全準拠

### Phase 2 完了基準
- [ ] CommentItem でのステータス切り替えが動作する
- [ ] AddCommentForm でのコメント追加が動作する
- [ ] 複数行コメント対応が実装される
- [ ] 基本的なバリデーションが動作する

### Phase 3 完了基準
- [ ] エディタとの連携（現在行取得・ジャンプ）が動作する
- [ ] ファイル変更検知が動作する
- [ ] コマンド統合が完了する
- [ ] 既存reviewCommandsからの移行が完了する

### Phase 4 完了基準
- [ ] 全コンポーネントのテストが通過する（90%以上のカバレッジ）
- [ ] データ移行機能が動作する
- [ ] `npm run check-all` が通過する
- [ ] ドキュメントが更新される

## 📈 期待効果

### 執筆効率向上
- **個人使用価値**: 協業なしでもメモ・TODO管理として活用
- **直感的操作**: 専用パネルでの一元管理
- **エディタ連携**: 現在行からの素早いコメント追加

### 機能統合によるメリット
- **学習コスト削減**: レビュー・TODO・メモの統一操作
- **UI簡素化**: 複雑な設定項目の除去
- **保守性向上**: シンプルなデータ構造

### 将来の拡張可能性
- **桁指定対応**: 行内の特定範囲へのコメント
- **プレビュー機能**: コメント対象箇所の内容表示
- **AI統合**: 自動コメント生成・整理

---

## ✅ 実装実績

### Phase 1: 専用コメントパネルの基盤完成 ✅ **2025-01-24完了**

**技術的成果:**
- **独立WebViewアーキテクチャ**: VSCode標準サイドバー準拠のコメント専用パネル
- **React統合**: TypeScript完全対応のモダンWebView実装
- **依存関係注入**: テスト可能で保守性の高いサービス層設計
- **非同期ファイル操作**: workspace.fs API完全採用による安定性向上

**アーキテクチャ詳細:**
```typescript
// サービス層の非同期対応
class CommentService {
  async addCommentAsync(relativePath: string, options: CreateCommentOptions): Promise<void>
  async loadCommentFileAsync(relativePath: string): Promise<CommentFile | null>
  async updateCommentAsync(relativePath: string, index: number, options: UpdateCommentOptions): Promise<void>
  async deleteCommentAsync(relativePath: string, index: number): Promise<void>
}

// React WebView統合
const CommentsApp: React.FC = () => {
  const vscode = useVSCodeApi();
  // TypeScript型安全なメッセージング
  useEffect(() => {
    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      // 型安全なメッセージ処理
    };
  }, []);
}
```

**品質指標:**
- **テストカバレッジ**: CommentService 25テスト + CommentsApp 44テスト = 69テスト
- **型安全性**: TypeScript strict mode + ESLint max-warnings 0
- **CI/CD対応**: `npm run check-all` 完全通過
- **コード品質**: Prettier自動フォーマット + 依存関係注入パターン

**機能完成度:**
- ✅ コメント追加・削除・ステータス切り替え
- ✅ 複数行コメント対応（line + endLine）
- ✅ ファイル変更検知とハッシュ管理
- ✅ TreeDataProvider連携による自動ファイル切り替え
- ✅ バリデーション・エラーハンドリング完備

**ユーザーエクスペリエンス:**
- 直感的なコメント追加フォーム（行番号 + 内容）
- リアルタイムエラー表示とクリア機能
- ワンクリック行ジャンプ機能
- ステータス切り替え（完了/未完了）
- ファイル選択時の自動コメント表示

---

**注**: Phase 1で確立した技術基盤により、Phase 2以降のマークダウン対応・エディタ連携・高度なUI機能の実装が可能となりました。既存のレビュー機能を完全に置き換える、実用性の高いコメント・TODO管理システムの基礎が完成しています。