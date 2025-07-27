import * as vscode from 'vscode';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { FileTypeConversionService } from '../services/FileTypeConversionService.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * ファイル種別変更コマンドを登録する
 * @param context VSCode拡張機能コンテキスト
 */
export function registerFileTypeConversionCommands(context: vscode.ExtensionContext): void {
  const fileTypeConversionService = ServiceContainer.getInstance().getFileTypeConversionService();

  // ファイル種別変更コマンド
  const convertFileTypeCommand = vscode.commands.registerCommand(
    'dialogoi.convertFileType',
    async (item?: DialogoiTreeItem) => {
      await handleConvertFileType(fileTypeConversionService, item);
    },
  );

  context.subscriptions.push(convertFileTypeCommand);
}

/**
 * ファイル種別変更コマンドのハンドラー
 * @param fileTypeConversionService ファイル種別変更サービス
 * @param item 対象TreeItem（コンテキストメニューから呼び出された場合）
 */
async function handleConvertFileType(
  fileTypeConversionService: FileTypeConversionService,
  item?: DialogoiTreeItem,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[DEBUG] handleConvertFileType開始, item:', item);

  try {
    // 対象ファイルのパスを取得
    let targetFilePath: string;

    if (item && item.path) {
      // コンテキストメニューから呼び出された場合
      targetFilePath = item.path;
      // eslint-disable-next-line no-console
      console.log('[DEBUG] コンテキストメニューから呼び出し, targetFilePath:', targetFilePath);
    } else {
      // コマンドパレットから呼び出された場合、現在のエディターのファイルを使用
      const activeEditor = vscode.window.activeTextEditor;
      // eslint-disable-next-line no-console
      console.log(
        '[DEBUG] コマンドパレットから呼び出し, activeEditor:',
        activeEditor?.document?.uri?.fsPath,
      );

      if (!activeEditor) {
        vscode.window.showErrorMessage('ファイルが選択されていません');
        return;
      }
      targetFilePath = activeEditor.document.uri.fsPath;
      // eslint-disable-next-line no-console
      console.log('[DEBUG] アクティブエディターから取得, targetFilePath:', targetFilePath);
    }

    // eslint-disable-next-line no-console
    console.log('[DEBUG] 最終的なtargetFilePath:', targetFilePath);

    // ファイルが種別変更可能かチェック
    const isConvertible = await fileTypeConversionService.isFileTypeConvertible(targetFilePath);
    if (!isConvertible) {
      vscode.window.showErrorMessage(
        'このファイルは種別変更できません。管理対象のファイル（content または setting）である必要があります。',
      );
      return;
    }

    // 現在の種別を取得
    const currentType = await fileTypeConversionService.getCurrentFileType(targetFilePath);
    if (!currentType) {
      vscode.window.showErrorMessage('ファイルの現在の種別を取得できませんでした');
      return;
    }

    // 変更先の種別を決定
    const newType = currentType === 'content' ? 'setting' : 'content';

    // 確認ダイアログを表示
    const fileName = targetFilePath.split('/').pop() ?? 'ファイル';
    const confirmation = await vscode.window.showInformationMessage(
      `「${fileName}」の種別を ${currentType} から ${newType} に変更しますか？`,
      { modal: true },
      '変更する',
      'キャンセル',
    );

    if (confirmation !== '変更する') {
      return;
    }

    // 種別変更を実行
    const result = await fileTypeConversionService.convertFileType(targetFilePath, newType, {
      confirmationRequired: false, // 既に確認済み
    });

    if (result.success) {
      vscode.window.showInformationMessage(result.message);

      // TreeViewを更新するために refreshExplorer コマンドを呼び出し
      vscode.commands.executeCommand('dialogoi.refreshExplorer');
    } else {
      vscode.window.showErrorMessage(`種別変更に失敗しました: ${result.message}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`種別変更中にエラーが発生しました: ${errorMessage}`);
  }
}

/**
 * ファイルが種別変更可能かどうかをチェックする関数（メニュー表示条件用）
 * @param item DialogoiTreeItem
 * @returns 変更可能な場合はtrue
 */
export async function isFileTypeConvertible(item: DialogoiTreeItem): Promise<boolean> {
  try {
    const fileTypeConversionService = ServiceContainer.getInstance().getFileTypeConversionService();
    return await fileTypeConversionService.isFileTypeConvertible(item.path);
  } catch {
    return false;
  }
}
