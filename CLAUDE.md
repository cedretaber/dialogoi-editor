# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 利用言語について

- ユーザとのコミュニケーションには日本語を使用してください
- コード中のコメントやテストケース名も可能な限り日本語でお願いします

## プロジェクト概要

小説執筆支援のためのVSCode Extensionです。本文・設定・キャラクター・用語集・伏線などを体系的に管理し、執筆の一貫性を保ちながら効率的な作業を支援します。

主要機能：
- TreeViewによる階層的ファイル管理 ✅
- .dialogoi/dialogoi-meta.yamlによるメタデータ管理 ✅
- ファイル作成・削除・名前変更・並び替え ✅
- タグシステム（ファイル・ディレクトリへのタグ付与） ✅
- 参照関係管理（双方向参照追跡） ✅
- ツールチップによる詳細情報表示 ✅
- レビュー機能（編集者・AI連携） 🔄（Phase 2b）
- 将来的にDialogoi MCP サーバとの連携 🔄（Phase 4）

## 開発方針

### 作業時間について

**時間の節約について考える必要はありません**
納期があるわけではないので、多少時間がかかっても丁寧に仕事をしてください。
技術的負債を残さないことを優先してください。

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

# Reactコンポーネントテスト実行（CI用 - VSCode非依存）
npm run test:react

# 全てのテスト実行（サーバサイド + React）
npm run test:all

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
- `npm test`: 標準のNode.js環境で実行可能（サーバサイドテストのCI/CD自動実行）
- `npm run test:react`: 標準のNode.js環境で実行可能（ReactコンポーネントテストのCI/CD自動実行）
- `npm run test:all`: 上記2つを結合した統合テスト
- `npm run test:vscode`: VSCode環境が必要（開発時に手動実行）
  - VSCode内でF5キーでデバッグ実行時
  - または `xvfb-run -a npm run test:vscode` でヘッドレス実行

## 開発時の注意事項

### package.json の設定
- 可能な限り最新のライブラリを利用する
- package.json の依存を確認し、バージョンの古いライブラリがあればアップデートする
- 依存の問題でバージョンが上げられないなどやむを得ない場合のみ古いライブラリの利用を許可

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

**WebView実装パターン:**
- WebViewのUIは`webview/`ディレクトリにReact/TypeScriptで実装
- 構成ファイル:
  - `webview/index.html`: HTMLテンプレート（プレースホルダー含む）
  - `webview/index.tsx`: Reactアプリのエントリーポイント  
  - `webview/components/`: Reactコンポーネント群
  - `webview/style.css`: 共通CSS
  - `webview/types/`: TypeScript型定義
- ビルド: TypeScriptが`out/webviews/`にコンパイル
- Provider側でHTMLテンプレートを読み込み、プレースホルダーを置換してWebViewに設定

### メタデータ/コメントファイル 固有の注意事項

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

### 依存関係注入（DI）アーキテクチャ

**重要**: このプロジェクトではVSCode依存の局所化とテスト可能性の向上のため、依存関係注入パターンを採用しています。2025年1月31日にアーキテクチャの大幅改善を完了し、全サービスでコンストラクタ注入パターンを統一しました。

#### レイヤー設計の基本原則

**サービス層（/src/services/）の責務:**
- 純粋なビジネスロジックの実装
- VSCode APIへの直接アクセス禁止
- 単体テスト可能な設計
- 依存関係注入パターンの使用

**コマンド層（/src/commands/）の責務:**
- VSCodeとの連携・UI操作
- ユーザーインターフェース制御
- サービス層のビジネスロジックを利用

**サービスクラスの作成指針:**
- 全てのサービスクラスはコンストラクタでFileOperationServiceを受け取る
- 直接的なファイル操作（Node.js `fs`モジュール）は行わない
- VSCode APIへの直接アクセスは避ける

**例：**
```typescript
// ❌ 悪い例：services/でVSCode APIを使用
export class BadService {
  someMethod(): void {
    const editor = vscode.window.activeTextEditor; // VSCode依存
    // ...
  }
}

// ✅ 良い例：services/はビジネスロジックのみ
export class NewService {
  constructor(private fileOperationService: FileOperationService) {}
  
  someMethod(): void {
    // ❌ 悪い例：直接ファイル操作
    // const content = fs.readFileSync(path);
    
    // ✅ 良い例：FileOperationService経由
    const uri = this.fileOperationService.createFileUri(path);
    const content = this.fileOperationService.readFileSync(uri);
  }
}

// ✅ 良い例：commands/でVSCodeとサービスを連携
export function registerSomeCommands(context: vscode.ExtensionContext) {
  const service = ServiceContainer.getInstance().getNewService();
  
  const command = vscode.commands.registerCommand('some.command', () => {
    const editor = vscode.window.activeTextEditor; // VSCode依存はここで
    const result = service.someMethod(); // ビジネスロジックは分離
    // 結果をVSCode UIに反映
  });
  
  context.subscriptions.push(command);
}
```

**テストの作成指針 (2025-01-31更新):**
- 全てのサービスクラスのテストはjest-mock-extendedを使用
- MockProxy<T>パターンで依存関係をモック化
- 実際のファイルシステムに依存しない

**例（最新版）：**
```typescript
describe('NewService テストスイート', () => {
  let service: NewService;
  let mockFileRepository: MockProxy<FileRepository>;

  beforeEach(() => {
    mockFileRepository = mock<FileRepository>();
    service = new NewService(mockFileRepository);
  });

  test('テストケース', () => {
    // モックの動作を設定
    mockFileRepository.readFileAsync.mockResolvedValue('test content');
    
    // テスト実行
    const result = service.someMethod();
    
    // 結果検証
    expect(result).toBe('expected');
    expect(mockFileRepository.readFileAsync).toHaveBeenCalledWith(/* 期待引数 */);
  });
});
```

**テストケース作成の指針**
- テストファーストを試みる
- 先にテストケースを作成し、失敗することを確かめてから実装を作り込む

### Reactコンポーネントテストの注意事項

**重要**: React Testing Library環境での特有の制約と推奨事項を以下に記載します。

#### DOM要素の取得について

**❌ 使用禁止：**
```typescript
// document.querySelector は使用しない
const element = document.querySelector('.some-class');

// 理由：
// 1. React Testing Libraryの仮想DOM環境では期待通りに動作しない
// 2. 無限待機状態（infinite wait）を引き起こす可能性がある
// 3. テストが不安定になる原因となる
```

**✅ 推奨方法：**
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

#### 重複要素問題への対処

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

#### waitFor使用時の注意

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

#### 非同期関数のテスト

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

#### デバッグ方法

```typescript
// DOM構造の確認
screen.debug(); // 全体のDOM
screen.debug(screen.getByText('特定要素')); // 特定要素周辺のDOM

// 要素の存在確認
console.log('要素一覧:', screen.queryAllByText('テキスト'));
```

これらの制約を守ることで、安定した結合テストを作成できます。

## 開発の進め方

- 機能開発などある程度まとまった規模の開発を行う際は、**まず docs/ の下に計画書を作り** ユーザのレビューを受けること
  - TODO リストなども含め、 **いつでも中断・再開が可能なように** 工夫すること
- 複数のフェーズに分かれている開発の場合は、フェーズが1つ終わるごとに必ず `npm run check-all` を行うこと
- そのフェーズで作成したファイルにはテストを書くこと
- `npm run check-all` が通ったら git commit する
- 実装を修正した際は必ずドキュメントを確認し、差分をドキュメントに反映すること

**コミット前のワークフロー：**
1. コード変更・ファイル作成
2. テスト作成（新機能の場合）
3. `npm run check-all` 実行
4. エラーがあれば修正して再度 `npm run check-all`
5. 全チェック通過後に git commit

### テスト修正に関する重要な原則

**テストが通らなくてもテストケースやファイルを削除しないこと**
- テストが失敗する場合は、まず根本原因を特定する
- テストケースが間違っているのか、実装が間違っているのかを判断する
- 安易にテストを削除するのではなく、実装またはテストの期待値を修正する

**エラーがなかなか修正できない場合は、必ずユーザに報告して指示を仰ぐこと**
- 30分以上同じエラーで行き詰まった場合
- 根本原因が特定できない場合
- 修正方法に複数の選択肢があり判断に迷う場合
- 大きな設計変更が必要そうな場合

### コーディング規約と型安全性

**基本原則：** コーディング規約、型安全性についてはその言語のベストプラクティスに従うこと。敢えてベストプラクティスから外れる場合はその理由を明記すること。

**その他原則**

- インデントの不一致などについては気にする必要はない。
  - `npm run format` で修正されるため

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

## **重要：git commit 前の必須チェック**

**新しいファイルを作成・編集した後は、git commit前に必ず以下のコマンドを実行してCIの通過を確保すること：**

```bash
npm run check-all
```

このコマンドは以下を一括実行します：
1. `npm run typecheck` - TypeScript 型チェック
2. `npm run lint` - ESLint チェック（警告0個必須）
3. `npm run format:check` - Prettier フォーマット確認
4. `npm run test:all` - 全テストの実行（サーバサイド + Reactコンポーネント）

**重要な注意事項：**
- `check-all`が失敗した場合は、必ず修正後に再度`check-all`を実行すること
- フォーマットエラーの場合は`npm run format`で修正してから再実行
- これらのチェックを怠ると GitHub Actions CI が失敗する
- **どんな小さな変更でも必ずコミット前に実行すること**

**個別チェックが必要な場合：**
- フォーマット修正：`npm run format`
- 型チェックのみ：`npm run typecheck`
- リントのみ：`npm run lint`
- サーバサイドテストのみ：`npm test`
- Reactコンポーネントテストのみ：`npm run test:react`
- 全テスト：`npm run test:all`

## 実装実績

### アーキテクチャ統一プロジェクト ✅ **2025-01-31完了**

**全サービスでjest-mock-extended移行とDIパターン統一を実現**

#### 技術的成果
- **jest-mock-extended完全移行**: TestServiceContainer廃止によるシンプル化
- **ReferenceService改名**: ReferenceManager → ReferenceServiceで命名統一
- **ServiceContainer統一**: コンストラクタ注入パターンの完全統一
- **テスト品質向上**: 517→600+テストに増加

#### アーキテクチャ改善
```typescript
// 旧: 複雑なテストコンテナ
const container = TestServiceContainer.create();
const service = container.getCommentService();

// 新: シンプルなモック注入
const mockFileRepo = mock<FileRepository>();
const service = new CommentService(mockFileRepo);
```

#### 品質指標
- **ESLintエラー**: 261個→0個の完全解決
- **型安全性**: TypeScript strict mode + MockProxy<T>
- **テストカバレッジ**: 全サービス・WebViewコンポーネントの包括的テスト
- **CI/CD**: GitHub Actions完全通過

### Phase 3.5b: インライン編集機能の完全実装 ✅ **2025-01-22完了**

**VSCode標準エクスプローラー準拠のファイル名編集機能を実現**

#### 技術的成果
- **非同期ファイル操作**: `workspace.fs.rename` APIによるエディタ状態保持
- **Repository層拡張**: 同期・非同期両対応のファイルリネーム機能
- **React WebView**: 150msデバウンスバリデーション付きインライン編集
- **VSCode API準拠**: 標準エクスプローラーと同じ挙動を実現

#### アーキテクチャ改善
```typescript
// 抽象層での非同期メソッド定義
abstract class FileRepository {
  abstract renameAsync(oldUri: Uri, newUri: Uri): Promise<void>;
}

// VSCode API実装
class VSCodeFileRepository extends FileRepository {
  async renameAsync(oldUri: Uri, newUri: Uri): Promise<void> {
    await vscode.workspace.fs.rename(oldVsCodeUri, newVsCodeUri, {
      overwrite: false
    });
  }
}

// サービス層での非同期対応
class FileOperationService {
  async renameFileAsync(dirPath: string, oldName: string, newName: string): Promise<FileOperationResult> {
    await this.fileRepository.renameAsync(oldUri, newUri);
  }
}
```

#### UX改善
- **直感的操作**: クリックするだけで編集モード切り替え
- **リアルタイム検証**: 入力中の即座なフィードバック
- **キーボード対応**: Enter（保存）/ Escape（キャンセル）
- **エラーハンドリング**: 親切なエラーメッセージ表示

#### テスト対応
- MockFileRepository での非同期メソッド実装
- Promise.resolve() による適切な型対応
- ESLint require-await ルール準拠

### コメントシステムリファクタリング完了 ✅ **2025-01-25完了**

**シンプルで保守しやすいコメントシステムへの完全移行を実現**

#### 技術的成果
- **新データ構造**: `.dialogoi/{path}/{filename}.comments.yaml` 形式 + 連番ID管理
- **GitHub互換行番号**: `#L42`, `#L4-L7` 形式対応
- **汎用URLパーサー**: `FileLineUrlParser` - 将来的にマークダウンリンクでも利用可能
- **meta.yaml構造変更**: `comments`フィールドは削除され、ファイル存在ベースで判定

#### アーキテクチャ改善
```typescript
// 新コメントデータ構造
interface CommentItem {
  id: number;                           // 連番ID (1, 2, 3...)
  target_file: string;                  // "contents/chapter1.txt#L42"
  file_hash: string;                    // ファイル変更検知
  content: string;                      // マークダウン対応コメント
  posted_by: string;                    // 投稿者識別
  status: 'open' | 'resolved';         // シンプル2状態
  created_at: string;                   // ISO 8601形式
}

// 汎用的な行番号URLパーサー
export function parseFileLineUrl(url: string): ParsedFileLineUrl;
export function formatFileLineUrl(filePath: string, startLine?: number, endLine?: number): string;
```

#### 品質指標
- **テストカバレッジ**: CommentService 25テスト + FileLineUrlParser 15テスト
- **型安全性**: TypeScript strict mode + ESLint max-warnings 0
- **後方互換性**: エイリアス関数で既存コード継続動作
- **実用性**: examples/sample-novel でサンプルデータ提供

#### meta.yaml新構造
```yaml
# 旧構造（廃止）
files:
  - name: "chapter1.txt"
    reviews: "chapter1.txt_reviews.yaml"  # 廃止
    review_count: { open: 3, resolved: 5 }  # 廃止
    comments: "chapter1.txt.comments.yaml"  # 廃止

# 新構造（実装完了）
files:
  - name: "chapter1.txt"
    type: "content"
    hash: "sha256hash..."
    tags: ["重要"]
    references: ["settings/world.md"]
    # commentsフィールドは削除 - ファイル存在ベースで判定
```

この実装により、協業前提の複雑なレビューシステムから、一人作業でも有用なシンプルなコメント・TODO管理システムへの移行が完了しました。
