import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { FileTypeDetectionService } from './FileTypeDetectionService.js';
import { DialogoiTreeItem, MetaYamlUtils } from '../utils/MetaYamlUtils.js';
import * as path from 'path';

/**
 * プロジェクト自動セットアップの結果
 */
export interface SetupResult {
  success: boolean;
  message: string;
  processedDirectories: number;
  createdFiles: number;
  error?: Error;
}

/**
 * ファイル登録の結果
 */
export interface RegistrationResult {
  success: boolean;
  message: string;
  registeredFiles: number;
  skippedFiles: number;
  error?: Error;
}

/**
 * ディレクトリセットアップオプション
 */
export interface DirectorySetupOptions {
  createMetaYaml: boolean; // .dialogoi-meta.yamlの自動生成
  createReadme: boolean; // READMEファイルの自動生成
  overwriteExisting: boolean; // 既存ファイルの上書き許可（基本false）
  readmeTemplate: 'minimal' | 'detailed';
}

/**
 * ファイル登録オプション
 */
export interface FileRegistrationOptions {
  excludePatterns: string[]; // 除外パターン
  fileTypeDetection: 'extension'; // 種別判定方法（現在は拡張子ベースのみ）
  createReadmeIfMissing: boolean; // README自動生成
}

/**
 * プロジェクト自動セットアップサービス
 * プロジェクト作成時の全ファイル自動登録機能を提供
 */
export class ProjectAutoSetupService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private dialogoiYamlService: DialogoiYamlService,
    private fileTypeDetectionService: FileTypeDetectionService,
  ) {}

  /**
   * プロジェクトルートから再帰的にファイルをスキャンし、
   * 各ディレクトリに.dialogoi-meta.yamlを配置
   */
  async setupProjectStructure(
    projectRoot: string,
    options?: Partial<DirectorySetupOptions>,
  ): Promise<SetupResult> {
    const defaultOptions: DirectorySetupOptions = {
      createMetaYaml: true,
      createReadme: true,
      overwriteExisting: false,
      readmeTemplate: 'minimal',
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Dialogoiプロジェクトかどうか確認
      const isDialogoiProject =
        await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRoot);
      if (!isDialogoiProject) {
        return {
          success: false,
          message: `Dialogoiプロジェクトではありません: ${projectRoot}`,
          processedDirectories: 0,
          createdFiles: 0,
        };
      }

      // 除外パターンを取得
      const excludePatterns = await this.getExcludePatterns(projectRoot);

      // 再帰的にディレクトリを処理
      const result = await this.processDirectoryRecursive(
        projectRoot,
        projectRoot,
        excludePatterns,
        finalOptions,
      );

      return {
        success: true,
        message: `プロジェクト構造のセットアップが完了しました（${result.processedDirectories}ディレクトリ、${result.createdFiles}ファイル作成）`,
        processedDirectories: result.processedDirectories,
        createdFiles: result.createdFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `プロジェクト構造のセットアップに失敗しました: ${projectRoot}`,
        processedDirectories: 0,
        createdFiles: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 全ファイルを自動的に管理対象に登録
   */
  async registerAllFiles(
    projectRoot: string,
    options?: Partial<FileRegistrationOptions>,
  ): Promise<RegistrationResult> {
    const defaultOptions: FileRegistrationOptions = {
      excludePatterns: [],
      fileTypeDetection: 'extension',
      createReadmeIfMissing: false,
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      // Dialogoiプロジェクトかどうか確認
      const isDialogoiProject =
        await this.dialogoiYamlService.isDialogoiProjectRootAsync(projectRoot);
      if (!isDialogoiProject) {
        return {
          success: false,
          message: `Dialogoiプロジェクトではありません: ${projectRoot}`,
          registeredFiles: 0,
          skippedFiles: 0,
        };
      }

      // 除外パターンを取得（オプション + デフォルト）
      const defaultExcludePatterns = await this.getExcludePatterns(projectRoot);
      const excludePatterns = [...defaultExcludePatterns, ...finalOptions.excludePatterns];

      // 再帰的にファイルを登録
      const result = await this.registerFilesRecursive(
        projectRoot,
        projectRoot,
        excludePatterns,
        finalOptions,
      );

      return {
        success: true,
        message: `ファイル登録が完了しました（${result.registeredFiles}ファイル登録、${result.skippedFiles}ファイルスキップ）`,
        registeredFiles: result.registeredFiles,
        skippedFiles: result.skippedFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル登録に失敗しました: ${projectRoot}`,
        registeredFiles: 0,
        skippedFiles: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * READMEファイル名を取得
   */
  private async getReadmeFilename(projectRoot: string): Promise<string> {
    try {
      const dialogoiYaml = await this.dialogoiYamlService.loadDialogoiYamlAsync(projectRoot);
      const readmeFilename = dialogoiYaml?.project_settings?.readme_filename;
      return readmeFilename !== null && readmeFilename !== undefined && readmeFilename !== ''
        ? readmeFilename
        : 'README.md';
    } catch {
      return 'README.md';
    }
  }

  /**
   * 除外パターンを取得
   */
  private async getExcludePatterns(projectRoot: string): Promise<string[]> {
    try {
      return await this.dialogoiYamlService.getExcludePatternsAsync(projectRoot);
    } catch {
      // エラーの場合はデフォルトパターンを返す
      return [
        '.*', // 隠しファイル・ディレクトリ
        '*.tmp', // 一時ファイル
        'node_modules', // Node.js依存関係
        '.git', // Git管理ファイル
      ];
    }
  }

  /**
   * ディレクトリを再帰的に処理してmeta.yamlとREADMEを作成
   */
  private async processDirectoryRecursive(
    currentDir: string,
    projectRoot: string,
    excludePatterns: string[],
    options: DirectorySetupOptions,
  ): Promise<{ processedDirectories: number; createdFiles: number }> {
    let processedDirectories = 0;
    let createdFiles = 0;

    try {
      const directoryUri = this.fileRepository.createDirectoryUri(currentDir);
      if (!(await this.fileRepository.existsAsync(directoryUri))) {
        return { processedDirectories, createdFiles };
      }

      // 現在のディレクトリが除外対象でないかチェック
      const relativePath = path.relative(projectRoot, currentDir);
      if (relativePath && this.isExcluded(path.basename(currentDir), excludePatterns)) {
        return { processedDirectories, createdFiles };
      }

      // .dialogoi-meta.yamlの作成
      if (options.createMetaYaml) {
        const metaYamlPath = path.join(currentDir, '.dialogoi-meta.yaml');
        const metaYamlUri = this.fileRepository.createFileUri(metaYamlPath);

        if (!options.overwriteExisting && (await this.fileRepository.existsAsync(metaYamlUri))) {
          // 既存ファイルがある場合はスキップ
        } else {
          // 新しい.dialogoi-meta.yamlを作成
          const readmeFilename = await this.getReadmeFilename(projectRoot);
          const metaYaml = MetaYamlUtils.createMetaYaml(readmeFilename);
          if (await this.metaYamlService.saveMetaYamlAsync(currentDir, metaYaml)) {
            createdFiles++;
          }
        }
      }

      // READMEファイルの作成
      if (options.createReadme) {
        const readmeCreated = await this.createReadmeIfMissing(currentDir, options);
        if (readmeCreated) {
          createdFiles++;
        }
      }

      processedDirectories++;

      // サブディレクトリを再帰的に処理
      const items = await this.fileRepository.readdirAsync(directoryUri);
      for (const item of items) {
        if (item.isDirectory()) {
          const subDirPath = path.join(currentDir, item.name);
          const subResult = await this.processDirectoryRecursive(
            subDirPath,
            projectRoot,
            excludePatterns,
            options,
          );
          processedDirectories += subResult.processedDirectories;
          createdFiles += subResult.createdFiles;
        }
      }

      return { processedDirectories, createdFiles };
    } catch (error) {
      console.warn(`ディレクトリ処理エラー: ${currentDir}`, error);
      return { processedDirectories, createdFiles };
    }
  }

  /**
   * ファイルを再帰的に登録
   */
  private async registerFilesRecursive(
    currentDir: string,
    projectRoot: string,
    excludePatterns: string[],
    options: FileRegistrationOptions,
  ): Promise<{ registeredFiles: number; skippedFiles: number }> {
    let registeredFiles = 0;
    let skippedFiles = 0;

    try {
      const directoryUri = this.fileRepository.createDirectoryUri(currentDir);
      if (!(await this.fileRepository.existsAsync(directoryUri))) {
        return { registeredFiles, skippedFiles };
      }

      // 現在のディレクトリが除外対象でないかチェック
      const relativePath = path.relative(projectRoot, currentDir);
      if (relativePath && this.isExcluded(path.basename(currentDir), excludePatterns)) {
        return { registeredFiles, skippedFiles };
      }

      // READMEファイルの作成（必要な場合）
      if (options.createReadmeIfMissing) {
        await this.createReadmeIfMissing(currentDir, {
          createReadme: true,
          readmeTemplate: 'minimal',
          overwriteExisting: false,
        });
      }

      // 現在のディレクトリのmeta.yamlを読み込み
      const metaYaml = await this.metaYamlService.loadMetaYamlAsync(currentDir);
      if (!metaYaml) {
        // meta.yamlがない場合はスキップ（setupProjectStructureで作成済みのはず）
        console.warn(`meta.yamlが見つかりません: ${currentDir}`);
        return { registeredFiles, skippedFiles };
      }

      // ディレクトリ内のファイルを取得
      const items = await this.fileRepository.readdirAsync(directoryUri);
      let hasChanges = false;

      for (const item of items) {
        if (item.isFile()) {
          const fileName = item.name;
          const filePath = path.join(currentDir, fileName);

          // 除外チェック（除外パターンを先に確認）
          const isExcludedByPattern = this.isExcluded(fileName, excludePatterns);
          const isManagementFile = await this.isManagementFile(fileName, projectRoot);

          if (isExcludedByPattern || isManagementFile) {
            skippedFiles++;
            continue;
          }

          // 既に管理対象かチェック
          const existingEntry = metaYaml.files.find((f) => f.name === fileName);
          if (existingEntry) {
            skippedFiles++;
            continue;
          }

          // ファイル種別を自動判定
          const fileType = this.fileTypeDetectionService.detectFileType(filePath);

          // meta.yamlに追加
          const newEntry: DialogoiTreeItem = {
            name: fileName,
            type: fileType,
            path: filePath,
          };

          metaYaml.files.push(newEntry);
          registeredFiles++;
          hasChanges = true;
        } else if (item.isDirectory()) {
          const dirName = item.name;
          const subDirPath = path.join(currentDir, dirName);

          // 除外チェック（ディレクトリに対して）
          const isDirExcluded = this.isExcluded(dirName, excludePatterns);

          if (!isDirExcluded) {
            // サブディレクトリを親ディレクトリのfilesに登録
            const existingDirEntry = metaYaml.files.find((f) => f.name === dirName);
            if (!existingDirEntry) {
              const newDirEntry: DialogoiTreeItem = {
                name: dirName,
                type: 'subdirectory',
                path: subDirPath,
              };

              metaYaml.files.push(newDirEntry);
              hasChanges = true;
            }

            // サブディレクトリを再帰的に処理
            const subResult = await this.registerFilesRecursive(
              subDirPath,
              projectRoot,
              excludePatterns,
              options,
            );
            registeredFiles += subResult.registeredFiles;
            skippedFiles += subResult.skippedFiles;
          } else {
            skippedFiles++;
          }
        }
      }

      // 変更があった場合はmeta.yamlを保存
      if (hasChanges) {
        await this.metaYamlService.saveMetaYamlAsync(currentDir, metaYaml);
      }

      return { registeredFiles, skippedFiles };
    } catch (error) {
      console.warn(`ファイル登録エラー: ${currentDir}`, error);
      return { registeredFiles, skippedFiles };
    }
  }

  /**
   * READMEファイルが存在しない場合に作成
   */
  private async createReadmeIfMissing(
    directoryPath: string,
    options: Pick<DirectorySetupOptions, 'createReadme' | 'readmeTemplate' | 'overwriteExisting'>,
  ): Promise<boolean> {
    if (!options.createReadme) {
      return false;
    }

    try {
      // 既存のREADMEファイルをチェック
      const readmeFiles = ['README.md', 'readme.md', 'Readme.md'];
      for (const readmeFile of readmeFiles) {
        const readmePath = path.join(directoryPath, readmeFile);
        const readmeUri = this.fileRepository.createFileUri(readmePath);
        if (await this.fileRepository.existsAsync(readmeUri)) {
          if (!options.overwriteExisting) {
            return false; // 既存ファイルがあり、上書きしない
          }
        }
      }

      // READMEファイルを作成
      const readmePath = path.join(directoryPath, 'README.md');
      const readmeUri = this.fileRepository.createFileUri(readmePath);

      const directoryName = path.basename(directoryPath);
      const content = this.generateReadmeContent(directoryName, options.readmeTemplate);

      await this.fileRepository.writeFileAsync(readmeUri, content);
      return true;
    } catch (error) {
      console.warn(`README作成エラー: ${directoryPath}`, error);
      return false;
    }
  }

  /**
   * READMEファイルの内容を生成
   */
  private generateReadmeContent(directoryName: string, template: 'minimal' | 'detailed'): string {
    if (template === 'detailed') {
      return `# ${directoryName}

## 概要

このディレクトリの説明をここに記述してください。

## ファイル一覧

- **主要ファイル**: 重要なファイルの説明
- **サポートファイル**: 補助的なファイルの説明

## 関連情報

関連する情報やリンクをここに記述してください。

---
*このファイルはDialogoi Editorによって自動生成されました*
`;
    } else {
      return `# ${directoryName}

このディレクトリの説明をここに記述してください。

---
*このファイルはDialogoi Editorによって自動生成されました*
`;
    }
  }

  /**
   * ファイルが除外対象かどうかをチェック
   */
  private isExcluded(fileName: string, excludePatterns: string[]): boolean {
    return this.fileTypeDetectionService.isExcluded(fileName, excludePatterns);
  }

  /**
   * 管理ファイルかどうかをチェック
   */
  private async isManagementFile(fileName: string, projectRoot: string): Promise<boolean> {
    const isReadme = await this.isReadmeFile(fileName, projectRoot);
    return (
      fileName === '.dialogoi-meta.yaml' ||
      fileName === 'dialogoi.yaml' ||
      fileName.endsWith('.comments.yaml') ||
      isReadme
    );
  }

  /**
   * READMEファイルかどうかを判定
   */
  private async isReadmeFile(fileName: string, projectRoot: string): Promise<boolean> {
    try {
      // dialogoi.yamlからREADMEファイル名設定を取得
      const dialogoiYaml = await this.dialogoiYamlService.loadDialogoiYamlAsync(projectRoot);
      const configuredReadmeFilename = dialogoiYaml?.project_settings?.readme_filename;

      if (
        configuredReadmeFilename !== null &&
        configuredReadmeFilename !== undefined &&
        configuredReadmeFilename !== ''
      ) {
        // 設定されたREADMEファイル名と完全一致するかチェック
        return fileName === configuredReadmeFilename;
      }

      // 設定がない場合はデフォルトのREADMEパターンで判定
      const lowerFileName = fileName.toLowerCase();
      return (
        lowerFileName === 'readme.md' ||
        lowerFileName === 'readme.txt' ||
        lowerFileName === 'readme' ||
        lowerFileName.startsWith('readme.')
      );
    } catch {
      // エラーの場合はデフォルトパターンで判定
      const lowerFileName = fileName.toLowerCase();
      return (
        lowerFileName === 'readme.md' ||
        lowerFileName === 'readme.txt' ||
        lowerFileName === 'readme' ||
        lowerFileName.startsWith('readme.')
      );
    }
  }
}
