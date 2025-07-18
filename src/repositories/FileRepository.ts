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
   * ファイル名を変更
   */
  abstract renameSync(oldUri: Uri, newUri: Uri): void;

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
