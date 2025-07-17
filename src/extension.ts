import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from './tree/DialogoiTreeDataProvider.js';
import { registerReviewCommands } from './commands/reviewCommands.js';
import { registerCharacterCommands } from './commands/characterCommands.js';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Dialogoi Editor が起動しました');

  // TreeDataProviderの作成と登録
  const treeDataProvider = new DialogoiTreeDataProvider();
  const treeView = vscode.window.createTreeView('dialogoi-explorer', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true,
  });

  // 更新コマンドの実装
  const refreshCommand = vscode.commands.registerCommand('dialogoi.refreshExplorer', () => {
    treeDataProvider.refresh();
    vscode.window.showInformationMessage('Dialogoi Explorer を更新しました');
  });

  // ファイル作成コマンド（選択中のディレクトリまたはルート）
  const createFileCommand = vscode.commands.registerCommand('dialogoi.createFile', async () => {
    let targetDir: string;

    // 現在選択されているアイテムを取得
    const selection = treeView.selection;
    if (selection && selection.length > 0 && selection[0]) {
      const selectedItem = selection[0];
      targetDir = treeDataProvider.getDirectoryPath(selectedItem);
    } else {
      // 何も選択されていない場合はルートディレクトリ
      const currentDir = treeDataProvider.getCurrentDirectory();
      if (!currentDir) {
        vscode.window.showErrorMessage('小説プロジェクトが見つかりません。');
        return;
      }
      targetDir = currentDir;
    }

    await createFileInDirectory(targetDir);
  });

  // ファイル作成コマンド（選択したディレクトリ用）
  const createFileInDirectoryCommand = vscode.commands.registerCommand(
    'dialogoi.createFileInDirectory',
    async (item: any) => {
      let targetDir: string;

      if (item && item.path) {
        // 選択したアイテムのディレクトリパスを取得
        targetDir = treeDataProvider.getDirectoryPath(item);
      } else {
        // 何も選択していない場合はルートディレクトリ
        const currentDir = treeDataProvider.getCurrentDirectory();
        if (!currentDir) {
          vscode.window.showErrorMessage('小説プロジェクトが見つかりません。');
          return;
        }
        targetDir = currentDir;
      }

      await createFileInDirectory(targetDir);
    },
  );

  // ファイル作成の共通処理
  async function createFileInDirectory(targetDir: string): Promise<void> {
    const fileType = await vscode.window.showQuickPick(
      [
        { label: '本文', value: 'content', description: '.txt ファイルを作成' },
        { label: '設定', value: 'setting', description: '.md ファイルを作成' },
        { label: 'ディレクトリ', value: 'subdirectory', description: '新しいディレクトリを作成' },
      ],
      {
        placeHolder: 'ファイルの種類を選択してください',
      },
    );

    if (!fileType) {
      return;
    }

    const baseFileName = await vscode.window.showInputBox({
      prompt: `${fileType.label}の名前を入力してください（拡張子は自動で付与されます）`,
      placeHolder: fileType.value === 'subdirectory' ? 'フォルダ名' : 'ファイル名',
    });

    if (!baseFileName) {
      return;
    }

    // 拡張子を自動で付与
    let fileName: string;
    if (fileType.value === 'subdirectory') {
      fileName = baseFileName;
    } else if (fileType.value === 'content') {
      fileName = baseFileName.endsWith('.txt') ? baseFileName : `${baseFileName}.txt`;
    } else {
      // setting
      fileName = baseFileName.endsWith('.md') ? baseFileName : `${baseFileName}.md`;
    }

    treeDataProvider.createFile(
      targetDir,
      fileName,
      fileType.value as 'content' | 'setting' | 'subdirectory',
    );
  }

  // ファイル削除コマンド
  const deleteFileCommand = vscode.commands.registerCommand(
    'dialogoi.deleteFile',
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('削除するファイルを選択してください。');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `${item.name} を削除しますか？この操作は取り消せません。`,
        { modal: true },
        'はい',
      );

      if (confirm === 'はい') {
        const dirPath = treeDataProvider.getDirectoryPath(item);
        treeDataProvider.deleteFile(dirPath, item.name);
      }
    },
  );

  // ファイル名変更コマンド
  const renameFileCommand = vscode.commands.registerCommand(
    'dialogoi.renameFile',
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('リネームするファイルを選択してください。');
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '新しいファイル名を入力してください',
        value: item.name,
      });

      if (!newName || newName === item.name) {
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      treeDataProvider.renameFile(dirPath, item.name, newName);
    },
  );

  // タグ追加コマンド
  const addTagCommand = vscode.commands.registerCommand('dialogoi.addTag', async (item: any) => {
    if (!item || !item.name) {
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

    if (!newTag) {
      return;
    }

    const dirPath = treeDataProvider.getDirectoryPath(item);
    const result = treeDataProvider.addTag(dirPath, item.name, newTag);

    if (result.success) {
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  });

  // タグ削除コマンド
  const removeTagCommand = vscode.commands.registerCommand(
    'dialogoi.removeTag',
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('タグを削除するファイルを選択してください。');
        return;
      }

      const currentTags = item.tags || [];
      if (currentTags.length === 0) {
        vscode.window.showInformationMessage(`${item.name} にはタグが設定されていません。`);
        return;
      }

      const tagToRemove = await vscode.window.showQuickPick(
        currentTags.map((tag: string) => `#${tag}`),
        {
          placeHolder: '削除するタグを選択してください',
        },
      );

      if (!tagToRemove) {
        return;
      }

      // #を除去してタグ名を取得
      const tagName = tagToRemove.startsWith('#') ? tagToRemove.slice(1) : tagToRemove;

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.removeTag(dirPath, item.name, tagName);

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
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('タグを編集するファイルを選択してください。');
        return;
      }

      const currentTags = item.tags || [];
      const currentTagsString = currentTags.join(', ');

      const newTagsString = await vscode.window.showInputBox({
        prompt: `${item.name} のタグを編集してください（カンマ区切り）`,
        value: currentTagsString,
        placeHolder: 'tag1, tag2, tag3',
        validateInput: (value) => {
          if (value) {
            const tags = value.split(',').map((tag) => tag.trim());
            for (const tag of tags) {
              if (tag.includes(' ')) {
                return 'タグ名にスペースは使用できません。';
              }
            }
          }
          return null;
        },
      });

      if (newTagsString === undefined) {
        return;
      }

      const newTags = newTagsString
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.setTags(dirPath, item.name, newTags);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // 参照追加コマンド
  const addReferenceCommand = vscode.commands.registerCommand(
    'dialogoi.addReference',
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('参照を追加するファイルを選択してください。');
        return;
      }

      const referencePath = await vscode.window.showInputBox({
        prompt: `${item.name} が参照するファイルのパスを入力してください（小説ルートからの相対パス）`,
        placeHolder: 'settings/world_setting.md',
        validateInput: (value) => {
          if (!value) {
            return 'パスを入力してください。';
          }
          return null;
        },
      });

      if (!referencePath) {
        return;
      }

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.addReference(dirPath, item.name, referencePath);

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
    async (item: any) => {
      if (!item || !item.name) {
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

      if (!referenceToRemove) {
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
    async (item: any) => {
      if (!item || !item.name) {
        vscode.window.showErrorMessage('参照を編集するファイルを選択してください。');
        return;
      }

      const currentReferences = item.references || [];
      const currentReferencesString = currentReferences.join('\n');

      const newReferencesString = await vscode.window.showInputBox({
        prompt: `${item.name} の参照を編集してください（1行につき1つのパス）`,
        value: currentReferencesString,
        placeHolder: 'settings/world_setting.md\nsettings/characters/protagonist.md',
        validateInput: () => {
          // 基本的なバリデーション
          return null;
        },
      });

      if (newReferencesString === undefined) {
        return;
      }

      const newReferences = newReferencesString
        .split('\n')
        .map((ref) => ref.trim())
        .filter((ref) => ref.length > 0);

      const dirPath = treeDataProvider.getDirectoryPath(item);
      const result = treeDataProvider.setReferences(dirPath, item.name, newReferences);

      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    },
  );

  // レビューコマンドの登録
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
    registerReviewCommands(context, vscode.workspace.workspaceFolders[0].uri);
  }

  // キャラクターコマンドの登録
  registerCharacterCommands(context, treeDataProvider);

  context.subscriptions.push(
    treeView,
    refreshCommand,
    createFileCommand,
    createFileInDirectoryCommand,
    deleteFileCommand,
    renameFileCommand,
    addTagCommand,
    removeTagCommand,
    editTagsCommand,
    addReferenceCommand,
    removeReferenceCommand,
    editReferencesCommand,
  );
}

export function deactivate(): void {
  // cleanup
}
