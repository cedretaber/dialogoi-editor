import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';

/**
 * Dialogoi固有のパス変換ロジックを担当するサービス
 * .dialogoi/ ディレクトリ構造に関連するパス変換を一元管理
 */
export class DialogoiPathService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * 実際のディレクトリパスから.dialogoi/内のメタデータパスを取得
   * @param targetPath プロジェクト内の実際のディレクトリパス（絶対パス）
   * @return .dialogoi/内のメタデータファイルパス
   *
   * 例：
   * - /project/contents → /project/.dialogoi/contents/dialogoi-meta.yaml
   * - /project → /project/.dialogoi/dialogoi-meta.yaml
   */
  resolveMetaPath(targetPath: string): string {
    const projectRoot = this.fileRepository.getProjectRoot();

    // プロジェクトルート自体の場合
    if (targetPath === projectRoot) {
      return path.join(projectRoot, '.dialogoi', 'dialogoi-meta.yaml');
    }

    // サブディレクトリの場合
    const relativePath = path.relative(projectRoot, targetPath);
    if (relativePath.startsWith('..')) {
      throw new Error(`無効なパス: ${targetPath} はプロジェクト内にありません`);
    }

    return path.join(projectRoot, '.dialogoi', relativePath, 'dialogoi-meta.yaml');
  }

  /**
   * 実際のファイルパスから.dialogoi/内のコメントファイルパスを取得
   * @param filePath プロジェクト内の実際のファイルパス（絶対パス）
   * @return .dialogoi/内のコメントファイルパス
   *
   * 例：
   * - /project/contents/chapter1.txt → /project/.dialogoi/contents/chapter1.txt.comments.yaml
   */
  resolveCommentPath(filePath: string): string {
    const projectRoot = this.fileRepository.getProjectRoot();

    const dir = path.dirname(filePath);
    const filename = path.basename(filePath);
    const relativeDir = path.relative(projectRoot, dir);

    if (relativeDir.startsWith('..')) {
      throw new Error(`無効なパス: ${filePath} はプロジェクト内にありません`);
    }

    // ルートディレクトリの場合
    if (relativeDir === '') {
      return path.join(projectRoot, '.dialogoi', `${filename}.comments.yaml`);
    }

    // サブディレクトリの場合
    return path.join(projectRoot, '.dialogoi', relativeDir, `${filename}.comments.yaml`);
  }

  /**
   * .dialogoi/内の必要なディレクトリ構造を作成
   * @param targetPath 実際のディレクトリパス
   */
  async ensureDialogoiDirectory(targetPath: string): Promise<void> {
    const metaPath = this.resolveMetaPath(targetPath);
    const metaDir = path.dirname(metaPath);
    const metaDirUri = this.fileRepository.createDirectoryUri(metaDir);

    if (!(await this.fileRepository.existsAsync(metaDirUri))) {
      await this.fileRepository.createDirectoryAsync(metaDirUri);
    }
  }
}
