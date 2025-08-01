import { mock, MockProxy } from 'jest-mock-extended';
import * as path from 'path';
import { FileStatusService, FileStatus, FileStatusInfo } from './FileStatusService.js';
import { FileRepository, DirectoryEntry } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem, MetaYaml } from '../utils/MetaYamlUtils.js';
import { Uri } from '../interfaces/Uri.js';
import * as yaml from 'js-yaml';

describe('FileStatusService テストスイート', () => {
  let fileStatusService: FileStatusService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
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

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    fileStatusService = new FileStatusService(mockFileRepository, mockMetaYamlService);
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
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, encoding?: string): Promise<string | Uint8Array> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      if (encoding !== undefined) {
        return Promise.resolve(content);
      } else {
        return Promise.resolve(new TextEncoder().encode(content));
      }
    });

    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation(
      (uri: Uri, data: string | Uint8Array): Promise<void> => {
        const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
        fileSystem.set(uri.path, content);
        return Promise.resolve();
      },
    );

    // readdirAsyncのモック
    mockFileRepository.readdirAsync.mockImplementation((uri: Uri): Promise<DirectoryEntry[]> => {
      const entries: DirectoryEntry[] = [];
      const basePath = uri.path;

      // ファイルを探す
      for (const filePath of Array.from(fileSystem.keys())) {
        if (path.dirname(filePath) === basePath) {
          const name = path.basename(filePath);
          entries.push({
            name,
            isFile: (): boolean => true,
            isDirectory: (): boolean => false,
          });
        }
      }

      // ディレクトリを探す
      for (const dirPath of Array.from(directories)) {
        if (path.dirname(dirPath) === basePath) {
          const name = path.basename(dirPath);
          entries.push({
            name,
            isFile: (): boolean => false,
            isDirectory: (): boolean => true,
          });
        }
      }

      return Promise.resolve(entries);
    });

    // statAsyncのモック
    mockFileRepository.statAsync.mockImplementation(
      (
        uri: Uri,
      ): Promise<{
        isFile: () => boolean;
        isDirectory: () => boolean;
        size: number;
        mtime: Date;
        birthtime: Date;
      }> => {
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
          birthtime: new Date(),
        });
      },
    );

    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation(
      (absolutePath: string): Promise<MetaYaml | null> => {
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
      },
    );
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  describe('getFileStatusList', () => {
    it('空のディレクトリの場合、空の配列を返す', async () => {
      const directoryPath = '/test/empty';
      addDirectory(directoryPath);

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(0);
    });

    it('meta.yamlが存在しない場合、全てのファイルが未追跡として表示される', async () => {
      const directoryPath = '/test/no-meta';
      addDirectory(directoryPath);
      addFile('/test/no-meta/test.txt', 'test content');
      addFile('/test/no-meta/another.md', 'markdown content');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const testFile = result.find((f) => f.name === 'test.txt');
      if (!testFile) {
        throw new Error('testFile not found');
      }
      expect(testFile.status).toBe(FileStatus.Untracked);
      expect(testFile.metaEntry).toBe(undefined);

      const markdownFile = result.find((f) => f.name === 'another.md');
      if (!markdownFile) {
        throw new Error('markdownFile not found');
      }
      expect(markdownFile.status).toBe(FileStatus.Untracked);
    });

    it('管理対象ファイルが存在する場合、Managedとして表示される', async () => {
      const directoryPath = '/test/managed';
      addDirectory(directoryPath);

      // meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/managed/chapter1.txt
    hash: hash123
    tags:
      - 重要
    references: []
    comments: .chapter1.txt.comments.yaml
    isUntracked: false
    isMissing: false
  - name: settings
    type: subdirectory
    path: /test/managed/settings
    isUntracked: false
    isMissing: false`;

      addFile('/test/managed/.dialogoi-meta.yaml', metaContent);
      addFile('/test/managed/chapter1.txt', 'chapter content');
      addDirectory('/test/managed/settings');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      if (!chapterFile) {
        throw new Error('chapterFile not found');
      }
      expect(chapterFile.status).toBe(FileStatus.Managed);
      expect(chapterFile.isDirectory).toBe(false);
      if (!chapterFile.metaEntry) {
        throw new Error('chapterFile.metaEntry not found');
      }
      expect(chapterFile.metaEntry.type).toBe('content');
      // Type assertion since we just confirmed the type above
      const contentEntry = chapterFile.metaEntry as { type: 'content'; tags: string[] };
      expect(contentEntry.tags).toEqual(['重要']);

      const settingsDir = result.find((f) => f.name === 'settings');
      if (!settingsDir) {
        throw new Error('settingsDir not found');
      }
      expect(settingsDir.status).toBe(FileStatus.Managed);
      expect(settingsDir.isDirectory).toBe(true);
    });

    it('管理対象だが実際には存在しないファイルはMissingとして表示される', async () => {
      const directoryPath = '/test/missing';
      addDirectory(directoryPath);

      const metaContent = `readme: README.md
files:
  - name: missing.txt
    type: content
    path: /test/missing/missing.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: existing.txt
    type: content
    path: /test/missing/existing.txt
    hash: hash456
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false`;

      addFile('/test/missing/.dialogoi-meta.yaml', metaContent);
      addFile('/test/missing/existing.txt', 'existing content');
      // missing.txtは作成しない

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const missingFile = result.find((f) => f.name === 'missing.txt');
      if (!missingFile) {
        throw new Error('missingFile not found');
      }
      expect(missingFile.status).toBe(FileStatus.Missing);
      expect(missingFile.isDirectory).toBe(undefined);

      const existingFile = result.find((f) => f.name === 'existing.txt');
      if (!existingFile) {
        throw new Error('existingFile not found');
      }
      expect(existingFile.status).toBe(FileStatus.Managed);
      expect(existingFile.isDirectory).toBe(false);
    });

    it('READMEファイルは管理対象として隠される', async () => {
      const directoryPath = '/test/readme';
      addDirectory(directoryPath);

      const metaContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/readme/chapter1.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false`;

      addFile('/test/readme/.dialogoi-meta.yaml', metaContent);
      addFile('/test/readme/README.md', 'readme content');
      addFile('/test/readme/chapter1.txt', 'chapter content');

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // README.mdは表示されない（管理対象として隠される）
      expect(result.length).toBe(1);
      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      if (!chapterFile) {
        throw new Error('chapterFile not found');
      }
      expect(chapterFile.status).toBe(FileStatus.Managed);

      // README.mdが結果に含まれていないことを確認
      const readmeFile = result.find((f) => f.name === 'README.md');
      expect(readmeFile).toBe(undefined);
    });

    it('コメントファイルは管理対象として隠される', async () => {
      const directoryPath = '/test/comments';
      addDirectory(directoryPath);

      const metaContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/comments/chapter1.txt
    hash: hash123
    tags: []
    references: []
    comments: .chapter1.txt.comments.yaml
    isUntracked: false
    isMissing: false
  - name: chapter2.txt
    type: content
    path: /test/comments/chapter2.txt
    hash: hash456
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false`;

      addFile('/test/comments/.dialogoi-meta.yaml', metaContent);
      addFile('/test/comments/chapter1.txt', 'chapter1 content');
      addFile('/test/comments/chapter2.txt', 'chapter2 content');
      addFile('/test/comments/.chapter1.txt.comments.yaml', 'comments content');

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // コメントファイルは表示されない（管理対象として隠される）
      expect(result.length).toBe(2);

      const chapter1 = result.find((f) => f.name === 'chapter1.txt');
      if (!chapter1) {
        throw new Error('chapter1 not found');
      }
      expect(chapter1.status).toBe(FileStatus.Managed);

      const chapter2 = result.find((f) => f.name === 'chapter2.txt');
      if (!chapter2) {
        throw new Error('chapter2 not found');
      }
      expect(chapter2.status).toBe(FileStatus.Managed);

      // コメントファイルが結果に含まれていないことを確認
      const commentFile = result.find((f) => f.name === '.chapter1.txt.comments.yaml');
      expect(commentFile).toBe(undefined);
    });

    it('管理ファイル(.dialogoi-meta.yaml, dialogoi.yaml)は除外される', async () => {
      const directoryPath = '/test/management';
      addDirectory(directoryPath);

      const metaContent = `readme: README.md
files:
  - name: test.txt
    type: content
    path: /test/management/test.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false`;

      addFile('/test/management/.dialogoi-meta.yaml', metaContent);
      addFile('/test/management/dialogoi.yaml', 'old config');
      addFile('/test/management/test.txt', 'test content');

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // 管理ファイルは除外され、test.txtのみ表示される
      expect(result.length).toBe(1);
      const testFile = result.find((f) => f.name === 'test.txt');
      if (!testFile) {
        throw new Error('testFile not found');
      }
      expect(testFile.status).toBe(FileStatus.Managed);

      // 管理ファイルが結果に含まれていないことを確認
      const metaFile = result.find((f) => f.name === '.dialogoi-meta.yaml');
      expect(metaFile).toBe(undefined);
      const dialogoiFile = result.find((f) => f.name === 'dialogoi.yaml');
      expect(dialogoiFile).toBe(undefined);
    });

    it('ディレクトリが存在しない場合、空の配列を返す', async () => {
      const directoryPath = '/test/nonexistent';

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(0);
    });

    it('ディレクトリ読み込みエラーが発生した場合、空の配列を返す', async () => {
      const directoryPath = '/test/nonexistent-for-error';
      // ディレクトリを作成しない

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // エラーが発生しても空の配列を返す
      expect(result.length).toBe(0);
    });

    it('結果がディレクトリ優先、ファイルはmeta.yaml順でソートされる', async () => {
      const directoryPath = '/test/sorting';
      addDirectory(directoryPath);

      const metaContent = `readme: README.md
files:
  - name: z-file.txt
    type: content
    path: /test/sorting/z-file.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: a-file.txt
    type: content
    path: /test/sorting/a-file.txt
    hash: hash456
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: m-dir
    type: subdirectory
    path: /test/sorting/m-dir
    isUntracked: false
    isMissing: false`;

      addFile('/test/sorting/.dialogoi-meta.yaml', metaContent);
      addFile('/test/sorting/z-file.txt', 'z content');
      addFile('/test/sorting/a-file.txt', 'a content');
      addDirectory('/test/sorting/m-dir');
      addFile('/test/sorting/b-untracked.txt', 'untracked content');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(4);

      // ディレクトリが最初、その後ファイルがmeta.yaml順（meta.yamlに含まれていないファイルは名前順で末尾）
      if (!result[0] || !result[1] || !result[2] || !result[3]) {
        throw new Error('Expected results not found');
      }
      expect(result[0].name).toBe('m-dir');
      expect(result[0].isDirectory).toBe(true);
      expect(result[1].name).toBe('z-file.txt'); // meta.yamlの最初
      expect(result[1].isDirectory).toBe(false);
      expect(result[2].name).toBe('a-file.txt'); // meta.yamlの2番目
      expect(result[2].isDirectory).toBe(false);
      expect(result[3].name).toBe('b-untracked.txt'); // meta.yamlに含まれていない
      expect(result[3].isDirectory).toBe(false);
    });
  });

  describe('statusInfoToTreeItem', () => {
    it('管理対象ファイルのStatusInfoを正しくTreeItemに変換する', () => {
      const metaEntry: DialogoiTreeItem = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        hash: 'testhash',
        tags: ['重要'],
        references: [],
        comments: '.test.txt.comments.yaml',
        isUntracked: false,
        isMissing: false,
      };

      const statusInfo: FileStatusInfo = {
        name: 'test.txt',
        absolutePath: '/test/test.txt',
        status: FileStatus.Managed,
        metaEntry,
        isDirectory: false,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      expect(result.name).toBe('test.txt');
      expect(result.type).toBe('content');
      expect(result.path).toBe('/test/test.txt');
      // Type assertion since we just confirmed the type above
      const contentResult = result as { type: 'content'; tags: string[]; comments: string };
      expect(contentResult.tags).toEqual(['重要']);
      expect(contentResult.comments).toBe('.test.txt.comments.yaml');
      expect(result.isMissing).toBe(false);
      expect(result.isUntracked).toBe(false);
    });

    it('欠損ファイルのStatusInfoを正しくTreeItemに変換する', () => {
      const metaEntry: DialogoiTreeItem = {
        name: 'missing.txt',
        type: 'content',
        path: '/test/missing.txt',
        hash: 'missinghash',
        tags: [],
        references: [],
        comments: '',
        isUntracked: false,
        isMissing: false,
      };

      const statusInfo: FileStatusInfo = {
        name: 'missing.txt',
        absolutePath: '/test/missing.txt',
        status: FileStatus.Missing,
        metaEntry,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      expect(result.name).toBe('missing.txt');
      expect(result.type).toBe('content');
      expect(result.path).toBe('/test/missing.txt');
      expect(result.isMissing).toBe(true);
      expect(result.isUntracked).toBe(false);
    });

    it('未追跡ファイルのStatusInfoを正しくTreeItemに変換する', () => {
      const statusInfo: FileStatusInfo = {
        name: 'untracked.txt',
        absolutePath: '/test/untracked.txt',
        status: FileStatus.Untracked,
        isDirectory: false,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      expect(result.name).toBe('untracked.txt');
      expect(result.type).toBe('setting'); // デフォルト
      expect(result.path).toBe('/test/untracked.txt');
      expect(result.isUntracked).toBe(true);
      expect(result.isMissing).toBe(false);
    });

    it('未追跡ディレクトリのStatusInfoを正しくTreeItemに変換する', () => {
      const statusInfo: FileStatusInfo = {
        name: 'untracked-dir',
        absolutePath: '/test/untracked-dir',
        status: FileStatus.Untracked,
        isDirectory: true,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      expect(result.name).toBe('untracked-dir');
      expect(result.type).toBe('subdirectory');
      expect(result.path).toBe('/test/untracked-dir');
      expect(result.isUntracked).toBe(true);
    });
  });

  describe('isExcluded', () => {
    it('完全一致パターンでマッチする', () => {
      const excludePatterns = ['node_modules', 'dist', '.git'];

      expect(fileStatusService.isExcluded('node_modules', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('dist', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('.git', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('src', excludePatterns)).toBe(false);
    });

    it('ドットファイル専用パターン（.*）でマッチする', () => {
      const excludePatterns = ['.*'];

      expect(fileStatusService.isExcluded('.gitignore', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('.env', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('.hidden', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('normal.txt', excludePatterns)).toBe(false);
      expect(fileStatusService.isExcluded('dot.in.middle', excludePatterns)).toBe(false);
    });

    it('ワイルドカードパターンでマッチする', () => {
      const excludePatterns = ['*.log', 'temp*', '*cache*'];

      expect(fileStatusService.isExcluded('app.log', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('error.log', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('temp-file', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('tempdir', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('my-cache-dir', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('cache-backup', excludePatterns)).toBe(true);

      expect(fileStatusService.isExcluded('app.txt', excludePatterns)).toBe(false);
      expect(fileStatusService.isExcluded('not-temp', excludePatterns)).toBe(false);
      expect(fileStatusService.isExcluded('normal', excludePatterns)).toBe(false);
    });

    it('複数パターンでの除外チェック', () => {
      const excludePatterns = ['node_modules', '.*', '*.log'];

      expect(fileStatusService.isExcluded('node_modules', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('.gitignore', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('debug.log', excludePatterns)).toBe(true);
      expect(fileStatusService.isExcluded('src/main.ts', excludePatterns)).toBe(false);
    });

    it('空のパターン配列では何もマッチしない', () => {
      const excludePatterns: string[] = [];

      expect(fileStatusService.isExcluded('anything', excludePatterns)).toBe(false);
      expect(fileStatusService.isExcluded('.hidden', excludePatterns)).toBe(false);
      expect(fileStatusService.isExcluded('file.log', excludePatterns)).toBe(false);
    });
  });
});
