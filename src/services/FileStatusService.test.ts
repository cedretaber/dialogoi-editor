import { FileStatusService, FileStatus, FileStatusInfo } from './FileStatusService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

describe('FileStatusService テストスイート', () => {
  let fileStatusService: FileStatusService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    metaYamlService = container.getMetaYamlService();
    fileStatusService = new FileStatusService(mockFileRepository, metaYamlService);
  });

  describe('getFileStatusList', () => {
    it('空のディレクトリの場合、空の配列を返す', async () => {
      const directoryPath = '/test/empty';
      mockFileRepository.createDirectoryForTest(directoryPath);

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(0);
    });

    it('meta.yamlが存在しない場合、全てのファイルが未追跡として表示される', async () => {
      const directoryPath = '/test/no-meta';
      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest('/test/no-meta/test.txt', 'test content');
      mockFileRepository.createFileForTest('/test/no-meta/another.md', 'markdown content');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const testFile = result.find((f) => f.name === 'test.txt');
      expect(testFile).not.toBe(undefined);
      expect(testFile?.status).toBe(FileStatus.Untracked);
      expect(testFile?.metaEntry).toBe(undefined);

      const markdownFile = result.find((f) => f.name === 'another.md');
      expect(markdownFile).not.toBe(undefined);
      expect(markdownFile?.status).toBe(FileStatus.Untracked);
    });

    it('管理対象ファイルが存在する場合、Managedとして表示される', async () => {
      const directoryPath = '/test/managed';
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/managed/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/managed/chapter1.txt', 'chapter content');
      mockFileRepository.createDirectoryForTest('/test/managed/settings');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      expect(chapterFile).not.toBe(undefined);
      expect(chapterFile?.status).toBe(FileStatus.Managed);
      expect(chapterFile?.isDirectory).toBe(false);
      expect(chapterFile?.metaEntry).not.toBe(undefined);
      expect(chapterFile?.metaEntry?.type).toBe('content');
      expect((chapterFile?.metaEntry as any)?.tags).toEqual(['重要']);

      const settingsDir = result.find((f) => f.name === 'settings');
      expect(settingsDir).not.toBe(undefined);
      expect(settingsDir?.status).toBe(FileStatus.Managed);
      expect(settingsDir?.isDirectory).toBe(true);
    });

    it('管理対象だが実際には存在しないファイルはMissingとして表示される', async () => {
      const directoryPath = '/test/missing';
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/missing/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/missing/existing.txt', 'existing content');
      // missing.txtは作成しない

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(2);

      const missingFile = result.find((f) => f.name === 'missing.txt');
      expect(missingFile).not.toBe(undefined);
      expect(missingFile?.status).toBe(FileStatus.Missing);
      expect(missingFile?.isDirectory).toBe(undefined);

      const existingFile = result.find((f) => f.name === 'existing.txt');
      expect(existingFile).not.toBe(undefined);
      expect(existingFile?.status).toBe(FileStatus.Managed);
      expect(existingFile?.isDirectory).toBe(false);
    });

    it('READMEファイルは管理対象として隠される', async () => {
      const directoryPath = '/test/readme';
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/readme/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/readme/README.md', 'readme content');
      mockFileRepository.createFileForTest('/test/readme/chapter1.txt', 'chapter content');

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // README.mdは表示されない（管理対象として隠される）
      expect(result.length).toBe(1);
      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      expect(chapterFile).not.toBe(undefined);
      expect(chapterFile?.status).toBe(FileStatus.Managed);

      // README.mdが結果に含まれていないことを確認
      const readmeFile = result.find((f) => f.name === 'README.md');
      expect(readmeFile).toBe(undefined);
    });

    it('コメントファイルは管理対象として隠される', async () => {
      const directoryPath = '/test/comments';
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/comments/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/comments/chapter1.txt', 'chapter1 content');
      mockFileRepository.createFileForTest('/test/comments/chapter2.txt', 'chapter2 content');
      mockFileRepository.createFileForTest(
        '/test/comments/.chapter1.txt.comments.yaml',
        'comments content',
      );

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // コメントファイルは表示されない（管理対象として隠される）
      expect(result.length).toBe(2);

      const chapter1 = result.find((f) => f.name === 'chapter1.txt');
      expect(chapter1).not.toBe(undefined);
      expect(chapter1?.status).toBe(FileStatus.Managed);

      const chapter2 = result.find((f) => f.name === 'chapter2.txt');
      expect(chapter2).not.toBe(undefined);
      expect(chapter2?.status).toBe(FileStatus.Managed);

      // コメントファイルが結果に含まれていないことを確認
      const commentFile = result.find((f) => f.name === '.chapter1.txt.comments.yaml');
      expect(commentFile).toBe(undefined);
    });

    it('管理ファイル(.dialogoi-meta.yaml, dialogoi.yaml)は除外される', async () => {
      const directoryPath = '/test/management';
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/management/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/management/dialogoi.yaml', 'old config');
      mockFileRepository.createFileForTest('/test/management/test.txt', 'test content');

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // 管理ファイルは除外され、test.txtのみ表示される
      expect(result.length).toBe(1);
      const testFile = result.find((f) => f.name === 'test.txt');
      expect(testFile).not.toBe(undefined);
      expect(testFile?.status).toBe(FileStatus.Managed);

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
      mockFileRepository.createDirectoryForTest(directoryPath);

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

      mockFileRepository.createFileForTest('/test/sorting/.dialogoi-meta.yaml', metaContent);
      mockFileRepository.createFileForTest('/test/sorting/z-file.txt', 'z content');
      mockFileRepository.createFileForTest('/test/sorting/a-file.txt', 'a content');
      mockFileRepository.createDirectoryForTest('/test/sorting/m-dir');
      mockFileRepository.createFileForTest('/test/sorting/b-untracked.txt', 'untracked content');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      expect(result.length).toBe(4);

      // ディレクトリが最初、その後ファイルがmeta.yaml順（meta.yamlに含まれていないファイルは名前順で末尾）
      expect(result[0]?.name).toBe('m-dir');
      expect(result[0]?.isDirectory).toBe(true);
      expect(result[1]?.name).toBe('z-file.txt'); // meta.yamlの最初
      expect(result[1]?.isDirectory).toBe(false);
      expect(result[2]?.name).toBe('a-file.txt'); // meta.yamlの2番目
      expect(result[2]?.isDirectory).toBe(false);
      expect(result[3]?.name).toBe('b-untracked.txt'); // meta.yamlに含まれていない
      expect(result[3]?.isDirectory).toBe(false);
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
      expect((result as any).tags).toEqual(['重要']);
      expect((result as any).comments).toBe('.test.txt.comments.yaml');
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
