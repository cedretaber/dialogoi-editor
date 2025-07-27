import * as path from 'path';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { Logger } from '../utils/Logger.js';

/**
 * プロジェクトパス管理サービス
 * プロジェクトルートとファイルの相対パス計算を担当
 */
export class ProjectPathService {
  constructor(private dialogoiYamlService: DialogoiYamlService) {}

  /**
   * 絶対ファイルパスからプロジェクトルートと相対パスを取得
   * @param absoluteFilePath 絶対ファイルパス
   * @returns プロジェクトルートと相対パス（見つからない場合はnull）
   */
  async getRelativePathFromProject(
    absoluteFilePath: string,
  ): Promise<{ projectRoot: string; relativePath: string } | null> {
    const logger = Logger.getInstance();

    try {
      logger.debug(`検索開始パス: ${absoluteFilePath}`);

      // プロジェクトルートを検索（上向き検索）
      const projectRoot = await this.dialogoiYamlService.findProjectRootAsync(absoluteFilePath);
      logger.debug(`プロジェクトルート検索結果: ${projectRoot}`);
      if (projectRoot === null || projectRoot === '') {
        logger.debug(`プロジェクトルートが見つかりません: ${absoluteFilePath}`);
        return null;
      }

      // 相対パスを計算
      const relativePath = path.relative(projectRoot, absoluteFilePath);

      // パスが上位ディレクトリを参照している場合（../が含まれる場合）は無効
      if (relativePath.startsWith('..')) {
        logger.debug(`ファイルがプロジェクト外にあります: ${absoluteFilePath}`);
        return null;
      }

      // パス区切り文字をスラッシュに統一（Windows対応）
      const normalizedRelativePath = relativePath.replace(/\\/g, '/');

      return {
        projectRoot,
        relativePath: normalizedRelativePath,
      };
    } catch (error) {
      logger.warn(`相対パス計算エラー: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
