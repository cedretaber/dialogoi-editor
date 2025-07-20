# WebView TypeScript化 & React導入計画

## 現状の問題点

1. **TypeScript一貫性の欠如**
   - プロジェクト全体がTypeScriptなのに、WebView部分だけJavaScript
   - 型安全性の恩恵を受けられない

2. **セキュリティリスク**
   - 文字列結合によるHTML生成でXSSリスクが存在
   - `innerHTML`への直接代入
   - エスケープ処理の手動実装

3. **保守性の問題**
   - 300行のJavaScriptでDOM操作とビジネスロジックが混在
   - 複雑なHTML文字列の構築
   - テストが困難

## 提案する解決策

### Phase 2: TypeScript化
1. **WebView用TypeScript環境構築**
   - WebView専用のtsconfig.json
   - DOM・WebView API用の型定義
   - esbuildまたはwebpackでのバンドリング

2. **段階的移行**
   - script.jsをscript.tsに変換
   - 型注釈の追加
   - VSCode WebView APIの型安全な利用

### Phase 3: React導入
1. **React環境構築**
   - React、React-DOM、@types/react の追加
   - JSX対応のビルド設定
   - CSP（Content Security Policy）対応

2. **コンポーネント設計**
   ```
   src/views/webviews/fileDetails/
   ├── components/
   │   ├── FileDetailsApp.tsx       # メインアプリ
   │   ├── TagSection.tsx           # タグ管理セクション
   │   ├── CharacterSection.tsx     # キャラクター情報
   │   ├── ReferenceSection.tsx     # 参照関係
   │   ├── ReviewSection.tsx        # レビュー情報
   │   └── BasicInfoSection.tsx     # 基本情報
   ├── types/
   │   └── FileDetails.ts           # 型定義
   ├── index.tsx                    # エントリーポイント
   ├── index.html                   # HTMLテンプレート
   └── style.css                    # スタイル
   ```

3. **安全なHTML生成**
   - JSXによる型安全なHTML生成
   - ReactのXSS防護機能を活用
   - イベントハンドリングの改善

## 技術選択

### Bundler: esbuild
- **選択理由**: 軽量、高速、TypeScript・React対応
- **設定簡素**: WebPackより設定が簡単
- **VSCode Extension**: 他のVSCode拡張でも採用実績

### 型定義
```typescript
// WebView↔Extension間のメッセージ型
interface WebViewMessage {
  type: 'addTag' | 'removeTag' | 'addReference' | 'openReference';
  payload?: {
    tag?: string;
    reference?: string;
  };
}

// ファイル詳細データ型
interface FileDetailsData {
  name?: string;
  type?: string;
  path?: string;
  tags?: string[];
  character?: CharacterInfo;
  referenceData?: ReferenceData;
  review_count?: ReviewCount;
}
```

## 実装手順

### Step 1: 依存関係の追加
```json
{
  "devDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0", 
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "esbuild": "^0.19.0"
  }
}
```

### Step 2: ビルド設定
- WebView専用のビルドスクリプト
- package.jsonにwebview:buildコマンド追加
- ファイル監視とホットリロード（開発時）

### Step 3: TypeScript化
- script.jsをscript.tsに変換
- 型注釈の追加
- VSCode API型定義の活用

### Step 4: React化
- 既存JavaScript機能をReactコンポーネントに分割
- 状態管理の改善
- props経由での安全なデータ受け渡し

### Step 5: 統合テスト
- WebView↔Extension間通信のテスト
- React Componentのテスト
- E2Eテストの追加

## 利点

### 開発効率向上
- **型安全性**: TypeScriptによるコンパイル時エラー検出
- **IntelliSense**: 自動補完とリファクタリング支援
- **コンポーネント再利用**: モジュール化による保守性向上

### セキュリティ強化
- **XSS防護**: ReactのエスケープによるXSS対策
- **型チェック**: 不正なデータ構造の早期発見
- **CSP対応**: より厳密なセキュリティポリシー

### 将来の拡張性
- **テスト容易性**: Jestでのコンポーネントテスト
- **状態管理**: Redux等の導入容易性
- **UI改善**: ReactエコシステムのUIライブラリ活用

## 懸念事項と対策

### バンドルサイズ
- **対策**: Tree shakingとminificationで最適化
- **モニタリング**: bundle-analyzerでサイズ監視

### 開発環境複雑化
- **対策**: npm scriptsでビルドプロセス自動化
- **ドキュメント**: 開発手順の明文化

### CSP制約
- **対策**: nonce対応とinline script回避
- **テスト**: 本番環境相当のCSP設定でテスト

## 実装優先度

1. **Phase 2**: TypeScript化（型安全性の確保）
2. **Phase 3**: React基盤構築（基本コンポーネント）  
3. **Phase 3+**: 高度なReact機能（状態管理、テスト）

この改修により、WebViewの保守性・安全性・開発効率が大幅に向上します。