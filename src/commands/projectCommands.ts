import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import {
  ProjectCreationService,
  ProjectCreationOptions,
} from '../services/ProjectCreationService.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { Logger } from '../utils/Logger.js';

/**
 * プロジェクト関連のコマンドを登録
 */
export function registerProjectCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DialogoiTreeDataProvider,
): void {
  const logger = Logger.getInstance();

  // 新しい小説プロジェクトを開始するコマンド
  const startNewNovelCommand = vscode.commands.registerCommand(
    'dialogoi.startNewNovel',
    async () => {
      try {
        logger.info('新しい小説プロジェクト作成を開始');

        // 現在のワークスペースフォルダを取得
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('ワークスペースフォルダが開かれていません。');
          return;
        }

        const projectRoot = workspaceFolder.uri.fsPath;

        // 小説のタイトルを入力
        const title = await vscode.window.showInputBox({
          prompt: '小説のタイトルを入力してください',
          placeHolder: '例: 魔法学院の日常',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'タイトルを入力してください。';
            }
            return null;
          },
        });

        if (title === undefined || title.trim() === '') {
          return; // ユーザーがキャンセルした場合
        }

        // 著者名を入力
        const author = await vscode.window.showInputBox({
          prompt: '著者名を入力してください',
          placeHolder: '例: 山田太郎',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return '著者名を入力してください。';
            }
            return null;
          },
        });

        if (author === undefined || author.trim() === '') {
          return; // ユーザーがキャンセルした場合
        }

        // オプションでタグを入力
        const tagsInput = await vscode.window.showInputBox({
          prompt: 'タグを入力してください（カンマ区切り、省略可）',
          placeHolder: '例: ファンタジー, 学園, 冒険',
        });

        const tags =
          tagsInput !== undefined && tagsInput.trim() !== ''
            ? tagsInput
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag.length > 0)
            : [];

        // プロジェクト作成サービスを取得
        const fileRepository = ServiceContainer.getInstance().getFileRepository();
        const dialogoiYamlService = ServiceContainer.getInstance().getDialogoiYamlService();
        const templateService = ServiceContainer.getInstance().getDialogoiTemplateService();
        const projectCreationService = new ProjectCreationService(
          fileRepository,
          dialogoiYamlService,
          templateService,
        );

        // プロジェクト作成オプションを設定
        const options: ProjectCreationOptions = {
          title: title.trim(),
          author: author.trim(),
          tags: tags.length > 0 ? tags : undefined,
          overwriteDialogoiYaml: false,
          overwriteMetaYaml: false,
        };

        // プロジェクトを作成
        logger.info(`プロジェクト作成開始: ${projectRoot}`);
        const result = await projectCreationService.createProject(projectRoot, options);

        if (result.success) {
          logger.info('プロジェクト作成成功');
          vscode.window.showInformationMessage(`小説プロジェクト「${title}」を作成しました！`);

          // TreeViewを更新
          treeDataProvider.refresh();

          // 作成されたファイルがあれば通知
          if (result.createdFiles && result.createdFiles.length > 0) {
            logger.debug(`作成されたファイル: ${result.createdFiles.join(', ')}`);
          }
        } else {
          logger.error('プロジェクト作成失敗', result.message);
          vscode.window.showErrorMessage(`プロジェクトの作成に失敗しました: ${result.message}`);

          // エラー詳細をログ出力
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error) => logger.error('プロジェクト作成エラー詳細', error));
          }
        }
      } catch (error) {
        logger.error(
          '新規プロジェクト作成コマンドエラー',
          error instanceof Error ? error : String(error),
        );
        vscode.window.showErrorMessage(
          `プロジェクトの作成中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // プロジェクト設定変更コマンド（視覚的編集画面を表示）
  const editProjectSettingsCommand = vscode.commands.registerCommand(
    'dialogoi.editProjectSettings',
    async () => {
      try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('ワークスペースフォルダが開かれていません。');
          return;
        }

        const projectRoot = workspaceFolder.uri.fsPath;
        const dialogoiYamlService = ServiceContainer.getInstance().getDialogoiYamlService();

        // dialogoi.yamlが存在するかチェック
        if (!dialogoiYamlService.isDialogoiProjectRoot(projectRoot)) {
          vscode.window.showErrorMessage('Dialogoiプロジェクトが見つかりません。');
          return;
        }

        // プロジェクト設定ビューを開く
        await vscode.commands.executeCommand('dialogoi-project-settings.focus');

        vscode.window.showInformationMessage(
          'プロジェクト設定パネルを開きました。フォーム形式で設定を編集できます。',
        );
      } catch (error) {
        logger.error(
          'プロジェクト設定編集コマンドエラー',
          error instanceof Error ? error : String(error),
        );
        vscode.window.showErrorMessage(
          `プロジェクト設定の編集中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // コマンドを登録
  context.subscriptions.push(startNewNovelCommand, editProjectSettingsCommand);

  logger.debug('プロジェクトコマンドを登録完了');
}
