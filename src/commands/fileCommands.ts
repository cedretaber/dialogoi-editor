import * as vscode from 'vscode';
import * as path from 'path';
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
        await treeDataProvider.deleteFile(dirPath, item.name);
      }
    },
  );

  const renameFileCommand = vscode.commands.registerCommand(
    'dialogoi.renameFile',
    async (item?: DialogoiTreeItem) => {
      // キーバインドから呼び出された場合は、選択中のアイテムを取得
      if (item === undefined) {
        const selection = treeView.selection;
        if (selection !== undefined && selection.length > 0 && selection[0] !== undefined) {
          item = selection[0];
        } else {
          vscode.window.showWarningMessage('名前を変更するファイルを選択してください。');
          return;
        }
      }

      if (item.name === undefined || item.name === '') {
        vscode.window.showErrorMessage('名前を変更できないアイテムです。');
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const currentDir = treeDataProvider.getCurrentDirectory();
      const relativePrompt =
        currentDir !== null && currentDir !== undefined
          ? path.relative(currentDir, dirPath)
          : dirPath;
      const newName = await vscode.window.showInputBox({
        prompt: `新しいファイル名を入力してください（現在のパス: ${relativePrompt}）`,
        value: item.name,
        placeHolder: item.name,
        validateInput: createValidateInput(dirPath, item.name),
      });

      if (newName === undefined || newName === '' || newName === item.name) {
        return;
      }

      await treeDataProvider.renameFile(dirPath, item.name, newName);
    },
  );

  const deleteDirectoryCommand = vscode.commands.registerCommand(
    'dialogoi.deleteDirectory',
    async (item: DialogoiTreeItem) => {
      if (
        item === undefined ||
        item.name === undefined ||
        item.name === '' ||
        item.type !== 'subdirectory'
      ) {
        vscode.window.showErrorMessage('削除するディレクトリを選択してください。');
        return;
      }

      // ディレクトリの場合、親ディレクトリを取得する必要がある
      const parentDir = path.dirname(item.path);
      await treeDataProvider.deleteDirectory(parentDir, item.name);
    },
  );

  context.subscriptions.push(
    createFileCommand,
    createFileInDirectoryCommand,
    deleteFileCommand,
    renameFileCommand,
    deleteDirectoryCommand,
  );
}

/**
 * ファイル名バリデーション関数を作成（名前変更用）
 */
function createValidateInput(
  dirPath: string,
  currentName: string,
): (value: string) => Promise<string | undefined> {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  return (value: string): Promise<string | undefined> => {
    // デバウンス処理：短時間の連続入力は無視
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    return new Promise((resolve) => {
      debounceTimer = setTimeout(() => {
        void (async (): Promise<void> => {
          if (!value.trim()) {
            resolve('ファイル名を入力してください');
            return;
          }

          // 不正文字チェック
          const invalidChars = /[<>:"/\\|?*]/g;
          if (invalidChars.test(value)) {
            resolve('ファイル名に使用できない文字が含まれています: < > : " / \\ | ? *');
            return;
          }

          // 同じ名前の場合はスキップ
          if (value === currentName) {
            resolve(undefined);
            return;
          }

          // 重複チェック
          const targetPath = path.join(dirPath, value);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
            resolve(`"${value}" は既に存在します（完全パス: ${targetPath}）`);
          } catch {
            // ファイルが存在しない場合は正常
            resolve(undefined);
          }
        })();
      }, 150); // 150msのデバウンス
    });
  };
}

/**
 * ファイル名バリデーション関数を作成（ファイル作成用）
 */
function createValidateInputForCreate(
  targetDir: string,
  fileType: { label: string; value: string; subtype: string | undefined },
): (value: string) => Promise<string | undefined> {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  return (value: string): Promise<string | undefined> => {
    // デバウンス処理
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    return new Promise((resolve) => {
      debounceTimer = setTimeout(() => {
        void (async (): Promise<void> => {
          if (!value.trim()) {
            resolve(
              `${fileType.value === 'subdirectory' ? 'フォルダ名' : 'ファイル名'}を入力してください`,
            );
            return;
          }

          // 不正文字チェック
          const invalidChars = /[<>:"/\\|?*]/g;
          if (invalidChars.test(value)) {
            resolve('ファイル名に使用できない文字が含まれています: < > : " / \\ | ? *');
            return;
          }

          // 最終ファイル名を決定（拡張子自動付与）
          let finalFileName: string;
          if (fileType.value === 'subdirectory') {
            finalFileName = value;
          } else {
            if (fileType.value === 'content') {
              finalFileName = value.endsWith('.txt') ? value : `${value}.txt`;
            } else {
              finalFileName = value.endsWith('.md') ? value : `${value}.md`;
            }
          }

          // 重複チェック
          const targetPath = path.join(targetDir, finalFileName);
          try {
            await vscode.workspace.fs.stat(vscode.Uri.file(targetPath));
            resolve(`"${finalFileName}" は既に存在します`);
          } catch {
            // ファイルが存在しない場合は正常
            // 拡張子が自動付与される場合の説明を含める
            if (finalFileName !== value) {
              resolve(undefined); // 成功時はプレビューメッセージを表示しない（混乱を避けるため）
            } else {
              resolve(undefined);
            }
          }
        })();
      }, 150); // 150msのデバウンス
    });
  };
}

/**
 * ファイル種別に応じた拡張子情報を取得
 */
function getExtensionInfo(fileTypeValue: string): string | null {
  switch (fileTypeValue) {
    case 'content':
      return '.txt';
    case 'setting':
      return '.md';
    case 'subdirectory':
      return null;
    default:
      return null;
  }
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

  const extensionInfo = getExtensionInfo(fileType.value);
  const baseFileName = await vscode.window.showInputBox({
    prompt: `${fileType.label}の名前を入力してください`,
    placeHolder:
      fileType.value === 'subdirectory'
        ? 'フォルダ名'
        : `ファイル名${extensionInfo !== null ? ' (拡張子: ' + extensionInfo + ')' : ''}`,
    validateInput: createValidateInputForCreate(targetDir, fileType),
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

  await treeDataProvider.createFile(
    targetDir,
    fileName,
    fileType.value as 'content' | 'setting' | 'subdirectory',
    '',
    [],
    fileType.subtype as 'character' | 'foreshadowing' | 'glossary' | undefined,
  );
}
