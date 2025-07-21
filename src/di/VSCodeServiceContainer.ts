import * as vscode from 'vscode';
import { ServiceContainer, IServiceContainer } from './ServiceContainer.js';
import { VSCodeSettingsRepository } from '../repositories/VSCodeSettingsRepository.js';
import {
  FileChangeNotificationService,
  FileChangeEvent,
} from '../services/FileChangeNotificationService.js';
import { VSCodeEventEmitterRepository } from '../repositories/VSCodeEventEmitterRepository.js';

/**
 * VSCode環境専用のServiceContainerファクトリー
 * VSCodeFileOperationServiceを動的にロードする
 */
export class VSCodeServiceContainer {
  /**
   * VSCode環境でServiceContainerを初期化
   */
  static async initialize(context: vscode.ExtensionContext): Promise<IServiceContainer> {
    const container = ServiceContainer.getInstance();

    try {
      // VSCodeFileRepositoryを動的にロード
      const { VSCodeFileRepository } = await import('../repositories/VSCodeFileRepository.js');
      const fileRepository = new VSCodeFileRepository(context);

      // ServiceContainerが具体的なクラスなのでキャストして使用
      if (container instanceof ServiceContainer) {
        container.setFileRepository(fileRepository);

        // FileChangeNotificationServiceの初期化
        const eventEmitterRepository = new VSCodeEventEmitterRepository<FileChangeEvent>();
        FileChangeNotificationService.setInstance(eventEmitterRepository);

        // SettingsRepositoryの初期化
        const settingsRepository = new VSCodeSettingsRepository();
        container.setSettingsRepository(settingsRepository);
      }

      return container;
    } catch (error) {
      throw new Error(
        `VSCodeFileRepositoryの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
