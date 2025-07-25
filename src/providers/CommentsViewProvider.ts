import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../utils/Logger.js';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import {
  CommentItem,
  CreateCommentOptions,
  UpdateCommentOptions,
  CommentStatus,
} from '../models/Comment.js';

/**
 * WebViewからのメッセージの型定義
 */
interface WebViewMessage {
  type:
    | 'addComment'
    | 'updateComment'
    | 'deleteComment'
    | 'toggleCommentStatus'
    | 'jumpToLine'
    | 'startEditingComment'
    | 'showWarning'
    | 'ready';
  payload?: {
    line?: number;
    endLine?: number;
    content?: string;
    commentIndex?: number;
    status?: 'open' | 'resolved';
    // エディタジャンプ用
    filePath?: string;
    responseId?: string;
    // 警告メッセージ用
    message?: string;
  };
}

/**
 * コメント・TODOパネルのWebViewプロバイダー
 */
export class CommentsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'dialogoi-comments';

  private webview: vscode.WebviewView | null = null;
  private currentFilePath: string | null = null;
  private comments: CommentItem[] = [];
  private isFileChanged = false;
  private logger: Logger;
  private _treeDataProvider: DialogoiTreeDataProvider | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: vscode.Uri,
  ) {
    this.logger = Logger.getInstance();

    // アクティブエディタ変更イベントを監視
    this.setupActiveEditorListener();
  }

  /**
   * アクティブエディタ監視のセットアップ
   */
  private setupActiveEditorListener(): void {
    // アクティブエディタ変更イベントを監視
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.uri.scheme === 'file') {
        const filePath = editor.document.uri.fsPath;

        // プロジェクト内のファイルかチェック
        if (this.isProjectFile(filePath)) {
          await this.updateCurrentFile(filePath);
        } else {
          // プロジェクト外のファイルの場合はクリア
          this.clearComments();
        }
      }
    });

    this.disposables.push(activeEditorDisposable);
    this.logger.debug('アクティブエディタ監視を開始しました');
  }

  /**
   * プロジェクト内のファイルかどうかをチェック
   */
  private isProjectFile(filePath: string): boolean {
    try {
      const relativePath = path.relative(this.workspaceRoot.fsPath, filePath);
      // 相対パスが '..' で始まる場合はプロジェクト外
      return !relativePath.startsWith('..');
    } catch {
      return false;
    }
  }

  /**
   * コメントをクリア
   */
  private clearComments(): void {
    this.currentFilePath = null;
    this.comments = [];
    this.isFileChanged = false;
    this.updateWebView();
  }

  /**
   * TreeDataProviderを設定
   */
  public setTreeDataProvider(treeDataProvider: DialogoiTreeDataProvider): void {
    this._treeDataProvider = treeDataProvider;

    // TreeDataProviderの選択変更イベントを監視
    treeDataProvider.onDidChangeSelection((selectedItems) => {
      if (selectedItems.length > 0 && selectedItems[0]) {
        void this.updateCurrentFile(selectedItems[0].path);
      }
    });

    this.logger.debug(`TreeDataProvider設定完了: ${this.hasTreeDataProvider() ? 'あり' : 'なし'}`);
  }

  /**
   * TreeDataProviderが設定されているかチェック（将来の拡張用）
   */
  private hasTreeDataProvider(): boolean {
    return this._treeDataProvider !== null;
  }

  /**
   * WebViewViewの実装
   */
  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this.webview = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = await this.getHtmlForWebview(webviewView.webview);

    // メッセージハンドラーを設定
    webviewView.webview.onDidReceiveMessage(async (message: WebViewMessage) => {
      await this.handleMessage(message);
    });

    this.logger.info('CommentsViewProvider が初期化されました');
  }

  /**
   * 現在のファイルを更新
   */
  public async updateCurrentFile(filePath: string): Promise<void> {
    if (this.currentFilePath === filePath) {
      return; // 同じファイルの場合は何もしない
    }

    this.currentFilePath = filePath;
    await this.loadCommentsForCurrentFile();
    this.updateWebView();
  }

  /**
   * コメント追加後に該当ファイルの表示を更新し、最後のコメントの編集を開始
   * @param filePath ファイルの絶対パス
   */
  public async addCommentAndStartEditing(filePath: string): Promise<void> {
    // コメント追加後は同じファイルでも強制的に再読み込み
    this.currentFilePath = filePath;
    await this.loadCommentsForCurrentFile();
    this.updateWebView();

    // 最後に追加されたコメントの編集を開始
    if (this.comments.length > 0) {
      this.startEditingLastComment();
    }
  }

  /**
   * 最後に追加されたコメントの編集を開始
   */
  private startEditingLastComment(): void {
    if (this.webview === null) {
      return;
    }

    const lastCommentIndex = this.comments.length - 1;

    this.webview.webview.postMessage({
      type: 'startEditingComment',
      payload: {
        commentIndex: lastCommentIndex,
      },
    });

    this.logger.debug(`最後のコメント（インデックス: ${lastCommentIndex}）の編集を開始`);
  }

  /**
   * 現在のファイルのコメントを読み込み
   */
  private async loadCommentsForCurrentFile(): Promise<void> {
    if (this.currentFilePath === null || this.currentFilePath === '') {
      this.comments = [];
      this.isFileChanged = false;
      return;
    }

    try {
      const container = ServiceContainer.getInstance();
      const commentService = container.getCommentService(
        container.getFileRepository().createFileUri(this.workspaceRoot.fsPath),
      );

      // 絶対パスから相対パスに変換
      const relativePath = path.relative(this.workspaceRoot.fsPath, this.currentFilePath);

      // CommentServiceを使用
      const commentFile = await commentService.loadCommentFileAsync(relativePath);

      if (commentFile) {
        this.comments = commentFile.comments;
        this.isFileChanged = await commentService.isFileChangedAsync(relativePath);
      } else {
        this.comments = [];
        this.isFileChanged = false;
      }

      this.logger.debug(
        `ファイル ${relativePath} のコメントを読み込みました: ${this.comments.length}件`,
      );
    } catch (error) {
      this.logger.error(
        'コメント読み込みエラー:',
        error instanceof Error ? error.message : String(error),
      );
      this.comments = [];
      this.isFileChanged = false;
    }
  }

  /**
   * WebViewを更新
   */
  private updateWebView(): void {
    if (!this.webview) {
      return;
    }

    const fileName =
      this.currentFilePath !== null && this.currentFilePath !== ''
        ? path.basename(this.currentFilePath)
        : '';

    this.webview.webview.postMessage({
      type: 'updateComments',
      data: {
        fileName,
        filePath: this.currentFilePath,
        comments: this.comments,
        isFileChanged: this.isFileChanged,
      },
    });
  }

  /**
   * WebViewからのメッセージを処理
   */
  private async handleMessage(message: WebViewMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'ready':
          await this.handleReady();
          break;
        case 'addComment':
          await this.handleAddComment(message.payload);
          break;
        case 'updateComment':
          await this.handleUpdateComment(message.payload);
          break;
        case 'deleteComment':
          await this.handleDeleteComment(message.payload);
          break;
        case 'toggleCommentStatus':
          await this.handleToggleCommentStatus(message.payload);
          break;
        case 'jumpToLine':
          await this.handleJumpToLine(message.payload);
          break;
        case 'showWarning':
          this.handleShowWarning(message.payload);
          break;
        default:
          this.logger.warn(`未知のメッセージタイプ: ${String(message.type)}`);
      }
    } catch (error) {
      this.logger.error(
        `メッセージ処理エラー (${String(message.type)}):`,
        error instanceof Error ? error.message : String(error),
      );

      // エラーメッセージをWebViewに送信
      if (this.webview) {
        this.webview.webview.postMessage({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Ready メッセージの処理
   */
  private async handleReady(): Promise<void> {
    this.logger.debug('CommentsViewProvider ready');

    // 優先順位1: 現在のアクティブエディタ
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.scheme === 'file') {
      const filePath = activeEditor.document.uri.fsPath;
      if (this.isProjectFile(filePath)) {
        await this.updateCurrentFile(filePath);
        this.updateWebView();
        return;
      }
    }

    // 優先順位2: TreeDataProviderの選択
    if (this._treeDataProvider) {
      const currentSelection = this._treeDataProvider.getSelection();
      if (currentSelection.length > 0 && currentSelection[0]) {
        await this.updateCurrentFile(currentSelection[0].path);
        this.updateWebView();
        return;
      }
    }

    // 優先順位3: 既存のcurrentFilePath
    if (this.currentFilePath !== null && this.currentFilePath !== '') {
      await this.loadCommentsForCurrentFile();
    }

    this.updateWebView();
  }

  /**
   * コメント追加の処理
   */
  private async handleAddComment(payload: unknown): Promise<void> {
    // 型ガードでpayloadの型安全性を確保
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('line' in payload) ||
      !('content' in payload) ||
      typeof (payload as { line: unknown }).line !== 'number' ||
      typeof (payload as { content: unknown }).content !== 'string' ||
      this.currentFilePath === null ||
      this.currentFilePath.length === 0
    ) {
      throw new Error('コメント追加に必要なデータが不足しています');
    }

    const validPayload = payload as { line: number; content: string; endLine?: number };

    const container = ServiceContainer.getInstance();
    const commentService = container.getCommentService(
      container.getFileRepository().createFileUri(this.workspaceRoot.fsPath),
    );

    // 絶対パスから相対パスに変換
    const relativePath = path.relative(this.workspaceRoot.fsPath, this.currentFilePath);

    const options: CreateCommentOptions = {
      line: validPayload.line,
      endLine: validPayload.endLine,
      content: validPayload.content,
    };

    await commentService.addCommentAsync(relativePath, options);

    this.logger.info(`コメント追加: 行${validPayload.line} - ${validPayload.content}`);

    // コメントを再読み込みして画面更新
    await this.loadCommentsForCurrentFile();
    this.updateWebView();
  }

  /**
   * コメント更新の処理
   */
  private async handleUpdateComment(payload: unknown): Promise<void> {
    // 型ガードでpayloadの型安全性を確保
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('commentIndex' in payload) ||
      typeof (payload as { commentIndex: unknown }).commentIndex !== 'number' ||
      !this.comments[(payload as { commentIndex: number }).commentIndex] ||
      this.currentFilePath === null ||
      this.currentFilePath.length === 0
    ) {
      throw new Error('更新対象のコメントが見つかりません');
    }

    const validPayload = payload as {
      commentIndex: number;
      content?: string;
      status?: CommentStatus;
    };

    const container = ServiceContainer.getInstance();
    const commentService = container.getCommentService(
      container.getFileRepository().createFileUri(this.workspaceRoot.fsPath),
    );

    // 絶対パスから相対パスに変換
    const relativePath = path.relative(this.workspaceRoot.fsPath, this.currentFilePath);

    const options: UpdateCommentOptions = {};
    if (validPayload.content !== undefined) {
      options.content = validPayload.content;
    }
    if (
      validPayload.status !== undefined &&
      (validPayload.status === 'open' || validPayload.status === 'resolved')
    ) {
      options.status = validPayload.status;
    }

    await commentService.updateCommentAsync(relativePath, validPayload.commentIndex, options);

    this.logger.info(`コメント更新: インデックス${validPayload.commentIndex}`);

    // コメントを再読み込みして画面更新
    await this.loadCommentsForCurrentFile();
    this.updateWebView();
  }

  /**
   * コメント削除の処理
   */
  private async handleDeleteComment(payload: unknown): Promise<void> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('commentIndex' in payload) ||
      typeof (payload as { commentIndex: unknown }).commentIndex !== 'number' ||
      !this.comments[(payload as { commentIndex: number }).commentIndex] ||
      this.currentFilePath === null ||
      this.currentFilePath.length === 0
    ) {
      throw new Error('削除対象のコメントが見つかりません');
    }

    const validPayload = payload as { commentIndex: number };

    const container = ServiceContainer.getInstance();
    const commentService = container.getCommentService(
      container.getFileRepository().createFileUri(this.workspaceRoot.fsPath),
    );

    // 絶対パスから相対パスに変換
    const relativePath = path.relative(this.workspaceRoot.fsPath, this.currentFilePath);

    await commentService.deleteCommentAsync(relativePath, validPayload.commentIndex);

    this.logger.info(`コメント削除: インデックス${validPayload.commentIndex}`);

    // コメントを再読み込みして画面更新
    await this.loadCommentsForCurrentFile();
    this.updateWebView();
  }

  /**
   * コメントステータス切り替えの処理
   */
  private async handleToggleCommentStatus(payload: unknown): Promise<void> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('commentIndex' in payload) ||
      typeof (payload as { commentIndex: unknown }).commentIndex !== 'number' ||
      !this.comments[(payload as { commentIndex: number }).commentIndex] ||
      this.currentFilePath === null ||
      this.currentFilePath.length === 0
    ) {
      throw new Error('ステータス切り替え対象のコメントが見つかりません');
    }

    const validPayload = payload as { commentIndex: number };

    const container = ServiceContainer.getInstance();
    const commentService = container.getCommentService(
      container.getFileRepository().createFileUri(this.workspaceRoot.fsPath),
    );

    // 絶対パスから相対パスに変換
    const relativePath = path.relative(this.workspaceRoot.fsPath, this.currentFilePath);

    const currentComment = this.comments[validPayload.commentIndex];
    if (!currentComment) {
      throw new Error('コメントが見つかりません');
    }
    const newStatus = currentComment.status === 'open' ? 'resolved' : 'open';

    const options: UpdateCommentOptions = {
      status: newStatus,
    };

    await commentService.updateCommentAsync(relativePath, validPayload.commentIndex, options);

    this.logger.info(
      `コメントステータス切り替え: インデックス${validPayload.commentIndex} -> ${newStatus}`,
    );

    // コメントを再読み込みして画面更新
    await this.loadCommentsForCurrentFile();
    this.updateWebView();
  }

  /**
   * 行ジャンプの処理
   */
  private async handleJumpToLine(payload: unknown): Promise<void> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('line' in payload) ||
      typeof (payload as { line: unknown }).line !== 'number' ||
      this.currentFilePath === null ||
      this.currentFilePath.length === 0
    ) {
      throw new Error('ジャンプに必要なデータが不足しています');
    }

    const validPayload = payload as { line: number; endLine?: number };

    try {
      const document = await vscode.workspace.openTextDocument(this.currentFilePath);
      const editor = await vscode.window.showTextDocument(document);

      const line = Math.max(0, validPayload.line - 1); // 0-indexed
      const endLine =
        typeof validPayload.endLine === 'number' ? Math.max(0, validPayload.endLine - 1) : line;

      const range = new vscode.Range(line, 0, endLine, 0);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

      this.logger.info(`行${validPayload.line}にジャンプしました`);
    } catch (error) {
      throw new Error(
        `行ジャンプに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * WebView用HTMLを生成
   */
  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const nonce = this.getNonce();

    // WebViewリソースのURIを生成
    const webviewDir = path.join(this.context.extensionUri.fsPath, 'webview');
    const outDir = path.join(this.context.extensionUri.fsPath, 'out', 'webviews', 'comments');
    const stylesheetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const commentsStylesheetUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(webviewDir, 'comments.css')),
    );
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(outDir, 'script.js')));

    // HTMLテンプレートファイルを読み込み
    const htmlPath = path.join(webviewDir, 'comments.html');
    const htmlContent = await vscode.workspace.fs.readFile(vscode.Uri.file(htmlPath));
    let htmlContentString = Buffer.from(htmlContent).toString('utf8');

    // プレースホルダーを置換
    htmlContentString = htmlContentString
      .replace(/{nonce}/g, nonce)
      .replace(/{stylesheetUri}/g, stylesheetUri.toString())
      .replace(/{commentsStylesheetUri}/g, commentsStylesheetUri.toString())
      .replace(/{scriptUri}/g, scriptUri.toString());

    return htmlContentString;
  }

  /**
   * セキュリティ用のnonce生成
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * 警告メッセージの表示
   */
  private handleShowWarning(payload: { message?: string } | undefined): void {
    if (!payload || typeof payload.message !== 'string') {
      this.logger.warn('handleShowWarning: 不正なペイロード');
      return;
    }

    vscode.window.showWarningMessage(payload.message);
  }

  /**
   * リソースクリーンアップ
   */
  public dispose(): void {
    this.disposables.forEach((disposable: vscode.Disposable) => {
      disposable.dispose();
    });
    this.disposables = [];
  }
}
