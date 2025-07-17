import * as vscode from 'vscode';
import * as path from 'path';
import { MetaYamlUtils, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { FileOperationService } from '../services/FileOperationService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';

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

    const item = new vscode.TreeItem(element.name, collapsibleState);

    // アイコンの設定（ディレクトリはアイコンなし）
    if (element.type === 'content') {
      item.iconPath = new vscode.ThemeIcon('file-text');
    } else if (element.type === 'setting') {
      if (element.glossary === true) {
        item.iconPath = new vscode.ThemeIcon('book');
      } else if (element.character !== undefined) {
        item.iconPath = new vscode.ThemeIcon('person');
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

    // コンテキストメニュー用のcontextValue
    item.contextValue = 'dialogoi-file';

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

    // タグ情報
    if (element.tags !== undefined && element.tags.length > 0) {
      const tagString = element.tags.map((tag) => `#${tag}`).join(' ');
      tooltipParts.push(`タグ: ${tagString}`);
    }

    // 参照関係情報
    if (element.type !== 'subdirectory') {
      const referenceManager = ReferenceManager.getInstance();
      const references = referenceManager.getReferences(element.path);

      if (references.references.length > 0) {
        const validReferences: string[] = [];
        const invalidReferences: string[] = [];

        references.references.forEach((ref) => {
          if (referenceManager.checkFileExists(ref)) {
            validReferences.push(ref);
          } else {
            invalidReferences.push(ref);
          }
        });

        if (validReferences.length > 0 || invalidReferences.length > 0) {
          tooltipParts.push('');
          tooltipParts.push('参照している:');
          validReferences.forEach((ref) => {
            tooltipParts.push(`• ${ref}`);
          });
          invalidReferences.forEach((ref) => {
            tooltipParts.push(`• ~~${ref}~~ (存在しません)`);
          });
        }
      }

      if (references.referencedBy.length > 0) {
        tooltipParts.push('');
        tooltipParts.push('参照されている:');
        references.referencedBy.forEach((ref) => {
          tooltipParts.push(`• ${ref}`);
        });
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
}
