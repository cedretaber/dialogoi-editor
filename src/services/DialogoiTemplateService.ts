import { FileOperationService } from '../interfaces/FileOperationService.js';
import { DialogoiYaml, DialogoiYamlUtils } from '../utils/DialogoiYamlUtils.js';

/**
 * DialogoiYamlテンプレートを管理するサービス
 */
export class DialogoiTemplateService {
  private static readonly DEFAULT_TEMPLATE_PATH = 'templates/default-dialogoi.yaml';

  constructor(private fileOperationService: FileOperationService) {}

  /**
   * デフォルトテンプレートを読み込む
   * @returns DialogoiYamlテンプレート、エラーの場合はnull
   */
  async loadDefaultTemplate(): Promise<DialogoiYaml | null> {
    try {
      const templateContent = await this.fileOperationService.readExtensionResource(
        DialogoiTemplateService.DEFAULT_TEMPLATE_PATH,
      );
      return DialogoiYamlUtils.parseDialogoiYaml(templateContent);
    } catch (error) {
      console.error('テンプレート読み込みエラー:', error);
      return null;
    }
  }

  /**
   * テンプレートから新しいDialogoiYamlを作成
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @returns 新しいDialogoiYamlオブジェクト、エラーの場合はnull
   */
  async createProjectFromTemplate(
    title: string,
    author: string,
    tags?: string[],
  ): Promise<DialogoiYaml | null> {
    const template = await this.loadDefaultTemplate();
    if (!template) {
      return null;
    }

    return {
      ...template,
      title,
      author,
      tags: tags || [],
      created_at: new Date().toISOString(),
    };
  }

  /**
   * 現在時刻でcreated_atを更新したテンプレートを取得
   * @returns 現在時刻が設定されたテンプレート、エラーの場合はnull
   */
  async getCurrentTemplate(): Promise<DialogoiYaml | null> {
    const template = await this.loadDefaultTemplate();
    if (!template) {
      return null;
    }

    return {
      ...template,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * デフォルトの除外パターンを取得
   * @returns 除外パターンの配列、エラーの場合は空配列
   */
  async getDefaultExcludePatterns(): Promise<string[]> {
    const template = await this.loadDefaultTemplate();
    return template?.project_settings?.exclude_patterns || [];
  }

  /**
   * デフォルトのREADMEファイル名を取得
   * @returns READMEファイル名、エラーの場合は"README.md"
   */
  async getDefaultReadmeFilename(): Promise<string> {
    const template = await this.loadDefaultTemplate();
    return template?.project_settings?.readme_filename !== undefined &&
      template.project_settings.readme_filename !== ''
      ? template.project_settings.readme_filename
      : 'README.md';
  }
}
