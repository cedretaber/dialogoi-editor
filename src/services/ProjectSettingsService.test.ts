import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectSettingsService, ProjectSettingsUpdateData } from './ProjectSettingsService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectSetupService } from './ProjectSetupService.js';
import { Logger } from '../utils/Logger.js';

describe('ProjectSettingsService テストスイート', () => {
  let service: ProjectSettingsService;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let mockProjectSetupService: MockProxy<ProjectSetupService>;
  let mockLogger: MockProxy<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // jest-mock-extendedでモック作成
    mockDialogoiYamlService = mock<DialogoiYamlService>();
    mockProjectSetupService = mock<ProjectSetupService>();
    mockLogger = mock<Logger>();
    
    // サービスを作成
    service = new ProjectSettingsService(
      mockDialogoiYamlService,
      mockProjectSetupService,
      mockLogger,
    );
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

      // DialogoiYamlServiceのモック設定
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(true);
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValue(dialogoiYaml);

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

      // DialogoiYamlServiceのモック設定
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(false);

      const loadedSettings = await service.loadProjectSettings(projectRoot);
      expect(loadedSettings).toBe(null);
      
      // Loggerのdebuggメソッドが呼ばれたことを確認
      expect(mockLogger.debug).toHaveBeenCalledWith(`Not a Dialogoi project: ${projectRoot}`);
    });

    it('dialogoi.yamlファイルが不正な場合はnullを返す', async () => {
      const projectRoot = '/test/invalid-project';

      // DialogoiYamlServiceのモック設定（プロジェクトは存在するがYAMLの読み込みに失敗）
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(true);
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValue(null);

      const loadedSettings = await service.loadProjectSettings(projectRoot);
      expect(loadedSettings).toBe(null);
      
      // Loggerのwarnメソッドが呼ばれたことを確認
      expect(mockLogger.warn).toHaveBeenCalledWith(`Failed to load project settings: ${projectRoot}`);
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

    it('必須フィールドが空の場合はバリデーションエラー', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
      };

      const validation = service.validateUpdateData(updateData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors['title']).toBe('タイトルは必須です');
      expect(validation.errors['author']).toBe('著者は必須です');
    });

    it('重複する除外パターンがある場合はバリデーションエラー', () => {
      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト',
        author: 'テスト著者',
        project_settings: {
          exclude_patterns: ['*.tmp', '*.temp', '*.tmp'], // 重複
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

      // 更新後の予想される設定
      const updatedYaml: DialogoiYaml = {
        ...existingSettings,
        title: updateData.title,
        author: updateData.author,
        tags: updateData.tags ?? [],
        project_settings: {
          readme_filename: updateData.project_settings?.readme_filename ?? 'README.md',
          exclude_patterns: updateData.project_settings?.exclude_patterns ?? [],
        },
        updated_at: expect.any(String), // 更新時刻は動的
      };

      // DialogoiYamlServiceのモック設定
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(true);
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValueOnce(existingSettings);
      mockDialogoiYamlService.saveDialogoiYamlAsync.mockResolvedValue(true);
      // 更新後の読み込みでは更新されたデータを返す
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValueOnce(updatedYaml);

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

      // 不正な更新データ
      const updateData: ProjectSettingsUpdateData = {
        title: '',
        author: '',
      };

      // 更新実行（バリデーションエラーで失敗）
      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(false);

      // DialogoiYamlServiceのsaveDialogoiYamlAsyncが呼ばれないことを確認
      expect(mockDialogoiYamlService.saveDialogoiYamlAsync).not.toHaveBeenCalled();
    });

    it('プロジェクトが存在しない場合は更新が失敗する', async () => {
      const projectRoot = '/test/non-project';

      const updateData: ProjectSettingsUpdateData = {
        title: 'テスト小説',
        author: 'テスト著者',
      };

      // DialogoiYamlServiceのモック設定（プロジェクトが存在しない）
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(true);
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValue(null); // 設定読み込み失敗

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

      // 更新後の予想される設定（空の配列はundefinedになる）
      const updatedYaml: DialogoiYaml = {
        ...existingSettings,
        title: updateData.title,
        author: updateData.author,
        updated_at: expect.any(String),
      };
      // 空の値はundefinedになるため、プロパティを削除
      delete (updatedYaml as any).tags;
      delete (updatedYaml as any).project_settings;

      // DialogoiYamlServiceのモック設定
      mockDialogoiYamlService.isDialogoiProjectRootAsync.mockResolvedValue(true);
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValueOnce(existingSettings);
      mockDialogoiYamlService.saveDialogoiYamlAsync.mockResolvedValue(true);
      // 更新後の読み込みでは更新されたデータを返す
      mockDialogoiYamlService.loadDialogoiYamlAsync.mockResolvedValueOnce(updatedYaml);

      // 更新実行
      const success = await service.updateProjectSettings(projectRoot, updateData);
      expect(success).toBe(true);

      // 更新後の設定を確認
      const updatedSettings = await service.loadProjectSettings(projectRoot);
      expect(updatedSettings).not.toBe(null);
      expect(updatedSettings?.tags).toBeUndefined();
      expect(updatedSettings?.project_settings?.readme_filename).toBeUndefined();
      expect(updatedSettings?.project_settings?.exclude_patterns).toBeUndefined();
    });
  });

});