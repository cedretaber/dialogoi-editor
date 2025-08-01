import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { DialogoiTreeItem, isCharacterItem } from '../models/DialogoiTreeItem.js';

export function registerCharacterCommands(
  context: vscode.ExtensionContext,
  provider: DialogoiTreeDataProvider,
): void {
  // キャラクター重要度編集コマンド
  const editCharacterImportanceCommand = vscode.commands.registerCommand(
    'dialogoi.editCharacterImportance',
    async (item: DialogoiTreeItem) => {
      const dirPath = provider.getDirectoryPath(item);
      const fileName = item.name;

      // 現在の設定を取得
      const currentImportance = isCharacterItem(item) ? item.character.importance : 'sub';

      // 重要度選択肢
      const importanceOptions = [
        { label: '⭐ main - 主要キャラクター', value: 'main' as const },
        { label: '👤 sub - サブキャラクター', value: 'sub' as const },
        { label: '👥 background - 背景キャラクター', value: 'background' as const },
      ];

      const selected = await vscode.window.showQuickPick(importanceOptions, {
        placeHolder: `現在の重要度: ${currentImportance}`,
        title: `${fileName} のキャラクター重要度を選択`,
      });

      if (selected !== undefined) {
        const fileManagementService = ServiceContainer.getInstance().getFileManagementService();
        const result = await fileManagementService.setCharacterImportance(
          dirPath,
          fileName,
          selected.value,
        );

        if (result.success) {
          provider.refresh();
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      }
    },
  );

  // 複数キャラクターフラグ切り替えコマンド
  const toggleMultipleCharactersCommand = vscode.commands.registerCommand(
    'dialogoi.toggleMultipleCharacters',
    async (item: DialogoiTreeItem) => {
      const dirPath = provider.getDirectoryPath(item);
      const fileName = item.name;

      // 現在の設定を取得
      const currentMultiple = isCharacterItem(item) ? item.character.multiple_characters : false;

      // 確認ダイアログ
      const newValue = !currentMultiple;
      const action = newValue ? '有効' : '無効';
      const confirmation = await vscode.window.showQuickPick(
        [
          { label: `✅ はい - 複数キャラクターフラグを${action}にする`, value: true },
          { label: `❌ いいえ - キャンセル`, value: false },
        ],
        {
          placeHolder: `現在の設定: ${currentMultiple ? '有効' : '無効'}`,
          title: `${fileName} の複数キャラクターフラグを${action}にしますか？`,
        },
      );

      if (confirmation?.value === true) {
        const fileManagementService = ServiceContainer.getInstance().getFileManagementService();
        const result = await fileManagementService.setMultipleCharacters(
          dirPath,
          fileName,
          newValue,
        );

        if (result.success) {
          provider.refresh();
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
      }
    },
  );

  context.subscriptions.push(editCharacterImportanceCommand);
  context.subscriptions.push(toggleMultipleCharactersCommand);
}
