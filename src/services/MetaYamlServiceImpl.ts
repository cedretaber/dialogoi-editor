import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import {
  MetaYamlUtils,
  MetaYaml,
  DialogoiTreeItem,
  hasTagsProperty,
  hasReferencesProperty,
  hasCharacterProperty,
} from '../utils/MetaYamlUtils.js';

import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiPathService } from './DialogoiPathService.js';

/**
 * dialogoi-meta.yaml ファイルの操作を行うサービスの実装
 */
export class MetaYamlServiceImpl implements MetaYamlService {
  constructor(
    private fileRepository: FileRepository,
    private dialogoiPathService: DialogoiPathService,
  ) {}

  /**
   * メタデータファイルを読み込む（非同期版）
   */
  async loadMetaYamlAsync(dirAbsolutePath: string): Promise<MetaYaml | null> {
    const metaAbsolutePath = this.dialogoiPathService.resolveMetaPath(dirAbsolutePath);

    try {
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      if (!(await this.fileRepository.existsAsync(metaUri))) {
        return null;
      }
      const metaContent = await this.fileRepository.readFileAsync(metaUri, 'utf8');
      return MetaYamlUtils.parseMetaYaml(metaContent);
    } catch (error) {
      console.error('メタデータファイルの読み込みエラー:', error);
      return null;
    }
  }

  /**
   * READMEファイルのパスを取得（非同期版）
   */
  async getReadmeFilePathAsync(dirAbsolutePath: string): Promise<string | null> {
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeAbsolutePath = path.join(dirAbsolutePath, meta.readme);
    const readmeUri = this.fileRepository.createFileUri(readmeAbsolutePath);
    if (await this.fileRepository.existsAsync(readmeUri)) {
      return readmeAbsolutePath;
    }

    return null;
  }

  /**
   * 小説ルートディレクトリを探す（非同期版）
   */
  async findNovelRootAsync(workspaceRootAbsolutePath: string): Promise<string | null> {
    const findDialogoiYaml = async (dirAbsolutePath: string): Promise<string | null> => {
      const dirUri = this.fileRepository.createFileUri(dirAbsolutePath);
      const items = await this.fileRepository.readdirAsync(dirUri);

      for (const item of items) {
        const fullAbsolutePath = path.join(dirAbsolutePath, item.name);
        if (item.isDirectory() && item.name === '.dialogoi') {
          // .dialogoi/dialogoi.yamlの存在を確認
          const dialogoiYamlPath = path.join(fullAbsolutePath, 'dialogoi.yaml');
          const dialogoiYamlUri = this.fileRepository.createFileUri(dialogoiYamlPath);
          if (await this.fileRepository.existsAsync(dialogoiYamlUri)) {
            return dirAbsolutePath;
          }
        } else if (item.isDirectory()) {
          const result = await findDialogoiYaml(fullAbsolutePath);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    };

    return await findDialogoiYaml(workspaceRootAbsolutePath);
  }

  /**
   * メタデータファイルを保存（非同期版）
   */
  async saveMetaYamlAsync(dirAbsolutePath: string, meta: MetaYaml): Promise<boolean> {
    try {
      // バリデーション
      const validationErrors = MetaYamlUtils.validateMetaYaml(meta);
      if (validationErrors.length > 0) {
        console.error('メタデータファイル検証エラー:', validationErrors);
        return false;
      }

      // 保存前にディレクトリ構造を自動作成
      await this.dialogoiPathService.ensureDialogoiDirectory(dirAbsolutePath);

      const metaAbsolutePath = this.dialogoiPathService.resolveMetaPath(dirAbsolutePath);
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      const yamlContent = MetaYamlUtils.stringifyMetaYaml(meta);
      await this.fileRepository.writeFileAsync(metaUri, yamlContent);
      return true;
    } catch (error) {
      console.error('メタデータファイルの保存エラー:', error);
      return false;
    }
  }

  /**
   * ファイルのタグを更新
   */
  async updateFileTags(
    dirAbsolutePath: string,
    fileName: string,
    tags: string[],
  ): Promise<boolean> {
    const metaAbsolutePath = this.dialogoiPathService.resolveMetaPath(dirAbsolutePath);
    const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);

    try {
      // 既存のメタデータファイルを読み込む
      const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
      if (!meta) {
        return false;
      }

      const fileItem = meta.files.find((item) => item.name === fileName);
      if (!fileItem) {
        return false;
      }

      // サブディレクトリにはタグを設定できない
      if (!hasTagsProperty(fileItem)) {
        return false; // サブディレクトリアイテムの場合は処理しない
      }

      // タグを更新
      if (tags.length > 0) {
        fileItem.tags = tags;
      } else {
        fileItem.tags = []; // 空配列に設定
      }

      // メタデータファイルを更新
      const updatedContent = MetaYamlUtils.stringifyMetaYaml(meta);
      await this.fileRepository.writeFileAsync(metaUri, updatedContent);

      return true;
    } catch (error) {
      console.error('タグの更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * ファイルにタグを追加
   */
  async addFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean> {
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      return false;
    }

    // サブディレクトリにはタグを設定できない
    if (!hasTagsProperty(fileItem)) {
      return false;
    }

    // 既存のタグを取得
    const currentTags = fileItem.tags;

    // 重複チェック
    if (currentTags.includes(tag)) {
      return true; // 既に存在する場合は成功とする
    }

    // タグを追加
    const newTags = [...currentTags, tag];
    return await this.updateFileTags(dirAbsolutePath, fileName, newTags);
  }

  /**
   * ファイルからタグを削除
   */
  async removeFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean> {
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      return true; // ファイルがない場合は成功とする
    }

    // サブディレクトリにはタグがない
    if (!hasTagsProperty(fileItem) || fileItem.tags.length === 0) {
      return true; // タグがない場合は成功とする
    }

    // タグを削除
    const newTags = fileItem.tags.filter((t: string) => t !== tag);
    return await this.updateFileTags(dirAbsolutePath, fileName, newTags);
  }

  /**
   * ディレクトリをメタデータ内で移動する
   */
  async moveDirectoryInMetadata(
    sourceParentDir: string,
    targetParentDir: string,
    dirName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }> {
    try {
      // 移動元の親ディレクトリのメタデータを読み込み
      const sourceParentMeta = await this.loadMetaYamlAsync(sourceParentDir);
      if (sourceParentMeta === null) {
        return {
          success: false,
          message:
            '移動元の親ディレクトリのメタデータファイルが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動先の親ディレクトリのメタデータを読み込み
      const targetParentMeta = await this.loadMetaYamlAsync(targetParentDir);
      if (targetParentMeta === null) {
        return {
          success: false,
          message:
            '移動先の親ディレクトリのメタデータファイルが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動元からディレクトリアイテムを取得
      const dirIndex = sourceParentMeta.files.findIndex(
        (file) => file.name === dirName && file.type === 'subdirectory',
      );
      if (dirIndex === -1) {
        return {
          success: false,
          message: `移動元のメタデータファイル内にディレクトリ ${dirName} が見つかりません。`,
        };
      }

      const dirItem = sourceParentMeta.files[dirIndex];
      if (dirItem === undefined) {
        return {
          success: false,
          message: `ディレクトリ ${dirName} の情報を取得できませんでした。`,
        };
      }

      // 移動先に同名ディレクトリが既に存在する場合はエラー
      const existingDir = targetParentMeta.files.find(
        (file) => file.name === dirName && file.type === 'subdirectory',
      );
      if (existingDir) {
        return {
          success: false,
          message: `移動先に同名ディレクトリ ${dirName} が既に存在します。`,
        };
      }

      // ディレクトリアイテムのパスを更新
      const updatedDirItem = {
        ...dirItem,
        path: path.join(targetParentDir, dirName),
      };

      // 移動元から削除
      sourceParentMeta.files.splice(dirIndex, 1);

      // 移動先に追加
      if (newIndex !== undefined && newIndex >= 0 && newIndex < targetParentMeta.files.length) {
        targetParentMeta.files.splice(newIndex, 0, updatedDirItem);
      } else {
        targetParentMeta.files.push(updatedDirItem);
      }

      // 移動元の親ディレクトリのメタデータを保存
      const saveSourceResult = await this.saveMetaYamlAsync(sourceParentDir, sourceParentMeta);
      if (!saveSourceResult) {
        return {
          success: false,
          message: '移動元の親ディレクトリのメタデータファイルの保存に失敗しました。',
        };
      }

      // 移動先の親ディレクトリのメタデータを保存
      const saveTargetResult = await this.saveMetaYamlAsync(targetParentDir, targetParentMeta);
      if (!saveTargetResult) {
        // 移動元をロールバック
        sourceParentMeta.files.splice(dirIndex, 0, dirItem);
        await this.saveMetaYamlAsync(sourceParentDir, sourceParentMeta);

        return {
          success: false,
          message: '移動先の親ディレクトリのメタデータファイルの保存に失敗しました。',
        };
      }

      // 更新されたアイテムを返す
      const updatedItems = targetParentMeta.files.map((file) => ({
        ...file,
        path: path.join(targetParentDir, file.name),
      }));

      return {
        success: true,
        message: 'メタデータ内でディレクトリを移動しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `メタデータディレクトリ移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルをメタデータ内で移動する
   */
  async moveFileInMetadata(
    sourceDir: string,
    targetDir: string,
    fileName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }> {
    try {
      // 移動元のメタデータを読み込み
      const sourceMeta = await this.loadMetaYamlAsync(sourceDir);
      if (sourceMeta === null) {
        return {
          success: false,
          message: '移動元のメタデータファイルが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動先のメタデータを読み込み
      const targetMeta = await this.loadMetaYamlAsync(targetDir);
      if (targetMeta === null) {
        return {
          success: false,
          message: '移動先のメタデータファイルが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動元からファイルアイテムを取得
      const fileIndex = sourceMeta.files.findIndex((file) => file.name === fileName);
      if (fileIndex === -1) {
        return {
          success: false,
          message: `移動元のメタデータファイル内にファイル ${fileName} が見つかりません。`,
        };
      }

      const fileItem = sourceMeta.files[fileIndex];
      if (fileItem === undefined) {
        return {
          success: false,
          message: `ファイル ${fileName} の情報を取得できませんでした。`,
        };
      }

      // 移動先に同名ファイルが既に存在する場合はエラー
      // ただし、同じディレクトリ内での並び替えの場合は除く
      const isReorderingInSameDirectory = path.normalize(sourceDir) === path.normalize(targetDir);

      const existingFile = targetMeta.files.find((file) => file.name === fileName);
      if (existingFile && !isReorderingInSameDirectory) {
        return {
          success: false,
          message: `移動先に同名ファイル ${fileName} が既に存在します。`,
        };
      }

      if (isReorderingInSameDirectory) {
        // 同じディレクトリ内での並び替え
        if (newIndex !== undefined && newIndex >= 0 && newIndex < sourceMeta.files.length) {
          // 現在の位置から削除
          sourceMeta.files.splice(fileIndex, 1);
          // 新しい位置に挿入
          sourceMeta.files.splice(newIndex, 0, fileItem);
        }
        // パスの更新は不要（同じディレクトリなので）

        // メタデータを保存
        const saveResult = await this.saveMetaYamlAsync(sourceDir, sourceMeta);
        if (!saveResult) {
          return {
            success: false,
            message: 'メタデータの保存に失敗しました。',
          };
        }
      } else {
        // 異なるディレクトリ間での移動
        const updatedFileItem = {
          ...fileItem,
          path: path.join(targetDir, fileName),
        };

        // 移動元から削除
        sourceMeta.files.splice(fileIndex, 1);

        // 移動先に追加
        if (newIndex !== undefined && newIndex >= 0 && newIndex < targetMeta.files.length) {
          targetMeta.files.splice(newIndex, 0, updatedFileItem);
        } else {
          targetMeta.files.push(updatedFileItem);
        }

        // 移動元のメタデータを保存
        const saveSourceResult = await this.saveMetaYamlAsync(sourceDir, sourceMeta);
        if (!saveSourceResult) {
          return {
            success: false,
            message: '移動元のメタデータファイルの保存に失敗しました。',
          };
        }

        // 移動先のメタデータを保存
        const saveTargetResult = await this.saveMetaYamlAsync(targetDir, targetMeta);
        if (!saveTargetResult) {
          // 移動元をロールバック
          sourceMeta.files.splice(fileIndex, 0, fileItem);
          await this.saveMetaYamlAsync(sourceDir, sourceMeta);

          return {
            success: false,
            message: '移動先のメタデータファイルの保存に失敗しました。',
          };
        }
      }

      // 更新されたアイテムを返す
      const finalMeta = isReorderingInSameDirectory ? sourceMeta : targetMeta;
      const finalDir = isReorderingInSameDirectory ? sourceDir : targetDir;
      const updatedItems = finalMeta.files.map((file) => ({
        ...file,
        path: path.join(finalDir, file.name),
      }));

      return {
        success: true,
        message: 'メタデータ内でファイルを移動しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `メタデータファイル移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの参照関係を削除
   */
  async removeFileReference(
    dirAbsolutePath: string,
    fileName: string,
    reference: string,
  ): Promise<boolean> {
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      return true; // ファイルがない場合は成功とする
    }

    // サブディレクトリや設定ファイルには参照がない
    if (!hasReferencesProperty(fileItem) || fileItem.references.length === 0) {
      return true; // 参照がない場合は成功とする
    }

    // 参照を削除
    const newReferences = fileItem.references.filter((ref: string) => ref !== reference);

    if (newReferences.length === 0) {
      fileItem.references = [];
    } else {
      fileItem.references = newReferences;
    }

    return await this.saveMetaYamlAsync(dirAbsolutePath, meta);
  }

  /**
   * ファイルのキャラクター情報を削除
   */
  async removeFileCharacter(dirAbsolutePath: string, fileName: string): Promise<boolean> {
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      return false;
    }

    // サブディレクトリやキャラクター以外のファイルにはキャラクター情報がない
    if (!hasCharacterProperty(fileItem)) {
      return false; // キャラクターファイルでない場合は処理しない
    }

    // CharacterItemからSettingItemへの変換は型システム上複雑
    // 実際の実装では、新しいSettingItemを作成し直す必要がある
    const newSettingItem: DialogoiTreeItem = {
      name: fileItem.name,
      type: 'setting',
      path: fileItem.path,
      hash: fileItem.hash,
      tags: fileItem.tags,
      ...(fileItem.comments !== undefined &&
        fileItem.comments !== '' && { comments: fileItem.comments }),
      isUntracked: fileItem.isUntracked,
      isMissing: fileItem.isMissing,
    };

    // 元のアイテムを新しいアイテムで置き換え
    const itemIndex = meta.files.findIndex((item) => item.name === fileName);
    if (itemIndex !== -1) {
      meta.files[itemIndex] = newSettingItem;
    }

    return await this.saveMetaYamlAsync(dirAbsolutePath, meta);
  }

  /**
   * ファイルのcommentsフィールドを更新
   */
  async updateFileCommentsAsync(
    dirAbsolutePath: string,
    fileName: string,
    commentsPath: string,
  ): Promise<boolean> {
    // メタデータファイルを読み込み
    const meta = await this.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      console.error(`メタデータファイルの読み込みに失敗しました: ${dirAbsolutePath}`);
      return false;
    }

    // 対象ファイルを検索
    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      console.error(`ファイルが見つかりません: ${fileName} in ${dirAbsolutePath}`);
      return false;
    }

    // commentsフィールドを更新（オプショナルなので条件分岐）
    if (fileItem.type === 'content') {
      // ContentItemの場合（型ナローイングされているためアサーション不要）
      fileItem.comments = commentsPath;
    } else if (fileItem.type === 'setting') {
      // SettingItemの場合（型ナローイングされているためアサーション不要）
      fileItem.comments = commentsPath;
    } else {
      console.error(`コメント対象外のファイルタイプです: ${fileItem.type}`);
      return false;
    }

    // メタデータファイルを保存
    return await this.saveMetaYamlAsync(dirAbsolutePath, meta);
  }
}
