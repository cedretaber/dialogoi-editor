import * as vscode from 'vscode';
import * as path from 'path';
import { ReviewService } from '../services/ReviewService.js';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';
import { CreateReviewOptions, ReviewSeverity } from '../models/Review.js';

/**
 * レビューコマンドを登録
 * @param context VSCodeエクステンションコンテキスト
 * @param workspaceRoot ワークスペースルート
 */
export function registerReviewCommands(context: vscode.ExtensionContext, workspaceRoot: vscode.Uri): void {
  const reviewService = new ReviewService(workspaceRoot);
  
  // レビューを追加するコマンド
  const addReviewCommand = vscode.commands.registerCommand(
    'dialogoi.addReview',
    async (fileItem: any) => {
      try {
        await addReviewHandler(reviewService, fileItem);
      } catch (error) {
        vscode.window.showErrorMessage(`レビューの追加に失敗しました: ${error}`);
      }
    }
  );

  // レビューを表示するコマンド
  const showReviewsCommand = vscode.commands.registerCommand(
    'dialogoi.showReviews',
    async (fileItem: any) => {
      try {
        await showReviewsHandler(reviewService, fileItem);
      } catch (error) {
        vscode.window.showErrorMessage(`レビューの表示に失敗しました: ${error}`);
      }
    }
  );

  // レビューステータスを更新するコマンド
  const updateReviewStatusCommand = vscode.commands.registerCommand(
    'dialogoi.updateReviewStatus',
    async (fileItem: any) => {
      try {
        await updateReviewStatusHandler(reviewService, fileItem);
      } catch (error) {
        vscode.window.showErrorMessage(`レビューステータスの更新に失敗しました: ${error}`);
      }
    }
  );

  // レビューを削除するコマンド
  const deleteReviewCommand = vscode.commands.registerCommand(
    'dialogoi.deleteReview',
    async (fileItem: any) => {
      try {
        await deleteReviewHandler(reviewService, fileItem);
      } catch (error) {
        vscode.window.showErrorMessage(`レビューの削除に失敗しました: ${error}`);
      }
    }
  );

  context.subscriptions.push(addReviewCommand, showReviewsCommand, updateReviewStatusCommand, deleteReviewCommand);
}

/**
 * レビュー追加のハンドラー
 */
async function addReviewHandler(reviewService: ReviewService, fileItem: any): Promise<void> {
  if (!fileItem || !fileItem.path) {
    vscode.window.showErrorMessage('ファイルが選択されていません');
    return;
  }

  // 絶対パスから相対パスに変換
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('ワークスペースが開かれていません');
    return;
  }

  const targetRelativeFilePath = path.relative(workspaceRoot, fileItem.path);

  // レビューの詳細情報を入力
  const reviewer = await vscode.window.showInputBox({
    prompt: 'レビュアー名を入力してください',
    placeHolder: '例: 編集者A',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'レビュアー名は必須です';
      }
      return null;
    }
  });

  if (!reviewer) {
    return;
  }

  const lineInput = await vscode.window.showInputBox({
    prompt: '行番号を入力してください',
    placeHolder: '例: 42',
    validateInput: (value) => {
      if (!value || isNaN(parseInt(value))) {
        return '有効な行番号を入力してください';
      }
      return null;
    }
  });

  if (!lineInput) {
    return;
  }

  const line = parseInt(lineInput);

  const severityItems = [
    { label: '🚨 エラー', value: 'error' as ReviewSeverity },
    { label: '⚠️ 警告', value: 'warning' as ReviewSeverity },
    { label: '💡 提案', value: 'suggestion' as ReviewSeverity },
    { label: 'ℹ️ 情報', value: 'info' as ReviewSeverity }
  ];

  const selectedSeverity = await vscode.window.showQuickPick(severityItems, {
    placeHolder: '重要度を選択してください'
  });

  if (!selectedSeverity) {
    return;
  }

  const content = await vscode.window.showInputBox({
    prompt: 'レビューコメントを入力してください',
    placeHolder: '例: この表現は別の言い回しの方が...',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'コメントは必須です';
      }
      return null;
    }
  });

  if (!content) {
    return;
  }

  const reviewOptions: CreateReviewOptions = {
    line,
    reviewer,
    type: 'human',
    severity: selectedSeverity.value,
    content
  };

  const reviewIndex = await reviewService.addReview(targetRelativeFilePath, reviewOptions);

  // meta.yaml を更新
  const reviewSummary = await reviewService.getReviewSummary(targetRelativeFilePath);
  const dirAbsolutePath = path.dirname(fileItem.path);
  const fileName = path.basename(fileItem.path);
  MetaYamlUtils.updateReviewInfo(dirAbsolutePath, fileName, reviewSummary);

  vscode.window.showInformationMessage(`レビューを追加しました (ID: ${reviewIndex})`);
}

/**
 * レビュー表示のハンドラー
 */
async function showReviewsHandler(reviewService: ReviewService, fileItem: any): Promise<void> {
  if (!fileItem || !fileItem.path) {
    vscode.window.showErrorMessage('ファイルが選択されていません');
    return;
  }

  // 絶対パスから相対パスに変換
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('ワークスペースが開かれていません');
    return;
  }

  const targetRelativeFilePath = path.relative(workspaceRoot, fileItem.path);
  const reviewFile = await reviewService.loadReviewFile(targetRelativeFilePath);
  
  if (!reviewFile || reviewFile.reviews.length === 0) {
    vscode.window.showInformationMessage('このファイルにはレビューがありません');
    return;
  }

  // ファイルの変更をチェック
  const isChanged = await reviewService.isFileChanged(targetRelativeFilePath);
  let message = `📋 ${targetRelativeFilePath} のレビュー一覧\n\n`;
  
  if (isChanged) {
    message += '⚠️ 対象ファイルが変更されています。レビュー位置を確認してください。\n\n';
  }

  reviewFile.reviews.forEach((review, index) => {
    const statusIcon = getStatusIcon(review.status);
    const severityIcon = getSeverityIcon(review.severity);
    
    message += `${index + 1}. [${statusIcon}] ${severityIcon} 行${review.line}\n`;
    message += `   レビュアー: ${review.reviewer}\n`;
    message += `   ${review.content}\n`;
    message += `   作成日: ${new Date(review.created_at).toLocaleString()}\n`;
    
    if (review.thread && review.thread.length > 0) {
      message += `   💬 コメント数: ${review.thread.length}\n`;
    }
    
    message += '\n';
  });

  // OutputChannel に表示
  const outputChannel = vscode.window.createOutputChannel('Dialogoi Reviews');
  outputChannel.clear();
  outputChannel.append(message);
  outputChannel.show();
}

/**
 * レビューステータス更新のハンドラー
 */
async function updateReviewStatusHandler(reviewService: ReviewService, fileItem: any): Promise<void> {
  if (!fileItem || !fileItem.path) {
    vscode.window.showErrorMessage('ファイルが選択されていません');
    return;
  }

  // 絶対パスから相対パスに変換
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('ワークスペースが開かれていません');
    return;
  }

  const targetRelativeFilePath = path.relative(workspaceRoot, fileItem.path);
  const reviewFile = await reviewService.loadReviewFile(targetRelativeFilePath);
  
  if (!reviewFile || reviewFile.reviews.length === 0) {
    vscode.window.showInformationMessage('このファイルにはレビューがありません');
    return;
  }

  // レビューを選択
  const reviewItems = reviewFile.reviews.map((review, index) => ({
    label: `${index + 1}. [${getStatusIcon(review.status)}] 行${review.line}: ${review.content.substring(0, 50)}...`,
    value: index
  }));

  const selectedReview = await vscode.window.showQuickPick(reviewItems, {
    placeHolder: '更新するレビューを選択してください'
  });

  if (!selectedReview) {
    return;
  }

  // ステータスを選択
  const statusItems = [
    { label: '📭 未対応', value: 'open' },
    { label: '🔄 対応中', value: 'in_progress' },
    { label: '✅ 解決済み', value: 'resolved' },
    { label: '🚫 却下', value: 'dismissed' }
  ];

  const selectedStatus = await vscode.window.showQuickPick(statusItems, {
    placeHolder: '新しいステータスを選択してください'
  });

  if (!selectedStatus) {
    return;
  }

  await reviewService.updateReview(targetRelativeFilePath, selectedReview.value, {
    status: selectedStatus.value as 'open' | 'in_progress' | 'resolved' | 'dismissed'
  });

  // meta.yaml を更新
  const reviewSummary = await reviewService.getReviewSummary(targetRelativeFilePath);
  const dirAbsolutePath = path.dirname(fileItem.path);
  const fileName = path.basename(fileItem.path);
  MetaYamlUtils.updateReviewInfo(dirAbsolutePath, fileName, reviewSummary);

  vscode.window.showInformationMessage(`レビューステータスを更新しました`);
}

/**
 * レビュー削除のハンドラー
 */
async function deleteReviewHandler(reviewService: ReviewService, fileItem: any): Promise<void> {
  if (!fileItem || !fileItem.path) {
    vscode.window.showErrorMessage('ファイルが選択されていません');
    return;
  }

  // 絶対パスから相対パスに変換
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('ワークスペースが開かれていません');
    return;
  }

  const targetRelativeFilePath = path.relative(workspaceRoot, fileItem.path);
  const reviewFile = await reviewService.loadReviewFile(targetRelativeFilePath);
  
  if (!reviewFile || reviewFile.reviews.length === 0) {
    vscode.window.showInformationMessage('このファイルにはレビューがありません');
    return;
  }

  // レビューを選択
  const reviewItems = reviewFile.reviews.map((review, index) => ({
    label: `${index + 1}. [${getStatusIcon(review.status)}] 行${review.line}: ${review.content.substring(0, 50)}...`,
    value: index
  }));

  const selectedReview = await vscode.window.showQuickPick(reviewItems, {
    placeHolder: '削除するレビューを選択してください'
  });

  if (!selectedReview) {
    return;
  }

  // 確認ダイアログを表示
  const confirmResult = await vscode.window.showWarningMessage(
    `レビュー「${reviewFile.reviews[selectedReview.value]?.content.substring(0, 50)}...」を削除しますか？`,
    { modal: true },
    'はい',
    'いいえ'
  );

  if (confirmResult !== 'はい') {
    return;
  }

  await reviewService.deleteReview(targetRelativeFilePath, selectedReview.value);

  // meta.yaml を更新
  const reviewSummary = await reviewService.getReviewSummary(targetRelativeFilePath);
  const dirAbsolutePath = path.dirname(fileItem.path);
  const fileName = path.basename(fileItem.path);
  MetaYamlUtils.updateReviewInfo(dirAbsolutePath, fileName, reviewSummary);

  vscode.window.showInformationMessage(`レビューを削除しました`);
}

/**
 * ステータスのアイコンを取得
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'open':
      return '📭';
    case 'in_progress':
      return '🔄';
    case 'resolved':
      return '✅';
    case 'dismissed':
      return '🚫';
    default:
      return '❓';
  }
}

/**
 * 重要度のアイコンを取得
 */
function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'error':
      return '🚨';
    case 'warning':
      return '⚠️';
    case 'suggestion':
      return '💡';
    case 'info':
      return 'ℹ️';
    default:
      return '❓';
  }
}