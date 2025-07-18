import { suite, test, beforeEach } from 'mocha';
import * as assert from 'assert';
import { DialogoiTemplateService } from './DialogoiTemplateService.js';
import { MockFileOperationService } from './MockFileOperationService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';

suite('DialogoiTemplateService テストスイート', () => {
  let service: DialogoiTemplateService;
  let mockFileService: MockFileOperationService;

  const testTemplate = `title: "テストテンプレート"
author: "テスト著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
tags: []

project_settings:
  readme_filename: "README.md"
  exclude_patterns:
    - ".*"
    - ".DS_Store"
    - "*.tmp"
    - "node_modules"`;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileService = container.getFileOperationService() as MockFileOperationService;

    // テスト用テンプレートを設定
    mockFileService.setExtensionResource('templates/default-dialogoi.yaml', testTemplate);

    service = new DialogoiTemplateService(mockFileService);
  });

  suite('loadDefaultTemplate', () => {
    test('デフォルトテンプレートを正しく読み込む', async () => {
      const result = await service.loadDefaultTemplate();

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'テストテンプレート');
      assert.strictEqual(result?.author, 'テスト著者');
      assert.strictEqual(result?.version, '1.0.0');
      assert.strictEqual(result?.created_at, '2024-01-01T00:00:00Z');
      assert.deepStrictEqual(result?.tags, []);
      assert.strictEqual(result?.project_settings?.readme_filename, 'README.md');
      assert.ok(
        result?.project_settings?.exclude_patterns !== undefined &&
          result.project_settings.exclude_patterns.includes('.*'),
      );
    });

    test('テンプレートファイルが存在しない場合nullを返す', async () => {
      // リソースをクリア
      mockFileService.setExtensionResource('templates/default-dialogoi.yaml', '');

      const result = await service.loadDefaultTemplate();
      assert.strictEqual(result, null);
    });
  });

  suite('createProjectFromTemplate', () => {
    test('テンプレートから新しいプロジェクトを作成する', async () => {
      const result = await service.createProjectFromTemplate('新しい小説', '新しい著者', [
        'ファンタジー',
        '冒険',
      ]);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, '新しい小説');
      assert.strictEqual(result?.author, '新しい著者');
      assert.strictEqual(result?.version, '1.0.0');
      assert.deepStrictEqual(result?.tags, ['ファンタジー', '冒険']);
      assert.ok(result?.created_at);
      assert.ok(new Date(result.created_at).getTime() > 0);

      // テンプレートの設定が引き継がれているか確認
      assert.strictEqual(result?.project_settings?.readme_filename, 'README.md');
      assert.ok(
        result?.project_settings?.exclude_patterns !== undefined &&
          result.project_settings.exclude_patterns.includes('.*'),
      );
    });

    test('タグなしで新しいプロジェクトを作成する', async () => {
      const result = await service.createProjectFromTemplate('タイトル', '著者');

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'タイトル');
      assert.strictEqual(result?.author, '著者');
      assert.deepStrictEqual(result?.tags, []);
    });

    test('テンプレート読み込みエラー時はnullを返す', async () => {
      // 無効なテンプレートを設定
      mockFileService.setExtensionResource('templates/default-dialogoi.yaml', 'invalid yaml [');

      const result = await service.createProjectFromTemplate('タイトル', '著者');
      assert.strictEqual(result, null);
    });
  });

  suite('getCurrentTemplate', () => {
    test('現在時刻でcreated_atを更新したテンプレートを取得', async () => {
      const before = new Date().toISOString();
      const result = await service.getCurrentTemplate();
      const after = new Date().toISOString();

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'テストテンプレート');
      assert.strictEqual(result?.author, 'テスト著者');
      assert.ok(result?.created_at);
      assert.ok(result.created_at >= before);
      assert.ok(result.created_at <= after);
    });
  });

  suite('getDefaultExcludePatterns', () => {
    test('デフォルトの除外パターンを取得する', async () => {
      const result = await service.getDefaultExcludePatterns();

      assert.ok(Array.isArray(result));
      assert.ok(result.includes('.*'));
      assert.ok(result.includes('.DS_Store'));
      assert.ok(result.includes('*.tmp'));
      assert.ok(result.includes('node_modules'));
    });

    test('テンプレートにexclude_patternsがない場合空配列を返す', async () => {
      const simpleTemplate = `title: "シンプル"
author: "著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"`;

      mockFileService.setExtensionResource('templates/default-dialogoi.yaml', simpleTemplate);

      const result = await service.getDefaultExcludePatterns();
      assert.deepStrictEqual(result, []);
    });
  });

  suite('getDefaultReadmeFilename', () => {
    test('デフォルトのREADMEファイル名を取得する', async () => {
      const result = await service.getDefaultReadmeFilename();
      assert.strictEqual(result, 'README.md');
    });

    test('テンプレートにreadme_filenameがない場合デフォルト値を返す', async () => {
      const simpleTemplate = `title: "シンプル"
author: "著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"`;

      mockFileService.setExtensionResource('templates/default-dialogoi.yaml', simpleTemplate);

      const result = await service.getDefaultReadmeFilename();
      assert.strictEqual(result, 'README.md');
    });
  });
});
