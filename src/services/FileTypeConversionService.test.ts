import * as assert from 'assert';
import * as yaml from 'js-yaml';
import { FileTypeConversionService } from './FileTypeConversionService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';

suite('FileTypeConversionService テストスイート', () => {
  let service: FileTypeConversionService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    metaYamlService = container.getMetaYamlService();
    service = new FileTypeConversionService(mockFileRepository, metaYamlService);
  });

  suite('convertFileType', () => {
    test('contentファイルをsettingに変更する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: absoluteFilePath,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を実行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.oldType, 'content');
      assert.strictEqual(result.newType, 'setting');
      assert.ok(result.message.includes('contentからsettingに変更しました'));

      // meta.yamlが更新されたことを確認
      const updatedMetaYaml = await metaYamlService.loadMetaYamlAsync(testDir);
      assert.ok(updatedMetaYaml);
      const updatedFile = updatedMetaYaml.files.find((file) => file.name === fileName);
      assert.strictEqual(updatedFile?.type, 'setting');
    });

    test('settingファイルをcontentに変更する', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, '# Character Info');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: absoluteFilePath,
            hash: 'hash456',
            tags: [],
            comments: '.character.md.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を実行
      const result = await service.convertFileType(absoluteFilePath, 'content');

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.oldType, 'setting');
      assert.strictEqual(result.newType, 'content');
      assert.ok(result.message.includes('settingからcontentに変更しました'));

      // meta.yamlが更新されたことを確認
      const updatedMetaYaml = await metaYamlService.loadMetaYamlAsync(testDir);
      assert.ok(updatedMetaYaml);
      const updatedFile = updatedMetaYaml.files.find((file) => file.name === fileName);
      assert.strictEqual(updatedFile?.type, 'content');
    });

    test('既に同じ種別の場合は何もしない', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: absoluteFilePath,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 同じ種別に変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'content');

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.oldType, 'content');
      assert.strictEqual(result.newType, 'content');
      assert.ok(result.message.includes('既にcontent種別です'));
    });

    test('存在しないファイルの場合はエラーを返す', async () => {
      const absoluteFilePath = '/test/project/nonexistent.txt';

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ファイルが存在しません'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('meta.yamlが存在しない場合はエラーを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // ファイルのみ作成（meta.yamlなし）
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('管理対象として登録されていません'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('meta.yamlに登録されていないファイルの場合はエラーを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Unregistered content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // 別のファイルだけが登録されたmeta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'other.txt',
            type: 'content' as const,
            path: `${testDir}/other.txt`,
            hash: 'hash456',
            tags: [],
            references: [],
            comments: '.other.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('管理対象として登録されていません'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('サブディレクトリの種別変更は拒否される', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createDirectoryForTest(absoluteDirPath);

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      mockFileRepository.createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を試行
      const result = await service.convertFileType(absoluteDirPath, 'setting');

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ディレクトリの種別は変更できません'));
      assert.ok(result.errors && result.errors.length > 0);
    });
  });

  suite('getCurrentFileType', () => {
    test('contentファイルの種別を正しく取得する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(type, 'content');
    });

    test('settingファイルの種別を正しく取得する', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, '# Character Info');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(type, 'setting');
    });

    test('meta.yamlが存在しない場合はnullを返す', async () => {
      const absoluteFilePath = '/test/project/chapter1.txt';

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(type, null);
    });

    test('ファイルが登録されていない場合はnullを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);

      // 空のmeta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(type, null);
    });

    test('サブディレクトリの場合はnullを返す', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteDirPath);

      // 結果を検証
      assert.strictEqual(type, null);
    });
  });

  suite('isFileTypeConvertible', () => {
    test('contentファイルは変更可能', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(convertible, true);
    });

    test('settingファイルは変更可能', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, '# Character Info');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(convertible, true);
    });

    test('存在しないファイルは変更不可', async () => {
      const absoluteFilePath = '/test/project/nonexistent.txt';

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(convertible, false);
    });

    test('サブディレクトリは変更不可', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createDirectoryForTest(absoluteDirPath);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      mockFileRepository.createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteDirPath);

      // 結果を検証
      assert.strictEqual(convertible, false);
    });

    test('管理対象外ファイルは変更不可', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // ファイルのみ作成（meta.yamlなし）
      mockFileRepository.createDirectoryForTest(testDir);
      mockFileRepository.createFileForTest(absoluteFilePath, 'Unregistered content');

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      assert.strictEqual(convertible, false);
    });
  });
});
