# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 利用言語について

- ユーザとのコミュニケーションには日本語を使用してください
- コード中のコメントやテストケース名も可能な限り日本語でお願いします

## プロジェクト概要

小説執筆支援のためのVSCode Extensionです。本文・設定・キャラクター・用語集・伏線などを体系的に管理し、執筆の一貫性を保ちながら効率的な作業を支援します。

主要機能：
- TreeViewによる階層的ファイル管理 ✅
- meta.yamlによるメタデータ管理 ✅
- ファイル作成・削除・名前変更・並び替え ✅
- タグシステム（ファイル・ディレクトリへのタグ付与） ✅
- 参照関係管理（双方向参照追跡） ✅
- ツールチップによる詳細情報表示 ✅
- レビュー機能（編集者・AI連携） 🔄（Phase 2b）
- 将来的にDialogoi MCP サーバとの連携 🔄（Phase 4）

## 開発方針

### 後方互換性について

**重要**: このプロジェクトは開発段階であり、まだ公開されていません。利用者も開発者のみのため、**後方互換性については一切気にする必要はありません**。

- 破壊的変更は積極的に行う
- 仕様の大幅な変更も躊躇なく実行
- メタデータフォーマットの変更も自由に行う
- 新しいアイデアを試すことを優先

この方針により、最適な設計を追求し、技術的負債を蓄積することなく開発を進めることができます。

## 開発コマンド

### 基本開発

```bash
# 依存関係のインストール
npm install

# 開発モードでのExtension起動（F5キーでも可能）
npm run watch
# または
npm run compile:watch

# 新しいVSCodeウィンドウでExtensionをデバッグ実行
# VSCode内でF5キーを押すか、以下のコマンド
code --extensionDevelopmentPath=.

# Extensionのパッケージング
npm run package
# または
npx vsce package
```

### テストと品質管理

```bash
# 単体テスト実行（CI用 - VSCode非依存）
npm test

# VSCode拡張機能テスト実行（開発用 - VSCode環境必要）
npm run test:vscode

# TypeScript コンパイル
npm run compile

# TypeScript型チェック
npm run typecheck

# ESLintチェック
npm run lint

# Prettierフォーマット
npm run format

# 全体チェック（CI用）
npm run check-all
```

**テスト実行環境について：**
- `npm test`: 標準のNode.js環境で実行可能（CI/CDで自動実行）
- `npm run test:vscode`: VSCode環境が必要（開発時に手動実行）
  - VSCode内でF5キーでデバッグ実行時
  - または `xvfb-run -a npm run test:vscode` でヘッドレス実行

## 開発時の注意事項

### VSCode Extension API 固有の注意事項

**Activation Events:**
- package.jsonの`activationEvents`で適切な起動条件を設定
- 不要な起動を避けてパフォーマンスを保つ
- `onView:dialogoi-explorer`等、必要最小限のイベントのみ

**TreeView Provider:**
- `vscode.TreeDataProvider`を実装する際は、`refresh()`メソッドで適切にUIを更新
- 大量データの場合は遅延読み込みを実装
- アイコンは`vscode.ThemeIcon`またはファイルパスを使用

**WebView:**
- CSP（Content Security Policy）を適切に設定
- `acquireVsCodeApi()`でExtensionとの通信を確立
- XSS対策を必ず実装（HTMLエスケープ等）

**ファイルシステム操作:**
- `vscode.workspace.fs`を使用（Node.jsのfsモジュールより推奨）
- `vscode.FileSystemWatcher`でファイル変更を監視
- 相対パスではなく`vscode.Uri`を使用

**設定管理:**
- `vscode.workspace.getConfiguration()`で設定を取得
- 設定変更時は`onDidChangeConfiguration`イベントで対応

### meta.yaml/レビューファイル 固有の注意事項

**YAMLファイル操作:**
- `js-yaml`ライブラリを使用
- パース エラーに対する適切なエラーハンドリング
- ファイルのSHA-256ハッシュ計算で変更検知

**レビュー機能:**
- レビューファイルの位置情報は行番号+文字位置で管理
- ファイル変更時はハッシュ値で変更検知し、ユーザーに警告表示
- スレッド機能では配列インデックスで管理（IDは使用しない）

**エラーハンドリング:**
- ファイルが存在しない場合の処理
- 不正なYAML形式の場合の処理
- メタデータの整合性チェック

### パフォーマンス考慮事項

- 大規模プロジェクト（数百ファイル）での応答性を保つ
- ファイル監視は必要最小限に限定
- メタデータのキャッシング戦略


## 開発の進め方

- 複数のフェーズに分かれている開発の場合は、フェーズが1つ終わるごとに必ず　lint, typecheck, test を行うこと
- そのフェーズで作成したファイルにはテストを書くこと
- lint, typecheck, test が通ったら git commit する

### コーディング規約と型安全性

**基本原則：** コーディング規約、型安全性についてはその言語のベストプラクティスに従うこと。敢えてベストプラクティスから外れる場合はその理由を明記すること。

**TypeScript 固有の注意事項：**

- `any` 型の使用は極力避ける（型安全性を損なうため）
- `unknown` や適切な型ガードを使用して型安全を保つ
- `as` キャストは最小限に留め、型の整合性を保証できる場合のみ使用
- 関数の戻り値型は明示的に指定する（推論に頼らない）
- `strict` モードを有効にしたまま開発する

**例外的な使用が許される場合：**

- サードパーティライブラリの型定義が不完全な場合
- 複雑な型変換で一時的な型キャストが必要な場合
- ただし、その理由をコメントで明記すること

**ファイルパスの命名規則：**

パスの種類を明確にするため、以下の命名規則を必ず守ること：

- **相対パス**: `relativePath`, `relativeFilePath`, `relativeDir` 等
- **絶対パス**: `absolutePath`, `absoluteFilePath`, `absoluteDir` 等
- **汎用的な `path`, `filePath`, `dirPath` は使用禁止**

例：
```typescript
// ❌ 悪い例
const path = '/absolute/path/to/file.txt';
const filePath = 'relative/path/to/file.txt';

// ✅ 良い例
const absolutePath = '/absolute/path/to/file.txt';
const relativePath = 'relative/path/to/file.txt';
const absoluteFilePath = '/absolute/path/to/file.txt';
const relativeFilePath = 'relative/path/to/file.txt';
```

この規則により、パスの種類の取り違えによるバグを防ぐ。

## **重要：作業完了前の必須チェック**

**新しいファイルを作成・編集した後は、必ず以下のコマンドを実行してCIの通過を確保すること：**

1. `npm test` - 全単体テストの実行
2. `npm run typecheck` - TypeScript 型チェック
3. `npm run format` - Prettier フォーマット
4. `npm run lint` - ESLint チェック（警告0個必須）

これらのチェックを怠ると GitHub Actions CI が失敗する。コミット前に必ず実行すること。
どこかの段階で失敗したら、修正後に、必ず最初から確認をやり直すこと。
