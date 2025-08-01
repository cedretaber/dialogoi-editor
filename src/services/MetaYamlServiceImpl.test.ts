import { mock, MockProxy } from 'jest-mock-extended';
import { MetaYamlServiceImpl } from './MetaYamlServiceImpl.js';
import { SubdirectoryItem } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiPathService } from './DialogoiPathService.js';
import { Uri } from '../interfaces/Uri.js';
import { createContentItem, createSubdirectoryItem } from '../test/testHelpers.js';

describe('MetaYamlServiceImpl テストスイート', () => {
  let service: MetaYamlServiceImpl;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockDialogoiPathService: MockProxy<DialogoiPathService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();

    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockDialogoiPathService = mock<DialogoiPathService>();

    // サービスインスタンス作成
    service = new MetaYamlServiceImpl(mockFileRepository, mockDialogoiPathService);

    // ファイルシステムモックの設定
    setupFileSystemMocks();
  });

  function setupFileSystemMocks(): void {
    // DialogoiPathServiceのモック設定
    mockDialogoiPathService.resolveMetaPath.mockImplementation((dirPath: string) => {
      // 新しいパス構造: {projectRoot}/.dialogoi/{relativePath}/dialogoi-meta.yaml
      // テスト用に簡単なパス変換を実装
      return `${dirPath}/.dialogoi-meta.yaml`;
    });

    mockDialogoiPathService.ensureDialogoiDirectory.mockResolvedValue();

    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath } as Uri;
    });

    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    // readFileAsyncのモック
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, _encoding?: string): Promise<string | Uint8Array> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      return Promise.resolve(content);
    });

    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, data: string | Uint8Array) => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
      fileSystem.set(uri.path, content);
      return Promise.resolve();
    });

    // createDirectoryAsyncのモック
    mockFileRepository.createDirectoryAsync.mockImplementation((uri: Uri) => {
      directories.add(uri.path);
      return Promise.resolve();
    });

    // readdirAsyncのモック
    mockFileRepository.readdirAsync.mockImplementation((uri: Uri) => {
      const dirPath = uri.path;
      if (!directories.has(dirPath)) {
        return Promise.reject(new Error(`Directory not found: ${dirPath}`));
      }

      // ディレクトリ内のファイルとサブディレクトリを返す
      const entries: Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> =
        [];
      const dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';

      // ファイルを検索
      for (const [filePath] of fileSystem) {
        if (filePath.startsWith(dirPrefix) && !filePath.slice(dirPrefix.length).includes('/')) {
          const name = filePath.slice(dirPrefix.length);
          entries.push({
            name,
            isFile: () => true,
            isDirectory: () => false,
          });
        }
      }

      // サブディレクトリを検索
      for (const dir of directories) {
        if (dir.startsWith(dirPrefix) && dir !== dirPath) {
          const remaining = dir.slice(dirPrefix.length);
          const firstSlash = remaining.indexOf('/');
          const name = firstSlash === -1 ? remaining : remaining.slice(0, firstSlash);
          if (!entries.some((e) => e.name === name)) {
            entries.push({
              name,
              isFile: () => false,
              isDirectory: () => true,
            });
          }
        }
      }

      return Promise.resolve(entries);
    });

    // createDirectoryUriのモック
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath } as Uri;
    });
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  describe('loadMetaYamlAsync', () => {
    it('正常なメタデータファイルを読み込む', async () => {
      const testDir = '/test/project';

      const contentItem = createContentItem({
        name: 'chapter1.txt',
        path: `${testDir}/chapter1.txt`,
        tags: ['重要', '序章'],
      });

      const subdirItem = createSubdirectoryItem({
        name: 'settings',
        path: `${testDir}/settings`,
      });

      const metaContent = `readme: README.md
files:
  - name: ${contentItem.name}
    type: ${contentItem.type}
    path: ${contentItem.path}
    hash: ${contentItem.hash}
    tags:
      - 重要
      - 序章
    references: []
    comments: ${contentItem.comments}
    isUntracked: ${contentItem.isUntracked}
    isMissing: ${contentItem.isMissing}
  - name: ${subdirItem.name}
    type: ${subdirItem.type}
    path: ${subdirItem.path}
    isUntracked: ${subdirItem.isUntracked}
    isMissing: ${subdirItem.isMissing}`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.loadMetaYamlAsync(testDir);

      // DialogoiPathServiceのresolveMetaPathが正しく呼び出されたことを検証
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledWith(testDir);
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledTimes(1);

      expect(result).not.toBe(null);
      expect(result?.readme).toBe('README.md');
      expect(result?.files.length).toBe(2);
      expect(result?.files[0]?.name).toBe('chapter1.txt');
      expect(result?.files[0]?.type).toBe('content');
      const firstFile = result?.files[0];
      if (!firstFile || firstFile.type !== 'content') {
        throw new Error('最初のファイルはContentItemである必要があります');
      }
      expect(firstFile.tags).toEqual(['重要', '序章']);
      expect(result?.files[1]?.name).toBe('settings');
      expect(result?.files[1]?.type).toBe('subdirectory');
    });

    it('メタデータファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      addDirectory(testDir);

      const result = await service.loadMetaYamlAsync(testDir);

      // DialogoiPathServiceのresolveMetaPathが正しく呼び出されたことを検証
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledWith(testDir);

      expect(result).toBe(null);
    });

    it('不正なYAMLファイルの場合nullを返す', async () => {
      const testDir = '/test/project';
      const invalidYaml = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/project/chapter1.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - invalid: yaml: content`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, invalidYaml);

      const result = await service.loadMetaYamlAsync(testDir);
      expect(result).toBe(null);
    });

    it('空のメタデータファイルの場合nullを返す', async () => {
      const testDir = '/test/project';
      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, '');

      const result = await service.loadMetaYamlAsync(testDir);
      expect(result).toBe(null);
    });

    it('最小構成のメタデータファイルを読み込む', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.loadMetaYamlAsync(testDir);

      expect(result).not.toBe(null);
      expect(result?.readme).toBe(undefined);
      expect(result?.files.length).toBe(0);
    });
  });

  describe('saveMetaYamlAsync', () => {
    it('正常なMetaYamlオブジェクトを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            comments: '.chapter1.txt.comments.yaml',
            hash: 'abc123',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: `${testDir}/settings`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);

      // DialogoiPathServiceのメソッドが正しく呼び出されたことを検証
      expect(mockDialogoiPathService.ensureDialogoiDirectory).toHaveBeenCalledWith(testDir);
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledWith(testDir);
      expect(mockDialogoiPathService.ensureDialogoiDirectory).toHaveBeenCalledTimes(1);
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledTimes(1);

      expect(result).toBe(true);

      // 保存されたファイルを確認
      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('readme: README.md')).toBeTruthy();
      expect(savedContent.includes('name: chapter1.txt')).toBeTruthy();
      expect(savedContent.includes('type: content')).toBeTruthy();
      expect(savedContent.includes('comments: .chapter1.txt.comments.yaml')).toBeTruthy();
      expect(savedContent.includes('hash: abc123')).toBeTruthy();
    });

    it('空のfilesを持つMetaYamlを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      expect(result).toBe(true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('readme: README.md')).toBeTruthy();
      expect(savedContent.includes('files: []')).toBeTruthy();
    });

    it('readmeがないMetaYamlを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        files: [
          createContentItem({
            name: 'test.txt',
            path: `${testDir}/test.txt`,
            hash: 'hash123',
            comments: '.test.txt.comments.yaml',
          }),
        ],
      };

      addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      expect(result).toBe(true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('name: test.txt')).toBeTruthy();
      expect(savedContent.includes('type: content')).toBeTruthy();
      expect(!savedContent.includes('readme:')).toBeTruthy();
    });

    it('バリデーションエラーがある場合falseを返す', async () => {
      const testDir = '/test/project';
      const invalidMeta = {
        readme: 'README.md',
        files: [
          {
            name: '', // 空の名前はエラー
            type: 'content',
            path: `${testDir}/test.txt`,
          },
        ],
      } as MetaYaml;

      addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, invalidMeta);
      expect(result).toBe(false);

      // メタデータファイルが作成されていないことを確認
      const metaUri = mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaUri)).toBe(false);
    });

    it('複数のバリデーションエラーがある場合falseを返す', async () => {
      const testDir = '/test/project';
      const invalidMeta = {
        files: [
          {
            name: '', // 空の名前はエラー
            type: 'invalid', // 不正なタイプはエラー
            path: `${testDir}/test.txt`,
            tags: 'invalid', // 文字列はエラー（配列である必要がある）
            character: {
              importance: 'invalid', // 不正な重要度はエラー
              multiple_characters: 'invalid', // 不正な型はエラー
            },
          },
        ],
      } as unknown as MetaYaml;

      addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, invalidMeta);
      expect(result).toBe(false);
    });
  });

  describe('getReadmeFilePathAsync', () => {
    it('readmeファイルが存在する場合パスを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      addFile(`${testDir}/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(`${testDir}/README.md`);
    });

    it('readmeファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      // README.mdファイルは作成しない

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('メタデータファイルにreadmeが設定されていない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      addDirectory(testDir);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('メタデータファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      addDirectory(testDir);

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('相対パスのreadmeファイルを正しく解決する', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: docs/README.md
files: []`;

      addDirectory(testDir);
      addDirectory(`${testDir}/docs`);
      addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      addFile(`${testDir}/docs/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(`${testDir}/docs/README.md`);
    });
  });

  describe('findNovelRootAsync', () => {
    it('.dialogoi/dialogoi.yamlが存在するディレクトリを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/novel';

      addDirectory(workspaceRoot);
      addDirectory(novelRoot);
      addDirectory(`${novelRoot}/.dialogoi`);
      addFile(`${novelRoot}/.dialogoi/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(novelRoot);
    });

    it('深い階層のdialogoiプロジェクトを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/projects/novel/src';

      addDirectory(workspaceRoot);
      addDirectory(`${workspaceRoot}/projects`);
      addDirectory(`${workspaceRoot}/projects/novel`);
      addDirectory(novelRoot);
      addDirectory(`${novelRoot}/.dialogoi`);
      addFile(`${novelRoot}/.dialogoi/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(novelRoot);
    });

    it('複数のdialogoiプロジェクトがある場合最初に見つかったものを返す', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot1 = '/test/workspace/project1';
      const novelRoot2 = '/test/workspace/project2';

      addDirectory(workspaceRoot);
      addDirectory(novelRoot1);
      addDirectory(novelRoot2);
      addDirectory(`${novelRoot1}/.dialogoi`);
      addDirectory(`${novelRoot2}/.dialogoi`);
      addFile(`${novelRoot1}/.dialogoi/dialogoi.yaml`, 'version: 1.0');
      addFile(`${novelRoot2}/.dialogoi/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      // どちらか一方が返されることを確認（実装に依存）
      expect(result === novelRoot1 || result === novelRoot2).toBeTruthy();
    });

    it('.dialogoi/dialogoi.yamlが存在しない場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      addDirectory(workspaceRoot);
      addDirectory(`${workspaceRoot}/project1`);
      addDirectory(`${workspaceRoot}/project2`);

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(null);
    });

    it('ワークスペースルート自体にdialogoiプロジェクトがある場合', async () => {
      const workspaceRoot = '/test/workspace';
      addDirectory(workspaceRoot);
      addDirectory(`${workspaceRoot}/.dialogoi`);
      addFile(`${workspaceRoot}/.dialogoi/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(workspaceRoot);
    });

    it('空のディレクトリの場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      addDirectory(workspaceRoot);

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(null);
    });
  });

  describe('相互運用テスト', () => {
    it('loadMetaYamlとsaveMetaYamlの相互運用', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            comments: '.chapter1.txt.comments.yaml',
            hash: 'abc123',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);

      // 保存 -> 読み込み -> 保存 -> 読み込み
      const saveResult1 = await service.saveMetaYamlAsync(testDir, meta);
      expect(saveResult1).toBe(true);

      const loadResult1 = await service.loadMetaYamlAsync(testDir);
      expect(loadResult1).not.toBe(null);

      if (loadResult1 === null) {
        throw new Error('loadResult1 should not be null');
      }
      const saveResult2 = await service.saveMetaYamlAsync(testDir, loadResult1);
      expect(saveResult2).toBe(true);

      const loadResult2 = await service.loadMetaYamlAsync(testDir);
      expect(loadResult2).not.toBe(null);

      // 両方の読み込み結果が同じであることを確認
      expect(loadResult1).toEqual(loadResult2);
    });
  });

  describe('タグ操作テスト', () => {
    it('updateFileTagsでタグを正常に更新する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1', '既存タグ2'],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを更新
      const newTags = ['新タグ1', '新タグ2', '新タグ3'];
      const result = await service.updateFileTags(testDir, fileName, newTags);

      // DialogoiPathServiceのresolveMetaPathが呼び出されたことを検証
      expect(mockDialogoiPathService.resolveMetaPath).toHaveBeenCalledWith(testDir);

      expect(result).toBe(true);

      // 更新されたタグを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(newTags);
    });

    it('updateFileTagsでタグを空にする', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1', '既存タグ2'],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを空にする
      const result = await service.updateFileTags(testDir, fileName, []);
      expect(result).toBe(true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual([]);
    });

    it('addFileTagで新しいタグを追加する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 新しいタグを追加
      const result = await service.addFileTag(testDir, fileName, '新タグ');
      expect(result).toBe(true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(['既存タグ1', '新タグ']);
    });

    it('addFileTagで重複タグを追加しても成功する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 既存のタグを追加
      const result = await service.addFileTag(testDir, fileName, '既存タグ1');
      expect(result).toBe(true);

      // タグが重複していないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(['既存タグ1']);
    });

    it('addFileTagでタグがないファイルに新規追加', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 新しいタグを追加
      const result = await service.addFileTag(testDir, fileName, '新タグ');
      expect(result).toBe(true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(['新タグ']);
    });

    it('removeFileTagでタグを削除する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1', 'タグ2', 'タグ3'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを削除
      const result = await service.removeFileTag(testDir, fileName, 'タグ2');
      expect(result).toBe(true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(['タグ1', 'タグ3']);
    });

    it('removeFileTagで最後のタグを削除するとtagsフィールドが削除される', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 最後のタグを削除
      const result = await service.removeFileTag(testDir, fileName, 'タグ1');
      expect(result).toBe(true);

      // tagsフィールドが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual([]);
    });

    it('removeFileTagで存在しないタグを削除しても成功する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 存在しないタグを削除
      const result = await service.removeFileTag(testDir, fileName, '存在しないタグ');
      expect(result).toBe(true);

      // タグが変更されていないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      if (fileItem === undefined || !('tags' in fileItem)) {
        throw new Error('fileItem should exist and have tags property');
      }
      expect(fileItem.tags).toEqual(['タグ1']);
    });

    it('メタデータファイルが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';

      addDirectory(testDir);

      const updateResult = await service.updateFileTags(testDir, fileName, ['タグ']);
      expect(updateResult).toBe(false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      expect(addResult).toBe(false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      expect(removeResult).toBe(false);
    });

    it('ファイルが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'nonexistent.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      const updateResult = await service.updateFileTags(testDir, fileName, ['タグ']);
      expect(updateResult).toBe(false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      expect(addResult).toBe(false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      expect(removeResult).toBe(true); // タグがない場合は成功とする仕様
    });
  });

  describe('moveFileInMetadata', () => {
    it('同じディレクトリ内でのファイル並び替え', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${testDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file2.txt',
            type: 'content',
            path: `${testDir}/file2.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file2.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file3.txt',
            type: 'content',
            path: `${testDir}/file3.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file3.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // file1.txt（インデックス0）をインデックス2に移動
      const result = await service.moveFileInMetadata(testDir, testDir, 'file1.txt', 2);

      expect(result.success).toBe(true);

      // メタデータを再読み込みして順序を確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }
      expect(updatedMeta.files.length).toBe(3);
      expect(updatedMeta.files[0]?.name).toBe('file2.txt');
      expect(updatedMeta.files[1]?.name).toBe('file3.txt');
      expect(updatedMeta.files[2]?.name).toBe('file1.txt');
    });

    it('異なるディレクトリ間でのファイル移動', async () => {
      const sourceDir = '/test/source';
      const targetDir = '/test/target';

      const sourceMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${sourceDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file2.txt',
            type: 'content',
            path: `${sourceDir}/file2.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file2.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const targetMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file3.txt',
            type: 'content',
            path: `${targetDir}/file3.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file3.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(sourceDir);
      addDirectory(targetDir);
      await service.saveMetaYamlAsync(sourceDir, sourceMeta);
      await service.saveMetaYamlAsync(targetDir, targetMeta);

      // file1.txtを移動
      const result = await service.moveFileInMetadata(sourceDir, targetDir, 'file1.txt', 0);

      expect(result.success).toBe(true);

      // 移動元を確認
      const updatedSourceMeta = await service.loadMetaYamlAsync(sourceDir);
      expect(updatedSourceMeta).not.toBe(null);
      if (updatedSourceMeta === null) {
        throw new Error('updatedSourceMeta should not be null');
      }
      expect(updatedSourceMeta.files.length).toBe(1);
      expect(updatedSourceMeta.files[0]?.name).toBe('file2.txt');

      // 移動先を確認
      const updatedTargetMeta = await service.loadMetaYamlAsync(targetDir);
      expect(updatedTargetMeta).not.toBe(null);
      if (updatedTargetMeta === null) {
        throw new Error('updatedTargetMeta should not be null');
      }
      expect(updatedTargetMeta.files.length).toBe(2);
      expect(updatedTargetMeta.files[0]?.name).toBe('file1.txt');
      expect(updatedTargetMeta.files[1]?.name).toBe('file3.txt');
      // parseMetaYaml後は実行時プロパティはダミー値になる
      expect(updatedTargetMeta.files[0]?.path).toBe('');
    });

    it('同じディレクトリ内で重複ファイル移動を試行（エラーにならない）', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${testDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 同じディレクトリ内で同名ファイルを移動（重複だがエラーにならない）
      const result = await service.moveFileInMetadata(testDir, testDir, 'file1.txt', 0);

      expect(result.success).toBe(true);
    });
  });

  describe('updateFileCommentsAsync', () => {
    it('ファイルのcommentsフィールドを正常に更新する', async () => {
      const testDir = '/test/project';
      const fileName = 'test.txt';
      const commentsPath = 'test.txt.comments.yaml';

      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: [],
            references: [],
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // commentsフィールドを更新
      const result = await service.updateFileCommentsAsync(testDir, fileName, commentsPath);
      expect(result).toBe(true);

      // 更新されたメタデータを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }

      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      // 型ガードの外でテスト
      const isValidType =
        fileItem !== undefined && (fileItem.type === 'content' || fileItem.type === 'setting');
      expect(isValidType).toBe(true);

      // commentsフィールドの確認
      const hasComments =
        isValidType && 'comments' in fileItem && fileItem.comments === commentsPath;
      expect(hasComments).toBe(true);
    });

    it('settingファイルのcommentsフィールドを更新する', async () => {
      const testDir = '/test/project';
      const fileName = 'setting.md';
      const commentsPath = 'setting.md.comments.yaml';

      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting',
            path: `${testDir}/${fileName}`,
            hash: 'hash456',
            tags: [],
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // commentsフィールドを更新
      const result = await service.updateFileCommentsAsync(testDir, fileName, commentsPath);
      expect(result).toBe(true);

      // 更新されたメタデータを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta === null) {
        throw new Error('updatedMeta should not be null');
      }

      const fileItem = updatedMeta.files.find((f) => f.name === fileName);
      expect(fileItem).not.toBe(undefined);

      // 型ガードの外でテスト
      const isValidType =
        fileItem !== undefined && (fileItem.type === 'content' || fileItem.type === 'setting');
      expect(isValidType).toBe(true);

      // commentsフィールドの確認
      const hasComments =
        isValidType && 'comments' in fileItem && fileItem.comments === commentsPath;
      expect(hasComments).toBe(true);
    });

    it('存在しないファイルに対してはfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'nonexistent.txt';
      const commentsPath = 'nonexistent.txt.comments.yaml';

      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 存在しないファイルに対してcommentsフィールドを更新
      const result = await service.updateFileCommentsAsync(testDir, fileName, commentsPath);
      expect(result).toBe(false);
    });

    it('subdirectoryファイルに対してはfalseを返す', async () => {
      const testDir = '/test/project';
      const dirName = 'subdir';
      const commentsPath = 'subdir.comments.yaml';

      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory',
            path: dirName,
            isUntracked: false,
            isMissing: false,
          } as SubdirectoryItem,
        ],
      };

      addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // subdirectoryファイルに対してcommentsフィールドを更新
      const result = await service.updateFileCommentsAsync(testDir, dirName, commentsPath);
      expect(result).toBe(false);
    });

    it('メタデータファイルが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/nonexistent';
      const fileName = 'test.txt';
      const commentsPath = 'test.txt.comments.yaml';

      // メタデータファイルが存在しない場合
      const result = await service.updateFileCommentsAsync(testDir, fileName, commentsPath);
      expect(result).toBe(false);
    });
  });
});
