import {
  FileRepository,
  FileStats,
  DirectoryEntry,
} from './FileRepository.js';
import { Uri } from '../interfaces/Uri.js';
import * as path from 'path';

// TypeScriptの型定義を拡張
type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';

/**
 * モック用のUri実装
 */
class MockUri implements Uri {
  constructor(private _path: string) {}

  get scheme(): string {
    return 'file';
  }
  get authority(): string {
    return '';
  }
  get path(): string {
    return this._path;
  }
  get query(): string {
    return '';
  }
  get fragment(): string {
    return '';
  }
  get fsPath(): string {
    return this._path;
  }

  toString(): string {
    return `file://${this._path}`;
  }
  toJSON(): object {
    return { scheme: 'file', authority: '', path: this._path, query: '', fragment: '' };
  }
}

/**
 * モック用のファイル統計情報
 */
class MockFileStats implements FileStats {
  constructor(
    private _isFile: boolean,
    private _isDirectory: boolean,
    private _size: number = 0,
    private _mtime: Date = new Date(),
    private _birthtime: Date = new Date(),
  ) {}

  isFile(): boolean {
    return this._isFile;
  }
  isDirectory(): boolean {
    return this._isDirectory;
  }
  get size(): number {
    return this._size;
  }
  get mtime(): Date {
    return this._mtime;
  }
  get birthtime(): Date {
    return this._birthtime;
  }
}

/**
 * モック用のディレクトリエントリ
 */
class MockDirectoryEntry implements DirectoryEntry {
  constructor(
    private _name: string,
    private _isFile: boolean,
    private _isDirectory: boolean,
  ) {}

  get name(): string {
    return this._name;
  }
  isFile(): boolean {
    return this._isFile;
  }
  isDirectory(): boolean {
    return this._isDirectory;
  }
}

/**
 * テスト用のモックFileRepository
 */
export class MockFileRepository extends FileRepository {
  private files: Map<string, string | Buffer> = new Map();
  private directories: Set<string> = new Set();
  private extensionResources: Map<string, string> = new Map();

  constructor() {
    super();
    // デフォルトでルートディレクトリを作成
    this.directories.add('/');
  }

  // === ファイルシステム状態の管理 ===

  /**
   * ファイルシステム状態をリセット
   */
  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.directories.add('/');
  }

  /**
   * ファイルを手動で追加（テスト用）
   */
  addFile(path: string, content: string | Buffer): void {
    this.files.set(path, content);
    // 親ディレクトリも作成
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    if (parentDir && !this.directories.has(parentDir)) {
      this.directories.add(parentDir);
    }
  }

  /**
   * ファイルを手動で追加（テスト用）- addFileのエイリアス
   */
  createFileForTest(path: string, content: string | Buffer): void {
    this.addFile(path, content);
  }

  /**
   * ディレクトリを手動で追加（テスト用）
   */
  createDirectoryForTest(path: string): void {
    this.addDirectory(path);
  }

  /**
   * 拡張機能リソースを設定（テスト用）
   */
  setExtensionResource(resourcePath: string, content: string): void {
    this.extensionResources.set(resourcePath, content);
  }

  /**
   * ディレクトリを手動で追加（テスト用）
   */
  addDirectory(path: string): void {
    this.directories.add(path);
  }

  // === 基本的なファイル操作メソッド ===

  existsSync(uri: Uri): boolean {
    const path = uri.fsPath;
    return this.files.has(path) || this.directories.has(path);
  }

  readFileSync(uri: Uri, encoding?: BufferEncoding): string;
  readFileSync(uri: Uri, encoding?: null): Buffer;
  readFileSync(uri: Uri, encoding?: BufferEncoding | null): string | Buffer;
  readFileSync(uri: Uri, encoding?: BufferEncoding | null): string | Buffer {
    const path = uri.fsPath;
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ファイルが見つかりません: ${path}`);
    }

    if (encoding === null) {
      return Buffer.isBuffer(content) ? content : Buffer.from(content);
    }

    return Buffer.isBuffer(content) ? content.toString(encoding || 'utf8') : content;
  }

  writeFileSync(uri: Uri, data: string | Buffer, _encoding?: BufferEncoding): void {
    const path = uri.fsPath;
    this.files.set(path, data);

    // 親ディレクトリも作成
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    if (parentDir && !this.directories.has(parentDir)) {
      this.directories.add(parentDir);
    }
  }

  mkdirSync(uri: Uri): void {
    const path = uri.fsPath;
    this.directories.add(path);
  }

  createDirectorySync(uri: Uri): void {
    const path = uri.fsPath;
    this.directories.add(path);

    // 親ディレクトリも作成
    const parentPath = path.substring(0, path.lastIndexOf('/'));
    if (parentPath && !this.directories.has(parentPath)) {
      this.directories.add(parentPath);
    }
  }

  unlinkSync(uri: Uri): void {
    const path = uri.fsPath;
    if (!this.files.has(path)) {
      throw new Error(`ファイルが見つかりません: ${path}`);
    }
    this.files.delete(path);
  }

  rmSync(uri: Uri, options?: { recursive?: boolean; force?: boolean }): void {
    const path = uri.fsPath;

    if (this.directories.has(path)) {
      if (options?.recursive === true) {
        // 再帰的に削除
        const toDelete = Array.from(this.directories).filter((dir) => dir.startsWith(path));
        toDelete.forEach((dir) => this.directories.delete(dir));

        const filesToDelete = Array.from(this.files.keys()).filter((file) => file.startsWith(path));
        filesToDelete.forEach((file) => this.files.delete(file));
      } else {
        this.directories.delete(path);
      }
    } else if (this.files.has(path)) {
      this.files.delete(path);
    } else if (options?.force !== true) {
      throw new Error(`ファイルまたはディレクトリが見つかりません: ${path}`);
    }
  }

  readdirSync(uri: Uri, options?: { withFileTypes?: boolean }): string[] | DirectoryEntry[] {
    const dirPath = uri.fsPath;

    if (!this.directories.has(dirPath)) {
      throw new Error(`ディレクトリが見つかりません: ${dirPath}`);
    }

    const entries: string[] = [];
    const entryObjects: DirectoryEntry[] = [];

    // サブディレクトリを検索
    for (const dir of this.directories) {
      if (dir.startsWith(dirPath + '/')) {
        const relativePath = dir.substring(dirPath.length + 1);
        if (!relativePath.includes('/')) {
          entries.push(relativePath);
          entryObjects.push(new MockDirectoryEntry(relativePath, false, true));
        }
      }
    }

    // ファイルを検索
    for (const file of this.files.keys()) {
      if (file.startsWith(dirPath + '/')) {
        const relativePath = file.substring(dirPath.length + 1);
        if (!relativePath.includes('/')) {
          entries.push(relativePath);
          entryObjects.push(new MockDirectoryEntry(relativePath, true, false));
        }
      }
    }

    return options?.withFileTypes === true ? entryObjects : entries;
  }

  statSync(uri: Uri): FileStats {
    const path = uri.fsPath;

    if (this.files.has(path)) {
      const content = this.files.get(path);
      if (content !== undefined) {
        const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
        return new MockFileStats(true, false, size);
      }
    } else if (this.directories.has(path)) {
      return new MockFileStats(false, true);
    }
    throw new Error(`ファイルまたはディレクトリが見つかりません: ${path}`);
  }

  lstatSync(uri: Uri): FileStats {
    return this.statSync(uri);
  }

  renameSync(oldUri: Uri, newUri: Uri): void {
    const oldPath = oldUri.fsPath;
    const newPath = newUri.fsPath;

    if (this.files.has(oldPath)) {
      const content = this.files.get(oldPath);
      if (content !== undefined) {
        this.files.delete(oldPath);
        this.files.set(newPath, content);
      }
    } else if (this.directories.has(oldPath)) {
      this.directories.delete(oldPath);
      this.directories.add(newPath);
    } else {
      throw new Error(`ファイルまたはディレクトリが見つかりません: ${oldPath}`);
    }
  }

  // === Uriファクトリーメソッド ===

  createFileUri(path: string): Uri {
    return new MockUri(path);
  }

  createDirectoryUri(path: string): Uri {
    return new MockUri(path);
  }

  parseUri(value: string): Uri {
    const url = new URL(value);
    return new MockUri(url.pathname);
  }

  joinPath(base: Uri, ...paths: string[]): Uri {
    const basePath = base.fsPath;
    const joinedPath = path.join(basePath, ...paths);
    return new MockUri(joinedPath);
  }

  readExtensionResource(resourcePath: string): Promise<string> {
    const content = this.extensionResources.get(resourcePath);
    if (content === undefined || content === '') {
      throw new Error(`リソースが見つかりません: ${resourcePath}`);
    }
    return Promise.resolve(content);
  }
}

