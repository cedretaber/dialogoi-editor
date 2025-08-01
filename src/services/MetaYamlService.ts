import { MetaYaml, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * .dialogoi-meta.yaml ファイル操作サービスのインターフェース
 */
export interface MetaYamlService {
  /**
   * .dialogoi-meta.yaml を読み込む（非同期版）
   */
  loadMetaYamlAsync(dirAbsolutePath: string): Promise<MetaYaml | null>;

  /**
   * READMEファイルのパスを取得（非同期版）
   */
  getReadmeFilePathAsync(dirAbsolutePath: string): Promise<string | null>;

  /**
   * 小説ルートディレクトリを探す（非同期版）
   */
  findNovelRootAsync(workspaceRootAbsolutePath: string): Promise<string | null>;

  /**
   * .dialogoi-meta.yamlファイルを保存（非同期版）
   */
  saveMetaYamlAsync(dirAbsolutePath: string, meta: MetaYaml): Promise<boolean>;

  /**
   * ファイルのタグを更新
   */
  updateFileTags(dirAbsolutePath: string, fileName: string, tags: string[]): Promise<boolean>;

  /**
   * ファイルにタグを追加
   */
  addFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean>;

  /**
   * ファイルからタグを削除
   */
  removeFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean>;

  /**
   * ディレクトリをメタデータ内で移動する
   */
  moveDirectoryInMetadata(
    sourceParentDir: string,
    targetParentDir: string,
    dirName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }>;

  /**
   * ファイルをメタデータ内で移動する
   */
  moveFileInMetadata(
    sourceDir: string,
    targetDir: string,
    fileName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }>;

  /**
   * ファイルの参照関係を削除
   */
  removeFileReference(
    dirAbsolutePath: string,
    fileName: string,
    reference: string,
  ): Promise<boolean>;

  /**
   * ファイルのキャラクター情報を削除
   */
  removeFileCharacter(dirAbsolutePath: string, fileName: string): Promise<boolean>;

  /**
   * ファイルのcommentsフィールドを更新
   */
  updateFileCommentsAsync(
    dirAbsolutePath: string,
    fileName: string,
    commentsPath: string,
  ): Promise<boolean>;
}
