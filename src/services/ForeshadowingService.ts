import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { ForeshadowingPoint } from '../utils/MetaYamlUtils.js';

export interface ForeshadowingData {
  plants: ForeshadowingPoint[];
  payoff: ForeshadowingPoint;
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

    // 埋蔵位置の検証（複数位置）
    if (
      foreshadowingData.plants === null ||
      foreshadowingData.plants === undefined ||
      foreshadowingData.plants.length === 0
    ) {
      errors.push('伏線の埋蔵位置（plants）が指定されていません');
    } else {
      foreshadowingData.plants.forEach((plant, index) => {
        if (!plant.location || plant.location.trim() === '') {
          errors.push(`埋蔵位置 ${index + 1} のファイルパスが指定されていません`);
        } else if (!this.validatePath(novelRootAbsolutePath, plant.location)) {
          errors.push(`埋蔵位置 ${index + 1} のファイルが存在しません: ${plant.location}`);
        }
      });
    }

    // 回収位置の検証
    if (!foreshadowingData.payoff?.location || foreshadowingData.payoff.location.trim() === '') {
      errors.push('伏線の回収位置（payoff）が指定されていません');
    } else if (!this.validatePath(novelRootAbsolutePath, foreshadowingData.payoff.location)) {
      errors.push(`回収位置のファイルが存在しません: ${foreshadowingData.payoff.location}`);
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
   * @returns 伏線の状態
   */
  getForeshadowingStatus(
    novelRootAbsolutePath: string,
    foreshadowingData: ForeshadowingData,
  ): 'error' | 'planned' | 'partially_planted' | 'fully_planted' | 'resolved' {
    // 基本的なデータ検証
    if (
      foreshadowingData.plants === null ||
      foreshadowingData.plants === undefined ||
      foreshadowingData.plants.length === 0
    ) {
      return 'error';
    }

    // 各埋蔵位置の存在チェック
    const plantsStatus = foreshadowingData.plants.map((plant) =>
      this.validatePath(novelRootAbsolutePath, plant.location),
    );
    const existingPlantsCount = plantsStatus.filter((exists) => exists).length;
    const totalPlantsCount = foreshadowingData.plants.length;

    // 回収位置の存在チェック
    const payoffExists =
      foreshadowingData.payoff?.location !== null &&
      foreshadowingData.payoff?.location !== undefined &&
      this.validatePath(novelRootAbsolutePath, foreshadowingData.payoff.location);

    // ステータス判定
    if (existingPlantsCount === 0 && !payoffExists) {
      return 'error';
    }

    if (existingPlantsCount === totalPlantsCount && payoffExists === true) {
      return 'resolved';
    }

    if (existingPlantsCount === totalPlantsCount && payoffExists === false) {
      return 'fully_planted';
    }

    if (existingPlantsCount > 0 && existingPlantsCount < totalPlantsCount) {
      return 'partially_planted';
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
