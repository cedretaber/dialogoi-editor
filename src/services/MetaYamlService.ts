import * as path from 'path';
import { ReviewSummary } from '../models/Review.js';
import { FileRepository, DirectoryEntry } from '../repositories/FileRepository.js';
import { MetaYamlUtils, MetaYaml } from '../utils/MetaYamlUtils.js';

/**
 * .dialogoi-meta.yaml ファイルの操作を行うサービス
 */
export class MetaYamlService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * .dialogoi-meta.yaml を読み込む
   */
  loadMetaYaml(dirAbsolutePath: string): MetaYaml | null {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      if (!this.fileRepository.existsSync(metaUri)) {
        return null;
      }
      const metaContent = this.fileRepository.readFileSync(metaUri, 'utf8');
      return MetaYamlUtils.parseMetaYaml(metaContent);
    } catch (error) {
      console.error('.dialogoi-meta.yaml の読み込みエラー:', error);
      return null;
    }
  }

  /**
   * .dialogoi-meta.yamlファイルを保存
   */
  saveMetaYaml(dirAbsolutePath: string, meta: MetaYaml): boolean {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      // バリデーション
      const validationErrors = MetaYamlUtils.validateMetaYaml(meta);
      if (validationErrors.length > 0) {
        console.error('.dialogoi-meta.yaml検証エラー:', validationErrors);
        return false;
      }

      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      const yamlContent = MetaYamlUtils.stringifyMetaYaml(meta);
      this.fileRepository.writeFileSync(metaUri, yamlContent, 'utf8');
      return true;
    } catch (error) {
      console.error('.dialogoi-meta.yaml の保存エラー:', error);
      return false;
    }
  }

  /**
   * READMEファイルのパスを取得
   */
  getReadmeFilePath(dirAbsolutePath: string): string | null {
    const meta = this.loadMetaYaml(dirAbsolutePath);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeAbsolutePath = path.join(dirAbsolutePath, meta.readme);
    const readmeUri = this.fileRepository.createFileUri(readmeAbsolutePath);
    if (this.fileRepository.existsSync(readmeUri)) {
      return readmeAbsolutePath;
    }

    return null;
  }

  /**
   * 小説ルートディレクトリを探す
   */
  findNovelRoot(workspaceRootAbsolutePath: string): string | null {
    const findDialogoiYaml = (dirAbsolutePath: string): string | null => {
      const dirUri = this.fileRepository.createFileUri(dirAbsolutePath);
      const items = this.fileRepository.readdirSync(dirUri, {
        withFileTypes: true,
      }) as DirectoryEntry[];

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
      return null;
    };

    return findDialogoiYaml(workspaceRootAbsolutePath);
  }

  /**
   * .dialogoi-meta.yaml のファイルエントリにレビュー情報を設定
   */
  updateReviewInfo(
    dirAbsolutePath: string,
    fileName: string,
    reviewSummary: ReviewSummary | null,
  ): boolean {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);

      if (!this.fileRepository.existsSync(metaUri)) {
        return false;
      }

      const content = this.fileRepository.readFileSync(metaUri, 'utf-8');
      const meta = MetaYamlUtils.parseMetaYaml(content);

      if (!meta) {
        return false;
      }

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
        fileItem.reviews = MetaYamlUtils.generateReviewFilePath(filePathInDir);

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

      // .dialogoi-meta.yaml を更新
      const updatedContent = MetaYamlUtils.stringifyMetaYaml(meta);
      this.fileRepository.writeFileSync(metaUri, updatedContent, 'utf-8');

      return true;
    } catch (error) {
      console.error('レビュー情報の更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * .dialogoi-meta.yaml からレビュー情報を削除
   */
  removeReviewInfo(dirAbsolutePath: string, fileName: string): boolean {
    return this.updateReviewInfo(dirAbsolutePath, fileName, null);
  }
}
