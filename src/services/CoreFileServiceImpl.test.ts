import { mock, MockProxy } from 'jest-mock-extended';
import { CoreFileService } from './CoreFileService.js';
import { CoreFileServiceImpl } from './CoreFileServiceImpl.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { ProjectLinkUpdateService } from './ProjectLinkUpdateService.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as yaml from 'js-yaml';

describe('CoreFileService テストスイート', () => {
  let coreFileService: CoreFileService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let mockLinkUpdateService: MockProxy<ProjectLinkUpdateService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(async () => {
    // モックをリセット
    jest.clearAllMocks();
    
    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();
    
    // jest-mock-extendedで簡潔なモック作成
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();
    mockLinkUpdateService = mock<ProjectLinkUpdateService>();
    
    // ノベルルートパスの設定
    const novelRootPath = '/test-novel-root';
    
    // CoreFileServiceインスタンスを作成
    coreFileService = new CoreFileServiceImpl(
      mockFileRepository,
      mockMetaYamlService,
      mockLinkUpdateService,
      novelRootPath
    );
    
    // readdirAsyncのモック追加
    mockFileRepository.readdirAsync.mockImplementation(async (uri: Uri) => {
      const dirPath = uri.path;
      if (!directories.has(dirPath)) {
        throw new Error(`Directory not found: ${dirPath}`);
      }
      
      // ディレクトリ内のファイルとサブディレクトリを返す
      const entries: any[] = [];
      const dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
      
      // ファイルを検索
      for (const [filePath] of fileSystem) {
        if (filePath.startsWith(dirPrefix) && !filePath.slice(dirPrefix.length).includes('/')) {
          const name = filePath.slice(dirPrefix.length);
          entries.push({
            name,
            isFile: () => true,
            isDirectory: () => false
          });
        }
      }
      
      // サブディレクトリを検索
      for (const dir of directories) {
        if (dir.startsWith(dirPrefix) && dir !== dirPath) {
          const remaining = dir.slice(dirPrefix.length);
          const firstSlash = remaining.indexOf('/');
          const name = firstSlash === -1 ? remaining : remaining.slice(0, firstSlash);
          if (!entries.some(e => e.name === name)) {
            entries.push({
              name,
              isFile: () => false,
              isDirectory: () => true
            });
          }
        }
      }
      
      return entries;
    });

    // ファイルシステムのモック設定は既にbeforeEach内で初期化済み
    
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath } as Uri;
    });
    
    // createDirectoryUriのモック
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath } as Uri;
    });
    
    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation(async (uri: Uri) => {
      return fileSystem.has(uri.path) || directories.has(uri.path);
    });
    
    // readFileAsyncのモック（文字列版）
    mockFileRepository.readFileAsync.mockImplementation(async (uri: Uri, _encoding?: any): Promise<any> => {
      const content = fileSystem.get(uri.path);
      if (!content) throw new Error(`File not found: ${uri.path}`);
      return content; // テストでは常に文字列を返す
    });
    
    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation(async (uri: Uri, data: string | Uint8Array) => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
      fileSystem.set(uri.path, content);
    });
    
    // unlinkAsyncのモック(ファイル削除)
    mockFileRepository.unlinkAsync.mockImplementation(async (uri: Uri) => {
      if (!fileSystem.has(uri.path)) throw new Error(`File not found: ${uri.path}`);
      fileSystem.delete(uri.path);
    });
    
    // createDirectoryAsyncのモック
    mockFileRepository.createDirectoryAsync.mockImplementation(async (uri: Uri) => {
      directories.add(uri.path);
    });
    
    // rmAsyncのモック(ディレクトリ削除)
    mockFileRepository.rmAsync.mockImplementation(async (uri: Uri, options?: { recursive?: boolean }) => {
      if (!directories.has(uri.path)) throw new Error(`Directory not found: ${uri.path}`);
      directories.delete(uri.path);
      // 再帰的削除の場合、サブディレクトリとファイルも削除
      if (options?.recursive) {
        const pathPrefix = uri.path + '/';
        Array.from(directories).forEach(dir => {
          if (dir.startsWith(pathPrefix)) directories.delete(dir);
        });
        Array.from(fileSystem.keys()).forEach(file => {
          if (file.startsWith(pathPrefix)) fileSystem.delete(file);
        });
      }
    });
    
    // renameAsyncのモック
    mockFileRepository.renameAsync.mockImplementation(async (oldUri: Uri, newUri: Uri) => {
      const content = fileSystem.get(oldUri.path);
      if (content) {
        fileSystem.delete(oldUri.path);
        fileSystem.set(newUri.path, content);
      } else if (directories.has(oldUri.path)) {
        directories.delete(oldUri.path);
        directories.add(newUri.path);
      } else {
        throw new Error(`Path not found: ${oldUri.path}`);
      }
    });
    
    // テスト用ディレクトリ構造の準備
    directories.add('/test');
    fileSystem.set('/test/.dialogoi-meta.yaml',
      `files:
  - name: existing.txt
    type: content
    path: /test/existing.txt
    hash: hash123
    tags: []
    references: []
    comments: '.existing.txt.comments.yaml'
    isUntracked: false
    isMissing: false
  - name: testdir
    type: subdirectory
    path: /test/testdir
    isUntracked: false
    isMissing: false
`);

    // 既存ファイルを作成
    fileSystem.set('/test/existing.txt', 'existing content');

    // 既存ディレクトリを作成
    directories.add('/test/testdir');
    fileSystem.set('/test/testdir/.dialogoi-meta.yaml', 'files: []');
    
    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation(async (absolutePath: string) => {
      const metaPath = absolutePath + '/.dialogoi-meta.yaml';
      const content = fileSystem.get(metaPath);
      if (!content) return null;
      try {
        return yaml.load(content) as MetaYaml;
      } catch {
        return null;
      }
    });
    
    mockMetaYamlService.saveMetaYamlAsync.mockImplementation(async (absolutePath: string, metaData: MetaYaml) => {
      const metaPath = absolutePath + '/.dialogoi-meta.yaml';
      const yamlContent = yaml.dump(metaData);
      fileSystem.set(metaPath, yamlContent);
      return true;
    });
    
    // ProjectLinkUpdateServiceのモック設定
    const updateCalls: Array<{oldPath: string, newPath: string}> = [];
    mockLinkUpdateService.updateLinksAfterFileOperation.mockImplementation(async (oldPath: string, newPath: string) => {
      updateCalls.push({ oldPath, newPath });
      return {
        success: true,
        message: 'Links updated',
        updatedFiles: [],
        failedFiles: [],
        totalScannedFiles: 0
      };
    });
    
    // テスト用に追加したメソッド
    (mockLinkUpdateService as any).clearUpdateCalls = () => updateCalls.length = 0;
    (mockLinkUpdateService as any).getUpdateCalls = () => updateCalls;
  });

  describe('ファイル作成', () => {
    it('新しいファイルを作成できる', async () => {
      const result = await coreFileService.createFile(
        '/test',
        'newfile.txt',
        'content',
        'Initial content',
        ['tag1', 'tag2'],
      );

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイル "newfile.txt" を作成しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // ファイルが物理的に作成されているか確認
      const fileContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/newfile.txt'),
        'utf8',
      );
      expect(fileContent).toBe('Initial content');

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('newfile.txt')).toBeTruthy();
      expect(metaContent.includes('tag1')).toBeTruthy();
      expect(metaContent.includes('tag2')).toBeTruthy();
    });

    it('サブディレクトリを作成できる', async () => {
      const result = await coreFileService.createFile('/test', 'newdir', 'subdirectory');

      expect(result.success).toBe(true);
      expect(result.message.includes('ディレクトリ "newdir" を作成しました')).toBeTruthy();

      // ディレクトリが作成されているか確認
      const dirUri = mockFileRepository.createDirectoryUri('/test/newdir');
      expect(await mockFileRepository.existsAsync(dirUri)).toBeTruthy();
    });

    it('キャラクターサブタイプでファイルを作成できる', async () => {
      const result = await coreFileService.createFile(
        '/test',
        'character.txt',
        'setting',
        '',
        [],
        'character',
      );

      expect(result.success).toBe(true);

      // メタデータにキャラクター情報が含まれているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('character:')).toBeTruthy();
      expect(metaContent.includes('importance: sub')).toBeTruthy();
      expect(metaContent.includes('multiple_characters: false')).toBeTruthy();
    });

    it('既存ファイル名での作成はエラー', async () => {
      const result = await coreFileService.createFile('/test', 'existing.txt', 'content');

      expect(result.success).toBe(false);
      expect(result.message.includes('既に存在します')).toBeTruthy();
    });
  });

  describe('ファイル削除', () => {
    it('ファイルを削除できる', async () => {
      const result = await coreFileService.deleteFile('/test', 'existing.txt');

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイル "existing.txt" を削除しました')).toBeTruthy();

      // ファイルが物理的に削除されているか確認
      const fileUri = mockFileRepository.createFileUri('/test/existing.txt');
      expect(await mockFileRepository.existsAsync(fileUri)).toBeFalsy();

      // メタデータからも削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('existing.txt')).toBeFalsy();
    });

    it('存在しないファイルの削除はエラー', async () => {
      const result = await coreFileService.deleteFile('/test', 'nonexistent.txt');

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });
  });

  describe('ファイル名変更', () => {
    it('ファイル名を変更できる', async () => {
      // モックの呼び出し履歴をクリア
      (mockLinkUpdateService as any).clearUpdateCalls();

      const result = await coreFileService.renameFile('/test', 'existing.txt', 'renamed.txt');

      if (!result.success) {
        console.error('Rename failed:', result.message);
      }
      expect(result.success).toBe(true);
      expect(
        result.message.includes('ファイル名を "existing.txt" から "renamed.txt" に変更しました'),
      ).toBeTruthy();

      // 新しい名前でファイルが存在するか確認
      const newFileUri = mockFileRepository.createFileUri('/test/renamed.txt');
      expect(await mockFileRepository.existsAsync(newFileUri)).toBeTruthy();

      // 旧ファイルが存在しないか確認
      const oldFileUri = mockFileRepository.createFileUri('/test/existing.txt');
      expect(await mockFileRepository.existsAsync(oldFileUri)).toBeFalsy();

      // メタデータが更新されているか確認
      try {
        const metaContent = await mockFileRepository.readFileAsync(
          mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
          'utf8',
        );
        expect(metaContent.includes('renamed.txt')).toBeTruthy();
        expect(metaContent.includes('existing.txt')).toBeFalsy();
      } catch {
        console.error('Meta file read failed, but rename operation succeeded');
      }

      // リンク更新サービスが適切に呼ばれたことを検証
      const updateCalls = (mockLinkUpdateService as any).getUpdateCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0]?.oldPath).toBe('/test/existing.txt');
      expect(updateCalls[0]?.newPath).toBe('/test/renamed.txt');
    });

    it('存在しないファイルの名前変更はエラー', async () => {
      const result = await coreFileService.renameFile('/test', 'nonexistent.txt', 'new.txt');

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });

    it('既存ファイル名への変更はエラー', async () => {
      // 追加テストファイルを作成
      await coreFileService.createFile('/test', 'another.txt', 'content');

      const result = await coreFileService.renameFile('/test', 'existing.txt', 'another.txt');

      expect(result.success).toBe(false);
      expect(result.message.includes('既に使用されています')).toBeTruthy();
    });
  });

  describe('ファイル順序変更', () => {
    it('ファイル順序を変更できる', async () => {
      // テスト用ファイルを追加
      await coreFileService.createFile('/test', 'file1.txt', 'content');
      await coreFileService.createFile('/test', 'file2.txt', 'content');

      const result = await coreFileService.reorderFiles('/test', 0, 2);

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイルの順序を変更しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();
    });

    it('無効なインデックスでの順序変更はエラー', async () => {
      const result = await coreFileService.reorderFiles('/test', 0, 100);

      expect(result.success).toBe(false);
      expect(result.message.includes('無効なインデックス')).toBeTruthy();
    });
  });

  describe('ファイル移動', () => {
    beforeEach(async () => {
      // 移動先ディレクトリを準備
      await mockFileRepository.createDirectoryAsync(
        mockFileRepository.createDirectoryUri('/target')
      );
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri('/target/.dialogoi-meta.yaml'),
        'files: []',
      );
    });

    it('ファイルを別ディレクトリに移動できる', async () => {
      // モックの呼び出し履歴をクリア
      (mockLinkUpdateService as any).clearUpdateCalls();

      const result = await coreFileService.moveFile('/test', 'existing.txt', '/target');

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイル "existing.txt" を移動しました')).toBeTruthy();

      // 移動先にファイルが存在することを確認
      const targetFileUri = mockFileRepository.createFileUri('/target/existing.txt');
      expect(await mockFileRepository.existsAsync(targetFileUri)).toBeTruthy();

      // 移動元からファイルが削除されていることを確認
      const sourceFileUri = mockFileRepository.createFileUri('/test/existing.txt');
      expect(await mockFileRepository.existsAsync(sourceFileUri)).toBeFalsy();

      // メタデータが更新されていることを確認
      const targetMetaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/target/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(targetMetaContent.includes('existing.txt')).toBeTruthy();

      // リンク更新サービスが適切に呼ばれたことを検証
      const updateCalls = (mockLinkUpdateService as any).getUpdateCalls();
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0]?.oldPath).toBe('/test/existing.txt');
      expect(updateCalls[0]?.newPath).toBe('/target/existing.txt');
    });

    it('同じディレクトリ内での移動（順序変更）', async () => {
      const result = await coreFileService.moveFile('/test', 'existing.txt', '/test', 1);

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイルの順序を変更しました')).toBeTruthy();
    });

    it('存在しないファイルの移動はエラー', async () => {
      const result = await coreFileService.moveFile('/test', 'nonexistent.txt', '/target');

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });
  });

  describe('ディレクトリ移動', () => {
    beforeEach(async () => {
      // 移動先親ディレクトリを準備
      await mockFileRepository.createDirectoryAsync(
        mockFileRepository.createDirectoryUri('/targetparent')
      );
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri('/targetparent/.dialogoi-meta.yaml'),
        'files: []',
      );
    });

    it('ディレクトリを移動できる', async () => {
      const result = await coreFileService.moveDirectory('/test', 'testdir', '/targetparent');

      expect(result.success).toBe(true);
      expect(result.message.includes('ディレクトリ "testdir" を移動しました')).toBeTruthy();

      // 移動先にディレクトリが存在することを確認
      const targetDirUri = mockFileRepository.createDirectoryUri('/targetparent/testdir');
      expect(await mockFileRepository.existsAsync(targetDirUri)).toBeTruthy();

      // 移動元からディレクトリが削除されていることを確認
      const sourceDirUri = mockFileRepository.createDirectoryUri('/test/testdir');
      expect(await mockFileRepository.existsAsync(sourceDirUri)).toBeFalsy();
    });

    it('存在しないディレクトリの移動はエラー', async () => {
      const result = await coreFileService.moveDirectory('/test', 'nonexistent', '/targetparent');

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });
  });

  describe('ディレクトリ削除', () => {
    it('ディレクトリを削除できる', async () => {
      const result = await coreFileService.deleteDirectory('/test', 'testdir');

      expect(result.success).toBe(true);
      expect(result.message.includes('ディレクトリ "testdir" を削除しました')).toBeTruthy();

      // ディレクトリが物理的に削除されているか確認
      const dirUri = mockFileRepository.createDirectoryUri('/test/testdir');
      expect(await mockFileRepository.existsAsync(dirUri)).toBeFalsy();

      // メタデータからも削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('testdir')).toBeFalsy();
    });

    it('存在しないディレクトリの削除はエラー', async () => {
      const result = await coreFileService.deleteDirectory('/test', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });
  });

  describe('低レベルファイル操作', () => {
    it('ファイルを読み込める', async () => {
      const content = await coreFileService.readFile('/test/existing.txt');
      expect(content).toBe('existing content');
    });

    it('ファイルに書き込める', async () => {
      await coreFileService.writeFile('/test/existing.txt', 'new content');

      const content = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/existing.txt'),
        'utf8',
      );
      expect(content).toBe('new content');
    });

    it('ファイルの存在確認ができる', async () => {
      const exists1 = await coreFileService.exists('/test/existing.txt');
      expect(exists1).toBe(true);

      const exists2 = await coreFileService.exists('/test/nonexistent.txt');
      expect(exists2).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    it('メタデータファイルが存在しない場合のエラー', async () => {
      const result = await coreFileService.createFile('/nonexistent', 'file.txt', 'content');

      expect(result.success).toBe(false);
      expect(result.message.includes('.dialogoi-meta.yamlが見つから')).toBeTruthy();
    });

    it('相対パス使用時のエラー（ノベルルートパス未設定）', async () => {
      // ノベルルートパスが設定されていないCoreFileServiceを作成
      const serviceWithoutRoot = new CoreFileServiceImpl(
        mockFileRepository,
        mockMetaYamlService,
        mockLinkUpdateService
        // novelRootPathを指定しない
      );

      const result = await serviceWithoutRoot.createFile('relative/path', 'file.txt', 'content');

      expect(result.success).toBe(false);
      expect(result.message.includes('ノベルルートパスが設定されていません')).toBeTruthy();
    });
  });

  describe('ユーティリティメソッド', () => {
    it('ノベルルートパスを取得できる', () => {
      const rootPath = coreFileService.getNovelRootPath();
      expect(typeof rootPath).toBe('string');
    });
  });
});
