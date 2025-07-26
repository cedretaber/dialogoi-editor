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

  suite('getDialogoiYamlPath', () => {
    test('dialogoi.yamlファイルのパスを取得する', () => {
      const projectRoot = '/test/project';
      const expectedPath = path.join(projectRoot, 'dialogoi.yaml');

      const result = service.getDialogoiYamlPath(projectRoot);
      assert.strictEqual(result, expectedPath);
    });
  });

  // ===== 非同期版メソッドのテスト =====

  suite('isDialogoiProjectRootAsync', () => {
    test('dialogoi.yamlが存在する場合trueを返す', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.isDialogoiProjectRootAsync(projectRoot);
      assert.strictEqual(result, true);
    });

    test('dialogoi.yamlが存在しない場合falseを返す', async () => {
      const projectRoot = '/test/project';

      const result = await service.isDialogoiProjectRootAsync(projectRoot);
      assert.strictEqual(result, false);
    });
  });

  suite('loadDialogoiYamlAsync', () => {
    test('正常なdialogoi.yamlを読み込む', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
created_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー"]`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, yamlContent);

      const result = await service.loadDialogoiYamlAsync(projectRoot);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'テスト小説');
      assert.strictEqual(result?.author, 'テスト著者');
      assert.strictEqual(result?.created_at, '2024-01-01T00:00:00Z');
      assert.deepStrictEqual(result?.tags, ['ファンタジー']);
    });

    test('ファイルが存在しない場合nullを返す', async () => {
      const projectRoot = '/test/project';

      const result = await service.loadDialogoiYamlAsync(projectRoot);
      assert.strictEqual(result, null);
    });

    test('不正なYAMLの場合nullを返す', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'invalid yaml content [');

      const result = await service.loadDialogoiYamlAsync(projectRoot);
      assert.strictEqual(result, null);
    });
  });

  suite('saveDialogoiYamlAsync', () => {
    test('正常なデータを保存する', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー'],
      };

      const result = await service.saveDialogoiYamlAsync(projectRoot, data);

      assert.strictEqual(result, true);
      assert.ok(
        await mockFileRepository.existsAsync(mockFileRepository.createFileUri(dialogoiYamlPath)),
      );

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      assert.ok(savedContent.includes('title: テスト小説'));
      assert.ok(savedContent.includes('author: テスト著者'));
      assert.ok(savedContent.includes('updated_at:'));
    });

    test('不正なデータの場合falseを返す', async () => {
      const projectRoot = '/test/project';
      const data = {
        title: '',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = await service.saveDialogoiYamlAsync(projectRoot, data);
      assert.strictEqual(result, false);
    });

    test('updated_atが自動で追加される', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
      };

      const before = new Date().toISOString();
      const result = await service.saveDialogoiYamlAsync(projectRoot, data);
      const after = new Date().toISOString();

      assert.strictEqual(result, true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      assert.ok(savedContent.includes('updated_at:'));

      // 保存されたファイルから updated_at を読み取って確認
      const savedData = await service.loadDialogoiYamlAsync(projectRoot);
      assert.ok(savedData?.updated_at !== undefined);
      if (savedData?.updated_at !== undefined) {
        assert.ok(savedData.updated_at >= before);
        assert.ok(savedData.updated_at <= after);
      }
    });
  });

  suite('createDialogoiProjectAsync', () => {
    test('新しいプロジェクトを作成する', async () => {
      const projectRoot = '/test/new-project';

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
        ['ファンタジー'],
      );

      assert.strictEqual(result, true);
      assert.ok(await service.isDialogoiProjectRootAsync(projectRoot));

      const data = await service.loadDialogoiYamlAsync(projectRoot);
      assert.notStrictEqual(data, null);
      assert.strictEqual(data?.title, '新しい小説');
      assert.strictEqual(data?.author, '新しい著者');
      assert.deepStrictEqual(data?.tags, ['ファンタジー']);
    });

    test('既にプロジェクトが存在する場合は作成しない', async () => {
      const projectRoot = '/test/existing-project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'existing content');

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
      );
      assert.strictEqual(result, false);
    });

    test('プロジェクトディレクトリが存在しない場合は作成する', async () => {
      const projectRoot = '/test/non-existing-dir';

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
      );

      assert.strictEqual(result, true);
      assert.ok(
        await mockFileRepository.existsAsync(mockFileRepository.createDirectoryUri(projectRoot)),
      );
      assert.ok(await service.isDialogoiProjectRootAsync(projectRoot));
    });
  });

  suite('updateDialogoiYamlAsync', () => {
    test('既存のプロジェクトを更新する', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const originalContent = `title: "元のタイトル"
author: "元の著者"
created_at: "2024-01-01T00:00:00Z"`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, originalContent);

      const result = await service.updateDialogoiYamlAsync(projectRoot, {
        title: '新しいタイトル',
        tags: ['新しいタグ'],
      });

      assert.strictEqual(result, true);

      const updatedData = await service.loadDialogoiYamlAsync(projectRoot);
      assert.strictEqual(updatedData?.title, '新しいタイトル');
      assert.strictEqual(updatedData?.author, '元の著者');
      assert.deepStrictEqual(updatedData?.tags, ['新しいタグ']);
    });

    test('プロジェクトが存在しない場合はfalseを返す', async () => {
      const projectRoot = '/test/non-existing-project';

      const result = await service.updateDialogoiYamlAsync(projectRoot, {
        title: '新しいタイトル',
      });

      assert.strictEqual(result, false);
    });
  });

  suite('findProjectRootAsync', () => {
    test('プロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const subDir = '/test/project/contents';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(subDir);
      assert.strictEqual(result, projectRoot);
    });

    test('プロジェクトルート自体から開始する場合', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(projectRoot);
      assert.strictEqual(result, projectRoot);
    });

    test('プロジェクトルートが見つからない場合nullを返す', async () => {
      const someDir = '/test/no-project';

      const result = await service.findProjectRootAsync(someDir);
      assert.strictEqual(result, null);
    });

    test('深い階層からプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const deepDir = '/test/project/contents/chapter1/subsection';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(deepDir);
      assert.strictEqual(result, projectRoot);
    });

    test('ファイルパスを渡してもプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const filePath = '/test/project/settings/characters/hero.md';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      // プロジェクトルートにdialogoi.yamlを作成
      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');
      // ファイルも実際に作成
      mockFileRepository.createFileForTest(filePath, '# ヒーロー');

      const result = await service.findProjectRootAsync(filePath);
      assert.strictEqual(result, projectRoot);
    });

    test('存在しないファイルパスでもプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const nonExistentFilePath = '/test/project/settings/characters/villain.md';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      // プロジェクトルートにdialogoi.yamlを作成（ファイルは作成しない）
      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(nonExistentFilePath);
      assert.strictEqual(result, projectRoot);
    });
  });
});
