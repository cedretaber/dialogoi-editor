import * as assert from 'assert';
import * as path from 'path';
import { FileOperationService } from './FileOperationService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';

// 型アサーション関数
function assertNotNull<T>(value: T | null): asserts value is T {
  assert.notStrictEqual(value, null);
}

function assertNotUndefined<T>(value: T | undefined): asserts value is T {
  assert.notStrictEqual(value, undefined);
}

suite('FileOperationService テストスイート', () => {
  let service: FileOperationService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  const testDir = '/test/project';
  const metaYamlPath = path.join(testDir, '.dialogoi-meta.yaml');

  setup(async () => {
    mockFileRepository = new MockFileRepository();
    metaYamlService = new MetaYamlService(mockFileRepository);
    service = new FileOperationService(mockFileRepository, metaYamlService);

    // テスト用のディレクトリとmeta.yamlを作成
    const testDirUri = mockFileRepository.createFileUri(testDir);
    await mockFileRepository.createDirectoryAsync(testDirUri);
    const meta = MetaYamlUtils.createMetaYaml('README.md');
    const metaContent = MetaYamlUtils.stringifyMetaYaml(meta);
    const metaUri = mockFileRepository.createFileUri(metaYamlPath);
    await mockFileRepository.writeFileAsync(metaUri, metaContent);
  });

  teardown(() => {
    mockFileRepository.reset();
  });

  suite('FileOperationService テスト', () => {
    suite('createFileAsync', () => {
      test('通常ファイルを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'test.txt', 'content', 'テスト内容');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'test.txt を作成しました。');

        // ファイルが作成されていることを確認
        const filePath = path.join(testDir, 'test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, true);

        const content = await mockFileRepository.readFileAsync(fileUri, 'utf8');
        assert.strictEqual(content, 'テスト内容');

        // meta.yamlにファイル情報が追加されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'test.txt');
        assertNotUndefined(fileItem);
        assert.strictEqual(fileItem.type, 'content');
        assert.strictEqual(fileItem.path, filePath);
      });

      test('サブディレクトリを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'subdir', 'subdirectory');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'subdir を作成しました。');

        // ディレクトリが作成されていることを確認
        const dirPath = path.join(testDir, 'subdir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, true);

        // サブディレクトリ内にmeta.yamlとREADME.mdが作成されていることを確認
        const metaPath = path.join(dirPath, '.dialogoi-meta.yaml');
        const metaUri = mockFileRepository.createFileUri(metaPath);
        const metaExists = await mockFileRepository.existsAsync(metaUri);
        assert.strictEqual(metaExists, true);

        const readmePath = path.join(dirPath, 'README.md');
        const readmeUri = mockFileRepository.createFileUri(readmePath);
        const readmeExists = await mockFileRepository.existsAsync(readmeUri);
        assert.strictEqual(readmeExists, true);
      });

      test('既に存在するファイルを作成しようとするとエラーになる', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 実行 - 同名ファイルを再度作成
        const result = await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル existing.txt は既に存在します。');
      });

      test('タグ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'tagged.txt',
          'content',
          'タグ付きコンテンツ',
          ['タグ1', 'タグ2'],
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'tagged.txt');
        assertNotUndefined(fileItem);
        assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ2']);
      });

      test('キャラクターサブタイプ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'character.md',
          'setting',
          '',
          [],
          'character',
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'character.md');
        assertNotUndefined(fileItem);
        assertNotUndefined(fileItem.character);
        assert.strictEqual(fileItem.character.importance, 'main');
        assert.strictEqual(fileItem.character.multiple_characters, false);
      });
    });

    suite('deleteFileAsync', () => {
      test('通常ファイルを正常に削除する', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'delete-test.txt', 'content', 'テスト内容');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-test.txt');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-test.txt を削除しました。');

        // ファイルが削除されていることを確認
        const filePath = path.join(testDir, 'delete-test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, false);

        // meta.yamlからファイル情報が削除されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'delete-test.txt');
        assert.strictEqual(fileItem, undefined);
      });

      test('サブディレクトリを正常に削除する', async () => {
        // 準備 - サブディレクトリを作成
        await service.createFileAsync(testDir, 'delete-dir', 'subdirectory');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-dir');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-dir を削除しました。');

        // ディレクトリが削除されていることを確認
        const dirPath = path.join(testDir, 'delete-dir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, false);
      });

      test('存在しないファイルを削除しようとするとエラーになる', async () => {
        // 実行
        const result = await service.deleteFileAsync(testDir, 'nonexistent.txt');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル nonexistent.txt が見つかりません。');
      });
    });

    suite('readFileAsync と writeFileAsync', () => {
      test('ファイルを書き込んで読み込む', async () => {
        const filePath = path.join(testDir, 'read-write-test.txt');
        const testContent = 'テスト内容です\n複数行のテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // 読み込み
        const readContent = await service.readFileAsync(filePath);

        // 検証
        assert.strictEqual(readContent, testContent);
      });

      test('存在するファイルの内容を上書きする', async () => {
        const filePath = path.join(testDir, 'overwrite-test.txt');
        const initialContent = '初期内容';
        const updatedContent = '更新された内容';

        // 初期書き込み
        await service.writeFileAsync(filePath, initialContent);

        // 読み込み確認
        let content = await service.readFileAsync(filePath);
        assert.strictEqual(content, initialContent);

        // 上書き
        await service.writeFileAsync(filePath, updatedContent);

        // 読み込み確認
        content = await service.readFileAsync(filePath);
        assert.strictEqual(content, updatedContent);
      });

      test('エンコーディングを指定してファイルを読み込む', async () => {
        const filePath = path.join(testDir, 'encoding-test.txt');
        const testContent = 'UTF-8でエンコードされたテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // UTF-8で読み込み
        const readContent = await service.readFileAsync(filePath, 'utf8');

        // 検証
        assert.strictEqual(readContent, testContent);
      });
    });

    suite('existsAsync', () => {
      test('存在するファイルでtrueを返す', async () => {
        // 準備 - ファイルを作成
        const filePath = path.join(testDir, 'exists-test.txt');
        await service.writeFileAsync(filePath, 'テスト内容');

        // 実行・検証
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, true);
      });

      test('存在しないファイルでfalseを返す', async () => {
        // 実行・検証
        const filePath = path.join(testDir, 'nonexistent.txt');
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, false);
      });

      test('存在するディレクトリでtrueを返す', async () => {
        // 実行・検証
        const exists = await service.existsAsync(testDir);
        assert.strictEqual(exists, true);
      });
    });
  });
});
