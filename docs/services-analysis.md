# Services層 詳細分析レポート

作成日: 2025-01-28

## 概要

src/services/ディレクトリには~~26~~**23個**のサービスクラスが存在します。（3つのサービスがutils化により削除）
このドキュメントでは、各サービスの責務、依存関係、利用状況を分析し、リファクタリング提案をまとめます。

## 分析観点

1. **責務の適切性**
   - 単一責任原則（SRP）に従っているか
   - 責務が明確で適切な範囲か

2. **必要性**
   - 実際に使用されているか
   - 他のサービスと統合可能か

3. **サービスクラスの妥当性**
   - DIが必要な依存関係があるか
   - utilsクラスで十分ではないか

## サービス一覧と分析状況

| # | サービス名 | 分析状況 | 主な責務 | 問題点 | 提案 |
|---|-----------|---------|---------|--------|------|
| 1 | CharacterService | ✅ 済 | キャラクター情報管理 | 責務が狭い | 現状維持 |
| 2 | CommentService | ✅ 済 | コメント・TODO管理 | 適切 | 現状維持 |
| 3 | DialogoiSettingsService | ✅ 済 | VSCode設定管理 | 適切 | 現状維持 |
| 4 | DialogoiTemplateService | ✅ 済 | テンプレート管理 | 利用度低 | 統合検討 |
| 5 | DialogoiYamlService | ✅ 済 | プロジェクト管理 | 適切 | 現状維持 |
| 6 | DropHandlerService | ✅ 済 | ドラッグ&ドロップ処理 | 適切 | 現状維持 |
| 7 | FileChangeNotificationService | ✅ 済 | ファイル変更通知 | シングルトン | 現状維持 |
| 8 | FileManagementService | ✅ 済 | ファイル管理操作 | 統合可能 | FileOperationService統合 |
| 9 | FileOperationService | ✅ 済 | 高レベルファイル操作 | 肥大化 | 分割検討 |
| 10 | FilePathMapService | ✅ 済 | ファイルパス解決 | 適切 | 現状維持 |
| 11 | FileStatusService | ✅ 済 | ファイル状態管理 | 適切 | 現状維持 |
| 12 | FileTypeConversionService | ✅ 済 | ファイル種別変更 | 適切 | 現状維持 |
| 13 | ~~FileTypeDetectionService~~ | ✅ 済 | ~~ファイル種別判定~~ | ~~責務狭い~~ | ~~utils化済み~~ |
| 14 | ForeshadowingService | ✅ 済 | 伏線管理 | 適切 | 現状維持 |
| 15 | ~~HashService~~ | ✅ 済 | ~~ハッシュ計算~~ | ~~責務狭い~~ | ~~utils化済み~~ |
| 16 | HyperlinkExtractorService | ✅ 済 | ハイパーリンク抽出 | 責務狭い | utils化検討 |
| 17 | MetaYamlService | ✅ 済 | メタファイル管理 | 適切 | 現状維持 |
| 18 | ProjectAutoSetupService | ✅ 済 | プロジェクト自動構築 | 適切 | 現状維持 |
| 19 | ProjectCreationService | ✅ 済 | プロジェクト作成 | 廃止予定 | 削除 |
| 20 | ProjectLinkUpdateService | ✅ 済 | リンク更新 | 責務狭い | utils化検討 |
| 21 | ~~ProjectPathNormalizationService~~ | ✅ 済 | ~~パス正規化~~ | ~~責務狭い~~ | ~~utils化済み~~ |
| 22 | ProjectPathService | ✅ 済 | プロジェクトパス管理 | 適切 | 現状維持 |
| 23 | ProjectSettingsService | ✅ 済 | プロジェクト設定管理 | 適切 | 現状維持 |
| 24 | ProjectSetupService | ✅ 済 | プロジェクト統合セットアップ | 適切 | 現状維持 |
| 25 | ReferenceManager | ✅ 済 | 参照関係管理 | シングルトン | 現状維持 |
| 26 | TreeViewFilterService | ✅ 済 | TreeViewフィルタ | 適切 | 現状維持 |

## 詳細分析

### 1. CharacterService

**責務**: キャラクターファイルに関する処理
- マークダウンファイルから表示名（最初の#見出し）を抽出
- ファイルがキャラクターファイルかどうかの判定
- プロジェクト相対パスからファイル情報を取得

**依存関係**:
- FileRepository（DI）
- MetaYamlService（DI）

**利用箇所**:
- TreeDataProvider: キャラクター表示名の取得（2箇所）
- DropHandlerService: ファイル情報の取得（1箇所）

**分析結果**:
- ✅ 単一責任原則に従っている
- ✅ 適切にDIを使用している
- ⚠️ 責務が限定的すぎる可能性がある
- 💡 extractDisplayNameメソッドは汎用的な機能なので、より一般的なサービスに移動可能

**提案**: 現状維持
- 責務は明確で、キャラクター関連の処理に特化している
- 使用箇所も限定的だが、必要な機能を提供している
- 将来的にはMarkdownService等に統合する可能性はある

---

### 2. CommentService

**責務**: コメント・TODO管理機能
- コメントファイル（`.{filename}.comments.yaml`）の読み書き
- コメントの作成・更新・削除（GitHub風行番号形式対応）
- ファイル変更検知とハッシュによる整合性管理
- コメントサマリー情報の提供

**依存関係**:
- FileRepository（DI）
- ~~HashService（DI）~~（utils/HashCalculator静的メソッドに変更）  
- DialogoiYamlService（DI）
- workspaceRoot: Uri（コンストラクタ引数）

**利用箇所**:
- editorCommentCommands: エディタ選択範囲からのコメント追加（1箇所）
- CommentsViewProvider: WebViewでのコメント操作（複数箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（コメント管理のみ）
- ✅ 適切にDIを使用している
- ✅ 適切にFileLineUrlParserユーティリティを使用
- ✅ 非同期処理とエラーハンドリングが適切
- ✅ ファイルハッシュによる変更検知の実装が優秀

**提案**: 現状維持
- 責務が明確でコメント機能に特化している
- 新データ構造（連番ID管理）への移行が適切に実装されている
- VSCode Extension APIから分離されており、単体テストが容易
- 他サービスとの依存も適切に管理されている

---

### 3. DialogoiSettingsService

**責務**: VSCode設定管理（files.exclude設定）
- Dialogoi関連ファイルの表示/非表示制御
- `files.exclude`設定へのパターン追加・削除
- グローバル・ワークスペース設定の操作
- 現在の設定状況確認

**依存関係**:
- SettingsRepository（DI）

**利用箇所**:
- projectCommands: 検索除外設定管理コマンド（1箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（VSCode設定管理のみ）
- ✅ 適切にDIを使用している
- ✅ グローバル・ワークスペース設定の使い分けが適切
- ✅ エラーハンドリングとログ出力が適切
- ✅ VSCode設定パターンを定数で管理し、変更しやすい設計

**提案**: 現状維持
- 責務が明確でVSCode設定操作に特化している
- SettingsRepositoryを通じてVSCode APIと適切に分離されている
- テスト可能な設計になっている
- 必要最小限の機能に絞られており、過剰な実装がない

---

### 4. DialogoiTemplateService

**責務**: DialogoiYamlテンプレート管理
- デフォルトテンプレートの読み込み（`templates/default-dialogoi.yaml`）
- テンプレートからの新規DialogoiYaml作成
- デフォルト除外パターン・READMEファイル名の提供

**依存関係**:
- FileRepository（DI）

**利用箇所**:
- ProjectCreationService: テンプレートベースのプロジェクト作成（1箇所・廃止予定）

**分析結果**:
- ✅ 単一責任原則に従っている（テンプレート管理のみ）
- ✅ 適切にDIを使用している
- ⚠️ 主要な利用箇所（ProjectCreationService）が廃止予定
- ⚠️ 実際の利用頻度が低い
- 💡 DialogoiYamlServiceへの統合を検討すべき

**提案**: DialogoiYamlServiceへの統合検討
- ProjectCreationService廃止により、利用箇所が大幅に減少
- テンプレート管理はDialogoiYamlServiceの責務に含まれる可能性が高い
- 独立したサービスとして維持する必要性が低下
- 統合により、より凝集度の高い設計になる

---

### 5. DialogoiYamlService

**責務**: Dialogoiプロジェクト管理（dialogoi.yaml）
- dialogoi.yamlファイルの読み書き・バリデーション
- プロジェクトルート検索・判定
- プロジェクト作成・更新
- 除外パターン取得

**依存関係**:
- FileRepository（DI）

**利用箇所**:
- 多数のサービス・コンポーネントから利用（19ファイル）
- ProjectSetupService, ProjectAutoSetupService, ProjectPathService
- TreeDataProvider, FileDetailsViewProvider
- CommentService, DropHandlerService等

**分析結果**:
- ✅ 単一責任原則に従っている（プロジェクト設定管理のみ）
- ✅ 適切にDIを使用している
- ✅ 非同期処理に完全対応
- ✅ 他サービスからの利用頻度が非常に高い（コアサービス）
- ✅ エラーハンドリングと検証機能が適切
- ⚠️ 一部非推奨メソッドが存在（循環依存対策）

**提案**: 現状維持
- プロジェクトの基盤となるコアサービスとして適切に機能
- 責務が明確でプロジェクト設定管理に特化
- 他サービスとの依存関係が適切に管理されている
- 非推奨メソッドは計画的に導入された循環依存対策

---

### 6. DropHandlerService

**責務**: ドラッグ&ドロップ処理のビジネスロジック
- TreeViewからエディタへのファイルドロップ処理
- 本文ファイルへのドロップ（references追加）
- 設定ファイルへのドロップ（マークダウンリンク生成）
- ドロップ先ファイル種別の判定

**依存関係**:
- CharacterService（DI）
- MetaYamlService（DI）
- DialogoiYamlService（DI）
- FileChangeNotificationService（シングルトン）
- ReferenceManager（シングルトン）

**利用箇所**:
- dropCommands: DocumentDropEditProvider実装（1箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（ドロップ処理のみ）
- ✅ VSCode APIから分離されたビジネスロジック
- ✅ 適切にDIを使用している
- ✅ 本文ファイルと設定ファイルでの異なる処理を適切に実装
- ✅ エラーハンドリングが充実
- ⚠️ 一部シングルトンサービスへの直接アクセス（FileChangeNotificationService、ReferenceManager）

**提案**: 現状維持
- 責務が明確でドラッグ&ドロップ処理に特化
- VSCode Extension APIとの分離が適切
- 複雑なファイル間関係の処理を適切に実装
- シングルトンアクセスは許容範囲内

---

### 7. FileChangeNotificationService

**責務**: ファイル変更イベントの通知・購読管理
- ファイル変更イベントの発行（MetaYaml更新、ファイル移動・作成・削除等）
- TreeView・WebView間の更新タイミング調整
- EventEmitterを使用したpub-subパターン実装
- 各種ファイル操作の通知メソッド提供

**依存関係**:
- EventEmitterRepository（DI・コンストラクタ）
- シングルトンパターンで実装

**利用箇所**:
- 多数のサービス・コンポーネントから利用（8ファイル）
- TreeDataProvider, FileDetailsViewProvider
- DropHandlerService, FileTypeConversionService等

**分析結果**:
- ✅ 単一責任原則に従っている（イベント通知のみ）
- ✅ EventEmitterRepositoryを通じてVSCode APIと分離
- ✅ 適切にDIを使用している（シングルトン内で）
- ✅ pub-subパターンの適切な実装
- ⚠️ シングルトンパターンの使用（getInstance前にsetInstance必要）
- ✅ 豊富なファイル変更イベント型の定義

**提案**: 現状維持
- 横断的関心事（イベント通知）にはシングルトンが適切
- EventEmitterRepository経由でテスト可能
- UI更新の一元管理に必要不可欠
- 複数コンポーネント間の疎結合を実現

---

### 8. FileManagementService

**責務**: ファイル管理操作（管理対象外ファイルの処理）
- 未管理ファイルをmeta.yamlに追加
- 欠損ファイルをmeta.yamlから削除  
- 欠損ファイルの新規作成（テンプレート対応）
- 拡張子別のデフォルト内容生成

**依存関係**:
- FileRepository（DI）
- MetaYamlService（DI）

**利用箇所**:
- fileCommands: ファイル管理コマンド（3箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（ファイル管理操作のみ）
- ✅ 適切にDIを使用している
- ✅ エラーハンドリングが適切
- ⚠️ FileOperationServiceと機能的に重複
- ⚠️ ファイル操作の責務が分散している
- 💡 FileOperationServiceへの統合を検討すべき

**提案**: FileOperationServiceへの統合
- 両サービスともファイル操作を担当
- meta.yamlとの連携は共通の責務
- 統合により、ファイル操作の一元化が可能
- 利用箇所が限定的で統合の影響は小さい

---

### 9. FileOperationService

**責務**: ファイル・ディレクトリの高レベル操作とメタデータ管理
- ファイル・ディレクトリの作成・削除・移動・リネーム（25+メソッド）
- タグ・参照・キャラクター・伏線情報の管理
- meta.yaml との同期更新
- ファイル内容の読み書き（プロキシメソッド）
- コメントファイル移動機能

**依存関係**:
- FileRepository（DI）
- MetaYamlService（DI）
- novelRootAbsolutePath（オプション）
- ProjectLinkUpdateService（内部インスタンス化）
- ProjectPathNormalizationService（内部インスタンス化）

**利用箇所**:
- 多数のコンポーネントから利用（12ファイル）
- TreeDataProvider, FileDetailsViewProvider
- characterCommands, foreshadowingCommands等

**分析結果**:
- ⚠️ **God Object化** - 1714行、25+メソッドで責務過多
- ⚠️ 単一責任原則違反 - ファイル操作・メタデータ管理・業務ロジックが混在
- ✅ 適切にDIを使用している
- ⚠️ FileManagementServiceと機能重複
- ⚠️ 内部で他サービスをnewしている（DI原則違反）
- ✅ コアサービスとして多数の箇所から利用

**提案**: 責務分割と再構築
- **CoreFileOperationService**: 基本的なファイル操作のみ
- **MetadataOperationService**: meta.yaml連携専用
- **FileManagementService統合**: 管理操作を統合
- **各業務ロジックは専用サービスへ**: キャラクター、伏線等

---

### 10. FilePathMapService

**責務**: プロジェクト内ファイルパス解決とマッピング
- プロジェクト全体のファイルマップをメモリ上に構築・管理
- リンクの相対パス → プロジェクトルート相対パスの解決
- プロジェクト内ファイル判定（高速化のためマップ使用）
- ファイル変更時のマップ更新

**依存関係**:
- MetaYamlService（DI）
- FileOperationService（DI）

**利用箇所**:
- HyperlinkExtractorService, ReferenceManager（7ファイル）

**分析結果**:
- ✅ 単一責任原則に従っている（パス解決・マッピングのみ）
- ✅ 適切にDIを使用している
- ✅ パフォーマンス最適化（メモリマップ使用）
- ✅ Windows/Linux パス区切り文字の正規化対応
- ✅ 外部リンク判定機能

**提案**: 現状維持
- パス解決の複雑なロジックを適切に抽象化
- パフォーマンス要件を満たす設計
- テスト可能性が高い

---

### 11. FileStatusService

**責務**: ファイル管理状態の統合管理
- 管理対象（meta.yamlに記載 + 実在）
- 未追跡（meta.yamlに未記載 + 実在）
- 欠損（meta.yamlに記載 + 不在）の3状態を統合提供
- README・コメントファイルも管理対象として認識

**依存関係**:
- FileRepository（DI）
- MetaYamlService（DI）

**利用箇所**:
- TreeDataProvider等でファイル状態表示に使用

**分析結果**:
- ✅ 単一責任原則に従っている（ファイル状態管理のみ）
- ✅ 適切にDIを使用している
- ✅ 3つの状態を統合した包括的な管理
- ✅ meta.yaml以外の管理ファイルも考慮

**提案**: 現状維持
- ファイル管理の複雑な状態を適切に抽象化
- TreeViewでの状態表示に必要不可欠

---

### 12. FileTypeConversionService

**責務**: ファイル種別変更（content ↔ setting）
- 管理対象ファイルの種別変更処理
- プロジェクト全体からファイル検索
- meta.yamlの安全な更新
- 詳細なエラーハンドリングとログ出力

**依存関係**:
- FileRepository（DI）
- MetaYamlService（DI）

**利用箇所**:
- FileDetailsViewProvider等でファイル種別変更機能

**分析結果**:
- ✅ 単一責任原則に従っている（種別変更のみ）
- ✅ 適切にDIを使用している
- ✅ 堅牢なエラーハンドリング
- ✅ プロジェクト横断的なファイル検索機能

**提案**: 現状維持
- 複雑な種別変更処理を適切に実装
- ユーザーフレンドリーなエラーメッセージ

---

### 17. MetaYamlService

**責務**: .dialogoi-meta.yamlファイル管理
- メタファイルの読み込み・保存・バリデーション
- README・コメントファイルパス取得
- 小説ルートディレクトリ検索
- ファイル情報の追加・削除・更新

**依存関係**:
- FileRepository（DI）

**利用箇所**:
- 多数のサービスから利用される基盤サービス（20+ファイル）

**分析結果**:
- ✅ 単一責任原則に従っている（meta.yaml管理のみ）
- ✅ 適切にDIを使用している
- ✅ DialogoiYamlServiceと並ぶコアサービス
- ✅ 非同期処理対応とエラーハンドリング
- ✅ 高い利用頻度（プロジェクトの基盤）

**提案**: 現状維持
- プロジェクト管理の基盤として適切に機能
- 他サービスとの依存関係が適切に設計されている

---

### 22. ProjectPathService

**責務**: プロジェクトパス管理
- 絶対パスからプロジェクトルートと相対パスの計算
- プロジェクトルート検索・検証
- PathUtilsの単一責任化リファクタリング済み

**依存関係**:
- DialogoiYamlService（DI）

**利用箇所**:
- editorCommentCommands等でプロジェクト相対パス計算（複数箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（プロジェクトパス管理のみ）
- ✅ 適切にDIを使用している
- ✅ 既存のPathUtilsから適切にリファクタリング済み
- ✅ プロジェクト横断的な機能として必要

**提案**: 現状維持
- 責務が明確でプロジェクトパス計算に特化
- 既にリファクタリング済みで設計が適切

---

### 25. ReferenceManager

**責務**: 参照関係の一元管理
- 手動参照とハイパーリンク参照の統合管理
- ファイル間の双方向参照追跡
- 参照の存在チェック・整合性保持
- メモリ上での高速参照検索

**依存関係**:
- HyperlinkExtractorService, FilePathMapService（内部取得）
- シングルトンパターンで実装

**利用箇所**:
- DropHandlerService, FileDetailsViewProvider等（複数箇所）

**分析結果**:
- ✅ 単一責任原則に従っている（参照関係管理のみ）
- ✅ 手動・自動参照を統合した包括的管理
- ✅ 双方向参照の自動追跡機能
- ⚠️ シングルトンパターン（横断的関心事には適切）
- ✅ 参照整合性の一元管理

**提案**: 現状維持
- 複雑な参照関係の管理に特化した設計
- 横断的関心事にはシングルトンが適切
- プロジェクトの参照整合性に必要不可欠

---

## 総合的なリファクタリング提案

### **優先度A（高）- 即座に実施すべき項目**

#### 1. **ProjectCreationService の削除**
- **問題**: 既に廃止予定だが残存している
- **影響**: 技術的負債の蓄積、混乱の原因
- **作業量**: 小（テストファイル含めて削除のみ）

#### 2. **FileOperationService のGod Object解消**
- **問題**: 1714行、25+メソッドで責務過多
- **提案分割案**:
  ```
  CoreFileOperationService
  ├─ 基本ファイル操作（作成・削除・移動・リネーム）
  ├─ ファイル内容読み書き
  └─ ディレクトリ操作
  
  MetadataOperationService
  ├─ meta.yaml連携操作
  ├─ タグ・参照操作
  └─ メタデータ同期
  
  BusinessLogicServices
  ├─ CharacterOperationService（キャラクター関連）
  ├─ ForeshadowingOperationService（伏線関連） 
  └─ FileManagementService統合
  ```
- **作業量**: 大（設計変更、テスト修正、利用箇所更新）

### **優先度B（中）- 計画的に実施すべき項目**

#### 3. **utils化によるアーキテクチャ改善**
以下のサービスをutils/に移動してDI不要にする：

- **FileTypeDetectionService** → `utils/FileTypeDetector.ts`
- **HashService** → `utils/HashCalculator.ts`  
- **HyperlinkExtractorService** → `utils/MarkdownLinkParser.ts`
- **ProjectLinkUpdateService** → `utils/LinkUpdater.ts`
- **ProjectPathNormalizationService** → `utils/PathNormalizer.ts`

**理由**: 
- 外部依存が少ない純粋関数的な処理
- DIオーバーヘッドが不要
- テストが簡潔になる
- 再利用性が向上

#### 4. **統合による重複排除**
- **FileManagementService** → FileOperationService統合
  - 両者ともファイル操作 + meta.yaml連携が責務
  - 統合により一貫したファイル管理APIを提供

- **DialogoiTemplateService** → DialogoiYamlService統合検討
  - テンプレート管理はプロジェクト設定の一部
  - ProjectCreationService廃止により利用度が低下

### **優先度C（低）- 将来的な改善項目**

#### 5. **パフォーマンス最適化**
- FilePathMapServiceの初期化最適化
- ReferenceManagerの差分更新機能強化
- 大規模プロジェクト対応の改善

#### 6. **エラーハンドリング統一**
- 各サービスのエラーレスポンス形式統一
- ユーザーフレンドリーなエラーメッセージ標準化

## 実施優先度とタイムライン

### **Phase 1: クリーンアップ（1-2週間）**
1. ProjectCreationService削除
2. 未使用メソッド・import整理
3. TypeScriptコンパイルエラー修正

### **Phase 2: utils化（2-3週間）**
1. 5つのサービスをutils/に移動
2. 依存関係更新とテスト修正
3. パフォーマンス測定

### **Phase 3: FileOperationService分割（3-4週間）**
1. 新サービス設計・実装
2. 既存利用箇所の段階的移行
3. 統合テスト・回帰テスト

### **Phase 4: 統合・最適化（1-2週間）**
1. FileManagementService統合
2. DialogoiTemplateService統合検討
3. 最終的なパフォーマンス測定・調整

## 期待される効果

### **コード品質向上**
- 単一責任原則の徹底
- God Objectの解消
- 技術的負債の大幅削減

### **開発効率改善**
- テスト実行時間短縮（DI削減）
- より明確な責務分離
- 新機能開発時の影響範囲明確化

### **保守性向上**
- ファイル数削減（26→23サービス）
- 依存関係の簡素化
- ドキュメント整合性向上

この分析により、プロジェクトの技術的負債を体系的に解消し、より保守しやすい設計への移行が可能になります。

## 実際の移行結果 (2025-01-28)

### **Phase 1: utils化完了**

以下の3つのサービスのutils化が完了しました：

#### ✅ 移行完了済み

| 元サービス | 移行先 | 移行理由 | 実装変更点 |
|-----------|--------|----------|------------|
| HashService | utils/HashCalculator.ts | 純粋なハッシュ計算、DI不要 | 静的メソッドに変更、FileRepository引数受け取り |
| FileTypeDetectionService | utils/FileTypeDetector.ts | 純粋なファイル種別判定、DI不要 | 静的メソッドに変更、判定ロジック改善 |
| ProjectPathNormalizationService | utils/PathNormalizer.ts | 純粋なパス操作、DI不要 | 静的メソッドに変更、パス正規化関数群 |

#### ❌ utils化見送り

| サービス | 見送り理由 |
|---------|------------|
| HyperlinkExtractorService | FileRepository・FilePathMapServiceへの依存、複雑なプロジェクト内リンク判定ロジック |
| ProjectLinkUpdateService | FileRepository・MetaYamlServiceへの依存、ファイル更新を伴う複雑な処理 |

### **移行による効果**

- **サービス数削減**: 26 → 23サービス
- **DI依存削除**: 3サービスで依存関係注入が不要に
- **テスト実行改善**: MockFileRepositoryを引数で渡す形で単体テストが高速化
- **コード可読性向上**: 純粋関数として静的メソッド化による意図明確化
- **技術的負債削減**: サービス登録・初期化コードの削除

### **Phase 1.5: HashCalculatorリファクタリング完了 (2025-01-28)**

**HashCalculator純粋化**:
- FileRepository依存を完全に除去
- ファイル読み込みは呼び出し元（CommentService等）で実行
- calculateContentHash/calculateBinaryHashによる純粋なハッシュ計算に特化
- 単一責任原則の徹底により、よりテスタブルで再利用可能な設計に

**FileTypeDetector機能削除**:  
- directory判定機能を完全廃止（無意味なため）
- FileTypeDetectionMethod型から'directory'オプション削除
- 拡張子ベースのみに簡素化、小説プロジェクトの実態に適合

### **今後の方針**

HyperlinkExtractorServiceとProjectLinkUpdateServiceは、以下の理由によりutils化を行わず、サービスとして保持：

1. **適切な依存関係**: 他のサービスへの依存は処理の複雑さに見合っている
2. **ビジネスロジック**: 単純なユーティリティではなく、プロジェクト固有の複雑な処理
3. **自然な設計**: DI による依存性注入がアーキテクチャとして適切

utils化は「純粋なロジック処理で、サービス間依存が不要なもの」に限定し、無理なutils化は行わない方針で完了。