import {
  LinkUpdateResult,
  ProjectLinkUpdateService,
} from '../services/ProjectLinkUpdateService.js';

/**
 * ProjectLinkUpdateServiceのモック実装
 * テスト環境でリンク更新処理をモック化
 */
export class MockProjectLinkUpdateService implements ProjectLinkUpdateService {
  private updateCalls: Array<{
    oldPath: string;
    newPath: string;
  }> = [];

  private scanCalls: Array<string> = [];

  /**
   * ファイル操作後のリンク更新をモック実装
   * @param oldProjectRelativePath 古いプロジェクト相対パス
   * @param newProjectRelativePath 新しいプロジェクト相対パス
   */
  updateLinksAfterFileOperation(
    oldProjectRelativePath: string,
    newProjectRelativePath: string,
  ): Promise<LinkUpdateResult> {
    // 実際の処理は行わず、呼び出しログのみ記録
    this.updateCalls.push({
      oldPath: oldProjectRelativePath,
      newPath: newProjectRelativePath,
    });

    return Promise.resolve({
      success: true,
      message: `Mock: Updated links from ${oldProjectRelativePath} to ${newProjectRelativePath}`,
      updatedFiles: [],
      failedFiles: [],
      totalScannedFiles: 0,
    });
  }

  /**
   * ファイル内のプロジェクトリンクをスキャンするモック実装
   * @param fileAbsolutePath ファイルの絶対パス
   */
  scanFileForProjectLinks(fileAbsolutePath: string): Promise<string[]> {
    this.scanCalls.push(fileAbsolutePath);
    return Promise.resolve([]);
  }

  /**
   * モックの呼び出し履歴を取得（テスト用）
   */
  getUpdateCalls(): Array<{ oldPath: string; newPath: string }> {
    return [...this.updateCalls];
  }

  /**
   * スキャン呼び出し履歴を取得（テスト用）
   */
  getScanCalls(): Array<string> {
    return [...this.scanCalls];
  }

  /**
   * モックの呼び出し履歴をクリア（テスト用）
   */
  clearUpdateCalls(): void {
    this.updateCalls = [];
  }

  /**
   * スキャン呼び出し履歴をクリア（テスト用）
   */
  clearScanCalls(): void {
    this.scanCalls = [];
  }

  /**
   * すべての履歴をクリア（テスト用）
   */
  clearAllCalls(): void {
    this.updateCalls = [];
    this.scanCalls = [];
  }

  /**
   * 特定のパスペアでupdateLinksAfterFileOperationが呼ばれたかチェック（テスト用）
   */
  wasCalledWith(oldPath: string, newPath: string): boolean {
    return this.updateCalls.some((call) => call.oldPath === oldPath && call.newPath === newPath);
  }
}
