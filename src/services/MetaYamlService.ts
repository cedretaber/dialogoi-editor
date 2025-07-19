import * as path from 'path';
import { ReviewSummary } from '../models/Review.js';
import { FileRepository, DirectoryEntry } from '../repositories/FileRepository.js';
import { MetaYamlUtils, MetaYaml, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * .dialogoi-meta.yaml ファイルの操作を行うサービス
 */
export class MetaYamlService {
  constructor(private fileRepository: FileRepository) {}

  /**
   * .dialogoi-meta.yaml を読み込む
   */
  loadMetaYaml(dirAbsolutePath: string): MetaYaml | null {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      if (!this.fileRepository.existsSync(metaUri)) {
        return null;
      }
      const metaContent = this.fileRepository.readFileSync(metaUri, 'utf8');
      return MetaYamlUtils.parseMetaYaml(metaContent);
    } catch (error) {
      console.error('.dialogoi-meta.yaml の読み込みエラー:', error);
      return null;
    }
  }

  /**
   * .dialogoi-meta.yamlファイルを保存
   */
  saveMetaYaml(dirAbsolutePath: string, meta: MetaYaml): boolean {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      // バリデーション
      const validationErrors = MetaYamlUtils.validateMetaYaml(meta);
      if (validationErrors.length > 0) {
        console.error('.dialogoi-meta.yaml検証エラー:', validationErrors);
        return false;
      }

      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);
      const yamlContent = MetaYamlUtils.stringifyMetaYaml(meta);
      this.fileRepository.writeFileSync(metaUri, yamlContent, 'utf8');
      return true;
    } catch (error) {
      console.error('.dialogoi-meta.yaml の保存エラー:', error);
      return false;
    }
  }

  /**
   * READMEファイルのパスを取得
   */
  getReadmeFilePath(dirAbsolutePath: string): string | null {
    const meta = this.loadMetaYaml(dirAbsolutePath);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeAbsolutePath = path.join(dirAbsolutePath, meta.readme);
    const readmeUri = this.fileRepository.createFileUri(readmeAbsolutePath);
    if (this.fileRepository.existsSync(readmeUri)) {
      return readmeAbsolutePath;
    }

    return null;
  }

  /**
   * 小説ルートディレクトリを探す
   */
  findNovelRoot(workspaceRootAbsolutePath: string): string | null {
    const findDialogoiYaml = (dirAbsolutePath: string): string | null => {
      const dirUri = this.fileRepository.createFileUri(dirAbsolutePath);
      const items = this.fileRepository.readdirSync(dirUri, {
        withFileTypes: true,
      }) as DirectoryEntry[];

      for (const item of items) {
        const fullAbsolutePath = path.join(dirAbsolutePath, item.name);
        if (item.isFile() && item.name === 'dialogoi.yaml') {
          return dirAbsolutePath;
        } else if (item.isDirectory()) {
          const result = findDialogoiYaml(fullAbsolutePath);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    };

    return findDialogoiYaml(workspaceRootAbsolutePath);
  }

  /**
   * .dialogoi-meta.yaml のファイルエントリにレビュー情報を設定
   */
  updateReviewInfo(
    dirAbsolutePath: string,
    fileName: string,
    reviewSummary: ReviewSummary | null,
  ): boolean {
    const metaAbsolutePath = path.join(dirAbsolutePath, '.dialogoi-meta.yaml');

    try {
      const metaUri = this.fileRepository.createFileUri(metaAbsolutePath);

      if (!this.fileRepository.existsSync(metaUri)) {
        return false;
      }

      const content = this.fileRepository.readFileSync(metaUri, 'utf-8');
      const meta = MetaYamlUtils.parseMetaYaml(content);

      if (!meta) {
        return false;
      }

      const fileItem = meta.files.find((item) => item.name === fileName);
      if (!fileItem) {
        return false;
      }

      if (
        reviewSummary &&
        (reviewSummary.open > 0 ||
          (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0))
      ) {
        // レビューが存在する場合
        const filePathInDir = path.join(path.basename(dirAbsolutePath), fileName);
        fileItem.reviews = MetaYamlUtils.generateReviewFilePath(filePathInDir);

        // レビューサマリーを設定（0でない値のみ）
        fileItem.review_count = { open: reviewSummary.open };
        if (reviewSummary.in_progress !== undefined && reviewSummary.in_progress > 0) {
          fileItem.review_count.in_progress = reviewSummary.in_progress;
        }
        if (reviewSummary.resolved !== undefined && reviewSummary.resolved > 0) {
          fileItem.review_count.resolved = reviewSummary.resolved;
        }
        if (reviewSummary.dismissed !== undefined && reviewSummary.dismissed > 0) {
          fileItem.review_count.dismissed = reviewSummary.dismissed;
        }
      } else {
        // レビューが存在しない場合は削除
        delete fileItem.reviews;
        delete fileItem.review_count;
      }

      // .dialogoi-meta.yaml を更新
      const updatedContent = MetaYamlUtils.stringifyMetaYaml(meta);
      this.fileRepository.writeFileSync(metaUri, updatedContent, 'utf-8');

      return true;
    } catch (error) {
      console.error('レビュー情報の更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * .dialogoi-meta.yaml からレビュー情報を削除
   */
  removeReviewInfo(dirAbsolutePath: string, fileName: string): boolean {
    return this.updateReviewInfo(dirAbsolutePath, fileName, null);
  }

  /**
   * ファイルのタグを更新
   */
  updateFileTags(dirAbsolutePath: string, fileName: string, tags: string[]): boolean {
    const metaUri = this.fileRepository.createFileUri(
      path.join(dirAbsolutePath, '.dialogoi-meta.yaml'),
    );

    try {
      // 既存の .dialogoi-meta.yaml を読み込む
      const meta = this.loadMetaYaml(dirAbsolutePath);
      if (!meta) {
        return false;
      }

      const fileItem = meta.files.find((item) => item.name === fileName);
      if (!fileItem) {
        return false;
      }

      // タグを更新
      if (tags.length > 0) {
        fileItem.tags = tags;
      } else {
        delete fileItem.tags;
      }

      // .dialogoi-meta.yaml を更新
      const updatedContent = MetaYamlUtils.stringifyMetaYaml(meta);
      this.fileRepository.writeFileSync(metaUri, updatedContent, 'utf-8');

      return true;
    } catch (error) {
      console.error('タグの更新に失敗しました:', error);
      return false;
    }
  }

  /**
   * ファイルにタグを追加
   */
  addFileTag(dirAbsolutePath: string, fileName: string, tag: string): boolean {
    const meta = this.loadMetaYaml(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem) {
      return false;
    }

    // 既存のタグを取得
    const currentTags = fileItem.tags || [];

    // 重複チェック
    if (currentTags.includes(tag)) {
      return true; // 既に存在する場合は成功とする
    }

    // タグを追加
    const newTags = [...currentTags, tag];
    return this.updateFileTags(dirAbsolutePath, fileName, newTags);
  }

  /**
   * ファイルからタグを削除
   */
  removeFileTag(dirAbsolutePath: string, fileName: string, tag: string): boolean {
    const meta = this.loadMetaYaml(dirAbsolutePath);
    if (!meta) {
      return false;
    }

    const fileItem = meta.files.find((item) => item.name === fileName);
    if (!fileItem || !fileItem.tags) {
      return true; // タグがない場合は成功とする
    }

    // タグを削除
    const newTags = fileItem.tags.filter((t) => t !== tag);
    return this.updateFileTags(dirAbsolutePath, fileName, newTags);
  }

  /**
   * ディレクトリをメタデータ内で移動する
   */
  moveDirectoryInMetadata(
    sourceParentDir: string,
    targetParentDir: string,
    dirName: string,
    newIndex?: number,
  ): { success: boolean; message: string; updatedItems?: DialogoiTreeItem[] } {
    try {
      // 移動元の親ディレクトリのメタデータを読み込み
      const sourceParentMeta = this.loadMetaYaml(sourceParentDir);
      if (sourceParentMeta === null) {
        return {
          success: false,
          message:
            '移動元の親ディレクトリの.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動先の親ディレクトリのメタデータを読み込み
      const targetParentMeta = this.loadMetaYaml(targetParentDir);
      if (targetParentMeta === null) {
        return {
          success: false,
          message:
            '移動先の親ディレクトリの.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動元からディレクトリアイテムを取得
      const dirIndex = sourceParentMeta.files.findIndex(
        (file) => file.name === dirName && file.type === 'subdirectory',
      );
      if (dirIndex === -1) {
        return {
          success: false,
          message: `移動元の.dialogoi-meta.yaml内にディレクトリ ${dirName} が見つかりません。`,
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
      const saveSourceResult = this.saveMetaYaml(sourceParentDir, sourceParentMeta);
      if (!saveSourceResult) {
        return {
          success: false,
          message: '移動元の親ディレクトリの.dialogoi-meta.yamlの保存に失敗しました。',
        };
      }

      // 移動先の親ディレクトリのメタデータを保存
      const saveTargetResult = this.saveMetaYaml(targetParentDir, targetParentMeta);
      if (!saveTargetResult) {
        // 移動元をロールバック
        sourceParentMeta.files.splice(dirIndex, 0, dirItem);
        this.saveMetaYaml(sourceParentDir, sourceParentMeta);

        return {
          success: false,
          message: '移動先の親ディレクトリの.dialogoi-meta.yamlの保存に失敗しました。',
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
  moveFileInMetadata(
    sourceDir: string,
    targetDir: string,
    fileName: string,
    newIndex?: number,
  ): { success: boolean; message: string; updatedItems?: DialogoiTreeItem[] } {
    try {
      // 移動元のメタデータを読み込み
      const sourceMeta = this.loadMetaYaml(sourceDir);
      if (sourceMeta === null) {
        return {
          success: false,
          message: '移動元の.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動先のメタデータを読み込み
      const targetMeta = this.loadMetaYaml(targetDir);
      if (targetMeta === null) {
        return {
          success: false,
          message: '移動先の.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 移動元からファイルアイテムを取得
      const fileIndex = sourceMeta.files.findIndex((file) => file.name === fileName);
      if (fileIndex === -1) {
        return {
          success: false,
          message: `移動元の.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`,
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
      const existingFile = targetMeta.files.find((file) => file.name === fileName);
      if (existingFile) {
        return {
          success: false,
          message: `移動先に同名ファイル ${fileName} が既に存在します。`,
        };
      }

      // ファイルアイテムのパスを更新
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
      const saveSourceResult = this.saveMetaYaml(sourceDir, sourceMeta);
      if (!saveSourceResult) {
        return {
          success: false,
          message: '移動元の.dialogoi-meta.yamlの保存に失敗しました。',
        };
      }

      // 移動先のメタデータを保存
      const saveTargetResult = this.saveMetaYaml(targetDir, targetMeta);
      if (!saveTargetResult) {
        // 移動元をロールバック
        sourceMeta.files.splice(fileIndex, 0, fileItem);
        this.saveMetaYaml(sourceDir, sourceMeta);

        return {
          success: false,
          message: '移動先の.dialogoi-meta.yamlの保存に失敗しました。',
        };
      }

      // 更新されたアイテムを返す
      const updatedItems = targetMeta.files.map((file) => ({
        ...file,
        path: path.join(targetDir, file.name),
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
}
