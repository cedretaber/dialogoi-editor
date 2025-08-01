import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { Logger } from '../utils/Logger.js';

/**
 * フィルター関連のコマンドを登録
 */
export function registerFilterCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: DialogoiTreeDataProvider,
): void {
  const logger = Logger.getInstance();

  // タグフィルターコマンド
  const filterByTagCommand = vscode.commands.registerCommand('dialogoi.filterByTag', async () => {
    try {
      const tagInput = await vscode.window.showInputBox({
        prompt: 'フィルタリングするタグを入力してください',
        placeHolder: 'タグ名（部分一致）',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'タグ名を入力してください。';
          }
          return null;
        },
      });

      if (tagInput !== undefined && tagInput.trim() !== '') {
        treeDataProvider.setTagFilter(tagInput.trim());
        logger.info(`タグフィルターを適用: ${tagInput.trim()}`);
        vscode.window.showInformationMessage(`タグ「${tagInput.trim()}」でフィルタリングしました`);
      }
    } catch (error) {
      logger.error('タグフィルターコマンドエラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `タグフィルターの適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  // フィルター解除コマンド
  const clearFilterCommand = vscode.commands.registerCommand('dialogoi.clearFilter', () => {
    try {
      treeDataProvider.clearFilter();
      logger.info('フィルターを解除');
      vscode.window.showInformationMessage('フィルターを解除しました');
    } catch (error) {
      logger.error('フィルター解除コマンドエラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `フィルターの解除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  // 参照関係フィルターコマンド（将来拡張用）
  const filterByReferenceCommand = vscode.commands.registerCommand(
    'dialogoi.filterByReference',
    async () => {
      try {
        const referenceInput = await vscode.window.showInputBox({
          prompt: 'フィルタリングする参照ファイル名を入力してください',
          placeHolder: 'ファイル名（部分一致）',
          validateInput: (value) => {
            if (!value || value.trim() === '') {
              return 'ファイル名を入力してください。';
            }
            return null;
          },
        });

        if (referenceInput !== undefined && referenceInput.trim() !== '') {
          // TODO: TreeViewFilterServiceに参照関係フィルター追加後に有効化
          logger.info(`参照関係フィルターを適用: ${referenceInput.trim()}`);
          vscode.window.showInformationMessage(
            `参照「${referenceInput.trim()}」でのフィルタリングは今後実装予定です`,
          );
        }
      } catch (error) {
        logger.error(
          '参照関係フィルターコマンドエラー',
          error instanceof Error ? error : String(error),
        );
        vscode.window.showErrorMessage(
          `参照関係フィルターの適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // ファイル種別フィルターコマンド（将来拡張用）
  const filterByFileTypeCommand = vscode.commands.registerCommand(
    'dialogoi.filterByFileType',
    async () => {
      try {
        const fileType = await vscode.window.showQuickPick(
          [
            { label: 'content', description: '本文ファイル' },
            { label: 'setting', description: '設定ファイル' },
            { label: 'subdirectory', description: 'サブディレクトリ' },
          ],
          {
            placeHolder: 'フィルタリングするファイル種別を選択してください',
          },
        );

        if (fileType !== undefined) {
          // TODO: TreeViewFilterServiceにファイル種別フィルター追加後に有効化
          logger.info(`ファイル種別フィルターを適用: ${fileType.label}`);
          vscode.window.showInformationMessage(
            `「${fileType.description}」でのフィルタリングは今後実装予定です`,
          );
        }
      } catch (error) {
        logger.error(
          'ファイル種別フィルターコマンドエラー',
          error instanceof Error ? error : String(error),
        );
        vscode.window.showErrorMessage(
          `ファイル種別フィルターの適用に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // フィルター状態表示コマンド（デバッグ用）
  const showFilterStatusCommand = vscode.commands.registerCommand(
    'dialogoi.showFilterStatus',
    () => {
      try {
        const filterState = treeDataProvider.getFilterState();
        if (filterState.isActive) {
          vscode.window.showInformationMessage(
            `フィルター状態: ${filterState.filterType} = "${filterState.filterValue}"`,
          );
        } else {
          vscode.window.showInformationMessage('フィルターは適用されていません');
        }
      } catch (error) {
        logger.error(
          'フィルター状態表示コマンドエラー',
          error instanceof Error ? error : String(error),
        );
        vscode.window.showErrorMessage(
          `フィルター状態の取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  // コマンドを登録
  context.subscriptions.push(
    filterByTagCommand,
    clearFilterCommand,
    filterByReferenceCommand,
    filterByFileTypeCommand,
    showFilterStatusCommand,
  );

  logger.debug('フィルターコマンドを登録完了');
}
