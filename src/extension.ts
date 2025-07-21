import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from './tree/DialogoiTreeDataProvider.js';
import { registerReviewCommands } from './commands/reviewCommands.js';
import { registerCharacterCommands } from './commands/characterCommands.js';
import { registerForeshadowingCommands } from './commands/foreshadowingCommands.js';
import { registerFileCommands } from './commands/fileCommands.js';
import { registerTagCommands } from './commands/tagCommands.js';
import { registerReferenceCommands } from './commands/referenceCommands.js';
import { registerFilterCommands } from './commands/filterCommands.js';
import { registerProjectCommands } from './commands/projectCommands.js';
import { registerDropCommands } from './commands/dropCommands.js';
import { FileDetailsViewProvider } from './providers/FileDetailsViewProvider.js';
import { VSCodeServiceContainer } from './di/VSCodeServiceContainer.js';
import { ServiceContainer } from './di/ServiceContainer.js';
import { Logger } from './utils/Logger.js';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = Logger.getInstance();
  logger.info('Dialogoi Editor が起動しました');

  try {
    logger.debug('ServiceContainer初期化を開始...');
    await VSCodeServiceContainer.initialize(context);
    logger.debug('ServiceContainer初期化完了');

    // VSCode設定の初期化
    logger.debug('VSCode設定の初期化を開始...');
    const container = ServiceContainer.getInstance();
    const settingsService = container.getDialogoiSettingsService();

    // Dialogoi関連ファイルが設定されていない場合は追加
    if (!settingsService.hasDialogoiExcludePatterns()) {
      const success = await settingsService.addDialogoiExcludePatterns();
      if (success) {
        logger.info('Dialogoi関連ファイルを検索対象から除外しました');
        vscode.window.showInformationMessage(
          'Dialogoi設定ファイルをVSCode検索から除外しました（設定で変更可能）',
        );
      }
    }
    logger.debug('VSCode設定の初期化完了');

    logger.debug('TreeDataProvider作成を開始...');
    const treeDataProvider = new DialogoiTreeDataProvider();
    logger.debug('TreeDataProvider作成完了');

    logger.debug('TreeView作成を開始...');
    const treeView = vscode.window.createTreeView('dialogoi-explorer', {
      treeDataProvider: treeDataProvider,
      showCollapseAll: true,
      dragAndDropController: treeDataProvider,
    });
    logger.debug('TreeView作成完了');

    logger.debug('FileDetailsViewProvider作成を開始...');
    // ServiceContainerはすでに初期化されているので再取得
    const fileDetailsProvider = new FileDetailsViewProvider(context.extensionUri);
    fileDetailsProvider.setTreeDataProvider(treeDataProvider);
    fileDetailsProvider.setMetaYamlService(container.getMetaYamlService());
    fileDetailsProvider.setDialogoiYamlService(container.getDialogoiYamlService());
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        FileDetailsViewProvider.viewType,
        fileDetailsProvider,
      ),
    );
    logger.debug('FileDetailsViewProvider作成完了');

    // ReferenceManagerの初期化
    logger.debug('ReferenceManager初期化を開始...');
    const referenceManager = container.getReferenceManager();
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const metaYamlService = container.getMetaYamlService();
      const novelRoot = metaYamlService.findNovelRoot(workspaceRoot);

      if (novelRoot !== null && novelRoot !== undefined && novelRoot !== '') {
        const fileRepository = container.getFileRepository();
        referenceManager.initialize(novelRoot, fileRepository);
        logger.info(`ReferenceManagerを初期化しました: ${novelRoot}`);
      }
    }
    logger.debug('ReferenceManager初期化完了');

    // ファイル内容変更の監視（ハイパーリンク再抽出用）
    logger.debug('ファイル監視を開始...');
    const fileWatcher = vscode.workspace.onDidSaveTextDocument((document) => {
      // .mdファイルが保存された場合にハイパーリンク参照を更新
      if (document.fileName.endsWith('.md')) {
        try {
          referenceManager.updateFileHyperlinkReferences(document.fileName);
          // TreeViewを更新してUI反映
          treeDataProvider.refresh();
        } catch (error) {
          logger.warn(
            `ハイパーリンク更新エラー: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });
    context.subscriptions.push(fileWatcher);
    logger.debug('ファイル監視開始完了');

    // TreeView選択変更イベントをリスニング
    treeView.onDidChangeSelection((e) => {
      if (e.selection.length > 0) {
        const selectedItem = e.selection[0];
        fileDetailsProvider.updateFileDetails(selectedItem || null);
      } else {
        fileDetailsProvider.updateFileDetails(null);
      }
    });

    // アクティブエディタ変更の監視（タブでファイルを開いた時）
    logger.debug('アクティブエディタ監視を開始...');
    const activeEditorWatcher = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document?.fileName !== undefined && editor.document.fileName !== '') {
        logger.debug(`アクティブエディタ変更: ${editor.document.fileName}`);
        fileDetailsProvider.updateFileDetailsByPath(editor.document.fileName);
      }
    });
    context.subscriptions.push(activeEditorWatcher);

    logger.debug('アクティブエディタ監視開始完了');

    const refreshCommand = vscode.commands.registerCommand('dialogoi.refreshExplorer', () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage('Dialogoi Explorer を更新しました');
    });

    registerFileCommands(context, treeDataProvider, treeView);
    registerTagCommands(context, treeDataProvider);
    registerReferenceCommands(context, treeDataProvider);
    registerFilterCommands(context, treeDataProvider);
    registerProjectCommands(context, treeDataProvider);
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      registerReviewCommands(context, vscode.workspace.workspaceFolders[0].uri);
    }

    registerCharacterCommands(context, treeDataProvider);
    registerForeshadowingCommands(context, treeDataProvider);
    registerDropCommands(context);

    context.subscriptions.push(treeView, refreshCommand);
  } catch (error) {
    logger.error(
      '拡張機能の初期化中にエラーが発生しました',
      error instanceof Error ? error : String(error),
    );
    vscode.window.showErrorMessage(
      `Dialogoi Editor の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deactivate(): void {
  const serviceContainer = ServiceContainer.getInstance();
  serviceContainer.reset();
}
