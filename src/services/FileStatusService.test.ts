import * as assert from 'assert';
import { FileStatusService, FileStatus, FileStatusInfo } from './FileStatusService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

suite('FileStatusService テストスイート', () => {
  let fileStatusService: FileStatusService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    metaYamlService = container.getMetaYamlService();
    fileStatusService = new FileStatusService(mockFileRepository, metaYamlService);
  });

  suite('getFileStatusList', () => {
    test('空のディレクトリの場合、空の配列を返す', async () => {
      const directoryPath = '/test/empty';
      mockFileRepository.createDirectoryForTest(directoryPath);

      const result = await fileStatusService.getFileStatusList(directoryPath);
      assert.strictEqual(result.length, 0);
    });

    test('meta.yamlが存在しない場合、全てのファイルが未追跡として表示される', async () => {
      const directoryPath = '/test/no-meta';
      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest('/test/no-meta/test.txt', 'test content');
      mockFileRepository.createFileForTest('/test/no-meta/another.md', 'markdown content');

      const result = await fileStatusService.getFileStatusList(directoryPath);
      assert.strictEqual(result.length, 2);

      const testFile = result.find((f) => f.name === 'test.txt');
      assert.notStrictEqual(testFile, undefined);
      assert.strictEqual(testFile?.status, FileStatus.Untracked);
      assert.strictEqual(testFile?.metaEntry, undefined);

      const markdownFile = result.find((f) => f.name === 'another.md');
      assert.notStrictEqual(markdownFile, undefined);
      assert.strictEqual(markdownFile?.status, FileStatus.Untracked);
    });

    test('管理対象ファイルが存在する場合、Managedとして表示される', async () => {
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
      assert.strictEqual(result.length, 2);

      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      assert.notStrictEqual(chapterFile, undefined);
      assert.strictEqual(chapterFile?.status, FileStatus.Managed);
      assert.strictEqual(chapterFile?.isDirectory, false);
      assert.notStrictEqual(chapterFile?.metaEntry, undefined);
      assert.strictEqual(chapterFile?.metaEntry?.type, 'content');
      assert.deepStrictEqual(chapterFile?.metaEntry?.tags, ['重要']);

      const settingsDir = result.find((f) => f.name === 'settings');
      assert.notStrictEqual(settingsDir, undefined);
      assert.strictEqual(settingsDir?.status, FileStatus.Managed);
      assert.strictEqual(settingsDir?.isDirectory, true);
    });

    test('管理対象だが実際には存在しないファイルはMissingとして表示される', async () => {
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
      assert.strictEqual(result.length, 2);

      const missingFile = result.find((f) => f.name === 'missing.txt');
      assert.notStrictEqual(missingFile, undefined);
      assert.strictEqual(missingFile?.status, FileStatus.Missing);
      assert.strictEqual(missingFile?.isDirectory, undefined);

      const existingFile = result.find((f) => f.name === 'existing.txt');
      assert.notStrictEqual(existingFile, undefined);
      assert.strictEqual(existingFile?.status, FileStatus.Managed);
      assert.strictEqual(existingFile?.isDirectory, false);
    });

    test('READMEファイルは管理対象として隠される', async () => {
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
      assert.strictEqual(result.length, 1);
      const chapterFile = result.find((f) => f.name === 'chapter1.txt');
      assert.notStrictEqual(chapterFile, undefined);
      assert.strictEqual(chapterFile?.status, FileStatus.Managed);

      // README.mdが結果に含まれていないことを確認
      const readmeFile = result.find((f) => f.name === 'README.md');
      assert.strictEqual(readmeFile, undefined);
    });

    test('コメントファイルは管理対象として隠される', async () => {
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
      assert.strictEqual(result.length, 2);

      const chapter1 = result.find((f) => f.name === 'chapter1.txt');
      assert.notStrictEqual(chapter1, undefined);
      assert.strictEqual(chapter1?.status, FileStatus.Managed);

      const chapter2 = result.find((f) => f.name === 'chapter2.txt');
      assert.notStrictEqual(chapter2, undefined);
      assert.strictEqual(chapter2?.status, FileStatus.Managed);

      // コメントファイルが結果に含まれていないことを確認
      const commentFile = result.find((f) => f.name === '.chapter1.txt.comments.yaml');
      assert.strictEqual(commentFile, undefined);
    });

    test('管理ファイル(.dialogoi-meta.yaml, dialogoi.yaml)は除外される', async () => {
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
      assert.strictEqual(result.length, 1);
      const testFile = result.find((f) => f.name === 'test.txt');
      assert.notStrictEqual(testFile, undefined);
      assert.strictEqual(testFile?.status, FileStatus.Managed);

      // 管理ファイルが結果に含まれていないことを確認
      const metaFile = result.find((f) => f.name === '.dialogoi-meta.yaml');
      assert.strictEqual(metaFile, undefined);
      const dialogoiFile = result.find((f) => f.name === 'dialogoi.yaml');
      assert.strictEqual(dialogoiFile, undefined);
    });

    test('ディレクトリが存在しない場合、空の配列を返す', async () => {
      const directoryPath = '/test/nonexistent';

      const result = await fileStatusService.getFileStatusList(directoryPath);
      assert.strictEqual(result.length, 0);
    });

    test('ディレクトリ読み込みエラーが発生した場合、空の配列を返す', async () => {
      const directoryPath = '/test/nonexistent-for-error';
      // ディレクトリを作成しない

      const result = await fileStatusService.getFileStatusList(directoryPath);

      // エラーが発生しても空の配列を返す
      assert.strictEqual(result.length, 0);
    });

    test('結果がディレクトリ優先、ファイルはmeta.yaml順でソートされる', async () => {
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
      assert.strictEqual(result.length, 4);

      // ディレクトリが最初、その後ファイルがmeta.yaml順（meta.yamlに含まれていないファイルは名前順で末尾）
      assert.strictEqual(result[0]?.name, 'm-dir');
      assert.strictEqual(result[0]?.isDirectory, true);
      assert.strictEqual(result[1]?.name, 'z-file.txt'); // meta.yamlの最初
      assert.strictEqual(result[1]?.isDirectory, false);
      assert.strictEqual(result[2]?.name, 'a-file.txt'); // meta.yamlの2番目
      assert.strictEqual(result[2]?.isDirectory, false);
      assert.strictEqual(result[3]?.name, 'b-untracked.txt'); // meta.yamlに含まれていない
      assert.strictEqual(result[3]?.isDirectory, false);
    });
  });

  suite('statusInfoToTreeItem', () => {
    test('管理対象ファイルのStatusInfoを正しくTreeItemに変換する', () => {
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

      assert.strictEqual(result.name, 'test.txt');
      assert.strictEqual(result.type, 'content');
      assert.strictEqual(result.path, '/test/test.txt');
      assert.deepStrictEqual(result.tags, ['重要']);
      assert.strictEqual(result.comments, '.test.txt.comments.yaml');
      assert.strictEqual(result.isMissing, false);
      assert.strictEqual(result.isUntracked, false);
    });

    test('欠損ファイルのStatusInfoを正しくTreeItemに変換する', () => {
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

      assert.strictEqual(result.name, 'missing.txt');
      assert.strictEqual(result.type, 'content');
      assert.strictEqual(result.path, '/test/missing.txt');
      assert.strictEqual(result.isMissing, true);
      assert.strictEqual(result.isUntracked, false);
    });

    test('未追跡ファイルのStatusInfoを正しくTreeItemに変換する', () => {
      const statusInfo: FileStatusInfo = {
        name: 'untracked.txt',
        absolutePath: '/test/untracked.txt',
        status: FileStatus.Untracked,
        isDirectory: false,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      assert.strictEqual(result.name, 'untracked.txt');
      assert.strictEqual(result.type, 'setting'); // デフォルト
      assert.strictEqual(result.path, '/test/untracked.txt');
      assert.strictEqual(result.isUntracked, true);
      assert.strictEqual(result.isMissing, false);
    });

    test('未追跡ディレクトリのStatusInfoを正しくTreeItemに変換する', () => {
      const statusInfo: FileStatusInfo = {
        name: 'untracked-dir',
        absolutePath: '/test/untracked-dir',
        status: FileStatus.Untracked,
        isDirectory: true,
      };

      const result = fileStatusService.statusInfoToTreeItem(statusInfo);

      assert.strictEqual(result.name, 'untracked-dir');
      assert.strictEqual(result.type, 'subdirectory');
      assert.strictEqual(result.path, '/test/untracked-dir');
      assert.strictEqual(result.isUntracked, true);
    });
  });

  suite('isExcluded', () => {
    test('完全一致パターンでマッチする', () => {
      const excludePatterns = ['node_modules', 'dist', '.git'];

      assert.strictEqual(fileStatusService.isExcluded('node_modules', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('dist', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('.git', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('src', excludePatterns), false);
    });

    test('ドットファイル専用パターン（.*）でマッチする', () => {
      const excludePatterns = ['.*'];

      assert.strictEqual(fileStatusService.isExcluded('.gitignore', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('.env', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('.hidden', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('normal.txt', excludePatterns), false);
      assert.strictEqual(fileStatusService.isExcluded('dot.in.middle', excludePatterns), false);
    });

    test('ワイルドカードパターンでマッチする', () => {
      const excludePatterns = ['*.log', 'temp*', '*cache*'];

      assert.strictEqual(fileStatusService.isExcluded('app.log', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('error.log', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('temp-file', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('tempdir', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('my-cache-dir', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('cache-backup', excludePatterns), true);

      assert.strictEqual(fileStatusService.isExcluded('app.txt', excludePatterns), false);
      assert.strictEqual(fileStatusService.isExcluded('not-temp', excludePatterns), false);
      assert.strictEqual(fileStatusService.isExcluded('normal', excludePatterns), false);
    });

    test('複数パターンでの除外チェック', () => {
      const excludePatterns = ['node_modules', '.*', '*.log'];

      assert.strictEqual(fileStatusService.isExcluded('node_modules', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('.gitignore', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('debug.log', excludePatterns), true);
      assert.strictEqual(fileStatusService.isExcluded('src/main.ts', excludePatterns), false);
    });

    test('空のパターン配列では何もマッチしない', () => {
      const excludePatterns: string[] = [];

      assert.strictEqual(fileStatusService.isExcluded('anything', excludePatterns), false);
      assert.strictEqual(fileStatusService.isExcluded('.hidden', excludePatterns), false);
      assert.strictEqual(fileStatusService.isExcluded('file.log', excludePatterns), false);
    });
  });
});
