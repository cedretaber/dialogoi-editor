import { suite, test, beforeEach } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';

suite('DialogoiYamlService テストスイート', () => {
  let service: DialogoiYamlService;
  let mockFileRepository: MockFileRepository;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    service = new DialogoiYamlService(mockFileRepository);
  });

  suite('isDialogoiProjectRoot', () => {
    test('dialogoi.yamlが存在する場合trueを返す', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = service.isDialogoiProjectRoot(projectRoot);
      assert.strictEqual(result, true);
    });

    test('dialogoi.yamlが存在しない場合falseを返す', () => {
      const projectRoot = '/test/project';

      const result = service.isDialogoiProjectRoot(projectRoot);
      assert.strictEqual(result, false);
    });
  });

  suite('loadDialogoiYaml', () => {
    test('正常なdialogoi.yamlを読み込む', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー"]`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, yamlContent);

      const result = service.loadDialogoiYaml(projectRoot);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'テスト小説');
      assert.strictEqual(result?.author, 'テスト著者');
      assert.strictEqual(result?.version, '1.0.0');
      assert.strictEqual(result?.created_at, '2024-01-01T00:00:00Z');
      assert.deepStrictEqual(result?.tags, ['ファンタジー']);
    });

    test('ファイルが存在しない場合nullを返す', () => {
      const projectRoot = '/test/project';

      const result = service.loadDialogoiYaml(projectRoot);
      assert.strictEqual(result, null);
    });

    test('不正なYAMLの場合nullを返す', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'invalid yaml content [');

      const result = service.loadDialogoiYaml(projectRoot);
      assert.strictEqual(result, null);
    });
  });

  suite('saveDialogoiYaml', () => {
    test('正常なデータを保存する', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー'],
      };

      const result = service.saveDialogoiYaml(projectRoot, data);

      assert.strictEqual(result, true);
      assert.ok(mockFileRepository.existsSync(mockFileRepository.createFileUri(dialogoiYamlPath)));

      const savedContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      assert.ok(savedContent.includes('title: テスト小説'));
      assert.ok(savedContent.includes('author: テスト著者'));
      assert.ok(savedContent.includes('updated_at:'));
    });

    test('不正なデータの場合falseを返す', () => {
      const projectRoot = '/test/project';
      const data = {
        title: '',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = service.saveDialogoiYaml(projectRoot, data);
      assert.strictEqual(result, false);
    });

    test('updated_atが自動で追加される', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      };

      const before = new Date().toISOString();
      const result = service.saveDialogoiYaml(projectRoot, data);
      const after = new Date().toISOString();

      assert.strictEqual(result, true);

      const savedContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      assert.ok(savedContent.includes('updated_at:'));

      // 保存されたファイルから updated_at を読み取って確認
      const savedData = service.loadDialogoiYaml(projectRoot);
      assert.ok(savedData?.updated_at !== undefined);
      if (savedData?.updated_at !== undefined) {
        assert.ok(savedData.updated_at >= before);
        assert.ok(savedData.updated_at <= after);
      }
    });
  });

  suite('createDialogoiProject', () => {
    test('新しいプロジェクトを作成する', () => {
      const projectRoot = '/test/new-project';

      const result = service.createDialogoiProject(projectRoot, '新しい小説', '新しい著者', [
        'ファンタジー',
      ]);

      assert.strictEqual(result, true);
      assert.ok(service.isDialogoiProjectRoot(projectRoot));

      const data = service.loadDialogoiYaml(projectRoot);
      assert.notStrictEqual(data, null);
      assert.strictEqual(data?.title, '新しい小説');
      assert.strictEqual(data?.author, '新しい著者');
      assert.deepStrictEqual(data?.tags, ['ファンタジー']);
    });

    test('既にプロジェクトが存在する場合は作成しない', () => {
      const projectRoot = '/test/existing-project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'existing content');

      const result = service.createDialogoiProject(projectRoot, '新しい小説', '新しい著者');
      assert.strictEqual(result, false);
    });

    test('プロジェクトディレクトリが存在しない場合は作成する', () => {
      const projectRoot = '/test/non-existing-dir';

      const result = service.createDialogoiProject(projectRoot, '新しい小説', '新しい著者');

      assert.strictEqual(result, true);
      assert.ok(mockFileRepository.existsSync(mockFileRepository.createDirectoryUri(projectRoot)));
      assert.ok(service.isDialogoiProjectRoot(projectRoot));
    });
  });

  suite('updateDialogoiYaml', () => {
    test('既存のプロジェクトを更新する', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const originalContent = `title: "元のタイトル"
author: "元の著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, originalContent);

      const result = service.updateDialogoiYaml(projectRoot, {
        title: '新しいタイトル',
        tags: ['新しいタグ'],
      });

      assert.strictEqual(result, true);

      const updatedData = service.loadDialogoiYaml(projectRoot);
      assert.strictEqual(updatedData?.title, '新しいタイトル');
      assert.strictEqual(updatedData?.author, '元の著者');
      assert.deepStrictEqual(updatedData?.tags, ['新しいタグ']);
    });

    test('プロジェクトが存在しない場合はfalseを返す', () => {
      const projectRoot = '/test/non-existing-project';

      const result = service.updateDialogoiYaml(projectRoot, {
        title: '新しいタイトル',
      });

      assert.strictEqual(result, false);
    });
  });

  suite('findProjectRoot', () => {
    test('プロジェクトルートを見つける', () => {
      const projectRoot = '/test/project';
      const subDir = '/test/project/contents';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = service.findProjectRoot(subDir);
      assert.strictEqual(result, projectRoot);
    });

    test('プロジェクトルート自体から開始する場合', () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = service.findProjectRoot(projectRoot);
      assert.strictEqual(result, projectRoot);
    });

    test('プロジェクトルートが見つからない場合nullを返す', () => {
      const someDir = '/test/no-project';

      const result = service.findProjectRoot(someDir);
      assert.strictEqual(result, null);
    });

    test('深い階層からプロジェクトルートを見つける', () => {
      const projectRoot = '/test/project';
      const deepDir = '/test/project/contents/chapter1/subsection';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = service.findProjectRoot(deepDir);
      assert.strictEqual(result, projectRoot);
    });
  });

  suite('getDialogoiYamlPath', () => {
    test('dialogoi.yamlファイルのパスを取得する', () => {
      const projectRoot = '/test/project';
      const expectedPath = path.join(projectRoot, 'dialogoi.yaml');

      const result = service.getDialogoiYamlPath(projectRoot);
      assert.strictEqual(result, expectedPath);
    });
  });
});
