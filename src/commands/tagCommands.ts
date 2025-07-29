import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { DialogoiTreeItem, hasTagsProperty } from '../utils/MetaYamlUtils.js';

/**
 * タグ関連のコマンドを登録
 */
export function registerTagCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DialogoiTreeDataProvider,
): void {
  // タグ追加コマンド
  const addTagCommand = vscode.commands.registerCommand(
    'dialogoi.addTag',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('タグを追加するファイルを選択してください。');
        return;
      }

      const newTag = await vscode.window.showInputBox({
        prompt: `${item.name} に追加するタグを入力してください`,
        placeHolder: 'タグ名',
        validateInput: (value) => {
          if (!value) {
            return 'タグ名を入力してください。';
          }
          if (value.includes(' ')) {
            return 'タグ名にスペースは使用できません。';
          }
          return null;
        },
      });

      if (newTag === undefined || newTag === '') {
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = await treeDataProvider.addTag(dirPath, item.name, newTag);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // タグ削除コマンド
  const removeTagCommand = vscode.commands.registerCommand(
    'dialogoi.removeTag',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('タグを削除するファイルを選択してください。');
        return;
      }

      // サブディレクトリにはタグがない
      if (!hasTagsProperty(item)) {
        vscode.window.showInformationMessage(
          `${item.name} にはタグを設定できません（コンテンツ・設定ファイルのみ対応）。`,
        );
        return;
      }

      const currentTags = item.tags;
      if (currentTags.length === 0) {
        vscode.window.showInformationMessage(`${item.name} にはタグが設定されていません。`);
        return;
      }

      const tagToRemove = await vscode.window.showQuickPick(
        currentTags.map((tag: string) => ({ label: `#${tag}`, value: tag })),
        {
          placeHolder: '削除するタグを選択してください',
        },
      );

      if (tagToRemove === undefined) {
        return;
      }

      // QuickPickItemのvalueプロパティからタグ名を取得
      const tagName = (tagToRemove as { label: string; value: string }).value;

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = await treeDataProvider.removeTag(dirPath, item.name, tagName);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // タグ編集コマンド
  const editTagsCommand = vscode.commands.registerCommand(
    'dialogoi.editTags',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('タグを編集するファイルを選択してください。');
        return;
      }

      // サブディレクトリにはタグがない
      if (!hasTagsProperty(item)) {
        vscode.window.showInformationMessage(
          `${item.name} にはタグを設定できません（コンテンツ・設定ファイルのみ対応）。`,
        );
        return;
      }

      const currentTags = item.tags;
      const currentTagsStr = currentTags.length > 0 ? currentTags.join(', ') : '';

      const newTagsStr = await vscode.window.showInputBox({
        prompt: `${item.name} のタグを編集してください（カンマ区切り）`,
        value: currentTagsStr,
        placeHolder: '例: タグ1, タグ2, タグ3',
        validateInput: (value) => {
          if (value) {
            const tags = value.split(',').map((t) => t.trim());
            for (const tag of tags) {
              if (tag && tag.includes(' ')) {
                return 'タグ名にスペースは使用できません。';
              }
            }
          }
          return null;
        },
      });

      if (newTagsStr === undefined) {
        return;
      }

      // 空文字列の場合は空配列、それ以外はカンマで分割してトリム
      const newTags =
        newTagsStr === ''
          ? []
          : newTagsStr
              .split(',')
              .map((t) => t.trim())
              .filter((t) => t !== '');

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = await treeDataProvider.setTags(dirPath, item.name, newTags);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  context.subscriptions.push(addTagCommand, removeTagCommand, editTagsCommand);
}
