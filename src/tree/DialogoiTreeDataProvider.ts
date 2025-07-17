import * as vscode from 'vscode';
import * as path from 'path';
import { MetaYamlUtils, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { FileOperationService } from '../services/FileOperationService.js';

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
      item.tooltip = `タグ: ${tagString}`;
    }
    
    // レビュー数の表示
    if (element.review_count?.open !== undefined && element.review_count.open > 0) {
      descriptionParts.push(`(${element.review_count.open} レビュー)`);
    }

    // descriptionを設定
    if (descriptionParts.length > 0) {
      item.description = descriptionParts.join(' ');
    }

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

  setTags(dirPath: string, fileName: string, tags: string[]): { success: boolean; message: string } {
    const result = FileOperationService.setTags(dirPath, fileName, tags);

    if (result.success) {
      this.refresh();
    }

    return result;
  }
}
