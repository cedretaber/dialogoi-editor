import { FileOperationService, FileOperationResult } from './FileOperationService.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';

/**
 * メタデータ専用操作を担当するサービス
 * タグ・参照・meta.yaml操作を提供（ファイルシステム変更なし）
 */
export class MetadataService {
  constructor(private fileOperationService: FileOperationService) {}

  /**
   * ファイルにタグを追加する
   */
  async addTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && fileItem.tags) {
          if (!fileItem.tags.includes(tag)) {
            fileItem.tags.push(tag);
          }
        } else if (fileItem) {
          fileItem.tags = [tag];
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `タグ追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルからタグを削除する
   */
  async removeTag(dirPath: string, fileName: string, tagId: string): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && fileItem.tags) {
          fileItem.tags = fileItem.tags.filter((t) => t !== tagId);
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `タグ削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルのタグを設定する（完全置換）
   */
  async setTags(dirPath: string, fileName: string, tags: string[]): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem) {
          fileItem.tags = tags;
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `タグ設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルに参照を追加する
   */
  async addReference(
    dirPath: string,
    fileName: string,
    targetPath: string,
  ): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && fileItem.references) {
          if (!fileItem.references.includes(targetPath)) {
            fileItem.references.push(targetPath);
          }
        } else if (fileItem) {
          fileItem.references = [targetPath];
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `参照追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルから参照を削除する
   */
  async removeReference(
    dirPath: string,
    fileName: string,
    targetPath: string,
  ): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && fileItem.references) {
          fileItem.references = fileItem.references.filter((ref) => ref !== targetPath);
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `参照削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの参照を設定する（完全置換）
   */
  async setReferences(
    dirPath: string,
    fileName: string,
    references: string[],
  ): Promise<FileOperationResult> {
    try {
      const result = await this.fileOperationService.updateMetaYamlAsync(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem) {
          fileItem.references = references;
        }
        return meta;
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `参照設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * メタデータを更新する汎用メソッド
   */
  async updateMetaYaml(
    dirPath: string,
    updateFn: (meta: MetaYaml) => MetaYaml,
  ): Promise<FileOperationResult> {
    return this.fileOperationService.updateMetaYamlAsync(dirPath, updateFn);
  }

  /**
   * プロジェクト全体の参照を更新する
   */
  updateAllReferences(
    fileAbsolutePath: string,
    manualReferences: string[] = [],
  ): FileOperationResult {
    try {
      this.fileOperationService.updateAllReferences(fileAbsolutePath, manualReferences);
      return {
        success: true,
        message: '参照を更新しました。',
      };
    } catch (error) {
      return {
        success: false,
        message: `参照更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
