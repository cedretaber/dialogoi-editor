import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

export function registerForeshadowingCommands(
  context: vscode.ExtensionContext,
  provider: DialogoiTreeDataProvider,
): void {
  // 伏線設定編集コマンド
  const editForeshadowingCommand = vscode.commands.registerCommand(
    'dialogoi.editForeshadowing',
    async (item: DialogoiTreeItem) => {
      const dirPath = provider.getDirectoryPath(item);
      const fileName = item.name;
      const novelRoot = provider.getNovelRoot();

      if (novelRoot === null || novelRoot === undefined) {
        vscode.window.showErrorMessage('小説プロジェクトが見つかりません');
        return;
      }

      // 現在の設定を取得
      const currentStart = item.foreshadowing?.start ?? '';
      const currentGoal = item.foreshadowing?.goal ?? '';

      // 埋蔵位置の入力
      const startPath = await vscode.window.showInputBox({
        prompt: '埋蔵位置（start）を入力してください（小説ルートからの相対パス）',
        value: currentStart,
        placeHolder: 'contents/chapter1.txt',
        validateInput: (value) => {
          if (value === null || value === undefined || value.trim() === '') {
            return '埋蔵位置は必須です';
          }
          const foreshadowingService = ServiceContainer.getInstance().getForeshadowingService();
          if (!foreshadowingService.validatePath(novelRoot, value)) {
            return `指定されたファイルが存在しません: ${value}`;
          }
          return null;
        },
      });

      if (startPath === undefined) {
        return; // キャンセル
      }

      // 回収位置の入力
      const goalPath = await vscode.window.showInputBox({
        prompt: '回収位置（goal）を入力してください（小説ルートからの相対パス）',
        value: currentGoal,
        placeHolder: 'contents/chapter3.txt',
        validateInput: (value) => {
          if (value === null || value === undefined || value.trim() === '') {
            return '回収位置は必須です';
          }
          const foreshadowingService = ServiceContainer.getInstance().getForeshadowingService();
          if (!foreshadowingService.validatePath(novelRoot, value)) {
            return `指定されたファイルが存在しません: ${value}`;
          }
          return null;
        },
      });

      if (goalPath === undefined) {
        return; // キャンセル
      }

      // 伏線データの検証
      const foreshadowingData = { start: startPath, goal: goalPath };
      const foreshadowingService = ServiceContainer.getInstance().getForeshadowingService();
      const validation = foreshadowingService.validateForeshadowing(novelRoot, foreshadowingData);

      if (!validation.valid) {
        vscode.window.showErrorMessage(
          `入力データに問題があります: ${validation.errors.join(', ')}`,
        );
        return;
      }

      // 確認ダイアログ
      const status = foreshadowingService.getForeshadowingStatus(novelRoot, foreshadowingData);
      const statusText = {
        planted: '埋蔵済み',
        resolved: '回収済み',
        planned: '計画中',
        error: 'エラー',
      }[status];

      const confirmation = await vscode.window.showQuickPick(
        [
          { label: `✅ 保存 - 伏線を設定する（状態: ${statusText}）`, value: true },
          { label: `❌ キャンセル`, value: false },
        ],
        {
          placeHolder: `埋蔵位置: ${startPath} → 回収位置: ${goalPath}`,
          title: `${fileName} の伏線設定を保存しますか？`,
        },
      );

      if (confirmation?.value === true) {
        const fileRepository = ServiceContainer.getInstance().getFileRepository();
        const result = fileRepository.setForeshadowing(dirPath, fileName, foreshadowingData);

        if (result.success) {
          provider.refresh();
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      }
    },
  );

  // 伏線削除コマンド
  const removeForeshadowingCommand = vscode.commands.registerCommand(
    'dialogoi.removeForeshadowing',
    async (item: DialogoiTreeItem) => {
      const dirPath = provider.getDirectoryPath(item);
      const fileName = item.name;

      if (!item.foreshadowing) {
        vscode.window.showInformationMessage('このファイルに伏線設定はありません');
        return;
      }

      // 確認ダイアログ
      const confirmation = await vscode.window.showQuickPick(
        [
          { label: `✅ 削除 - 伏線設定を削除する`, value: true },
          { label: `❌ キャンセル`, value: false },
        ],
        {
          placeHolder: `埋蔵位置: ${item.foreshadowing.start} → 回収位置: ${item.foreshadowing.goal}`,
          title: `${fileName} の伏線設定を削除しますか？`,
        },
      );

      if (confirmation?.value === true) {
        const fileRepository = ServiceContainer.getInstance().getFileRepository();
        const result = fileRepository.removeForeshadowing(dirPath, fileName);

        if (result.success) {
          provider.refresh();
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      }
    },
  );

  context.subscriptions.push(editForeshadowingCommand);
  context.subscriptions.push(removeForeshadowingCommand);
}
