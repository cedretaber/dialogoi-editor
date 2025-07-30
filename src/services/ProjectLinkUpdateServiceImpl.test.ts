import * as path from 'path';
import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectLinkUpdateServiceImpl } from './ProjectLinkUpdateServiceImpl.js';
import { FileRepository, DirectoryEntry } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as yaml from 'js-yaml';

describe('ProjectLinkUpdateServiceImpl テストスイート', () => {
  let service: ProjectLinkUpdateServiceImpl;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let testProjectRoot: string;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();
    
    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();
    
    testProjectRoot = '/tmp/test-project';
    
    // ファイルシステムモックの設定
    setupFileSystemMocks();

    // ProjectLinkUpdateServiceを初期化
    service = new ProjectLinkUpdateServiceImpl(
      mockFileRepository,
      mockMetaYamlService,
      testProjectRoot,
    );

    // テスト用のプロジェクト構造を作成
    createTestProject();
  });

  afterEach(() => {
    // 特別なクリーンアップは不要
  });

  function setupFileSystemMocks(): void {
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });
    
    // createDirectoryUriのモック
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath, fsPath: dirPath } as Uri;
    });
    
    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri): Promise<boolean> => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });
    
    // readFileAsyncのモック
    // @ts-expect-error - Mock implementation for testing purposes
    mockFileRepository.readFileAsync.mockImplementation((uri: Uri, _encoding?: string): Promise<string> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      return Promise.resolve(content);
    });
    
    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, data: string | Uint8Array): Promise<void> => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
      fileSystem.set(uri.path, content);
      return Promise.resolve();
    });
    
    // readdirAsyncのモック
    mockFileRepository.readdirAsync.mockImplementation((uri: Uri): Promise<DirectoryEntry[]> => {
      const entries: DirectoryEntry[] = [];
      const basePath = uri.path;
      
      // ファイルを探す
      for (const filePath of fileSystem.keys()) {
        if (path.dirname(filePath) === basePath) {
          const name = path.basename(filePath);
          entries.push({
            name,
            isFile: (): boolean => true,
            isDirectory: (): boolean => false
          });
        }
      }
      
      // ディレクトリを探す
      for (const dirPath of directories) {
        if (path.dirname(dirPath) === basePath) {
          const name = path.basename(dirPath);
          entries.push({
            name,
            isFile: (): boolean => false,
            isDirectory: (): boolean => true
          });
        }
      }
      
      return Promise.resolve(entries);
    });
    
    // statAsyncのモック
    mockFileRepository.statAsync.mockImplementation((uri: Uri) => {
      const isDir = directories.has(uri.path);
      const isFile = fileSystem.has(uri.path);
      if (!isDir && !isFile) {
        return Promise.reject(new Error(`Path not found: ${uri.path}`));
      }
      return Promise.resolve({
        isFile: (): boolean => isFile,
        isDirectory: (): boolean => isDir,
        size: isFile ? (fileSystem.get(uri.path) ?? '').length : 0,
        mtime: new Date(),
        birthtime: new Date()
      });
    });
    
    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((absolutePath: string): Promise<MetaYaml | null> => {
      const metaPath = path.join(absolutePath, '.dialogoi-meta.yaml');
      const content = fileSystem.get(metaPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(yaml.load(content) as MetaYaml);
      } catch {
        return Promise.resolve(null);
      }
    });
    
    mockMetaYamlService.saveMetaYamlAsync.mockImplementation((absolutePath: string, metaData: MetaYaml): Promise<boolean> => {
      const metaPath = path.join(absolutePath, '.dialogoi-meta.yaml');
      const yamlContent = yaml.dump(metaData);
      fileSystem.set(metaPath, yamlContent);
      return Promise.resolve(true);
    });
  }
  
  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }
  
  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }
  
  function createTestProject(): void {
    const projectPath = testProjectRoot;

    // dialogoi.yamlを作成
    const dialogoiYamlContent = `title: テストプロジェクト
author: テスト著者
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
`;
    addFile(path.join(projectPath, 'dialogoi.yaml'), dialogoiYamlContent);

    // contentsディレクトリ
    const contentsDir = path.join(projectPath, 'contents');
    addDirectory(contentsDir);

    // contents/.dialogoi-meta.yaml
    addFile(
      path.join(contentsDir, '.dialogoi-meta.yaml'),
      `readme: README.md
files:
  - name: chapter1.md
    type: content
    path: ${path.join(contentsDir, 'chapter1.md')}
    hash: hash1
    tags: []
    references: ["settings/character1.md"]
    comments: ".chapter1.md.comments.yaml"
    isUntracked: false
    isMissing: false
  - name: chapter2.md
    type: content
    path: ${path.join(contentsDir, 'chapter2.md')}
    hash: hash2
    tags: []
    references: []
    comments: ".chapter2.md.comments.yaml"
    isUntracked: false
    isMissing: false
  - name: sub1
    type: subdirectory
    path: ${path.join(contentsDir, 'sub1')}
`,
    );

    // コンテンツファイル
    const chapter1Content = `# 第1章

[キャラクター1](../settings/character1.md) が登場します。
[キャラクター2](../settings/character2.md) も出てきます。
[外部リンク](https://example.com) もあります。
`;
    addFile(path.join(contentsDir, 'chapter1.md'), chapter1Content);

    const chapter2Content = `# 第2章

[キャラクター1](../settings/character1.md) の冒険が続きます。
`;
    addFile(path.join(contentsDir, 'chapter2.md'), chapter2Content);

    // settingsディレクトリ
    const settingsDir = path.join(projectPath, 'settings');
    addDirectory(settingsDir);

    // settings/.dialogoi-meta.yaml
    addFile(
      path.join(settingsDir, '.dialogoi-meta.yaml'),
      `readme: README.md
files:
  - name: character1.md
    type: character
    path: ${path.join(settingsDir, 'character1.md')}
    hash: hash3
    tags: ["主人公"]
    comments: ""
    isUntracked: false
    isMissing: false
    character:
      importance: "main"
      isMultipleCharacters: false
  - name: character2.md
    type: setting
    path: ${path.join(settingsDir, 'character2.md')}
    hash: hash4
    tags: ["脇役"]
    comments: ""
    isUntracked: false
    isMissing: false
`,
    );

    // 設定ファイル
    addFile(
      path.join(settingsDir, 'character1.md'),
      '# キャラクター1\n\n主人公です。',
    );
    addFile(
      path.join(settingsDir, 'character2.md'),
      '# キャラクター2\n\n脇役です。',
    );
  }

  it('ファイル名変更時のマークダウンリンク更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_renamed.md',
    );

    expect(result.success).toBe(true);
    expect(result.updatedFiles.length).toBe(3); // chapter1.md, chapter2.md, .dialogoi-meta.yaml

    // chapter1.mdの内容確認
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Content = fileSystem.get(chapter1Path);
    expect(chapter1Content).toBeDefined();
    
    // TypeScript assertion to help with type checking
    const chapter1ContentString = chapter1Content as string;
    expect(chapter1ContentString.includes('settings/character1_renamed.md')).toBeTruthy();
    expect(chapter1ContentString.includes('settings/character1.md')).toBeFalsy();
    // 外部リンクは変更されない
    expect(chapter1ContentString.includes('https://example.com')).toBeTruthy();

    // chapter2.mdの内容確認
    const chapter2Path = path.join(testProjectRoot, 'contents', 'chapter2.md');
    const chapter2Content = fileSystem.get(chapter2Path);
    expect(chapter2Content).toBeDefined();
    
    const chapter2ContentString = chapter2Content as string;
    expect(chapter2ContentString.includes('settings/character1_renamed.md')).toBeTruthy();
  });

  it('meta.yamlファイルのreferences更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_moved.md',
    );

    expect(result.success).toBe(true);

    // contents/.dialogoi-meta.yamlの確認
    const contentsMetaPath = path.join(testProjectRoot, 'contents', '.dialogoi-meta.yaml');
    const metaContent = fileSystem.get(contentsMetaPath);
    expect(metaContent).toBeDefined();
    
    const metaContentString = metaContent as string;
    expect(metaContentString.includes('settings/character1_moved.md')).toBeTruthy();
    expect(metaContentString.includes('settings/character1.md')).toBeFalsy();
  });

  it('ファイル移動時の複数リンク更新', async () => {
    // chapter1.mdに更に多くのリンクを追加
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const moreLinksContent = `# 第1章

[キャラクター1](../settings/character1.md) が登場します。
[同じキャラクター](../settings/character1.md) が再度言及されます。
[キャラクター2](../settings/character2.md) も出てきます。
`;
    addFile(chapter1Path, moreLinksContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/heroes/character1.md',
    );

    expect(result.success).toBe(true);

    // chapter1.mdの内容確認（複数のリンクが全て更新される）
    const updatedContent = fileSystem.get(chapter1Path);
    expect(updatedContent).toBeDefined();
    
    const updatedContentString = updatedContent as string;
    const character1Links = (updatedContentString.match(/settings\/heroes\/character1\.md/g) || [])
      .length;
    expect(character1Links).toBe(2); // 2箇所のリンクが更新されている

    // character2.mdのリンクは変更されない
    expect(updatedContentString.includes('../settings/character2.md')).toBeTruthy();
  });

  it('プロジェクト外リンクは更新しない', async () => {
    // 外部リンクを含むファイルを作成
    const externalLinksContent = `# テスト

[内部リンク](../settings/character1.md)
[外部リンク](https://example.com/character1.md)
[絶対パス](/absolute/path/character1.md)
`;
    const testFilePath = path.join(testProjectRoot, 'contents', 'external_test.md');
    addFile(testFilePath, externalLinksContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_new.md',
    );

    expect(result.success).toBe(true);

    // 外部リンクテストファイルの確認
    const updatedContent = fileSystem.get(testFilePath);
    expect(updatedContent).toBeDefined();
    
    const updatedContentString = updatedContent as string;
    // 内部リンクのみ更新される
    expect(updatedContentString.includes('settings/character1_new.md')).toBeTruthy();
    // 外部リンクは変更されない
    expect(updatedContentString.includes('https://example.com/character1.md')).toBeTruthy();
    expect(updatedContentString.includes('/absolute/path/character1.md')).toBeTruthy();
  });

  it('存在しないファイルの更新は無視', async () => {
    // 存在しないファイルのリンクを含む設定で実行
    const result = await service.updateLinksAfterFileOperation(
      'nonexistent/file.md',
      'also_nonexistent/file.md',
    );

    // 処理は成功するが、更新されるファイルはない
    expect(result.success).toBe(true);
    expect(result.updatedFiles.length).toBe(0);
  });

  it('scanFileForProjectLinks デバッグ機能', async () => {
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const projectLinks = await service.scanFileForProjectLinks(chapter1Path);

    // プロジェクト内リンクのみが抽出される
    expect(projectLinks.includes('settings/character1.md')).toBeTruthy();
    expect(projectLinks.includes('settings/character2.md')).toBeTruthy();
    // 外部リンクは含まれない
    expect(projectLinks.some((link) => link.includes('example.com'))).toBeFalsy();
  });

  it('複雑なマークダウンリンクパターンの処理', async () => {
    const complexContent = `# 複雑なテスト

[通常リンク](../settings/character1.md)
[タイトル付きリンク](../settings/character1.md "キャラクター1の説明")
[空テキスト](../settings/character1.md)
[特殊文字#含む](../settings/character1.md#section)
[  空白あり  ](../settings/character1.md)
`;

    const testPath = path.join(testProjectRoot, 'contents', 'complex_test.md');
    addFile(testPath, complexContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/new_character1.md',
    );

    expect(result.success).toBe(true);

    const updatedContent = fileSystem.get(testPath);
    expect(updatedContent).toBeDefined();
    
    const updatedContentString = updatedContent as string;
    // 各パターンが正しく更新されているかチェック
    expect(updatedContentString.includes('[通常リンク](settings/new_character1.md)')).toBeTruthy();
    expect(
      updatedContentString.includes('[タイトル付きリンク](settings/new_character1.md)'),
    ).toBeTruthy();
    expect(updatedContentString.includes('[空テキスト](settings/new_character1.md)')).toBeTruthy();
    // 特殊文字#含むリンクは更新されない（フラグメント付きのため）
    expect(
      updatedContentString.includes('[特殊文字#含む](../settings/character1.md#section)'),
    ).toBeTruthy();
    expect(updatedContentString.includes('[  空白あり  ](settings/new_character1.md)')).toBeTruthy();
  });

  it('パフォーマンステスト（大量ファイル）', async () => {
    // 大量のファイルとリンクを作成
    const largeProjectPath = '/tmp/large-project';
    const fileCount = 50;

    // 大量のマークダウンファイルを作成
    addDirectory(path.join(largeProjectPath, 'contents'));
    for (let i = 1; i <= fileCount; i++) {
      const filePath = path.join(largeProjectPath, 'contents', `file${i}.md`);
      const content = `# ファイル${i}\n[ターゲット](../settings/target.md)\n`;
      addFile(filePath, content);
    }

    // 新しいサービスインスタンスを大きなプロジェクト用に作成
    const largeProjectService = new ProjectLinkUpdateServiceImpl(
      mockFileRepository,
      mockMetaYamlService,
      largeProjectPath,
    );

    const startTime = Date.now();
    const result = await largeProjectService.updateLinksAfterFileOperation(
      'settings/target.md',
      'settings/new_target.md',
    );
    const endTime = Date.now();

    expect(result.success).toBe(true);
    // 処理時間が合理的範囲内であることを確認（10秒以内）
    expect(endTime - startTime < 10000).toBeTruthy();
  });
});
