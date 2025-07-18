import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import {
  FileRepository,
  FileOperationResult,
  FileStats,
  DirectoryEntry,
} from './FileRepository.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYamlUtils, DialogoiTreeItem, MetaYaml } from '../utils/MetaYamlUtils.js';
import { ForeshadowingData } from '../services/ForeshadowingService.js';

/**
 * VSCodeのUri型を抽象化したUri実装
 */
class VSCodeUri implements Uri {
  private _uri: vscode.Uri;

  constructor(uri: vscode.Uri) {
    this._uri = uri;
  }

  get scheme(): string {
    return this._uri.scheme;
  }
  get authority(): string {
    return this._uri.authority;
  }
  get path(): string {
    return this._uri.path;
  }
  get query(): string {
    return this._uri.query;
  }
  get fragment(): string {
    return this._uri.fragment;
  }
  get fsPath(): string {
    return this._uri.fsPath;
  }

  toString(): string {
    return this._uri.toString();
  }
  toJSON(): object {
    return this._uri.toJSON() as object;
  }

  get vsCodeUri(): vscode.Uri {
    return this._uri;
  }
}

/**
 * VSCodeファイル統計情報の実装
 */
class VSCodeFileStats implements FileStats {
  private _stat: vscode.FileStat;

  constructor(stat: vscode.FileStat) {
    this._stat = stat;
  }

  isFile(): boolean {
    return this._stat.type === vscode.FileType.File;
  }
  isDirectory(): boolean {
    return this._stat.type === vscode.FileType.Directory;
  }
  get size(): number {
    return this._stat.size;
  }
  get mtime(): Date {
    return new Date(this._stat.mtime);
  }
  get birthtime(): Date {
    return new Date(this._stat.ctime);
  }
}

/**
 * VSCodeディレクトリエントリの実装
 */
class VSCodeDirectoryEntry implements DirectoryEntry {
  private _name: string;
  private _type: vscode.FileType;

  constructor(name: string, type: vscode.FileType) {
    this._name = name;
    this._type = type;
  }

  get name(): string {
    return this._name;
  }
  isFile(): boolean {
    return this._type === vscode.FileType.File;
  }
  isDirectory(): boolean {
    return this._type === vscode.FileType.Directory;
  }
}

/**
 * VSCodeのファイル操作APIを使用した具象実装
 */
export class VSCodeFileRepository extends FileRepository {
  constructor(private extensionContext: vscode.ExtensionContext) {
    super();
  }
  // === 基本的なファイル操作メソッド ===

  existsSync(uri: Uri): boolean {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // VSCodeのファイル操作は非同期だが、同期的に実行するためにPromiseを同期的に待つ
      // 実際の実装では、VSCodeの同期的なファイル操作がない場合があるため、
      // 一時的にfs.existsSyncを使用する
      return fs.existsSync(vsCodeUri.fsPath);
    } catch {
      return false;
    }
  }

  readFileSync(
    uri: Uri,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'utf-16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'base64url'
      | 'latin1'
      | 'binary'
      | 'hex',
  ): string;
  readFileSync(uri: Uri, encoding?: null): Buffer;
  readFileSync(
    uri: Uri,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'utf-16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'base64url'
      | 'latin1'
      | 'binary'
      | 'hex'
      | null,
  ): string | Buffer;
  readFileSync(
    uri: Uri,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'utf-16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'base64url'
      | 'latin1'
      | 'binary'
      | 'hex'
      | null,
  ): string | Buffer {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // 同様に、一時的にfs.readFileSyncを使用
      return fs.readFileSync(vsCodeUri.fsPath, encoding);
    } catch (error) {
      throw new Error(
        `ファイル読み込みエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  writeFileSync(
    uri: Uri,
    data: string | Buffer,
    encoding?:
      | 'ascii'
      | 'utf8'
      | 'utf-8'
      | 'utf16le'
      | 'utf-16le'
      | 'ucs2'
      | 'ucs-2'
      | 'base64'
      | 'base64url'
      | 'latin1'
      | 'binary'
      | 'hex',
  ): void {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // 同様に、一時的にfs.writeFileSyncを使用
      // fs is imported at the top of the file
      fs.writeFileSync(vsCodeUri.fsPath, data, encoding);
    } catch (error) {
      throw new Error(
        `ファイル書き込みエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  mkdirSync(uri: Uri): void {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      fs.mkdirSync(vsCodeUri.fsPath);
    } catch (error) {
      throw new Error(
        `ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  createDirectorySync(uri: Uri): void {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      fs.mkdirSync(vsCodeUri.fsPath, { recursive: true });
    } catch (error) {
      throw new Error(
        `ディレクトリ作成エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  unlinkSync(uri: Uri): void {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      fs.unlinkSync(vsCodeUri.fsPath);
    } catch (error) {
      throw new Error(
        `ファイル削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  rmSync(uri: Uri, options?: { recursive?: boolean; force?: boolean }): void {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      fs.rmSync(vsCodeUri.fsPath, options);
    } catch (error) {
      throw new Error(
        `ディレクトリ削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  readdirSync(uri: Uri, options?: { withFileTypes?: boolean }): string[] | DirectoryEntry[] {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      if (options?.withFileTypes === true) {
        const results = fs.readdirSync(vsCodeUri.fsPath, { withFileTypes: true });
        return results.map(
          (dirent: fs.Dirent) =>
            new VSCodeDirectoryEntry(
              dirent.name,
              dirent.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
            ),
        );
      } else {
        const results = fs.readdirSync(vsCodeUri.fsPath);
        return results;
      }
    } catch (error) {
      throw new Error(
        `ディレクトリ読み込みエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  statSync(uri: Uri): FileStats {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      const stat = fs.statSync(vsCodeUri.fsPath);
      return new VSCodeFileStats({
        type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
        size: stat.size,
        mtime: stat.mtime.getTime(),
        ctime: stat.birthtime.getTime(),
      });
    } catch (error) {
      throw new Error(
        `ファイル統計情報取得エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  lstatSync(uri: Uri): FileStats {
    const vsCodeUri = (uri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      const stat = fs.lstatSync(vsCodeUri.fsPath);
      return new VSCodeFileStats({
        type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
        size: stat.size,
        mtime: stat.mtime.getTime(),
        ctime: stat.birthtime.getTime(),
      });
    } catch (error) {
      throw new Error(
        `ファイル統計情報取得エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  renameSync(oldUri: Uri, newUri: Uri): void {
    const oldVsCodeUri = (oldUri as VSCodeUri).vsCodeUri;
    const newVsCodeUri = (newUri as VSCodeUri).vsCodeUri;
    try {
      // fs is imported at the top of the file
      fs.renameSync(oldVsCodeUri.fsPath, newVsCodeUri.fsPath);
    } catch (error) {
      throw new Error(
        `ファイル名変更エラー: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // === Uriファクトリーメソッド ===

  createFileUri(path: string): Uri {
    return new VSCodeUri(vscode.Uri.file(path));
  }

  createDirectoryUri(path: string): Uri {
    return new VSCodeUri(vscode.Uri.file(path));
  }

  parseUri(value: string): Uri {
    return new VSCodeUri(vscode.Uri.parse(value));
  }

  joinPath(base: Uri, ...paths: string[]): Uri {
    const vsCodeUri = (base as VSCodeUri).vsCodeUri;
    return new VSCodeUri(vscode.Uri.joinPath(vsCodeUri, ...paths));
  }

  async readExtensionResource(resourcePath: string): Promise<string> {
    const resourceUri = vscode.Uri.joinPath(
      this.extensionContext.extensionUri,
      'resources',
      resourcePath,
    );

    try {
      const content = await vscode.workspace.fs.readFile(resourceUri);
      return Buffer.from(content).toString('utf8');
    } catch (error) {
      throw new Error(
        `リソース読み込みエラー: ${resourcePath} - ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // === 高レベルなメタデータ操作メソッド ===

  createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
  ): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);
      const fileUri = this.createFileUri(filePath);

      // ファイルが既に存在する場合はエラー
      if (this.existsSync(fileUri)) {
        return {
          success: false,
          message: `ファイル ${fileName} は既に存在します。`,
        };
      }

      // ファイルを作成
      if (fileType === 'subdirectory') {
        this.mkdirSync(fileUri);

        // サブディレクトリにはデフォルトのmeta.yamlとREADME.mdを作成
        const defaultMetaYaml = `readme: README.md\nfiles: []\n`;
        const defaultReadme = `# ${fileName}\n\n`;

        this.writeFileSync(this.joinPath(fileUri, 'meta.yaml'), defaultMetaYaml);
        this.writeFileSync(this.joinPath(fileUri, 'README.md'), defaultReadme);
      } else {
        // ファイルタイプに応じて初期コンテンツを設定
        let content = initialContent;
        if (content === '') {
          if (fileType === 'content' && fileName.endsWith('.txt')) {
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `${baseName}\n\n`;
          } else if (fileType === 'setting' && fileName.endsWith('.md')) {
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `# ${baseName}\n\n`;
          }
        }
        this.writeFileSync(fileUri, content);
      }

      // meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const newItem: DialogoiTreeItem = {
          name: fileName,
          type: fileType,
          path: filePath,
          tags: tags.length > 0 ? tags : undefined,
        };

        meta.files.push(newItem);
        return meta;
      });

      if (!result.success) {
        // meta.yaml更新に失敗した場合は作成したファイルを削除
        if (this.existsSync(fileUri)) {
          if (fileType === 'subdirectory') {
            this.rmSync(fileUri, { recursive: true, force: true });
          } else {
            this.unlinkSync(fileUri);
          }
        }
        return result;
      }

      return {
        success: true,
        message: `${fileName} を作成しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル作成エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  deleteFile(dirPath: string, fileName: string): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);
      const fileUri = this.createFileUri(filePath);

      // ファイルが存在しない場合はエラー
      if (!this.existsSync(fileUri)) {
        return {
          success: false,
          message: `ファイル ${fileName} が見つかりません。`,
        };
      }

      // meta.yamlから削除
      const result = this.updateMetaYaml(dirPath, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== fileName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ファイルを削除
      const isDirectory = this.lstatSync(fileUri).isDirectory();
      if (isDirectory) {
        this.rmSync(fileUri, { recursive: true, force: true });
      } else {
        this.unlinkSync(fileUri);
      }

      return {
        success: true,
        message: `${fileName} を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  reorderFiles(dirPath: string, fromIndex: number, toIndex: number): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        if (
          fromIndex < 0 ||
          fromIndex >= meta.files.length ||
          toIndex < 0 ||
          toIndex >= meta.files.length
        ) {
          throw new Error('無効なインデックスです。');
        }

        // 配列要素を移動
        const [movedItem] = meta.files.splice(fromIndex, 1);
        if (movedItem !== undefined) {
          meta.files.splice(toIndex, 0, movedItem);
        }

        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: 'ファイルの順序を変更しました。',
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `並び替えエラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  renameFile(dirPath: string, oldName: string, newName: string): FileOperationResult {
    try {
      const oldPath = path.join(dirPath, oldName);
      const newPath = path.join(dirPath, newName);
      const oldUri = this.createFileUri(oldPath);
      const newUri = this.createFileUri(newPath);

      // 元ファイルが存在しない場合はエラー
      if (!this.existsSync(oldUri)) {
        return {
          success: false,
          message: `ファイル ${oldName} が見つかりません。`,
        };
      }

      // 新しい名前のファイルが既に存在する場合はエラー
      if (this.existsSync(newUri)) {
        return {
          success: false,
          message: `ファイル ${newName} は既に存在します。`,
        };
      }

      // meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === oldName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${oldName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          fileItem.name = newName;
          fileItem.path = newPath;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ファイルをリネーム
      this.renameSync(oldUri, newUri);

      return {
        success: true,
        message: `${oldName} を ${newName} にリネームしました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `リネームエラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  addTag(dirPath: string, fileName: string, tag: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.tags) {
            fileItem.tags = [];
          }
          if (!fileItem.tags.includes(tag)) {
            fileItem.tags.push(tag);
          } else {
            throw new Error(`タグ "${tag}" は既に存在します。`);
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} にタグ "${tag}" を追加しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  removeTag(dirPath: string, fileName: string, tag: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.tags || !fileItem.tags.includes(tag)) {
            throw new Error(`タグ "${tag}" が見つかりません。`);
          }
          fileItem.tags = fileItem.tags.filter((t) => t !== tag);
          if (fileItem.tags.length === 0) {
            fileItem.tags = undefined;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} からタグ "${tag}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setTags(dirPath: string, fileName: string, tags: string[]): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          const uniqueTags = [...new Set(tags)].sort();
          fileItem.tags = uniqueTags.length > 0 ? uniqueTags : undefined;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のタグを設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  addReference(dirPath: string, fileName: string, referencePath: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.references) {
            fileItem.references = [];
          }
          if (!fileItem.references.includes(referencePath)) {
            fileItem.references.push(referencePath);
          } else {
            throw new Error(`参照 "${referencePath}" は既に存在します。`);
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} に参照 "${referencePath}" を追加しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  removeReference(dirPath: string, fileName: string, referencePath: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.references || !fileItem.references.includes(referencePath)) {
            throw new Error(`参照 "${referencePath}" が見つかりません。`);
          }
          fileItem.references = fileItem.references.filter((ref) => ref !== referencePath);
          if (fileItem.references.length === 0) {
            fileItem.references = undefined;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} から参照 "${referencePath}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setReferences(dirPath: string, fileName: string, references: string[]): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          const uniqueReferences = [...new Set(references)];
          fileItem.references = uniqueReferences.length > 0 ? uniqueReferences : undefined;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の参照を設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setCharacterImportance(
    dirPath: string,
    fileName: string,
    importance: 'main' | 'sub' | 'background',
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.character) {
            fileItem.character = {
              importance: importance,
              multiple_characters: false,
            };
          } else {
            fileItem.character.importance = importance;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のキャラクター重要度を "${importance}" に設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `キャラクター重要度設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setMultipleCharacters(
    dirPath: string,
    fileName: string,
    multipleCharacters: boolean,
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.character) {
            fileItem.character = {
              importance: 'sub',
              multiple_characters: multipleCharacters,
            };
          } else {
            fileItem.character.multiple_characters = multipleCharacters;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の複数キャラクターフラグを "${multipleCharacters ? '有効' : '無効'}" に設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `複数キャラクターフラグ設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  removeCharacter(dirPath: string, fileName: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          delete fileItem.character;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のキャラクター設定を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `キャラクター設定削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  setForeshadowing(
    dirPath: string,
    fileName: string,
    foreshadowingData: ForeshadowingData,
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          fileItem.foreshadowing = {
            start: foreshadowingData.start,
            goal: foreshadowingData.goal,
          };
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の伏線設定を更新しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `伏線設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  removeForeshadowing(dirPath: string, fileName: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          delete fileItem.foreshadowing;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の伏線設定を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `伏線設定削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // === プライベートメソッド ===

  private updateMetaYaml(
    dirPath: string,
    updateFunction: (meta: MetaYaml) => MetaYaml,
  ): FileOperationResult {
    try {
      const metaPath = path.join(dirPath, 'meta.yaml');
      const metaUri = this.createFileUri(metaPath);

      // meta.yamlを読み込み
      const meta = MetaYamlUtils.loadMetaYaml(dirPath, this);
      if (meta === null) {
        return {
          success: false,
          message: 'meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // バリデーション
      const validationErrors = MetaYamlUtils.validateMetaYaml(updatedMeta);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: `meta.yaml検証エラー: ${validationErrors.join(', ')}`,
        };
      }

      // meta.yamlを保存
      const yamlContent = yaml.dump(updatedMeta, {
        flowLevel: -1,
        lineWidth: -1,
      });
      this.writeFileSync(metaUri, yamlContent);

      // パスを更新したアイテムを返す
      const updatedItems = updatedMeta.files.map((file) => ({
        ...file,
        path: path.join(dirPath, file.name),
      }));

      return {
        success: true,
        message: 'meta.yamlを更新しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `meta.yaml更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
