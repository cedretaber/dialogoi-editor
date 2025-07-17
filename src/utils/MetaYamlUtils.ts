import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ReviewSummary } from '../models/Review.js';

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
    main: boolean;
    multi: boolean;
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

  static loadMetaYaml(dirPath: string): MetaYaml | null {
    const metaPath = path.join(dirPath, 'meta.yaml');

    try {
      if (!fs.existsSync(metaPath)) {
        return null;
      }

      const metaContent = fs.readFileSync(metaPath, 'utf8');
      return this.parseMetaYaml(metaContent);
    } catch (error) {
      console.error('meta.yaml の読み込みエラー:', error);
      return null;
    }
  }

  static getReadmeFilePath(dirPath: string): string | null {
    const meta = this.loadMetaYaml(dirPath);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeFilePath = path.join(dirPath, meta.readme);
    if (fs.existsSync(readmeFilePath)) {
      return readmeFilePath;
    }

    return null;
  }

  static findNovelRoot(workspaceRoot: string): string | null {
    const findDialogoiYaml = (dir: string): string | null => {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isFile() && item.name === 'dialogoi.yaml') {
          return dir;
        } else if (item.isDirectory()) {
          const result = findDialogoiYaml(fullPath);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    };

    return findDialogoiYaml(workspaceRoot);
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

    if (
      item.character &&
      (typeof item.character.main !== 'boolean' || typeof item.character.multi !== 'boolean')
    ) {
      errors.push('character.main と character.multi は boolean である必要があります');
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
   * @param targetFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューファイルのパス
   */
  static generateReviewFilePath(targetFilePath: string): string {
    const fileName = path.basename(targetFilePath);
    const dirName = path.dirname(targetFilePath);
    const reviewFileName = `${fileName}_reviews.yaml`;
    
    if (dirName === '.') {
      return path.join('reviews', reviewFileName);
    } else {
      return path.join('reviews', dirName, reviewFileName);
    }
  }

  /**
   * meta.yaml のファイルエントリにレビュー情報を設定
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param reviewSummary レビューサマリー
   * @returns 更新が成功したかどうか
   */
  static updateReviewInfo(dirPath: string, fileName: string, reviewSummary: ReviewSummary | null): boolean {
    const metaPath = path.join(dirPath, 'meta.yaml');
    
    if (!fs.existsSync(metaPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(metaPath, 'utf-8');
      const meta = yaml.load(content) as MetaYaml;
      
      const fileItem = meta.files.find(item => item.name === fileName);
      if (!fileItem) {
        return false;
      }

      if (reviewSummary && (reviewSummary.open > 0 || (reviewSummary.resolved && reviewSummary.resolved > 0))) {
        // レビューが存在する場合
        const filePathInDir = path.join(path.basename(dirPath), fileName);
        fileItem.reviews = this.generateReviewFilePath(filePathInDir);
        
        // レビューサマリーを設定（0でない値のみ）
        fileItem.review_count = { open: reviewSummary.open };
        if (reviewSummary.in_progress && reviewSummary.in_progress > 0) {
          fileItem.review_count.in_progress = reviewSummary.in_progress;
        }
        if (reviewSummary.resolved && reviewSummary.resolved > 0) {
          fileItem.review_count.resolved = reviewSummary.resolved;
        }
        if (reviewSummary.dismissed && reviewSummary.dismissed > 0) {
          fileItem.review_count.dismissed = reviewSummary.dismissed;
        }
      } else {
        // レビューが存在しない場合は削除
        delete fileItem.reviews;
        delete fileItem.review_count;
      }

      // meta.yaml を更新
      const updatedContent = yaml.dump(meta, { indent: 2 });
      fs.writeFileSync(metaPath, updatedContent, 'utf-8');
      
      return true;
    } catch (error) {
      console.error('レビュー情報の更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * meta.yaml からレビュー情報を削除
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 削除が成功したかどうか
   */
  static removeReviewInfo(dirPath: string, fileName: string): boolean {
    return this.updateReviewInfo(dirPath, fileName, null);
  }
}
