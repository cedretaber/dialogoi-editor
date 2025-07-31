# src/services テストファイル一覧

src/services/ディレクトリ内のテストファイル（*.test.ts）とそのテスト対象サービスクラスの一覧です。

## テストファイル一覧

| テストファイル | テスト対象サービス | 説明 |
|----------------|-------------------|------|
| CharacterService.test.ts | CharacterService | キャラクター情報管理サービス |
| CommentService.test.ts | CommentService | コメント機能サービス |
| CoreFileService.test.ts | CoreFileService | 基本的なファイル操作サービス |
| DialogoiSettingsService.test.ts | DialogoiSettingsService | Dialogoi設定管理サービス |
| DialogoiYamlService.test.ts | DialogoiYamlService | dialogoi.yamlファイル管理サービス |
| DropHandlerService.test.ts | DropHandlerService | ドラッグ&ドロップハンドリングサービス |
| FileChangeNotificationService.test.ts | FileChangeNotificationService | ファイル変更通知サービス |
| FileManagementService.test.ts | FileManagementService | ファイル管理サービス |
| FilePathMapService.test.ts | FilePathMapService | ファイルパスマッピングサービス |
| FileStatusService.test.ts | FileStatusService | ファイルステータス管理サービス |
| FileTypeConversionService.test.ts | FileTypeConversionService | ファイルタイプ変換サービス |
| ForeshadowingService.test.ts | ForeshadowingService | 伏線管理サービス |
| HyperlinkExtractorService.test.ts | HyperlinkExtractorService | ハイパーリンク抽出サービス |
| MetaYamlService.test.ts | MetaYamlService | .dialogoi-meta.yamlファイル管理サービス |
| MetadataService.test.ts | MetadataService | メタデータ管理サービス |
| ProjectAutoSetupService.test.ts | ProjectAutoSetupService | プロジェクト自動セットアップサービス |
| ProjectLinkUpdateService.test.ts | ProjectLinkUpdateService | プロジェクトリンク更新サービス |
| ProjectPathService.test.ts | ProjectPathService | プロジェクトパス管理サービス |
| ProjectSettingsService.test.ts | ProjectSettingsService | プロジェクト設定管理サービス |
| ProjectSetupService.test.ts | ProjectSetupService | プロジェクトセットアップサービス |
| ReferenceManager.test.ts | ReferenceManager | 参照関係管理サービス |
| TreeViewFilterService.test.ts | TreeViewFilterService | ツリービューフィルタリングサービス |

## テストファイル数

合計: **22個**のテストファイル

## 備考

- すべてのテストファイルは jest-mock-extended を使用してモック化とDI（依存性注入）パターンでテストを実装
- 各テストファイルは対応するサービスクラスの単体テストを包括的にカバー
- ファイル操作に関連するサービスは `MockProxy<FileRepository>` を使用して実際のファイルシステムに依存しないテストを実装
- TestServiceContainer と MockRepository クラスは完全に廃止され、より型安全で保守しやすいテスト構造に移行完了（2025-01-31）