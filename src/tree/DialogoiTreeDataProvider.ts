import * as vscode from 'vscode';
import * as path from 'path';
import { MetaYamlUtils, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { FileOperationService } from '../services/FileOperationService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';

export class DialogoiTreeDataProvider implements vscode.TreeDataProvider<DialogoiTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DialogoiTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DialogoiTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DialogoiTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private workspaceRoot: string;
  private novelRoot: string | null = null;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    this.findNovelRoot();
  }

  private findNovelRoot(): void {
    this.novelRoot = MetaYamlUtils.findNovelRoot(this.workspaceRoot);
    if (this.novelRoot !== null) {
      // コンテキストにノベルプロジェクトが存在することを設定
      vscode.commands.executeCommand('setContext', 'dialogoi:hasNovelProject', true);

      // 参照関係を初期化
      const referenceManager = ReferenceManager.getInstance();
      referenceManager.initialize(this.novelRoot);
    }
  }

  refresh(): void {
    this.findNovelRoot();
    this._onDidChangeTreeData.fire();
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
      displayName = CharacterService.extractDisplayName(element.path);
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
      // ディレクトリの場合はmeta.yamlで指定されたreadmeファイルを開く
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

    if (element) {
      // サブディレクトリの場合、その中のmeta.yamlを読み込む
      return Promise.resolve(this.loadMetaYaml(element.path));
    } else {
      // ルートの場合、ノベルルートのmeta.yamlを読み込む
      return Promise.resolve(this.loadMetaYaml(this.novelRoot));
    }
  }

  private loadMetaYaml(dirPath: string): DialogoiTreeItem[] {
    const meta = MetaYamlUtils.loadMetaYaml(dirPath);

    if (meta === null) {
      return [];
    }

    // ファイルの絶対パスを設定
    return meta.files.map((file) => ({
      ...file,
      path: path.join(dirPath, file.name),
    }));
  }

  private getReadmeFilePath(dirPath: string): string | null {
    return MetaYamlUtils.getReadmeFilePath(dirPath);
  }

  // ファイル操作メソッド
  createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
  ): void {
    const result = FileOperationService.createFile(
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
    const result = FileOperationService.deleteFile(dirPath, fileName);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  reorderFiles(dirPath: string, fromIndex: number, toIndex: number): void {
    const result = FileOperationService.reorderFiles(dirPath, fromIndex, toIndex);

    if (result.success) {
      this.refresh();
      vscode.window.showInformationMessage(result.message);
    } else {
      vscode.window.showErrorMessage(result.message);
    }
  }

  renameFile(dirPath: string, oldName: string, newName: string): void {
    const result = FileOperationService.renameFile(dirPath, oldName, newName);

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
        displayName = CharacterService.extractDisplayName(element.path);
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
    const result = FileOperationService.addTag(dirPath, fileName, tag);

    if (result.success) {
      this.refresh();
    }

    return result;
  }

  removeTag(dirPath: string, fileName: string, tag: string): { success: boolean; message: string } {
    const result = FileOperationService.removeTag(dirPath, fileName, tag);

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
    const result = FileOperationService.setTags(dirPath, fileName, tags);

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
    const result = FileOperationService.addReference(dirPath, fileName, referencePath);

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
    const result = FileOperationService.removeReference(dirPath, fileName, referencePath);

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
    const result = FileOperationService.setReferences(dirPath, fileName, references);

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
    return ForeshadowingService.getForeshadowingStatus(this.novelRoot, foreshadowing);
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
