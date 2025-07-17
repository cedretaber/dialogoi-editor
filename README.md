# Dialogoi Editor

VSCode Extension として提供する小説執筆支援ツール

## 概要

Dialogoi Editor は、小説作品の執筆を支援するVSCode Extensionです。本文の管理だけでなく、設定・キャラクター・用語集・伏線などの情報を体系的に管理し、作品の一貫性を保ちながら執筆を進めることができます。

将来的には [Dialogoi MCP サーバ](https://github.com/cedretaber/dialogoi) との連携も予定しています。

## 主な機能

- 📚 **階層的なファイル管理** - 本文と設定ファイルを構造化して管理
- 🏷️ **タグシステム** - ファイルやディレクトリにタグを付けて分類
- 🔗 **参照関係の管理** - 設定がどの話で使われているかを追跡
- 👥 **キャラクター管理** - 登場人物の設定を専用UIで管理
- 📖 **用語集機能** - 作品内の用語を一元管理
- 🔮 **伏線管理** - 伏線の埋蔵と回収を可視化

## インストール方法

（準備中）

## 使い方

（準備中）

## ドキュメント

詳細なドキュメントは以下を参照してください：

- [仕様書](docs/SPECIFICATION.md) - ファイル形式やメタデータの詳細仕様
- [アーキテクチャ設計書](docs/ARCHITECTURE.md) - 技術的な設計と実装方針
- [ロードマップ](docs/ROADMAP.md) - 今後の開発計画と将来構想

## 開発に参加する

このプロジェクトはオープンソースです。バグ報告、機能提案、プルリクエストを歓迎します。

### 開発環境のセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/cedretaber/dialogoi-editor.git
cd dialogoi-editor

# 依存関係のインストール
npm install

# TypeScriptコンパイル
npm run compile

# 開発モードで監視（ファイル変更時に自動コンパイル）
npm run watch
```

### デバッグ実行

```bash
# VSCode内でF5キーを押すか、以下で新しいウィンドウでExtensionをテスト
code --extensionDevelopmentPath=.
```

### テスト

```bash
npm test
```

### パッケージング

```bash
# Extensionファイル（.vsix）の作成
npm run package
```

## ライセンス

MIT
