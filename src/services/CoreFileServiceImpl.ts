import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';
import { ProjectLinkUpdateService } from './ProjectLinkUpdateService.js';
import { CoreFileService, FileOperationResult } from './CoreFileService.js';

/**
 * 基本ファイル・ディレクトリ操作を担当するコアサービスの実装
 * ファイルシステム操作とメタデータ更新を組み合わせた複合操作を提供
 */
export class CoreFileServiceImpl implements CoreFileService {
  private novelRootPath?: string;

  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private linkUpdateService?: ProjectLinkUpdateService,
    novelRootAbsolutePath?: string,
  ) {
    this.novelRootPath = novelRootAbsolutePath;
  }

  /**
   * ノベルルートパスを取得
   * @returns ノベルルートの絶対パス（設定されていない場合はundefined）
   */
  getNovelRootPath(): string | undefined {
    return this.novelRootPath;
  }

  /**
   * 絶対パスを確保する
   * @param inputPath 入力パス
   * @returns 絶対パス
   */
  private ensureAbsolutePath(inputPath: string): string {
    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }

    if (
      this.novelRootPath !== undefined &&
      this.novelRootPath !== null &&
      this.novelRootPath !== ''
    ) {
      return path.join(this.novelRootPath, inputPath);
    }

    throw new Error('相対パスが指定されましたが、ノベルルートパスが設定されていません。');
  }

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
  async createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
    subtype?: 'character' | 'foreshadowing' | 'glossary',
  ): Promise<FileOperationResult> {
    try {
      const absoluteDirPath = this.ensureAbsolutePath(dirPath);
      const absoluteFilePath = path.join(absoluteDirPath, fileName);

      // ファイルが既に存在するかチェック
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (await this.fileRepository.existsAsync(fileUri)) {
        return {
          success: false,
          message: `ファイル "${fileName}" は既に存在します。`,
        };
      }

      // サブディレクトリの場合はディレクトリを作成
      if (fileType === 'subdirectory') {
        await this.fileRepository.createDirectoryAsync(fileUri);

        // 新しく作成されたサブディレクトリ用の空のメタデータファイルを作成
        const emptyMeta: MetaYaml = {
          files: [],
        };
        await this.metaYamlService.saveMetaYamlAsync(absoluteFilePath, emptyMeta);
      } else {
        // ファイルを作成
        await this.fileRepository.writeFileAsync(fileUri, initialContent);
      }

      // メタデータを更新
      const result = await this.updateMetaYaml(absoluteDirPath, (meta) => {
        let newItem: DialogoiTreeItem;

        if (fileType === 'subdirectory') {
          newItem = {
            name: fileName,
            type: 'subdirectory',
            path: absoluteFilePath,
            isUntracked: false,
            isMissing: false,
          };
        } else if (fileType === 'content') {
          newItem = {
            name: fileName,
            type: 'content',
            path: absoluteFilePath,
            hash: 'default-hash',
            tags: tags,
            references: [],
            isUntracked: false,
            isMissing: false,
          };
        } else {
          // setting type
          if (subtype === 'character') {
            newItem = {
              name: fileName,
              type: 'setting',
              path: absoluteFilePath,
              hash: 'default-hash',
              tags: tags,
              isUntracked: false,
              isMissing: false,
              character: {
                importance: 'sub',
                multiple_characters: false,
                display_name: fileName,
              },
            };
          } else {
            newItem = {
              name: fileName,
              type: 'setting',
              path: absoluteFilePath,
              hash: 'default-hash',
              tags: tags,
              isUntracked: false,
              isMissing: false,
            };
          }
        }

        meta.files.push(newItem);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileType === 'subdirectory' ? 'ディレクトリ' : 'ファイル'} "${fileName}" を作成しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル作成エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルを削除する
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 処理結果
   */
  async deleteFile(dirPath: string, fileName: string): Promise<FileOperationResult> {
    try {
      const absoluteDirPath = this.ensureAbsolutePath(dirPath);
      const absoluteFilePath = path.join(absoluteDirPath, fileName);

      // ファイルの存在確認
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return {
          success: false,
          message: `ファイル "${fileName}" が見つかりません。`,
        };
      }

      // ファイルを削除
      await this.fileRepository.unlinkAsync(fileUri);

      // メタデータを更新
      const result = await this.updateMetaYaml(absoluteDirPath, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== fileName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `ファイル "${fileName}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイル名を変更する
   * @param dirPath ディレクトリパス
   * @param oldName 現在のファイル名
   * @param newName 新しいファイル名
   * @returns 処理結果
   */
  async renameFile(
    dirPath: string,
    oldName: string,
    newName: string,
  ): Promise<FileOperationResult> {
    try {
      const absoluteDirPath = this.ensureAbsolutePath(dirPath);
      const oldAbsolutePath = path.join(absoluteDirPath, oldName);
      const newAbsolutePath = path.join(absoluteDirPath, newName);

      // 旧ファイルの存在確認
      const oldFileUri = this.fileRepository.createFileUri(oldAbsolutePath);
      if (!(await this.fileRepository.existsAsync(oldFileUri))) {
        return {
          success: false,
          message: `ファイル "${oldName}" が見つかりません。`,
        };
      }

      // 新ファイル名の重複確認
      const newFileUri = this.fileRepository.createFileUri(newAbsolutePath);
      if (await this.fileRepository.existsAsync(newFileUri)) {
        return {
          success: false,
          message: `ファイル名 "${newName}" は既に使用されています。`,
        };
      }

      // ファイル名を変更
      await this.fileRepository.renameAsync(oldFileUri, newFileUri);

      // コメントファイルもリネーム
      await this.renameCommentFileIfExists(oldName, newName, absoluteDirPath);

      // リンク更新
      if (this.linkUpdateService) {
        await this.linkUpdateService.updateLinksAfterFileOperation(
          oldAbsolutePath,
          newAbsolutePath,
        );
      }

      // メタデータを更新
      const result = await this.updateMetaYaml(absoluteDirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === oldName);
        if (fileIndex !== -1) {
          const fileItem = meta.files[fileIndex];
          if (fileItem) {
            fileItem.name = newName;
            fileItem.path = newAbsolutePath;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `ファイル名を "${oldName}" から "${newName}" に変更しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル名変更エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの順序を変更する
   * @param dirPath ディレクトリパス
   * @param fromIndex 移動元インデックス
   * @param toIndex 移動先インデックス
   * @returns 処理結果
   */
  async reorderFiles(
    dirPath: string,
    fromIndex: number,
    toIndex: number,
  ): Promise<FileOperationResult> {
    try {
      const absoluteDirPath = this.ensureAbsolutePath(dirPath);

      const result = await this.updateMetaYaml(absoluteDirPath, (meta) => {
        if (
          fromIndex < 0 ||
          fromIndex >= meta.files.length ||
          toIndex < 0 ||
          toIndex >= meta.files.length
        ) {
          throw new Error('無効なインデックスが指定されました。');
        }

        const [movedItem] = meta.files.splice(fromIndex, 1);
        if (movedItem) {
          meta.files.splice(toIndex, 0, movedItem);
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `ファイルの順序を変更しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル順序変更エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルを移動する
   * @param sourceDir 移動元ディレクトリ
   * @param fileName ファイル名
   * @param targetDir 移動先ディレクトリ
   * @param newIndex 新しいインデックス
   * @returns 処理結果
   */
  async moveFile(
    sourceDir: string,
    fileName: string,
    targetDir: string,
    newIndex?: number,
  ): Promise<FileOperationResult> {
    try {
      const sourceAbsoluteDir = this.ensureAbsolutePath(sourceDir);
      const targetAbsoluteDir = this.ensureAbsolutePath(targetDir);
      const sourceFilePath = path.join(sourceAbsoluteDir, fileName);
      const targetFilePath = path.join(targetAbsoluteDir, fileName);

      // 同じディレクトリ内での移動（順序変更のみ）
      if (sourceAbsoluteDir === targetAbsoluteDir) {
        if (newIndex !== undefined) {
          const sourceMeta = await this.metaYamlService.loadMetaYamlAsync(sourceAbsoluteDir);
          if (!sourceMeta) {
            return {
              success: false,
              message: 'メタデータファイルが見つかりません。',
            };
          }

          const fromIndex = sourceMeta.files.findIndex((file) => file.name === fileName);
          if (fromIndex === -1) {
            return {
              success: false,
              message: `ファイル "${fileName}" がメタデータに見つかりません。`,
            };
          }

          return await this.reorderFiles(sourceDir, fromIndex, newIndex);
        }
        return {
          success: true,
          message: '同じディレクトリ内での移動です。',
        };
      }

      // ファイルの存在確認
      const sourceFileUri = this.fileRepository.createFileUri(sourceFilePath);
      if (!(await this.fileRepository.existsAsync(sourceFileUri))) {
        return {
          success: false,
          message: `ファイル "${fileName}" が見つかりません。`,
        };
      }

      // 移動先での重複確認
      const targetFileUri = this.fileRepository.createFileUri(targetFilePath);
      if (await this.fileRepository.existsAsync(targetFileUri)) {
        return {
          success: false,
          message: `移動先に同名のファイル "${fileName}" が既に存在します。`,
        };
      }

      // ファイルを物理的に移動
      await this.fileRepository.renameAsync(sourceFileUri, targetFileUri);

      // コメントファイルも移動
      await this.moveCommentFileIfExists(fileName, sourceAbsoluteDir, targetAbsoluteDir);

      // リンク更新
      if (this.linkUpdateService) {
        await this.linkUpdateService.updateLinksAfterFileOperation(sourceFilePath, targetFilePath);
      }

      // 移動元のメタデータからファイル情報を取得し削除
      let originalItem: DialogoiTreeItem | undefined;
      const sourceResult = await this.updateMetaYaml(sourceAbsoluteDir, (meta) => {
        const itemIndex = meta.files.findIndex((file) => file.name === fileName);
        if (itemIndex !== -1) {
          originalItem = meta.files[itemIndex];
          meta.files.splice(itemIndex, 1);
        }
        return meta;
      });

      if (!sourceResult.success) {
        return sourceResult;
      }

      if (!originalItem) {
        return {
          success: false,
          message: `移動元のメタデータで "${fileName}" が見つかりませんでした。`,
        };
      }

      // 移動先のメタデータにファイルを追加（元の情報を保持）
      const targetResult = await this.updateMetaYaml(targetAbsoluteDir, (meta) => {
        if (!originalItem) {
          throw new Error('originalItemが見つかりません');
        }
        const newItem: DialogoiTreeItem = {
          ...originalItem,
          path: targetFilePath, // パスのみ更新
        };

        if (newIndex !== undefined && newIndex <= meta.files.length) {
          meta.files.splice(newIndex, 0, newItem);
        } else {
          meta.files.push(newItem);
        }
        return meta;
      });

      if (!targetResult.success) {
        return targetResult;
      }

      return {
        success: true,
        message: `ファイル "${fileName}" を移動しました。`,
        updatedItems: targetResult.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ディレクトリを移動する
   * @param sourceParentDir 移動元の親ディレクトリ
   * @param dirName ディレクトリ名
   * @param targetParentDir 移動先の親ディレクトリ
   * @param newIndex 新しいインデックス
   * @returns 処理結果
   */
  async moveDirectory(
    sourceParentDir: string,
    dirName: string,
    targetParentDir: string,
    newIndex?: number,
  ): Promise<FileOperationResult> {
    try {
      const sourceParentAbsolute = this.ensureAbsolutePath(sourceParentDir);
      const targetParentAbsolute = this.ensureAbsolutePath(targetParentDir);
      const sourceDirPath = path.join(sourceParentAbsolute, dirName);
      const targetDirPath = path.join(targetParentAbsolute, dirName);

      // ディレクトリの存在確認
      const sourceDirUri = this.fileRepository.createDirectoryUri(sourceDirPath);
      if (!(await this.fileRepository.existsAsync(sourceDirUri))) {
        return {
          success: false,
          message: `ディレクトリ "${dirName}" が見つかりません。`,
        };
      }

      // 移動先での重複確認
      const targetDirUri = this.fileRepository.createDirectoryUri(targetDirPath);
      if (await this.fileRepository.existsAsync(targetDirUri)) {
        return {
          success: false,
          message: `移動先に同名のディレクトリ "${dirName}" が既に存在します。`,
        };
      }

      // ディレクトリを物理的に移動
      await this.fileRepository.renameAsync(sourceDirUri, targetDirUri);

      // リンク更新
      if (this.linkUpdateService) {
        await this.updateLinksForDirectoryMove(sourceDirPath, targetDirPath);
      }

      // 移動元のメタデータからディレクトリ情報を取得し削除
      let originalItem: DialogoiTreeItem | undefined;
      const sourceResult = await this.updateMetaYaml(sourceParentAbsolute, (meta) => {
        const itemIndex = meta.files.findIndex((file) => file.name === dirName);
        if (itemIndex !== -1) {
          originalItem = meta.files[itemIndex];
          meta.files.splice(itemIndex, 1);
        }
        return meta;
      });

      if (!sourceResult.success) {
        return sourceResult;
      }

      if (!originalItem) {
        return {
          success: false,
          message: `移動元のメタデータで "${dirName}" が見つかりませんでした。`,
        };
      }

      // 移動先のメタデータにディレクトリを追加（元の情報を保持）
      const targetResult = await this.updateMetaYaml(targetParentAbsolute, (meta) => {
        if (!originalItem) {
          throw new Error('originalItemが見つかりません');
        }
        const newItem: DialogoiTreeItem = {
          ...originalItem,
          path: targetDirPath, // パスのみ更新
        };

        if (newIndex !== undefined && newIndex <= meta.files.length) {
          meta.files.splice(newIndex, 0, newItem);
        } else {
          meta.files.push(newItem);
        }
        return meta;
      });

      if (!targetResult.success) {
        return targetResult;
      }

      return {
        success: true,
        message: `ディレクトリ "${dirName}" を移動しました。`,
        updatedItems: targetResult.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ディレクトリ移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ディレクトリを削除する
   * @param parentDir 親ディレクトリ
   * @param dirName ディレクトリ名
   * @returns 処理結果
   */
  async deleteDirectory(parentDir: string, dirName: string): Promise<FileOperationResult> {
    try {
      const parentAbsolutePath = this.ensureAbsolutePath(parentDir);
      const dirAbsolutePath = path.join(parentAbsolutePath, dirName);

      // ディレクトリの存在確認
      const dirUri = this.fileRepository.createDirectoryUri(dirAbsolutePath);
      if (!(await this.fileRepository.existsAsync(dirUri))) {
        return {
          success: false,
          message: `ディレクトリ "${dirName}" が見つかりません。`,
        };
      }

      // ディレクトリを削除（再帰的）
      await this.fileRepository.rmAsync(dirUri, { recursive: true });

      // メタデータを更新
      const result = await this.updateMetaYaml(parentAbsolutePath, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== dirName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `ディレクトリ "${dirName}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `ディレクトリ削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 【低レベルAPI】ファイルを読み込む
   *
   * ⚠️ 注意: このメソッドは純粋なファイル読み込みのみを行います
   * - メタデータの更新は行いません
   * - Dialogoiプロジェクト管理とは独立した操作です
   * - 通常は createFile() を使用してください
   *
   * @param filePath ファイルパス
   * @param encoding エンコーディング
   * @returns ファイル内容
   */
  async readFile(filePath: string, encoding: 'utf8' = 'utf8'): Promise<string> {
    const absolutePath = this.ensureAbsolutePath(filePath);
    const fileUri = this.fileRepository.createFileUri(absolutePath);
    return this.fileRepository.readFileAsync(fileUri, encoding);
  }

  /**
   * 【低レベルAPI】ファイルに書き込む
   *
   * ⚠️ 注意: このメソッドは純粋なファイル書き込みのみを行います
   * - メタデータの更新は行いません
   * - Dialogoiプロジェクト管理とは独立した操作です
   * - 新規ファイル作成時は createFile() を使用してください
   * - このメソッドは既存ファイルの内容更新にのみ使用してください
   *
   * @param filePath ファイルパス
   * @param content 内容
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const absolutePath = this.ensureAbsolutePath(filePath);
    const fileUri = this.fileRepository.createFileUri(absolutePath);
    await this.fileRepository.writeFileAsync(fileUri, content);
  }

  /**
   * 【低レベルAPI】ファイルの存在確認
   *
   * ⚠️ 注意: このメソッドは純粋なファイル存在確認のみを行います
   * - メタデータの確認は行いません
   * - Dialogoiプロジェクト管理とは独立した操作です
   *
   * @param filePath ファイルパス
   * @returns 存在する場合true
   */
  async exists(filePath: string): Promise<boolean> {
    const absolutePath = this.ensureAbsolutePath(filePath);
    const fileUri = this.fileRepository.createFileUri(absolutePath);
    return this.fileRepository.existsAsync(fileUri);
  }

  /**
   * メタデータを更新する汎用メソッド
   * @param dirPath ディレクトリパス
   * @param updateFunction 更新関数
   * @returns 処理結果
   */
  private async updateMetaYaml(
    dirPath: string,
    updateFunction: (meta: MetaYaml) => MetaYaml,
  ): Promise<FileOperationResult> {
    try {
      // メタデータファイルを読み込み
      const meta = await this.metaYamlService.loadMetaYamlAsync(dirPath);
      if (meta === null) {
        return {
          success: false,
          message: 'メタデータファイルが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // メタデータファイルを保存
      const saveResult = await this.metaYamlService.saveMetaYamlAsync(dirPath, updatedMeta);
      if (!saveResult) {
        return {
          success: false,
          message: 'メタデータファイルの保存に失敗しました。',
        };
      }

      // パスを更新したアイテムを返す
      const updatedItems = updatedMeta.files.map((file: DialogoiTreeItem) => ({
        ...file,
        path: path.join(dirPath, file.name),
      }));

      return {
        success: true,
        message: 'メタデータファイルを更新しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `メタデータファイル更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ディレクトリ移動時のリンク更新
   * @param oldDirPath 旧ディレクトリパス
   * @param newDirPath 新ディレクトリパス
   */
  private async updateLinksForDirectoryMove(oldDirPath: string, newDirPath: string): Promise<void> {
    if (!this.linkUpdateService) {
      return;
    }

    await this.walkDirectoryForLinkUpdate(oldDirPath, newDirPath, oldDirPath, newDirPath);
  }

  /**
   * ディレクトリ内を再帰的に歩いてリンク更新
   * @param currentOldDirPath 現在の旧ディレクトリパス
   * @param currentNewDirPath 現在の新ディレクトリパス
   * @param rootOldDirPath ルート旧ディレクトリパス
   * @param rootNewDirPath ルート新ディレクトリパス
   */
  private async walkDirectoryForLinkUpdate(
    currentOldDirPath: string,
    currentNewDirPath: string,
    rootOldDirPath: string,
    rootNewDirPath: string,
  ): Promise<void> {
    if (!this.linkUpdateService) {
      return;
    }

    try {
      const currentNewDirUri = this.fileRepository.createDirectoryUri(currentNewDirPath);
      const entries = await this.fileRepository.readdirAsync(currentNewDirUri);

      for (const entry of entries) {
        const oldItemPath = path.join(currentOldDirPath, entry.name);
        const newItemPath = path.join(currentNewDirPath, entry.name);

        if (entry.isDirectory()) {
          await this.walkDirectoryForLinkUpdate(
            oldItemPath,
            newItemPath,
            rootOldDirPath,
            rootNewDirPath,
          );
        } else if (entry.isFile()) {
          await this.linkUpdateService.updateLinksAfterFileOperation(oldItemPath, newItemPath);
        }
      }
    } catch (error) {
      // ディレクトリの読み込みに失敗した場合は続行
      console.warn(`ディレクトリの読み込みに失敗: ${currentNewDirPath}`, error);
    }
  }

  /**
   * コメントファイルを移動（存在する場合）
   * @param fileName ファイル名
   * @param sourceDir 移動元ディレクトリ
   * @param targetDir 移動先ディレクトリ
   */
  private async moveCommentFileIfExists(
    fileName: string,
    sourceDir: string,
    targetDir: string,
  ): Promise<void> {
    try {
      const commentFileName = `.${fileName}.comments.yaml`;
      const sourceCommentPath = path.join(sourceDir, commentFileName);
      const targetCommentPath = path.join(targetDir, commentFileName);

      const sourceCommentUri = this.fileRepository.createFileUri(sourceCommentPath);
      if (await this.fileRepository.existsAsync(sourceCommentUri)) {
        const targetCommentUri = this.fileRepository.createFileUri(targetCommentPath);
        await this.fileRepository.renameAsync(sourceCommentUri, targetCommentUri);
      }
    } catch (error) {
      // コメントファイル移動失敗は警告のみ
      console.warn(`コメントファイルの移動に失敗: ${fileName}`, error);
    }
  }

  /**
   * コメントファイルをリネーム（存在する場合）
   * @param oldFileName 旧ファイル名
   * @param newFileName 新ファイル名
   * @param dirPath ディレクトリパス
   */
  private async renameCommentFileIfExists(
    oldFileName: string,
    newFileName: string,
    dirPath: string,
  ): Promise<void> {
    try {
      const oldCommentFileName = `.${oldFileName}.comments.yaml`;
      const newCommentFileName = `.${newFileName}.comments.yaml`;
      const oldCommentPath = path.join(dirPath, oldCommentFileName);
      const newCommentPath = path.join(dirPath, newCommentFileName);

      const oldCommentUri = this.fileRepository.createFileUri(oldCommentPath);
      if (await this.fileRepository.existsAsync(oldCommentUri)) {
        const newCommentUri = this.fileRepository.createFileUri(newCommentPath);
        await this.fileRepository.renameAsync(oldCommentUri, newCommentUri);
      }
    } catch (error) {
      // コメントファイルリネーム失敗は警告のみ
      console.warn(`コメントファイルのリネームに失敗: ${oldFileName} -> ${newFileName}`, error);
    }
  }
}
