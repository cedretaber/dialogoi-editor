import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectSetupService } from './ProjectSetupService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { Logger } from '../utils/Logger.js';

export interface ProjectSettingsValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface ProjectSettingsUpdateData {
  title: string;
  author: string;
  tags?: string[];
  project_settings?: {
    readme_filename?: string;
    exclude_patterns?: string[];
  };
}

/**
 * プロジェクト設定の管理とバリデーションを行うサービス
 * VSCode非依存のビジネスロジック
 */
export class ProjectSettingsService {
  constructor(
    private dialogoiYamlService: DialogoiYamlService,
    private projectSetupService: ProjectSetupService,
    private logger: Logger,
  ) {}

  /**
   * プロジェクト設定を読み込み
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns プロジェクト設定、存在しない場合はnull
   */
  async loadProjectSettings(projectRootAbsolutePath: string): Promise<DialogoiYaml | null> {
    try {
      if (!(await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRootAbsolutePath))) {
        this.logger.debug(`Not a Dialogoi project: ${projectRootAbsolutePath}`);
        return null;
      }

      const settings =
        await this.dialogoiYamlService.loadDialogoiYamlAsync(projectRootAbsolutePath);
      if (settings === null) {
        this.logger.warn(`Failed to load project settings: ${projectRootAbsolutePath}`);
        return null;
      }

      return settings;
    } catch (error) {
      this.logger.error(
        'Error loading project settings',
        error instanceof Error ? error : String(error),
      );
      return null;
    }
  }

  /**
   * プロジェクト設定の更新データをバリデーション
   * @param data 更新データ
   * @returns バリデーション結果
   */
  validateUpdateData(data: ProjectSettingsUpdateData): ProjectSettingsValidationResult {
    const errors: Record<string, string> = {};

    // 必須フィールドのチェック
    if (data['title'] === undefined || data['title'].trim() === '') {
      errors['title'] = 'タイトルは必須です';
    }

    if (data['author'] === undefined || data['author'].trim() === '') {
      errors['author'] = '著者は必須です';
    }

    // タグの検証
    if (data['tags'] !== undefined) {
      if (!Array.isArray(data['tags'])) {
        errors['tags'] = 'タグは配列である必要があります';
      } else {
        const duplicates = this.findDuplicateTags(data['tags']);
        if (duplicates.length > 0) {
          errors['tags'] = `重複するタグがあります: ${duplicates.join(', ')}`;
        }
      }
    }

    // 除外パターンの検証
    if (data.project_settings?.['exclude_patterns'] !== undefined) {
      if (!Array.isArray(data.project_settings['exclude_patterns'])) {
        errors['exclude_patterns'] = '除外パターンは配列である必要があります';
      } else {
        const duplicates = this.findDuplicatePatterns(data.project_settings['exclude_patterns']);
        if (duplicates.length > 0) {
          errors['exclude_patterns'] = `重複する除外パターンがあります: ${duplicates.join(', ')}`;
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * プロジェクト設定を更新
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param updateData 更新データ
   * @returns 更新が成功した場合true
   */
  async updateProjectSettings(
    projectRootAbsolutePath: string,
    updateData: ProjectSettingsUpdateData,
  ): Promise<boolean> {
    try {
      // バリデーション
      const validation = this.validateUpdateData(updateData);
      if (!validation.isValid) {
        this.logger.warn('Project settings validation failed', validation.errors);
        return false;
      }

      // 現在の設定を読み込み
      const currentSettings = await this.loadProjectSettings(projectRootAbsolutePath);
      if (currentSettings === null) {
        this.logger.error('Failed to load current project settings');
        return false;
      }

      // 新しい設定をマージ（必須フィールドを保持）
      const updatedSettings: DialogoiYaml = {
        ...currentSettings,
        title: updateData.title.trim(),
        author: updateData.author.trim(),
        tags:
          updateData.tags?.length !== undefined && updateData.tags.length > 0
            ? updateData.tags
            : undefined,
        project_settings: this.mergeProjectSettings(
          currentSettings.project_settings,
          updateData.project_settings,
        ),
      };

      // 設定を保存
      const success = await this.dialogoiYamlService.saveDialogoiYamlAsync(
        projectRootAbsolutePath,
        updatedSettings,
      );

      if (success) {
        this.logger.info('Project settings updated successfully');
      } else {
        this.logger.error('Failed to save project settings');
      }

      return success;
    } catch (error) {
      this.logger.error(
        'Error updating project settings',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }

  /**
   * プロジェクト設定が存在するかチェック
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns プロジェクトが存在する場合true
   */
  async isDialogoiProject(projectRootAbsolutePath: string): Promise<boolean> {
    return await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRootAbsolutePath);
  }

  /**
   * dialogoi.yamlファイルのパスを取得
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns dialogoi.yamlファイルの絶対パス
   */
  getDialogoiYamlPath(projectRootAbsolutePath: string): string {
    return this.dialogoiYamlService.getDialogoiYamlPath(projectRootAbsolutePath);
  }

  /**
   * タグ配列から重複を検出
   * @param tags タグ配列
   * @returns 重複するタグの配列
   */
  private findDuplicateTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const tag of tags) {
      if (seen.has(tag)) {
        duplicates.add(tag);
      } else {
        seen.add(tag);
      }
    }

    return Array.from(duplicates);
  }

  /**
   * 除外パターン配列から重複を検出
   * @param patterns 除外パターン配列
   * @returns 重複するパターンの配列
   */
  private findDuplicatePatterns(patterns: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const pattern of patterns) {
      if (seen.has(pattern)) {
        duplicates.add(pattern);
      } else {
        seen.add(pattern);
      }
    }

    return Array.from(duplicates);
  }

  /**
   * 新規プロジェクトを作成
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param settingsData プロジェクト設定データ
   * @returns 作成が成功した場合true
   */
  async createNewProject(
    projectRootAbsolutePath: string,
    settingsData: ProjectSettingsUpdateData,
  ): Promise<boolean> {
    try {
      // バリデーション
      const validation = this.validateUpdateData(settingsData);
      if (!validation.isValid) {
        this.logger.warn('Project settings validation failed', validation.errors);
        return false;
      }

      // 新しいプロジェクト設定を作成
      const newSettings: DialogoiYaml = {
        title: settingsData.title.trim(),
        author: settingsData.author.trim(),
        tags:
          settingsData.tags?.length !== undefined && settingsData.tags.length > 0
            ? settingsData.tags
            : undefined,
        project_settings: this.mergeProjectSettings(undefined, settingsData.project_settings),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // プロジェクトを自動セットアップ付きで作成
      const result = await this.projectSetupService.createDialogoiProjectWithSetup(
        projectRootAbsolutePath,
        newSettings.title,
        newSettings.author,
        newSettings.tags,
      );
      const success = result.success;

      if (success) {
        // プロジェクト設定を更新（project_settingsを追加）
        const updates: Partial<DialogoiYaml> = {};
        if (newSettings.project_settings !== undefined) {
          updates.project_settings = newSettings.project_settings;
        }
        await this.dialogoiYamlService.updateDialogoiYamlAsync(projectRootAbsolutePath, updates);
        this.logger.info('New project created successfully');
      } else {
        this.logger.error('Failed to create new project');
      }

      return success;
    } catch (error) {
      this.logger.error(
        'Error creating new project',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }

  /**
   * プロジェクト設定をマージ
   * @param current 現在の設定
   * @param updates 更新データ
   * @returns マージされた設定
   */
  private mergeProjectSettings(
    current: DialogoiYaml['project_settings'],
    updates: ProjectSettingsUpdateData['project_settings'],
  ): DialogoiYaml['project_settings'] {
    if (updates === undefined) {
      return current;
    }

    const readme_filename =
      updates.readme_filename !== undefined && updates.readme_filename.trim() !== ''
        ? updates.readme_filename.trim()
        : undefined;

    const exclude_patterns =
      updates.exclude_patterns !== undefined && updates.exclude_patterns.length > 0
        ? updates.exclude_patterns
        : undefined;

    // 両方ともundefinedの場合はundefinedを返す
    if (readme_filename === undefined && exclude_patterns === undefined) {
      return undefined;
    }

    return {
      readme_filename,
      exclude_patterns,
    };
  }
}
