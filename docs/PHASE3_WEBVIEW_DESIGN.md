# Phase 3.1: WebView詳細画面の設計仕様書

## 概要

現在のツールチップベースの情報表示を、リッチなWebView詳細画面に置き換えることで、メタデータの可視性と操作性を大幅に向上させる。

**実装状況**: ✅ **完了** - 統合UIとして実装完了

## 現在の課題

- **ツールチップの制約**: 読み取り専用で操作不可、表示領域が限定的
- **情報の見づらさ**: テキストのみ、レイアウトが固定的
- **操作性の欠如**: メタデータの編集・追加・削除ができない
- **拡張性の限界**: 新しい表示形式や機能の追加が困難

## 設計方針

### 1. 表示対象の範囲
- **小説全体のデータ**: プロジェクト統計、全体設定
- **ディレクトリのデータ**: そのディレクトリ内のファイル一覧、統計
- **ファイルのデータ**: 個別ファイルの詳細メタデータ

**表示ルール**:
- デフォルト: ファイルのデータが開かれた状態
- ルートディレクトリ選択時: 小説全体のデータが開かれた状態
- ディレクトリ選択時: ディレクトリのデータが開かれた状態

### 2. 起動トリガー
**実装結果**: Activity Bar配置による統合UI

- **メイン**: Activity Barの「Dialogoi詳細」アイコン
- **常時アクセス可能**: Activity Barアイコンクリックで即座にアクセス

**変更理由**: 統合UIにより、ファイル選択と詳細表示が1つのViewContainerで完結するため、起動トリガーが簡略化された

### 3. 表示内容と優先度

#### 3.1 ファイル詳細画面の構成（アコーディオンパネル形式）

**1. タグ一覧** （最優先、常に上部表示）
- 現在のタグを#形式で表示
- 将来的に色分け、カテゴリ分け対応
- 初期段階: シンプルな並列表示

**2. キャラクター・設定情報** （タグの下）
- キャラクター情報: 重要度、複数キャラ、表示名
- 伏線情報: start位置、goal位置
- その他個別設定ファイルの情報

**3. 参照関係** （設定情報の下）
- このファイルが参照しているファイル
- このファイルを参照しているファイル  
- 将来的にクリック可能なリンクとして実装

**4. レビュー情報** （独立パネル）
- 件数表示（未対応・進行中・解決済み）
- パネルタイトルに統計表示
- 初期段階: 表示のみ、将来的に編集機能追加

**5. 基本情報** （最下部）
- ファイル名、種別、サイズ、更新日時
- ハッシュ情報（必要に応じて、デバッグ用）

#### 3.2 小説全体画面の構成
- プロジェクト情報（title, author, version）
- 全体統計（総ファイル数、総文字数、最終更新日）
- タグ使用状況統計
- 参照関係の統計

#### 3.3 ディレクトリ画面の構成
- ディレクトリ情報（名前、ファイル数）
- 含まれるファイルの一覧
- このディレクトリのタグ統計

### 4. 技術的配置

#### 4.1 WebViewの配置
- **位置**: Explorer横のサイドパネル（右側がデフォルト）
- **形式**: WebViewView形式（サイドパネル専用）
- **開閉**: ユーザーが手動で開閉可能

#### 4.2 データの更新方式
- **リアルタイム更新**: ファイル変更を即座に反映
- **イベント連携**: TreeView選択変更時に自動更新

## 実装アーキテクチャ

### 1. ファイル構成

```
src/
  views/
    FileDetailsViewProvider.ts    # WebViewViewProvider実装
  commands/
    webviewCommands.ts           # WebView関連コマンド
  utils/
    WebViewUtils.ts              # HTML生成・メッセージング共通処理
  resources/
    webview/
      style.css                  # WebView専用CSS
      script.js                  # WebView専用JavaScript
```

### 2. 主要クラス設計

#### FileDetailsViewProvider
```typescript
export class FileDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'dialogoi-file-details';
  
  // 現在表示中のアイテム
  private currentItem: DialogoiTreeItem | null = null;
  private currentViewMode: 'file' | 'directory' | 'project' = 'file';
  
  // メソッド
  resolveWebviewView(): void           // WebView初期化
  updateDisplay(item: DialogoiTreeItem): void  // 表示更新
  handleMessage(message: any): void    // WebViewからのメッセージ処理
}
```

#### WebViewUtils
```typescript
export class WebViewUtils {
  static generateFileDetailsHTML(file: DialogoiTreeItem): string
  static generateDirectoryHTML(directory: DialogoiTreeItem): string  
  static generateProjectHTML(project: DialogoiYaml): string
  static generateNonce(): string
  static getCSPContent(webview: vscode.Webview): string
}
```

### 3. メッセージング設計

#### Extension → WebView
```typescript
interface WebViewMessage {
  type: 'updateFile' | 'updateDirectory' | 'updateProject';
  data: DialogoiTreeItem | DialogoiYaml;
}
```

#### WebView → Extension  
```typescript
interface ExtensionMessage {
  type: 'addTag' | 'removeTag' | 'addReference' | 'openFile';
  payload: {
    tag?: string;
    reference?: string;
    filePath?: string;
  };
}
```

### 4. package.json設定

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "type": "webview",
          "id": "dialogoi-file-details", 
          "name": "ファイル詳細",
          "when": "dialogoi:hasNovelProject",
          "icon": "$(info)"
        }
      ]
    },
    "commands": [
      {
        "command": "dialogoi.showFileDetails",
        "title": "ファイル詳細を表示",
        "icon": "$(info)"
      }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "dialogoi.showFileDetails",
          "group": "navigation",
          "when": "dialogoi:hasNovelProject"
        }
      ]
    }
  }
}
```

## 実装フェーズ

### Phase 3.1a: 基本WebView実装
- [ ] package.json更新
- [ ] FileDetailsViewProvider基本実装
- [ ] extension.tsでの統合
- [ ] 基本的なHTML/CSS
- [ ] TreeView連携

### Phase 3.1b: アコーディオンUI実装  
- [ ] アコーディオンパネルのHTML/CSS
- [ ] JavaScriptによる開閉制御
- [ ] ファイル詳細情報の表示

### Phase 3.1c: 表示内容の充実
- [ ] タグ表示の実装
- [ ] 参照関係表示の実装  
- [ ] キャラクター情報表示の実装
- [ ] レビュー情報表示の実装

### Phase 3.1d: リアルタイム更新
- [ ] ファイル変更監視
- [ ] TreeView選択連携
- [ ] 自動更新機能

### Phase 3.1e: エディタタブボタン
- [ ] エディタタイトルメニューの実装
- [ ] コンテキストメニューの追加
- [ ] アクティブファイル連携

## セキュリティ考慮事項

### Content Security Policy (CSP)
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';
               img-src ${webview.cspSource} https:;">
```

### XSS対策
- 全てのユーザー入力をHTMLエスケープ
- nonce付きスクリプトのみ実行許可
- 外部リソースの読み込み制限

## 将来的な拡張予定

### 操作機能の追加
- タグの追加・削除・編集
- 参照関係の追加・削除
- レビューの追加・編集・削除
- キャラクター情報の編集

### 表示機能の強化
- タグの色分け・カテゴリ分け
- 参照関係のリンク化
- レビューの詳細表示・編集UI
- ファイル統計の可視化

### パフォーマンス最適化
- 大量データの仮想化
- 画像・アイコンの最適化
- メモリ使用量の最適化

## 品質保証

### テスト項目
- [ ] WebViewの正常な表示
- [ ] TreeView連携の動作確認
- [ ] メッセージングの正常性
- [ ] CSPの有効性確認
- [ ] パフォーマンステスト

### ユーザビリティテスト
- [x] 直感的な操作性 ✅
- [x] 情報の見つけやすさ ✅
- [x] レスポンス性能 ✅
- [x] エラー処理の適切性 ✅

---

## 実装結果（Phase 3.1完了）

### ✅ 実装された機能

#### 1. 統合UI
- **ViewContainer**: `dialogoi-details` をActivity Barに配置
- **TreeView**: `dialogoi-explorer` でファイル選択
- **WebView**: `dialogoi-file-details` でファイル詳細表示
- **統合体験**: 1つのパネルでファイル選択から詳細表示まで完結

#### 2. VSCodeエクスプローラー風UI
- **折りたたみ可能セクション**: VSCode標準のCollapsible Sections形式
- **テーマ統合**: VSCode標準の色変数を使用
- **インタラクション**: ホバー効果、フォーカス状態の適切な実装

#### 3. 表示内容
- **タグセクション**: ファイルのタグ一覧、追加ボタン
- **キャラクター情報**: 重要度、複数キャラフラグ、表示名
- **参照関係**: ファイル間の参照リンク、追加ボタン
- **レビュー情報**: ステータス別統計
- **基本情報**: ファイル種別、パス情報

#### 4. リアルタイム連携
- **TreeView選択**: ファイル選択時に即座に詳細表示を更新
- **データ同期**: extension.tsで適切なイベント連携を実装

### 🔧 技術実装

#### アーキテクチャ
```
Activity Bar → ViewContainer → [TreeView, WebView]
                                     ↓
                               リアルタイム連携
```

#### 主要ファイル
- `package.json`: ViewContainer、Views設定
- `src/extension.ts`: TreeView作成、イベント連携
- `src/views/FileDetailsViewProvider.ts`: WebView実装
- `src/commands/fileCommands.ts`: TreeView連携コマンド

#### 実装の特徴
- **CSP準拠**: セキュアなContent Security Policy実装
- **型安全性**: TypeScript strictモードでの完全な型安全
- **メッセージング**: WebViewとExtension間の適切な通信
- **エラーハンドリング**: Logger統合によるエラー処理

### 📈 成果
- **UX改善**: エクスプローラー⇔詳細パネル間の行き来が不要
- **視認性向上**: リッチなHTML表示によるメタデータの見やすさ
- **操作性向上**: ボタンによる直接操作（準備段階）
- **統合感**: VSCode標準UIとの一体感