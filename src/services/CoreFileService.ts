import { DialogoiTreeItem } from '../models/DialogoiTreeItem.js';

/**
 * ファイル操作の結果を表すインターフェイス
 */
export interface FileOperationResult {
  success: boolean;
  message: string;
  updatedItems?: DialogoiTreeItem[];
}

/**
 * CoreFileService インターフェイス
 * 基本ファイル・ディレクトリ操作を担当するコアサービス
 */
export interface CoreFileService {
  /**
   * ノベルルートパスを取得
   * @returns ノベルルートの絶対パス（設定されていない場合はundefined）
   */
  getNovelRootPath(): string | undefined;

  /**
   * ファイルを作成する
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param fileType ファイル種別
   * @param initialContent 初期内容
   * @param tags タグ配列
   * @param subtype サブタイプ
   * @returns 処理結果
   */
  createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent?: string,
    tags?: string[],
    subtype?: 'character' | 'foreshadowing' | 'glossary',
  ): Promise<FileOperationResult>;

  /**
   * ファイルを削除する
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 処理結果
   */
  deleteFile(dirPath: string, fileName: string): Promise<FileOperationResult>;

  /**
   * ファイル名を変更する
   * @param dirPath ディレクトリパス
   * @param oldFileName 旧ファイル名
   * @param newFileName 新ファイル名
   * @returns 処理結果
   */
  renameFile(
    dirPath: string,
    oldFileName: string,
    newFileName: string,
  ): Promise<FileOperationResult>;

  /**
   * ディレクトリ内のファイル順序を変更する
   * @param dirPath ディレクトリパス
   * @param fromIndex 移動元のインデックス
   * @param toIndex 移動先のインデックス
   * @returns 処理結果
   */
  reorderFiles(dirPath: string, fromIndex: number, toIndex: number): Promise<FileOperationResult>;

  /**
   * ファイルを移動する
   * @param sourceDir 移動元ディレクトリパス
   * @param fileName ファイル名
   * @param targetDir 移動先ディレクトリパス
   * @param newIndex 移動先での新しいインデックス（オプション）
   * @returns 処理結果
   */
  moveFile(
    sourceDir: string,
    fileName: string,
    targetDir: string,
    newIndex?: number,
  ): Promise<FileOperationResult>;

  /**
   * ディレクトリを移動する
   * @param sourceParentDir 移動元の親ディレクトリパス
   * @param dirName ディレクトリ名
   * @param targetParentDir 移動先の親ディレクトリパス
   * @param newIndex 移動先での新しいインデックス（オプション）
   * @returns 処理結果
   */
  moveDirectory(
    sourceParentDir: string,
    dirName: string,
    targetParentDir: string,
    newIndex?: number,
  ): Promise<FileOperationResult>;

  /**
   * ディレクトリを削除する
   * @param parentDir 親ディレクトリパス
   * @param dirName ディレクトリ名
   * @returns 処理結果
   */
  deleteDirectory(parentDir: string, dirName: string): Promise<FileOperationResult>;

  /**
   * ファイルを読み込む
   * @param filePath ファイルパス
   * @param encoding エンコーディング
   * @returns ファイル内容
   */
  readFile(filePath: string, encoding?: 'utf8'): Promise<string>;

  /**
   * ファイルに書き込む
   * @param filePath ファイルパス
   * @param content 内容
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * ファイルまたはディレクトリが存在するかチェック
   * @param filePath ファイルパス
   * @returns 存在する場合true
   */
  exists(filePath: string): Promise<boolean>;
}
