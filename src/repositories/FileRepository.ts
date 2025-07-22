import { Uri } from '../interfaces/Uri.js';

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
 * ファイル統計情報を表すインターフェイス
 */
export interface FileStats {
  isFile(): boolean;
  isDirectory(): boolean;
  size: number;
  mtime: Date;
  birthtime: Date;
}

/**
 * ディレクトリエントリを表すインターフェイス
 */
export interface DirectoryEntry {
  name: string;
  isFile(): boolean;
  isDirectory(): boolean;
}

/**
 * ファイル操作を抽象化するリポジトリ
 */
export abstract class FileRepository {
  // === 基本的なファイル操作メソッド ===

  /**
   * ファイルまたはディレクトリが存在するかチェック
   */
  abstract existsSync(uri: Uri): boolean;

  /**
   * ファイルを読み込む
   */
  abstract readFileSync(uri: Uri, encoding?: BufferEncoding): string;
  abstract readFileSync(uri: Uri, encoding?: null): Buffer;
  abstract readFileSync(uri: Uri, encoding?: BufferEncoding | null): string | Buffer;

  /**
   * ファイルに書き込む
   */
  abstract writeFileSync(uri: Uri, data: string | Buffer, encoding?: BufferEncoding): void;

  /**
   * ディレクトリを作成
   */
  abstract mkdirSync(uri: Uri): void;

  /**
   * ディレクトリを再帰的に作成
   */
  abstract createDirectorySync(uri: Uri): void;

  /**
   * ファイルを削除
   */
  abstract unlinkSync(uri: Uri): void;

  /**
   * ディレクトリを削除（再帰的）
   */
  abstract rmSync(uri: Uri, options?: { recursive?: boolean; force?: boolean }): void;

  /**
   * ディレクトリの内容を読み込む
   */
  abstract readdirSync(
    uri: Uri,
    options?: { withFileTypes?: boolean },
  ): string[] | DirectoryEntry[];

  /**
   * ファイルの統計情報を取得
   */
  abstract statSync(uri: Uri): FileStats;

  /**
   * ファイルの統計情報を取得（シンボリックリンクの場合はリンク自体の情報）
   */
  abstract lstatSync(uri: Uri): FileStats;

  /**
   * ファイル名を変更（同期）
   */
  abstract renameSync(oldUri: Uri, newUri: Uri): void;

  /**
   * ファイル名を変更（非同期）
   * VSCodeのworkspace.fs.renameを使用して、エディタの状態を保持
   */
  abstract renameAsync(oldUri: Uri, newUri: Uri): Promise<void>;

  // === 非同期ファイル操作メソッド（vscode.workspace.fs対応） ===

  /**
   * ファイルまたはディレクトリが存在するかチェック（非同期）
   * VSCodeのworkspace.fs.statを使用
   */
  abstract existsAsync(uri: Uri): Promise<boolean>;

  /**
   * ファイルを読み込む（非同期）
   * VSCodeのworkspace.fs.readFileを使用
   */
  abstract readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string>;
  abstract readFileAsync(uri: Uri): Promise<Uint8Array>;
  abstract readFileAsync(uri: Uri, encoding?: BufferEncoding): Promise<string | Uint8Array>;

  /**
   * ファイルに書き込む（非同期）
   * VSCodeのworkspace.fs.writeFileを使用
   */
  abstract writeFileAsync(uri: Uri, data: string | Uint8Array): Promise<void>;

  /**
   * ディレクトリを再帰的に作成（非同期）
   * VSCodeのworkspace.fs.createDirectoryを使用
   */
  abstract createDirectoryAsync(uri: Uri): Promise<void>;

  /**
   * ファイルを削除（非同期）
   * VSCodeのworkspace.fs.deleteを使用
   */
  abstract unlinkAsync(uri: Uri): Promise<void>;

  /**
   * ディレクトリを削除（非同期・再帰的）
   * VSCodeのworkspace.fs.deleteを使用
   */
  abstract rmAsync(uri: Uri, options?: { recursive?: boolean }): Promise<void>;

  /**
   * ディレクトリの内容を読み込む（非同期）
   * VSCodeのworkspace.fs.readDirectoryを使用
   */
  abstract readdirAsync(uri: Uri): Promise<DirectoryEntry[]>;

  /**
   * ファイルの統計情報を取得（非同期）
   * VSCodeのworkspace.fs.statを使用
   */
  abstract statAsync(uri: Uri): Promise<FileStats>;

  // === Uriファクトリーメソッド ===

  /**
   * ファイルパスからUriを作成
   */
  abstract createFileUri(path: string): Uri;

  /**
   * ディレクトリパスからUriを作成
   */
  abstract createDirectoryUri(path: string): Uri;

  /**
   * 文字列からUriを作成
   */
  abstract parseUri(value: string): Uri;

  /**
   * パスを結合してUriを作成
   */
  abstract joinPath(base: Uri, ...paths: string[]): Uri;

  /**
   * 拡張機能内のリソースファイルを読み込む
   */
  abstract readExtensionResource(resourcePath: string): Promise<string>;

  // Repository は純粋なデータアクセス層の責務のみを担当
  // 高レベルな操作は Service 層で実装
}
