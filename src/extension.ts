import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from './tree/DialogoiTreeDataProvider.js';
import { registerReviewCommands } from './commands/reviewCommands.js';
import { registerCharacterCommands } from './commands/characterCommands.js';
import { registerForeshadowingCommands } from './commands/foreshadowingCommands.js';
import { registerFileCommands } from './commands/fileCommands.js';
import { registerTagCommands } from './commands/tagCommands.js';
import { registerReferenceCommands } from './commands/referenceCommands.js';
import { VSCodeServiceContainer } from './di/VSCodeServiceContainer.js';
import { ServiceContainer } from './di/ServiceContainer.js';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.warn('Dialogoi Editor が起動しました');

  try {
    // VSCode環境でServiceContainerを初期化
    console.warn('ServiceContainer初期化を開始...');
    await VSCodeServiceContainer.initialize(context);
    console.warn('ServiceContainer初期化完了');

    // TreeDataProviderの作成と登録
    console.warn('TreeDataProvider作成を開始...');
    const treeDataProvider = new DialogoiTreeDataProvider();
    console.warn('TreeDataProvider作成完了');

    console.warn('TreeView作成を開始...');
    const treeView = vscode.window.createTreeView('dialogoi-explorer', {
      treeDataProvider: treeDataProvider,
      showCollapseAll: true,
    });
    console.warn('TreeView作成完了');

    // 更新コマンドの実装
    const refreshCommand = vscode.commands.registerCommand('dialogoi.refreshExplorer', () => {
      treeDataProvider.refresh();
      vscode.window.showInformationMessage('Dialogoi Explorer を更新しました');
    });

    // ファイルコマンドの登録
    registerFileCommands(context, treeDataProvider, treeView);

    // タグコマンドの登録
    registerTagCommands(context, treeDataProvider);

    // 参照コマンドの登録
    registerReferenceCommands(context, treeDataProvider);

    // レビューコマンドの登録
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      registerReviewCommands(context, vscode.workspace.workspaceFolders[0].uri);
    }

    // キャラクターコマンドの登録
    registerCharacterCommands(context, treeDataProvider);

    // 伏線コマンドの登録
    registerForeshadowingCommands(context, treeDataProvider);

    context.subscriptions.push(treeView, refreshCommand);
  } catch (error) {
    console.error('拡張機能の初期化中にエラーが発生しました:', error);
    vscode.window.showErrorMessage(
      `Dialogoi Editor の初期化に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deactivate(): void {
  // ServiceContainerのリセット
  const serviceContainer = ServiceContainer.getInstance();
  serviceContainer.reset();
}
