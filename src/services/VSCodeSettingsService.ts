import * as vscode from 'vscode';
import { Logger } from '../utils/Logger.js';

/**
 * VSCode設定管理サービス
 * files.exclude設定などを管理
 */
export class VSCodeSettingsService {
  private logger = Logger.getInstance();

  /**
   * Dialogoi関連ファイルをfiles.exclude設定に追加
   */
  async addDialogoiExcludePatterns(): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('files');
      const currentExclude = config.get<{ [key: string]: boolean }>('exclude') || {};

      const dialogoiPatterns = {
        '**/dialogoi.yaml': true,
        '**/.dialogoi-meta.yaml': true,
        '**/.dialogoi-reviews/**': true,
      };

      // 既存の設定と新しいパターンをマージ
      const updatedExclude = {
        ...currentExclude,
        ...dialogoiPatterns,
      };

      // 設定を更新（グローバル設定に保存）
      await config.update('exclude', updatedExclude, vscode.ConfigurationTarget.Global);

      this.logger.info('Dialogoi関連ファイルをfiles.exclude設定に追加しました');
      return true;
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
      const config = vscode.workspace.getConfiguration('files');
      const currentExclude = config.get<{ [key: string]: boolean }>('exclude') || {};

      const dialogoiPatterns = [
        '**/dialogoi.yaml',
        '**/.dialogoi-meta.yaml',
        '**/.dialogoi-reviews/**',
      ];

      // Dialogoi関連パターンを削除
      const updatedExclude = { ...currentExclude };
      for (const pattern of dialogoiPatterns) {
        delete updatedExclude[pattern];
      }

      // 設定を更新
      await config.update('exclude', updatedExclude, vscode.ConfigurationTarget.Global);

      this.logger.info('Dialogoi関連ファイルをfiles.exclude設定から削除しました');
      return true;
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
      const config = vscode.workspace.getConfiguration('files');
      const currentExclude = config.get<{ [key: string]: boolean }>('exclude') || {};

      const requiredPatterns = [
        '**/dialogoi.yaml',
        '**/.dialogoi-meta.yaml',
        '**/.dialogoi-reviews/**',
      ];

      // 全てのパターンが設定されているかチェック
      return requiredPatterns.every((pattern) => currentExclude[pattern] === true);
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
  getCurrentExcludePatterns(): { [key: string]: boolean } {
    try {
      const config = vscode.workspace.getConfiguration('files');
      return config.get<{ [key: string]: boolean }>('exclude') || {};
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
      const config = vscode.workspace.getConfiguration('files');
      const currentExclude = config.get<{ [key: string]: boolean }>('exclude') || {};

      const dialogoiPatterns = {
        '**/dialogoi.yaml': true,
        '**/.dialogoi-meta.yaml': true,
        '**/.dialogoi-reviews/**': true,
      };

      // 既存の設定と新しいパターンをマージ
      const updatedExclude = {
        ...currentExclude,
        ...dialogoiPatterns,
      };

      // ワークスペース設定に保存
      await config.update('exclude', updatedExclude, vscode.ConfigurationTarget.Workspace);

      this.logger.info('Dialogoi関連ファイルをワークスペースのfiles.exclude設定に追加しました');
      return true;
    } catch (error) {
      this.logger.error(
        'ワークスペースfiles.exclude設定の追加に失敗しました',
        error instanceof Error ? error : String(error),
      );
      return false;
    }
  }
}
