# FileOperationService 分割リファクタリング計画書

作成日: 2025-01-28  
最終更新: 2025-01-28

## 概要

FileOperationServiceは現在1714行、25+メソッドの巨大なクラス（God Object）となっており、分割が必要。
しかし、ファイル操作とメタデータ操作を安易に分離すると、データ整合性のリスクが生じる可能性がある。

**重要な設計方針**: 
- 「ファイル操作後は必ずメタデータも更新する」という原則を保持
- メタデータ更新し忘れのミスを防ぐ設計を優先
- その上で、機能別の分割により保守性を向上

## 調査項目

### Phase 1: 利用状況調査 🔄 **進行中**

#### 1.1 FileOperationServiceの利用パターン調査
- [ ] メタデータ操作を伴わないファイル操作の存在確認
- [ ] メタデータのみを更新したい操作の存在確認  
- [ ] 各メソッドの利用箇所と用途の詳細分析

#### 1.2 FileManagementServiceとの関係調査
- [ ] FileManagementServiceの利用状況
- [ ] FileOperationServiceとの機能重複の詳細確認
- [ ] 統合の必要性と影響範囲の評価

#### 1.3 メソッド分類
- [ ] 現在の25+メソッドを機能別に分類
- [ ] 各メソッドの依存関係マップ作成
- [ ] 分割候補の特定

### Phase 2: 分割設計
- [ ] データ整合性を保つ分割方法の設計
- [ ] 新しいサービス構造の提案
- [ ] インターフェース設計

### Phase 3: 実装
- [ ] 段階的な分割実装
- [ ] テスト更新
- [ ] 利用箇所の更新

## 調査結果

### FileOperationServiceの現状分析

**基本情報:**
- ファイル行数: 1714行
- メソッド数: **30個** (public: 22個, private: 8個)
- 主要依存関係: FileRepository, MetaYamlService
- 利用箇所: 12ファイル以上

**問題点:**
1. **God Object化**: 単一責任原則違反
2. **保守性の低下**: 巨大すぎて変更影響の把握が困難
3. **テストの複雑化**: 巨大クラスによるテスト作成・保守の困難

### 全メソッド一覧

#### 基本ファイル操作メソッド
```typescript
// ファイル・ディレクトリ作成
78: async createFile(dirPath: string, fileName: string, fileType: 'content' | 'setting' | 'subdirectory', initialContent: string = '', tags: string[] = [], subtype?: 'character' | 'foreshadowing' | 'glossary'): Promise<FileOperationResult>
1519: async createFileAsync(dirPath: string, fileName: string, fileType: 'content' | 'setting' | 'subdirectory', initialContent: string = '', tags: string[] = [], subtype?: 'character' | 'foreshadowing' | 'glossary'): Promise<FileOperationResult>

// ファイル・ディレクトリ削除
189: async deleteFile(dirPath: string, fileName: string): Promise<FileOperationResult>
1632: async deleteFileAsync(dirPath: string, fileName: string): Promise<FileOperationResult>
923: async deleteDirectoryAsync(parentDir: string, dirName: string): Promise<FileOperationResult>
974: async deleteDirectory(parentDir: string, dirName: string): Promise<FileOperationResult>

// ファイル・ディレクトリ移動・リネーム
281: async renameFile(dirPath: string, oldName: string, newName: string): Promise<FileOperationResult>
375: async renameFileAsync(dirPath: string, oldName: string, newName: string): Promise<FileOperationResult>
1126: async moveFileAsync(sourceDir: string, fileName: string, targetDir: string, newIndex?: number): Promise<FileOperationResult>
1025: async moveDirectoryAsync(sourceParentDir: string, dirName: string, targetParentDir: string, newIndex?: number): Promise<FileOperationResult>

// ファイル順序操作
236: async reorderFiles(dirPath: string, fromIndex: number, toIndex: number): Promise<FileOperationResult>
```

#### メタデータ操作メソッド
```typescript
// タグ操作
468: async addTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult>
510: async removeTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult>
551: async setTags(dirPath: string, fileName: string, tags: string[]): Promise<FileOperationResult>

// 参照操作
587: async addReference(dirPath: string, fileName: string, referencePath: string): Promise<FileOperationResult>
633: async removeReference(dirPath: string, fileName: string, referencePath: string): Promise<FileOperationResult>
678: async setReferences(dirPath: string, fileName: string, references: string[]): Promise<FileOperationResult>
```

#### 業務ロジック専用メソッド
```typescript
// キャラクター操作
718: async setCharacterImportance(dirPath: string, fileName: string, importance: 'main' | 'sub' | 'background'): Promise<FileOperationResult>
764: async setMultipleCharacters(dirPath: string, fileName: string, multipleCharacters: boolean): Promise<FileOperationResult>
810: async removeCharacter(dirPath: string, fileName: string): Promise<FileOperationResult>

// 伏線操作  
845: async setForeshadowing(dirPath: string, fileName: string, foreshadowingData: ForeshadowingData): Promise<FileOperationResult>
887: async removeForeshadowing(dirPath: string, fileName: string): Promise<FileOperationResult>
```

#### 低レベルファイル操作（プロキシメソッド）
```typescript
1681: async readFileAsync(filePath: string, encoding: 'utf8' = 'utf8'): Promise<string>
1689: async writeFileAsync(filePath: string, content: string): Promise<void>
1697: async existsAsync(filePath: string): Promise<boolean>
```

#### ユーティリティ・プライベートメソッド
```typescript
49: getNovelRootPath(): string | undefined
58: private ensureAbsolutePath(inputPath: string): string
1279: private async updateLinksForDirectoryMoveAsync(oldDirPath: string, newDirPath: string): Promise<void>
1305: private async walkDirectoryForLinkUpdateAsync(currentOldDirPath: string, currentNewDirPath: string, rootOldDirPath: string, rootNewDirPath: string): Promise<void>
1385: private async updateMetaYamlAsync(dirPath: string, updateFunction: (meta: MetaYaml) => MetaYaml): Promise<FileOperationResult>
1434: private updateHyperlinkReferences(_fileAbsolutePath: string): void
1493: updateAllReferences(_fileAbsolutePath: string, _manualReferences: string[] = []): void
1705: private async moveCommentFileIfExists(fileItem: DialogoiTreeItem, sourceDir: string, targetDir: string): Promise<void>
```

### 利用状況調査結果 ✅ **完了**

#### 主要利用箇所の分析

**調査対象ファイル:**
- `DialogoiTreeDataProvider.ts` - TreeViewの主要操作
- `FileDetailsViewProvider.ts` - WebView詳細表示
- `characterCommands.ts` - キャラクター関連コマンド
- `foreshadowingCommands.ts` - 伏線関連コマンド（現在無効化）

#### 各ファイルでの利用メソッド

**DialogoiTreeDataProvider.ts（最大利用箇所）:**
- `createFileAsync()` - ファイル作成 + メタデータ操作
- `deleteFileAsync()` - ファイル削除 + メタデータ操作
- `deleteDirectoryAsync()` - ディレクトリ削除 + メタデータ操作
- `reorderFiles()` - **メタデータのみ**
- `renameFileAsync()` - ファイル名変更 + メタデータ操作
- `addTag()`, `removeTag()`, `setTags()` - **メタデータのみ**
- `addReference()`, `removeReference()`, `setReferences()` - **メタデータのみ**
- `moveFileAsync()` - ファイル移動 + メタデータ操作
- `moveDirectoryAsync()` - ディレクトリ移動 + メタデータ操作

**FileDetailsViewProvider.ts:**
- `renameFileAsync()` - ファイル名変更 + メタデータ操作

**characterCommands.ts:**
- `setCharacterImportance()` - **メタデータのみ**
- `setMultipleCharacters()` - **メタデータのみ**

#### メタデータ操作パターンの分析

**パターンA: ファイル操作 + 必須メタデータ更新**
- `createFileAsync()`, `deleteFileAsync()`, `renameFileAsync()`
- `moveFileAsync()`, `moveDirectoryAsync()`, `deleteDirectoryAsync()`
- **特徴**: ファイルシステム操作とメタデータ操作が必ずセット

**パターンB: ファイル操作のみ（メタデータ更新不要）**
- **該当なし** - 調査した範囲では純粋なファイル操作は使用されていない
- `readFileAsync()`, `writeFileAsync()`, `existsAsync()`は対象ファイル群で未使用

**パターンC: メタデータ操作のみ**
- `reorderFiles()` - ファイル順序変更
- タグ操作: `addTag()`, `removeTag()`, `setTags()`
- 参照操作: `addReference()`, `removeReference()`, `setReferences()`
- キャラクター操作: `setCharacterImportance()`, `setMultipleCharacters()`
- **特徴**: ファイルシステムには触れず、meta.yamlのみ更新

### FileManagementServiceとの関係調査 ✅ **完了**

#### FileManagementServiceの概要
- **メソッド数**: 3個 (全てpublic async)
- **責務**: 管理対象外ファイルの追加・削除、欠損ファイルの作成
- **利用箇所**: `fileCommands.ts`でのみ使用

#### FileManagementServiceのメソッド
```typescript
// 管理対象外ファイルをmeta.yamlに追加（メタデータのみ操作）
31: async addFileToManagement(absoluteFilePath: string, fileType: 'content' | 'setting'): Promise<FileManagementResult>

// meta.yamlからファイルエントリを削除（メタデータのみ操作）
98: async removeFileFromManagement(absoluteFilePath: string): Promise<FileManagementResult>

// 欠損ファイルを物理的に作成（ファイル操作のみ、メタデータ更新なし）
147: async createMissingFile(absoluteFilePath: string, template?: string): Promise<FileManagementResult>
```

#### FileOperationServiceとの機能比較

| 機能 | FileOperationService | FileManagementService | 重複判定 |
|------|---------------------|----------------------|---------|
| ファイル作成 | `createFileAsync()` - ファイル作成+メタデータ追加 | `createMissingFile()` - ファイル作成のみ | **違う目的** |
| ファイル削除 | `deleteFileAsync()` - ファイル削除+メタデータ削除 | `removeFileFromManagement()` - メタデータ削除のみ | **違う目的** |
| メタデータ追加 | 新規ファイル作成時に自動実行 | `addFileToManagement()` - 既存ファイルを管理対象に | **違う目的** |

#### 利用パターンの分析
- **FileManagementService**: 管理対象外ファイルを後から管理に含める場合や、欠損ファイルの補完
- **FileOperationService**: 通常のファイルライフサイクル管理（作成・削除・移動等）

#### 統合の必要性評価

**統合すべき理由:**
1. **責務の近似性**: 両方ともファイル管理に関する処理
2. **利用箇所の少なさ**: FileManagementServiceは1箇所でのみ使用
3. **一貫性向上**: ファイル管理機能の統一化

**統合時の注意点:**
- `createMissingFile()`は物理ファイル作成のみでメタデータ更新なし
- この特殊な挙動を維持する必要がある

### 🔍 **重要な発見**

1. **ファイル操作は常にメタデータとセット**: 物理ファイル操作を行うメソッドは100%メタデータも更新
2. **メタデータ専用操作が多数存在**: タグ・参照・キャラクター・順序変更など
3. **純粋なファイル操作は使用されていない**: 低レベルAPIは外部から直接利用されていない
4. **整合性が保たれている**: 現在の設計では「メタデータ更新し忘れ」は構造的に発生しない
5. **FileManagementServiceは特殊用途**: 通常と異なるファイル管理パターンを提供

### 調査結論と分割戦略 ✅ **完了**

#### データ整合性についての結論

**調査結果：分離リスクは低い**
- 現在の利用パターンは「ファイル+メタデータ操作」か「メタデータのみ操作」の2種類のみ
- 「ファイルのみ操作」は存在しない（低レベルAPIは内部でのみ使用）
- 適切な抽象化により、データ整合性を保持したまま分割可能

#### ⚠️ **重要な発見: 重複メソッドの存在**

**重複メソッドの詳細調査:**
- `createFile()` と `createFileAsync()` - 実装がほぼ同じ（変数代入の微細な違いのみ）
- `deleteFile()` と `deleteFileAsync()` - 実装がほぼ同じ（変数代入の微細な違いのみ）
- `renameFile()` と `renameFileAsync()` - 実装が完全に同じ（コメントの違いのみ）
- `deleteDirectory()` と `deleteDirectoryAsync()` - **実装が完全に同じ**（メソッド名の違いのみ）

**統合方針:**
- Async版メソッドに統合（より新しい実装パターン）
- メソッド数を30個 → **23個に削減可能**（さらに1つ削減）
- 設計の単純化とメンテナンス性向上
- `moveFileAsync()` と `moveDirectoryAsync()` は既にAsync版のみ

#### 分割方針の決定

**業務ドメインベースの分割** を採用：
- 操作の種類（ファイル vs メタデータ）ではなく
- 業務の責務（基本管理 vs 専門機能）で分割する
- **ファサードパターンは採用しない**（一括更新のため後方互換性不要）

**修正された最終設計（23メソッド）:**

```
現在: FileOperationService (1714行, 30メソッド)
                    ↓
分割後: 3つのサービスクラス（重複削除+統合）

1️⃣ CoreFileService (~600行)
   📁 基本ファイル・ディレクトリ操作 [8メソッド]
   - createFile(), deleteFile(), renameFile()  
   - moveFile(), moveDirectory()
   - deleteDirectory()
   - reorderFiles()
   - readFile(), writeFile(), exists() (低レベルAPI)

2️⃣ MetadataService (~400行)  
   📋 メタデータ専用操作 [8メソッド]
   - タグ操作: addTag(), removeTag(), setTags()
   - 参照操作: addReference(), removeReference(), setReferences()
   - updateMetaYaml(), updateAllReferences()

3️⃣ FileManagementService (~500行) ← 名前継続
   🎭 特殊操作・業務ロジック [7メソッド]
   - キャラクター: setCharacterImportance(), setMultipleCharacters(), removeCharacter()
   - 伏線: setForeshadowing(), removeForeshadowing()
   - 特殊管理: addFileToManagement(), createMissingFile()
   
   ※ removeFileFromManagement()は既存FileManagementServiceから継承
```

**統合・改善される項目:**
- **重複メソッド削除 [4個]**: `createFile()`, `deleteFile()`, `renameFile()`, `deleteDirectory()` → Async版に統合
- **メソッド名簡略化**: 全メソッドから不要な`Async`サフィックスを削除
  - 例: `createFileAsync()` → `createFile()` (戻り値型`Promise<T>`で非同期は明確)
- **既存重複削除**: `removeFileFromManagement()` (既存FileManagementServiceに既存)
- **プライベートメソッド**: 整理統合

### 修正されたアーキテクチャの利点

#### 🛡️ データ整合性の保持
- **複合操作パターンの維持**: ファイル+メタデータ操作は新サービス内でも継続
- **低レベルAPI隠蔽**: FileRepository直接アクセスを各サービス内に封じ込め
- **トランザクション境界**: サービス単位での失敗時ロールバック対応

#### 📦 責務の明確化  
- **CoreFileService**: ファイルシステム操作 + 必要なメタデータ更新
- **MetadataService**: meta.yaml専用操作（ファイルシステム変更なし）
- **FileManagementService**: 特殊操作・業務ドメイン固有処理

#### 🎯 簡潔な設計
- **重複メソッド削除**: 30メソッド → **23メソッドに削減**
- **ファサード不要**: 一括更新により後方互換性維持の複雑性を排除
- **命名の簡潔性**: 不要な`Async`サフィックスを削除（TypeScriptの型で明確）

#### 🔄 移行戦略
- **一括更新**: 全利用箇所を一度に更新（12+箇所）
- **テスト更新**: 既存テストをサービス別に分割・整理
- **段階的実装**: MetadataService → FileManagementService → CoreFileService の順

### データ整合性保証の仕組み

#### 設計原則
1. **複合操作の不可分性**: ファイル操作は常にメタデータ操作とセット実行
2. **レイヤー分離**: 業務ロジックと低レベル操作の明確な境界
3. **失敗安全**: 一部操作失敗時の適切なエラーハンドリング

#### 実装パターン
```typescript
// ❌ 分離前（リスクあり）
await fileService.createPhysicalFile(path, content);
await metadataService.addFileEntry(path, metadata); // 忘れる可能性

// ✅ 分離後（安全）
await coreFileService.createFileAsync(dirPath, fileName, fileType, content); 
// ↑ 内部でファイル作成+メタデータ更新を不可分実行
```

## 修正された実装計画 🚀

### Phase 1: メタデータサービス作成
- [ ] **MetadataService**の実装 (8メソッド移行)
  - タグ・参照操作の単純なメタデータ専用操作
  - 最もリスクが低く、独立性が高い
- [ ] MetadataServiceの単体テスト作成
- [ ] ServiceContainer更新 (MetadataService DI設定)

### Phase 2: ファイル管理サービス拡張  
- [ ] **FileManagementService**の拡張実装 (7メソッド移行)
  - 既存3メソッド + キャラクター・伏線機能4メソッド追加
  - 旧FileManagementServiceとの統合
- [ ] 拡張FileManagementServiceの単体テスト作成

### Phase 3: コアファイルサービス作成
- [ ] **CoreFileService**の実装 (9メソッド移行)
  - 最も複雑なファイル+メタデータ複合操作
  - 重複メソッド統合（Async版に一本化）
  - データ整合性の重点テスト
- [ ] CoreFileServiceの単体テスト作成

### Phase 4: 統合と一括更新
- [ ] ServiceContainer完全更新（全DIバインディング変更）
- [ ] 利用箇所一括更新（12+箇所のimport・メソッド呼び出し変更）
- [ ] 既存テストの分割・整理（サービス別テストスイート作成）
- [ ] 統合テスト実行・CI確認
- [ ] 旧FileOperationService削除

## 注意事項・リスク

### データ整合性リスク
- ファイル操作とメタデータ操作の分離による不整合
- 複数サービス間での操作順序の重要性
- エラー処理時の部分的な状態変更

### 移行リスク
- 12+箇所の利用箇所での破壊的変更
- テストの大幅な書き換え
- 複雑な依存関係による予期しない副作用

## 進捗記録

### 2025-01-28 (初回調査)
- [x] 調査計画書作成
- [x] FileOperationServiceメソッド一覧作成（30メソッド特定）
- [x] 利用箇所の詳細調査（4箇所の主要利用パターン分析）
- [x] メタデータ操作の必要性確認（3つのパターン特定）
- [x] FileManagementServiceとの機能重複分析（統合方針決定）
- [x] **分割戦略の確定** - データ整合性リスクは低いことを確認
- [x] **最終分割設計案の策定** - 3+1サービスアーキテクチャ

### 2025-01-28 (設計修正)
- [x] **重複メソッド調査・統合方針確定** - 30 → 23メソッドに削減
- [x] **ファサードパターン削除** - 後方互換性不要のため設計簡略化
- [x] **BusinessLogicService → FileManagementService名前修正**
- [x] **実装計画の再策定** - 4フェーズによる段階的実装
- [x] **追加重複調査** - deleteDirectory/deleteDirectoryAsync統合確認
- [x] **メソッド命名改善** - 不要なAsyncサフィックス削除方針決定

## 調査・設計フェーズ完了 ✅

**重要な成果:**
1. **データ整合性の懸念は杞憂** - 現在の設計で既に適切に管理
2. **重複メソッドの存在確認** - createFile/createFileAsync等の不要な重複を特定
3. **設計の簡略化** - ファサード不要、一括更新による直接的なアプローチ
4. **命名の一貫性** - FileManagementService名の継続、Async版への統一

## 次回セッションでの継続ポイント

**Phase 1: メタデータサービス作成**から開始：
1. **MetadataService.ts**の実装（8メソッド移行）
2. MetadataServiceの単体テスト作成
3. ServiceContainerのDI設定更新
4. `npm run check-all`でCIパス確認

調査・設計により、簡潔で安全な分割方針が確定しました。実装フェーズに移行可能です。