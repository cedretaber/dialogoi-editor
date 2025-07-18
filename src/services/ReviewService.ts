import * as yaml from 'js-yaml';
import * as path from 'path';
import {
  ReviewFile,
  ReviewItem,
  ReviewSummary,
  CreateReviewOptions,
  UpdateReviewOptions,
  AddCommentOptions,
} from '../models/Review.js';
import { FileOperationService } from '../interfaces/FileOperationService.js';
import { Uri } from '../interfaces/Uri.js';
import { HashService } from './HashService.js';

/**
 * レビュー管理サービス
 */
export class ReviewService {
  private workspaceRoot: Uri;

  constructor(
    private fileOperationService: FileOperationService,
    private hashService: HashService,
    workspaceRoot: Uri,
  ) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * レビューファイルのパスを取得
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューファイルのパス
   */
  private getReviewFilePath(targetRelativeFilePath: string): string {
    const fileName = path.basename(targetRelativeFilePath);
    const relativeDirName = path.dirname(targetRelativeFilePath);
    const reviewFileName = `${fileName}_reviews.yaml`;

    // 対象ファイルと同じディレクトリに配置
    return path.join(relativeDirName, reviewFileName);
  }

  /**
   * レビューファイルの URI を取得
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューファイルの URI
   */
  private getReviewFileUri(targetRelativeFilePath: string): Uri {
    const reviewRelativeFilePath = this.getReviewFilePath(targetRelativeFilePath);
    return this.fileOperationService.joinPath(this.workspaceRoot, reviewRelativeFilePath);
  }

  /**
   * レビューファイルを読み込み
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューファイルの内容
   */
  loadReviewFile(targetRelativeFilePath: string): ReviewFile | null {
    const reviewFileUri = this.getReviewFileUri(targetRelativeFilePath);

    try {
      if (!this.fileOperationService.existsSync(reviewFileUri)) {
        return null;
      }
      const yamlContent = this.fileOperationService.readFileSync(reviewFileUri, 'utf8');
      const reviewData = yaml.load(yamlContent) as ReviewFile;

      return reviewData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`レビューファイルの読み込みに失敗しました: ${errorMessage}`);
    }
  }

  /**
   * レビューファイルを保存
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param reviewFile レビューファイルの内容
   */
  saveReviewFile(targetRelativeFilePath: string, reviewFile: ReviewFile): void {
    const reviewFileUri = this.getReviewFileUri(targetRelativeFilePath);

    try {
      // 対象ファイルと同じディレクトリに保存するため、そのディレクトリを作成
      const reviewRelativeDirPath = path.dirname(this.getReviewFilePath(targetRelativeFilePath));
      const reviewDir = this.fileOperationService.joinPath(
        this.workspaceRoot,
        reviewRelativeDirPath,
      );
      if (!this.fileOperationService.existsSync(reviewDir)) {
        this.fileOperationService.mkdirSync(reviewDir);
      }

      // YAML として保存
      const yamlContent = yaml.dump(reviewFile, { indent: 2 });
      this.fileOperationService.writeFileSync(reviewFileUri, yamlContent, 'utf8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`レビューファイルの保存に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * レビューを追加
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param options レビュー作成オプション
   * @returns 追加されたレビューのインデックス
   */
  addReview(targetRelativeFilePath: string, options: CreateReviewOptions): number {
    const targetFileUri = this.fileOperationService.joinPath(
      this.workspaceRoot,
      targetRelativeFilePath,
    );
    const fileHash = this.hashService.calculateFileHash(targetFileUri);

    let reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile) {
      reviewFile = {
        target_file: targetRelativeFilePath,
        file_hash: fileHash,
        reviews: [],
      };
    }

    // ファイルハッシュを更新
    reviewFile.file_hash = fileHash;

    // 新しいレビューを作成
    const newReview: ReviewItem = {
      line: options.line,
      position: options.position,
      reviewer: options.reviewer,
      type: options.type,
      severity: options.severity,
      content: options.content,
      created_at: new Date().toISOString(),
      status: 'open',
    };

    reviewFile.reviews.push(newReview);

    this.saveReviewFile(targetRelativeFilePath, reviewFile);

    return reviewFile.reviews.length - 1;
  }

  /**
   * レビューを更新
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param reviewIndex レビューのインデックス
   * @param options 更新オプション
   */
  updateReview(
    targetRelativeFilePath: string,
    reviewIndex: number,
    options: UpdateReviewOptions,
  ): void {
    const reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile) {
      throw new Error('レビューファイルが見つかりません');
    }

    if (reviewIndex < 0 || reviewIndex >= reviewFile.reviews.length) {
      throw new Error('無効なレビューインデックスです');
    }

    const review = reviewFile.reviews[reviewIndex];
    if (!review) {
      throw new Error('レビューが見つかりません');
    }

    if (options.status !== undefined) {
      review.status = options.status;
    }
    if (options.content !== undefined) {
      review.content = options.content;
    }
    if (options.severity !== undefined) {
      review.severity = options.severity;
    }

    this.saveReviewFile(targetRelativeFilePath, reviewFile);
  }

  /**
   * レビューにコメントを追加
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param reviewIndex レビューのインデックス
   * @param options コメントオプション
   */
  addComment(
    targetRelativeFilePath: string,
    reviewIndex: number,
    options: AddCommentOptions,
  ): void {
    const reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile) {
      throw new Error('レビューファイルが見つかりません');
    }

    if (reviewIndex < 0 || reviewIndex >= reviewFile.reviews.length) {
      throw new Error('無効なレビューインデックスです');
    }

    const review = reviewFile.reviews[reviewIndex];
    if (!review) {
      throw new Error('レビューが見つかりません');
    }

    if (!review.thread) {
      review.thread = [];
    }

    review.thread.push({
      author: options.author,
      content: options.content,
      created_at: new Date().toISOString(),
    });

    this.saveReviewFile(targetRelativeFilePath, reviewFile);
  }

  /**
   * レビューを削除
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param reviewIndex レビューのインデックス
   */
  deleteReview(targetRelativeFilePath: string, reviewIndex: number): void {
    const reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile) {
      throw new Error('レビューファイルが見つかりません');
    }

    if (reviewIndex < 0 || reviewIndex >= reviewFile.reviews.length) {
      throw new Error('無効なレビューインデックスです');
    }

    reviewFile.reviews.splice(reviewIndex, 1);

    if (reviewFile.reviews.length === 0) {
      // レビューがない場合はファイルを削除
      const reviewFileUri = this.getReviewFileUri(targetRelativeFilePath);
      this.fileOperationService.unlinkSync(reviewFileUri);
    } else {
      this.saveReviewFile(targetRelativeFilePath, reviewFile);
    }
  }

  /**
   * レビューサマリーを取得
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns レビューサマリー
   */
  getReviewSummary(targetRelativeFilePath: string): ReviewSummary | null {
    const reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile || reviewFile.reviews.length === 0) {
      return null;
    }

    const summary: ReviewSummary = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      dismissed: 0,
    };

    for (const review of reviewFile.reviews) {
      summary[review.status]++;
    }

    return summary;
  }

  /**
   * ファイルハッシュの変更を検証
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns ファイルが変更されているかどうか
   */
  isFileChanged(targetRelativeFilePath: string): boolean {
    const reviewFile = this.loadReviewFile(targetRelativeFilePath);

    if (!reviewFile) {
      return false;
    }

    const targetFileUri = this.fileOperationService.joinPath(
      this.workspaceRoot,
      targetRelativeFilePath,
    );
    const currentHash = this.hashService.calculateFileHash(targetFileUri);

    return currentHash !== reviewFile.file_hash;
  }
}
