import { Uri } from './Uri.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { ForeshadowingData } from '../services/ForeshadowingService.js';

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
 * ファイル操作の結果を表すインターフェイス
 */
export interface FileOperationResult {
  success: boolean;
  message: string;
  updatedItems?: DialogoiTreeItem[];
}

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
 * ファイル操作を抽象化するサービス
 */
export abstract class FileOperationService {
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

  // === 高レベルなメタデータ操作メソッド ===

  /**
   * 新しいファイルを作成し、meta.yamlに追加する
   */
  abstract createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent?: string,
    tags?: string[],
  ): FileOperationResult;

  /**
   * ファイルを削除し、meta.yamlから除去する
   */
  abstract deleteFile(dirPath: string, fileName: string): FileOperationResult;

  /**
   * ファイルの順序を変更する
   */
  abstract reorderFiles(dirPath: string, fromIndex: number, toIndex: number): FileOperationResult;

  /**
   * ファイル名を変更する
   */
  abstract renameFile(dirPath: string, oldName: string, newName: string): FileOperationResult;

  /**
   * ファイルにタグを追加する
   */
  abstract addTag(dirPath: string, fileName: string, tag: string): FileOperationResult;

  /**
   * ファイルからタグを削除する
   */
  abstract removeTag(dirPath: string, fileName: string, tag: string): FileOperationResult;

  /**
   * ファイルのタグを一括で設定する
   */
  abstract setTags(dirPath: string, fileName: string, tags: string[]): FileOperationResult;

  /**
   * ファイルに参照を追加する
   */
  abstract addReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): FileOperationResult;

  /**
   * ファイルから参照を削除する
   */
  abstract removeReference(
    dirPath: string,
    fileName: string,
    referencePath: string,
  ): FileOperationResult;

  /**
   * ファイルの参照を一括で設定する
   */
  abstract setReferences(
    dirPath: string,
    fileName: string,
    references: string[],
  ): FileOperationResult;

  /**
   * ファイルのキャラクター重要度を設定する
   */
  abstract setCharacterImportance(
    dirPath: string,
    fileName: string,
    importance: 'main' | 'sub' | 'background',
  ): FileOperationResult;

  /**
   * ファイルの複数キャラクターフラグを設定する
   */
  abstract setMultipleCharacters(
    dirPath: string,
    fileName: string,
    multipleCharacters: boolean,
  ): FileOperationResult;

  /**
   * ファイルのキャラクター設定を削除する
   */
  abstract removeCharacter(dirPath: string, fileName: string): FileOperationResult;

  /**
   * ファイルの伏線設定を設定する
   */
  abstract setForeshadowing(
    dirPath: string,
    fileName: string,
    foreshadowingData: ForeshadowingData,
  ): FileOperationResult;

  /**
   * ファイルの伏線設定を削除する
   */
  abstract removeForeshadowing(dirPath: string, fileName: string): FileOperationResult;
}
