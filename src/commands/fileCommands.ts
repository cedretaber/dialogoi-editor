import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * ファイル関連のコマンドを登録
 */
export function registerFileCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DialogoiTreeDataProvider,
  treeView: vscode.TreeView<DialogoiTreeItem>,
): void {
  const createFileCommand = vscode.commands.registerCommand('dialogoi.createFile', async () => {
    let targetDir: string;
    const selection = treeView.selection;
    if (selection !== undefined && selection.length > 0 && selection[0] !== undefined) {
      const selectedItem = selection[0];
      targetDir = treeDataProvider.getDirectoryPath(selectedItem);
    } else {
      const currentDir = treeDataProvider.getCurrentDirectory();
      if (currentDir === null || currentDir === '') {
        vscode.window.showErrorMessage('小説プロジェクトが見つかりません。');
        return;
      }
      targetDir = currentDir;
    }

    await createFileInDirectory(targetDir, treeDataProvider);
  });

  const createFileInDirectoryCommand = vscode.commands.registerCommand(
    'dialogoi.createFileInDirectory',
    async (item: DialogoiTreeItem) => {
      let targetDir: string;

      if (item !== undefined && item.path !== undefined && item.path !== '') {
        targetDir = treeDataProvider.getDirectoryPath(item);
      } else {
        const currentDir = treeDataProvider.getCurrentDirectory();
        if (currentDir === null || currentDir === '') {
          vscode.window.showErrorMessage('小説プロジェクトが見つかりません。');
          return;
        }
        targetDir = currentDir;
      }

      await createFileInDirectory(targetDir, treeDataProvider);
    },
  );

  const deleteFileCommand = vscode.commands.registerCommand(
    'dialogoi.deleteFile',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('削除するファイルを選択してください。');
        return;
      }

      const answer = await vscode.window.showWarningMessage(
        `"${item.name}" を削除しますか？`,
        { modal: true },
        '削除',
      );

      if (answer === '削除') {
        const dirPath = treeDataProvider.getDirectoryPath(item);
        treeDataProvider.deleteFile(dirPath, item.name);
      }
    },
  );

  const renameFileCommand = vscode.commands.registerCommand(
    'dialogoi.renameFile',
    async (item: DialogoiTreeItem) => {
      if (item === undefined || item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('リネームするファイルを選択してください。');
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '新しいファイル名を入力してください',
        value: item.name,
      });

      if (newName === undefined || newName === '' || newName === item.name) {
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      treeDataProvider.renameFile(dirPath, item.name, newName);
    },
  );

  context.subscriptions.push(
    createFileCommand,
    createFileInDirectoryCommand,
    deleteFileCommand,
    renameFileCommand,
  );
}

/**
 * ディレクトリ内にファイルを作成する共通処理
 */
async function createFileInDirectory(
  targetDir: string,
  treeDataProvider: DialogoiTreeDataProvider,
): Promise<void> {
  const fileTypes = [
    { label: '本文', value: 'content', subtype: undefined },
    { label: '設定（キャラクター）', value: 'setting', subtype: 'character' },
    { label: '設定（伏線）', value: 'setting', subtype: 'foreshadowing' },
    { label: '設定（用語集）', value: 'setting', subtype: 'glossary' },
    { label: '設定（その他）', value: 'setting', subtype: undefined },
    { label: 'サブディレクトリ', value: 'subdirectory', subtype: undefined },
  ];

  const fileType = await vscode.window.showQuickPick(fileTypes, {
    placeHolder: '作成するファイルの種類を選択してください',
  });

  if (!fileType) {
    return;
  }

  const baseFileName = await vscode.window.showInputBox({
    prompt: `${fileType.label}の名前を入力してください（拡張子は自動で付与されます）`,
    placeHolder: fileType.value === 'subdirectory' ? 'フォルダ名' : 'ファイル名',
  });

  if (baseFileName === undefined || baseFileName === '') {
    return;
  }

  let fileName: string;
  if (fileType.value === 'subdirectory') {
    fileName = baseFileName;
  } else {
    // ファイル種別に応じて適切な拡張子を設定
    // content（本文）→ .txt、setting（設定）→ .md
    if (fileType.value === 'content') {
      fileName = baseFileName.endsWith('.txt') ? baseFileName : `${baseFileName}.txt`;
    } else {
      fileName = baseFileName.endsWith('.md') ? baseFileName : `${baseFileName}.md`;
    }
  }

  treeDataProvider.createFile(
    targetDir,
    fileName,
    fileType.value as 'content' | 'setting' | 'subdirectory',
    '',
    [],
    fileType.subtype as 'character' | 'foreshadowing' | 'glossary' | undefined,
  );
}
