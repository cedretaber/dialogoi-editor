import { FileOperationResult } from './CoreFileService.js';
import {
  MetaYaml,
  DialogoiTreeItem,
  hasTagsProperty,
  hasReferencesProperty,
} from '../utils/MetaYamlUtils.js';
import { MetaYamlService } from './MetaYamlService.js';
import * as path from 'path';

/**
 * メタデータ専用操作を担当するサービス
 * タグ・参照・meta.yaml操作を提供（ファイルシステム変更なし）
 */
export class MetadataService {
  constructor(private metaYamlService: MetaYamlService) {}

  /**
   * ファイルにタグを追加する
   */
  async addTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    try {
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasTagsProperty(fileItem)) {
          if (!fileItem.tags.includes(tag)) {
            fileItem.tags.push(tag);
          }
        } else {
          throw new Error(`ファイル ${fileName} はタグをサポートしていません。`);
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
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasTagsProperty(fileItem)) {
          fileItem.tags = fileItem.tags.filter((t) => t !== tagId);
        } else {
          throw new Error(`ファイル ${fileName} はタグをサポートしていません。`);
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
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasTagsProperty(fileItem)) {
          fileItem.tags = tags;
        } else {
          throw new Error(`ファイル ${fileName} はタグをサポートしていません。`);
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
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasReferencesProperty(fileItem)) {
          if (!fileItem.references.includes(targetPath)) {
            fileItem.references.push(targetPath);
          }
        } else {
          throw new Error(`ファイル ${fileName} は参照をサポートしていません。`);
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
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasReferencesProperty(fileItem)) {
          fileItem.references = fileItem.references.filter((ref) => ref !== targetPath);
        } else {
          throw new Error(`ファイル ${fileName} は参照をサポートしていません。`);
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
      const result = await this.updateMetaYamlInternal(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`ファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem && hasReferencesProperty(fileItem)) {
          fileItem.references = references;
        } else {
          throw new Error(`ファイル ${fileName} は参照をサポートしていません。`);
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
    return this.updateMetaYamlInternal(dirPath, updateFn);
  }

  /**
   * meta.yamlファイルを更新する内部メソッド
   * @param dirPath ディレクトリパス
   * @param updateFunction 更新関数
   * @returns 更新結果
   */
  private async updateMetaYamlInternal(
    dirPath: string,
    updateFunction: (meta: MetaYaml) => MetaYaml,
  ): Promise<FileOperationResult> {
    try {
      // .dialogoi-meta.yamlを読み込み
      const meta = await this.metaYamlService.loadMetaYamlAsync(dirPath);
      if (meta === null) {
        return {
          success: false,
          message: '.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // .dialogoi-meta.yamlを保存
      const saveResult = await this.metaYamlService.saveMetaYamlAsync(dirPath, updatedMeta);
      if (!saveResult) {
        return {
          success: false,
          message: '.dialogoi-meta.yamlの保存に失敗しました。',
        };
      }

      // パスを更新したアイテムを返す
      const updatedItems = updatedMeta.files.map((file: DialogoiTreeItem) => ({
        ...file,
        path: path.join(dirPath, file.name),
      }));

      return {
        success: true,
        message: '.dialogoi-meta.yamlを更新しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `.dialogoi-meta.yaml更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * プロジェクト全体の参照を更新する
   * TODO: 将来的にReferenceManagerとの連携を実装予定
   */
  updateAllReferences(
    _fileAbsolutePath: string,
    _manualReferences: string[] = [],
  ): FileOperationResult {
    // 現在は空の実装（FileOperationServiceと同じ状態）
    return {
      success: true,
      message: '参照を更新しました。',
    };
  }
}
