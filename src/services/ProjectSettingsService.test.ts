import { strict as assert } from 'assert';
import { ProjectSettingsService, ProjectSettingsUpdateData } from './ProjectSettingsService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { Logger } from '../utils/Logger.js';

suite('ProjectSettingsService テストスイート', () => {
  let service: ProjectSettingsService;
  let mockFileRepository: MockFileRepository;
  let logger: Logger;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    logger = Logger.getInstance();
    service = new ProjectSettingsService(container.getDialogoiYamlService(), logger);
  });

  teardown(() => {
    mockFileRepository.reset();
  });

  suite('プロジェクト設定の読み込み', () => {
    test('有効なDialogoiプロジェクトの設定を正しく読み込める', () => {
      const projectRoot = '/test/project';
      const dialogoiYaml: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp', '.*'],
        },
      };

      // dialogoi.yamlファイルをモック
      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${dialogoiYaml.title}"
author: "${dialogoiYaml.author}"
version: "${dialogoiYaml.version}"
created_at: "${dialogoiYaml.created_at}"
tags:
  - "${dialogoiYaml.tags?.[0]}"
  - "${dialogoiYaml.tags?.[1]}"
project_settings:
  readme_filename: "${dialogoiYaml.project_settings?.readme_filename}"
  exclude_patterns:
    - "${dialogoiYaml.project_settings?.exclude_patterns?.[0]}"
    - "${dialogoiYaml.project_settings?.exclude_patterns?.[1]}"`,
        'utf8',
      );

      // 設定が正しく読み込まれることを確認
      const loadedSettings = service.loadProjectSettings(projectRoot);
      assert.notStrictEqual(loadedSettings, null);
      assert.strictEqual(loadedSettings?.title, dialogoiYaml.title);
      assert.strictEqual(loadedSettings?.author, dialogoiYaml.author);
      assert.deepStrictEqual(loadedSettings?.tags, dialogoiYaml.tags);
      assert.strictEqual(
        loadedSettings?.project_settings?.readme_filename,
        dialogoiYaml.project_settings?.readme_filename,
      );
    });

    test('Dialogoiプロジェクトが存在しない場合はnullを返す', () => {
      const projectRoot = '/test/non-project';

      const loadedSettings = service.loadProjectSettings(projectRoot);
      assert.strictEqual(loadedSettings, null);
    });

    test('dialogoi.yamlファイルが不正な場合はnullを返す', () => {
      const projectRoot = '/test/invalid-project';

      // 不正なYAMLファイルをモック
      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        'invalid yaml content: [',
        'utf8',
      );

      const loadedSettings = service.loadProjectSettings(projectRoot);
      assert.strictEqual(loadedSettings, null);
    });
  });

  suite('バリデーション機能', () => {
    test('有効な更新データはバリデーションを通過する', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        tags: ['ファンタジー', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp', '.*'],
        },
      };

      const validation = service.validateUpdateData(updateData);
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(Object.keys(validation.errors).length, 0);
    });

    test('必須フィールドが空の場合はバリデーションエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
        version: '',
      };

      const validation = service.validateUpdateData(updateData);
      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(validation.errors['title'], 'タイトルは必須です');
      assert.strictEqual(validation.errors['author'], '著者は必須です');
      assert.strictEqual(validation.errors['version'], 'バージョンは必須です');
    });

    test('不正なセマンティックバージョンはエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: 'invalid-version',
      };

      const validation = service.validateUpdateData(updateData);
      assert.strictEqual(validation.isValid, false);
      assert.strictEqual(
        validation.errors['version'],
        'セマンティックバージョニング形式で入力してください（例: 1.0.0）',
      );
    });

    test('有効なセマンティックバージョンは通過する', () => {
      const validVersions = ['1.0.0', '0.1.0', '10.20.30', '1.1.2-alpha', '1.0.0+20130313144700'];

      validVersions.forEach((version) => {
        const updateData: ProjectSettingsUpdateData = {
          title: 'テスト小説',
          author: 'テスト著者',
          version,
        };

        const validation = service.validateUpdateData(updateData);
        assert.strictEqual(validation.isValid, true, `Version ${version} should be valid`);
      });
    });

    test('重複するタグはエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        tags: ['ファンタジー', '冒険', 'ファンタジー'],
      };

      const validation = service.validateUpdateData(updateData);
      assert.strictEqual(validation.isValid, false);
      assert.ok(validation.errors['tags']?.includes('重複するタグがあります') === true);
      assert.ok(validation.errors['tags']?.includes('ファンタジー') === true);
    });

    test('重複する除外パターンはエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
        project_settings: {
          exclude_patterns: ['*.tmp', '.*', '*.tmp'],
        },
      };

      const validation = service.validateUpdateData(updateData);
      assert.strictEqual(validation.isValid, false);
      assert.ok(
        validation.errors['exclude_patterns']?.includes('重複する除外パターンがあります') === true,
      );
      assert.ok(validation.errors['exclude_patterns']?.includes('*.tmp') === true);
    });
  });

  suite('プロジェクト設定の更新', () => {
    test('有効な更新データで設定を正しく更新できる', () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['元のタグ'],
      };

      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
version: "${existingSettings.version}"
created_at: "${existingSettings.created_at}"
tags:
  - "${existingSettings.tags?.[0]}"`,
        'utf8',
      );

      // 更新データ
      const updateData: ProjectSettingsUpdateData = {
        title: '新しいタイトル',
        author: '新しい著者',
        version: '2.0.0',
        tags: ['新しいタグ', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp'],
        },
      };

      // 更新実行
      const success = service.updateProjectSettings(projectRoot, updateData);
      assert.strictEqual(success, true);

      // 更新後の設定を確認
      const updatedSettings = service.loadProjectSettings(projectRoot);
      assert.notStrictEqual(updatedSettings, null);
      assert.strictEqual(updatedSettings?.['title'], updateData['title']);
      assert.strictEqual(updatedSettings?.['author'], updateData['author']);
      assert.strictEqual(updatedSettings?.['version'], updateData['version']);
      assert.deepStrictEqual(updatedSettings?.tags, updateData['tags']);
      assert.strictEqual(
        updatedSettings?.project_settings?.readme_filename,
        updateData.project_settings?.readme_filename,
      );
      assert.deepStrictEqual(
        updatedSettings?.project_settings?.exclude_patterns,
        updateData.project_settings?.exclude_patterns,
      );

      // 元の必須フィールドが保持されることを確認
      assert.strictEqual(updatedSettings?.created_at, existingSettings.created_at);
    });

    test('バリデーションエラーがある場合は更新が失敗する', () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
version: "${existingSettings.version}"
created_at: "${existingSettings.created_at}"`,
        'utf8',
      );

      // 不正な更新データ
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
        version: 'invalid',
      };

      // 更新実行
      const success = service.updateProjectSettings(projectRoot, updateData);
      assert.strictEqual(success, false);

      // 元の設定が変更されていないことを確認
      const unchangedSettings = service.loadProjectSettings(projectRoot);
      assert.notStrictEqual(unchangedSettings, null);
      assert.strictEqual(unchangedSettings?.['title'], existingSettings['title']);
      assert.strictEqual(unchangedSettings?.['author'], existingSettings['author']);
      assert.strictEqual(unchangedSettings?.['version'], existingSettings['version']);
    });

    test('プロジェクトが存在しない場合は更新が失敗する', () => {
      const projectRoot = '/test/non-project';

      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        version: '1.0.0',
      };

      const success = service.updateProjectSettings(projectRoot, updateData);
      assert.strictEqual(success, false);
    });

    test('空のタグと除外パターンはundefinedとして保存される', () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['元のタグ'],
        project_settings: {
          readme_filename: 'OLD.md',
          exclude_patterns: ['*.old'],
        },
      };

      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
version: "${existingSettings.version}"
created_at: "${existingSettings.created_at}"
tags:
  - "${existingSettings.tags?.[0]}"
project_settings:
  readme_filename: "${existingSettings.project_settings?.readme_filename}"
  exclude_patterns:
    - "${existingSettings.project_settings?.exclude_patterns?.[0]}"`,
        'utf8',
      );

      // 空の配列・文字列で更新
      const updateData: ProjectSettingsUpdateData = {
        title: '新しいタイトル',
        author: '新しい著者',
        version: '2.0.0',
        tags: [],
        project_settings: {
          readme_filename: '',
          exclude_patterns: [],
        },
      };

      // 更新実行
      const success = service.updateProjectSettings(projectRoot, updateData);
      assert.strictEqual(success, true);

      // 更新後の設定を確認
      const updatedSettings = service.loadProjectSettings(projectRoot);
      assert.notStrictEqual(updatedSettings, null);
      assert.strictEqual(updatedSettings?.tags, undefined);
      assert.strictEqual(updatedSettings?.project_settings, undefined);
    });
  });

  suite('プロジェクト存在チェック', () => {
    test('Dialogoiプロジェクトが存在する場合はtrueを返す', () => {
      const projectRoot = '/test/project';

      mockFileRepository.writeFileSync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        'title: "Test"',
        'utf8',
      );

      const exists = service.isDialogoiProject(projectRoot);
      assert.strictEqual(exists, true);
    });

    test('Dialogoiプロジェクトが存在しない場合はfalseを返す', () => {
      const projectRoot = '/test/non-project';

      const exists = service.isDialogoiProject(projectRoot);
      assert.strictEqual(exists, false);
    });
  });

  suite('dialogoi.yamlパス取得', () => {
    test('正しいパスを返す', () => {
      const projectRoot = '/test/project';
      const yamlPath = service.getDialogoiYamlPath(projectRoot);
      assert.strictEqual(yamlPath, '/test/project/dialogoi.yaml');
    });
  });
});
