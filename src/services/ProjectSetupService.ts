import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';

/**
 * プロジェクト作成オプション
 */
export interface ProjectSetupOptions {
  autoRegisterFiles?: boolean; // 自動ファイル登録（デフォルト: true）
  createDirectoryStructure?: boolean; // ディレクトリ構造自動生成（デフォルト: true）
  fileTypeDetection?: 'extension'; // ファイル種別判定方法
  excludePatterns?: string[]; // カスタム除外パターン
  readmeTemplate?: 'minimal' | 'detailed'; // READMEテンプレート
}

/**
 * プロジェクトセットアップ結果
 */
export interface ProjectSetupResult {
  success: boolean;
  message: string;
  projectRootPath?: string;
  processedDirectories?: number;
  registeredFiles?: number;
  skippedFiles?: number;
  createdFiles?: number;
  errors?: string[];
}

/**
 * プロジェクト作成とセットアップを統合管理するサービス
 * DialogoiYamlServiceとProjectAutoSetupServiceを組み合わせて
 * 完全なプロジェクト作成フローを提供
 */
export class ProjectSetupService {
  constructor(
    private dialogoiYamlService: DialogoiYamlService,
    private projectAutoSetupService: ProjectAutoSetupService,
  ) {}

  /**
   * 新しいDialogoiプロジェクトを作成し、自動セットアップを実行
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @param options セットアップオプション
   * @returns セットアップ結果
   */
  async createDialogoiProjectWithSetup(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
    options?: ProjectSetupOptions,
  ): Promise<ProjectSetupResult> {
    const finalOptions: Required<ProjectSetupOptions> = {
      autoRegisterFiles: true,
      createDirectoryStructure: true,
      fileTypeDetection: 'extension',
      excludePatterns: [],
      readmeTemplate: 'minimal',
      ...options,
    };

    try {
      // Phase 1: 基本プロジェクト作成（dialogoi.yamlファイル）
      const projectCreated = await this.dialogoiYamlService.createDialogoiProjectAsync(
        projectRootAbsolutePath,
        title,
        author,
        tags,
      );

      if (!projectCreated) {
        return {
          success: false,
          message: 'dialogoi.yamlファイルの作成に失敗しました',
          errors: ['プロジェクトの基本設定ファイルを作成できませんでした'],
        };
      }

      const results: ProjectSetupResult = {
        success: true,
        message: '',
        projectRootPath: projectRootAbsolutePath,
        processedDirectories: 0,
        registeredFiles: 0,
        skippedFiles: 0,
        createdFiles: 0,
        errors: [],
      };

      // Phase 2: ディレクトリ構造セットアップ（オプション）
      if (finalOptions.createDirectoryStructure) {
        const setupResult = await this.projectAutoSetupService.setupProjectStructure(
          projectRootAbsolutePath,
          {
            createMetaYaml: true,
            createReadme: true,
            overwriteExisting: false,
            readmeTemplate: finalOptions.readmeTemplate,
          },
        );

        if (!setupResult.success) {
          return {
            success: false,
            message: `ディレクトリ構造のセットアップに失敗しました: ${setupResult.message}`,
            projectRootPath: projectRootAbsolutePath,
            errors: [setupResult.message],
          };
        }

        results.processedDirectories = setupResult.processedDirectories;
        results.createdFiles = setupResult.createdFiles;
      }

      // Phase 3: 全ファイル自動登録（オプション）
      if (finalOptions.autoRegisterFiles) {
        // ディレクトリ構造セットアップを行わない場合は、プロジェクトルートにmeta.yamlがないので
        // 自動登録は実行できない
        if (!finalOptions.createDirectoryStructure) {
          return {
            success: false,
            message: 'ファイル自動登録にはディレクトリ構造セットアップが必要です',
            projectRootPath: projectRootAbsolutePath,
            processedDirectories: results.processedDirectories,
            createdFiles: results.createdFiles,
            errors: ['autoRegisterFiles=trueの場合、createDirectoryStructure=trueが必要です'],
          };
        }

        const registrationResult = await this.projectAutoSetupService.registerAllFiles(
          projectRootAbsolutePath,
          {
            excludePatterns: finalOptions.excludePatterns,
            fileTypeDetection: finalOptions.fileTypeDetection,
            createReadmeIfMissing: false, // Phase 2で既に作成済み
          },
        );

        if (!registrationResult.success) {
          return {
            success: false,
            message: `ファイル自動登録に失敗しました: ${registrationResult.message}`,
            projectRootPath: projectRootAbsolutePath,
            processedDirectories: results.processedDirectories,
            createdFiles: results.createdFiles,
            errors: [registrationResult.message],
          };
        }

        results.registeredFiles = registrationResult.registeredFiles;
        results.skippedFiles = registrationResult.skippedFiles;
      }

      // 成功メッセージを生成
      const messageParts: string[] = [];
      messageParts.push('Dialogoiプロジェクトが正常に作成されました');

      if (finalOptions.createDirectoryStructure) {
        messageParts.push(
          `ディレクトリ構造を設定しました（${results.processedDirectories}ディレクトリ、${results.createdFiles}ファイル作成）`,
        );
      }

      if (finalOptions.autoRegisterFiles) {
        messageParts.push(
          `ファイルを自動登録しました（${results.registeredFiles}ファイル登録、${results.skippedFiles}ファイルスキップ）`,
        );
      }

      results.message = messageParts.join('\n');
      return results;
    } catch (error) {
      return {
        success: false,
        message: `プロジェクト作成中に予期しないエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        projectRootPath: projectRootAbsolutePath,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * 既存のDialogoiプロジェクトに対して自動セットアップのみを実行
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param options セットアップオプション
   * @returns セットアップ結果
   */
  async setupExistingProject(
    projectRootAbsolutePath: string,
    options?: ProjectSetupOptions,
  ): Promise<ProjectSetupResult> {
    const finalOptions: Required<ProjectSetupOptions> = {
      autoRegisterFiles: true,
      createDirectoryStructure: true,
      fileTypeDetection: 'extension',
      excludePatterns: [],
      readmeTemplate: 'minimal',
      ...options,
    };

    try {
      // Dialogoiプロジェクトかどうか確認
      const isDialogoiProject =
        await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRootAbsolutePath);

      if (!isDialogoiProject) {
        return {
          success: false,
          message: `指定されたディレクトリはDialogoiプロジェクトではありません: ${projectRootAbsolutePath}`,
          errors: ['dialogoi.yamlファイルが見つかりません'],
        };
      }

      const results: ProjectSetupResult = {
        success: true,
        message: '',
        projectRootPath: projectRootAbsolutePath,
        processedDirectories: 0,
        registeredFiles: 0,
        skippedFiles: 0,
        createdFiles: 0,
        errors: [],
      };

      // Phase 1: ディレクトリ構造セットアップ（オプション）
      if (finalOptions.createDirectoryStructure) {
        const setupResult = await this.projectAutoSetupService.setupProjectStructure(
          projectRootAbsolutePath,
          {
            createMetaYaml: true,
            createReadme: true,
            overwriteExisting: false,
            readmeTemplate: finalOptions.readmeTemplate,
          },
        );

        if (!setupResult.success) {
          return {
            success: false,
            message: `ディレクトリ構造のセットアップに失敗しました: ${setupResult.message}`,
            projectRootPath: projectRootAbsolutePath,
            errors: [setupResult.message],
          };
        }

        results.processedDirectories = setupResult.processedDirectories;
        results.createdFiles = setupResult.createdFiles;
      }

      // Phase 2: 全ファイル自動登録（オプション）
      if (finalOptions.autoRegisterFiles) {
        const registrationResult = await this.projectAutoSetupService.registerAllFiles(
          projectRootAbsolutePath,
          {
            excludePatterns: finalOptions.excludePatterns,
            fileTypeDetection: finalOptions.fileTypeDetection,
            createReadmeIfMissing: !finalOptions.createDirectoryStructure, // ディレクトリ構造セットアップしてない場合のみ作成
          },
        );

        if (!registrationResult.success) {
          return {
            success: false,
            message: `ファイル自動登録に失敗しました: ${registrationResult.message}`,
            projectRootPath: projectRootAbsolutePath,
            processedDirectories: results.processedDirectories,
            createdFiles: results.createdFiles,
            errors: [registrationResult.message],
          };
        }

        results.registeredFiles = registrationResult.registeredFiles;
        results.skippedFiles = registrationResult.skippedFiles;
      }

      // 成功メッセージを生成
      const messageParts: string[] = [];
      messageParts.push('既存Dialogoiプロジェクトのセットアップが完了しました');

      if (finalOptions.createDirectoryStructure) {
        messageParts.push(
          `ディレクトリ構造を設定しました（${results.processedDirectories}ディレクトリ、${results.createdFiles}ファイル作成）`,
        );
      }

      if (finalOptions.autoRegisterFiles) {
        messageParts.push(
          `ファイルを自動登録しました（${results.registeredFiles}ファイル登録、${results.skippedFiles}ファイルスキップ）`,
        );
      }

      results.message = messageParts.join('\n');
      return results;
    } catch (error) {
      return {
        success: false,
        message: `既存プロジェクトのセットアップ中に予期しないエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        projectRootPath: projectRootAbsolutePath,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}
