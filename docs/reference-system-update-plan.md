# 参照システム更新計画

## 背景
現在の参照システムの問題点：
1. 参照追加時にファイル詳細パネルがリアルタイム更新されない
2. パスが絶対パスになっている（プロジェクト相対パスであるべき）
3. ファイル詳細表示でパス全体が表示される（ファイル名だけの方が親切）
4. 設定ファイルへのドロップ時のリンクパスが不正

## 仕様変更
- 設定ファイルの`references`フィールドを廃止
- 設定ファイルはマークダウン内のハイパーリンクから参照を抽出
- 本文ファイルのみ`references`フィールドを使用

## 実装計画

### Phase 1: DropHandlerServiceの修正 ✅ **完了**
- [x] 絶対パスではなくプロジェクト相対パスを保存
- [x] 設定ファイルへのドロップ時のリンクパス修正
- [x] FileChangeNotificationServiceによる更新通知の実装
- [x] ReferenceManagerの更新処理追加

### Phase 2: FileDetailsViewProviderの修正 ✅ **完了**
- [x] 参照表示をファイル名のみに変更
- [x] リアルタイム更新の実装（FileChangeNotificationService経由）
- [x] getUpdatedCurrentItem()による最新データ取得機能
- [x] タグ・参照・キャラクター情報の即座反映

### Phase 3: 参照システムの仕様変更 ✅ **完了**
- [x] 設定ファイルの参照をハイパーリンクベースに変更
- [x] FileDetailsViewProviderで設定ファイルの場合はHyperlinkExtractorServiceを使用
- [x] UI表示の調整（設定ファイルでは「参照追加」ボタンを非表示）

### Phase 4: テストの更新 ✅ **完了**
- [x] DropHandlerServiceのテスト実装
- [x] FileChangeNotificationServiceのテスト実装
- [x] EventEmitterRepositoryのモック実装とテスト
- [x] 新しい仕様に合わせてテストを更新
- [x] 統合テストの追加

## 技術的詳細

### 1. パスの正規化
- DropHandlerServiceで保存する参照パスをプロジェクト相対パスに統一
- 設定ファイルへのマークダウンリンクも相対パスで生成

### 2. リアルタイム更新 ✅ **実装済み**
- FileChangeNotificationServiceによるイベント駆動型アーキテクチャ
- EventEmitterRepositoryパターンによるVSCode非依存の実装
- WebViewとTreeViewの自動同期更新

### 3. 参照抽出の統一
- 本文ファイル：meta.yamlのreferencesフィールド
- 設定ファイル：HyperlinkExtractorServiceでマークダウンリンクを抽出

### 4. UI調整
- 参照表示：フルパスではなくファイル名のみ（未実装）
- 設定ファイルでは「参照追加」ボタンを非表示（未実装）

## 実装完了項目

### FileChangeNotificationService
- 中央集権的なファイル変更通知システム
- VSCode非依存の設計（EventEmitterRepository使用）
- 以下のイベントタイプをサポート：
  - META_YAML_UPDATED
  - REFERENCE_UPDATED
  - FILE_MOVED
  - FILE_REORDERED

### WebView即座更新の修正
- ドラッグ&ドロップ時の参照追加が即座に反映される
- タグの追加・削除が即座に反映される
- キャラクター情報の変更が即座に反映される
- レビュー件数の変更が即座に反映される