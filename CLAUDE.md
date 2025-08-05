# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイダンスを提供します。

## 利用言語

- ユーザとのコミュニケーションには日本語を使用
- コード中のコメントやテストケース名も可能な限り日本語で記述

## プロジェクト概要

小説執筆支援のためのVSCode Extensionです。本文・設定・キャラクター・用語集・伏線などを体系的に管理し、執筆の一貫性を保ちながら効率的な作業を支援します。

**主要機能**
- TreeViewによる階層的ファイル管理
- `.dialogoi/dialogoi-meta.yaml`によるメタデータ管理
- ファイル作成・削除・名前変更・並び替え
- タグシステム（ファイル・ディレクトリへのタグ付与）
- 参照関係管理（双方向参照追跡）
- ツールチップによる詳細情報表示
- コメント・TODO管理機能（`.dialogoi/{path}/{filename}.comments.yaml`）
- WebViewによるファイル詳細・プロジェクト設定の編集

## 開発方針

**破壊的変更の許可**: このプロジェクトは開発段階のため、後方互換性を気にせず最適な設計を追求してください。

**Serena MCP サーバーの活用**: 大規模なコードベース探索やシンボル検索では serena MCP を積極的に利用し、開発効率を最大化してください。

## 開発コマンド

### 基本開発

```bash
# 依存関係のインストール
npm install

# 開発モード（VSCode内でF5キーでも可能）
npm run watch

# Extensionのパッケージング
npm run package
```

### テストと品質管理

```bash
# 全テスト実行（サーバサイド + React）
npm run test:all

# 単体テスト実行
npm test

# Reactコンポーネントテスト
npm run test:react

# 全体品質チェック（TypeScript + ESLint + Prettier + テスト + WebView）
npm run check-all

# TypeScript型チェック
npm run typecheck

# ESLintチェック
npm run lint

# コードフォーマット
npm run format
```

詳細なテスト・品質管理については：@docs/rules/testing-guidelines.md

## アーキテクチャ設計

### 依存関係注入（DI）パターン

**サービス層（`/src/services/`）の責務:**
- 純粋なビジネスロジックの実装
- VSCode APIへの直接アクセス禁止
- 単体テスト可能な設計

**コマンド層（`/src/commands/`）の責務:**
- VSCodeとの連携・UI操作
- サービス層のビジネスロジックを利用

```typescript
// ✅ 推奨パターン
export class NewService {
  constructor(private fileOperationService: FileOperationService) {}
  
  someMethod(): void {
    const uri = this.fileOperationService.createFileUri(path);
    const content = this.fileOperationService.readFileSync(uri);
  }
}
```

### テスト設計

**jest-mock-extended使用**
```typescript
import { mock, MockProxy } from 'jest-mock-extended';

const mockFileRepository = mock<FileRepository>();
const service = new CommentService(mockFileRepository);
```

詳細なテスト作成指針：@docs/rules/testing-guidelines.md

## VSCode Extension固有の注意事項

### WebView実装
詳細なWebView開発ガイドライン：@docs/rules/webview-guidelines.md

### ファイルシステム操作
- `vscode.workspace.fs`を使用（Node.js fsモジュールより推奨）
- 相対パスではなく`vscode.Uri`を使用

### メタデータ/コメントファイル
- `js-yaml`ライブラリを使用
- ファイルのSHA-256ハッシュ計算で変更検知
- GitHub互換行番号形式（`#L42`, `#L4-L7`）対応

## コーディング規約

**TypeScript 固有の注意事項:**
- `any` 型の使用は極力避ける
- `strict` モードを有効にしたまま開発
- 関数の戻り値型は明示的に指定

**ファイルパスの命名規則:**
- **相対パス**: `relativePath`, `relativeFilePath`
- **絶対パス**: `absolutePath`, `absoluteFilePath`
- **汎用的な `path`, `filePath` は使用禁止**

## 開発ワークフロー

1. **機能開発前**: docs/下に計画書を作成
2. **実装**: コード変更・ファイル作成
3. **テスト作成**（新機能の場合）
4. **品質チェック**: `test-quality-checker` agentで品質保証
5. **git commit**: 全チェック通過後

**コミット前必須チェック:**
「コミット前に品質チェックをお願いします」→ `npm run check-all` 自動実行

## 実装済み機能

- **TreeView階層管理**: VSCode標準エクスプローラー準拠のUI
- **メタデータ管理**: `.dialogoi/dialogoi-meta.yaml`による統合管理
- **コメントシステム**: `.dialogoi/{path}/{filename}.comments.yaml`形式
- **DI アーキテクチャ**: jest-mock-extended + コンストラクタ注入パターン統一
- **包括的テスト**: 30+サービステスト + 10+Reactコンポーネントテスト

**品質指標**: ESLintエラー0個、TypeScript strict mode、GitHub Actions完全通過