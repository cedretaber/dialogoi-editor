# WebView開発ガイドライン

このドキュメントでは、VSCode Extension内でWebViewを実装する際の規約、パターン、注意事項について説明します。

> **重要**: このプロジェクトではWebViewのUIにReact/TypeScriptを使用し、モダンな開発パターンを採用しています。

## WebView実装の基本方針

### アーキテクチャ構成

WebViewの実装は以下の構造で統一されています：

```
webview/
├── index.html          # HTMLテンプレート（プレースホルダー含む）
├── index.tsx           # Reactアプリのエントリーポイント
├── components/         # Reactコンポーネント群
├── style.css           # 共通CSS
└── types/              # TypeScript型定義
```

### ビルド・配信フロー

1. **TypeScriptコンパイル**: TypeScriptファイルが`out/webviews/`にコンパイル
2. **HTMLテンプレート処理**: Provider側でHTMLテンプレートを読み込み
3. **プレースホルダー置換**: 必要なスクリプトやCSSパスを動的に設定
4. **WebViewに配信**: 処理済みHTMLをWebViewに設定

## VSCode Extension API固有の注意事項

### セキュリティ対策

**CSP（Content Security Policy）:**
- WebView作成時に適切なCSPを設定する
- インラインスクリプトの実行制限
- 外部リソースの読み込み制限

```typescript
// Provider側でのCSP設定例
const cspSource = webview.cspSource;
webview.options = {
  enableScripts: true,
  localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'out', 'webviews')]
};

const csp = `
  default-src 'none';
  script-src ${cspSource} 'unsafe-inline';
  style-src ${cspSource} 'unsafe-inline';
  font-src ${cspSource};
  img-src ${cspSource} data:;
`;
```

**XSS対策:**
- HTMLエスケープの徹底実装
- ユーザー入力のサニタイゼーション
- 動的HTMLの生成は最小限に

### VSCode API連携

**通信の確立:**
```typescript
// WebView側：VSCode APIの取得
const vscode = acquireVsCodeApi();

// Extension側との双方向通信
vscode.postMessage({
  command: 'updateFile',
  data: { fileName: 'example.txt', content: 'new content' }
});

// メッセージ受信
window.addEventListener('message', event => {
  const message = event.data;
  switch (message.command) {
    case 'fileUpdated':
      // UIの更新処理
      break;
  }
});
```

**状態管理:**
```typescript
// WebView側での状態保存・復元
vscode.setState({ currentFile: 'example.txt', editMode: true });
const previousState = vscode.getState();
```

## React実装パターン

### コンポーネント設計原則

**関数コンポーネント優先:**
- Hook APIを活用した状態管理
- useEffect、useState等の適切な使用
- カスタムHookによるロジック分離

**型安全性の確保:**
```typescript
// Props型定義の例
interface FileDetailsProps {
  fileName: string;
  content: string;
  isEditing: boolean;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const FileDetails: React.FC<FileDetailsProps> = ({
  fileName,
  content,
  isEditing,
  onSave,
  onCancel
}) => {
  // コンポーネント実装
};
```

### VSCode API統合パターン

**カスタムHookによる抽象化:**
```typescript
// useVSCodeApi.ts - VSCode APIの抽象化
export const useVSCodeApi = () => {
  const vscode = acquireVsCodeApi();
  
  const postMessage = useCallback((message: WebViewMessage) => {
    vscode.postMessage(message);
  }, [vscode]);
  
  const setState = useCallback((state: unknown) => {
    vscode.setState(state);
  }, [vscode]);
  
  return { postMessage, setState };
};

// コンポーネントでの使用
const FileDetailsApp: React.FC = () => {
  const { postMessage } = useVSCodeApi();
  
  const handleSave = (content: string) => {
    postMessage({
      command: 'saveFile',
      data: { content }
    });
  };
  
  return <FileEditor onSave={handleSave} />;
};
```

## テストガイドライン

### Reactコンポーネントテスト

**基本パターン:**
```typescript
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileDetailsApp } from './FileDetailsApp';

describe('FileDetailsApp コンポーネント', () => {
  let mockPostMessage: (message: WebViewMessage) => void;

  beforeEach(() => {
    // VSCode APIのモック設定
    mockPostMessage = jest.fn();
    (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
      postMessage: mockPostMessage,
      setState: (): void => {},
      getState: (): unknown => ({})
    });
  });

  test('コンポーネントが正常にレンダリングされる', () => {
    render(<FileDetailsApp />);
    expect(screen.getByText('基本情報')).toBeInTheDocument();
  });
});
```

**テスト実行環境:**
- Jest設定: `testEnvironment: 'jsdom'`
- React Testing Library使用
- `npm run test:react`で実行

### テスト作成時の注意事項

**DOM要素取得:**
```typescript
// ✅ 推奨：React Testing Libraryのセレクタ
const element = screen.getByRole('button');
const element = screen.getByText('テキスト');

// ❌ 禁止：document.querySelector
const element = document.querySelector('.some-class'); // 無限待機のリスク
```

**重複要素問題:**
```typescript
// ✅ 推奨：より具体的なセレクタ
const fileTitle = screen.getByRole('heading');
assert(fileTitle.textContent === 'test.md');

// ✅ 推奨：getAllByTextで絞り込み
const elements = screen.getAllByText('test.md');
const titleElement = elements.find(el => el.closest('.file-title'));
```

**非同期処理のテスト:**
```typescript
// ✅ 必ずタイムアウト設定
await waitFor(() => {
  expect(screen.getByText('期待する要素')).toBeInTheDocument();
}, { timeout: 3000 });
```

## パフォーマンス最適化（2025年ベストプラクティス）

### React 18最適化パターン

**適切なメモ化（過度な最適化を避ける）:**
```typescript
// ✅ 高コストな計算のみメモ化
const FileList: React.FC<FileListProps> = ({ files, searchTerm }) => {
  const filteredFiles = useMemo(() => {
    // 重い処理のみメモ化
    return files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      file.content.includes(searchTerm) // 重いテキスト検索
    );
  }, [files, searchTerm]);
  
  // イベントハンドラーのメモ化（子コンポーネントに渡す場合のみ）
  const handleFileSelect = useCallback((fileName: string) => {
    postMessage({ type: 'selectFile', payload: { fileName } });
  }, [postMessage]); // postMessageは依存配列に含める
  
  return (
    <div>
      {filteredFiles.map(file => 
        <FileItem key={file.id} file={file} onSelect={handleFileSelect} />
      )}
    </div>
  );
};

// ✅ Props比較が有効な場合のみReact.memo使用
const FileItem = React.memo<FileItemProps>(({ file, onSelect }) => {
  return (
    <div onClick={() => onSelect(file.name)}>
      {file.name} - {file.lastModified}
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数（必要な場合のみ）
  return prevProps.file.id === nextProps.file.id &&
         prevProps.file.lastModified === nextProps.file.lastModified;
});
```

### メモリ管理

**確実なクリーンアップ:**
```typescript
// メッセージリスナーの適切な管理
useEffect(() => {
  const handleMessage = (event: MessageEvent<UpdateFileMessage>) => {
    if (event.data.type === 'updateFile') {
      setFileData(event.data.data);
    }
  };
  
  window.addEventListener('message', handleMessage);
  
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}, []); // 空の依存配列で一度だけ実行

// タイマーのクリーンアップ
useEffect(() => {
  const timer = setTimeout(() => {
    // 初期化処理
  }, 100);
  
  return () => clearTimeout(timer);
}, []);
```

## 実装実績から学ぶベストプラクティス

### 実装済み機能から抽出したパターン

**1. インライン編集機能（FileDetailsApp）**
- **リアルタイムバリデーション**: 入力中に即座にエラーチェック
- **非同期レスポンス処理**: Promise + タイムアウトによる確実な通信
- **フォーカス管理**: `setTimeout`による適切なフォーカス制御
- **エラー状態管理**: 編集状態、保存状態、エラー状態の分離

**2. VSCode API通信（useVSCodeApi）**
- **遅延初期化**: 100ms遅延でWebView初期化待ち
- **重複防止**: グローバルフラグによるreadyメッセージ重複送信防止
- **エラーハンドリング**: try-catch + boolean返却による堅牢な通信
- **型安全性**: ジェネリクス活用による型安全なメッセージ交換

**3. 複数アプリケーション構成**
- **独立エントリーポイント**: `index.tsx`, `projectSettings.tsx`, `comments.tsx`
- **共通hooks**: `useVSCodeApi`の再利用
- **型定義分離**: 各アプリ専用の型定義ファイル
- **テストユーティリティ**: `test-*.tsx`による共通テストヘルパー

### 開発時の推奨ワークフロー

**1. コンポーネント作成手順:**
```typescript
// 1. 型定義を先に作成
interface MyComponentProps {
  data: FileData;
  onUpdate: (data: FileData) => void;
}

// 2. コンポーネント本体
const MyComponent: React.FC<MyComponentProps> = ({ data, onUpdate }) => {
  // 3. 状態管理（複雑な場合は分離）
  const [isEditing, setIsEditing] = useState(false);
  const { postMessage } = useVSCodeApi<MyMessage>();
  
  // 4. イベントハンドラー
  const handleSave = useCallback(async () => {
    // 実装
  }, []);
  
  return <div>{/* JSX */}</div>;
};

// 5. テスト作成
describe('MyComponent', () => {
  // テスト実装
});
```

**2. 品質保証チェックリスト:**
- [ ] TypeScript strict mode でエラーなし
- [ ] ESLint警告 0個
- [ ] `npm run test:react` 通過
- [ ] Chrome DevToolsでコンソールエラーなし
- [ ] VSCode API通信の適切なエラーハンドリング
- [ ] メモリリークがないこと（リスナーのクリーンアップ）

## まとめ：一貫性のあるWebView開発のために

### 必須チェックポイント

**開発前:**
1. 既存の`useVSCodeApi`フックを活用
2. 適切なエントリーポイント（`index.tsx`, `projectSettings.tsx`等）を選択
3. 型定義を`types/`ディレクトリに配置

**開発中:**
1. React 18 `createRoot` APIを使用
2. TypeScript strict mode準拠
3. 適切なCSP設定（nonce方式）
4. メッセージリスナーの確実なクリーンアップ

**開発後:**
1. `npm run test:react`でテスト実行
2. Chrome DevToolsでデバッグ確認
3. VSCode API通信の動作確認
4. メモリリークの確認

### このガイドラインの位置づけ

このガイドラインは実装済みのWebViewコードベースから抽出されたベストプラクティスをまとめたものです。新しいWebView機能を開発する際は、このガイドラインに従うことで：

- **一貫性のあるコード品質**
- **保守しやすい実装パターン**
- **確実な動作とテスト可能性**

を実現できます。