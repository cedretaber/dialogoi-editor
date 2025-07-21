import { Logger } from '../utils/Logger.js';
import { SettingsRepository, ExcludePatterns } from '../repositories/SettingsRepository.js';

/**
 * Dialogoi関連の設定管理サービス
 * files.exclude設定などを管理
 */
export class DialogoiSettingsService {
  private logger = Logger.getInstance();

  /**
   * Dialogoi関連のファイルパターン
   */
  private static readonly DIALOGOI_PATTERNS = {
    '**/dialogoi.yaml': true,
    '**/.dialogoi-meta.yaml': true,
    '**/.dialogoi-reviews/**': true,
  };

  constructor(private settingsRepository: SettingsRepository) {}

  /**
   * Dialogoi関連ファイルをfiles.exclude設定に追加
   */
  async addDialogoiExcludePatterns(): Promise<boolean> {
    try {
      const currentExclude = this.settingsRepository.get<ExcludePatterns>('files', 'exclude') || {};

      // 既存の設定と新しいパターンをマージ
      const updatedExclude = {
        ...currentExclude,
        ...DialogoiSettingsService.DIALOGOI_PATTERNS,
      };

      // 設定を更新（グローバル設定に保存）
      const success = await this.settingsRepository.update(
        'files',
        'exclude',
        updatedExclude,
        'global',
      );

      if (success) {
        this.logger.info('Dialogoi関連ファイルをfiles.exclude設定に追加しました');
      }
      return success;
    } catch (error) {
      this.logger.error(
        'files.exclude設定の追加に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }

  /**
   * Dialogoi関連ファイルをfiles.exclude設定から削除
   */
  async removeDialogoiExcludePatterns(): Promise<boolean> {
    try {
      const currentExclude = this.settingsRepository.get<ExcludePatterns>('files', 'exclude') || {};

      // Dialogoi関連パターンを削除
      const updatedExclude = { ...currentExclude };
      for (const pattern of Object.keys(DialogoiSettingsService.DIALOGOI_PATTERNS)) {
        delete updatedExclude[pattern];
      }

      // 設定を更新
      const success = await this.settingsRepository.update(
        'files',
        'exclude',
        updatedExclude,
        'global',
      );

      if (success) {
        this.logger.info('Dialogoi関連ファイルをfiles.exclude設定から削除しました');
      }
      return success;
    } catch (error) {
      this.logger.error(
        'files.exclude設定の削除に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }

  /**
   * Dialogoi関連パターンが既に設定されているかチェック
   */
  hasDialogoiExcludePatterns(): boolean {
    try {
      const currentExclude = this.settingsRepository.get<ExcludePatterns>('files', 'exclude') || {};

      // 全てのパターンが設定されているかチェック
      return Object.keys(DialogoiSettingsService.DIALOGOI_PATTERNS).every(
        (pattern) => currentExclude[pattern] === true,
      );
    } catch (error) {
      this.logger.error(
        'files.exclude設定の確認に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }

  /**
   * 現在のfiles.exclude設定を取得
   */
  getCurrentExcludePatterns(): ExcludePatterns {
    try {
      return this.settingsRepository.get<ExcludePatterns>('files', 'exclude') || {};
    } catch (error) {
      this.logger.error(
        'files.exclude設定の取得に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return {};
    }
  }

  /**
   * ワークスペース固有の除外設定を追加
   */
  async addWorkspaceExcludePatterns(): Promise<boolean> {
    try {
      const currentExclude = this.settingsRepository.get<ExcludePatterns>('files', 'exclude') || {};

      // 既存の設定と新しいパターンをマージ
      const updatedExclude = {
        ...currentExclude,
        ...DialogoiSettingsService.DIALOGOI_PATTERNS,
      };

      // ワークスペース設定に保存
      const success = await this.settingsRepository.update(
        'files',
        'exclude',
        updatedExclude,
        'workspace',
      );

      if (success) {
        this.logger.info('Dialogoi関連ファイルをワークスペースのfiles.exclude設定に追加しました');
      }
      return success;
    } catch (error) {
      this.logger.error(
        'ワークスペースfiles.exclude設定の追加に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }
}
