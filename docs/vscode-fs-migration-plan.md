# VSCode Workspace.fs API 移行計画書

## 📋 概要

VSCode拡張機能として、標準のNode.js `fs`モジュールから`vscode.workspace.fs`への段階的移行を実施し、VSCode APIの恩恵を最大限活用する。

## 🎯 目標

### 主要目標
- **VSCode API準拠**: 標準エクスプローラーとの一貫した挙動実現
- **エディタ状態保持**: ファイル操作時のタブ・未保存状態維持
- **セキュリティ向上**: VSCodeのセキュリティモデル準拠
- **パフォーマンス最適化**: 非同期処理によるノンブロッキング実装

### 技術的恩恵
- **ファイルシステム抽象化**: ローカル/リモート/仮想ファイルシステムの統一的な扱い
- **VSCode統合**: ファイル監視、変更通知、エディタ連携の向上
- **権限管理**: VSCodeのワークスペース権限モデルとの整合性
- **将来対応**: VSCode Remote Development、Dev Containers等との互換性

## 🔍 現状分析

### VSCodeFileRepository内のfs使用箇所
```typescript
// 現在fs使用中のメソッド（同期版）
- existsSync()      → vscode.workspace.fs.stat()
- readFileSync()    → vscode.workspace.fs.readFile() 
- writeFileSync()   → vscode.workspace.fs.writeFile()
- mkdirSync()       → vscode.workspace.fs.createDirectory()
- createDirectorySync() → vscode.workspace.fs.createDirectory()
- unlinkSync()      → vscode.workspace.fs.delete()
- rmSync()          → vscode.workspace.fs.delete()
- readdirSync()     → vscode.workspace.fs.readDirectory()
- statSync()        → vscode.workspace.fs.stat()
- lstatSync()       → vscode.workspace.fs.stat()
- renameSync()      → vscode.workspace.fs.rename()

// 既に移行済み
- renameAsync()     ✅ vscode.workspace.fs.rename() 使用済み
```

### vscode.workspace.fs API特性
- **全て非同期**: Promise<T>を返却
- **Uri ベース**: vscode.Uri型を使用
- **エラー統一**: vscode.FileSystemError型
- **原子性**: VSCodeのファイル操作と同期

## 🛠️ 移行フェーズ

### Phase 1: 非同期メソッドの追加 ✅ **完了**
**目標**: 既存同期メソッドと並行して非同期版を追加
**実装完了日**: 2025年01月

**✅ 完了した作業:**
- FileRepository抽象層に全非同期メソッド定義追加
- VSCodeFileRepositoryでvscode.workspace.fs完全実装
- MockFileRepositoryでテスト用非同期メソッド実装
- 型安全性とエラーハンドリングの実装

#### 1.1 FileRepository抽象層拡張
```typescript
// 既に実装済みの例
abstract renameAsync(oldUri: Uri, newUri: Uri): Promise<void>;

// 追加予定のメソッド
abstract existsAsync(uri: Uri): Promise<boolean>;
abstract readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string>;
abstract readFileAsync(uri: Uri): Promise<Uint8Array>;
abstract writeFileAsync(uri: Uri, data: string | Uint8Array): Promise<void>;
abstract mkdirAsync(uri: Uri): Promise<void>;
abstract createDirectoryAsync(uri: Uri): Promise<void>;
abstract unlinkAsync(uri: Uri): Promise<void>;
abstract rmAsync(uri: Uri, options?: { recursive?: boolean }): Promise<void>;
abstract readdirAsync(uri: Uri): Promise<DirectoryEntry[]>;
abstract statAsync(uri: Uri): Promise<FileStats>;
```

#### 1.2 VSCodeFileRepository実装
```typescript
// 実装例（existsAsync）
async existsAsync(uri: Uri): Promise<boolean> {
  const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
  try {
    await vscode.workspace.fs.stat(vsCodeUri);
    return true;
  } catch (error) {
    // FileSystemError.FileNotFound の場合はfalse
    if (error instanceof vscode.FileSystemError && 
        error.code === 'FileNotFound') {
      return false;
    }
    throw error;
  }
}

// 実装例（readFileAsync）
async readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string>;
async readFileAsync(uri: Uri): Promise<Uint8Array>;
async readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string | Uint8Array> {
  const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
  try {
    const content = await vscode.workspace.fs.readFile(vsCodeUri);
    if (encoding !== undefined) {
      return Buffer.from(content).toString(encoding);
    }
    return content;
  } catch (error) {
    throw new Error(
      `ファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

#### 1.3 MockFileRepository対応
```typescript
// テスト用の非同期メソッド実装
async existsAsync(uri: Uri): Promise<boolean> {
  return this.existsSync(uri);
}

async readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string | Uint8Array> {
  const result = this.readFileSync(uri, encoding as any);
  return Promise.resolve(result);
}
```

### Phase 2: Service層の段階的移行 ✅ **完了**
**目標**: 高レベルサービスから順次非同期版に移行  
**実装完了日**: 2025年01月

**✅ 完了した作業:**
- **MetaYamlService**: loadMetaYamlAsync, saveMetaYamlAsync, updateReviewInfoAsync等を追加
- **FileOperationService**: createFileAsync, readFileAsync, writeFileAsync, existsAsync等を追加  
- **ReferenceManager**: checkFileExistsAsync, getInvalidReferencesAsync追加
- **ProjectLinkUpdateService**: 全ファイル検索・リンク更新の非同期版追加
- **HyperlinkExtractorService**: extractProjectLinksAsync, refreshFileLinksAsync等追加  
- **HashService**: calculateFileHashAsync, verifyFileHashAsync追加
- 全非同期メソッドの包括的テスト作成（20個のテストケース追加）

#### 2.1 優先度の高い操作から移行
1. **ファイル読み書き**: `readFileAsync`, `writeFileAsync`
2. **ディレクトリ操作**: `createDirectoryAsync`, `readdirAsync`  
3. **ファイル削除**: `unlinkAsync`, `rmAsync`
4. **ファイル統計**: `statAsync`, `existsAsync`

#### 2.2 Service層メソッドの非同期化
```typescript
// FileOperationService 移行例
async createFileAsync(
  dirPath: string,
  fileName: string,
  fileType: 'content' | 'setting' | 'subdirectory',
  initialContent: string = '',
): Promise<FileOperationResult> {
  // await this.fileRepository.writeFileAsync() を使用
  // await this.fileRepository.createDirectoryAsync() を使用
}

// MetaYamlService 移行例  
async loadMetaYamlAsync(dirPath: string): Promise<MetaYaml | null> {
  // await this.fileRepository.readFileAsync() を使用
}

async saveMetaYamlAsync(dirPath: string, meta: MetaYaml): Promise<boolean> {
  // await this.fileRepository.writeFileAsync() を使用
}
```

#### 2.3 呼び出し側の段階的更新
```typescript
// コマンド層での非同期対応例
export async function createFileCommand(
  treeDataProvider: DialogoiTreeDataProvider
): Promise<void> {
  // Service層の非同期メソッドを使用
  const result = await fileOperationService.createFileAsync(...);
  
  if (result.success) {
    treeDataProvider.refresh();
  }
}
```

### Phase 3: 同期版の廃止 🔄 **将来実施予定**
**目標**: 使用されなくなった同期メソッドの安全な削除

**📊 現状:**
- Service層の55箇所で同期メソッド使用を確認済み
- Command層・UI層での段階的移行が必要
- Phase 1・Phase 2完了により基盤は整備済み

#### 3.1 使用状況監査
- 各同期メソッドの使用箇所を特定
- 非同期版への移行状況を確認
- 残存する同期依存の洗い出し

#### 3.2 段階的削除
```typescript
// 削除対象メソッドに非推奨マーク
/** @deprecated Use existsAsync instead */
abstract existsSync(uri: Uri): boolean;

/** @deprecated Use readFileAsync instead */  
abstract readFileSync(uri: Uri, encoding?: BufferEncoding): string;
```

#### 3.3 クリーンアップ
- 同期メソッドの完全削除
- 不要なfs import削除
- テストの非同期対応完了

## 📊 移行の優先順位

### 優先度: 高
1. **ファイル読み書き** (`readFileAsync`, `writeFileAsync`)
   - 影響範囲: メタデータ管理全般
   - リスク: 低（既存`renameAsync`と同様のパターン）

2. **ファイル存在確認** (`existsAsync`)
   - 影響範囲: 全ファイル操作の前提条件
   - リスク: 低（単純な存在チェック）

3. **ディレクトリ作成** (`createDirectoryAsync`)
   - 影響範囲: プロジェクト作成、ファイル作成
   - リスク: 中（親ディレクトリ作成の考慮必要）

### 優先度: 中
4. **ディレクトリ読み込み** (`readdirAsync`)
   - 影響範囲: TreeView構築、プロジェクトスキャン
   - リスク: 中（大量ファイルのパフォーマンス考慮）

5. **ファイル削除** (`unlinkAsync`, `rmAsync`)
   - 影響範囲: ファイル・ディレクトリ削除
   - リスク: 高（データ消失リスク）

6. **ファイル統計** (`statAsync`)
   - 影響範囲: ファイル種別判定、TreeView表示
   - リスク: 低（参照系操作）

## 🧪 テスト戦略

### 単体テスト
```typescript
// 非同期メソッドのテスト例
suite('FileRepository 非同期API テスト', () => {
  test('existsAsync - ファイルが存在する場合', async () => {
    const container = TestServiceContainer.create();
    const mockFileService = container.getFileOperationService();
    
    mockFileService.createFile('/test/file.txt', 'content');
    const uri = mockFileService.createFileUri('/test/file.txt');
    
    const exists = await mockFileService.existsAsync(uri);
    assert.strictEqual(exists, true);
  });

  test('readFileAsync - UTF-8エンコーディング', async () => {
    const container = TestServiceContainer.create();
    const mockFileService = container.getFileOperationService();
    
    mockFileService.createFile('/test/file.txt', 'テスト内容');
    const uri = mockFileService.createFileUri('/test/file.txt');
    
    const content = await mockFileService.readFileAsync(uri, 'utf8');
    assert.strictEqual(content, 'テスト内容');
  });
});
```

### 統合テスト
```typescript
// Service層の非同期対応テスト
suite('FileOperationService 非同期API テスト', () => {
  test('createFileAsync - 非同期ファイル作成', async () => {
    const result = await fileOperationService.createFileAsync(
      '/test/dir',
      'async-file.txt',
      'content'
    );
    
    assert.strictEqual(result.success, true);
    // ファイルの実際の存在確認も非同期で
    const exists = await fileRepository.existsAsync(
      fileRepository.createFileUri('/test/dir/async-file.txt')
    );
    assert.strictEqual(exists, true);
  });
});
```

### パフォーマンステスト
```typescript
// 大量ファイル処理の非同期性能テスト
test('readdirAsync - 大量ファイルのパフォーマンス', async () => {
  // 1000ファイルを作成
  for (let i = 0; i < 1000; i++) {
    await fileRepository.writeFileAsync(
      fileRepository.createFileUri(`/test/file${i}.txt`),
      `content${i}`
    );
  }
  
  const startTime = Date.now();
  const entries = await fileRepository.readdirAsync(
    fileRepository.createDirectoryUri('/test')
  );
  const duration = Date.now() - startTime;
  
  assert.strictEqual(entries.length, 1000);
  assert(duration < 5000, `処理時間が長すぎます: ${duration}ms`);
});
```

## 🚨 リスク管理

### 技術的リスク

#### 1. パフォーマンス影響
**リスク**: 非同期化によるオーバーヘッド増加
**対策**: 
- 段階的移行による影響範囲限定
- パフォーマンステストによる監視
- 必要に応じたバッチ処理最適化

#### 2. エラーハンドリングの複雑化
**リスク**: Promise rejection の適切な処理
**対策**:
- try-catch の統一的な適用
- エラー型の適切な変換処理
- 既存エラーメッセージとの整合性保持

#### 3. 同期/非同期混在による複雑性
**リスク**: 移行期間中の複雑なコード構造
**対策**:
- 明確な移行スケジュール策定
- 同期版廃止予定の明示化
- 段階的リファクタリング

### 運用リスク

#### 1. 既存機能の破綻
**リスク**: 非同期化による既存ワークフローの影響
**対策**:
- 包括的なテストスイート実行
- 段階的なロールアウト
- ロールバック手順の準備

#### 2. 開発効率の一時的低下
**リスク**: 移行作業による新機能開発の遅延
**対策**:
- 移行作業の優先度明確化
- 並行開発との競合回避
- 移行完了後の開発効率向上見込み

## 📈 期待効果

### 短期的効果
- **VSCode統合向上**: エディタ状態保持、ファイル監視精度向上
- **エラー削減**: VSCodeネイティブエラーハンドリング
- **セキュリティ向上**: ワークスペース権限モデル準拠

### 長期的効果  
- **拡張性向上**: Remote Development、Dev Containers対応
- **保守性向上**: VSCode APIバージョンアップ追従
- **パフォーマンス最適化**: 非同期I/Oによるレスポンス向上

## 📅 実装スケジュール（実績・予定）

### ✅ Phase 1・Phase 2 完了（2025年01月）
- [x] 非同期メソッド抽象定義
- [x] VSCodeFileRepository実装  
- [x] MockFileRepository実装
- [x] 基本的な単体テスト作成
- [x] 高優先度メソッドの移行（read/write/exists）
- [x] 全Service層への非同期メソッド追加
- [x] 包括的なテスト作成（585テスト通過）
- [x] 統合テスト実行・品質確認
- [x] ドキュメント更新

### 🔄 Phase 3 実施（将来予定）
- [ ] Command層・UI層での非同期メソッド採用
- [ ] 同期版使用状況の段階的削減
- [ ] 同期メソッドの段階的廃止予定マーク付与
- [ ] 最終的なクリーンアップと同期版削除

## ✅ 完了基準・実績

### ✅ Phase 1 完了基準（達成済み）
- [x] 全ての非同期メソッドがFileRepositoryで定義される
- [x] VSCodeFileRepository、MockFileRepositoryで実装完了
- [x] 基本的な単体テストが通過する
- [x] TypeScript型エラーが0件

### ✅ Phase 2 完了基準（達成済み）
- [x] 全Service層クラスに非同期版メソッドを追加
- [x] 既存機能との互換性確保（同期・非同期並行動作）
- [x] 包括的テストカバレッジ（585テスト通過）
- [x] `npm run check-all` が完全通過（型チェック・Lint・フォーマット・テスト・ビルド）
- [x] ESLint警告0件、Prettier適用済み

### 🔄 Phase 3 完了基準（将来予定）  
- [ ] Command層・UI層での非同期メソッド採用完了
- [ ] 同期版メソッド使用箇所の段階的削減
- [ ] 同期版メソッドに廃止予定マーク付与
- [ ] 最終的な同期版削除とfs moduleのimport削除
- [ ] 全テスト通過維持

## 📈 移行実績サマリー

### 🎯 達成した技術的成果
- **Repository層**: 10個の非同期メソッド完全実装
- **Service層**: 6つの主要サービスクラスに20個の非同期メソッド追加
- **テスト**: 388個のサーバサイドテスト + 197個のReactテスト = 585テスト通過
- **品質保証**: TypeScript・ESLint・Prettierの完全適用

### 🔧 実装した非同期メソッド
**FileRepository層:**
- existsAsync, readFileAsync, writeFileAsync, createDirectoryAsync
- unlinkAsync, rmAsync, readdirAsync, statAsync

**Service層:**  
- MetaYamlService: loadMetaYamlAsync, saveMetaYamlAsync, updateReviewInfoAsync等
- FileOperationService: createFileAsync, deleteFileAsync, readFileAsync等
- ReferenceManager: checkFileExistsAsync, getInvalidReferencesAsync  
- その他: ProjectLinkUpdate, HyperlinkExtractor, HashService各種

---

**注**: この移行は段階的かつ安全に実施し、各フェーズの完了基準をクリアしてから次のフェーズに進む。移行期間中も既存機能の品質を維持することを最優先とする。