import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { ForeshadowingPoint } from '../utils/MetaYamlUtils.js';
import { MetaYamlService } from './MetaYamlService.js';

export interface ForeshadowingData {
  plants: ForeshadowingPoint[];
  payoff: ForeshadowingPoint;
}

export class ForeshadowingService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

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
   * 伏線データの検証（非同期版）
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param foreshadowingData 伏線データ
   * @returns 検証結果（valid: 有効性, errors: エラーメッセージ配列）
   */
  async validateForeshadowingAsync(
    novelRootAbsolutePath: string,
    foreshadowingData: ForeshadowingData,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 埋蔵位置の検証（複数位置）
    if (
      foreshadowingData.plants === null ||
      foreshadowingData.plants === undefined ||
      foreshadowingData.plants.length === 0
    ) {
      errors.push('伏線の埋蔵位置（plants）が指定されていません');
    } else {
      for (let index = 0; index < foreshadowingData.plants.length; index++) {
        const plant = foreshadowingData.plants[index];
        if (!plant || !plant.location || plant.location.trim() === '') {
          errors.push(`埋蔵位置 ${index + 1} のファイルパスが指定されていません`);
        } else if (!(await this.validatePathAsync(novelRootAbsolutePath, plant.location))) {
          errors.push(`埋蔵位置 ${index + 1} のファイルが存在しません: ${plant.location}`);
        }
      }
    }

    // 回収位置の検証
    if (!foreshadowingData.payoff?.location || foreshadowingData.payoff.location.trim() === '') {
      errors.push('伏線の回収位置（payoff）が指定されていません');
    } else if (
      !(await this.validatePathAsync(novelRootAbsolutePath, foreshadowingData.payoff.location))
    ) {
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
   * 伏線の状態を取得（非同期版）
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param foreshadowingData 伏線データ
   * @returns 伏線の状態
   */
  async getForeshadowingStatusAsync(
    novelRootAbsolutePath: string,
    foreshadowingData: ForeshadowingData,
  ): Promise<'error' | 'planned' | 'partially_planted' | 'fully_planted' | 'resolved'> {
    // 基本的なデータ検証
    if (
      foreshadowingData.plants === null ||
      foreshadowingData.plants === undefined ||
      foreshadowingData.plants.length === 0
    ) {
      return 'error';
    }

    // 各埋蔵位置の存在チェック
    const plantsStatus = await Promise.all(
      foreshadowingData.plants.map((plant) =>
        this.validatePathAsync(novelRootAbsolutePath, plant.location),
      ),
    );
    const existingPlantsCount = plantsStatus.filter((exists) => exists).length;
    const totalPlantsCount = foreshadowingData.plants.length;

    // 回収位置の存在チェック
    const payoffExists =
      foreshadowingData.payoff?.location !== null &&
      foreshadowingData.payoff?.location !== undefined &&
      (await this.validatePathAsync(novelRootAbsolutePath, foreshadowingData.payoff.location));

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
   * 伏線の植込み位置を追加
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param plant 追加する植込み位置
   * @returns 操作の成功/失敗とメッセージ
   */
  addPlant(
    dirPath: string,
    fileName: string,
    plant: ForeshadowingPoint,
  ): { success: boolean; message: string } {
    try {
      // meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return { success: false, message: '.dialogoi-meta.yamlが見つかりません' };
      }

      // ファイルを検索
      const fileIndex = meta.files.findIndex((f) => f.name === fileName);
      if (fileIndex === -1) {
        return { success: false, message: `ファイル ${fileName} が見つかりません` };
      }

      const fileItem = meta.files[fileIndex];
      if (fileItem === undefined) {
        return { success: false, message: 'ファイルアイテムが見つかりません' };
      }

      // foreshadowing構造を初期化（存在しない場合）
      if (!fileItem.foreshadowing) {
        fileItem.foreshadowing = {
          plants: [],
          payoff: { location: '', comment: '' },
        };
      }

      // 植込み位置を追加
      fileItem.foreshadowing.plants.push(plant);

      // 保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      if (saveResult) {
        return {
          success: true,
          message: `伏線の植込み位置を追加しました: ${plant.location}`,
        };
      } else {
        return { success: false, message: 'meta.yamlの保存に失敗しました' };
      }
    } catch (error) {
      return {
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 伏線の植込み位置を削除
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param index 削除する植込み位置のインデックス
   * @returns 操作の成功/失敗とメッセージ
   */
  removePlant(
    dirPath: string,
    fileName: string,
    index: number,
  ): { success: boolean; message: string } {
    try {
      // meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return { success: false, message: '.dialogoi-meta.yamlが見つかりません' };
      }

      // ファイルを検索
      const fileIndex = meta.files.findIndex((f) => f.name === fileName);
      if (fileIndex === -1) {
        return { success: false, message: `ファイル ${fileName} が見つかりません` };
      }

      const fileItem = meta.files[fileIndex];
      if (fileItem === undefined || !fileItem.foreshadowing) {
        return { success: false, message: '伏線データが見つかりません' };
      }

      // インデックスの検証
      if (index < 0 || index >= fileItem.foreshadowing.plants.length) {
        return { success: false, message: '無効なインデックスです' };
      }

      // 植込み位置を削除
      const removedPlant = fileItem.foreshadowing.plants[index];
      fileItem.foreshadowing.plants.splice(index, 1);

      // 保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      if (saveResult) {
        const plantLocation = removedPlant?.location ?? 'unknown';
        return {
          success: true,
          message: `伏線の植込み位置を削除しました: ${plantLocation}`,
        };
      } else {
        return { success: false, message: 'meta.yamlの保存に失敗しました' };
      }
    } catch (error) {
      return {
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 伏線の植込み位置を更新
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param index 更新する植込み位置のインデックス
   * @param plant 新しい植込み位置データ
   * @returns 操作の成功/失敗とメッセージ
   */
  updatePlant(
    dirPath: string,
    fileName: string,
    index: number,
    plant: ForeshadowingPoint,
  ): { success: boolean; message: string } {
    try {
      // meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return { success: false, message: '.dialogoi-meta.yamlが見つかりません' };
      }

      // ファイルを検索
      const fileIndex = meta.files.findIndex((f) => f.name === fileName);
      if (fileIndex === -1) {
        return { success: false, message: `ファイル ${fileName} が見つかりません` };
      }

      const fileItem = meta.files[fileIndex];
      if (fileItem === undefined || !fileItem.foreshadowing) {
        return { success: false, message: '伏線データが見つかりません' };
      }

      // インデックスの検証
      if (index < 0 || index >= fileItem.foreshadowing.plants.length) {
        return { success: false, message: '無効なインデックスです' };
      }

      // 植込み位置を更新
      const oldPlant = fileItem.foreshadowing.plants[index];
      fileItem.foreshadowing.plants[index] = plant;

      // 保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      if (saveResult) {
        return {
          success: true,
          message: `伏線の植込み位置を更新しました: ${oldPlant?.location} → ${plant.location}`,
        };
      } else {
        return { success: false, message: 'meta.yamlの保存に失敗しました' };
      }
    } catch (error) {
      return {
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 伏線の回収位置を設定
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param payoff 新しい回収位置データ
   * @returns 操作の成功/失敗とメッセージ
   */
  setPayoff(
    dirPath: string,
    fileName: string,
    payoff: ForeshadowingPoint,
  ): { success: boolean; message: string } {
    try {
      // meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return { success: false, message: '.dialogoi-meta.yamlが見つかりません' };
      }

      // ファイルを検索
      const fileIndex = meta.files.findIndex((f) => f.name === fileName);
      if (fileIndex === -1) {
        return { success: false, message: `ファイル ${fileName} が見つかりません` };
      }

      const fileItem = meta.files[fileIndex];
      if (fileItem === undefined) {
        return { success: false, message: 'ファイルアイテムが見つかりません' };
      }

      // foreshadowing構造を初期化（存在しない場合）
      if (!fileItem.foreshadowing) {
        fileItem.foreshadowing = {
          plants: [],
          payoff: { location: '', comment: '' },
        };
      }

      // 回収位置を設定
      const oldPayoff = fileItem.foreshadowing.payoff;
      fileItem.foreshadowing.payoff = payoff;

      // 保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      if (saveResult) {
        return {
          success: true,
          message: `伏線の回収位置を設定しました: ${oldPayoff?.location || '(なし)'} → ${payoff.location}`,
        };
      } else {
        return { success: false, message: 'meta.yamlの保存に失敗しました' };
      }
    } catch (error) {
      return {
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 伏線の回収位置を削除
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 操作の成功/失敗とメッセージ
   */
  removePayoff(dirPath: string, fileName: string): { success: boolean; message: string } {
    try {
      // meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return { success: false, message: '.dialogoi-meta.yamlが見つかりません' };
      }

      // ファイルを検索
      const fileIndex = meta.files.findIndex((f) => f.name === fileName);
      if (fileIndex === -1) {
        return { success: false, message: `ファイル ${fileName} が見つかりません` };
      }

      const fileItem = meta.files[fileIndex];
      if (fileItem === undefined || !fileItem.foreshadowing) {
        return { success: false, message: '伏線データが見つかりません' };
      }

      // 回収位置を削除（空の値に設定）
      const oldPayoff = fileItem.foreshadowing.payoff;
      fileItem.foreshadowing.payoff = { location: '', comment: '' };

      // 保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      if (saveResult) {
        return {
          success: true,
          message: `伏線の回収位置を削除しました: ${oldPayoff?.location || 'unknown'}`,
        };
      } else {
        return { success: false, message: 'meta.yamlの保存に失敗しました' };
      }
    } catch (error) {
      return {
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * マークダウンファイルから表示名を取得（非同期版）
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 表示名（見出しが見つからない場合はファイル名）
   */
  async extractDisplayNameAsync(fileAbsolutePath: string): Promise<string> {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return this.getFileNameWithoutExtension(fileAbsolutePath);
      }

      const content = await this.fileRepository.readFileAsync(fileUri, 'utf8');
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
   * パスの有効性を検証（非同期版）
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @param relativePath 検証対象の相対パス
   * @returns 有効な場合true
   */
  async validatePathAsync(novelRootAbsolutePath: string, relativePath: string): Promise<boolean> {
    if (!relativePath || relativePath.trim() === '') {
      return false;
    }

    const absolutePath = path.join(novelRootAbsolutePath, relativePath);
    const fileUri = this.fileRepository.createFileUri(absolutePath);
    return await this.fileRepository.existsAsync(fileUri);
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
