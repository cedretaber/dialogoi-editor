import * as vscode from 'vscode';
import * as path from 'path';
import {
  DialogoiTreeItem,
  hasTagsProperty,
  hasReferencesProperty,
  hasCharacterProperty,
  hasForeshadowingProperty,
  isGlossaryItem,
} from '../utils/MetaYamlUtils.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { TreeViewFilterService, FilterState } from '../services/TreeViewFilterService.js';
import { Logger } from '../utils/Logger.js';
import { FileOperationResult } from '../services/CoreFileService.js';
import { FileChangeNotificationService } from '../services/FileChangeNotificationService.js';
import { FileStatus } from '../services/FileStatusService.js';

/**
 * TreeViewのデータプロバイダー
 *
 * ⚠️ 重要な注意事項:
 * - このファイルはVSCode APIに依存しているため、単体テストが書けません
 * - そのため、できる限りロジックをこのクラスに書かず、VSCodeに依存しないクラスに実装してください
 * - 特に、ビジネスロジックは必ずservices/にサービスクラスを作成し、そこに実装してください
 * - 例: フィルタリングロジック → TreeViewFilterService
 * - このクラスは主にVSCode APIとの橋渡し役に徹し、ロジック部分は外部サービスに委譲してください
 */
export class DialogoiTreeDataProvider
  implements
    vscode.TreeDataProvider<DialogoiTreeItem>,
    vscode.TreeDragAndDropController<DialogoiTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<DialogoiTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DialogoiTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DialogoiTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // 選択変更イベント
  private _onDidChangeSelection: vscode.EventEmitter<DialogoiTreeItem[]> = new vscode.EventEmitter<
    DialogoiTreeItem[]
  >();
  readonly onDidChangeSelection: vscode.Event<DialogoiTreeItem[]> =
    this._onDidChangeSelection.event;

  // 現在の選択状態を保持
  private currentSelection: DialogoiTreeItem[] = [];

  // fire呼び出しを追跡するためのラッパー
  private fireTreeDataChange(): void {
    const stack = new Error().stack;
    const caller = stack?.split('\n')[2]?.trim() ?? 'unknown';
    this.logger.info(`_onDidChangeTreeData.fire呼び出し: caller=${caller}`);
    this._onDidChangeTreeData.fire();
  }

  private workspaceRoot: string;
  private novelRoot: string | null = null;
  private filterService: TreeViewFilterService = new TreeViewFilterService();
  private logger = Logger.getInstance();
  private fileChangeNotificationService: FileChangeNotificationService;
  private loadMetaYamlCache: Map<string, DialogoiTreeItem[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 1000; // 1秒間キャッシュ

  // 無限ループ検出用
  private searchInProgress: Set<string> = new Set();
  private lastSearchPath: string | null = null;
  private lastSearchTime: number = 0;

  // ドラッグ&ドロップ用のMIMEタイプ定義
  readonly dropMimeTypes = ['application/vnd.code.tree.dialogoi-explorer'];
  readonly dragMimeTypes = ['application/vnd.code.tree.dialogoi-explorer'];

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    this.fileChangeNotificationService = FileChangeNotificationService.getInstance();
    // 非同期初期化は別途呼び出す
    void this.findNovelRoot();
  }

  private async findNovelRoot(): Promise<void> {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    this.novelRoot = await metaYamlService.findNovelRootAsync(this.workspaceRoot);
    if (this.novelRoot !== null) {
      // コンテキストにノベルプロジェクトが存在することを設定
      vscode.commands.executeCommand('setContext', 'dialogoi:hasNovelProject', true);

      // 参照関係を初期化（まだ初期化されていない場合のみ）
      const referenceManager = ReferenceManager.getInstance();
      if (!referenceManager.isInitialized()) {
        const fileRepository = ServiceContainer.getInstance().getFileRepository();
        void referenceManager.initialize(this.novelRoot, fileRepository);
      }

      this.logger.info(`novelRoot初期化完了: ${this.novelRoot}`);
      // 初期化完了後にTreeViewを更新
      this.fireTreeDataChange();
    } else {
      // プロジェクトが見つからない場合は明示的にfalseに設定
      vscode.commands.executeCommand('setContext', 'dialogoi:hasNovelProject', false);
      this.logger.warn('novelRootが見つかりませんでした');
    }
  }

  refresh(): void {
    // キャッシュをクリア
    this.loadMetaYamlCache.clear();
    this.cacheExpiry.clear();

    // findNovelRootの完了を待ってからTreeViewを更新（fireTreeDataChangeはfindNovelRoot内で実行）
    void this.findNovelRoot();
  }

  /**
   * タグでフィルタリングを設定
   */
  setTagFilter(tagValue: string): void {
    this.filterService.setTagFilter(tagValue);
    this.fireTreeDataChange();
  }

  /**
   * フィルターを解除
   */
  clearFilter(): void {
    this.filterService.clearFilter();
    this.fireTreeDataChange();
  }

  /**
   * 現在のフィルター状態を取得
   */
  getFilterState(): FilterState {
    return this.filterService.getFilterState();
  }

  /**
   * WebView用のツリーデータを取得（getChildrenを呼ばない）
   * キャッシュされたデータがある場合はそれを返し、ない場合は直接読み込む
   */
  async getTreeDataForWebView(): Promise<DialogoiTreeItem[]> {
    if (this.novelRoot === null) {
      return [];
    }

    // キャッシュをチェック（getChildrenを呼び出さない）
    const cached = this.loadMetaYamlCache.get(this.novelRoot);
    const expiry = this.cacheExpiry.get(this.novelRoot);
    const now = Date.now();

    if (cached && expiry !== null && expiry !== undefined && now < expiry) {
      this.logger.debug(`WebView用データをキャッシュから返却: ${this.novelRoot}`);
      return cached;
    }

    // キャッシュがない場合は直接読み込み（TreeViewの更新を発生させない）
    return await this.loadMetaYaml(this.novelRoot);
  }

  /**
   * ノベルルートパスを取得
   */
  getNovelRoot(): string | null {
    return this.novelRoot;
  }

  /**
   * 絶対パスからDialogoiTreeItemを検索
   * @param absolutePath 検索するファイルの絶対パス
   * @returns 見つかったTreeItem、見つからない場合はnull
   */
  async findItemByAbsolutePath(absolutePath: string): Promise<DialogoiTreeItem | null> {
    if (this.novelRoot === null) {
      return null;
    }

    // プロジェクト内のファイルかチェック
    if (!absolutePath.startsWith(this.novelRoot)) {
      return null;
    }

    // 頻繁な同じパス検索を防ぐ（デバウンス）
    const now = Date.now();
    if (this.lastSearchPath === absolutePath && now - this.lastSearchTime < 300) {
      return null;
    }

    this.lastSearchPath = absolutePath;
    this.lastSearchTime = now;

    // ルートディレクトリから再帰的に検索
    return await this.searchItemInDirectory(this.novelRoot, absolutePath);
  }

  /**
   * 指定されたディレクトリ内でTreeItemを再帰的に検索
   * @param dirPath 検索するディレクトリパス
   * @param targetPath 検索対象のファイルパス
   * @returns 見つかったTreeItem、見つからない場合はnull
   */
  private async searchItemInDirectory(
    dirPath: string,
    targetPath: string,
  ): Promise<DialogoiTreeItem | null> {
    // 無限ループ検出: 既に検索中のディレクトリなら中断
    const searchKey = `${dirPath}:${targetPath}`;
    if (this.searchInProgress.has(searchKey)) {
      this.logger.warn(`無限ループ検出: ${searchKey} の検索を中断しました`);
      return null;
    }

    // 検索開始をマーク
    this.searchInProgress.add(searchKey);

    try {
      const items = await this.loadMetaYaml(dirPath);

      for (const item of items) {
        // アイテムのパス（item.path）と検索対象パスが一致するかチェック
        if (item.path === targetPath) {
          return item;
        }

        // サブディレクトリの場合は再帰的に検索
        if (item.type === 'subdirectory') {
          const subResult = await this.searchItemInDirectory(item.path, targetPath);
          if (subResult !== null) {
            return subResult;
          }
        }
      }

      return null;
    } finally {
      // 検索終了をマーク
      this.searchInProgress.delete(searchKey);
    }
  }

  /**
   * フィルターが適用されているかチェック
   */
  isFilterActive(): boolean {
    return this.filterService.isFilterActive();
  }

  async getTreeItem(element: DialogoiTreeItem): Promise<vscode.TreeItem> {
    const isDirectory = element.type === 'subdirectory';
    // ディレクトリは手動展開のみ可能にする（自動展開による無限ループを回避）
    const collapsibleState = isDirectory
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    // 表示名を決定（キャラクターファイルの場合はマークダウンから取得）
    let displayName = element.name;
    if (hasCharacterProperty(element) && element.character.display_name !== undefined) {
      displayName = element.character.display_name;
    } else if (hasCharacterProperty(element) && !isDirectory) {
      // display_nameが設定されていない場合は自動取得
      const characterService = ServiceContainer.getInstance().getCharacterService();
      displayName = await characterService.extractDisplayName(element.path);
    }

    const item = new vscode.TreeItem(displayName, collapsibleState);

    // ファイル状態に基づく視覚表現の設定
    if (element.isMissing === true) {
      // 欠損ファイル: 赤字、取り消し線、エラーアイコン
      item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      item.label = `${displayName}`;
      item.description = '(存在しません)';
      // 取り消し線はVSCodeのMarkdownStringで実現
      item.tooltip = `⚠️ ファイルが存在しません: ${element.path}`;
    } else if (element.isUntracked === true) {
      // 未追跡ファイル: グレーアウト、専用アイコン
      item.iconPath = new vscode.ThemeIcon(
        'file-submodule',
        new vscode.ThemeColor('disabledForeground'),
      );
      item.description = '(管理対象外)';
      item.tooltip = `管理対象外ファイル: ${element.path}`;
    } else {
      // アイコンの設定（通常のファイル・ディレクトリ）
      if (element.type === 'content') {
        item.iconPath = new vscode.ThemeIcon('file-text');
      } else if (element.type === 'setting') {
        if (isGlossaryItem(element)) {
          item.iconPath = new vscode.ThemeIcon('book');
        } else if (hasCharacterProperty(element)) {
          // 重要度に応じたアイコン
          if (element.character.importance === 'main') {
            item.iconPath = new vscode.ThemeIcon('star');
          } else {
            item.iconPath = new vscode.ThemeIcon('person');
          }
        } else if (hasForeshadowingProperty(element)) {
          item.iconPath = new vscode.ThemeIcon('eye');
        } else {
          item.iconPath = new vscode.ThemeIcon('gear');
        }
      }
      // subdirectory の場合はアイコンを設定しない（VSCodeのデフォルト展開アイコンを使用）
    }

    // ファイルの場合はクリックで開く、ディレクトリの場合はREADME.mdを開く
    // ただし、欠損ファイルは開くことができない
    if (!isDirectory && element.isMissing !== true) {
      // 相対パスを絶対パスに変換
      const absolutePath = path.isAbsolute(element.path)
        ? element.path
        : path.join(this.workspaceRoot, element.path);
      const fileUri = vscode.Uri.file(absolutePath);
      item.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [fileUri],
      };
      // コンテキストメニューで使用するためのresourceUriを設定
      item.resourceUri = fileUri;
    } else if (isDirectory && element.isMissing !== true) {
      // ディレクトリの場合は.dialogoi-meta.yamlで指定されたreadmeファイルを開く
      const readmeFilePath = await this.getReadmeFilePath(element.path);
      if (readmeFilePath !== null) {
        // readmeFilePathも絶対パスに変換
        const absoluteReadmePath = path.isAbsolute(readmeFilePath)
          ? readmeFilePath
          : path.join(this.workspaceRoot, readmeFilePath);
        const readmeUri = vscode.Uri.file(absoluteReadmePath);
        item.command = {
          command: 'vscode.open',
          title: 'Open README',
          arguments: [readmeUri],
        };
        // ディレクトリの場合もresourceUriを設定（readmeファイルのパス）
        item.resourceUri = readmeUri;
      }
    }

    // タグとレビュー数の表示（ファイル状態表示がない場合のみ）
    if (element.isMissing !== true && element.isUntracked !== true) {
      const descriptionParts: string[] = [];

      // タグの表示
      if (hasTagsProperty(element) && element.tags.length > 0) {
        const tagString = element.tags.map((tag: string) => `#${tag}`).join(' ');
        descriptionParts.push(tagString);
      }

      // descriptionを設定
      if (descriptionParts.length > 0) {
        item.description = descriptionParts.join(' ');
      }
    }

    // tooltipの設定（タグと参照関係）
    await this.setTooltip(item, element);

    // コンテキストメニュー用のcontextValue（ファイル種類とメタデータに基づく）
    item.contextValue = this.getContextValue(element);

    return item;
  }

  async getChildren(element?: DialogoiTreeItem): Promise<DialogoiTreeItem[]> {
    if (this.novelRoot === null) {
      return [];
    }

    let result: DialogoiTreeItem[];
    if (element) {
      // サブディレクトリの場合、その中の.dialogoi-meta.yamlを読み込む
      result = await this.loadMetaYaml(element.path);

      // フィルタリング機能を一時的に無効化（無限ループ回避）
    } else {
      // ルートの場合、ノベルルートの.dialogoi-meta.yamlを読み込む
      result = await this.loadMetaYaml(this.novelRoot);

      // フィルタリング機能を一時的に無効化（無限ループ回避）
    }

    return result;
  }

  /**
   * TODO: 一時的に削除（無限ループ修正後に復活させる）
   * 再帰的フィルタリングを適用
   * サブディレクトリ内のファイルも含めてフィルタリングし、
   * マッチするファイルを含むディレクトリは表示、含まないディレクトリは除外
   */

  /**
   * TODO: 一時的に削除（無限ループ修正後に復活させる）
   * ディレクトリ内に（再帰的に）マッチするコンテンツがあるかチェック
   */

  private async loadMetaYaml(dirPath: string): Promise<DialogoiTreeItem[]> {
    // キャッシュチェック
    const now = Date.now();
    const cacheKey = dirPath;
    const cached = this.loadMetaYamlCache.get(cacheKey);
    const expiry = this.cacheExpiry.get(cacheKey);

    if (cached && expiry !== null && expiry !== undefined && now < expiry) {
      return cached;
    }

    // FileStatusServiceを使用して3状態のファイルを取得
    const fileStatusService = ServiceContainer.getInstance().getFileStatusService();
    const dialogoiYamlService = ServiceContainer.getInstance().getDialogoiYamlService();

    // プロジェクトルートから除外パターンを取得
    let excludePatterns: string[] = [];
    if (this.novelRoot !== null && this.novelRoot !== undefined && this.novelRoot !== '') {
      excludePatterns = await dialogoiYamlService.getExcludePatternsAsync(this.novelRoot);
    }

    try {
      const statusList = await fileStatusService.getFileStatusList(dirPath);

      // 除外パターンにマッチするファイルをフィルタリング（選択肢A: 表示しない）
      const filteredStatusList = statusList.filter((statusInfo) => {
        return !fileStatusService.isExcluded(statusInfo.name, excludePatterns);
      });

      // FileStatusInfoをDialogoiTreeItemに変換
      const result = filteredStatusList.map((statusInfo) => {
        const treeItem = fileStatusService.statusInfoToTreeItem(statusInfo);
        // 絶対パスを設定（statusInfoToTreeItemで既に設定されているが念のため）
        treeItem.path = statusInfo.absolutePath;
        return treeItem;
      });

      // キャッシュに保存
      this.loadMetaYamlCache.set(cacheKey, result);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);

      this.logger.info(
        `${dirPath} から ${result.length}個のアイテムを読み込みました（管理対象: ${filteredStatusList.filter((s) => s.status === FileStatus.Managed).length}, 未追跡: ${filteredStatusList.filter((s) => s.status === FileStatus.Untracked).length}, 欠損: ${filteredStatusList.filter((s) => s.status === FileStatus.Missing).length}）`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `loadMetaYaml: ${dirPath} の読み込みエラー`,
        error instanceof Error ? error : String(error),
      );
      return [];
    }
  }

  private async getReadmeFilePath(dirPath: string): Promise<string | null> {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    return await metaYamlService.getReadmeFilePathAsync(dirPath);
  }

  // ファイル操作メソッド
  async createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
    subtype?: 'character' | 'foreshadowing' | 'glossary',
  ): Promise<void> {
    const coreFileService = ServiceContainer.getInstance().getCoreFileService(
      this.novelRoot ?? undefined,
    );
    const result = await coreFileService.createFile(
      dirPath,
      fileName,
      fileType,
      initialContent,
      tags,
      subtype,
    );

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async deleteFile(dirPath: string, fileName: string): Promise<void> {
    const coreFileService = ServiceContainer.getInstance().getCoreFileService(
      this.novelRoot ?? undefined,
    );
    const result = await coreFileService.deleteFile(dirPath, fileName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async deleteDirectory(parentDir: string, dirName: string): Promise<void> {
    // 削除確認ダイアログ
    const confirmation = await vscode.window.showWarningMessage(
      `ディレクトリ「${dirName}」を削除しますか？`,
      {
        detail: 'この操作は取り消せません。ディレクトリとその中身がすべて削除されます。',
        modal: true,
      },
      '削除',
    );

    if (confirmation !== '削除') {
      return; // ユーザーがキャンセル
    }

    const coreFileService = ServiceContainer.getInstance().getCoreFileService(
      this.novelRoot ?? undefined,
    );
    const result = await coreFileService.deleteDirectory(parentDir, dirName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async reorderFiles(dirPath: string, fromIndex: number, toIndex: number): Promise<void> {
    const coreFileService = ServiceContainer.getInstance().getCoreFileService(
      this.novelRoot ?? undefined,
    );
    const result = await coreFileService.reorderFiles(dirPath, fromIndex, toIndex);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async renameFile(dirPath: string, oldName: string, newName: string): Promise<void> {
    const coreFileService = ServiceContainer.getInstance().getCoreFileService(
      this.novelRoot ?? undefined,
    );
    const result = await coreFileService.renameFile(dirPath, oldName, newName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  getCurrentDirectory(): string | null {
    return this.novelRoot;
  }

  getDirectoryPath(item: DialogoiTreeItem): string {
    if (item.type === 'subdirectory') {
      return item.path;
    } else {
      return item.path.substring(0, item.path.lastIndexOf('/'));
    }
  }

  // tooltip設定メソッド
  private async setTooltip(item: vscode.TreeItem, element: DialogoiTreeItem): Promise<void> {
    const tooltipParts: string[] = [];

    // キャラクター情報
    if (hasCharacterProperty(element)) {
      let displayName = element.character.display_name;
      if (displayName === undefined) {
        const characterService = ServiceContainer.getInstance().getCharacterService();
        displayName = await characterService.extractDisplayName(element.path);
      }
      if (displayName !== undefined) {
        tooltipParts.push(`${displayName} (${element.character.importance})`);
      }
    }

    // タグ情報
    if (hasTagsProperty(element) && element.tags.length > 0) {
      const tagString = element.tags.map((tag: string) => `#${tag}`).join(' ');
      tooltipParts.push(`タグ: ${tagString}`);
    }

    // 参照関係情報（キャラクターの場合は「登場話」として表示）
    if (element.type !== 'subdirectory') {
      const referenceManager = ReferenceManager.getInstance();
      const references = referenceManager.getReferences(element.path);

      // 双方向の参照を「登場話」として統合
      const allAppearances = new Set<string>();
      referenceManager.getAllReferencePaths(element.path).forEach((ref) => allAppearances.add(ref));
      references.referencedBy.forEach((refEntry) => allAppearances.add(refEntry.path));

      if (allAppearances.size > 0) {
        const validAppearances: string[] = [];
        const invalidAppearances: string[] = [];

        allAppearances.forEach((ref) => {
          // TODO: ReferenceManagerの@deprecated削除後に非同期版で対応
          // if (referenceManager.checkFileExists(ref)) {
          //   validAppearances.push(ref);
          // } else {
          //   invalidAppearances.push(ref);
          // }
          // 一時的にすべて有効として扱う
          validAppearances.push(ref);
        });

        if (hasCharacterProperty(element) && validAppearances.length > 0) {
          tooltipParts.push('');
          tooltipParts.push(`登場話: ${validAppearances.length}話`);
          validAppearances.forEach((ref) => {
            tooltipParts.push(`• ${ref}`);
          });
        } else if (
          element.type === 'setting' &&
          !hasCharacterProperty(element) &&
          validAppearances.length > 0
        ) {
          tooltipParts.push('');
          tooltipParts.push(`関連設定: ${validAppearances.length}個`);
          validAppearances.forEach((ref) => {
            tooltipParts.push(`• ${ref}`);
          });
        } else if (validAppearances.length > 0 || invalidAppearances.length > 0) {
          tooltipParts.push('');
          tooltipParts.push('参照関係:');
          validAppearances.forEach((ref) => {
            tooltipParts.push(`• ${ref}`);
          });
        }

        if (invalidAppearances.length > 0) {
          tooltipParts.push('');
          tooltipParts.push('無効な参照:');
          invalidAppearances.forEach((ref) => {
            tooltipParts.push(`• ~~${ref}~~ (存在しません)`);
          });
        }
      }
    }

    // 伏線情報（Phase 3で新しいUI実装予定）
    if (hasForeshadowingProperty(element)) {
      tooltipParts.push('');
      tooltipParts.push('伏線:');
      const plantsCount = element.foreshadowing.plants?.length || 0;
      tooltipParts.push(`• 埋蔵位置: ${plantsCount}箇所`);
      tooltipParts.push(`• 回収位置: ${element.foreshadowing.payoff?.location || '未設定'}`);
      tooltipParts.push('• 詳細はPhase 3で実装予定');
    }

    // tooltipを設定
    if (tooltipParts.length > 0) {
      item.tooltip = tooltipParts.join('\n');
    }
  }

  // タグ操作メソッド
  async addTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.addTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  async removeTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.removeTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  async setTags(dirPath: string, fileName: string, tags: string[]): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.setTags(dirPath, fileName, tags);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  // 参照関係操作メソッド
  async addReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.addReference(dirPath, fileName, referencePath);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const foundItem = result.updatedItems?.find((item) => item.name === fileName);
      const currentReferences =
        foundItem && hasReferencesProperty(foundItem) ? foundItem.references : [];
      referenceManager.updateFileReferences(filePath, currentReferences);

      this.refresh();

      // 参照更新イベントを通知
      this.fileChangeNotificationService.notifyReferenceUpdated(filePath, {
        operation: 'add',
        referencePath,
        fileName,
      });
    }

    return result;
  }

  async removeReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.removeReference(dirPath, fileName, referencePath);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const foundItem = result.updatedItems?.find((item) => item.name === fileName);
      const currentReferences =
        foundItem && hasReferencesProperty(foundItem) ? foundItem.references : [];
      referenceManager.updateFileReferences(filePath, currentReferences);

      this.refresh();

      // 参照更新イベントを通知
      this.fileChangeNotificationService.notifyReferenceUpdated(filePath, {
        operation: 'remove',
        referencePath,
        fileName,
      });
    }

    return result;
  }

  async setReferences(
    dirPath: string,
    fileName: string,
    references: string[],
  ): Promise<FileOperationResult> {
    const metadataService = ServiceContainer.getInstance().getMetadataService();
    const result = await metadataService.setReferences(dirPath, fileName, references);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const foundItem = result.updatedItems?.find((item) => item.name === fileName);
      const currentReferences =
        foundItem && hasReferencesProperty(foundItem) ? foundItem.references : [];
      referenceManager.updateFileReferences(filePath, currentReferences);

      this.refresh();
    }

    return result;
  }

  private getContextValue(element: DialogoiTreeItem): string {
    const baseValue = element.type === 'subdirectory' ? 'dialogoi-directory' : 'dialogoi-file';

    // ファイル状態に基づくコンテキスト値の設定
    if (element.isMissing === true) {
      return element.type === 'subdirectory'
        ? 'dialogoi-directory-missing'
        : 'dialogoi-file-missing';
    } else if (element.isUntracked === true) {
      return element.type === 'subdirectory'
        ? 'dialogoi-directory-untracked'
        : 'dialogoi-file-untracked';
    }

    if (element.type === 'subdirectory') {
      return baseValue;
    }

    // ファイル種別とメタデータに基づく詳細な分類
    const contextParts: string[] = [baseValue];

    // ファイル種別
    contextParts.push(element.type); // content または setting

    // 特殊なファイル種別
    if (element.type === 'setting') {
      if (isGlossaryItem(element)) {
        contextParts.push('glossary');
      } else if (hasCharacterProperty(element)) {
        contextParts.push('character');
      } else if (hasForeshadowingProperty(element)) {
        contextParts.push('foreshadowing');
      } else {
        contextParts.push('general');
      }
    }

    return contextParts.join('-');
  }

  // ドラッグ&ドロップ操作の確認ダイアログ
  private async confirmDropOperation(
    draggedItem: DialogoiTreeItem,
    target: DialogoiTreeItem,
  ): Promise<'reorder' | 'move' | null> {
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: '$(arrow-up) 前に並び替え',
          description: `「${target.name}」の前に「${draggedItem.name}」を移動`,
          detail: '同じ階層内での並び替え',
          action: 'reorder' as const,
        },
        {
          label: '$(folder) ディレクトリ内に移動',
          description: `「${draggedItem.name}」を「${target.name}」フォルダ内に移動`,
          detail: '異なるディレクトリへの移動',
          action: 'move' as const,
        },
      ],
      {
        placeHolder: 'どの操作を実行しますか？',
        ignoreFocusOut: true,
      },
    );

    return choice?.action || null;
  }

  // ドラッグ&ドロップ関連メソッド
  handleDrag(
    source: readonly DialogoiTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): void {
    if (source.length === 0) {
      return;
    }

    const draggedItem = source[0]; // 現在は単一選択のみサポート
    if (!draggedItem) {
      return;
    }

    // エディタ用のドロップデータ形式に変換
    // プロジェクトルートからの相対パスを計算
    const projectRoot = this.novelRoot;
    const projectRelativePath =
      projectRoot !== null && projectRoot !== undefined
        ? path.relative(projectRoot, draggedItem.path).replace(/\\/g, '/')
        : draggedItem.path;

    const dropData = {
      type: 'dialogoi-file',
      path: projectRelativePath,
      name: draggedItem.name,
      fileType: draggedItem.type,
      absolutePath: draggedItem.path,
    };

    // TreeView内での並び替え用（既存のデータ形式）
    dataTransfer.set(
      'application/vnd.code.tree.dialogoi-explorer',
      new vscode.DataTransferItem(JSON.stringify(dropData)),
    );
  }

  async handleDrop(
    target: DialogoiTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const transferItem = dataTransfer.get('application/vnd.code.tree.dialogoi-explorer');
    if (!transferItem) {
      return;
    }

    // 新しいドロップデータ形式の場合
    let draggedItem: DialogoiTreeItem;
    try {
      const dropData: unknown = JSON.parse(transferItem.value as string);
      if (
        typeof dropData === 'object' &&
        dropData !== null &&
        'type' in dropData &&
        (dropData as { type: unknown }).type === 'dialogoi-file'
      ) {
        // 新しい形式をDialogoiTreeItemに変換
        const typedDropData = dropData as unknown as {
          path: string;
          name: string;
          fileType: string;
          absolutePath: string;
        };
        // fileTypeに基づいて適切な型のオブジェクトを作成
        if (typedDropData.fileType === 'subdirectory') {
          draggedItem = {
            path: typedDropData.path,
            name: typedDropData.name,
            type: 'subdirectory',
            isUntracked: false,
            isMissing: false,
          };
        } else if (typedDropData.fileType === 'content') {
          draggedItem = {
            path: typedDropData.path,
            name: typedDropData.name,
            type: 'content',
            hash: '',
            tags: [],
            references: [],
            comments: '',
            isUntracked: false,
            isMissing: false,
          };
        } else {
          draggedItem = {
            path: typedDropData.path,
            name: typedDropData.name,
            type: 'setting',
            hash: '',
            tags: [],
            comments: '',
            isUntracked: false,
            isMissing: false,
          };
        }
      } else {
        // 古い形式（直接DialogoiTreeItem配列）
        const draggedItems = transferItem.value as DialogoiTreeItem[];
        if (draggedItems.length === 0) {
          return;
        }
        const firstItem = draggedItems[0];
        if (!firstItem) {
          return;
        }
        draggedItem = firstItem;
      }
    } catch {
      // パースに失敗した場合は古い形式として扱う
      const draggedItems = transferItem.value as DialogoiTreeItem[];
      if (draggedItems.length === 0) {
        return;
      }
      const firstItem = draggedItems[0];
      if (!firstItem) {
        return;
      }
      draggedItem = firstItem;
    }

    // ターゲットディレクトリを特定
    let targetDir: string;
    if (!target) {
      // ルートにドロップ
      if (this.novelRoot === null || this.novelRoot === undefined) {
        return;
      }
      targetDir = this.novelRoot;
    } else if (target.type === 'subdirectory') {
      // ディレクトリにドロップ - 操作種別を確認
      const operation = await this.confirmDropOperation(draggedItem, target);
      if (!operation) {
        return; // ユーザーがキャンセル
      }

      if (operation === 'reorder') {
        // 並び替え: ターゲットの親ディレクトリ
        targetDir = path.dirname(target.path);
      } else {
        // 移動: ターゲットディレクトリ内
        targetDir = target.path;
      }
    } else {
      // ファイルにドロップ（同じディレクトリ内での並び替え）
      targetDir = path.dirname(target.path);
    }

    // ドラッグ元のディレクトリ
    const sourceDir =
      draggedItem.type === 'subdirectory'
        ? path.dirname(draggedItem.path) // ディレクトリの場合は親ディレクトリ
        : path.dirname(draggedItem.path); // ファイルの場合は所属ディレクトリ

    // 異なるディレクトリ間でのファイル移動をサポート（Phase 3）
    if (sourceDir !== targetDir) {
      // ファイルの移動処理
      if (draggedItem.type !== 'subdirectory') {
        // 移動先のインデックスを計算
        let newIndex: number | undefined;
        if (target && target.type !== 'subdirectory') {
          // 特定のファイルにドロップした場合、そのファイルの位置に挿入
          const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
          const targetMeta = await metaYamlService.loadMetaYamlAsync(targetDir);
          if (targetMeta) {
            newIndex = targetMeta.files.findIndex(
              (item: DialogoiTreeItem) => item.name === target.name,
            );
            if (newIndex === -1) {
              newIndex = undefined; // 見つからない場合は末尾に追加
            }
          }
        }
        // target が subdirectory または undefined の場合は newIndex は undefined のまま（末尾に追加）

        const coreFileService = ServiceContainer.getInstance().getCoreFileService(
          this.novelRoot ?? undefined,
        );
        const result = await coreFileService.moveFile(
          sourceDir,
          draggedItem.name,
          targetDir,
          newIndex,
        );

        if (result.success) {
          this.refresh();
          // ファイル移動イベントを通知
          this.fileChangeNotificationService.notifyFileMoved(
            path.join(sourceDir, draggedItem.name),
            path.join(targetDir, draggedItem.name),
            { operation: 'move', fromIndex: undefined, toIndex: newIndex },
          );
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
        return;
      } else {
        // ディレクトリの移動処理（Phase 4）
        let newIndex: number | undefined;
        if (target && target.type !== 'subdirectory') {
          // 特定のファイルまたはディレクトリにドロップした場合、その位置に挿入
          const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
          const targetMeta = await metaYamlService.loadMetaYamlAsync(targetDir);
          if (targetMeta) {
            newIndex = targetMeta.files.findIndex(
              (item: DialogoiTreeItem) => item.name === target.name,
            );
            if (newIndex === -1) {
              newIndex = undefined; // 見つからない場合は末尾に追加
            }
          }
        }
        // target が subdirectory または undefined の場合は newIndex は undefined のまま（末尾に追加）

        const coreFileService = ServiceContainer.getInstance().getCoreFileService(
          this.novelRoot ?? undefined,
        );
        const result = await coreFileService.moveDirectory(
          sourceDir,
          draggedItem.name,
          targetDir,
          newIndex,
        );

        if (result.success) {
          this.refresh();
          vscode.window.showInformationMessage(result.message);
        } else {
          vscode.window.showErrorMessage(result.message);
        }
        return;
      }
    }

    // 並び替え処理
    try {
      const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
      const metaData = await metaYamlService.loadMetaYamlAsync(targetDir);
      if (!metaData) {
        vscode.window.showErrorMessage('メタデータの読み込みに失敗しました。');
        return;
      }

      // 現在のインデックスを取得
      const fromIndex = metaData.files.findIndex(
        (item: DialogoiTreeItem) => item.name === draggedItem.name,
      );
      if (fromIndex === -1) {
        vscode.window.showErrorMessage('ドラッグ元のアイテムが見つかりません。');
        return;
      }

      // ドロップ先のインデックスを計算
      let toIndex: number;
      if (!target) {
        // ルートにドロップした場合は最後に移動
        toIndex = metaData.files.length - 1;
      } else {
        // ファイルまたはディレクトリにドロップした場合はそのアイテムの位置を取得
        toIndex = metaData.files.findIndex((item: DialogoiTreeItem) => item.name === target.name);
        if (toIndex === -1) {
          vscode.window.showErrorMessage('ドロップ先のアイテムが見つかりません。');
          return;
        }

        // ドロップ位置はそのまま使用（調整不要）
        // VSCodeのTreeViewでは、ターゲットの位置に直接挿入される動作が
        // ユーザーの期待と一致している
      }

      // 同じ位置の場合は何もしない
      if (fromIndex === toIndex) {
        return;
      }

      // 並び替え実行
      void this.reorderFiles(targetDir, fromIndex, toIndex);

      // ファイル並び替えイベントを通知
      this.fileChangeNotificationService.notifyFileReordered(targetDir, {
        operation: 'reorder',
        fromIndex,
        toIndex,
        draggedItem: draggedItem.name,
      });
    } catch (error) {
      this.logger.error('ドラッグ&ドロップエラー', error instanceof Error ? error : String(error));
      vscode.window.showErrorMessage('ファイルの並び替えに失敗しました。');
    }
  }

  /**
   * 選択変更を通知
   * extension.tsからTreeViewの選択変更時に呼び出される
   */
  public notifySelectionChanged(selectedItems: DialogoiTreeItem[]): void {
    this.currentSelection = selectedItems;
    this.logger.debug(`選択変更通知: ${selectedItems.length}個のアイテム`);
    this._onDidChangeSelection.fire(selectedItems);
  }

  /**
   * 現在の選択状態を取得
   */
  public getSelection(): DialogoiTreeItem[] {
    return [...this.currentSelection];
  }
}
