import * as vscode from 'vscode';
import * as path from 'path';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { Logger } from '../utils/Logger.js';
import { DialogoiTreeDataProvider } from '../tree/DialogoiTreeDataProvider.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import {
  FileChangeNotificationService,
  FileChangeType,
} from '../services/FileChangeNotificationService.js';
import { DisposableEvent } from '../repositories/EventEmitterRepository.js';

/**
 * WebViewからのメッセージの型定義
 */
interface ForeshadowingPoint {
  location: string;
  comment: string;
}

interface WebViewMessage {
  type:
    | 'addTag'
    | 'removeTag'
    | 'addReference'
    | 'removeReference'
    | 'removeReverseReference'
    | 'removeCharacter'
    | 'openReference'
    | 'ready'
    | 'selectTreeItem'
    | 'refreshTree'
    | 'addForeshadowingPlant'
    | 'removeForeshadowingPlant'
    | 'updateForeshadowingPlant'
    | 'setForeshadowingPayoff'
    | 'removeForeshadowingPayoff'
    | 'renameFile';
  payload?: {
    tag?: string;
    reference?: string;
    itemPath?: string;
    // ファイル名変更関連
    oldName?: string;
    newName?: string;
    responseId?: string;
    // 伏線関連
    plant?: ForeshadowingPoint;
    plantIndex?: number;
    payoff?: ForeshadowingPoint;
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
  private fileWatcher?: vscode.FileSystemWatcher;
  private fileChangeNotificationService: FileChangeNotificationService;
  private fileChangeDisposable?: DisposableEvent;

  constructor(private readonly _extensionUri: vscode.Uri) {
    this.fileChangeNotificationService = FileChangeNotificationService.getInstance();
    // ファイル変更イベントの購読
    this.setupFileChangeListener();
    // meta.yamlファイルの変更を監視
    this.setupFileWatcher();
  }

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

  /**
   * ファイル変更イベントリスナーをセットアップ
   */
  private setupFileChangeListener(): void {
    this.fileChangeDisposable = this.fileChangeNotificationService.onFileChanged((event) => {
      this.logger.info(
        `ファイル変更イベント受信: ${event.type} - ${event.filePath} (メタデータ: ${JSON.stringify(event.metadata)})`,
      );
      // 現在表示中のファイルに関連する変更の場合のみ更新
      const shouldRefresh = this.shouldRefreshForFileChange(event);
      this.logger.info(
        `WebView更新判定: ${shouldRefresh} (現在のファイル: ${this.currentItem?.path})`,
      );
      if (shouldRefresh) {
        this.logger.info(
          `ファイル変更イベントによるWebView更新実行: ${event.type} - ${event.filePath}`,
        );
        void this.refreshCurrentItem();
      } else {
        this.logger.warn(
          `WebView更新をスキップ: ${event.type} - ${event.filePath} (現在: ${this.currentItem?.path})`,
        );
      }
    });
  }

  /**
   * ファイル変更イベントでWebViewを更新すべきかを判定
   */
  private shouldRefreshForFileChange(event: {
    type: FileChangeType;
    filePath: string;
    oldPath?: string;
  }): boolean {
    if (
      this.currentItem?.path === undefined ||
      this.currentItem.path === null ||
      this.currentItem.path === ''
    ) {
      this.logger.debug('更新判定: currentItemが無効');
      return false;
    }

    const currentFileDir = path.dirname(this.currentItem.path);
    const eventFileDir = path.dirname(event.filePath);

    switch (event.type) {
      case FileChangeType.META_YAML_UPDATED: {
        // 現在のファイルと同じディレクトリのmeta.yamlが更新された場合
        const metaYamlMatch = eventFileDir === currentFileDir;
        this.logger.debug(
          `META_YAML_UPDATED判定: eventDir=${eventFileDir}, currentDir=${currentFileDir}, match=${metaYamlMatch}`,
        );
        return metaYamlMatch;
      }

      case FileChangeType.REFERENCE_UPDATED: {
        // 現在のファイル自体の参照が更新された場合
        const referenceMatch = event.filePath === this.currentItem.path;
        this.logger.debug(
          `REFERENCE_UPDATED判定: eventFile=${event.filePath}, currentFile=${this.currentItem.path}, match=${referenceMatch}`,
        );
        return referenceMatch;
      }

      case FileChangeType.FILE_MOVED: {
        // 現在のファイルが移動された場合、または現在のファイルから参照されているファイルが移動された場合
        const moveMatch =
          event.filePath === this.currentItem.path || event.oldPath === this.currentItem.path;
        this.logger.debug(
          `FILE_MOVED判定: eventFile=${event.filePath}, oldPath=${event.oldPath}, currentFile=${this.currentItem.path}, match=${moveMatch}`,
        );
        return moveMatch;
      }

      case FileChangeType.FILE_REORDERED: {
        // 現在のファイルと同じディレクトリで並び替えが発生した場合
        const reorderMatch = event.filePath === currentFileDir;
        this.logger.debug(
          `FILE_REORDERED判定: eventPath=${event.filePath}, currentDir=${currentFileDir}, match=${reorderMatch}`,
        );
        return reorderMatch;
      }

      default:
        this.logger.debug(`未知のイベント種別: ${event.type}`);
        return false;
    }
  }

  /**
   * FileSystemWatcherを設定してmeta.yamlファイルとマークダウンファイルの変更を監視
   */
  private setupFileWatcher(): void {
    // .dialogoi-meta.yamlファイルの変更を監視
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/.dialogoi-meta.yaml');

    // ファイル変更時の処理
    this.fileWatcher.onDidChange((uri) => {
      this.logger.debug(`meta.yamlファイルが変更されました: ${uri.fsPath}`);
      void this.refreshCurrentItem();
    });

    // ファイル作成・削除時の処理
    this.fileWatcher.onDidCreate((uri) => {
      this.logger.debug(`meta.yamlファイルが作成されました: ${uri.fsPath}`);
      void this.refreshCurrentItem();
    });

    this.fileWatcher.onDidDelete((uri) => {
      this.logger.debug(`meta.yamlファイルが削除されました: ${uri.fsPath}`);
      void this.refreshCurrentItem();
    });

    // マークダウンファイル（設定ファイル）の変更も監視（ハイパーリンク変更の検出用）
    const markdownFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    markdownFileWatcher.onDidChange((uri) => {
      this.logger.info(`マークダウンファイルが変更されました: ${uri.fsPath}`);
      // 現在表示中のファイルまたは関連ファイルの場合のみ更新
      const shouldRefresh = this.shouldRefreshForMarkdownChange(uri.fsPath);
      this.logger.info(
        `詳細パネル更新判定: ${shouldRefresh} (現在のファイル: ${this.currentItem?.path})`,
      );
      if (shouldRefresh) {
        this.logger.info('ハイパーリンク変更による詳細パネル更新を実行');
        void this.refreshCurrentItem();
      }
    });

    // リソース管理のためにマークダウンファイルウォッチャーも記録
    // 既存のfileWatcherに統合はせず、dispose時に両方とも破棄する
    const originalDispose = this.dispose.bind(this);
    this.dispose = (): void => {
      markdownFileWatcher.dispose();
      originalDispose();
    };
  }

  /**
   * マークダウンファイルの変更で詳細パネルを更新すべきかを判定
   */
  private shouldRefreshForMarkdownChange(changedFilePath: string): boolean {
    if (!this.currentItem || !this.currentItem.path) {
      return false;
    }

    // 現在表示中のファイル自体が変更された場合
    if (this.currentItem.path === changedFilePath) {
      return true;
    }

    // 設定ファイルの場合は常に更新（ハイパーリンクが変更された可能性）
    if (this.currentItem.type === 'setting') {
      return true;
    }

    return false;
  }

  /**
   * 現在のアイテムを再読み込みしてWebViewを更新
   */
  private refreshCurrentItem(): void {
    if (this.currentItem && this._view && this.treeDataProvider) {
      this.logger.debug(`WebView更新実行: ${this.currentItem.path}`);

      // TreeDataProviderから最新のアイテムデータを取得
      const updatedItem = this.getUpdatedCurrentItem();
      if (updatedItem) {
        this.logger.debug('最新のアイテムデータを取得して更新');
        void this.updateFileDetails(updatedItem);
      } else {
        this.logger.warn('最新のアイテムデータが取得できませんでした。古いデータで更新します。');
        void this.updateFileDetails(this.currentItem);
      }
    } else {
      this.logger.debug('WebView更新スキップ: currentItem、view、またはtreeDataProviderが無効');
    }
  }

  /**
   * TreeDataProviderから現在のアイテムの最新データを取得
   */
  private getUpdatedCurrentItem(): DialogoiTreeItem | null {
    if (!this.currentItem || !this.treeDataProvider) {
      return null;
    }

    try {
      // TreeDataProviderに最新データを要求するメソッドが必要
      // 現在はTreeDataProviderにそのようなメソッドがないため、
      // meta.yamlから直接読み込む
      const dirPath = path.dirname(this.currentItem.path);
      const fileName = this.currentItem.name;

      if (this.metaYamlService) {
        const meta = this.metaYamlService.loadMetaYaml(dirPath);
        if (meta) {
          const fileItem = meta.files.find((item) => item.name === fileName);
          if (fileItem) {
            // 現在のアイテムを最新データで更新
            return {
              ...this.currentItem,
              tags: fileItem.tags || [],
              references: fileItem.references || [],
              character: fileItem.character,
              review_count: fileItem.review_count,
            };
          }
        }
      }
    } catch (error) {
      this.logger.error(
        '最新アイテムデータの取得エラー',
        error instanceof Error ? error : String(error),
      );
    }

    return null;
  }

  /**
   * 設定ファイルの参照をハイパーリンクから抽出
   */
  private async getSettingFileReferences(filePath: string): Promise<{
    allReferences: string[];
    references: Array<{ path: string; source: 'hyperlink' }>;
    referencedBy: Array<{ path: string; source: 'manual' | 'hyperlink' }>;
  }> {
    try {
      // プロジェクトルートを取得
      const projectRoot = await this.dialogoiYamlService?.findProjectRootAsync(filePath);
      if (projectRoot === undefined || projectRoot === null || projectRoot === '') {
        return { allReferences: [], references: [], referencedBy: [] };
      }

      // ServiceContainerからサービスを取得
      const serviceContainer = ServiceContainer.getInstance();
      const hyperlinkExtractorService = serviceContainer.getHyperlinkExtractorService();

      // ファイルからプロジェクト内リンクを抽出
      const projectLinks = hyperlinkExtractorService.extractProjectLinks(filePath);

      // ReferenceManager形式に変換
      const references = projectLinks.map((linkPath) => ({
        path: linkPath,
        source: 'hyperlink' as const,
      }));

      // 設定ファイルは他のファイルから参照されることもある
      const referenceManager = ReferenceManager.getInstance();

      // ReferenceManagerが初期化されていない場合は初期化
      if (!referenceManager.isInitialized()) {
        const fileRepository = serviceContainer.getFileRepository();
        referenceManager.initialize(projectRoot, fileRepository);
      }

      const referenceInfo = referenceManager.getReferences(filePath);

      const result = {
        allReferences: projectLinks,
        references,
        referencedBy: referenceInfo.referencedBy,
      };

      return result;
    } catch (error) {
      this.logger.error(
        '設定ファイルの参照抽出エラー',
        error instanceof Error ? error : String(error),
      );
      return {
        allReferences: [],
        references: [],
        referencedBy: [],
      };
    }
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
    if (this.fileChangeDisposable) {
      this.fileChangeDisposable.dispose();
      this.fileChangeDisposable = undefined;
    }
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview);

    // WebViewからのメッセージを受信
    webviewView.webview.onDidReceiveMessage((data) => {
      this.handleMessage(data);
    });

    this.logger.debug('FileDetailsViewProvider初期化完了');
  }

  /**
   * VSCode起動時のアクティブエディタをチェック
   */
  public checkInitialActiveEditor(): void {
    // VSCode APIが利用可能かチェック
    if (typeof vscode === 'undefined' || vscode.window === undefined) {
      this.logger.debug('VSCode APIが利用できません');
      return;
    }

    if (vscode.window.activeTextEditor) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor.document?.fileName) {
        this.logger.debug(
          `起動時のアクティブファイルをチェック: ${activeEditor.document.fileName}`,
        );
        void this.updateFileDetailsByPath(activeEditor.document.fileName);
      }
    } else {
      this.logger.debug('起動時にアクティブなエディタはありません');
    }
  }

  /**
   * アクティブエディタのファイルパスから詳細情報を更新
   * @param filePath アクティブエディタで開いているファイルの絶対パス
   */
  public async updateFileDetailsByPath(filePath: string): Promise<void> {
    if (!this.treeDataProvider) {
      this.logger.debug('TreeDataProviderが設定されていません');
      return;
    }

    // ファイルパスからDialogoiTreeItemを検索
    const item = await this.treeDataProvider.findItemByAbsolutePath(filePath);
    if (item !== null) {
      this.logger.debug(`アクティブエディタファイルの詳細を更新: ${item.name}`);
      await this.updateFileDetails(item);
    } else {
      // Dialogoi管理対象外のファイルの場合は詳細表示をクリア
      this.logger.debug(`Dialogoi管理対象外ファイル: ${filePath}`);
      await this.updateFileDetails(null);
    }
  }

  /**
   * ファイル詳細情報を更新
   */
  public async updateFileDetails(item: DialogoiTreeItem | null): Promise<void> {
    this.currentItem = item;

    if (this._view) {
      // 参照情報を取得
      let referenceData = null;
      if (item?.path !== undefined && item.path !== null && item.path !== '') {
        if (item.type === 'setting') {
          // 設定ファイルの場合：ハイパーリンクから参照を抽出
          referenceData = await this.getSettingFileReferences(item.path);
        } else {
          // 本文ファイルの場合：ReferenceManagerから参照情報を取得
          const referenceManager = ReferenceManager.getInstance();
          const allReferences = referenceManager.getAllReferencePaths(item.path);
          const referenceInfo = referenceManager.getReferences(item.path);
          referenceData = {
            allReferences,
            references: referenceInfo.references,
            referencedBy: referenceInfo.referencedBy,
          };
        }
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
            foreshadowing: item.foreshadowing,
          }
        : null;

      if (this._view !== undefined && this._view.webview !== undefined) {
        this._view.webview.postMessage({
          type: 'updateFile',
          data: fileDetailsData,
        });
      }
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
      case 'removeReverseReference':
        if (
          msg.payload?.reference !== undefined &&
          msg.payload.reference !== null &&
          msg.payload.reference !== ''
        ) {
          void this.handleRemoveReverseReference(msg.payload.reference);
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
          void this.handleOpenReference(msg.payload.reference);
        }
        break;
      case 'ready':
        // WebViewの準備完了
        this.logger.debug('WebView準備完了 - 起動時アクティブエディタをチェック');
        this.checkInitialActiveEditor();
        void this.updateFileDetails(this.currentItem);
        void this.updateTreeData();
        break;
      case 'renameFile':
        if (
          msg.payload?.oldName !== undefined &&
          msg.payload.oldName !== null &&
          msg.payload.newName !== undefined &&
          msg.payload.newName !== null &&
          msg.payload.responseId !== undefined
        ) {
          void this.handleRenameFile(
            msg.payload.oldName,
            msg.payload.newName,
            msg.payload.responseId,
          );
        }
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
      case 'addForeshadowingPlant':
        if (msg.payload?.plant !== undefined && msg.payload.plant !== null) {
          this.handleAddForeshadowingPlant(msg.payload.plant);
        }
        break;
      case 'removeForeshadowingPlant':
        if (msg.payload?.plantIndex !== undefined && msg.payload.plantIndex !== null) {
          this.handleRemoveForeshadowingPlant(msg.payload.plantIndex);
        }
        break;
      case 'updateForeshadowingPlant':
        if (
          msg.payload?.plantIndex !== undefined &&
          msg.payload.plantIndex !== null &&
          msg.payload.plant !== undefined &&
          msg.payload.plant !== null
        ) {
          this.handleUpdateForeshadowingPlant(msg.payload.plantIndex, msg.payload.plant);
        }
        break;
      case 'setForeshadowingPayoff':
        if (msg.payload?.payoff !== undefined && msg.payload.payoff !== null) {
          this.handleSetForeshadowingPayoff(msg.payload.payoff);
        }
        break;
      case 'removeForeshadowingPayoff':
        this.handleRemoveForeshadowingPayoff();
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

        // TreeViewを更新（WebViewは自動的にイベント経由で更新される）
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'add_tag',
          tag,
          fileName,
        });
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

        // TreeViewを更新（WebViewは自動的にイベント経由で更新される）
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'remove_tag',
          tag,
          fileName,
        });
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
        // TreeDataProviderで既にFileChangeNotificationService.notifyReferenceUpdatedが呼ばれるため、ここでは不要
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
  private async handleOpenReference(reference: string): Promise<void> {
    if (!reference || !this.currentItem) {
      return;
    }

    try {
      // プロジェクトルートを取得
      let projectRoot: string | null = null;
      if (this.dialogoiYamlService) {
        const currentFileAbsolutePath = this.currentItem.path;
        projectRoot = await this.dialogoiYamlService.findProjectRootAsync(currentFileAbsolutePath);
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
   * 逆参照削除処理（参照元ファイルから参照を削除）
   */
  private async handleRemoveReverseReference(referenceSourceFile: string): Promise<void> {
    if (!this.currentItem || !referenceSourceFile) {
      return;
    }

    try {
      // 現在のファイルのプロジェクトルートを取得
      const projectRoot = await this.dialogoiYamlService?.findProjectRootAsync(
        this.currentItem.path,
      );
      if (projectRoot === undefined || projectRoot === null || projectRoot === '') {
        throw new Error('プロジェクトルートが見つかりません');
      }

      // 参照元ファイルの絶対パスを計算
      const referenceSourceAbsolutePath = path.join(projectRoot, referenceSourceFile);
      const referenceSourceDirPath = path.dirname(referenceSourceAbsolutePath);
      const referenceSourceFileName = path.basename(referenceSourceAbsolutePath);

      // 現在のファイルのプロジェクト相対パスを計算
      const currentFileRelativePath = path
        .relative(projectRoot, this.currentItem.path)
        .replace(/\\/g, '/');

      // 参照元ファイルのmeta.yamlから現在のファイルへの参照を削除
      const success = this.metaYamlService?.removeFileReference(
        referenceSourceDirPath,
        referenceSourceFileName,
        currentFileRelativePath,
      );

      if (success === true) {
        this.logger.info(`逆参照削除: ${referenceSourceFile} → ${this.currentItem.name}`);
        vscode.window.showInformationMessage(`参照 "${referenceSourceFile}" を削除しました`);

        // ReferenceManagerも更新する必要がある
        const referenceManager = ReferenceManager.getInstance();
        if (referenceManager.isInitialized()) {
          // 参照元ファイルのハイパーリンク参照を再スキャン
          referenceManager.updateFileHyperlinkReferences(referenceSourceAbsolutePath);

          // プロジェクト全体の参照関係を再スキャンして確実に更新
          const fileRepository = ServiceContainer.getInstance().getFileRepository();
          referenceManager.initialize(projectRoot, fileRepository);
        }

        // TreeViewを更新（WebViewは自動的にイベント経由で更新される）
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // 参照更新イベントを通知
        this.logger.debug(`逆参照削除イベント通知: ${this.currentItem.path}`);
        this.fileChangeNotificationService.notifyReferenceUpdated(this.currentItem.path, {
          operation: 'reverse_remove',
          referenceSourceFile,
          targetFile: this.currentItem.name,
        });
      } else {
        throw new Error('参照の削除に失敗しました');
      }
    } catch (error) {
      this.logger.error('逆参照削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `参照の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 参照削除処理
   */
  private handleRemoveReference(reference: string): void {
    if (!this.currentItem || !reference || !this.treeDataProvider) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // TreeDataProviderのremoveReferenceメソッドを使用
      const result = this.treeDataProvider.removeReference(dirPath, fileName, reference);
      if (result.success) {
        this.logger.info(`参照削除: ${reference} → ${fileName}`);
        vscode.window.showInformationMessage(result.message);
        // TreeDataProviderで既にFileChangeNotificationService.notifyReferenceUpdatedが呼ばれるため、ここでは不要
      } else {
        vscode.window.showErrorMessage(result.message);
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

        // TreeViewを更新（WebViewは自動的にイベント経由で更新される）
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'remove_character',
          fileName,
        });
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
   * 伏線の植込み位置を追加
   */
  private handleAddForeshadowingPlant(plant: ForeshadowingPoint): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // ServiceContainerからForeshadowingServiceを取得
      const serviceContainer = ServiceContainer.getInstance();
      const foreshadowingService = serviceContainer.getForeshadowingService();

      const result = foreshadowingService.addPlant(dirPath, fileName, plant);

      if (result.success) {
        this.logger.info(`伏線植込み位置追加: ${plant.location} → ${fileName}`);
        vscode.window.showInformationMessage(result.message);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'add_foreshadowing_plant',
          fileName,
          plant,
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('伏線植込み位置追加エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `伏線の追加に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 伏線の植込み位置を削除
   */
  private handleRemoveForeshadowingPlant(index: number): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // ServiceContainerからForeshadowingServiceを取得
      const serviceContainer = ServiceContainer.getInstance();
      const foreshadowingService = serviceContainer.getForeshadowingService();

      const result = foreshadowingService.removePlant(dirPath, fileName, index);

      if (result.success) {
        this.logger.info(`伏線植込み位置削除: インデックス ${index} → ${fileName}`);
        vscode.window.showInformationMessage(result.message);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'remove_foreshadowing_plant',
          fileName,
          plantIndex: index,
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('伏線植込み位置削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `伏線の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 伏線の植込み位置を更新
   */
  private handleUpdateForeshadowingPlant(index: number, plant: ForeshadowingPoint): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // ServiceContainerからForeshadowingServiceを取得
      const serviceContainer = ServiceContainer.getInstance();
      const foreshadowingService = serviceContainer.getForeshadowingService();

      const result = foreshadowingService.updatePlant(dirPath, fileName, index, plant);

      if (result.success) {
        this.logger.info(`伏線植込み位置更新: インデックス ${index} → ${fileName}`);
        vscode.window.showInformationMessage(result.message);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'update_foreshadowing_plant',
          fileName,
          plantIndex: index,
          plant,
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('伏線植込み位置更新エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `伏線の更新に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 伏線の回収位置を設定
   */
  private handleSetForeshadowingPayoff(payoff: ForeshadowingPoint): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // ServiceContainerからForeshadowingServiceを取得
      const serviceContainer = ServiceContainer.getInstance();
      const foreshadowingService = serviceContainer.getForeshadowingService();

      const result = foreshadowingService.setPayoff(dirPath, fileName, payoff);

      if (result.success) {
        this.logger.info(`伏線回収位置設定: ${payoff.location} → ${fileName}`);
        vscode.window.showInformationMessage(result.message);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'set_foreshadowing_payoff',
          fileName,
          payoff,
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('伏線回収位置設定エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `伏線回収位置の設定に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 伏線の回収位置を削除
   */
  private handleRemoveForeshadowingPayoff(): void {
    if (!this.currentItem) {
      return;
    }

    try {
      const dirPath = path.dirname(this.currentItem.path || '');
      const fileName = this.currentItem.name;

      // ServiceContainerからForeshadowingServiceを取得
      const serviceContainer = ServiceContainer.getInstance();
      const foreshadowingService = serviceContainer.getForeshadowingService();

      const result = foreshadowingService.removePayoff(dirPath, fileName);

      if (result.success) {
        this.logger.info(`伏線回収位置削除: ${fileName}`);
        vscode.window.showInformationMessage(result.message);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // メタデータ更新イベントを通知
        const metaYamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        this.fileChangeNotificationService.notifyMetaYamlUpdated(metaYamlPath, {
          operation: 'remove_foreshadowing_payoff',
          fileName,
        });
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    } catch (error) {
      this.logger.error('伏線回収位置削除エラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage(
        `伏線回収位置の削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * ファイル名変更処理（非同期）
   */
  private async handleRenameFile(
    oldName: string,
    newName: string,
    responseId: string,
  ): Promise<void> {
    try {
      if (!this.currentItem || !this.treeDataProvider) {
        this.sendRenameResponse(responseId, false, 'ファイルが選択されていません');
        return;
      }

      const dirPath = this.treeDataProvider.getDirectoryPath(this.currentItem);
      this.logger.info(`ファイル名変更: ${oldName} → ${newName} (${dirPath})`);

      // ServiceContainerからFileOperationServiceを取得してrenameFileAsyncメソッドを使用
      const serviceContainer = ServiceContainer.getInstance();
      const fileOperationService = serviceContainer.getFileOperationService();

      const result = await fileOperationService.renameFileAsync(dirPath, oldName, newName);

      if (result.success) {
        this.sendRenameResponse(responseId, true);
        this.logger.info(`ファイル名変更成功: ${oldName} → ${newName}`);

        // TreeViewを更新
        if (this.treeDataProvider !== null) {
          this.treeDataProvider.refresh();
        }

        // 詳細パネルの更新
        void this.refreshCurrentItem();
      } else {
        this.sendRenameResponse(responseId, false, result.message);
        this.logger.error(`ファイル名変更失敗: ${result.message}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('ファイル名変更エラー', error instanceof Error ? error : String(error));
      this.sendRenameResponse(responseId, false, errorMessage);
    }
  }

  /**
   * ファイル名変更のレスポンスをWebViewに送信
   */
  private sendRenameResponse(responseId: string, success: boolean, error?: string): void {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      type: 'renameFileResponse',
      responseId,
      success,
      error,
    });
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
  private async _getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const nonce = this._getNonce();

    // WebViewリソースのURIを生成
    const webviewDir = path.join(this._extensionUri.fsPath, 'webview');
    const outDir = path.join(this._extensionUri.fsPath, 'out', 'webviews', 'fileDetails');
    const stylesheetUri = webview.asWebviewUri(vscode.Uri.file(path.join(webviewDir, 'style.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(outDir, 'script.js')));

    // HTMLテンプレートファイルを読み込み
    const htmlPath = path.join(webviewDir, 'index.html');
    const htmlContent = await vscode.workspace.fs.readFile(vscode.Uri.file(htmlPath));
    let htmlContentString = Buffer.from(htmlContent).toString('utf8');

    // プレースホルダーを置換
    htmlContentString = htmlContentString
      .replace(/{nonce}/g, nonce)
      .replace(/{stylesheetUri}/g, stylesheetUri.toString())
      .replace(/{scriptUri}/g, scriptUri.toString());

    return htmlContentString;
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
