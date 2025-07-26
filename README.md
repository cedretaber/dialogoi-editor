# Dialogoi Editor

[![CI](https://github.com/cedretaber/dialogoi-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/cedretaber/dialogoi-editor/actions/workflows/ci.yml)

小説執筆のためのVSCode拡張機能

## 概要

Dialogoi Editorは、小説作品の執筆を体系的に支援するVSCode拡張機能です。単純なテキスト管理を超え、キャラクター設定・世界観・伏線・参照関係を一元管理し、作品の一貫性を保ちながら執筆できます。

## 主な機能

### 📚 **ファイル管理**
- 階層的な小説構造の管理（本文・設定・キャラクター）
- ドラッグ&ドロップによる直感的な並び替え・移動
- ファイル作成・削除・名前変更の統合操作

### 🏷️ **タグシステム** 
- ファイルやディレクトリへのタグ付与
- タグによるリアルタイムフィルタリング
- 階層構造を考慮した検索機能

### 🔗 **参照関係管理**
- 設定ファイルと本文ファイルの関係追跡
- マークダウンリンクの自動抽出・統合
- 存在しない参照の自動検出

### 📝 **コメント・TODO管理**
- 行番号指定によるコメント機能（#L42, #L4-L7形式）
- マークダウンレンダリングとTODOチェックボックス
- ファイル変更検知による整合性保持
- エディタ統合：選択範囲から即座にコメント追加

### 🔮 **伏線管理**
- 複数の「張る」位置と「回収」位置の管理
- 伏線の進捗状況追跡
- ファイル存在確認による状態管理

### ⚙️ **プロジェクト管理**
- `dialogoi.yaml`による作品メタデータ管理
- 既存ディレクトリからの自動プロジェクト生成
- 除外パターンによる不要ファイルの除外

### 🎨 **統合UI**
- TreeViewによる構造化表示
- WebViewによる詳細情報パネル
- リアルタイム連携とシームレスなワークフロー

## インストール

### VSCode Marketplaceからインストール

1. VSCodeの拡張機能ビューを開く（`Ctrl+Shift+X` / `Cmd+Shift+X`）
2. 「Dialogoi」で検索
3. 「Install」をクリック

または、[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=dialogoi.dialogoi-editor)から直接インストールできます。

### コマンドラインからインストール

```bash
code --install-extension dialogoi.dialogoi-editor
```

### 開発版のインストール

最新の開発版を試したい場合：

```bash
# リポジトリをクローン
git clone https://github.com/cedretaber/dialogoi-editor.git
cd dialogoi-editor

# 依存関係をインストール
npm install

# VSCodeで開く
code .

# F5キーでデバッグ実行
```

## 使い方

### クイックスタート

1. **サンプルプロジェクトを開く**
   - 新しいVSCodeウィンドウで `examples/sample-novel` を開く
   - 左サイドバーの「Dialogoi」パネルを確認
   - TreeViewで小説構造を探索

2. **新規プロジェクトを作成**
   - 空のフォルダでDialogoiパネルの「新しい小説を開始」をクリック
   - タイトル・著者を入力してプロジェクト作成
   - ファイルが自動的に検出・分類される

### 基本操作

#### ファイル管理
- **作成**: TreeViewの「+」ボタンまたは右クリックメニュー
- **削除**: 右クリック→「削除」（確認ダイアログ付き）
- **移動**: ファイルをドラッグして別フォルダにドロップ
- **並び替え**: 同一フォルダ内でドラッグ&ドロップ

#### タグ管理
- **追加**: 詳細パネルでタグを入力してEnter
- **削除**: タグの「×」ボタンをクリック
- **フィルタリング**: TreeViewの🔍ボタンでタグ検索

#### 参照関係
- **手動追加**: 詳細パネルから参照先を指定
- **自動検出**: マークダウンリンクが自動的に参照として追加
- **ドロップ追加**: TreeViewからエディタにファイルをドラッグ

#### コメント・TODO
- **選択範囲から追加**: テキスト選択→右クリック→「コメントを追加」
- **直接追加**: コメントパネルの「+ コメントを追加」
- **編集**: コメント内容をクリックしてインライン編集
- **TODO管理**: `- [ ]` 形式で進捗管理

#### 伏線管理
- **設定**: 設定ファイルの詳細パネルから伏線情報を設定
- **複数埋蔵**: 「植込み位置を追加」で複数箇所を指定
- **回収設定**: 「回収位置を設定」で伏線回収箇所を記録

### ファイル構造

```
novel-project/
├── dialogoi.yaml          # プロジェクト設定
├── contents/              # 本文ファイル
│   ├── .dialogoi-meta.yaml
│   ├── prologue.txt
│   └── chapter1.txt
├── characters/            # キャラクター設定
│   ├── .dialogoi-meta.yaml
│   ├── protagonist.md
│   └── heroine.md
└── settings/              # 世界設定・用語集
    ├── .dialogoi-meta.yaml
    ├── world.md
    └── magic_system.md
```

## ドキュメント

- [仕様書](docs/SPECIFICATION.md) - ファイル形式とメタデータ
- [アーキテクチャ](docs/ARCHITECTURE.md) - 技術設計
- [開発ロードマップ](docs/ROADMAP.md) - 今後の計画

## 開発

### セットアップ

```bash
git clone https://github.com/cedretaber/dialogoi-editor.git
cd dialogoi-editor
npm install
```

### 開発コマンド

```bash
npm run compile      # TypeScriptコンパイル
npm run watch        # 開発モード（自動コンパイル）
npm test             # テスト実行
npm run lint         # ESLintチェック
npm run package      # 拡張機能パッケージング
```

### 品質管理

```bash
npm run check-all    # 型チェック・リント・テスト・フォーマット確認
```

## ライセンス

MIT

## 関連プロジェクト

将来的に [Dialogoi MCP サーバ](https://github.com/cedretaber/dialogoi) との連携を予定しています。