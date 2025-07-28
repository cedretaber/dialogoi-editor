import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { DialogoiTemplateService } from './DialogoiTemplateService.js';
import { FileTypeDetector } from '../utils/FileTypeDetector.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * プロジェクト新規作成の結果
 */
export interface ProjectCreationResult {
  success: boolean;
  message: string;
  projectPath?: string;
  createdFiles?: string[];
  skippedFiles?: string[];
  errors?: string[];
}

/**
 * プロジェクト新規作成オプション
 */
export interface ProjectCreationOptions {
  title: string;
  author: string;
  tags?: string[];
  overwriteDialogoiYaml?: boolean;
  overwriteMetaYaml?: boolean;
  excludePatterns?: string[];
  readmeFilename?: string;
}

/**
 * 小説プロジェクトの新規作成を管理するサービス
 */
export class ProjectCreationService {
  constructor(
    private fileRepository: FileRepository,
    private dialogoiYamlService: DialogoiYamlService,
    private templateService: DialogoiTemplateService,
  ) {}

  /**
   * 新しい小説プロジェクトを作成
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param options 作成オプション
   * @returns 作成結果
   */
  async createProject(
    projectRootAbsolutePath: string,
    options: ProjectCreationOptions,
  ): Promise<ProjectCreationResult> {
    const result: ProjectCreationResult = {
      success: false,
      message: '',
      projectPath: projectRootAbsolutePath,
      createdFiles: [],
      skippedFiles: [],
      errors: [],
    };

    try {
      // 1. プロジェクトディレクトリの存在確認・作成
      const projectUri = this.fileRepository.createDirectoryUri(projectRootAbsolutePath);
      if (!(await this.fileRepository.existsAsync(projectUri))) {
        await this.fileRepository.createDirectoryAsync(projectUri);
        result.createdFiles?.push(projectRootAbsolutePath);
      }

      // 2. 既存のdialogoi.yamlの確認
      const existingProject =
        await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRootAbsolutePath);
      if (existingProject === true && options.overwriteDialogoiYaml !== true) {
        result.message = 'Dialogoiプロジェクトが既に存在します。上書きが許可されていません。';
        return result;
      }

      // 3. dialogoi.yamlの作成
      const dialogoiResult = await this.createDialogoiYaml(projectRootAbsolutePath, options);
      if (!dialogoiResult.success) {
        result.message = dialogoiResult.message;
        result.errors?.push(...(dialogoiResult.errors || []));
        return result;
      }
      result.createdFiles?.push(...(dialogoiResult.createdFiles || []));

      // 4. 既存ファイルの再帰的スキャンと.dialogoi-meta.yaml生成
      const scanResult = await this.scanAndCreateMetaYaml(projectRootAbsolutePath, options);
      if (!scanResult.success) {
        result.message = scanResult.message;
        result.errors?.push(...(scanResult.errors || []));
        return result;
      }
      result.createdFiles?.push(...(scanResult.createdFiles || []));
      result.skippedFiles?.push(...(scanResult.skippedFiles || []));

      result.success = true;
      result.message = `プロジェクト「${options.title}」を正常に作成しました。`;
      return result;
    } catch (error) {
      result.message = `プロジェクト作成エラー: ${error instanceof Error ? error.message : String(error)}`;
      result.errors?.push(result.message);
      return result;
    }
  }

  /**
   * dialogoi.yamlファイルを作成
   */
  private async createDialogoiYaml(
    projectRootAbsolutePath: string,
    options: ProjectCreationOptions,
  ): Promise<ProjectCreationResult> {
    const result: ProjectCreationResult = {
      success: false,
      message: '',
      createdFiles: [],
      errors: [],
    };

    try {
      // テンプレートから新しいDialogoiYamlを作成
      const dialogoiYaml = await this.templateService.createProjectFromTemplate(
        options.title,
        options.author,
        options.tags,
      );

      if (dialogoiYaml === null) {
        result.message = 'dialogoi.yamlテンプレートの読み込みに失敗しました。';
        return result;
      }

      // オプションからの設定を適用
      if (options.excludePatterns) {
        if (!dialogoiYaml.project_settings) {
          dialogoiYaml.project_settings = {};
        }
        dialogoiYaml.project_settings.exclude_patterns = options.excludePatterns;
      }

      if (options.readmeFilename !== undefined && options.readmeFilename !== '') {
        if (!dialogoiYaml.project_settings) {
          dialogoiYaml.project_settings = {};
        }
        dialogoiYaml.project_settings.readme_filename = options.readmeFilename;
      }

      // dialogoi.yamlを保存
      const saveSuccess = await this.dialogoiYamlService.saveDialogoiYamlAsync(
        projectRootAbsolutePath,
        dialogoiYaml,
      );

      if (!saveSuccess) {
        result.message = 'dialogoi.yamlの保存に失敗しました。';
        return result;
      }

      result.success = true;
      result.message = 'dialogoi.yamlを作成しました。';
      result.createdFiles?.push(path.join(projectRootAbsolutePath, 'dialogoi.yaml'));
      return result;
    } catch (error) {
      result.message = `dialogoi.yaml作成エラー: ${error instanceof Error ? error.message : String(error)}`;
      result.errors?.push(result.message);
      return result;
    }
  }

  /**
   * 既存ファイルを再帰的にスキャンして.dialogoi-meta.yamlを生成
   */
  private async scanAndCreateMetaYaml(
    projectRootAbsolutePath: string,
    options: ProjectCreationOptions,
  ): Promise<ProjectCreationResult> {
    const result: ProjectCreationResult = {
      success: false,
      message: '',
      createdFiles: [],
      skippedFiles: [],
      errors: [],
    };

    try {
      // 除外パターンを取得
      const excludePatterns =
        options.excludePatterns !== undefined && options.excludePatterns.length > 0
          ? options.excludePatterns
          : await this.templateService.getDefaultExcludePatterns();
      const readmeFilename =
        options.readmeFilename !== undefined && options.readmeFilename !== ''
          ? options.readmeFilename
          : await this.templateService.getDefaultReadmeFilename();

      // 再帰的にディレクトリをスキャン
      await this.scanDirectoryRecursively(
        projectRootAbsolutePath,
        projectRootAbsolutePath,
        excludePatterns,
        readmeFilename,
        options.overwriteMetaYaml === true,
        result,
      );

      result.success = true;
      result.message = 'ディレクトリのスキャンが完了しました。';
      return result;
    } catch (error) {
      result.message = `ディレクトリスキャンエラー: ${error instanceof Error ? error.message : String(error)}`;
      result.errors?.push(result.message);
      return result;
    }
  }

  /**
   * ディレクトリを再帰的にスキャンして.dialogoi-meta.yamlを作成
   */
  private async scanDirectoryRecursively(
    currentAbsolutePath: string,
    projectRootAbsolutePath: string,
    excludePatterns: string[],
    readmeFilename: string,
    overwriteMetaYaml: boolean,
    result: ProjectCreationResult,
  ): Promise<void> {
    const currentUri = this.fileRepository.createDirectoryUri(currentAbsolutePath);

    if (!(await this.fileRepository.existsAsync(currentUri))) {
      return;
    }

    const stats = await this.fileRepository.statAsync(currentUri);
    if (!stats.isDirectory()) {
      return;
    }

    // 除外パターンをチェック
    const relativePath = path.relative(projectRootAbsolutePath, currentAbsolutePath);
    if (FileTypeDetector.isExcluded(relativePath, excludePatterns)) {
      result.skippedFiles?.push(currentAbsolutePath);
      return;
    }

    // ディレクトリ内のファイルを取得
    const entries = await this.fileRepository.readdirAsync(currentUri);
    const files: string[] = [];
    const subdirectories: string[] = [];

    for (const entry of entries) {
      const entryName = typeof entry === 'string' ? entry : entry.name;
      const entryAbsolutePath = path.join(currentAbsolutePath, entryName);
      const entryRelativePath = path.relative(projectRootAbsolutePath, entryAbsolutePath);

      // 除外パターンをチェック
      if (FileTypeDetector.isExcluded(entryRelativePath, excludePatterns)) {
        result.skippedFiles?.push(entryAbsolutePath);
        continue;
      }

      // ファイルタイプの判定のためにstatを使用
      const entryUri = this.fileRepository.createFileUri(entryAbsolutePath);
      try {
        const stat = await this.fileRepository.statAsync(entryUri);
        if (stat.isDirectory()) {
          subdirectories.push(entryAbsolutePath);
        } else if (stat.isFile()) {
          files.push(entryName);
        }
      } catch {
        // stat取得に失敗した場合は無視
        continue;
      }
    }

    // .dialogoi-meta.yamlを作成または更新
    const metaYamlAbsolutePath = path.join(currentAbsolutePath, '.dialogoi-meta.yaml');
    const metaYamlUri = this.fileRepository.createFileUri(metaYamlAbsolutePath);
    const metaYamlExists = await this.fileRepository.existsAsync(metaYamlUri);

    if (metaYamlExists === true && overwriteMetaYaml !== true) {
      result.skippedFiles?.push(metaYamlAbsolutePath);
    } else {
      const metaYaml = this.createMetaYamlFromFiles(files, subdirectories, readmeFilename);
      const yamlContent = yaml.dump(metaYaml, { flowLevel: -1, lineWidth: -1 });

      await this.fileRepository.writeFileAsync(metaYamlUri, yamlContent);
      result.createdFiles?.push(metaYamlAbsolutePath);
    }

    // サブディレクトリを再帰的にスキャン
    for (const subdirPath of subdirectories) {
      await this.scanDirectoryRecursively(
        subdirPath,
        projectRootAbsolutePath,
        excludePatterns,
        readmeFilename,
        overwriteMetaYaml,
        result,
      );
    }
  }

  /**
   * ファイルリストから.dialogoi-meta.yamlを作成
   */
  private createMetaYamlFromFiles(
    files: string[],
    subdirectories: string[],
    readmeFilename: string,
  ): MetaYaml {
    const metaYaml: MetaYaml = {
      readme: readmeFilename,
      files: [],
    };

    // ファイルを処理
    for (const fileName of files) {
      // .dialogoi-meta.yaml、dialogoi.yaml、READMEファイルはスキップ
      if (
        fileName === '.dialogoi-meta.yaml' ||
        fileName === 'dialogoi.yaml' ||
        fileName === readmeFilename
      ) {
        continue;
      }

      // ファイル種別の自動判定
      const fileType = FileTypeDetector.detectFileType(fileName);
      const relativeFilePath = fileName; // 同じディレクトリ内なのでファイル名のみ

      metaYaml.files.push({
        name: fileName,
        type: fileType,
        path: relativeFilePath,
      });
    }

    // サブディレクトリを処理
    for (const subdirAbsolutePath of subdirectories) {
      const subdirName = path.basename(subdirAbsolutePath);
      const relativeDirPath = subdirName; // サブディレクトリのパスは同じディレクトリ内なのでディレクトリ名のみ
      metaYaml.files.push({
        name: subdirName,
        type: 'subdirectory',
        path: relativeDirPath,
      });
    }

    return metaYaml;
  }
}
