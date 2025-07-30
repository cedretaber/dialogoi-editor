import { ProjectSettingsService, ProjectSettingsUpdateData } from './ProjectSettingsService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { Logger } from '../utils/Logger.js';

describe('ProjectSettingsService テストスイート', () => {
  let service: ProjectSettingsService;
  let mockFileRepository: MockFileRepository;
  let logger: Logger;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    logger = Logger.getInstance();
    service = new ProjectSettingsService(
      container.getDialogoiYamlService(),
      container.getProjectSetupService(),
      logger,
    );
  });

  afterEach(() => {
    mockFileRepository.reset();
  });

  describe('プロジェクト設定の読み込み', () => {
    it('有効なDialogoiプロジェクトの設定を正しく読み込める', async () => {
      const projectRoot = '/test/project';
      const dialogoiYaml: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp', '.*'],
        },
      };

      // dialogoi.yamlファイルをモック
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${dialogoiYaml.title}"
author: "${dialogoiYaml.author}"
created_at: "${dialogoiYaml.created_at}"
tags:
  - "${dialogoiYaml.tags?.[0]}"
  - "${dialogoiYaml.tags?.[1]}"
project_settings:
  readme_filename: "${dialogoiYaml.project_settings?.readme_filename}"
  exclude_patterns:
    - "${dialogoiYaml.project_settings?.exclude_patterns?.[0]}"
    - "${dialogoiYaml.project_settings?.exclude_patterns?.[1]}"`,
      );

      // 設定が正しく読み込まれることを確認
      const loadedSettings = await service.loadProjectSettings(projectRoot);
      expect(loadedSettings).not.toBe(null);
      expect(loadedSettings?.title).toBe(dialogoiYaml.title);
      expect(loadedSettings?.author).toBe(dialogoiYaml.author);
      expect(loadedSettings?.tags).toEqual(dialogoiYaml.tags);
      expect(loadedSettings?.project_settings?.readme_filename).toBe(
        dialogoiYaml.project_settings?.readme_filename,
      );
    });

    it('Dialogoiプロジェクトが存在しない場合はnullを返す', async () => {
      const projectRoot = '/test/non-project';

      const loadedSettings = await service.loadProjectSettings(projectRoot);
      expect(loadedSettings).toBe(null);
    });

    it('dialogoi.yamlファイルが不正な場合はnullを返す', async () => {
      const projectRoot = '/test/invalid-project';

      // 不正なYAMLファイルをモック
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        'title: "テスト"\nauthor: "著者"\ninvalid: yaml: [unclosed',
      );

      const loadedSettings = await service.loadProjectSettings(projectRoot);
      expect(loadedSettings).toBe(null);
    });
  });

  describe('バリデーション機能', () => {
    it('有効な更新データはバリデーションを通過する', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        tags: ['ファンタジー', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp', '.*'],
        },
      };

      const validation = service.validateUpdateData(updateData);
      expect(validation.isValid).toBe(true);
      expect(Object.keys(validation.errors).length).toBe(0);
    });

    it('必須フィールドが空の場合はバリデーションエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
      };

      const validation = service.validateUpdateData(updateData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors['title']).toBe('タイトルは必須です');
      expect(validation.errors['author']).toBe('著者は必須です');
    });

    it('重複するタグはエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        tags: ['ファンタジー', '冒険', 'ファンタジー'],
      };

      const validation = service.validateUpdateData(updateData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors['tags']?.includes('重複するタグがあります')).toBeTruthy();
      expect(validation.errors['tags']?.includes('ファンタジー')).toBeTruthy();
    });

    it('重複する除外パターンはエラーになる', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
        project_settings: {
          exclude_patterns: ['*.tmp', '.*', '*.tmp'],
        },
      };

      const validation = service.validateUpdateData(updateData);
      expect(validation.isValid).toBe(false);
      expect(
        validation.errors['exclude_patterns']?.includes('重複する除外パターンがあります'),
      ).toBeTruthy();
      expect(validation.errors['exclude_patterns']?.includes('*.tmp')).toBeTruthy();
    });
  });

  describe('プロジェクト設定の更新', () => {
    it('有効な更新データで設定を正しく更新できる', async () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['元のタグ'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
created_at: "${existingSettings.created_at}"
updated_at: "${existingSettings.updated_at}"
tags:
  - "${existingSettings.tags?.[0]}"
project_settings:
  readme_filename: "${existingSettings.project_settings.readme_filename}"
  exclude_patterns: []`,
      );

      // 更新データ
      const updateData: ProjectSettingsUpdateData = {
        title: '新しいタイトル',
        author: '新しい著者',
        tags: ['新しいタグ', '冒険'],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp'],
        },
      };

      // 更新実行
      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(true);

      // 更新後の設定を確認
      const updatedSettings = await service.loadProjectSettings(projectRoot);
      expect(updatedSettings).not.toBe(null);
      expect(updatedSettings?.['title']).toBe(updateData['title']);
      expect(updatedSettings?.['author']).toBe(updateData['author']);
      expect(updatedSettings?.tags).toEqual(updateData['tags']);
      expect(updatedSettings?.project_settings?.readme_filename).toBe(
        updateData.project_settings?.readme_filename,
      );
      expect(updatedSettings?.project_settings?.exclude_patterns).toEqual(
        updateData.project_settings?.exclude_patterns,
      );

      // 元の必須フィールドが保持されることを確認
      expect(updatedSettings?.created_at).toBe(existingSettings.created_at);
    });

    it('バリデーションエラーがある場合は更新が失敗する', async () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: [],
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
created_at: "${existingSettings.created_at}"`,
      );

      // 不正な更新データ
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
      };

      // 更新実行
      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(false);

      // 元の設定が変更されていないことを確認
      const unchangedSettings = await service.loadProjectSettings(projectRoot);
      expect(unchangedSettings).not.toBe(null);
      expect(unchangedSettings?.['title']).toBe(existingSettings['title']);
      expect(unchangedSettings?.['author']).toBe(existingSettings['author']);
    });

    it('プロジェクトが存在しない場合は更新が失敗する', async () => {
      const projectRoot = '/test/non-project';

      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
      };

      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(false);
    });

    it('空のタグと除外パターンはundefinedとして保存される', async () => {
      const projectRoot = '/test/project';

      // 既存の設定を作成
      const existingSettings: DialogoiYaml = {
        title: '元のタイトル',
        author: '元の著者',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        tags: ['元のタグ'],
        project_settings: {
          readme_filename: 'OLD.md',
          exclude_patterns: ['*.old'],
        },
      };

      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "${existingSettings.title}"
author: "${existingSettings.author}"
created_at: "${existingSettings.created_at}"
updated_at: "${existingSettings.updated_at}"
tags:
  - "${existingSettings.tags?.[0]}"
project_settings:
  readme_filename: "${existingSettings.project_settings?.readme_filename}"
  exclude_patterns:
    - "${existingSettings.project_settings?.exclude_patterns?.[0]}"`,
      );

      // 空の配列・文字列で更新
      const updateData: ProjectSettingsUpdateData = {
        title: '新しいタイトル',
        author: '新しい著者',
        tags: [],
        project_settings: {
          readme_filename: '',
          exclude_patterns: [],
        },
      };

      // 更新実行
      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(true);

      // 更新後の設定を確認
      const updatedSettings = await service.loadProjectSettings(projectRoot);
      expect(updatedSettings).not.toBe(null);
      expect(updatedSettings?.tags).toEqual([]); // 空配列になる
      expect(updatedSettings?.project_settings).toEqual({
        readme_filename: 'OLD.md', // 既存の値が保持される
        exclude_patterns: ['*.old'], // 既存の値が保持される
      });
    });
  });

  describe('プロジェクト存在チェック', () => {
    it('Dialogoiプロジェクトが存在する場合はtrueを返す', async () => {
      const projectRoot = '/test/project';

      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`),
        `title: "Test"
author: "Author"
created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-01T00:00:00Z"
tags: []
project_settings:
  readme_filename: "README.md"
  exclude_patterns: []`,
      );

      const exists = await service.isDialogoiProject(projectRoot);
      expect(exists).toBe(true);
    });

    it('Dialogoiプロジェクトが存在しない場合はfalseを返す', async () => {
      const projectRoot = '/test/non-project';

      const exists = await service.isDialogoiProject(projectRoot);
      expect(exists).toBe(false);
    });
  });

  describe('dialogoi.yamlパス取得', () => {
    it('正しいパスを返す', () => {
      const projectRoot = '/test/project';
      const yamlPath = service.getDialogoiYamlPath(projectRoot);
      expect(yamlPath).toBe('/test/project/dialogoi.yaml');
    });
  });
});
