# プロジェクト設定視覚的編集画面 実装計画

## 概要

現在のYAML直接編集の代替として、ユーザーフレンドリーなWebViewベースの視覚的編集画面を実装する。

## 現状分析

### 既存機能
- **dialogoi.yaml構造**: title, author, version, created_at, tags, updated_at, project_settings
- **編集コマンド**: `dialogoi.editProjectSettings` - YAML直接編集
- **バリデーション**: DialogoiYamlUtils による型安全性とバリデーション
- **サービス**: DialogoiYamlService でCRUD操作

### 問題点
- YAMLファイル直接編集は技術的で一般ユーザーに難しい
- 即座のバリデーション フィードバックが不足
- project_settings の編集が特に複雑

## UI設計

### WebView構成要素

#### 1. 基本情報セクション
```html
<div class="section">
  <span class="section-title">📖 基本情報</span>
  <div class="form-group">
    <label>タイトル *</label>
    <input type="text" id="title" required />
    <span class="error-message" id="title-error"></span>
  </div>
  <div class="form-group">
    <label>著者 *</label>
    <input type="text" id="author" required />
    <span class="error-message" id="author-error"></span>
  </div>
  <div class="form-group">
    <label>バージョン *</label>
    <input type="text" id="version" pattern="\\d+\\.\\d+\\.\\d+" placeholder="1.0.0" />
    <span class="error-message" id="version-error"></span>
  </div>
</div>
```

#### 2. タグ管理セクション
```html
<div class="section">
  <span class="section-title">🏷️ タグ</span>
  <div class="tags-container" id="tags-container">
    <!-- 動的生成 -->
  </div>
  <div class="add-tag-form">
    <input type="text" id="new-tag" placeholder="新しいタグを入力" />
    <button onclick="addTag()">追加</button>
  </div>
</div>
```

#### 3. プロジェクト設定セクション
```html
<div class="section">
  <span class="section-title">⚙️ プロジェクト設定</span>
  <div class="form-group">
    <label>READMEファイル名</label>
    <input type="text" id="readme-filename" placeholder="README.md" />
    <span class="help-text">ディレクトリクリック時に開くファイル名</span>
  </div>
  <div class="form-group">
    <label>除外パターン</label>
    <div class="exclude-patterns" id="exclude-patterns">
      <!-- 動的生成 -->
    </div>
    <div class="add-pattern-form">
      <input type="text" id="new-pattern" placeholder="例: *.tmp" />
      <button onclick="addExcludePattern()">追加</button>
    </div>
    <span class="help-text">ファイルスキャン時に除外するパターン（glob形式）</span>
  </div>
</div>
```

#### 4. 操作ボタン
```html
<div class="actions">
  <button class="primary" onclick="saveSettings()">💾 保存</button>
  <button class="secondary" onclick="cancelEdit()">❌ キャンセル</button>
  <button class="tertiary" onclick="openYamlEditor()">📝 YAML直接編集</button>
</div>
```

## 実装アーキテクチャ

### 1. ProjectSettingsViewProvider

```typescript
export class ProjectSettingsViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private context: vscode.ExtensionContext,
    private dialogoiYamlService: DialogoiYamlService,
    private logger: Logger
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void
  
  private generateProjectSettingsHTML(settings: DialogoiYaml): string
  private handleWebviewMessage(message: ProjectSettingsMessage): void
  
  // メッセージハンドラ
  private handleSaveSettings(data: DialogoiYaml): void
  private handleValidateField(field: string, value: string): void
  private handleOpenYamlEditor(): void
}
```

### 2. WebView ⟷ Extension メッセージング

```typescript
interface ProjectSettingsMessage {
  command: 'saveSettings' | 'validateField' | 'openYamlEditor' | 'ready';
  data?: DialogoiYaml | { field: string; value: string };
}
```

### 3. リアルタイムバリデーション

- フィールド変更時の即座バリデーション
- DialogoiYamlUtils.validateDialogoiYaml の活用
- エラーメッセージの即座表示

## 実装フェーズ

### Phase 1: 基盤実装
- [ ] ProjectSettingsViewProvider基本クラス
- [ ] WebViewの初期HTML生成
- [ ] 基本的なメッセージング

### Phase 2: フォーム機能実装
- [ ] 基本情報編集（title, author, version）
- [ ] リアルタイムバリデーション
- [ ] 保存・キャンセル機能

### Phase 3: 高度な機能
- [ ] タグ管理（追加・削除・編集）
- [ ] プロジェクト設定編集
- [ ] YAML直接編集への切り替え

### Phase 4: UI/UX改善
- [ ] スタイリング改善
- [ ] エラーハンドリング強化
- [ ] 操作ガイダンス

## 技術仕様

### CSP設定
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               script-src 'unsafe-inline'; 
               style-src 'unsafe-inline';">
```

### スタイル統一
- FileDetailsViewProvider と同様のスタイル基準
- VSCode テーマ連携
- レスポンシブ対応

## テスト計画

### 単体テスト
- DialogoiYaml の読み書き
- バリデーション機能
- メッセージハンドリング

### 統合テスト
- WebView ⟷ Extension 通信
- ファイル保存・読み込み
- エラーケース処理

## 完了条件

- [ ] GUI でプロジェクト設定の全項目が編集可能
- [ ] リアルタイムバリデーション動作
- [ ] YAML直接編集との切り替えが可能
- [ ] 既存機能との互換性維持
- [ ] 包括的なテストカバレッジ