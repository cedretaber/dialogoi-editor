import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { Logger } from '../utils/Logger.js';
import { ProjectSettingsWebviewPanel } from '../views/ProjectSettingsWebviewPanel.js';

/**
 * プロジェクト関連のコマンドを登録
 */
export function registerProjectCommands(
  context: vscode.ExtensionContext,
  _treeDataProvider: DialogoiTreeDataProvider,
): void {
  const logger = Logger.getInstance();
  const container = ServiceContainer.getInstance();
  const dialogoiSettingsService = container.getDialogoiSettingsService();
  const projectSettingsService = container.getProjectSettingsService();

  // 検索除外設定を管理
  const manageExcludeSettingsCommand = vscode.commands.registerCommand(
    'dialogoi.manageExcludeSettings',
    async () => {
      const hasDialogoiPatterns = dialogoiSettingsService.hasDialogoiExcludePatterns();

      const action = await vscode.window.showQuickPick(
        [
          {
            label: hasDialogoiPatterns
              ? '$(eye) Dialogoi 関連ファイルを表示'
              : '$(eye-closed) Dialogoi 関連ファイルを非表示',
            description: hasDialogoiPatterns
              ? '検索結果にDialogoi関連ファイルを含める'
              : '検索結果からDialogoi関連ファイルを除外',
            value: hasDialogoiPatterns ? 'remove' : 'add',
          },
          {
            label: '$(gear) 除外設定を直接編集',
            description: 'VSCodeの設定ファイルを開く',
            value: 'edit',
          },
        ],
        {
          placeHolder: '検索除外設定の管理',
        },
      );

      if (!action) {
        return;
      }

      switch (action.value) {
        case 'add':
          await dialogoiSettingsService.addDialogoiExcludePatterns();
          void vscode.window.showInformationMessage(
            'Dialogoi関連ファイルを検索対象から除外しました',
          );
          break;
        case 'remove':
          await dialogoiSettingsService.removeDialogoiExcludePatterns();
          void vscode.window.showInformationMessage('Dialogoi関連ファイルを検索対象に含めました');
          break;
        case 'edit':
          await vscode.commands.executeCommand('workbench.action.openSettings', 'files.exclude');
          break;
      }
    },
  );

  // 新しい小説プロジェクトを開始
  const startNewNovelCommand = vscode.commands.registerCommand('dialogoi.startNewNovel', () => {
    logger.debug('Starting new novel project');

    // プロジェクト設定パネルを新規プロジェクトモードで表示
    ProjectSettingsWebviewPanel.createOrShow(
      context.extensionUri,
      projectSettingsService,
      logger,
      true, // isNewProject
    );
  });

  // プロジェクト設定を編集
  const editProjectSettingsCommand = vscode.commands.registerCommand(
    'dialogoi.editProjectSettings',
    async () => {
      logger.debug('Opening project settings editor');

      // 現在のワークスペースにDialogoiプロジェクトが存在するか確認
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        void vscode.window.showErrorMessage('ワークスペースフォルダーが開かれていません。');
        return;
      }

      const projectRoot = workspaceFolder.uri.fsPath;
      if (!projectSettingsService.isDialogoiProject(projectRoot)) {
        const action = await vscode.window.showWarningMessage(
          'Dialogoiプロジェクトが見つかりません。新しいプロジェクトを作成しますか？',
          'はい',
          'いいえ',
        );

        if (action === 'はい') {
          // 新規プロジェクトモードで表示
          ProjectSettingsWebviewPanel.createOrShow(
            context.extensionUri,
            projectSettingsService,
            logger,
            true, // isNewProject
          );
        }
        return;
      }

      // 既存プロジェクトの設定編集モードで表示
      ProjectSettingsWebviewPanel.createOrShow(
        context.extensionUri,
        projectSettingsService,
        logger,
        false, // isNewProject
      );
    },
  );

  context.subscriptions.push(
    manageExcludeSettingsCommand,
    startNewNovelCommand,
    editProjectSettingsCommand,
  );
}
