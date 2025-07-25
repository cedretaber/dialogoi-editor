import * as vscode from 'vscode';
import * as path from 'path';
import { CommentsViewProvider } from '../providers/CommentsViewProvider.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { Logger } from '../utils/Logger.js';
import { CreateCommentOptions } from '../models/Comment.js';

/**
 * エディタからのコメント追加コマンドを登録
 * @param context VSCodeの拡張機能コンテキスト
 * @param commentsProvider コメントビューProvider（nullの場合あり）
 */
export function registerEditorCommentCommands(
  context: vscode.ExtensionContext,
  commentsProvider: CommentsViewProvider | null,
): void {
  const logger = Logger.getInstance();

  const addCommentFromSelectionCommand = vscode.commands.registerCommand(
    'dialogoi.addCommentFromSelection',
    async () => {
      try {
        await handleAddCommentFromSelection(commentsProvider);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('コメント追加エラー', error instanceof Error ? error : String(error));
        vscode.window.showErrorMessage(`コメントの追加に失敗しました: ${errorMessage}`);
      }
    },
  );

  context.subscriptions.push(addCommentFromSelectionCommand);
  logger.debug('エディタコメントコマンドを登録しました');
}

/**
 * エディタの選択範囲からコメントを追加する処理
 * @param commentsProvider コメントビューProvider
 */
async function handleAddCommentFromSelection(
  commentsProvider: CommentsViewProvider | null,
): Promise<void> {
  const logger = Logger.getInstance();

  // 1. アクティブエディタの取得
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    vscode.window.showWarningMessage('アクティブなエディタが見つかりません');
    return;
  }

  // 2. ドキュメントと選択範囲の取得
  const document = activeEditor.document;
  const selection = activeEditor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('テキストを選択してからコメントを追加してください');
    return;
  }

  // 3. 行番号の取得（1-based）と選択テキストの抽出
  const startLine = selection.start.line + 1; // 0-based → 1-based
  const endLine = selection.end.line + 1;
  const isMultiLine = startLine !== endLine;
  
  // 選択されたテキストを取得
  const selectedText = document.getText(selection);

  logger.debug(`選択範囲: 行${startLine}${isMultiLine ? `-${endLine}` : ''}`);

  // 4. ファイルパスの取得と相対パス変換
  const absoluteFilePath = document.uri.fsPath;

  // プロジェクトルートからの相対パスを計算
  const pathResult = await getRelativePathFromProject(absoluteFilePath);
  if (pathResult === null || pathResult.relativePath === null || pathResult.relativePath === '') {
    vscode.window.showWarningMessage('このファイルはDialogoiプロジェクト内にありません');
    return;
  }

  const { projectRoot, relativePath } = pathResult;
  logger.debug(`対象ファイル: ${relativePath}`);

  // 5. コメント追加オプションの作成
  // 選択されたテキストを引用形式でコメント本文に含める
  const quotedText = selectedText
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');
  
  const initialContent = quotedText + '\n\n';
  
  const commentOptions: CreateCommentOptions = {
    line: startLine,
    endLine: isMultiLine ? endLine : undefined,
    content: initialContent,
  };

  // 6. CommentServiceでコメント追加
  const container = ServiceContainer.getInstance();
  const projectRootUri = container.getFileRepository().createFileUri(projectRoot);
  const commentService = container.getCommentService(projectRootUri);

  try {
    await commentService.addCommentAsync(relativePath, commentOptions);
    logger.info(
      `コメントを追加しました: ${relativePath}:${startLine}${isMultiLine ? `-${endLine}` : ''}`,
    );

    // 7. WebViewの更新とコメント編集開始（commentsProviderが利用可能な場合）
    if (commentsProvider) {
      await commentsProvider.addCommentAndStartEditing(absoluteFilePath);
    }

    vscode.window.showInformationMessage(
      `行${startLine}${isMultiLine ? `-${endLine}` : ''}にコメントを追加しました`,
    );
  } catch (error) {
    logger.error(
      'CommentServiceでのコメント追加に失敗',
      error instanceof Error ? error : String(error),
    );
    throw error;
  }
}

/**
 * 絶対ファイルパスからプロジェクトルートと相対パスを取得
 * @param absoluteFilePath 絶対ファイルパス
 * @returns プロジェクトルートと相対パス（見つからない場合はnull）
 */
async function getRelativePathFromProject(absoluteFilePath: string): Promise<{projectRoot: string, relativePath: string} | null> {
  const logger = Logger.getInstance();

  try {
    // ServiceContainerからDialogoiYamlServiceを取得
    const container = ServiceContainer.getInstance();
    const dialogoiYamlService = container.getDialogoiYamlService();

    logger.debug(`検索開始パス: ${absoluteFilePath}`);
    
    // プロジェクトルートを検索（上向き検索）
    const projectRoot = await dialogoiYamlService.findProjectRootAsync(absoluteFilePath);
    logger.debug(`プロジェクトルート検索結果: ${projectRoot}`);
    if (projectRoot === null || projectRoot === '') {
      logger.debug(`プロジェクトルートが見つかりません: ${absoluteFilePath}`);
      return null;
    }

    // 相対パスを計算
    const relativePath = path.relative(projectRoot, absoluteFilePath);

    // パスが上位ディレクトリを参照している場合（../が含まれる場合）は無効
    if (relativePath.startsWith('..')) {
      logger.debug(`ファイルがプロジェクト外にあります: ${absoluteFilePath}`);
      return null;
    }

    // パス区切り文字をスラッシュに統一（Windows対応）
    const normalizedRelativePath = relativePath.replace(/\\/g, '/');
    
    return {
      projectRoot,
      relativePath: normalizedRelativePath
    };
  } catch (error) {
    logger.warn(`相対パス計算エラー: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
