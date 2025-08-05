# テスト実行・品質管理ガイドライン

このドキュメントでは、プロジェクトのテスト実行方法、品質管理、およびテスト作成時の注意事項について説明します。

> **重要**: このプロジェクトでは**30+のサービステスト**と**10+のReactコンポーネントテスト**で包括的な品質保証を実現しています。

## テストと品質管理コマンド

### 基本テストコマンド

```bash
# 単体テスト実行（CI用 - VSCode非依存）
npm test

# Reactコンポーネントテスト実行（CI用 - VSCode非依存）
npm run test:react

# 全てのテスト実行（サーバサイド + React）
npm run test:all
```

### 品質チェックコマンド

```bash
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

### テスト実行環境について

#### Jestプロジェクト設定による環境分離

このプロジェクトでは、Jest Projectsの設定により2つの独立したテスト環境を構成しています：

**1. サーバサイドテスト (Node環境)**
- `npm test`: `src/**/*.test.ts`を対象
- 環境: Node.js (testEnvironment: 'node')
- 対象: サービス層、ユーティリティ、ビジネスロジック
- CI/CD: 自動実行可能
- **30+のテストファイル**で包括的にカバー

**2. Reactコンポーネントテスト (jsdom環境)**
- `npm run test:react`: `webview/**/*.test.tsx`を対象  
- 環境: jsdom (testEnvironment: 'jsdom')
- 対象: WebViewコンポーネント、UI結合テスト
- CI/CD: 自動実行可能
- **10+のコンポーネントテスト**でUI動作を検証

**3. 統合実行**
- `npm run test:all`: サーバサイド + React の2つを結合実行
- CI/CD: この方法で全テストを自動実行

## テストの作成指針

### 基本原則（2025-01-31更新）

- 全てのサービスクラスのテストはjest-mock-extendedを使用
- MockProxy<T>パターンで依存関係をモック化
- 実際のファイルシステムに依存しない

### テスト作成パターン

#### 1. サービス層テスト（推奨パターン）

```typescript
import { mock, MockProxy } from 'jest-mock-extended';
import { CommentService } from './CommentService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';

describe('CommentService テストスイート', () => {
  let commentService: CommentService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();

    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockDialogoiYamlService = mock<DialogoiYamlService>();

    // サービスインスタンス作成
    commentService = new CommentService(
      mockFileRepository,
      mockDialogoiYamlService,
      // ... 他の依存関係
    );

    // ファイルシステムモックの設定
    setupFileSystemMocks();
  });

  test('コメント作成が正常に動作する', async () => {
    // モックの動作を設定
    mockFileRepository.writeFileSync.mockImplementation((uri, content) => {
      fileSystem.set(uri.path, content);
    });

    // テスト実行
    const result = await commentService.createComment({
      relativeFilePath: 'test.md',
      startLine: 1,
      content: 'テストコメント'
    });

    // 結果検証
    expect(result.success).toBe(true);
    expect(mockFileRepository.writeFileSync).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining('.comments.yaml') }),
      expect.stringContaining('テストコメント')
    );
  });
});
```

#### ファイルシステムモックパターン

```typescript
// 高度なファイルシステムモック設定例
function setupFileSystemMocks(): void {
  // ファイル存在チェック
  mockFileRepository.existsSync.mockImplementation((uri) => 
    fileSystem.has(uri.path) || directories.has(uri.path)
  );

  // ファイル読み込み
  mockFileRepository.readFileSync.mockImplementation((uri) => {
    const content = fileSystem.get(uri.path);
    if (!content) throw new Error(`File not found: ${uri.path}`);
    return content;
  });

  // ファイル書き込み
  mockFileRepository.writeFileSync.mockImplementation((uri, content) => {
    fileSystem.set(uri.path, content);
  });

  // ディレクトリ作成
  mockFileRepository.mkdirSync.mockImplementation((uri) => {
    directories.add(uri.path);
  });
}
```

### テストケース作成の指針

- **テストファーストを試みる**: 先にテストケースを作成し、失敗することを確かめてから実装を作り込む
- **日本語テスト名**: `describe`や`test`の名前は日本語で記載する
- **AAAパターン**: Arrange(準備) → Act(実行) → Assert(検証)の構造でテストを組み立てる
- **モックのリセット**: `beforeEach`で必ず`jest.clearAllMocks()`を実行

## Reactコンポーネントテストの注意事項

**重要**: React Testing Library環境での特有の制約と推奨事項を以下に記載します。

### WebViewコンポーネントテストの基本パターン

```typescript
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileDetailsApp } from './FileDetailsApp';
import { resetGlobalReadyMessageSent } from '../../hooks/useVSCodeApi';

describe('FileDetailsApp コンポーネント', () => {
  let mockPostMessage: (message: WebViewMessage) => void;
  let messageCallbacks: ((event: MessageEvent<UpdateFileMessage>) => void)[];

  beforeEach((): void => {
    // グローバルReadyメッセージフラグをリセット
    resetGlobalReadyMessageSent();

    messageCallbacks = [];
    mockPostMessage = (): void => {};

    // VSCode APIのモック
    (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = (): unknown => ({
      postMessage: mockPostMessage,
      setState: (): void => {},
      getState: (): unknown => ({}),
    });

    // MessageEventのモック設定
    setupMessageEventMocks();
  });

  test('コンポーネントが正常にレンダリングされる', async () => {
    render(<FileDetailsApp />);
    
    // 基本要素の存在確認（重複要素を避ける）
    expect(screen.getByText('基本情報')).toBeInTheDocument();
    expect(screen.getByText('タグ')).toBeInTheDocument();
  });
});
```

### DOM要素の取得について

#### ❌ 使用禁止

```typescript
// document.querySelector は使用しない
const element = document.querySelector('.some-class');

// 理由：
// 1. React Testing Libraryの仮想DOM環境では期待通りに動作しない
// 2. 無限待機状態（infinite wait）を引き起こす可能性がある
// 3. テストが不安定になる原因となる
```

#### ✅ 推奨方法

```typescript
// React Testing Libraryのセレクタを使用
const element = screen.getByRole('button');
const element = screen.getByText('テキスト');
const element = screen.getByTestId('test-id');
const element = screen.getByLabelText('ラベル');

// 複数要素がある場合
const elements = screen.getAllByText('テキスト');
const specificElement = elements.find(el => el.closest('.specific-class'));
```

### 重複要素問題への対処

同じテキストや要素が複数箇所に表示される場合：

```typescript
// ❌ 悪い例：getByTextで重複要素エラー
assert(screen.getByText('test.md')); // "Found multiple elements" エラー

// ✅ 良い例1：より具体的なセレクタを使用
const fileTitle = screen.getByRole('heading');
assert(fileTitle.textContent === 'test.md');

// ✅ 良い例2：getAllByTextで特定要素を絞り込み
const elements = screen.getAllByText('test.md');
const titleElement = elements.find(el => el.closest('.file-title'));
assert(titleElement);

// ✅ 良い例3：間接的な存在確認
// 重複がある場合は、特定要素の確認を避けて機能の存在のみ確認
// 例：ファイル名の表示確認を省略し、セクション存在のみ確認
assert(screen.getByText('基本情報'));
assert(screen.getByText('タグ'));
```

### waitFor使用時の注意

```typescript
// ✅ 必ずタイムアウトを設定
await waitFor(() => {
  assert(screen.getByText('期待する要素'));
}, { timeout: 3000 });

// ❌ タイムアウト未設定は無限待機のリスク
await waitFor(() => {
  assert(screen.getByText('期待する要素'));
}); // 危険
```

### 非同期関数のテスト

```typescript
// ✅ Promise返却関数のテスト
const mockFunction = (arg1: string, arg2: string): Promise<void> => {
  history.push({ arg1, arg2 });
  return Promise.resolve();
};

// ❌ voidを返すと型エラー
const badMock = (arg1: string, arg2: string): void => {
  // Promise<void>が期待される場合に型エラー
};
```

### デバッグ方法

```typescript
// DOM構造の確認
screen.debug(); // 全体のDOM
screen.debug(screen.getByText('特定要素')); // 特定要素周辺のDOM

// 要素の存在確認
console.log('要素一覧:', screen.queryAllByText('テキスト'));
```

これらの制約を守ることで、安定した結合テストを作成できます。

### VSCode API モックパターン

WebViewコンポーネントテストでは、VSCode APIの適切なモックが必要です：

```typescript
// VSCode API モックの標準パターン
beforeEach(() => {
  // acquireVsCodeApi のモック
  (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = (): unknown => ({
    postMessage: mockPostMessage,
    setState: (): void => {},
    getState: (): unknown => ({}),
  });

  // MessageEvent のモック設定
  const originalAddEventListener = window.addEventListener;
  window.addEventListener = (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void => {
    if (type === 'message') {
      messageCallbacks.push(listener as (event: MessageEvent) => void);
    } else {
      originalAddEventListener.call(window, type, listener);
    }
  };
});

// テスト用メッセージイベント作成ヘルパー
const createMessageEvent = (data: unknown): MessageEvent => {
  return new MessageEvent('message', {
    data,
    origin: 'vscode-webview://',
    source: window,
  });
};
```

## テスト修正に関する重要な原則

### 基本方針

**テストが通らなくてもテストケースやファイルを削除しないこと**
- テストが失敗する場合は、まず根本原因を特定する
- テストケースが間違っているのか、実装が間違っているのかを判断する
- 安易にテストを削除するのではなく、実装またはテストの期待値を修正する

### エスカレーション指針

**エラーがなかなか修正できない場合は、必ずユーザに報告して指示を仰ぐこと**
- 30分以上同じエラーで行き詰まった場合
- 根本原因が特定できない場合
- 修正方法に複数の選択肢があり判断に迷う場合
- 大きな設計変更が必要そうな場合

## git commit前の必須チェック

**新しいファイルを作成・編集した後は、git commit前に必ず`test-quality-checker` agentで品質チェックを実行すること：**

### 推奨方法: test-quality-checker agentの使用

```
「コミット前に品質チェックをお願いします」
```

Agentが自動的に以下を実行します：
- `npm run check-all` の実行
- 軽微な問題の自動修正
- 重要な問題の詳細レポート

### 手動実行の場合

```bash
npm run check-all
```

### check-allの実行内容

このコマンドは以下を一括実行します：
1. `npm run typecheck` - TypeScript 型チェック
2. `npm run lint` - ESLint チェック（警告0個必須）
3. `npm run format:check` - Prettier フォーマット確認
4. `npm run test:all` - 全テストの実行（サーバサイド + Reactコンポーネント）

### 重要な注意事項

- `check-all`が失敗した場合は、必ず修正後に再度`check-all`を実行すること
- フォーマットエラーの場合は`npm run format`で修正してから再実行
- これらのチェックを怠ると GitHub Actions CI が失敗する
- **どんな小さな変更でも必ずコミット前に実行すること**

### 個別チェックが必要な場合

- フォーマット修正：`npm run format`
- 型チェックのみ：`npm run typecheck`
- リントのみ：`npm run lint`
- サーバサイドテストのみ：`npm test`
- Reactコンポーネントテストのみ：`npm run test:react`
- 全テスト：`npm run test:all`

## テスト品質のベストプラクティス

### テストカバー抜けを防ぐ

- **ハッピーパスだけでなくエラーケースもテスト**
- **エッジケースを網羅**: 空文字列、null、undefined、不正な入力
- **非同期処理のタイムアウトやエラーをテスト**

### テストの保守性

- **テスト名で意図を明確化**: 「何を」「どんな条件で」「どうなるか」
- **1テスト1アサーション原則**: テストを簡潔に保つ
- **テストデータの独立性**: 他のテストに依存しない

### パフォーマンス考慮

- **必要なときのみ`waitFor`を使用**: 無駄な待機を避ける
- **モックの適切なリセット**: `beforeEach`でクリーンアップ
- **テストの並列実行**: Jestの`maxWorkers`設定を活用

### 実際のコードパターン

このプロジェクトで実際に使用されている優秀なテストパターンの例：

```typescript
// CommentService.test.ts - 高度なファイルシステムモック
function setupFileSystemMocks(): void {
  mockFileRepository.existsSync.mockImplementation((uri) => 
    fileSystem.has(uri.path) || directories.has(uri.path)
  );
  
  mockFileRepository.readFileSync.mockImplementation((uri) => {
    const content = fileSystem.get(uri.path);
    if (!content) throw new Error(`File not found: ${uri.path}`);
    return content;
  });
}

// FileDetailsApp.test.tsx - VSCode APIモック
beforeEach(() => {
  (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
    postMessage: mockPostMessage,
    setState: (): void => {},
    getState: (): unknown => ({}),
  });
});
```

これらのパターンを参考に、実際のプロジェクトに合わせたテストを作成してください。