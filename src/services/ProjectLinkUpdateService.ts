/**
 * リンク更新結果
 */
export interface LinkUpdateResult {
  success: boolean;
  message: string;
  updatedFiles: string[];
  failedFiles: { path: string; error: string }[];
  totalScannedFiles: number;
}

/**
 * プロジェクトリンク更新サービスのインターフェース
 */
export interface ProjectLinkUpdateService {
  /**
   * ファイル操作後のリンク更新
   * @param oldProjectRelativePath 古いプロジェクト相対パス
   * @param newProjectRelativePath 新しいプロジェクト相対パス
   */
  updateLinksAfterFileOperation(
    oldProjectRelativePath: string,
    newProjectRelativePath: string,
  ): Promise<LinkUpdateResult>;

  /**
   * ファイル内のプロジェクトリンクをスキャン
   * @param fileAbsolutePath ファイルの絶対パス
   */
  scanFileForProjectLinks(fileAbsolutePath: string): Promise<string[]>;
}
