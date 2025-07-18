import * as vscode from 'vscode';
import { ServiceContainer, IServiceContainer } from './ServiceContainer.js';

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
      }

      return container;
    } catch (error) {
      throw new Error(
        `VSCodeFileRepositoryの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
