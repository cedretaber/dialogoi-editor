import * as vscode from 'vscode';
import { ServiceContainer } from './ServiceContainer.js';

/**
 * VSCode環境専用のServiceContainerファクトリー
 * VSCodeFileOperationServiceを動的にロードする
 */
export class VSCodeServiceContainer {
  /**
   * VSCode環境でServiceContainerを初期化
   */
  static async initialize(context: vscode.ExtensionContext): Promise<ServiceContainer> {
    const container = ServiceContainer.getInstance();

    try {
      // VSCodeFileOperationServiceを動的にロード
      const { VSCodeFileOperationService } = await import(
        '../services/VSCodeFileOperationService.js'
      );
      const fileOperationService = new VSCodeFileOperationService(context);
      container.setFileOperationService(fileOperationService);

      return container;
    } catch (error) {
      throw new Error(
        `VSCodeFileOperationServiceの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
