# エディタコンテキストメニューからのコメント追加機能実装計画書

**🎉 実装完了済み（2025-01-22）**

## 📋 概要

エディタでテキストを選択し、右クリックコンテキストメニューから直接コメントを追加できる機能を実装します。これにより、執筆中に気になった箇所に素早くコメント・TODOを追加できるようになります。

## 🎯 目標

### 主要目標
- **直感的なコメント追加**: テキスト選択→右クリック→コメント追加の自然なワークフロー
- **既存機能との統合**: 現在のコメントシステムとシームレスに連携
- **即座の編集開始**: コメント作成後、WebViewパネルで即座に内容編集可能

### ユーザーエクスペリエンス目標
- エディタからコメントパネルへの切り替え作業を削減
- 執筆フローを中断しない素早いコメント追加
- VSCode標準のコンテキストメニューによる一貫した操作感

## 🔍 現状分析

### ✅ 既存実装（活用可能）
1. **CommentService完備**
   - `addCommentAsync()` メソッドで行番号指定によるコメント追加
   - GitHub風行番号形式（#L42, #L4-L7）対応済み
   - ファイルハッシュ計算・posted_by自動取得機能

2. **CommentsViewProvider完備**
   - WebView更新機能とリアルタイム表示
   - コメント編集・削除・ステータス変更機能
   - TreeDataProviderとの連携

3. **DI アーキテクチャ**
   - ServiceContainer による依存関係管理
   - テスト可能な設計

### 🔧 追加実装が必要な機能
1. **エディタコンテキストメニュー**: package.json での menu 定義
2. **新コマンド実装**: 選択範囲からのコメント追加コマンド
3. **WebViewフォーカス制御**: コメント作成後の編集開始

## 🛠️ 実装計画

### Phase 1: package.json拡張とコマンド登録 ✅ **実装対象**

#### 1.1 package.json 更新
```json
{
  "contributes": {
    "commands": [
      {
        "command": "dialogoi.addCommentFromSelection",
        "title": "ここにコメントを追加"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "command": "dialogoi.addCommentFromSelection",
          "when": "editorHasSelection && dialogoi:hasNovelProject",
          "group": "dialogoi@1"
        }
      ]
    }
  }
}
```

**実装内容:**
- [x] 新コマンド `dialogoi.addCommentFromSelection` の定義
- [x] エディタコンテキストメニューへの追加
- [x] 条件設定（テキスト選択時 + Dialogoiプロジェクト内）

#### 1.2 コマンド条件の詳細設計
```typescript
// 表示条件
when: "editorHasSelection && dialogoi:hasNovelProject"

// 条件の意味：
// - editorHasSelection: テキストが選択されている
// - dialogoi:hasNovelProject: Dialogoiプロジェクト内のファイル
```

### Phase 2: エディタ選択範囲取得とコマンド実装 ✅ **実装対象**

#### 2.1 新コマンドファイル作成
```typescript
// src/commands/editorCommentCommands.ts
export function registerEditorCommentCommands(
  context: vscode.ExtensionContext
): void {
  const addCommentFromSelectionCommand = vscode.commands.registerCommand(
    'dialogoi.addCommentFromSelection',
    async () => {
      await handleAddCommentFromSelection();
    }
  );
  
  context.subscriptions.push(addCommentFromSelectionCommand);
}

async function handleAddCommentFromSelection(): Promise<void> {
  // 1. アクティブエディタの取得
  // 2. 選択範囲の取得（行番号）
  // 3. ファイルパスの相対パス変換
  // 4. CommentServiceでコメント追加
  // 5. WebViewの更新とフォーカス
}
```

**実装内容:**
- [x] アクティブエディタの選択範囲取得
- [x] 行番号の1-based変換
- [x] プロジェクトルートからの相対パス計算
- [x] 既存CommentService の活用

#### 2.2 エディタAPI活用の詳細
```typescript
// アクティブエディタと選択範囲の取得
const activeEditor = vscode.window.activeTextEditor;
if (!activeEditor) return;

const selection = activeEditor.selection;
const startLine = selection.start.line + 1; // 0-based → 1-based
const endLine = selection.end.line + 1;
const document = activeEditor.document;
const absoluteFilePath = document.uri.fsPath;

// 選択範囲の判定
const isMultiLine = startLine !== endLine;
const commentOptions: CreateCommentOptions = {
  line: startLine,
  endLine: isMultiLine ? endLine : undefined,
  content: '' // 空のコンテンツで作成
};
```

### Phase 3: WebView連携とユーザーエクスペリエンス向上 ✅ **実装対象**

#### 3.1 CommentsViewProvider拡張
```typescript
// src/providers/CommentsViewProvider.ts の拡張
export class CommentsViewProvider {
  /**
   * 新しいコメント追加後にWebViewを更新し、編集開始状態にする
   */
  async addCommentAndStartEditing(
    relativePath: string, 
    options: CreateCommentOptions
  ): Promise<void> {
    // 1. コメント追加
    await commentService.addCommentAsync(relativePath, options);
    
    // 2. WebView表示切り替え（対象ファイル）
    await this.updateCurrentFile(relativePath);
    
    // 3. 最後に追加されたコメントの編集開始
    this.startEditingLastComment();
  }
}
```

**実装内容:**
- [x] コメント追加とWebView更新の統合メソッド
- [x] 追加されたコメントの編集モード自動開始
- [x] WebViewパネルの自動フォーカス

#### 3.2 WebView編集開始機能
```typescript
// WebViewに新しいメッセージタイプを追加
interface WebViewMessage {
  type: 'startEditingComment';
  payload: {
    commentIndex: number; // 編集開始するコメントのインデックス
  };
}

// React側での処理
const handleStartEditing = (commentIndex: number): void => {
  // 指定されたコメントを編集モードに切り替え
  setEditingCommentIndex(commentIndex);
  setIsEditing(true);
  // textareaにフォーカス
};
```

### Phase 4: テスト実装と品質保証 ✅ **実装対象**

#### 4.1 単体テスト
```typescript
// src/commands/editorCommentCommands.test.ts
suite('editorCommentCommands', () => {
  test('選択範囲からコメントを追加する', async () => {
    // Mock VSCode API
    // 選択範囲の設定
    // コマンド実行
    // CommentService呼び出し確認
  });
  
  test('単一行選択の場合', async () => {
    // 単一行選択のテスト
  });
  
  test('複数行選択の場合', async () => {
    // 複数行選択のテスト
  });
});
```

#### 4.2 統合テスト
- VSCode環境でのコンテキストメニュー表示確認
- コメント追加→WebView更新→編集開始の一連のフロー確認
- 異なるファイルタイプでの動作確認

## 📋 タスクリスト

### Phase 1: 基盤整備（1日） ✅ **実装対象**
- [ ] **package.json 更新**
  - [ ] 新コマンド `dialogoi.addCommentFromSelection` の定義
  - [ ] `editor/context` メニューへの追加
  - [ ] 表示条件の設定
- [ ] **extension.ts 更新**
  - [ ] 新コマンドモジュールのインポートと登録

### Phase 2: コマンド実装（1-2日） ✅ **実装対象**
- [ ] **editorCommentCommands.ts 新規作成**
  - [ ] `handleAddCommentFromSelection` 関数の実装
  - [ ] アクティブエディタ取得とエラーハンドリング
  - [ ] 選択範囲の行番号取得（1-based変換）
  - [ ] 絶対パス→相対パス変換
  - [ ] CommentService連携
- [ ] **エラーハンドリング**
  - [ ] エディタ未選択時の処理
  - [ ] Dialogoiプロジェクト外ファイルの処理
  - [ ] ファイル保存状態チェック

### Phase 3: WebView連携（1日） ✅ **実装対象**
- [ ] **CommentsViewProvider 拡張**
  - [ ] `addCommentAndStartEditing` メソッド追加
  - [ ] 最後に追加されたコメントの編集開始機能
  - [ ] WebViewパネルフォーカス制御
- [ ] **React WebView 拡張**
  - [ ] `startEditingComment` メッセージタイプ追加
  - [ ] 指定コメントの編集モード切り替え
  - [ ] textareaの自動フォーカス

### Phase 4: テストと品質確保（1日） ✅ **実装対象**
- [ ] **単体テスト実装**
  - [ ] editorCommentCommandsのテスト
  - [ ] 選択範囲取得ロジックのテスト
  - [ ] エラーケースのテスト
- [ ] **統合テスト**
  - [ ] VSCode環境での動作確認
  - [ ] 複数ファイル・複数プロジェクトでの動作確認
- [ ] **品質チェック**
  - [ ] `npm run check-all` 実行
  - [ ] ESLint・Prettier準拠確認

## 🎯 成功基準

### Phase 1 完了基準
- [ ] package.json でコンテキストメニューが正しく定義される
- [ ] VSCode拡張機能として新コマンドが認識される
- [ ] Dialogoiプロジェクト内でテキスト選択時にメニューが表示される

### Phase 2 完了基準
- [ ] テキスト選択→右クリック→コメント追加が動作する
- [ ] 単一行・複数行選択の両方に対応
- [ ] 既存CommentServiceと正しく連携する
- [ ] エラーケースが適切に処理される

### Phase 3 完了基準
- [ ] コメント追加後、WebViewパネルが自動更新される
- [ ] 新しく追加されたコメントが即座に編集可能になる
- [ ] ユーザーがスムーズにコメント内容を入力できる

### Phase 4 完了基準
- [ ] 全テストが通過する（95%以上のカバレッジ）
- [ ] `npm run check-all` が成功する
- [ ] 実際のVSCode環境での動作が安定している

## 📈 期待効果

### 執筆効率向上
- **シームレスなコメント追加**: エディタ→コメントパネルの画面切り替え不要
- **執筆フロー維持**: 思考の中断を最小限に抑制
- **直感的操作**: VSCode標準UIによる学習コストゼロ

### 機能統合によるメリット
- **既存アーキテクチャ活用**: 新しいサービス層の実装不要
- **保守性向上**: 既存テストの資産活用
- **一貫したUX**: 他のコメント機能と統一された操作感

### 将来の拡張可能性
- **AI連携**: 選択テキストを基にしたAIコメント生成
- **他の機能との統合**: 参照追加、タグ付けなどへの展開
- **共同執筆サポート**: 編集者からのコメント受信機能

---

## ✅ 実装方針

### アーキテクチャ準拠
- **依存関係注入パターン**: 既存のServiceContainer活用
- **Repository パターン**: FileRepository経由でのファイル操作
- **TypeScript strict mode**: 型安全性の確保

### 品質保証
- **テスト駆動開発**: 先にテストケースを作成
- **段階的実装**: Phase毎の動作確認
- **CI/CD準拠**: `npm run check-all` による品質チェック

この計画に従って段階的に実装を進め、各Phase完了時に動作確認とテストを行います。

---

## 🎉 実装結果（2025-01-22完了）

### ✅ 完了した機能

#### 📝 基本機能
- **エディタ右クリックメニュー**: テキスト選択時に「ここにコメントを追加」メニュー表示
- **プロジェクトルート自動検出**: ファイルから上向き検索でdialogoi.yamlを発見
- **GitHub風行番号対応**: 単一行（#L42）・複数行（#L4-L7）形式でコメント作成

#### 🔥 UX改善機能
- **選択テキスト自動引用**: 選択されたテキストが `> ` 付きで引用形式に自動変換
- **コメントパネル即座更新**: コメント追加と同時にWebViewパネルが自動更新
- **自動編集モード開始**: 新しく作成されたコメントの編集が即座に開始
- **空コメントバリデーション**: 引用のみで内容がない場合の警告表示

#### 🎨 UI改善
- **コメント間視覚分離**: 影効果・余白増加・グラデーション区切り線
- **ホバーインタラクション**: マウスオーバーで立体感とアニメーション
- **ステータス強化**: 未完了/完了状態のカラーバー拡大

### 📊 技術成果

#### 🔧 解決した技術課題
- **パス検索問題**: `MetaYamlService.findNovelRootAsync`（下向き）→`DialogoiYamlService.findProjectRootAsync`（上向き）
- **パネル更新問題**: 同一ファイルでのスキップ機能を迂回し、強制再読み込み実装
- **型安全性**: プロジェクトルートとファイルパスの適切な型管理

#### 📈 品質指標
- **テストカバレッジ**: 9テストケース全て通過
- **型チェック**: TypeScript strict mode 準拠
- **コード品質**: ESLint・Prettier全チェック通過

### 💡 実装で得られた知見

#### 🏗️ アーキテクチャ面
- VSCode APIとビジネスロジックの適切な分離の重要性
- 依存関係注入パターンによるテスタビリティ向上
- WebViewとExtension間の型安全なメッセージング

#### 🎯 UX設計面
- エディタからコメントパネルへの自然な連携の価値
- 引用機能による文脈保持の効果
- 即座のフィードバックがユーザー体験に与える影響

この機能により、小説執筆中の思いついたアイデアや修正点を瞬時に記録できるワークフローが実現されました。