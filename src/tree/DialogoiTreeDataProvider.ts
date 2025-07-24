import * as vscode from 'vscode';
import * as path from 'path';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { TreeViewFilterService, FilterState } from '../services/TreeViewFilterService.js';
import { Logger } from '../utils/Logger.js';
import { FileOperationResult } from '../services/FileOperationService.js';
import { FileChangeNotificationService } from '../services/FileChangeNotificationService.js';

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

  private workspaceRoot: string;
  private novelRoot: string | null = null;
  private filterService: TreeViewFilterService = new TreeViewFilterService();
  private logger = Logger.getInstance();
  private fileChangeNotificationService: FileChangeNotificationService;

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
    } else {
      // プロジェクトが見つからない場合は明示的にfalseに設定
      vscode.commands.executeCommand('setContext', 'dialogoi:hasNovelProject', false);
    }
  }

  refresh(): void {
    void this.findNovelRoot();
    this._onDidChangeTreeData.fire();
  }

  /**
   * タグでフィルタリングを設定
   */
  setTagFilter(tagValue: string): void {
    this.filterService.setTagFilter(tagValue);
    this._onDidChangeTreeData.fire();
  }

  /**
   * フィルターを解除
   */
  clearFilter(): void {
    this.filterService.clearFilter();
    this._onDidChangeTreeData.fire();
  }

  /**
   * 現在のフィルター状態を取得
   */
  getFilterState(): FilterState {
    return this.filterService.getFilterState();
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
  }

  /**
   * フィルターが適用されているかチェック
   */
  isFilterActive(): boolean {
    return this.filterService.isFilterActive();
  }

  async getTreeItem(element: DialogoiTreeItem): Promise<vscode.TreeItem> {
    const isDirectory = element.type === 'subdirectory';
    const collapsibleState = isDirectory
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    // 表示名を決定（キャラクターファイルの場合はマークダウンから取得）
    let displayName = element.name;
    if (element.character !== undefined && element.character.display_name !== undefined) {
      displayName = element.character.display_name;
    } else if (element.character !== undefined && !isDirectory) {
      // display_nameが設定されていない場合は自動取得
      const characterService = ServiceContainer.getInstance().getCharacterService();
      displayName = await characterService.extractDisplayName(element.path);
    }

    const item = new vscode.TreeItem(displayName, collapsibleState);

    // アイコンの設定（ディレクトリはアイコンなし）
    if (element.type === 'content') {
      item.iconPath = new vscode.ThemeIcon('file-text');
    } else if (element.type === 'setting') {
      if (element.glossary === true) {
        item.iconPath = new vscode.ThemeIcon('book');
      } else if (element.character !== undefined) {
        // 重要度に応じたアイコン
        if (element.character.importance === 'main') {
          item.iconPath = new vscode.ThemeIcon('star');
        } else {
          item.iconPath = new vscode.ThemeIcon('person');
        }
      } else if (element.foreshadowing !== undefined) {
        item.iconPath = new vscode.ThemeIcon('eye');
      } else {
        item.iconPath = new vscode.ThemeIcon('gear');
      }
    }
    // subdirectory の場合はアイコンを設定しない（VSCodeのデフォルト展開アイコンを使用）

    // ファイルの場合はクリックで開く、ディレクトリの場合はREADME.mdを開く
    if (!isDirectory) {
      item.command = {
        command: 'vscode.open',
        title: 'Open',
        arguments: [vscode.Uri.file(element.path)],
      };
    } else {
      // ディレクトリの場合は.dialogoi-meta.yamlで指定されたreadmeファイルを開く
      const readmeFilePath = await this.getReadmeFilePath(element.path);
      if (readmeFilePath !== null) {
        item.command = {
          command: 'vscode.open',
          title: 'Open README',
          arguments: [vscode.Uri.file(readmeFilePath)],
        };
      }
    }

    // タグとレビュー数の表示
    const descriptionParts: string[] = [];

    // タグの表示
    if (element.tags !== undefined && element.tags.length > 0) {
      const tagString = element.tags.map((tag) => `#${tag}`).join(' ');
      descriptionParts.push(tagString);
    }

    // レビュー数の表示
    if (element.review_count?.open !== undefined && element.review_count.open > 0) {
      descriptionParts.push(`(${element.review_count.open} レビュー)`);
    }

    // descriptionを設定
    if (descriptionParts.length > 0) {
      item.description = descriptionParts.join(' ');
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

      // サブディレクトリが展開された時も再帰的フィルタリングを適用
      if (this.filterService.isFilterActive()) {
        this.logger.info(
          `サブディレクトリ ${element.name} 内で再帰的フィルタリング適用: ${result.length}個のアイテム`,
        );
        result = await this.applyRecursiveFilter(result);
        this.logger.debug(`サブディレクトリ再帰的フィルタリング後: ${result.length}個のアイテム`);
      }
    } else {
      // ルートの場合、ノベルルートの.dialogoi-meta.yamlを読み込む
      result = await this.loadMetaYaml(this.novelRoot);

      // ルートレベルで再帰的フィルタリングを適用
      if (this.filterService.isFilterActive()) {
        const filterState = this.filterService.getFilterState();
        this.logger.debug(
          `フィルタリング適用前: ${result.length}個のアイテム, フィルター: ${filterState.filterType}="${filterState.filterValue}"`,
        );

        result = await this.applyRecursiveFilter(result);

        this.logger.debug(`フィルタリング適用後: ${result.length}個のアイテム`);

        // デバッグ用：各アイテムのタグを出力
        result.forEach((item, index) => {
          this.logger.debug(`  [${index}] ${item.name}: tags=${JSON.stringify(item.tags || [])}`);
        });
      }
    }

    return result;
  }

  /**
   * 再帰的フィルタリングを適用
   * サブディレクトリ内のファイルも含めてフィルタリングし、
   * マッチするファイルを含むディレクトリは表示、含まないディレクトリは除外
   */
  private async applyRecursiveFilter(items: DialogoiTreeItem[]): Promise<DialogoiTreeItem[]> {
    const result: DialogoiTreeItem[] = [];

    for (const item of items) {
      if (item.type === 'subdirectory') {
        // サブディレクトリの場合、再帰的にチェック
        const hasMatchingContent = await this.hasMatchingContentInDirectory(item.path);

        this.logger.debug(
          `ディレクトリ ${item.name}: ${hasMatchingContent ? 'マッチする内容あり' : 'マッチする内容なし'}`,
        );

        // マッチするファイルがある場合、ディレクトリを含める
        if (hasMatchingContent) {
          result.push(item);
        }
      } else {
        // ファイルの場合、直接フィルタリングを適用
        const matchedItems = this.filterService.applyFilter([item]);
        if (matchedItems.length > 0) {
          result.push(item);
        }
      }
    }

    return result;
  }

  /**
   * ディレクトリ内に（再帰的に）マッチするコンテンツがあるかチェック
   */
  private async hasMatchingContentInDirectory(dirPath: string): Promise<boolean> {
    const subItems = await this.loadMetaYaml(dirPath);

    for (const subItem of subItems) {
      if (subItem.type === 'subdirectory') {
        // サブディレクトリの場合、さらに再帰的にチェック
        if (await this.hasMatchingContentInDirectory(subItem.path)) {
          return true;
        }
      } else {
        // ファイルの場合、フィルター条件に一致するかチェック
        const matchedItems = this.filterService.applyFilter([subItem]);
        if (matchedItems.length > 0) {
          this.logger.info(`  → ${subItem.name} がマッチ`);
          return true;
        }
      }
    }

    return false;
  }

  private async loadMetaYaml(dirPath: string): Promise<DialogoiTreeItem[]> {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    const meta = await metaYamlService.loadMetaYamlAsync(dirPath);

    if (meta === null) {
      return [];
    }

    // ファイルの絶対パスを設定
    const result = meta.files.map((file) => ({
      ...file,
      path: path.join(dirPath, file.name),
    }));
    return result;
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
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.createFileAsync(
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
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.deleteFileAsync(dirPath, fileName);

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

    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.deleteDirectoryAsync(parentDir, dirName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async reorderFiles(dirPath: string, fromIndex: number, toIndex: number): Promise<void> {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.reorderFiles(dirPath, fromIndex, toIndex);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  async renameFile(dirPath: string, oldName: string, newName: string): Promise<void> {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.renameFileAsync(dirPath, oldName, newName);

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
    if (element.character !== undefined) {
      let displayName = element.character.display_name;
      if (displayName === undefined && element.type !== 'subdirectory') {
        const characterService = ServiceContainer.getInstance().getCharacterService();
        displayName = await characterService.extractDisplayName(element.path);
      }
      if (displayName !== undefined) {
        tooltipParts.push(`${displayName} (${element.character.importance})`);
      }
    }

    // タグ情報
    if (element.tags !== undefined && element.tags.length > 0) {
      const tagString = element.tags.map((tag) => `#${tag}`).join(' ');
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

        if (element.character && validAppearances.length > 0) {
          tooltipParts.push('');
          tooltipParts.push(`登場話: ${validAppearances.length}話`);
          validAppearances.forEach((ref) => {
            tooltipParts.push(`• ${ref}`);
          });
        } else if (
          element.type === 'setting' &&
          !element.character &&
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
    if (element.foreshadowing !== undefined) {
      tooltipParts.push('');
      tooltipParts.push('伏線:');
      const plantsCount = element.foreshadowing.plants?.length || 0;
      tooltipParts.push(`• 埋蔵位置: ${plantsCount}箇所`);
      tooltipParts.push(`• 回収位置: ${element.foreshadowing.payoff?.location || '未設定'}`);
      tooltipParts.push('• 詳細はPhase 3で実装予定');
    }

    // レビュー情報
    if (element.review_count) {
      const reviewSummary: string[] = [];
      if (element.review_count.open > 0) {
        reviewSummary.push(`未対応: ${element.review_count.open}`);
      }
      if (element.review_count.in_progress !== undefined && element.review_count.in_progress > 0) {
        reviewSummary.push(`対応中: ${element.review_count.in_progress}`);
      }
      if (element.review_count.resolved !== undefined && element.review_count.resolved > 0) {
        reviewSummary.push(`解決済み: ${element.review_count.resolved}`);
      }
      if (element.review_count.dismissed !== undefined && element.review_count.dismissed > 0) {
        reviewSummary.push(`却下: ${element.review_count.dismissed}`);
      }

      if (reviewSummary.length > 0) {
        tooltipParts.push('');
        tooltipParts.push('レビュー:');
        reviewSummary.forEach((summary) => {
          tooltipParts.push(`• ${summary}`);
        });
      }
    }

    // tooltipを設定
    if (tooltipParts.length > 0) {
      item.tooltip = tooltipParts.join('\n');
    }
  }

  // タグ操作メソッド
  async addTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.addTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  async removeTag(dirPath: string, fileName: string, tag: string): Promise<FileOperationResult> {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.removeTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  async setTags(dirPath: string, fileName: string, tags: string[]): Promise<FileOperationResult> {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.setTags(dirPath, fileName, tags);

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
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.addReference(dirPath, fileName, referencePath);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const currentReferences =
        result.updatedItems?.find((item) => item.name === fileName)?.references || [];
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
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.removeReference(dirPath, fileName, referencePath);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const currentReferences =
        result.updatedItems?.find((item) => item.name === fileName)?.references || [];
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
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
      this.novelRoot ?? undefined,
    );
    const result = await fileOperationService.setReferences(dirPath, fileName, references);

    if (result.success) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const filePath = path.join(dirPath, fileName);
      const currentReferences =
        result.updatedItems?.find((item) => item.name === fileName)?.references || [];
      referenceManager.updateFileReferences(filePath, currentReferences);

      this.refresh();
    }

    return result;
  }

  private getContextValue(element: DialogoiTreeItem): string {
    const baseValue = element.type === 'subdirectory' ? 'dialogoi-directory' : 'dialogoi-file';

    if (element.type === 'subdirectory') {
      return baseValue;
    }

    // ファイル種別とメタデータに基づく詳細な分類
    const contextParts: string[] = [baseValue];

    // ファイル種別
    contextParts.push(element.type); // content または setting

    // 特殊なファイル種別
    if (element.type === 'setting') {
      if (element.glossary === true) {
        contextParts.push('glossary');
      } else if (element.character !== undefined) {
        contextParts.push('character');
      } else if (element.foreshadowing !== undefined) {
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
        draggedItem = {
          path: typedDropData.path,
          name: typedDropData.name,
          type: typedDropData.fileType,
          absolutePath: typedDropData.absolutePath,
        } as DialogoiTreeItem;
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

        const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
          this.novelRoot ?? undefined,
        );
        const result = await fileOperationService.moveFileAsync(
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

        const fileOperationService = ServiceContainer.getInstance().getFileOperationService(
          this.novelRoot ?? undefined,
        );
        const result = await fileOperationService.moveDirectoryAsync(
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
}
