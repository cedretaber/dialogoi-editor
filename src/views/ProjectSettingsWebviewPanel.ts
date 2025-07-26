import * as vscode from 'vscode';
import * as path from 'path';
import {
  ProjectSettingsService,
  ProjectSettingsUpdateData,
} from '../services/ProjectSettingsService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { Logger } from '../utils/Logger.js';

interface ProjectSettingsMessage {
  command: 'saveSettings' | 'validateField' | 'openYamlEditor' | 'ready' | 'closePanel';
  data?: ProjectSettingsUpdateData | { field: string; value: string };
}

/**
 * プロジェクト設定をメインエディタパネルで編集するWebViewPanel管理クラス
 */
export class ProjectSettingsWebviewPanel {
  private static currentPanel: ProjectSettingsWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private currentProjectRoot?: string;
  private disposables: vscode.Disposable[] = [];

  /**
   * パネルを作成または既存のパネルを表示する
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    projectSettingsService: ProjectSettingsService,
    logger: Logger,
    isNewProject: boolean = false,
  ): ProjectSettingsWebviewPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    // 既存のパネルがある場合は再利用
    if (ProjectSettingsWebviewPanel.currentPanel) {
      ProjectSettingsWebviewPanel.currentPanel.panel.reveal(column);
      ProjectSettingsWebviewPanel.currentPanel.update(isNewProject);
      return ProjectSettingsWebviewPanel.currentPanel;
    }

    // 新しいパネルを作成
    const panel = vscode.window.createWebviewPanel(
      'dialogoiProjectSettings',
      isNewProject ? '新しい小説プロジェクトの設定' : '小説プロジェクトの設定',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      },
    );

    // アイコンを設定
    panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'media', 'dialogoi-icon.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'media', 'dialogoi-icon.svg'),
    };

    ProjectSettingsWebviewPanel.currentPanel = new ProjectSettingsWebviewPanel(
      panel,
      extensionUri,
      projectSettingsService,
      logger,
      isNewProject,
    );

    return ProjectSettingsWebviewPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly projectSettingsService: ProjectSettingsService,
    private readonly logger: Logger,
    private isNewProject: boolean,
  ) {
    this.panel = panel;

    // 現在のワークスペースフォルダーを取得
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.currentProjectRoot = workspaceFolder.uri.fsPath;
    }

    // WebViewのコンテンツを設定
    void this.initializeWebview();

    // WebViewからのメッセージを処理
    this.panel.webview.onDidReceiveMessage(
      (message: ProjectSettingsMessage) => this.handleWebviewMessage(message),
      undefined,
      this.disposables,
    );

    // パネルが閉じられた時の処理
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);

    this.logger.debug('ProjectSettingsWebviewPanel created');
  }

  /**
   * WebViewの初期化（非同期）
   */
  private async initializeWebview(): Promise<void> {
    try {
      this.panel.webview.html = await this._getHtmlForWebview(this.panel.webview);
    } catch (error) {
      this.logger.error(
        'Failed to initialize webview',
        error instanceof Error ? error : String(error),
      );
      vscode.window.showErrorMessage('WebViewの初期化に失敗しました');
    }
  }

  /**
   * パネルの状態を更新
   */
  public update(isNewProject: boolean = false): void {
    this.isNewProject = isNewProject;
    this.panel.title = isNewProject ? '新しい小説プロジェクトの設定' : '小説プロジェクトの設定';
    void this.updateWebViewContent();
  }

  /**
   * WebViewのコンテンツを更新
   */
  private async updateWebViewContent(): Promise<void> {
    let projectSettings: DialogoiYaml | null = null;
    let isDialogoiProject = false;

    if (this.currentProjectRoot !== undefined && this.currentProjectRoot !== '') {
      isDialogoiProject = await this.projectSettingsService.isDialogoiProject(
        this.currentProjectRoot,
      );
      if (isDialogoiProject && !this.isNewProject) {
        projectSettings = await this.projectSettingsService.loadProjectSettings(
          this.currentProjectRoot,
        );
      }
    }

    // ReactアプリにデータをPOST
    this.panel.webview.postMessage({
      type: 'updateSettings',
      data: {
        settings: projectSettings,
        isDialogoiProject: isDialogoiProject || this.isNewProject,
        isNewProject: this.isNewProject,
      },
    });
  }

  /**
   * WebView用HTMLを生成
   */
  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const nonce = this._getNonce();

    // WebViewリソースのURIを生成
    const webviewDir = path.join(this.extensionUri.fsPath, 'webview');
    const outDir = path.join(this.extensionUri.fsPath, 'out', 'webviews', 'projectSettings');
    const stylesheetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(outDir, 'projectSettings.js')),
    );

    // HTMLテンプレートファイルを読み込み
    const htmlPath = path.join(webviewDir, 'projectSettings.html');
    const htmlContentBytes = await vscode.workspace.fs.readFile(vscode.Uri.file(htmlPath));
    let htmlContent = Buffer.from(htmlContentBytes).toString('utf8');

    // プレースホルダーを置換
    htmlContent = htmlContent
      .replace(/{nonce}/g, nonce)
      .replace(/{stylesheetUri}/g, stylesheetUri.toString())
      .replace(/{scriptUri}/g, scriptUri.toString());

    return htmlContent;
  }

  /**
   * セキュリティ用のnonce生成
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * WebViewからのメッセージを処理
   */
  private handleWebviewMessage(message: ProjectSettingsMessage): void {
    switch (message.command) {
      case 'ready':
        this.logger.debug('Project settings WebView ready');
        void this.updateWebViewContent();
        break;

      case 'saveSettings':
        void this.handleSaveSettings(message.data as ProjectSettingsUpdateData);
        break;

      case 'openYamlEditor':
        this.handleOpenYamlEditor();
        break;

      case 'closePanel':
        this.handleClosePanel();
        break;

      default:
        this.logger.warn(`Unknown project settings command: ${message.command}`);
    }
  }

  /**
   * プロジェクト設定の保存を処理
   */
  private async handleSaveSettings(data: ProjectSettingsUpdateData): Promise<void> {
    if (this.currentProjectRoot === undefined || this.currentProjectRoot === '') {
      void vscode.window.showErrorMessage('プロジェクトルートが見つかりません。');
      return;
    }

    try {
      this.logger.debug('Saving project settings', data);

      // 新規プロジェクトの場合は作成
      if (this.isNewProject) {
        const created = await this.projectSettingsService.createNewProject(
          this.currentProjectRoot,
          data,
        );
        if (created) {
          void vscode.window.showInformationMessage('新しい小説プロジェクトを作成しました。');
          this.logger.info('New project created successfully');
          this.isNewProject = false;
          this.panel.title = '小説プロジェクトの設定';

          // 保存結果をWebViewに通知
          this.panel.webview.postMessage({
            type: 'saveResult',
            data: { success: true, message: '新しい小説プロジェクトを作成しました。' },
          });

          // コマンドを実行してExplorerを更新
          void vscode.commands.executeCommand('dialogoi.refreshExplorer');
        } else {
          void vscode.window.showErrorMessage(
            'プロジェクトの作成に失敗しました。入力値を確認してください。',
          );
          this.panel.webview.postMessage({
            type: 'saveResult',
            data: { success: false, message: 'プロジェクトの作成に失敗しました。' },
          });
        }
      } else {
        // 既存プロジェクトの更新
        const success = await this.projectSettingsService.updateProjectSettings(
          this.currentProjectRoot,
          data,
        );

        if (success) {
          void vscode.window.showInformationMessage('プロジェクト設定を保存しました。');
          this.logger.info('Project settings saved successfully');

          // 保存結果をWebViewに通知
          this.panel.webview.postMessage({
            type: 'saveResult',
            data: { success: true, message: 'プロジェクト設定を保存しました。' },
          });
        } else {
          void vscode.window.showErrorMessage(
            'プロジェクト設定の保存に失敗しました。入力値を確認してください。',
          );
          this.panel.webview.postMessage({
            type: 'saveResult',
            data: { success: false, message: 'プロジェクト設定の保存に失敗しました。' },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        'Error saving project settings',
        error instanceof Error ? error : String(error),
      );
      void vscode.window.showErrorMessage(
        `プロジェクト設定の保存中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * YAML直接編集画面を開く
   */
  private handleOpenYamlEditor(): void {
    if (this.currentProjectRoot === undefined || this.currentProjectRoot === '') {
      void vscode.window.showErrorMessage('プロジェクトルートが見つかりません。');
      return;
    }

    try {
      const dialogoiYamlPath = this.projectSettingsService.getDialogoiYamlPath(
        this.currentProjectRoot,
      );
      const uri = vscode.Uri.file(dialogoiYamlPath);
      void vscode.window.showTextDocument(uri);

      this.logger.debug('Opened YAML editor for direct editing');
    } catch (error) {
      this.logger.error(
        'Error opening YAML editor',
        error instanceof Error ? error : String(error),
      );
      void vscode.window.showErrorMessage(
        `YAML編集画面の起動中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * パネルを閉じる
   */
  private handleClosePanel(): void {
    try {
      this.logger.debug('Closing project settings panel');
      this.dispose();
    } catch (error) {
      this.logger.error(
        'Error closing panel',
        error instanceof Error ? error : String(error),
      );
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    ProjectSettingsWebviewPanel.currentPanel = undefined;

    // パネルを破棄
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
