import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewSummary } from '../models/Review.js';
import { FileOperationService, DirectoryEntry } from '../interfaces/FileOperationService.js';

export interface DialogoiTreeItem {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;
  hash?: string;
  tags?: string[];
  references?: string[];
  reviews?: string;
  review_count?: {
    open: number;
    in_progress?: number;
    resolved?: number;
    dismissed?: number;
  };
  glossary?: boolean;
  character?: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name?: string;
  };
  foreshadowing?: {
    start: string;
    goal: string;
  };
}

export interface MetaYaml {
  readme?: string;
  files: DialogoiTreeItem[];
}

export class MetaYamlUtils {
  static parseMetaYaml(content: string): MetaYaml | null {
    try {
      const meta = yaml.load(content) as MetaYaml;
      if (meta === null || meta === undefined || meta.files === undefined) {
        return null;
      }
      return meta;
    } catch (error) {
      console.error('meta.yaml の解析エラー:', error);
      return null;
    }
  }

  static loadMetaYaml(dirAbsolutePath: string, fileOperationService?: FileOperationService): MetaYaml | null {
    const metaAbsolutePath = path.join(dirAbsolutePath, 'meta.yaml');

    try {
      if (fileOperationService) {
        const metaUri = fileOperationService.createFileUri(metaAbsolutePath);
        if (!fileOperationService.existsSync(metaUri)) {
          return null;
        }
        const metaContent = fileOperationService.readFileSync(metaUri, 'utf8');
        return this.parseMetaYaml(metaContent);
      } else {
        // 後方互換性のためのフォールバック（一時的）
        const fs = require('fs');
        if (!fs.existsSync(metaAbsolutePath)) {
          return null;
        }
        const metaContent = fs.readFileSync(metaAbsolutePath, 'utf8');
        return this.parseMetaYaml(metaContent);
      }
    } catch (error) {
      console.error('meta.yaml の読み込みエラー:', error);
      return null;
    }
  }

  static getReadmeFilePath(dirAbsolutePath: string, fileOperationService?: FileOperationService): string | null {
    const meta = this.loadMetaYaml(dirAbsolutePath, fileOperationService);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeAbsolutePath = path.join(dirAbsolutePath, meta.readme);
    if (fileOperationService) {
      const readmeUri = fileOperationService.createFileUri(readmeAbsolutePath);
      if (fileOperationService.existsSync(readmeUri)) {
        return readmeAbsolutePath;
      }
    } else {
      // 後方互換性のためのフォールバック（一時的）
      const fs = require('fs');
      if (fs.existsSync(readmeAbsolutePath)) {
        return readmeAbsolutePath;
      }
    }

    return null;
  }

  static findNovelRoot(workspaceRootAbsolutePath: string, fileOperationService?: FileOperationService): string | null {
    const findDialogoiYaml = (dirAbsolutePath: string): string | null => {
      if (fileOperationService) {
        const dirUri = fileOperationService.createFileUri(dirAbsolutePath);
        const items = fileOperationService.readdirSync(dirUri, { withFileTypes: true }) as DirectoryEntry[];

        for (const item of items) {
          const fullAbsolutePath = path.join(dirAbsolutePath, item.name);
          if (item.isFile() && item.name === 'dialogoi.yaml') {
            return dirAbsolutePath;
          } else if (item.isDirectory()) {
            const result = findDialogoiYaml(fullAbsolutePath);
            if (result !== null) {
              return result;
            }
          }
        }
      } else {
        // 後方互換性のためのフォールバック（一時的）
        const fs = require('fs');
        const items = fs.readdirSync(dirAbsolutePath, { withFileTypes: true });

        for (const item of items) {
          const fullAbsolutePath = path.join(dirAbsolutePath, item.name);
          if (item.isFile() && item.name === 'dialogoi.yaml') {
            return dirAbsolutePath;
          } else if (item.isDirectory()) {
            const result = findDialogoiYaml(fullAbsolutePath);
            if (result !== null) {
              return result;
            }
          }
        }
      }
      return null;
    };

    return findDialogoiYaml(workspaceRootAbsolutePath);
  }

  static validateDialogoiTreeItem(item: DialogoiTreeItem): string[] {
    const errors: string[] = [];

    if (!item.name) {
      errors.push('name フィールドは必須です');
    }

    if (!['content', 'setting', 'subdirectory'].includes(item.type)) {
      errors.push(
        'type フィールドは content, setting, subdirectory のいずれかである必要があります',
      );
    }

    if (item.tags && !Array.isArray(item.tags)) {
      errors.push('tags フィールドは配列である必要があります');
    }

    if (item.references && !Array.isArray(item.references)) {
      errors.push('references フィールドは配列である必要があります');
    }

    if (item.character) {
      if (!['main', 'sub', 'background'].includes(item.character.importance)) {
        errors.push('character.importance は main, sub, background のいずれかである必要があります');
      }
      if (typeof item.character.multiple_characters !== 'boolean') {
        errors.push('character.multiple_characters は boolean である必要があります');
      }
      if (
        item.character.display_name !== undefined &&
        typeof item.character.display_name !== 'string'
      ) {
        errors.push('character.display_name は string である必要があります');
      }
    }

    return errors;
  }

  static validateMetaYaml(meta: MetaYaml): string[] {
    const errors: string[] = [];

    if (!Array.isArray(meta.files)) {
      errors.push('files フィールドは配列である必要があります');
      return errors;
    }

    for (let i = 0; i < meta.files.length; i++) {
      const file = meta.files[i];
      if (file !== undefined) {
        const itemErrors = this.validateDialogoiTreeItem(file);
        itemErrors.forEach((error) => {
          errors.push(`files[${i}]: ${error}`);
        });
      }
    }

    return errors;
  }

  /**
   * レビューファイルのパスを生成
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューファイルのパス
   */
  static generateReviewFilePath(targetRelativeFilePath: string): string {
    const fileName = path.basename(targetRelativeFilePath);
    const dirName = path.dirname(targetRelativeFilePath);
    const reviewFileName = `${fileName}_reviews.yaml`;

    // 対象ファイルと同じディレクトリに配置
    return path.join(dirName, reviewFileName);
  }

  /**
   * meta.yaml のファイルエントリにレビュー情報を設定
   * @param dirAbsolutePath ディレクトリパス（絶対パス）
   * @param fileName ファイル名
   * @param reviewSummary レビューサマリー
   * @returns 更新が成功したかどうか
   */
  static updateReviewInfo(
    dirAbsolutePath: string,
    fileName: string,
    reviewSummary: ReviewSummary | null,
    fileOperationService?: FileOperationService,
  ): boolean {
    const metaAbsolutePath = path.join(dirAbsolutePath, 'meta.yaml');

    try {
      if (fileOperationService) {
        const metaUri = fileOperationService.createFileUri(metaAbsolutePath);
        
        if (!fileOperationService.existsSync(metaUri)) {
          return false;
        }

        const content = fileOperationService.readFileSync(metaUri, 'utf-8');
        const meta = yaml.load(content) as MetaYaml;

        const fileItem = meta.files.find((item) => item.name === fileName);
        if (!fileItem) {
          return false;
        }

        if (
          reviewSummary &&
          (reviewSummary.open > 0 ||
            (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0))
        ) {
          // レビューが存在する場合
          const filePathInDir = path.join(path.basename(dirAbsolutePath), fileName);
          fileItem.reviews = this.generateReviewFilePath(filePathInDir);

          // レビューサマリーを設定（0でない値のみ）
          fileItem.review_count = { open: reviewSummary.open };
          if (reviewSummary.in_progress !== undefined && reviewSummary.in_progress > 0) {
            fileItem.review_count.in_progress = reviewSummary.in_progress;
          }
          if (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0) {
            fileItem.review_count.resolved = reviewSummary.resolved;
          }
          if (reviewSummary.dismissed !== undefined && reviewSummary.dismissed > 0) {
            fileItem.review_count.dismissed = reviewSummary.dismissed;
          }
        } else {
          // レビューが存在しない場合は削除
          delete fileItem.reviews;
          delete fileItem.review_count;
        }

        // meta.yaml を更新
        const updatedContent = yaml.dump(meta, { indent: 2 });
        fileOperationService.writeFileSync(metaUri, updatedContent, 'utf-8');

        return true;
      } else {
        // 後方互換性のためのフォールバック（一時的）
        const fs = require('fs');
        
        if (!fs.existsSync(metaAbsolutePath)) {
          return false;
        }

        const content = fs.readFileSync(metaAbsolutePath, 'utf-8');
        const meta = yaml.load(content) as MetaYaml;

        const fileItem = meta.files.find((item) => item.name === fileName);
        if (!fileItem) {
          return false;
        }

        if (
          reviewSummary &&
          (reviewSummary.open > 0 ||
            (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0))
        ) {
          // レビューが存在する場合
          const filePathInDir = path.join(path.basename(dirAbsolutePath), fileName);
          fileItem.reviews = this.generateReviewFilePath(filePathInDir);

          // レビューサマリーを設定（0でない値のみ）
          fileItem.review_count = { open: reviewSummary.open };
          if (reviewSummary.in_progress !== undefined && reviewSummary.in_progress > 0) {
            fileItem.review_count.in_progress = reviewSummary.in_progress;
          }
          if (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0) {
            fileItem.review_count.resolved = reviewSummary.resolved;
          }
          if (reviewSummary.dismissed !== undefined && reviewSummary.dismissed > 0) {
            fileItem.review_count.dismissed = reviewSummary.dismissed;
          }
        } else {
          // レビューが存在しない場合は削除
          delete fileItem.reviews;
          delete fileItem.review_count;
        }

        // meta.yaml を更新
        const updatedContent = yaml.dump(meta, { indent: 2 });
        fs.writeFileSync(metaAbsolutePath, updatedContent, 'utf-8');

        return true;
      }
    } catch (error) {
      console.error('レビュー情報の更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * meta.yaml からレビュー情報を削除
   * @param dirAbsolutePath ディレクトリパス（絶対パス）
   * @param fileName ファイル名
   * @returns 削除が成功したかどうか
   */
  static removeReviewInfo(dirAbsolutePath: string, fileName: string, fileOperationService?: FileOperationService): boolean {
    return this.updateReviewInfo(dirAbsolutePath, fileName, null, fileOperationService);
  }
}
