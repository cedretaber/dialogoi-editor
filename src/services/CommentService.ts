import * as yaml from 'js-yaml';
import * as path from 'path';
import {
  CommentFile,
  CommentItem,
  CommentSummary,
  CreateCommentOptions,
  UpdateCommentOptions,
} from '../models/Comment.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { Uri } from '../interfaces/Uri.js';
import { HashCalculator } from '../utils/HashCalculator.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { formatTargetFile } from '../utils/FileLineUrlParser.js';

/**
 * コメント管理サービス
 * レビューサービスを簡略化してコメント専用に特化
 */
export class CommentService {
  private workspaceRoot: Uri;

  constructor(
    private fileRepository: FileRepository,
    private dialogoiYamlService: DialogoiYamlService,
    workspaceRoot: Uri,
  ) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * コメントファイルのパスを取得（新形式）
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns コメントファイルのパス (.{filename}.comments.yaml 形式)
   */
  private getCommentFilePath(targetRelativeFilePath: string): string {
    const fileName = path.basename(targetRelativeFilePath);
    const relativeDirName = path.dirname(targetRelativeFilePath);
    const commentFileName = `.${fileName}.comments.yaml`;

    // 対象ファイルと同じディレクトリに配置
    return path.join(relativeDirName, commentFileName);
  }

  /**
   * コメントファイルの URI を取得
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns コメントファイルの URI
   */
  private getCommentFileUri(targetRelativeFilePath: string): Uri {
    const commentRelativeFilePath = this.getCommentFilePath(targetRelativeFilePath);
    return this.fileRepository.joinPath(this.workspaceRoot, commentRelativeFilePath);
  }

  /**
   * コメントファイルを非同期で読み込み
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns コメントファイル（存在しない場合はnull）
   */
  async loadCommentFileAsync(targetRelativeFilePath: string): Promise<CommentFile | null> {
    const commentFileUri = this.getCommentFileUri(targetRelativeFilePath);

    try {
      if (!(await this.fileRepository.existsAsync(commentFileUri))) {
        return null;
      }

      const content = await this.fileRepository.readFileAsync(commentFileUri, 'utf8');
      const parsed = yaml.load(content) as CommentFile;

      if (!this.validateCommentFile(parsed)) {
        throw new Error('コメントファイルの形式が正しくありません');
      }

      return parsed;
    } catch (error) {
      throw new Error(
        `コメントファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * コメントファイルを非同期で保存
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param commentFile コメントファイル
   */
  async saveCommentFileAsync(
    targetRelativeFilePath: string,
    commentFile: CommentFile,
  ): Promise<void> {
    const commentFileUri = this.getCommentFileUri(targetRelativeFilePath);

    try {
      const yamlContent = yaml.dump(commentFile, {
        flowLevel: -1,
        lineWidth: -1,
      });

      await this.fileRepository.writeFileAsync(commentFileUri, yamlContent);
    } catch (error) {
      throw new Error(
        `コメントファイル保存エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * コメントを追加（新データ構造）
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param options コメント作成オプション
   */
  async addCommentAsync(
    targetRelativeFilePath: string,
    options: CreateCommentOptions,
  ): Promise<void> {
    // 対象ファイルのハッシュを取得
    const targetFileUri = this.fileRepository.joinPath(this.workspaceRoot, targetRelativeFilePath);
    const fileContent = await this.fileRepository.readFileAsync(targetFileUri, 'utf8');
    const fileHash = HashCalculator.calculateContentHash(fileContent);

    // 既存のコメントファイルを読み込み
    let commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile) {
      // 新しいコメントファイルを作成
      commentFile = {
        comments: [],
      };
    }

    // 新しいIDを生成（最大値+1）
    const newId =
      commentFile.comments.length > 0 ? Math.max(...commentFile.comments.map((c) => c.id)) + 1 : 1;

    // target_file文字列を生成
    const targetFile = formatTargetFile(targetRelativeFilePath, options.line, options.endLine);

    // posted_byを取得
    const postedBy = await this.getPostedByAsync();

    // 新しいコメントアイテムを作成
    const newComment: CommentItem = {
      id: newId,
      target_file: targetFile,
      file_hash: fileHash,
      content: options.content,
      posted_by: postedBy,
      status: 'open',
      created_at: new Date().toISOString(),
    };

    commentFile.comments.push(newComment);

    // ファイルを保存
    await this.saveCommentFileAsync(targetRelativeFilePath, commentFile);

    // メタデータを更新
    this.updateMetaYamlAsync(targetRelativeFilePath);
  }

  /**
   * コメントを更新（新データ構造）
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param commentIndex コメントのインデックス
   * @param options 更新オプション
   */
  async updateCommentAsync(
    targetRelativeFilePath: string,
    commentIndex: number,
    options: UpdateCommentOptions,
  ): Promise<void> {
    const commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile || !commentFile.comments[commentIndex]) {
      throw new Error('更新対象のコメントが見つかりません');
    }

    const comment = commentFile.comments[commentIndex];

    if (options.content !== undefined) {
      comment.content = options.content;
    }
    if (options.status !== undefined) {
      comment.status = options.status;
    }

    // updated_atフィールドは新データ構造では不要

    await this.saveCommentFileAsync(targetRelativeFilePath, commentFile);
  }

  /**
   * コメントを削除
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @param commentIndex コメントのインデックス
   */
  async deleteCommentAsync(targetRelativeFilePath: string, commentIndex: number): Promise<void> {
    const commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile || !commentFile.comments[commentIndex]) {
      throw new Error('削除対象のコメントが見つかりません');
    }

    commentFile.comments.splice(commentIndex, 1);

    if (commentFile.comments.length === 0) {
      // コメントが全て削除された場合はファイルを削除
      const commentFileUri = this.getCommentFileUri(targetRelativeFilePath);
      await this.fileRepository.unlinkAsync(commentFileUri);
    } else {
      await this.saveCommentFileAsync(targetRelativeFilePath, commentFile);
    }
  }

  /**
   * ファイルが変更されているかチェック（新データ構造）
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns ファイルが変更されている場合はtrue
   */
  async isFileChangedAsync(targetRelativeFilePath: string): Promise<boolean> {
    const commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile || commentFile.comments.length === 0) {
      return false;
    }

    const targetFileUri = this.fileRepository.joinPath(this.workspaceRoot, targetRelativeFilePath);
    const fileContent = await this.fileRepository.readFileAsync(targetFileUri, 'utf8');
    const currentHash = HashCalculator.calculateContentHash(fileContent);

    // 各コメントのfile_hashと比較
    return commentFile.comments.some((comment) => comment.file_hash !== currentHash);
  }

  /**
   * ファイルハッシュを更新（新データ構造）
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   */
  async updateFileHashAsync(targetRelativeFilePath: string): Promise<void> {
    const commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile) {
      return;
    }

    const targetFileUri = this.fileRepository.joinPath(this.workspaceRoot, targetRelativeFilePath);
    const fileContent = await this.fileRepository.readFileAsync(targetFileUri, 'utf8');
    const newHash = HashCalculator.calculateContentHash(fileContent);

    // 各コメントのfile_hashを更新
    for (const comment of commentFile.comments) {
      comment.file_hash = newHash;
    }

    await this.saveCommentFileAsync(targetRelativeFilePath, commentFile);
  }

  /**
   * コメントサマリーを取得
   * @param targetRelativeFilePath 対象ファイルのパス（小説ルートからの相対パス）
   * @returns コメントサマリー
   */
  async getCommentSummaryAsync(targetRelativeFilePath: string): Promise<CommentSummary> {
    const commentFile = await this.loadCommentFileAsync(targetRelativeFilePath);

    if (!commentFile) {
      return { open: 0 };
    }

    const openCount = commentFile.comments.filter((comment) => comment.status === 'open').length;
    const resolvedCount = commentFile.comments.filter(
      (comment) => comment.status === 'resolved',
    ).length;

    const result: CommentSummary = { open: openCount };
    if (resolvedCount > 0) {
      result.resolved = resolvedCount;
    }
    return result;
  }

  /**
   * posted_byの取得
   */
  private async getPostedByAsync(): Promise<string> {
    try {
      const dialogoiYaml = await this.dialogoiYamlService.loadDialogoiYamlAsync(
        this.workspaceRoot.fsPath,
      );
      if (dialogoiYaml?.author !== undefined && dialogoiYaml.author !== '') {
        return dialogoiYaml.author;
      }
    } catch {
      // エラーの場合はデフォルト値を使用
    }
    // デフォルト値
    return 'author';
  }

  /**
   * メタデータYAMLの更新
   */
  private updateMetaYamlAsync(_targetRelativeFilePath: string): void {
    // TODO: MetaYamlServiceとの連携を実装
    // 暫定的に何もしない
  }

  /**
   * コメントファイルの妥当性検証（新データ構造）
   * @param data パース済みデータ
   * @returns 妥当な場合はtrue
   */
  private validateCommentFile(data: unknown): data is CommentFile {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const dataObj = data as Record<string, unknown>;

    if (!Array.isArray(dataObj['comments'])) {
      return false;
    }

    return dataObj['comments'].every((comment: unknown) => this.validateCommentItem(comment));
  }

  /**
   * コメントアイテムの妥当性検証（新データ構造）
   * @param data パース済みデータ
   * @returns 妥当な場合はtrue
   */
  private validateCommentItem(data: unknown): data is CommentItem {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const dataObj = data as Record<string, unknown>;

    if (
      typeof dataObj['id'] !== 'number' ||
      typeof dataObj['target_file'] !== 'string' ||
      typeof dataObj['file_hash'] !== 'string' ||
      typeof dataObj['content'] !== 'string' ||
      typeof dataObj['posted_by'] !== 'string'
    ) {
      return false;
    }

    if (dataObj['status'] !== 'open' && dataObj['status'] !== 'resolved') {
      return false;
    }

    if (typeof dataObj['created_at'] !== 'string') {
      return false;
    }

    return true;
  }
}
