import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectSettingsService, ProjectSettingsUpdateData } from '../services/ProjectSettingsService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import { Logger } from '../utils/Logger.js';

interface ProjectSettingsMessage {
  command: 'saveSettings' | 'validateField' | 'openYamlEditor' | 'ready';
  data?: ProjectSettingsUpdateData | { field: string; value: string };
}

/**
 * プロジェクト設定の視覚的編集画面を提供するWebViewProvider
 */
export class ProjectSettingsViewProvider implements vscode.WebviewViewProvider {
  private webviewView?: vscode.WebviewView;
  private currentProjectRoot?: string;

  constructor(
    private context: vscode.ExtensionContext,
    private projectSettingsService: ProjectSettingsService,
    private logger: Logger,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    // 現在のワークスペースフォルダーを取得
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      this.currentProjectRoot = workspaceFolder.uri.fsPath;
    }

    // WebViewのHTML設定
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // WebViewからのメッセージ処理
    webviewView.webview.onDidReceiveMessage(
      (message: ProjectSettingsMessage) => this.handleWebviewMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.logger.debug('ProjectSettingsViewProvider initialized');
  }

  /**
   * WebViewのコンテンツを更新
   */
  private updateWebViewContent(): void {
    if (!this.webviewView) {
      return;
    }

    let projectSettings: DialogoiYaml | null = null;
    let isDialogoiProject = false;

    if (this.currentProjectRoot !== undefined && this.currentProjectRoot !== '') {
      isDialogoiProject = this.projectSettingsService.isDialogoiProject(this.currentProjectRoot);
      if (isDialogoiProject) {
        projectSettings = this.projectSettingsService.loadProjectSettings(this.currentProjectRoot);
      }
    }

    // ReactアプリにデータをPOST
    this.webviewView.webview.postMessage({
      type: 'updateSettings',
      data: {
        settings: projectSettings,
        isDialogoiProject,
      },
    });
  }

  /**
   * WebView用HTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    // WebViewリソースのURIを生成
    const webviewDir = path.join(this.context.extensionUri.fsPath, 'webview');
    const outDir = path.join(this.context.extensionUri.fsPath, 'out', 'webviews', 'projectSettings');
    const stylesheetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(outDir, 'projectSettings.js')));

    // HTMLテンプレートファイルを読み込み
    const htmlPath = path.join(webviewDir, 'projectSettings.html');
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');

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
        this.updateWebViewContent();
        break;

      case 'saveSettings':
        this.handleSaveSettings(message.data as ProjectSettingsUpdateData);
        break;

      case 'openYamlEditor':
        this.handleOpenYamlEditor();
        break;

      default:
        this.logger.warn(`Unknown project settings command: ${message.command}`);
    }
  }

  /**
   * プロジェクト設定の保存を処理
   */
  private handleSaveSettings(data: ProjectSettingsUpdateData): void {
    if (this.currentProjectRoot === undefined || this.currentProjectRoot === '') {
      void vscode.window.showErrorMessage('プロジェクトルートが見つかりません。');
      return;
    }

    try {
      this.logger.debug('Saving project settings', data);

      // ProjectSettingsServiceで更新
      const success = this.projectSettingsService.updateProjectSettings(
        this.currentProjectRoot,
        data,
      );

      if (success) {
        void vscode.window.showInformationMessage('プロジェクト設定を保存しました。');
        this.logger.info('Project settings saved successfully');

        // WebViewを更新して最新の設定を表示
        this.updateWebViewContent();
        
        // 保存結果をWebViewに通知
        this.webviewView?.webview.postMessage({
          type: 'saveResult',
          data: { success: true, message: 'プロジェクト設定を保存しました。' },
        });
      } else {
        void vscode.window.showErrorMessage('プロジェクト設定の保存に失敗しました。入力値を確認してください。');
        this.logger.error('Failed to save project settings');
        
        // 保存結果をWebViewに通知
        this.webviewView?.webview.postMessage({
          type: 'saveResult',
          data: { success: false, message: 'プロジェクト設定の保存に失敗しました。' },
        });
      }
    } catch (error) {
      this.logger.error('Error saving project settings', error instanceof Error ? error : String(error));
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
      const dialogoiYamlPath = this.projectSettingsService.getDialogoiYamlPath(this.currentProjectRoot);
      const uri = vscode.Uri.file(dialogoiYamlPath);
      void vscode.window.showTextDocument(uri);

      this.logger.debug('Opened YAML editor for direct editing');
    } catch (error) {
      this.logger.error('Error opening YAML editor', error instanceof Error ? error : String(error));
      void vscode.window.showErrorMessage(
        `YAML編集画面の起動中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * プロジェクトルートが変更された時の処理
   */
  public updateProjectRoot(newProjectRoot: string | undefined): void {
    this.currentProjectRoot = newProjectRoot;
    this.updateWebViewContent();
    this.logger.debug(`Project root updated: ${newProjectRoot}`);
  }

}