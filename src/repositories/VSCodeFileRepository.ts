import * as vscode from 'vscode';
import * as fs from 'fs';
import { FileRepository, FileStats, DirectoryEntry } from './FileRepository.js';
import { Uri } from '../interfaces/Uri.js';

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
}
