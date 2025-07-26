import * as assert from 'assert';
import { FileManagementService } from './FileManagementService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';

suite('FileManagementService テストスイート', () => {
  let fileManagementService: FileManagementService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getMockFileRepository();
    metaYamlService = container.getMetaYamlService();
    fileManagementService = new FileManagementService(mockFileRepository, metaYamlService);
  });

  suite('addFileToManagement', () => {
    test('管理対象外ファイルを正常に追加する', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/new-file.txt';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest(filePath, 'test content');

      const metaContent = `files:
  - name: existing.txt
    type: content
    path: /test/project/existing.txt`;

      mockFileRepository.createFileForTest(`${directoryPath}/.dialogoi-meta.yaml`, metaContent);

      // ファイルを管理対象に追加
      const result = await fileManagementService.addFileToManagement(filePath, 'content');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'ファイルを管理対象に追加しました: new-file.txt');

      // meta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(directoryPath);
      assert.notStrictEqual(updatedMeta, null);
      assert.strictEqual(updatedMeta?.files.length, 2);

      const newEntry = updatedMeta?.files.find((f) => f.name === 'new-file.txt');
      assert.notStrictEqual(newEntry, undefined);
      assert.strictEqual(newEntry?.type, 'content');
      assert.strictEqual(newEntry?.path, filePath);
    });

    test('存在しないファイルの場合はエラーを返す', async () => {
      const filePath = '/test/project/nonexistent.txt';

      const result = await fileManagementService.addFileToManagement(filePath, 'content');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ファイルが存在しません'));
    });

    test('meta.yamlが存在しない場合はエラーを返す', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/file.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest(filePath, 'test content');
      // meta.yamlは作成しない

      const result = await fileManagementService.addFileToManagement(filePath, 'content');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('管理ファイルが見つかりません'));
    });

    test('既に管理対象のファイルの場合はエラーを返す', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/existing.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest(filePath, 'test content');

      const metaContent = `files:
  - name: existing.txt
    type: content
    path: /test/project/existing.txt`;

      mockFileRepository.createFileForTest(`${directoryPath}/.dialogoi-meta.yaml`, metaContent);

      const result = await fileManagementService.addFileToManagement(filePath, 'content');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に管理対象です'));
    });

    test('setting種別でファイルを追加できる', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/setting.md';

      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest(filePath, '# Setting');

      const metaContent = `files: []`;
      mockFileRepository.createFileForTest(`${directoryPath}/.dialogoi-meta.yaml`, metaContent);

      const result = await fileManagementService.addFileToManagement(filePath, 'setting');

      assert.strictEqual(result.success, true);

      const updatedMeta = await metaYamlService.loadMetaYamlAsync(directoryPath);
      const newEntry = updatedMeta?.files.find((f) => f.name === 'setting.md');
      assert.strictEqual(newEntry?.type, 'setting');
    });
  });

  suite('removeFileFromManagement', () => {
    test('管理対象ファイルを正常に削除する', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/target.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);

      const metaContent = `files:
  - name: target.txt
    type: content
    path: /test/project/target.txt
  - name: keep.txt
    type: content
    path: /test/project/keep.txt`;

      mockFileRepository.createFileForTest(`${directoryPath}/.dialogoi-meta.yaml`, metaContent);

      const result = await fileManagementService.removeFileFromManagement(filePath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'ファイルを管理対象から削除しました: target.txt');

      // meta.yamlから削除されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(directoryPath);
      assert.strictEqual(updatedMeta?.files.length, 1);
      assert.strictEqual(updatedMeta?.files[0]?.name, 'keep.txt');
    });

    test('meta.yamlが存在しない場合はエラーを返す', async () => {
      const filePath = '/test/project/file.txt';

      const result = await fileManagementService.removeFileFromManagement(filePath);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('管理ファイルが見つかりません'));
    });

    test('管理対象でないファイルの場合はエラーを返す', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/notmanaged.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);

      const metaContent = `files:
  - name: managed.txt
    type: content
    path: /test/project/managed.txt`;

      mockFileRepository.createFileForTest(`${directoryPath}/.dialogoi-meta.yaml`, metaContent);

      const result = await fileManagementService.removeFileFromManagement(filePath);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('管理対象ではありません'));
    });
  });

  suite('createMissingFile', () => {
    test('欠損ファイルを正常に作成する', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/missing.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);

      const result = await fileManagementService.createMissingFile(filePath);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'ファイルを作成しました: missing.txt');

      // ファイルが作成されていることを確認
      const fileUri = mockFileRepository.createFileUri(filePath);
      const exists = await mockFileRepository.existsAsync(fileUri);
      assert.strictEqual(exists, true);

      // デフォルト内容が設定されていることを確認
      const content = await mockFileRepository.readFileAsync(fileUri, 'utf8');
      assert.ok(content.includes('missing.txt'));
    });

    test('既に存在するファイルの場合はエラーを返す', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/existing.txt';

      mockFileRepository.createDirectoryForTest(directoryPath);
      mockFileRepository.createFileForTest(filePath, 'existing content');

      const result = await fileManagementService.createMissingFile(filePath);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に存在します'));
    });

    test('親ディレクトリが存在しない場合はエラーを返す', async () => {
      const filePath = '/test/nonexistent/file.txt';

      const result = await fileManagementService.createMissingFile(filePath);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('親ディレクトリが存在しません'));
    });

    test('カスタムテンプレートでファイルを作成できる', async () => {
      const directoryPath = '/test/project';
      const filePath = '/test/project/custom.txt';
      const customTemplate = 'カスタムテンプレート内容';

      mockFileRepository.createDirectoryForTest(directoryPath);

      const result = await fileManagementService.createMissingFile(filePath, customTemplate);

      assert.strictEqual(result.success, true);

      const fileUri = mockFileRepository.createFileUri(filePath);
      const content = await mockFileRepository.readFileAsync(fileUri, 'utf8');
      assert.strictEqual(content, customTemplate);
    });

    test('拡張子に応じて適切なデフォルト内容を生成する', async () => {
      const directoryPath = '/test/project';
      mockFileRepository.createDirectoryForTest(directoryPath);

      // .mdファイル
      const mdPath = '/test/project/test.md';
      await fileManagementService.createMissingFile(mdPath);
      const mdUri = mockFileRepository.createFileUri(mdPath);
      const mdContent = await mockFileRepository.readFileAsync(mdUri, 'utf8');
      assert.ok(mdContent.startsWith('# test.md'));

      // .txtファイル
      const txtPath = '/test/project/test.txt';
      await fileManagementService.createMissingFile(txtPath);
      const txtUri = mockFileRepository.createFileUri(txtPath);
      const txtContent = await mockFileRepository.readFileAsync(txtUri, 'utf8');
      assert.ok(txtContent.startsWith('test.txt'));

      // その他の拡張子
      const jsPath = '/test/project/test.js';
      await fileManagementService.createMissingFile(jsPath);
      const jsUri = mockFileRepository.createFileUri(jsPath);
      const jsContent = await mockFileRepository.readFileAsync(jsUri, 'utf8');
      assert.ok(jsContent.startsWith('// test.js'));
    });
  });

  suite('エラーハンドリング', () => {
    test('無効なパスでのファイル追加は適切にエラーハンドリングされる', async () => {
      // 無効なパス（空文字列）でテスト
      const invalidPath = '';

      const result = await fileManagementService.addFileToManagement(invalidPath, 'content');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('失敗しました') || result.message.includes('存在しません'));
    });

    test('無効なパスでのファイル削除は適切にエラーハンドリングされる', async () => {
      // 無効なパス（空文字列）でテスト
      const invalidPath = '';

      const result = await fileManagementService.removeFileFromManagement(invalidPath);

      assert.strictEqual(result.success, false);
      assert.ok(
        result.message.includes('失敗しました') || result.message.includes('見つかりません'),
      );
    });
  });
});
