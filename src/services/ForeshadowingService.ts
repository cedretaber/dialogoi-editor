import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';

export interface ForeshadowingData {
  start: string;
  goal: string;
}

export class ForeshadowingService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * マークダウンファイルから表示名を取得
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 表示名（見出しが見つからない場合はファイル名）
   */
  extractDisplayName(fileAbsolutePath: string): string {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!this.fileRepository.existsSync(fileUri)) {
        return this.getFileNameWithoutExtension(fileAbsolutePath);
      }

      const content = this.fileRepository.readFileSync(fileUri, 'utf-8');
      const lines = content.split('\n');

      // 最初の # 見出しを探す
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('# ')) {
          return trimmedLine.substring(2).trim();
        }
      }

      // 見出しが見つからない場合はファイル名（拡張子なし）を返す
      return this.getFileNameWithoutExtension(fileAbsolutePath);
    } catch (error) {
      console.error('表示名の取得に失敗しました:', error);
      return this.getFileNameWithoutExtension(fileAbsolutePath);
    }
  }

  /**
   * パスの有効性を検証
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param relativePath 検証対象の相対パス
   * @returns 有効な場合true
   */
  validatePath(novelRootAbsolutePath: string, relativePath: string): boolean {
    if (!relativePath || relativePath.trim() === '') {
      return false;
    }

    const absolutePath = path.join(novelRootAbsolutePath, relativePath);
    const fileUri = this.fileRepository.createFileUri(absolutePath);
    return this.fileRepository.existsSync(fileUri);
  }

  /**
   * 伏線データの検証
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param foreshadowingData 伏線データ
   * @returns 検証結果（valid: 有効性, errors: エラーメッセージ配列）
   */
  validateForeshadowing(
    novelRootAbsolutePath: string,
    foreshadowingData: ForeshadowingData,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 埋蔵位置の検証
    if (!foreshadowingData.start || foreshadowingData.start.trim() === '') {
      errors.push('埋蔵位置（start）が指定されていません');
    } else if (!this.validatePath(novelRootAbsolutePath, foreshadowingData.start)) {
      errors.push(`埋蔵位置のファイルが存在しません: ${foreshadowingData.start}`);
    }

    // 回収位置の検証
    if (!foreshadowingData.goal || foreshadowingData.goal.trim() === '') {
      errors.push('回収位置（goal）が指定されていません');
    } else if (!this.validatePath(novelRootAbsolutePath, foreshadowingData.goal)) {
      errors.push(`回収位置のファイルが存在しません: ${foreshadowingData.goal}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 伏線の状態を取得
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param foreshadowingData 伏線データ
   * @returns 伏線の状態（planted: 埋蔵済み, resolved: 回収済み, planned: 計画中）
   */
  getForeshadowingStatus(
    novelRootAbsolutePath: string,
    foreshadowingData: ForeshadowingData,
  ): 'planted' | 'resolved' | 'planned' | 'error' {
    const startExists = this.validatePath(novelRootAbsolutePath, foreshadowingData.start);
    const goalExists = this.validatePath(novelRootAbsolutePath, foreshadowingData.goal);

    if (!startExists && !goalExists) {
      return 'error';
    }

    if (startExists && goalExists) {
      return 'resolved';
    }

    if (startExists && !goalExists) {
      return 'planted';
    }

    return 'planned';
  }

  /**
   * ファイルパスから拡張子を除いたファイル名を取得
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 拡張子を除いたファイル名
   */
  private getFileNameWithoutExtension(fileAbsolutePath: string): string {
    const fileName = path.basename(fileAbsolutePath);
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  }
}
