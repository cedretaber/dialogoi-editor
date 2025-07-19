import * as vscode from 'vscode';
import * as path from 'path';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { TreeViewFilterService, FilterState } from '../services/TreeViewFilterService.js';
import { Logger } from '../utils/Logger.js';

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
export class DialogoiTreeDataProvider implements vscode.TreeDataProvider<DialogoiTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DialogoiTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DialogoiTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DialogoiTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private workspaceRoot: string;
  private novelRoot: string | null = null;
  private filterService: TreeViewFilterService = new TreeViewFilterService();
  private logger = Logger.getInstance();

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    this.findNovelRoot();
  }

  private findNovelRoot(): void {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    this.novelRoot = metaYamlService.findNovelRoot(this.workspaceRoot);
    if (this.novelRoot !== null) {
      // コンテキストにノベルプロジェクトが存在することを設定
      vscode.commands.executeCommand('setContext', 'dialogoi:hasNovelProject', true);

      // 参照関係を初期化
      const referenceManager = ReferenceManager.getInstance();
      const fileRepository = ServiceContainer.getInstance().getFileRepository();
      referenceManager.initialize(this.novelRoot, fileRepository);
    }
  }

  refresh(): void {
    this.findNovelRoot();
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
   * フィルターが適用されているかチェック
   */
  isFilterActive(): boolean {
    return this.filterService.isFilterActive();
  }

  /**
   * 特定のファイルアイテムを再読み込みして返す
   */
  refreshFileItem(originalItem: DialogoiTreeItem): DialogoiTreeItem | null {
    if (!originalItem.path) {
      return null;
    }

    const dirPath = path.dirname(originalItem.path);
    const fileName = originalItem.name;

    const items = this.loadMetaYaml(dirPath);
    const updatedItem = items.find((item) => item.name === fileName);

    return updatedItem || null;
  }

  getTreeItem(element: DialogoiTreeItem): vscode.TreeItem {
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
      displayName = characterService.extractDisplayName(element.path);
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
      const readmeFilePath = this.getReadmeFilePath(element.path);
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
    this.setTooltip(item, element);

    // コンテキストメニュー用のcontextValue（ファイル種類とメタデータに基づく）
    item.contextValue = this.getContextValue(element);

    return item;
  }

  getChildren(element?: DialogoiTreeItem): Promise<DialogoiTreeItem[]> {
    if (this.novelRoot === null) {
      return Promise.resolve([]);
    }

    let result: DialogoiTreeItem[];
    if (element) {
      // サブディレクトリの場合、その中の.dialogoi-meta.yamlを読み込む
      result = this.loadMetaYaml(element.path);

      // サブディレクトリが展開された時も再帰的フィルタリングを適用
      if (this.filterService.isFilterActive()) {
        this.logger.info(
          `サブディレクトリ ${element.name} 内で再帰的フィルタリング適用: ${result.length}個のアイテム`,
        );
        result = this.applyRecursiveFilter(result);
        this.logger.debug(`サブディレクトリ再帰的フィルタリング後: ${result.length}個のアイテム`);
      }
    } else {
      // ルートの場合、ノベルルートの.dialogoi-meta.yamlを読み込む
      result = this.loadMetaYaml(this.novelRoot);

      // ルートレベルで再帰的フィルタリングを適用
      if (this.filterService.isFilterActive()) {
        const filterState = this.filterService.getFilterState();
        this.logger.debug(
          `フィルタリング適用前: ${result.length}個のアイテム, フィルター: ${filterState.filterType}="${filterState.filterValue}"`,
        );

        result = this.applyRecursiveFilter(result);

        this.logger.debug(`フィルタリング適用後: ${result.length}個のアイテム`);

        // デバッグ用：各アイテムのタグを出力
        result.forEach((item, index) => {
          this.logger.debug(`  [${index}] ${item.name}: tags=${JSON.stringify(item.tags || [])}`);
        });
      }
    }

    return Promise.resolve(result);
  }

  /**
   * 再帰的フィルタリングを適用
   * サブディレクトリ内のファイルも含めてフィルタリングし、
   * マッチするファイルを含むディレクトリは表示、含まないディレクトリは除外
   */
  private applyRecursiveFilter(items: DialogoiTreeItem[]): DialogoiTreeItem[] {
    const result: DialogoiTreeItem[] = [];

    for (const item of items) {
      if (item.type === 'subdirectory') {
        // サブディレクトリの場合、再帰的にチェック
        const hasMatchingContent = this.hasMatchingContentInDirectory(item.path);

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
  private hasMatchingContentInDirectory(dirPath: string): boolean {
    const subItems = this.loadMetaYaml(dirPath);

    for (const subItem of subItems) {
      if (subItem.type === 'subdirectory') {
        // サブディレクトリの場合、さらに再帰的にチェック
        if (this.hasMatchingContentInDirectory(subItem.path)) {
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

  private loadMetaYaml(dirPath: string): DialogoiTreeItem[] {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    const meta = metaYamlService.loadMetaYaml(dirPath);

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

  private getReadmeFilePath(dirPath: string): string | null {
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    return metaYamlService.getReadmeFilePath(dirPath);
  }

  // ファイル操作メソッド
  createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
  ): void {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.createFile(
      dirPath,
      fileName,
      fileType,
      initialContent,
      tags,
    );

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  deleteFile(dirPath: string, fileName: string): void {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.deleteFile(dirPath, fileName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  reorderFiles(dirPath: string, fromIndex: number, toIndex: number): void {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.reorderFiles(dirPath, fromIndex, toIndex);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  renameFile(dirPath: string, oldName: string, newName: string): void {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.renameFile(dirPath, oldName, newName);

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

  getNovelRoot(): string | null {
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
  private setTooltip(item: vscode.TreeItem, element: DialogoiTreeItem): void {
    const tooltipParts: string[] = [];

    // キャラクター情報
    if (element.character !== undefined) {
      let displayName = element.character.display_name;
      if (displayName === undefined && element.type !== 'subdirectory') {
        const characterService = ServiceContainer.getInstance().getCharacterService();
        displayName = characterService.extractDisplayName(element.path);
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
      references.references.forEach((ref) => allAppearances.add(ref));
      references.referencedBy.forEach((ref) => allAppearances.add(ref));

      if (allAppearances.size > 0) {
        const validAppearances: string[] = [];
        const invalidAppearances: string[] = [];

        allAppearances.forEach((ref) => {
          if (referenceManager.checkFileExists(ref)) {
            validAppearances.push(ref);
          } else {
            invalidAppearances.push(ref);
          }
        });

        if (element.character && validAppearances.length > 0) {
          tooltipParts.push('');
          tooltipParts.push(`登場話: ${validAppearances.length}話`);
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

    // 伏線情報
    if (element.foreshadowing !== undefined) {
      tooltipParts.push('');
      tooltipParts.push('伏線:');
      tooltipParts.push(`• 埋蔵位置: ${element.foreshadowing.start}`);
      tooltipParts.push(`• 回収位置: ${element.foreshadowing.goal}`);

      // 伏線の状態を表示
      if (this.novelRoot !== null && this.novelRoot !== undefined) {
        const status = this.getForeshadowingStatus(element.foreshadowing);
        const statusText = {
          planted: '埋蔵済み',
          resolved: '回収済み',
          planned: '計画中',
          error: 'エラー',
        }[status];
        tooltipParts.push(`• 状態: ${statusText}`);
      }
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
  addTag(dirPath: string, fileName: string, tag: string): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.addTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  removeTag(dirPath: string, fileName: string, tag: string): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.removeTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  setTags(
    dirPath: string,
    fileName: string,
    tags: string[],
  ): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.setTags(dirPath, fileName, tags);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  // 参照関係操作メソッド
  addReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.addReference(dirPath, fileName, referencePath);

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

  removeReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.removeReference(dirPath, fileName, referencePath);

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

  setReferences(
    dirPath: string,
    fileName: string,
    references: string[],
  ): { success: boolean; message: string } {
    const fileOperationService = ServiceContainer.getInstance().getFileOperationService();
    const result = fileOperationService.setReferences(dirPath, fileName, references);

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

  private getForeshadowingStatus(foreshadowing: {
    start: string;
    goal: string;
  }): 'planted' | 'resolved' | 'planned' | 'error' {
    if (this.novelRoot === null || this.novelRoot === undefined) {
      return 'error';
    }
    const foreshadowingService = ServiceContainer.getInstance().getForeshadowingService();
    return foreshadowingService.getForeshadowingStatus(this.novelRoot, foreshadowing);
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
}
