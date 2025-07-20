import * as vscode from 'vscode';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { DropHandlerService, DroppedFileInfo, DropResult } from '../services/DropHandlerService.js';
import { Logger } from '../utils/Logger.js';

/**
 * ドラッグ&ドロップ関連のコマンドを登録
 */
export function registerDropCommands(context: vscode.ExtensionContext): void {
  const logger = Logger.getInstance();
  const serviceContainer = ServiceContainer.getInstance();
  const dropHandlerService = serviceContainer.getDropHandlerService();

  // DocumentDropEditProviderを登録
  const dropProvider = new DocumentDropProvider(dropHandlerService);

  const documentDropRegistration = vscode.languages.registerDocumentDropEditProvider(
    { scheme: 'file' },
    dropProvider,
  );

  context.subscriptions.push(documentDropRegistration);
  logger.info('ドラッグ&ドロップコマンドを登録しました');
}

/**
 * エディタへのドロップ処理を提供するクラス
 */
class DocumentDropProvider implements vscode.DocumentDropEditProvider {
  private logger = Logger.getInstance();

  readonly dropMimeTypes = ['application/vnd.code.tree.dialogoi-explorer', 'text/uri-list'];

  constructor(private dropHandlerService: DropHandlerService) {}

  provideDocumentDropEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): vscode.DocumentDropEdit | undefined {
    this.logger.info(
      `ドロップイベント検知: ${document.fileName} at ${position.line}:${position.character}`,
    );

    try {
      // Dialogoi TreeViewからのドロップデータを確認
      const dialogoiData = dataTransfer.get('application/vnd.code.tree.dialogoi-explorer');
      if (dialogoiData) {
        return this.handleDialogoiTreeDrop(document, position, dialogoiData);
      }

      // 外部ファイルドロップ（将来の拡張）
      const uriListData = dataTransfer.get('text/uri-list');
      if (uriListData) {
        this.logger.debug('外部ファイルドロップは現在サポートされていません');
        return undefined;
      }

      return undefined;
    } catch (error) {
      this.logger.error(
        'ドロップ処理中にエラーが発生しました',
        error instanceof Error ? error : String(error),
      );
      vscode.window.showErrorMessage(
        `ドロップ処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  /**
   * Dialogoi TreeViewからのドロップを処理
   */
  private handleDialogoiTreeDrop(
    document: vscode.TextDocument,
    position: vscode.Position,
    dataTransfer: vscode.DataTransferItem,
  ): vscode.DocumentDropEdit | undefined {
    const dataValue: unknown = dataTransfer.value;
    if (dataValue === null || dataValue === undefined || typeof dataValue !== 'string') {
      this.logger.warn('無効なドロップデータです');
      return undefined;
    }

    let droppedData: DroppedFileInfo;
    try {
      const parsed: unknown = JSON.parse(dataValue);
      droppedData = parsed as DroppedFileInfo;
    } catch (error) {
      this.logger.warn(
        'ドロップデータのパースに失敗しました',
        error instanceof Error ? error : String(error),
      );
      return undefined;
    }

    // DropHandlerServiceでビジネスロジックを実行
    const result = this.dropHandlerService.handleDrop(document.uri.fsPath, droppedData);

    // 結果をVSCode APIで反映
    return this.applyDropResult(document, position, result);
  }

  /**
   * ドロップ結果をVSCode APIで適用
   */
  private applyDropResult(
    _document: vscode.TextDocument,
    _position: vscode.Position,
    result: DropResult,
  ): vscode.DocumentDropEdit | undefined {
    if (!result.success) {
      // エラーメッセージを表示
      vscode.window.showWarningMessage(result.message);
      return undefined;
    }

    if (
      result.insertText !== null &&
      result.insertText !== undefined &&
      result.insertText.length > 0
    ) {
      // 設定ファイル: マークダウンリンクを挿入
      const snippetString = new vscode.SnippetString(result.insertText);
      const dropEdit = new vscode.DocumentDropEdit(snippetString);

      // 成功メッセージを表示
      vscode.window.showInformationMessage(result.message);

      return dropEdit;
    } else {
      // 本文ファイル: referencesに追加（UI更新のみ）
      vscode.window.showInformationMessage(result.message);

      // TreeViewを更新してUI反映
      vscode.commands.executeCommand('dialogoi.refreshExplorer');

      return undefined;
    }
  }
}
