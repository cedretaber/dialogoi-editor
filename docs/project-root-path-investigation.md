# プロジェクトルート相対パス・リンク更新機能調査報告書

## 現状分析

### 現在のパス形式

**✅ 良い点**: 現在のreferencesシステムは既にプロジェクトルートからの相対パスを使用している

```yaml
# contents/.dialogoi-meta.yaml
files:
  - name: chapter1.txt
    type: content
    references:
      - settings/world.md        # プロジェクトルートからの相対パス
      - settings/characters/hero.md  # プロジェクトルートからの相対パス
```

**⚠️ 課題**: ハイパーリンク機能では任意の相対パス形式が可能
```markdown
<!-- 現在のファイルからの相対パス（問題のあるケース） -->
[キャラクター設定](../../settings/characters/hero.md)

<!-- プロジェクトルートからの相対パス（推奨） -->
[キャラクター設定](settings/characters/hero.md)
```

## 必要な機能設計

### 1. プロジェクトルート相対パス正規化機能

#### パス正規化サービス
```typescript
export class ProjectPathNormalizationService {
  constructor(private novelRootPath: string) {}
  
  /**
   * 任意の相対パスをプロジェクトルート相対パスに正規化
   */
  normalizeToProjectPath(
    linkPath: string, 
    currentFileAbsolutePath: string
  ): string | null {
    // リンクパスがプロジェクトルート相対かチェック
    if (this.isProjectRootRelativePath(linkPath)) {
      return linkPath;
    }
    
    // 現在ファイルからの相対パスを絶対パスに変換
    const currentDirPath = path.dirname(currentFileAbsolutePath);
    const absolutePath = path.resolve(currentDirPath, linkPath);
    
    // プロジェクトルートからの相対パスに変換
    const relativePath = path.relative(this.novelRootPath, absolutePath);
    
    // プロジェクト外のファイルの場合はnull
    if (relativePath.startsWith('..')) {
      return null;
    }
    
    return relativePath.replace(/\\/g, '/'); // Windows対応
  }
  
  /**
   * パスがプロジェクトルート相対パスかチェック
   */
  private isProjectRootRelativePath(linkPath: string): boolean {
    return !linkPath.startsWith('./') && 
           !linkPath.startsWith('../') && 
           !path.isAbsolute(linkPath);
  }
}
```

### 2. ファイル移動・改名時のリンク更新機能

#### リンク更新サービス
```typescript
export interface LinkUpdateResult {
  success: boolean;
  message: string;
  updatedFiles: string[];
  failedFiles: { path: string; error: string }[];
}

export class ProjectLinkUpdateService {
  constructor(
    private fileRepository: FileRepository,
    private novelRootPath: string
  ) {}
  
  /**
   * ファイル移動・改名時にプロジェクト全体のリンクを更新
   */
  updateLinksAfterFileOperation(
    oldProjectPath: string,
    newProjectPath: string
  ): LinkUpdateResult {
    const updatedFiles: string[] = [];
    const failedFiles: { path: string; error: string }[] = [];
    
    // プロジェクト内の全.mdファイルを検索
    const markdownFiles = this.findAllMarkdownFiles();
    
    for (const markdownFile of markdownFiles) {
      try {
        const updated = this.updateLinksInFile(
          markdownFile, 
          oldProjectPath, 
          newProjectPath
        );
        if (updated) {
          updatedFiles.push(markdownFile);
        }
      } catch (error) {
        failedFiles.push({
          path: markdownFile,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // .dialogoi-meta.yamlファイルのreferencesも更新
    const metaFiles = this.findAllMetaYamlFiles();
    for (const metaFile of metaFiles) {
      try {
        const updated = this.updateReferencesInMetaFile(
          metaFile,
          oldProjectPath,
          newProjectPath
        );
        if (updated) {
          updatedFiles.push(metaFile);
        }
      } catch (error) {
        failedFiles.push({
          path: metaFile,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      success: failedFiles.length === 0,
      message: `${updatedFiles.length}個のファイルを更新しました`,
      updatedFiles,
      failedFiles
    };
  }
  
  /**
   * 単一マークダウンファイル内のリンクを更新
   */
  private updateLinksInFile(
    filePath: string,
    oldProjectPath: string,
    newProjectPath: string
  ): boolean {
    const content = this.fileRepository.readFileSync(
      this.fileRepository.createFileUri(filePath)
    );
    
    // マークダウンリンクの正規表現パターン
    const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;
    let hasUpdates = false;
    
    const updatedContent = content.replace(linkPattern, (match, text, url) => {
      // プロジェクト内リンクのみ更新対象
      if (url === oldProjectPath) {
        hasUpdates = true;
        return `[${text}](${newProjectPath})`;
      }
      return match;
    });
    
    if (hasUpdates) {
      this.fileRepository.writeFileSync(
        this.fileRepository.createFileUri(filePath),
        updatedContent
      );
    }
    
    return hasUpdates;
  }
  
  /**
   * .dialogoi-meta.yamlファイルのreferencesを更新
   */
  private updateReferencesInMetaFile(
    metaFilePath: string,
    oldProjectPath: string,
    newProjectPath: string
  ): boolean {
    // MetaYamlServiceを使用してreferencesを更新
    // 実装は既存のupdateMetaYamlパターンを使用
    return false; // 実装詳細省略
  }
  
  /**
   * プロジェクト内の全.mdファイルを再帰的に検索
   */
  private findAllMarkdownFiles(): string[] {
    const markdownFiles: string[] = [];
    
    // 再帰的にディレクトリを走査
    const walkDirectory = (dirPath: string) => {
      const dirUri = this.fileRepository.createFileUri(dirPath);
      try {
        const entries = this.fileRepository.readdirSync(dirUri);
        
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry);
          const entryUri = this.fileRepository.createFileUri(entryPath);
          const stat = this.fileRepository.lstatSync(entryUri);
          
          if (stat.isDirectory()) {
            walkDirectory(entryPath);
          } else if (entry.endsWith('.md')) {
            markdownFiles.push(entryPath);
          }
        }
      } catch (error) {
        // ディレクトリ読み込みエラーは無視
      }
    };
    
    walkDirectory(this.novelRootPath);
    return markdownFiles;
  }
  
  /**
   * プロジェクト内の全.dialogoi-meta.yamlファイルを検索
   */
  private findAllMetaYamlFiles(): string[] {
    const metaFiles: string[] = [];
    
    const walkDirectory = (dirPath: string) => {
      const dirUri = this.fileRepository.createFileUri(dirPath);
      try {
        const entries = this.fileRepository.readdirSync(dirUri);
        
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry);
          
          if (entry === '.dialogoi-meta.yaml') {
            metaFiles.push(entryPath);
          } else {
            const entryUri = this.fileRepository.createFileUri(entryPath);
            const stat = this.fileRepository.lstatSync(entryUri);
            if (stat.isDirectory()) {
              walkDirectory(entryPath);
            }
          }
        }
      } catch (error) {
        // ディレクトリ読み込みエラーは無視
      }
    };
    
    walkDirectory(this.novelRootPath);
    return metaFiles;
  }
}
```

### 3. 既存システムとの統合

#### FileOperationServiceの拡張
```typescript
// FileOperationService.tsに追加
export class FileOperationService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private linkUpdateService?: ProjectLinkUpdateService  // 新規追加
  ) {}
  
  /**
   * ファイル名を変更する（リンク更新付き）
   */
  renameFile(dirPath: string, oldName: string, newName: string): FileOperationResult {
    // 既存のrenameFile実装...
    
    // 成功した場合、リンク更新を実行
    if (result.success && this.linkUpdateService) {
      const oldProjectPath = this.getProjectRelativePath(dirPath, oldName);
      const newProjectPath = this.getProjectRelativePath(dirPath, newName);
      
      const linkUpdateResult = this.linkUpdateService.updateLinksAfterFileOperation(
        oldProjectPath,
        newProjectPath
      );
      
      // リンク更新結果をログに出力
      if (linkUpdateResult.updatedFiles.length > 0) {
        console.log(`${linkUpdateResult.updatedFiles.length}個のファイルのリンクを更新しました`);
      }
      
      if (linkUpdateResult.failedFiles.length > 0) {
        console.warn(`${linkUpdateResult.failedFiles.length}個のファイルでリンク更新に失敗しました`);
      }
    }
    
    return result;
  }
  
  /**
   * ファイルを移動する（リンク更新付き）
   */
  moveFile(/* ... */): FileOperationResult {
    // 既存のmoveFile実装...
    
    // 成功した場合、リンク更新を実行
    if (result.success && this.linkUpdateService) {
      const oldProjectPath = this.getProjectRelativePath(sourceDir, fileName);
      const newProjectPath = this.getProjectRelativePath(targetDir, fileName);
      
      const linkUpdateResult = this.linkUpdateService.updateLinksAfterFileOperation(
        oldProjectPath,
        newProjectPath
      );
    }
    
    return result;
  }
  
  private getProjectRelativePath(dirPath: string, fileName: string): string {
    const filePath = path.join(dirPath, fileName);
    // novelRootPathからの相対パスを計算
    return path.relative(this.novelRootPath, filePath).replace(/\\/g, '/');
  }
}
```

## 実装検証計画

### 1. 単体テスト
```typescript
suite('ProjectLinkUpdateService テストスイート', () => {
  let service: ProjectLinkUpdateService;
  let mockFileRepository: MockFileRepository;
  
  test('ファイル名変更時のマークダウンリンク更新', () => {
    // テストプロジェクト構造作成
    mockFileRepository.addFile('/project/settings/old-name.md', '# 設定ファイル');
    mockFileRepository.addFile('/project/content/chapter1.md', 
      '[設定ファイル](settings/old-name.md)を参照'
    );
    
    // リンク更新実行
    const result = service.updateLinksAfterFileOperation(
      'settings/old-name.md',
      'settings/new-name.md'
    );
    
    // 結果検証
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 1);
    
    const updatedContent = mockFileRepository.readFileSync('/project/content/chapter1.md');
    assert.strictEqual(updatedContent, '[設定ファイル](settings/new-name.md)を参照');
  });
  
  test('ファイル移動時の複数リンク更新', () => {
    // 複数ファイルでの参照テスト
  });
  
  test('循環参照の処理', () => {
    // 循環参照ケースのテスト
  });
  
  test('プロジェクト外リンクは更新しない', () => {
    // 外部URLやプロジェクト外ファイルは変更しないことを確認
  });
});
```

### 2. 統合テスト
```typescript
suite('ファイル操作統合テスト', () => {
  test('ファイル移動時のリンク自動更新', () => {
    // 実際のファイル移動とリンク更新の統合テスト
  });
  
  test('大量ファイルでのパフォーマンステスト', () => {
    // 1000ファイルプロジェクトでの更新時間測定
  });
});
```

## リスク分析と対策

### 高リスク
1. **大量ファイルでのパフォーマンス問題**
   - 対策: 非同期処理とプログレス表示
   - 対策: インクリメンタル更新（変更されたファイルのみ）

2. **ファイル更新時の競合状態**
   - 対策: ファイルロック機構
   - 対策: トランザクション的な更新（失敗時ロールバック）

### 中リスク
1. **複雑なリンクパターンの見落とし**
   - 対策: 包括的な正規表現テスト
   - 対策: エッジケースの詳細テスト

2. **プロジェクト構造の変更への対応**
   - 対策: 設定可能なパス解決ルール

## 実装優先度

1. **Phase 1**: ProjectPathNormalizationService（基本的なパス正規化）
2. **Phase 2**: ProjectLinkUpdateService（基本的なリンク更新）
3. **Phase 3**: FileOperationServiceとの統合
4. **Phase 4**: パフォーマンス最適化とエラーハンドリング強化

## 結論

**✅ 実装可能**: プロジェクトルート相対パス運用とリンク自動更新は技術的に実現可能

**主な利点**:
1. ファイル移動に強いリンク構造
2. 一貫したパス形式
3. 自動化されたリンク保守

**実装上の注意点**:
1. 既存のreferencesシステムは既に適切な形式を使用
2. 新しいハイパーリンク機能でも同様の形式を強制する必要
3. パフォーマンスとユーザビリティのバランスが重要