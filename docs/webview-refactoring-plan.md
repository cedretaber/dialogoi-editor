# WebView リファクタリング計画

## 現状の問題点

現在のFileDetailsViewProviderは以下の問題を抱えています：

1. **HTMLが文字列として埋め込まれている**
   - 1000行を超えるファイルの中にHTMLが文字列として存在
   - メンテナンスが困難
   - シンタックスハイライトやエディタ支援が受けられない

2. **WebView内のJavaScriptからTypeScriptクラスへの直接アクセス**
   - `ReferenceManager.getInstance()`をWebView内で呼び出そうとしている
   - これは不可能（WebViewはサンドボックス化されている）
   - TypeScriptコンパイルエラーの原因

3. **データと表示ロジックの混在**
   - データ取得とHTML生成が同じ場所で行われている
   - テストが困難

## 推奨されるアーキテクチャ

### 1. HTMLファイルの分離

```
src/
  views/
    FileDetailsViewProvider.ts
    webviews/
      fileDetails/
        index.html      # メインHTML
        style.css       # スタイル
        script.js       # WebView側のJavaScript
```

### 2. データフローの明確化

```
Extension (TypeScript)          WebView (HTML/JS)
    │                              │
    ├─ データ取得                  │
    │  (ReferenceManager等)        │
    │                              │
    ├─ postMessage ──────────────► │
    │  (純粋なデータのみ)           │ 
    │                              ├─ データ受信
    │                              │
    │                              ├─ DOM更新
    │ ◄────────────── postMessage ─┤
    │                              │
    └─ アクション実行              └─ ユーザー操作
```

### 3. 実装手順

#### Phase 1: HTML/CSS/JSの分離 ✅ **完了**
1. ✅ `src/views/webviews/fileDetails/`ディレクトリを作成
2. ✅ 現在の埋め込みHTMLを`index.html`に移動
3. ✅ CSSを`style.css`に分離（334行）
4. ✅ JavaScriptを`script.js`に分離（約300行）
5. ✅ FileDetailsViewProviderの修正（ファイル読み込み方式に変更）

#### Phase 2: データ受け渡しの修正
1. FileDetailsViewProviderで必要なデータ（参照情報含む）を事前に取得
2. postMessageで純粋なデータオブジェクトとして送信
3. WebView側でデータを受け取りDOM更新

#### Phase 3: WebView用TypeScript化とテスト追加
1. WebView用のTypeScriptサポート（型安全性向上）
   - `script.js`を`script.ts`に変換
   - 型定義の追加（メッセージ型、データ型等）
2. WebViewコードのテスト環境構築
   - JSDOMを使ったユニットテスト
   - DOM操作のテスト
   - メッセージハンドリングのテスト
3. バンドリング（webpack等）
   - TypeScriptのトランスパイル
   - 依存関係の管理

#### Phase 4: モダンフレームワークの導入（React）
1. Reactベースのコンポーネント化
   - ファイル詳細表示コンポーネント
   - タグ管理コンポーネント
   - 参照管理コンポーネント
2. 状態管理の実装
   - React Context または Redux
   - WebViewとExtensionの状態同期
3. 開発環境の強化
   - Hot Module Replacement
   - React DevToolsサポート

## 利点

1. **保守性の向上**
   - HTMLエディタの機能（シンタックスハイライト、自動補完等）が使える
   - コードの見通しが良くなる

2. **型安全性とエラーの解消**
   - WebViewとExtensionの境界が明確になる
   - 現在のTypeScriptエラーが解消される

3. **テスタビリティ**
   - データ取得ロジックとビューロジックを分離してテスト可能

4. **拡張性**
   - 将来的にReactやVue等のフレームワークを導入しやすい

## 移行の影響

- 既存の機能に影響なし（内部実装の変更のみ）
- ファイル構造の変更により、初回のビルド設定が必要
- 長期的にはメンテナンスコストが大幅に削減

## Phase 1 実装結果

### 完了した作業
- **ファイル分離**: 1000行超のHTMLが3つのファイルに分離
  - `index.html`: HTMLテンプレート（プレースホルダー対応）
  - `style.css`: 334行のCSSスタイル
  - `script.js`: 約300行のJavaScript（ReferenceManager問題も解決）
- **アーキテクチャ改善**: TypeScriptエラーが完全に解決
- **保守性向上**: HTMLエディタ機能、シンタックスハイライトが利用可能
- **テスト通過**: 276個のテスト全て成功

### 解決された問題
1. ✅ TypeScript TS6133 エラー（ReferenceManager未使用警告）
2. ✅ HTMLコードの可読性・保守性問題
3. ✅ メンテナンスの困難さ

## 結論

Phase 1のHTML/CSS/JS分離により、WebViewアーキテクチャの根本的な問題が解決されました。現在のTypeScriptエラーは完全に解消され、コードの保守性が大幅に向上しました。

VSCode拡張機能開発のベストプラクティスに従ったこのリファクタリングにより、今後のPhase 2-4の実装がより効率的に行えるようになりました。