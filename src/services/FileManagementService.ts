import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import * as path from 'path';

/**
 * ファイル管理操作の結果
 */
export interface FileManagementResult {
  success: boolean;
  message: string;
  error?: Error;
}

/**
 * ファイル管理サービス
 * 管理対象外ファイルの追加、欠損ファイルの処理等を担当
 */
export class FileManagementService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

  /**
   * 管理対象外ファイルを管理対象に追加
   * @param absoluteFilePath 追加するファイルの絶対パス
   * @param fileType ファイル種別（content/setting）
   * @returns 処理結果
   */
  async addFileToManagement(
    absoluteFilePath: string,
    fileType: 'content' | 'setting',
  ): Promise<FileManagementResult> {
    try {
      // ファイルの存在確認
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return {
          success: false,
          message: `ファイルが存在しません: ${absoluteFilePath}`,
        };
      }

      // ディレクトリパスを取得
      const directoryPath = path.dirname(absoluteFilePath);
      const fileName = path.basename(absoluteFilePath);

      // 既存のmeta.yamlを読み込み
      const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
      if (!metaYaml) {
        return {
          success: false,
          message: `管理ファイルが見つかりません: ${directoryPath}/.dialogoi-meta.yaml`,
        };
      }

      // 既に管理対象かチェック
      const existingEntry = metaYaml.files.find((file) => file.name === fileName);
      if (existingEntry) {
        return {
          success: false,
          message: `ファイルは既に管理対象です: ${fileName}`,
        };
      }

      // 新しいエントリを作成
      const newEntry: DialogoiTreeItem = {
        name: fileName,
        type: fileType,
        path: absoluteFilePath,
      };

      // meta.yamlに追加
      metaYaml.files.push(newEntry);

      // meta.yamlを保存
      await this.metaYamlService.saveMetaYamlAsync(directoryPath, metaYaml);

      return {
        success: true,
        message: `ファイルを管理対象に追加しました: ${fileName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル追加に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 欠損ファイルを管理対象から削除
   * @param absoluteFilePath 削除するファイルの絶対パス
   * @returns 処理結果
   */
  async removeFileFromManagement(absoluteFilePath: string): Promise<FileManagementResult> {
    try {
      // ディレクトリパスを取得
      const directoryPath = path.dirname(absoluteFilePath);
      const fileName = path.basename(absoluteFilePath);

      // 既存のmeta.yamlを読み込み
      const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
      if (!metaYaml) {
        return {
          success: false,
          message: `管理ファイルが見つかりません: ${directoryPath}/.dialogoi-meta.yaml`,
        };
      }

      // 対象ファイルを見つける
      const entryIndex = metaYaml.files.findIndex((file) => file.name === fileName);
      if (entryIndex === -1) {
        return {
          success: false,
          message: `ファイルは管理対象ではありません: ${fileName}`,
        };
      }

      // meta.yamlから削除
      metaYaml.files.splice(entryIndex, 1);

      // meta.yamlを保存
      await this.metaYamlService.saveMetaYamlAsync(directoryPath, metaYaml);

      return {
        success: true,
        message: `ファイルを管理対象から削除しました: ${fileName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル削除に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 欠損ファイルを作成
   * @param absoluteFilePath 作成するファイルの絶対パス
   * @param template ファイルテンプレート（省略時はデフォルト）
   * @returns 処理結果
   */
  async createMissingFile(
    absoluteFilePath: string,
    template?: string,
  ): Promise<FileManagementResult> {
    try {
      // ファイルの存在確認（既に存在する場合はエラー）
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (await this.fileRepository.existsAsync(fileUri)) {
        return {
          success: false,
          message: `ファイルは既に存在します: ${absoluteFilePath}`,
        };
      }

      // ディレクトリパスを取得して、ディレクトリが存在することを確認
      const directoryPath = path.dirname(absoluteFilePath);
      const directoryUri = this.fileRepository.createDirectoryUri(directoryPath);
      if (!(await this.fileRepository.existsAsync(directoryUri))) {
        return {
          success: false,
          message: `親ディレクトリが存在しません: ${directoryPath}`,
        };
      }

      // テンプレート内容を決定
      const content =
        template !== undefined && template !== ''
          ? template
          : this.generateDefaultContent(absoluteFilePath);

      // ファイルを作成
      await this.fileRepository.writeFileAsync(fileUri, content);

      return {
        success: true,
        message: `ファイルを作成しました: ${path.basename(absoluteFilePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル作成に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * デフォルトのファイル内容を生成
   * @param absoluteFilePath ファイルパス
   * @returns デフォルト内容
   */
  private generateDefaultContent(absoluteFilePath: string): string {
    const fileName = path.basename(absoluteFilePath);
    const extension = path.extname(absoluteFilePath);

    if (extension === '.md') {
      return `# ${fileName}\n\n<!-- このファイルの説明をここに記述してください -->\n`;
    } else if (extension === '.txt') {
      return `${fileName}\n\n（このファイルの内容をここに記述してください）\n`;
    } else {
      return `// ${fileName}\n\n`;
    }
  }
}
