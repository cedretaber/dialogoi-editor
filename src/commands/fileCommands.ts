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
  // ファイル作成コマンド（ルートディレクトリ）
  const createFileCommand = vscode.commands.registerCommand('dialogoi.createFile', async () => {
    // 現在選択されているアイテムを取得
    let targetDir: string;

    // 現在選択されているアイテムを取得
    const selection = treeView.selection;
    if (selection !== undefined && selection.length > 0 && selection[0] !== undefined) {
      const selectedItem = selection[0];
      targetDir = treeDataProvider.getDirectoryPath(selectedItem);
    } else {
      // 何も選択されていない場合はルートディレクトリ
      const currentDir = treeDataProvider.getCurrentDirectory();
      if (currentDir === null || currentDir === '') {
        vscode.window.showErrorMessage('小説プロジェクトが見つかりません。');
        return;
      }
      targetDir = currentDir;
    }

    await createFileInDirectory(targetDir, treeDataProvider);
  });

  // ディレクトリ内にファイル作成コマンド
  const createFileInDirectoryCommand = vscode.commands.registerCommand(
    'dialogoi.createFileInDirectory',
    async (item: DialogoiTreeItem) => {
      let targetDir: string;

      if (item !== undefined && item.path !== undefined && item.path !== '') {
        // 選択したアイテムのディレクトリパスを取得
        targetDir = treeDataProvider.getDirectoryPath(item);
      } else {
        // 何も選択していない場合はルートディレクトリ
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

  // ファイル削除コマンド
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

  // ファイル名変更コマンド
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
  // ファイル種別を選択
  const fileTypes = [
    { label: '本文', value: 'content' },
    { label: '設定（キャラクター）', value: 'character' },
    { label: '設定（伏線）', value: 'foreshadowing' },
    { label: '設定（その他）', value: 'setting' },
    { label: 'サブディレクトリ', value: 'subdirectory' },
  ];

  const fileType = await vscode.window.showQuickPick(fileTypes, {
    placeHolder: '作成するファイルの種類を選択してください',
  });

  if (!fileType) {
    return;
  }

  // ファイル名を入力
  const baseFileName = await vscode.window.showInputBox({
    prompt: `${fileType.label}の名前を入力してください（拡張子は自動で付与されます）`,
    placeHolder: fileType.value === 'subdirectory' ? 'フォルダ名' : 'ファイル名',
  });

  if (baseFileName === undefined || baseFileName === '') {
    return;
  }

  // 拡張子を自動で付与
  let fileName: string;
  if (fileType.value === 'subdirectory') {
    fileName = baseFileName; // ディレクトリには拡張子を付けない
  } else {
    fileName = baseFileName.endsWith('.md') ? baseFileName : `${baseFileName}.md`;
  }

  // ファイル作成
  treeDataProvider.createFile(
    targetDir,
    fileName,
    fileType.value as 'content' | 'setting' | 'subdirectory',
  );
}