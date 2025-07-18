import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYamlUtils, DialogoiTreeItem, MetaYaml } from '../utils/MetaYamlUtils.js';
import { ForeshadowingData } from './ForeshadowingService.js';

/**
 * ファイル操作の結果を表すインターフェイス
 */
export interface FileOperationResult {
  success: boolean;
  message: string;
  updatedItems?: DialogoiTreeItem[];
}

/**
 * ファイル操作とメタデータ管理を組み合わせた高レベルな操作を提供するサービス
 */
export class FileOperationService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

  /**
   * 新しいファイルを作成し、.dialogoi-meta.yamlに追加する
   */
  createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
    subtype?: 'character' | 'foreshadowing' | 'glossary',
  ): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);
      const fileUri = this.fileRepository.createFileUri(filePath);

      // ファイルが既に存在する場合はエラー
      if (this.fileRepository.existsSync(fileUri)) {
        return {
          success: false,
          message: `ファイル ${fileName} は既に存在します。`,
        };
      }

      // ファイルを作成
      if (fileType === 'subdirectory') {
        this.fileRepository.mkdirSync(fileUri);

        // サブディレクトリにはデフォルトの.dialogoi-meta.yamlとREADME.mdを作成
        const defaultMeta = MetaYamlUtils.createMetaYaml('README.md');
        const defaultReadme = `# ${fileName}\n\n`;

        const metaYamlContent = MetaYamlUtils.stringifyMetaYaml(defaultMeta);
        this.fileRepository.writeFileSync(
          this.fileRepository.joinPath(fileUri, '.dialogoi-meta.yaml'),
          metaYamlContent,
        );
        this.fileRepository.writeFileSync(
          this.fileRepository.joinPath(fileUri, 'README.md'),
          defaultReadme,
        );
      } else {
        // ファイルタイプに応じて初期コンテンツを設定
        let content = initialContent;
        if (content === '') {
          if (fileType === 'content' && fileName.endsWith('.txt')) {
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `${baseName}\n\n`;
          } else if (fileType === 'setting' && fileName.endsWith('.md')) {
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `# ${baseName}\n\n`;
          }
        }
        this.fileRepository.writeFileSync(fileUri, content);
      }

      // .dialogoi-meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const newItem: DialogoiTreeItem = {
          name: fileName,
          type: fileType,
          path: filePath,
          tags: tags.length > 0 ? tags : undefined,
        };

        // サブタイプに応じてプロパティを設定
        if (subtype === 'character') {
          newItem.character = {
            importance: 'main',
            multiple_characters: false,
          };
        } else if (subtype === 'foreshadowing') {
          newItem.foreshadowing = {
            start: '',
            goal: '',
          };
        } else if (subtype === 'glossary') {
          newItem.glossary = true;
        }

        meta.files.push(newItem);
        return meta;
      });

      if (!result.success) {
        // .dialogoi-meta.yaml更新に失敗した場合は作成したファイルを削除
        if (this.fileRepository.existsSync(fileUri)) {
          if (fileType === 'subdirectory') {
            this.fileRepository.rmSync(fileUri, { recursive: true, force: true });
          } else {
            this.fileRepository.unlinkSync(fileUri);
          }
        }
        return result;
      }

      return {
        success: true,
        message: `${fileName} を作成しました。`,
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
   * ファイルを削除し、.dialogoi-meta.yamlから除去する
   */
  deleteFile(dirPath: string, fileName: string): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);
      const fileUri = this.fileRepository.createFileUri(filePath);

      // ファイルが存在しない場合はエラー
      if (!this.fileRepository.existsSync(fileUri)) {
        return {
          success: false,
          message: `ファイル ${fileName} が見つかりません。`,
        };
      }

      // .dialogoi-meta.yamlから削除
      const result = this.updateMetaYaml(dirPath, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== fileName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ファイルを削除
      const isDirectory = this.fileRepository.lstatSync(fileUri).isDirectory();
      if (isDirectory) {
        this.fileRepository.rmSync(fileUri, { recursive: true, force: true });
      } else {
        this.fileRepository.unlinkSync(fileUri);
      }

      return {
        success: true,
        message: `${fileName} を削除しました。`,
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
   * ファイルの順序を変更する
   */
  reorderFiles(dirPath: string, fromIndex: number, toIndex: number): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        if (
          fromIndex < 0 ||
          fromIndex >= meta.files.length ||
          toIndex < 0 ||
          toIndex >= meta.files.length
        ) {
          throw new Error('無効なインデックスです。');
        }

        // 配列要素を移動
        const [movedItem] = meta.files.splice(fromIndex, 1);
        if (movedItem !== undefined) {
          meta.files.splice(toIndex, 0, movedItem);
        }

        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: 'ファイルの順序を変更しました。',
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `並び替えエラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイル名を変更する
   */
  renameFile(dirPath: string, oldName: string, newName: string): FileOperationResult {
    try {
      const oldPath = path.join(dirPath, oldName);
      const newPath = path.join(dirPath, newName);
      const oldUri = this.fileRepository.createFileUri(oldPath);
      const newUri = this.fileRepository.createFileUri(newPath);

      // 元ファイルが存在しない場合はエラー
      if (!this.fileRepository.existsSync(oldUri)) {
        return {
          success: false,
          message: `ファイル ${oldName} が見つかりません。`,
        };
      }

      // 新しい名前のファイルが既に存在する場合はエラー
      if (this.fileRepository.existsSync(newUri)) {
        return {
          success: false,
          message: `ファイル ${newName} は既に存在します。`,
        };
      }

      // .dialogoi-meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === oldName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${oldName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          fileItem.name = newName;
          fileItem.path = newPath;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ファイルをリネーム
      this.fileRepository.renameSync(oldUri, newUri);

      return {
        success: true,
        message: `${oldName} を ${newName} にリネームしました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `リネームエラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルにタグを追加する
   */
  addTag(dirPath: string, fileName: string, tag: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.tags) {
            fileItem.tags = [];
          }
          if (!fileItem.tags.includes(tag)) {
            fileItem.tags.push(tag);
          } else {
            throw new Error(`タグ "${tag}" は既に存在します。`);
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} にタグ "${tag}" を追加しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルからタグを削除する
   */
  removeTag(dirPath: string, fileName: string, tag: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.tags || !fileItem.tags.includes(tag)) {
            throw new Error(`タグ "${tag}" が見つかりません。`);
          }
          fileItem.tags = fileItem.tags.filter((t) => t !== tag);
          if (fileItem.tags.length === 0) {
            fileItem.tags = undefined;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} からタグ "${tag}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルのタグを一括で設定する
   */
  setTags(dirPath: string, fileName: string, tags: string[]): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          const uniqueTags = [...new Set(tags)].sort();
          fileItem.tags = uniqueTags.length > 0 ? uniqueTags : undefined;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のタグを設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `タグ設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルに参照を追加する
   */
  addReference(dirPath: string, fileName: string, referencePath: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.references) {
            fileItem.references = [];
          }
          if (!fileItem.references.includes(referencePath)) {
            fileItem.references.push(referencePath);
          } else {
            throw new Error(`参照 "${referencePath}" は既に存在します。`);
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} に参照 "${referencePath}" を追加しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照追加エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルから参照を削除する
   */
  removeReference(dirPath: string, fileName: string, referencePath: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.references || !fileItem.references.includes(referencePath)) {
            throw new Error(`参照 "${referencePath}" が見つかりません。`);
          }
          fileItem.references = fileItem.references.filter((ref) => ref !== referencePath);
          if (fileItem.references.length === 0) {
            fileItem.references = undefined;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} から参照 "${referencePath}" を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの参照を一括で設定する
   */
  setReferences(dirPath: string, fileName: string, references: string[]): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          const uniqueReferences = [...new Set(references)];
          fileItem.references = uniqueReferences.length > 0 ? uniqueReferences : undefined;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の参照を設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `参照設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルのキャラクター重要度を設定する
   */
  setCharacterImportance(
    dirPath: string,
    fileName: string,
    importance: 'main' | 'sub' | 'background',
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.character) {
            fileItem.character = {
              importance: importance,
              multiple_characters: false,
            };
          } else {
            fileItem.character.importance = importance;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のキャラクター重要度を "${importance}" に設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `キャラクター重要度設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの複数キャラクターフラグを設定する
   */
  setMultipleCharacters(
    dirPath: string,
    fileName: string,
    multipleCharacters: boolean,
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          if (!fileItem.character) {
            fileItem.character = {
              importance: 'sub',
              multiple_characters: multipleCharacters,
            };
          } else {
            fileItem.character.multiple_characters = multipleCharacters;
          }
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の複数キャラクターフラグを "${multipleCharacters ? '有効' : '無効'}" に設定しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `複数キャラクターフラグ設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルのキャラクター設定を削除する
   */
  removeCharacter(dirPath: string, fileName: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          delete fileItem.character;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} のキャラクター設定を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `キャラクター設定削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの伏線設定を設定する
   */
  setForeshadowing(
    dirPath: string,
    fileName: string,
    foreshadowingData: ForeshadowingData,
  ): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          fileItem.foreshadowing = {
            start: foreshadowingData.start,
            goal: foreshadowingData.goal,
          };
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の伏線設定を更新しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `伏線設定エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルの伏線設定を削除する
   */
  removeForeshadowing(dirPath: string, fileName: string): FileOperationResult {
    try {
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          delete fileItem.foreshadowing;
        }
        return meta;
      });

      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `${fileName} の伏線設定を削除しました。`,
        updatedItems: result.updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `伏線設定削除エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ディレクトリを削除し、親ディレクトリの.dialogoi-meta.yamlから除去する
   */
  deleteDirectory(parentDir: string, dirName: string): FileOperationResult {
    try {
      const dirPath = path.join(parentDir, dirName);
      const dirUri = this.fileRepository.createFileUri(dirPath);

      // ディレクトリが存在しない場合はエラー
      if (!this.fileRepository.existsSync(dirUri)) {
        return {
          success: false,
          message: `ディレクトリ ${dirName} が見つかりません。`,
        };
      }

      // ディレクトリかどうかチェック
      const stats = this.fileRepository.lstatSync(dirUri);
      if (!stats.isDirectory()) {
        return {
          success: false,
          message: `${dirName} はディレクトリではありません。`,
        };
      }

      // 親ディレクトリの.dialogoi-meta.yamlから削除
      const result = this.updateMetaYaml(parentDir, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== dirName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ディレクトリを物理削除（再帰的）
      this.fileRepository.rmSync(dirUri, { recursive: true, force: true });

      return {
        success: true,
        message: `ディレクトリ ${dirName} を削除しました。`,
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
   * ディレクトリを異なる階層に移動する
   */
  moveDirectory(
    sourceParentDir: string,
    dirName: string,
    targetParentDir: string,
    newIndex?: number,
  ): FileOperationResult {
    try {
      const sourceDirPath = path.join(sourceParentDir, dirName);
      const targetDirPath = path.join(targetParentDir, dirName);
      const sourceDirUri = this.fileRepository.createFileUri(sourceDirPath);
      const targetDirUri = this.fileRepository.createFileUri(targetDirPath);

      // 移動元ディレクトリが存在しない場合はエラー
      if (!this.fileRepository.existsSync(sourceDirUri)) {
        return {
          success: false,
          message: `移動元ディレクトリ ${dirName} が見つかりません。`,
        };
      }

      // 移動元がディレクトリかどうかチェック
      const sourceStats = this.fileRepository.lstatSync(sourceDirUri);
      if (!sourceStats.isDirectory()) {
        return {
          success: false,
          message: `${dirName} はディレクトリではありません。`,
        };
      }

      // 移動先に同名ディレクトリが既に存在する場合はエラー
      if (this.fileRepository.existsSync(targetDirUri)) {
        return {
          success: false,
          message: `移動先に同名ディレクトリ ${dirName} が既に存在します。`,
        };
      }

      // 循環参照チェック（移動先が移動元の子孫でないことを確認）
      if (targetDirPath.startsWith(sourceDirPath + path.sep)) {
        return {
          success: false,
          message: 'ディレクトリを自分自身の子孫に移動することはできません。',
        };
      }

      // メタデータの更新（ロールバック対応のため、まずメタデータを更新）
      const moveResult = this.metaYamlService.moveDirectoryInMetadata(
        sourceParentDir,
        targetParentDir,
        dirName,
        newIndex,
      );
      if (!moveResult.success) {
        return moveResult;
      }

      try {
        // 物理ディレクトリの移動
        this.fileRepository.renameSync(sourceDirUri, targetDirUri);

        return {
          success: true,
          message: `ディレクトリ ${dirName} を ${sourceParentDir} から ${targetParentDir} に移動しました。`,
          updatedItems: moveResult.updatedItems,
        };
      } catch (physicalMoveError) {
        // 物理ディレクトリ移動に失敗した場合、メタデータをロールバック
        this.metaYamlService.moveDirectoryInMetadata(targetParentDir, sourceParentDir, dirName);

        return {
          success: false,
          message: `ディレクトリの物理移動に失敗しました: ${physicalMoveError instanceof Error ? physicalMoveError.message : String(physicalMoveError)}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `ディレクトリ移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ファイルを異なるディレクトリに移動する
   */
  moveFile(
    sourceDir: string,
    fileName: string,
    targetDir: string,
    newIndex?: number,
  ): FileOperationResult {
    try {
      const sourceFilePath = path.join(sourceDir, fileName);
      const targetFilePath = path.join(targetDir, fileName);
      const sourceUri = this.fileRepository.createFileUri(sourceFilePath);
      const targetUri = this.fileRepository.createFileUri(targetFilePath);

      // 移動元ファイルが存在しない場合はエラー
      if (!this.fileRepository.existsSync(sourceUri)) {
        return {
          success: false,
          message: `移動元ファイル ${fileName} が見つかりません。`,
        };
      }

      // 移動先に同名ファイルが既に存在する場合はエラー
      if (this.fileRepository.existsSync(targetUri)) {
        return {
          success: false,
          message: `移動先に同名ファイル ${fileName} が既に存在します。`,
        };
      }

      // 移動元のメタデータからアイテムを取得
      const sourceMeta = this.metaYamlService.loadMetaYaml(sourceDir);
      if (sourceMeta === null) {
        return {
          success: false,
          message: '移動元の.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

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

      // 移動先ディレクトリのメタデータを取得
      const targetMeta = this.metaYamlService.loadMetaYaml(targetDir);
      if (targetMeta === null) {
        return {
          success: false,
          message: '移動先の.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // メタデータの更新（ロールバック対応のため、まずメタデータを更新）
      const moveFileResult = this.metaYamlService.moveFileInMetadata(
        sourceDir,
        targetDir,
        fileName,
        newIndex,
      );
      if (!moveFileResult.success) {
        return moveFileResult;
      }

      try {
        // 物理ファイルの移動
        this.fileRepository.renameSync(sourceUri, targetUri);

        return {
          success: true,
          message: `${fileName} を ${sourceDir} から ${targetDir} に移動しました。`,
          updatedItems: moveFileResult.updatedItems,
        };
      } catch (physicalMoveError) {
        // 物理ファイル移動に失敗した場合、メタデータをロールバック
        this.metaYamlService.moveFileInMetadata(targetDir, sourceDir, fileName);

        return {
          success: false,
          message: `ファイルの物理移動に失敗しました: ${physicalMoveError instanceof Error ? physicalMoveError.message : String(physicalMoveError)}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `ファイル移動エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * .dialogoi-meta.yamlを更新する共通ロジック
   */
  private updateMetaYaml(
    dirPath: string,
    updateFunction: (meta: MetaYaml) => MetaYaml,
  ): FileOperationResult {
    try {
      // .dialogoi-meta.yamlを読み込み
      const meta = this.metaYamlService.loadMetaYaml(dirPath);
      if (meta === null) {
        return {
          success: false,
          message: '.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // .dialogoi-meta.yamlを保存
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, updatedMeta);
      if (!saveResult) {
        return {
          success: false,
          message: '.dialogoi-meta.yamlの保存に失敗しました。',
        };
      }

      // パスを更新したアイテムを返す
      const updatedItems = updatedMeta.files.map((file: DialogoiTreeItem) => ({
        ...file,
        path: path.join(dirPath, file.name),
      }));

      return {
        success: true,
        message: '.dialogoi-meta.yamlを更新しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `.dialogoi-meta.yaml更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
