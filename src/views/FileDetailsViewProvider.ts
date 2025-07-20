import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { Logger } from '../utils/Logger.js';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';

/**
 * WebViewからのメッセージの型定義
 */
interface WebViewMessage {
  type:
    | 'addTag'
    | 'removeTag'
    | 'addReference'
    | 'removeReference'
    | 'removeCharacter'
    | 'openReference'
    | 'ready'
    | 'selectTreeItem'
    | 'refreshTree';
  payload?: {
    tag?: string;
    reference?: string;
    itemPath?: string;
  };
}

/**
 * ファイル詳細情報を表示するWebViewプロバイダー
 */
export class FileDetailsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'dialogoi-file-details';

  private _view?: vscode.WebviewView;
  private currentItem: DialogoiTreeItem | null = null;
  private logger = Logger.getInstance();
  private treeDataProvider: DialogoiTreeDataProvider | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  /**
   * TreeDataProviderを設定
   */
  public setTreeDataProvider(treeDataProvider: DialogoiTreeDataProvider): void {
    this.treeDataProvider = treeDataProvider;
  }

  /**
   * MetaYamlServiceを設定
   */
  public setMetaYamlService(metaYamlService: MetaYamlService): void {
    this.metaYamlService = metaYamlService;
  }

  /**
   * DialogoiYamlServiceを設定
   */
  public setDialogoiYamlService(dialogoiYamlService: DialogoiYamlService): void {
    this.dialogoiYamlService = dialogoiYamlService;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // WebViewからのメッセージを受信
    webviewView.webview.onDidReceiveMessage((data) => {
      this.handleMessage(data);
    });

    this.logger.debug('FileDetailsViewProvider初期化完了');
  }

  /**
   * ファイル詳細情報を更新
   */
  public updateFileDetails(item: DialogoiTreeItem | null): void {
    this.currentItem = item;
    if (this._view) {
      // ReferenceManagerから参照情報を取得
      let referenceData = null;
      if (item?.path !== undefined && item.path !== null && item.path !== '') {
        const referenceManager = ReferenceManager.getInstance();
        const allReferences = referenceManager.getAllReferencePaths(item.path);
        const referenceInfo = referenceManager.getReferences(item.path);
        referenceData = {
          allReferences,
          references: referenceInfo.references,
          referencedBy: referenceInfo.referencedBy,
        };
      }

      // WebView用のデータ形式に変換
      const fileDetailsData = item
        ? {
            name: item.name,
            type: item.type,
            path: item.path,
            tags: item.tags,
            character: item.character,
            referenceData: referenceData,
            review_count: item.review_count,
          }
        : null;

      this._view.webview.postMessage({
        type: 'updateFile',
        data: fileDetailsData,
      });
      this.logger.debug('ファイル詳細情報を更新', item?.name ?? 'null');
    }
  }

  /**
   * WebViewからのメッセージを処理
   */
  private handleMessage(message: unknown): void {
    const msg = message as WebViewMessage;
    if (msg === null || msg === undefined || typeof msg.type !== 'string') {
      this.logger.debug('無効なメッセージ形式', message);
      return;
    }

    switch (msg.type) {
      case 'addTag':
        if (msg.payload?.tag !== undefined && msg.payload.tag !== null && msg.payload.tag !== '') {
          this.handleAddTag(msg.payload.tag);
        }
        break;
      case 'removeTag':
        if (msg.payload?.tag !== undefined && msg.payload.tag !== null && msg.payload.tag !== '') {
          this.handleRemoveTag(msg.payload.tag);
        }
        break;
      case 'addReference':
        if (
          msg.payload?.reference !== undefined &&
          msg.payload.reference !== null &&
          msg.payload.reference !== ''
        ) {
          this.handleAddReference(msg.payload.reference);
        }
        break;
      case 'removeReference':
        if (
          msg.payload?.reference !== undefined &&
          msg.payload.reference !== null &&
          msg.payload.reference !== ''
        ) {
          this.handleRemoveReference(msg.payload.reference);
        }
        break;
      case 'removeCharacter':
        this.handleRemoveCharacter();
        break;
      case 'openReference':
        if (
          msg.payload?.reference !== undefined &&
          msg.payload.reference !== null &&
          msg.payload.reference !== ''
        ) {
          this.handleOpenReference(msg.payload.reference);
        }
        break;
      case 'ready':
        // WebViewの準備完了
        this.updateFileDetails(this.currentItem);
        void this.updateTreeData();
        break;
      case 'selectTreeItem':
        if (
          msg.payload?.itemPath !== undefined &&
          msg.payload.itemPath !== null &&
          msg.payload.itemPath !== ''
        ) {
          void this.handleSelectTreeItem(msg.payload.itemPath);
        }
        break;
      case 'refreshTree':
        this.handleRefreshTree();
        break;
      default:
        this.logger.debug('未知のメッセージタイプ', msg.type);
    }
  }

  /**
   * タグ追加処理
   */
  private handleAddTag(tag: string): void {
    if (!this.currentItem || !tag) {
      return;
    }

    try {
      // ファイルのパスを取得
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // MetaYamlServiceを使ってタグを追加
      const success = this.metaYamlService?.addFileTag(dirPath, fileName, tag);

      if (success === true) {
        this.logger.info(`タグ追加: ${tag} → ${fileName}`);
        vscode.window.showInformationMessage(`タグ "${tag}" を追加しました`);

        // TreeViewとWebViewを更新
        if (this.treeDataProvider !== null && this.currentItem !== null) {
          this.treeDataProvider.refresh();
          // 最新のファイル情報を取得して表示を更新
          const updatedItem = this.treeDataProvider.refreshFileItem(this.currentItem);
          if (updatedItem !== null) {
            this.currentItem = updatedItem;
            this.updateFileDetails(this.currentItem);
          }
        }
      } else {
        throw new Error('タグの追加に失敗しました');
      }
    } catch (error) {
      this.logger.error('タグ追加エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `タグの追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * タグ削除処理
   */
  private handleRemoveTag(tag: string): void {
    if (!this.currentItem || !tag) {
      return;
    }

    try {
      // ファイルのパスを取得
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // MetaYamlServiceを使ってタグを削除
      const success = this.metaYamlService?.removeFileTag(dirPath, fileName, tag);

      if (success === true) {
        this.logger.info(`タグ削除: ${tag} ← ${fileName}`);
        vscode.window.showInformationMessage(`タグ "${tag}" を削除しました`);

        // TreeViewとWebViewを更新
        if (this.treeDataProvider !== null && this.currentItem !== null) {
          this.treeDataProvider.refresh();
          // 最新のファイル情報を取得して表示を更新
          const updatedItem = this.treeDataProvider.refreshFileItem(this.currentItem);
          if (updatedItem !== null) {
            this.currentItem = updatedItem;
            this.updateFileDetails(this.currentItem);
          }
        }
      } else {
        throw new Error('タグの削除に失敗しました');
      }
    } catch (error) {
      this.logger.error('タグ削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `タグの削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 参照追加処理
   */
  private handleAddReference(reference: string): void {
    if (!this.currentItem || !reference || !this.treeDataProvider) {
      return;
    }

    try {
      // DialogoiTreeDataProviderのaddReferenceメソッドを使用
      const dirAbsolutePath = path.dirname(this.currentItem.path);
      const result = this.treeDataProvider.addReference(
        dirAbsolutePath,
        this.currentItem.name,
        reference,
      );

      if (result.success) {
        this.logger.info(`参照追加成功: ${reference} → ${this.currentItem.name}`);
        vscode.window.showInformationMessage(result.message);

        // 更新されたアイテム情報を取得して表示を更新
        if (result.updatedItems) {
          const updatedItem = result.updatedItems.find(
            (item) => item.name === this.currentItem?.name,
          );
          if (updatedItem) {
            this.currentItem = updatedItem;
            this.updateFileDetails(this.currentItem);
          }
        }
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('参照追加エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `参照の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 参照ファイルを開く
   */
  private handleOpenReference(reference: string): void {
    if (!reference || !this.currentItem) {
      return;
    }

    try {
      // プロジェクトルートを取得
      let projectRoot: string | null = null;
      if (this.dialogoiYamlService) {
        const currentFileAbsolutePath = this.currentItem.path;
        projectRoot = this.dialogoiYamlService.findProjectRoot(currentFileAbsolutePath);
      }

      if (projectRoot === null || projectRoot === '') {
        this.logger.error('プロジェクトルートが見つかりません');
        vscode.window.showErrorMessage('プロジェクトルートが見つかりません');
        return;
      }

      // プロジェクトルートを基準に相対パスを絶対パスに変換
      const referenceAbsolutePath = path.resolve(projectRoot, reference);

      this.logger.info(
        `参照ファイルを開く: ${reference} → ${referenceAbsolutePath} (プロジェクトルート: ${projectRoot})`,
      );

      // ファイルの存在確認
      const fileUri = vscode.Uri.file(referenceAbsolutePath);
      vscode.workspace.fs.stat(fileUri).then(
        () => {
          // ファイルが存在する場合、エディタで開く
          vscode.window.showTextDocument(fileUri);
        },
        () => {
          // ファイルが存在しない場合のエラーハンドリング
          this.logger.error(`参照ファイルが存在しません: ${referenceAbsolutePath}`);
          vscode.window.showErrorMessage(`参照ファイルが見つかりません: ${reference}`);
        },
      );
    } catch (error) {
      this.logger.error('参照ファイルを開くエラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `参照ファイルを開けませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * ツリーアイテム選択処理
   */
  private handleSelectTreeItem(itemPath: string): void {
    if (!this.treeDataProvider) {
      this.logger.debug('TreeDataProviderが設定されていません');
      return;
    }

    try {
      // TODO: パスからDialogoiTreeItemを取得する処理を実装
      this.logger.info(`ツリーアイテム選択: ${itemPath}`);

      // 現在は情報メッセージのみ
      vscode.window.showInformationMessage(`選択: ${itemPath}`);
    } catch (error) {
      this.logger.error('ツリーアイテム選択エラー', error instanceof Error ? error : String(error));
    }
  }

  /**
   * 参照削除処理
   */
  private handleRemoveReference(reference: string): void {
    if (!this.currentItem || !reference) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      const success = this.metaYamlService?.removeFileReference(dirPath, fileName, reference);
      if (success === true) {
        this.logger.info(`参照削除: ${reference} → ${fileName}`);
        vscode.window.showInformationMessage(`参照 "${reference}" を削除しました`);

        // TreeViewとWebViewを更新
        if (this.treeDataProvider !== null && this.currentItem !== null) {
          this.treeDataProvider.refresh();
          const updatedItem = this.treeDataProvider.refreshFileItem(this.currentItem);
          if (updatedItem !== null) {
            this.currentItem = updatedItem;
            this.updateFileDetails(this.currentItem);
          }
        }
      } else {
        throw new Error('参照の削除に失敗しました');
      }
    } catch (error) {
      this.logger.error('参照削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `参照の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * キャラクター情報削除処理
   */
  private handleRemoveCharacter(): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      const success = this.metaYamlService?.removeFileCharacter(dirPath, fileName);
      if (success === true) {
        this.logger.info(`キャラクター情報削除: ${fileName}`);
        vscode.window.showInformationMessage('キャラクター情報を削除しました');

        // TreeViewとWebViewを更新
        if (this.treeDataProvider !== null && this.currentItem !== null) {
          this.treeDataProvider.refresh();
          const updatedItem = this.treeDataProvider.refreshFileItem(this.currentItem);
          if (updatedItem !== null) {
            this.currentItem = updatedItem;
            this.updateFileDetails(this.currentItem);
          }
        }
      } else {
        throw new Error('キャラクター情報の削除に失敗しました');
      }
    } catch (error) {
      this.logger.error('キャラクター削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `キャラクター情報の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * ツリー更新処理
   */
  private handleRefreshTree(): void {
    if (!this.treeDataProvider) {
      return;
    }

    try {
      this.treeDataProvider.refresh();
      void this.updateTreeData();
      vscode.window.showInformationMessage('ツリーを更新しました');
    } catch (error) {
      this.logger.error('ツリー更新エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `ツリーの更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * ツリーデータをWebViewに送信
   */
  private async updateTreeData(): Promise<void> {
    if (!this._view || !this.treeDataProvider) {
      return;
    }

    try {
      // ルートアイテムを取得
      const rootItems = await this.treeDataProvider.getChildren();

      this._view.webview.postMessage({
        type: 'updateTree',
        data: rootItems,
      });

      this.logger.debug('ツリーデータを送信', rootItems?.length ?? 0);
    } catch (error) {
      this.logger.error('ツリーデータ送信エラー', error instanceof Error ? error : String(error));
    }
  }

  /**
   * WebView用HTMLを生成
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = this._getNonce();

    // WebViewリソースのURIを生成
    const webviewDir = path.join(this._extensionUri.fsPath, 'webview');
    const outDir = path.join(this._extensionUri.fsPath, 'out', 'webviews', 'fileDetails');
    const stylesheetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(outDir, 'script.js')));

    // HTMLテンプレートファイルを読み込み
    const htmlPath = path.join(webviewDir, 'index.html');
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
}
