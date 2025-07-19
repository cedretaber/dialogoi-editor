import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * 参照関連のコマンドを登録
 */
export function registerReferenceCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DialogoiTreeDataProvider,
): void {
  // 参照追加コマンド
  const addReferenceCommand = vscode.commands.registerCommand(
    'dialogoi.addReference',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('参照を追加するファイルを選択してください。');
        return;
      }

      const sourceFile = item.name;
      const dirPath = treeDataProvider.getDirectoryPath(item);

      const referencePath = await vscode.window.showInputBox({
        prompt: `${sourceFile} が参照するファイルのパスを入力してください`,
        placeHolder: '例: characters/主人公.md',
        validateInput: (value) => {
          if (!value) {
            return '参照先のファイルパスを入力してください。';
          }
          return null;
        },
      });

      if (referencePath === undefined || referencePath === '') {
        return;
      }

      const result = treeDataProvider.addReference(dirPath, sourceFile, referencePath);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // 参照削除コマンド
  const removeReferenceCommand = vscode.commands.registerCommand(
    'dialogoi.removeReference',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('参照を削除するファイルを選択してください。');
        return;
      }

      const currentReferences = item.references || [];
      if (currentReferences.length === 0) {
        vscode.window.showInformationMessage(`${item.name} には参照が設定されていません。`);
        return;
      }

      const referenceToRemove = await vscode.window.showQuickPick(currentReferences, {
        placeHolder: '削除する参照を選択してください',
      });

      if (referenceToRemove === undefined || referenceToRemove === '') {
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.removeReference(dirPath, item.name, referenceToRemove);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // 参照編集コマンド
  const editReferencesCommand = vscode.commands.registerCommand(
    'dialogoi.editReferences',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('参照を編集するファイルを選択してください。');
        return;
      }

      const currentReferences = item.references || [];
      const currentReferencesStr = currentReferences.length > 0 ? currentReferences.join(', ') : '';

      const newReferencesStr = await vscode.window.showInputBox({
        prompt: `${item.name} の参照を編集してください（カンマ区切り）`,
        value: currentReferencesStr,
        placeHolder: '例: characters/主人公.md, settings/世界観.md',
      });

      if (newReferencesStr === undefined) {
        return;
      }

      // 空文字列の場合は空配列、それ以外はカンマで分割してトリム
      const newReferences = newReferencesStr === '' 
        ? [] 
        : newReferencesStr.split(',').map((r) => r.trim()).filter((r) => r !== '');

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.setReferences(dirPath, item.name, newReferences);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  context.subscriptions.push(addReferenceCommand, removeReferenceCommand, editReferencesCommand);
}