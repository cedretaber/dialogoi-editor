import * as vscode from 'vscode';
import { ServiceContainer, IServiceContainer } from './ServiceContainer.js';
import { VSCodeFileRepository } from '../repositories/VSCodeFileRepository.js';
import { VSCodeSettingsRepository } from '../repositories/VSCodeSettingsRepository.js';
import { FileChangeEvent } from '../services/FileChangeNotificationService.js';
import { VSCodeEventEmitterRepository } from '../repositories/VSCodeEventEmitterRepository.js';

/**
 * VSCode環境専用のServiceContainerファクトリー
 * VSCodeFileOperationServiceを動的にロードする
 */
export class VSCodeServiceContainer {
  /**
   * VSCode環境でServiceContainerを初期化
   */
  static initialize(context: vscode.ExtensionContext): IServiceContainer {
    try {
      // すべてのレポジトリを統一パターンで初期化
      const fileRepository = new VSCodeFileRepository(context);
      const settingsRepository = new VSCodeSettingsRepository();
      const eventEmitterRepository = new VSCodeEventEmitterRepository<FileChangeEvent>();

      // ServiceContainerをコンストラクタ注入で作成
      ServiceContainer.createInstance(fileRepository, settingsRepository, eventEmitterRepository);

      return ServiceContainer.getInstance();
    } catch (error) {
      throw new Error(
        `ServiceContainerの初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
