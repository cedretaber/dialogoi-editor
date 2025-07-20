import * as vscode from 'vscode';
import * as path from 'path';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { Logger } from '../utils/Logger.js';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';

/**
 * WebViewからのメッセージの型定義
 */
interface WebViewMessage {
  type:
    | 'addTag'
    | 'removeTag'
    | 'addReference'
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

      this._view.webview.postMessage({
        type: 'updateFile',
        data: item,
        referenceData: referenceData,
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
      // 現在のファイルのディレクトリを基準に相対パスを絶対パスに変換
      const currentFileAbsolutePath = this.currentItem.path;
      const currentDirAbsolutePath = path.dirname(currentFileAbsolutePath);
      const referenceAbsolutePath = path.resolve(currentDirAbsolutePath, reference);

      this.logger.info(`参照ファイルを開く: ${reference} → ${referenceAbsolutePath}`);

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

    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" 
            content="default-src 'none'; 
                     style-src ${webview.cspSource} 'unsafe-inline';
                     script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ファイル詳細</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          margin: 0;
          padding: 12px;
          line-height: 1.4;
        }
        
        .file-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .section {
          margin-bottom: 2px;
        }
        
        .section-header {
          background-color: transparent;
          color: var(--vscode-sideBarSectionHeader-foreground);
          cursor: pointer;
          padding: 4px 8px;
          border: none;
          width: 100%;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          transition: background-color 0.1s ease;
          outline: none;
        }
        
        .section-header:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        
        .section-header:focus {
          background-color: var(--vscode-list-focusBackground);
        }
        
        .section-chevron {
          margin-right: 4px;
          font-size: 9px;
          width: 8px;
          text-align: center;
          transition: transform 0.15s ease;
          color: var(--vscode-icon-foreground);
          transform: rotate(90deg);
        }
        
        .section-chevron.collapsed {
          transform: rotate(0deg);
        }
        
        .section-content {
          display: block;
          padding: 8px 16px;
          background-color: transparent;
          font-size: 11px;
        }
        
        .section-content.collapsed {
          display: none;
        }
        
        /* ツリービュー用スタイル */
        .tree-container {
          margin-bottom: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 12px;
        }
        
        .tree-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--vscode-foreground);
          margin-bottom: 8px;
          padding: 4px 8px;
          background-color: var(--vscode-sideBarSectionHeader-background);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .tree-refresh-btn {
          background: none;
          border: none;
          color: var(--vscode-icon-foreground);
          cursor: pointer;
          padding: 2px;
          font-size: 12px;
        }
        
        .tree-refresh-btn:hover {
          color: var(--vscode-foreground);
        }
        
        .tree-list {
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid var(--vscode-input-border);
          background-color: var(--vscode-input-background);
        }
        
        .tree-item {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 11px;
          border-bottom: 1px solid var(--vscode-input-border);
        }
        
        .tree-item:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        
        .tree-item.selected {
          background-color: var(--vscode-list-activeSelectionBackground);
          color: var(--vscode-list-activeSelectionForeground);
        }
        
        .tree-item-icon {
          margin-right: 6px;
          font-size: 10px;
          width: 12px;
          text-align: center;
          color: var(--vscode-icon-foreground);
        }
        
        .tree-item-label {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .tree-item-type {
          font-size: 9px;
          color: var(--vscode-descriptionForeground);
          margin-left: 4px;
        }
        
        .tree-loading {
          text-align: center;
          padding: 20px;
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          font-size: 11px;
        }
        
        .tag {
          display: inline-flex;
          align-items: center;
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          margin: 2px 2px 2px 0;
          font-weight: 500;
        }
        
        /* タグ編集機能用のスタイル */
        .tag-container {
          margin-top: 4px;
        }
        
        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          margin-bottom: 8px;
        }
        
        .tag-remove {
          background: none;
          border: none;
          color: var(--vscode-badge-foreground);
          cursor: pointer;
          font-size: 10px;
          font-weight: bold;
          margin-left: 4px;
          padding: 0;
          width: 12px;
          height: 12px;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.1s ease, color 0.1s ease;
        }
        
        .tag-remove:hover {
          background-color: var(--vscode-inputValidation-errorBackground);
          color: var(--vscode-inputValidation-errorForeground);
        }
        
        .tag-remove:focus {
          background-color: var(--vscode-inputValidation-errorBackground);
          color: var(--vscode-inputValidation-errorForeground);
          outline: 1px solid var(--vscode-focusBorder);
        }
        
        .tag-input {
          width: 100%;
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          color: var(--vscode-input-foreground);
          font-size: 11px;
          padding: 4px 6px;
          border-radius: 2px;
          outline: none;
          box-sizing: border-box;
        }
        
        .tag-input:focus {
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }
        
        .tag-input::placeholder {
          color: var(--vscode-input-placeholderForeground);
          font-style: italic;
        }
        
        .reference-item {
          display: block;
          color: var(--vscode-textLink-foreground);
          text-decoration: none;
          padding: 2px 0;
          font-size: 11px;
          cursor: pointer;
        }
        
        .reference-item:hover {
          text-decoration: underline;
        }
        
        .hyperlink-ref {
          background-color: var(--vscode-textBlockQuote-background);
          border-left: 3px solid var(--vscode-textLink-foreground);
          padding-left: 8px;
          font-style: italic;
        }
        
        .manual-ref {
          border-left: 3px solid var(--vscode-editorInfo-foreground);
          padding-left: 8px;
        }
        
        .no-data {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
          font-size: 11px;
        }
        
        .no-file-selected {
          text-align: center;
          color: var(--vscode-descriptionForeground);
          padding: 40px 20px;
          font-style: italic;
        }
        
        .button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 4px 8px;
          font-size: 10px;
          cursor: pointer;
          border-radius: 2px;
          margin: 4px 4px 0 0;
          transition: background-color 0.1s ease;
        }
        
        .button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 11px;
        }
        
        .info-label {
          color: var(--vscode-descriptionForeground);
          min-width: 60px;
        }
        
        .info-value {
          color: var(--vscode-foreground);
          text-align: right;
          flex: 1;
        }
        
        .character-info {
          background-color: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 3px;
          padding: 8px;
          margin: 8px 0;
        }
        
        .character-field {
          margin: 4px 0;
          font-size: 11px;
        }
        
        .review-stats {
          display: flex;
          gap: 12px;
          margin: 8px 0;
        }
        
        .review-stat {
          font-size: 11px;
        }
        
        .review-count {
          font-weight: bold;
          color: var(--vscode-foreground);
        }
      </style>
    </head>
    <body>
      <div id="content">
        <div class="no-file-selected">
          ファイルまたはディレクトリを選択してください
        </div>
      </div>
      
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let currentFile = null;
        
        // VSCode拡張機能にWebViewの準備完了を通知
        vscode.postMessage({ type: 'ready' });
        
        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'updateFile':
              updateFileDisplay(message.data);
              break;
          }
        });
        
        function updateFileDisplay(file) {
          currentFile = file;
          const content = document.getElementById('content');
          
          if (!file) {
            content.innerHTML = '<div class="no-file-selected">ファイルまたはディレクトリを選択してください</div>';
            return;
          }
          
          content.innerHTML = generateFileDetailsHTML(file);
          setupSectionListeners();
        }
        
        
        function generateFileDetailsHTML(file) {
          let html = '<div class="file-title">' + escapeHtml(file.name || 'Unknown File') + '</div>';
          
          // タグセクション
          html += '<div class="section">';
          html += '<button class="section-header" data-target="tags">';
          html += '<span class="section-chevron">▶</span>';
          html += '<span>タグ</span>';
          html += '</button>';
          html += '<div class="section-content" id="tags">';
          
          // タグコンテナ
          html += '<div class="tag-container">';
          html += '<div class="tag-list">';
          
          if (file.tags && file.tags.length > 0) {
            file.tags.forEach(tag => {
              html += '<span class="tag">';
              html += '#' + escapeHtml(tag);
              html += '<button class="tag-remove" data-tag="' + escapeHtml(tag) + '" title="タグを削除">×</button>';
              html += '</span>';
            });
          } else {
            html += '<div class="no-data">タグがありません</div>';
          }
          
          html += '</div>'; // .tag-list
          html += '<input class="tag-input" placeholder="新しいタグを入力してEnterキーを押してください..." />';
          html += '</div>'; // .tag-container
          html += '</div></div>'; // .section-content, .section
          
          // キャラクター・設定情報セクション
          if (file.character) {
            html += '<div class="section">';
            html += '<button class="section-header" data-target="character">';
            html += '<span class="section-chevron">▶</span>';
            html += '<span>キャラクター情報</span>';
            html += '</button>';
            html += '<div class="section-content" id="character">';
            
            if (file.character) {
              html += '<div class="character-info">';
              html += '<div class="character-field"><strong>重要度:</strong> ' + (file.character.importance || '未設定') + '</div>';
              html += '<div class="character-field"><strong>複数キャラ:</strong> ' + (file.character.multiple_characters ? 'はい' : 'いいえ') + '</div>';
              html += '<div class="character-field"><strong>表示名:</strong> ' + escapeHtml(file.character.display_name || file.name || '') + '</div>';
              html += '</div>';
            } else {
              html += '<div class="no-data">キャラクター情報がありません</div>';
            }
            
            html += '</div></div>';
          }
          
          // 本文ファイルの場合は「登場人物」と「関連設定」に分けて表示
          const referenceManager = ReferenceManager.getInstance();
          const allReferences = referenceManager.getAllReferencePaths(file.path);
          const referenceInfo = referenceManager.getReferences(file.path);
          
          if (file.type === 'content' && allReferences.length > 0) {
            // キャラクターと設定を分類
            const characterRefs = [];
            const settingRefs = [];
            
            // 参照先をキャラクターと設定に分類
            for (const refEntry of referenceInfo.references) {
              const refData = {
                path: refEntry.path,
                source: refEntry.source,
                isHyperlink: refEntry.source === 'hyperlink'
              };
              
              // TODO: キャラクター判定の実装
              // 現在はプロジェクトルートとCharacterServiceが必要
              if (refEntry.path.includes('character')) {
                characterRefs.push(refData);
              } else {
                settingRefs.push(refData);
              }
            }
            
            // 登場人物セクション
            if (characterRefs.length > 0) {
              html += '<div class="section">';
              html += '<button class="section-header" data-target="characters">';
              html += '<span class="section-chevron">▶</span>';
              html += '<span>登場人物 (' + characterRefs.length + ')</span>';
              html += '</button>';
              html += '<div class="section-content" id="characters">';
              characterRefs.forEach(refData => {
                const linkIcon = refData.isHyperlink ? '🔗' : '';
                const linkClass = refData.isHyperlink ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';
                html += '<a class="'+linkClass+'" onclick="openReference(\\''+escapeHtml(refData.path)+'\\')">'+linkIcon+escapeHtml(refData.path)+'</a>';
              });
              html += '</div></div>';
            }
            
            // 関連設定セクション
            if (settingRefs.length > 0) {
              html += '<div class="section">';
              html += '<button class="section-header" data-target="settings">';
              html += '<span class="section-chevron">▶</span>';
              html += '<span>関連設定 (' + settingRefs.length + ')</span>';
              html += '</button>';
              html += '<div class="section-content" id="settings">';
              settingRefs.forEach(refData => {
                const linkIcon = refData.isHyperlink ? '🔗' : '';
                const linkClass = refData.isHyperlink ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';
                html += '<a class="'+linkClass+'" onclick="openReference(\\''+escapeHtml(refData.path)+'\\')">'+linkIcon+escapeHtml(refData.path)+'</a>';
              });
              html += '</div></div>';
            }
            
            // 参照追加ボタン
            html += '<div class="section">';
            html += '<button class="button" onclick="addReference()">参照追加</button>';
            html += '</div>';
          } else {
            // それ以外のファイルは従来の参照関係表示
            html += '<div class="section">';
            html += '<button class="section-header" data-target="references">';
            html += '<span class="section-chevron">▶</span>';
            html += '<span>参照関係</span>';
            html += '</button>';
            html += '<div class="section-content" id="references">';
            
            let hasReferences = false;
            
            if (allReferences.length > 0) {
              html += '<div style="margin-bottom: 8px;"><strong>このファイルが参照:</strong></div>';
              referenceInfo.references.forEach(refEntry => {
                const linkIcon = refEntry.source === 'hyperlink' ? '🔗' : '';
                const linkClass = refEntry.source === 'hyperlink' ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';
                html += '<a class="'+linkClass+'" onclick="openReference(\\''+escapeHtml(refEntry.path)+'\\')">'+linkIcon+escapeHtml(refEntry.path)+'</a>';
              });
              hasReferences = true;
            }
            
            // 被参照情報も表示
            if (referenceInfo.referencedBy.length > 0) {
              html += '<div style="margin-bottom: 8px; margin-top: 12px;"><strong>このファイルを参照:</strong></div>';
              referenceInfo.referencedBy.forEach(refEntry => {
                const linkIcon = refEntry.source === 'hyperlink' ? '🔗' : '';
                const linkClass = refEntry.source === 'hyperlink' ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';
                html += '<a class="'+linkClass+'" onclick="openReference(\\''+escapeHtml(refEntry.path)+'\\')">'+linkIcon+escapeHtml(refEntry.path)+'</a>';
              });
              hasReferences = true;
            }
            
            if (!hasReferences) {
              html += '<div class="no-data">参照関係がありません</div>';
            }
            
            html += '<br><button class="button" onclick="addReference()">参照追加</button>';
            html += '</div></div>';
          }
          
          // レビューセクション
          if (file.review_count && Object.keys(file.review_count).length > 0) {
            const totalReviews = Object.values(file.review_count).reduce((sum, count) => sum + (count || 0), 0);
            html += '<div class="section">';
            html += '<button class="section-header" data-target="reviews">';
            html += '<span class="section-chevron">▶</span>';
            html += '<span>レビュー (' + totalReviews + '件)</span>';
            html += '</button>';
            html += '<div class="section-content" id="reviews">';
            
            html += '<div class="review-stats">';
            html += '<div class="review-stat">未対応: <span class="review-count">' + (file.review_count.open || 0) + '</span></div>';
            html += '<div class="review-stat">対応中: <span class="review-count">' + (file.review_count.in_progress || 0) + '</span></div>';
            html += '<div class="review-stat">解決済み: <span class="review-count">' + (file.review_count.resolved || 0) + '</span></div>';
            html += '</div>';
            
            html += '</div></div>';
          }
          
          // 基本情報セクション
          html += '<div class="section">';
          html += '<button class="section-header" data-target="basic">';
          html += '<span class="section-chevron">▶</span>';
          html += '<span>基本情報</span>';
          html += '</button>';
          html += '<div class="section-content" id="basic">';
          
          html += '<div class="info-row">';
          html += '<span class="info-label">種別:</span>';
          html += '<span class="info-value">' + escapeHtml(file.type || 'unknown') + '</span>';
          html += '</div>';
          
          if (file.path) {
            html += '<div class="info-row">';
            html += '<span class="info-label">パス:</span>';
            html += '<span class="info-value">' + escapeHtml(file.path) + '</span>';
            html += '</div>';
          }
          
          // TODO: ファイルサイズ、更新日時などの情報を追加
          
          html += '</div></div>';
          
          return html;
        }
        
        function setupSectionListeners() {
          document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', () => {
              const target = header.getAttribute('data-target');
              const content = document.getElementById(target);
              const chevron = header.querySelector('.section-chevron');
              
              content.classList.toggle('collapsed');
              chevron.classList.toggle('collapsed');
            });
          });
          
          // タグ削除ボタンのイベントリスナー
          document.querySelectorAll('.tag-remove').forEach(button => {
            button.addEventListener('click', (e) => {
              e.stopPropagation();
              const tag = button.getAttribute('data-tag');
              if (tag) {
                handleTagRemove(tag);
              }
            });
          });
          
          // タグ入力フィールドのイベントリスナー
          const tagInput = document.querySelector('.tag-input');
          if (tagInput) {
            tagInput.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = tagInput.value.trim();
                if (value) {
                  handleTagAdd(value);
                  tagInput.value = '';
                }
              }
            });
          }
        }
        
        function handleTagRemove(tag) {
          vscode.postMessage({
            type: 'removeTag',
            payload: { tag: tag }
          });
        }
        
        function handleTagAdd(tag) {
          // 空文字列チェック
          if (!tag || tag.trim() === '') {
            return;
          }
          
          // 重複チェック（現在のタグリストから確認）
          const existingTags = Array.from(document.querySelectorAll('.tag')).map(el => {
            const text = el.textContent.trim();
            return text.startsWith('#') ? text.substring(1).replace('×', '').trim() : text.replace('×', '').trim();
          });
          
          if (existingTags.includes(tag)) {
            // 重複している場合は入力フィールドに簡単なフィードバック
            const tagInput = document.querySelector('.tag-input');
            if (tagInput) {
              tagInput.style.borderColor = 'var(--vscode-inputValidation-errorBorder)';
              setTimeout(() => {
                tagInput.style.borderColor = '';
              }, 1000);
            }
            return;
          }
          
          vscode.postMessage({
            type: 'addTag',
            payload: { tag: tag }
          });
        }
        
        function addTag() {
          const tag = prompt('追加するタグを入力してください:');
          if (tag && tag.trim()) {
            vscode.postMessage({
              type: 'addTag',
              payload: { tag: tag.trim() }
            });
          }
        }
        
        function addReference() {
          const reference = prompt('参照するファイルのパスを入力してください:');
          if (reference && reference.trim()) {
            vscode.postMessage({
              type: 'addReference',
              payload: { reference: reference.trim() }
            });
          }
        }
        
        function openReference(ref) {
          vscode.postMessage({
            type: 'openReference',
            payload: { reference: ref }
          });
        }
        
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }
      </script>
    </body>
    </html>`;
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
