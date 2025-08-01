import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import {
  DialogoiTreeItem,
  MetaYaml,
  hasCharacterProperty,
  isForeshadowingItem,
  CharacterItem,
  ForeshadowingItem,
} from '../utils/MetaYamlUtils.js';
import { ForeshadowingData } from './ForeshadowingService.js';
import * as path from 'path';

/**
 * ファイル管理操作の結果
 */
export interface FileManagementResult {
  success: boolean;
  message: string;
  error?: Error;
  updatedItems?: DialogoiTreeItem[];
}

/**
 * ファイル管理サービス
 * 管理対象外ファイルの追加、欠損ファイルの処理等を担当
 */
export class FileManagementService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

  /**
   * 管理対象外ファイルを管理対象に追加
   * @param absoluteFilePath 追加するファイルの絶対パス
   * @param fileType ファイル種別（content/setting）
   * @returns 処理結果
   */
  async addFileToManagement(
    absoluteFilePath: string,
    fileType: 'content' | 'setting' | 'subdirectory',
  ): Promise<FileManagementResult> {
    try {
      // ファイルの存在確認
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return {
          success: false,
          message: `ファイルが存在しません: ${absoluteFilePath}`,
        };
      }

      // ディレクトリパスを取得
      const directoryPath = path.dirname(absoluteFilePath);
      const fileName = path.basename(absoluteFilePath);

      // 既存のmeta.yamlを読み込み
      const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
      if (!metaYaml) {
        return {
          success: false,
          message: `管理ファイルが見つかりません: ${directoryPath}/.dialogoi-meta.yaml`,
        };
      }

      // 既に管理対象かチェック
      const existingEntry = metaYaml.files.find((file) => file.name === fileName);
      if (existingEntry) {
        return {
          success: false,
          message: `ファイルは既に管理対象です: ${fileName}`,
        };
      }

      // 新しいエントリを作成（型に応じて必須フィールドを設定）
      let newEntry: DialogoiTreeItem;

      if (fileType === 'subdirectory') {
        newEntry = {
          name: fileName,
          type: 'subdirectory',
          path: absoluteFilePath,
          isUntracked: false,
          isMissing: false,
        };
      } else if (fileType === 'content') {
        newEntry = {
          name: fileName,
          type: 'content',
          path: absoluteFilePath,
          hash: 'default-hash',
          tags: [],
          references: [],
          isUntracked: false,
          isMissing: false,
        };
      } else {
        // setting
        newEntry = {
          name: fileName,
          type: 'setting',
          path: absoluteFilePath,
          hash: 'default-hash',
          tags: [],
          isUntracked: false,
          isMissing: false,
        };
      }

      // meta.yamlに追加
      metaYaml.files.push(newEntry);

      // meta.yamlを保存
      await this.metaYamlService.saveMetaYamlAsync(directoryPath, metaYaml);

      return {
        success: true,
        message: `ファイルを管理対象に追加しました: ${fileName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル追加に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 欠損ファイルを管理対象から削除
   * @param absoluteFilePath 削除するファイルの絶対パス
   * @returns 処理結果
   */
  async removeFileFromManagement(absoluteFilePath: string): Promise<FileManagementResult> {
    try {
      // ディレクトリパスを取得
      const directoryPath = path.dirname(absoluteFilePath);
      const fileName = path.basename(absoluteFilePath);

      // 既存のmeta.yamlを読み込み
      const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
      if (!metaYaml) {
        return {
          success: false,
          message: `管理ファイルが見つかりません: ${directoryPath}/.dialogoi-meta.yaml`,
        };
      }

      // 対象ファイルを見つける
      const entryIndex = metaYaml.files.findIndex((file) => file.name === fileName);
      if (entryIndex === -1) {
        return {
          success: false,
          message: `ファイルは管理対象ではありません: ${fileName}`,
        };
      }

      // meta.yamlから削除
      metaYaml.files.splice(entryIndex, 1);

      // meta.yamlを保存
      await this.metaYamlService.saveMetaYamlAsync(directoryPath, metaYaml);

      return {
        success: true,
        message: `ファイルを管理対象から削除しました: ${fileName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル削除に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 欠損ファイルを作成
   * @param absoluteFilePath 作成するファイルの絶対パス
   * @param template ファイルテンプレート（省略時はデフォルト）
   * @returns 処理結果
   */
  async createMissingFile(
    absoluteFilePath: string,
    template?: string,
  ): Promise<FileManagementResult> {
    try {
      // ファイルの存在確認（既に存在する場合はエラー）
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      if (await this.fileRepository.existsAsync(fileUri)) {
        return {
          success: false,
          message: `ファイルは既に存在します: ${absoluteFilePath}`,
        };
      }

      // ディレクトリパスを取得して、ディレクトリが存在することを確認
      const directoryPath = path.dirname(absoluteFilePath);
      const directoryUri = this.fileRepository.createDirectoryUri(directoryPath);
      if (!(await this.fileRepository.existsAsync(directoryUri))) {
        return {
          success: false,
          message: `親ディレクトリが存在しません: ${directoryPath}`,
        };
      }

      // テンプレート内容を決定
      const content =
        template !== undefined && template !== ''
          ? template
          : this.generateDefaultContent(absoluteFilePath);

      // ファイルを作成
      await this.fileRepository.writeFileAsync(fileUri, content);

      return {
        success: true,
        message: `ファイルを作成しました: ${path.basename(absoluteFilePath)}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル作成に失敗しました: ${absoluteFilePath}`,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * デフォルトのファイル内容を生成
   * @param absoluteFilePath ファイルパス
   * @returns デフォルト内容
   */
  private generateDefaultContent(absoluteFilePath: string): string {
    const fileName = path.basename(absoluteFilePath);
    const extension = path.extname(absoluteFilePath);

    if (extension === '.md') {
      return `# ${fileName}\n\n<!-- このファイルの説明をここに記述してください -->\n`;
    } else if (extension === '.txt') {
      return `${fileName}\n\n（このファイルの内容をここに記述してください）\n`;
    } else {
      return `// ${fileName}\n\n`;
    }
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
  ): Promise<FileManagementResult> {
    try {
      // .dialogoi-meta.yamlを読み込み
      const meta = await this.metaYamlService.loadMetaYamlAsync(dirPath);
      if (meta === null) {
        return {
          success: false,
          message: '.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // .dialogoi-meta.yamlを保存
      const saveResult = await this.metaYamlService.saveMetaYamlAsync(dirPath, updatedMeta);
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

  /**
   * ファイルのキャラクター重要度を設定する
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param importance キャラクター重要度
   * @returns 処理結果
   */
  async setCharacterImportance(
    dirPath: string,
    fileName: string,
    importance: 'main' | 'sub' | 'background',
  ): Promise<FileManagementResult> {
    try {
      const result = await this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          // キャラクターファイルの場合のみ処理
          if (hasCharacterProperty(fileItem)) {
            fileItem.character.importance = importance;
          } else if (fileItem.type === 'setting') {
            // settingファイルをcharacterファイルに変換するため、新しいCharacterItemを作成
            const characterItem: CharacterItem = {
              ...fileItem,
              character: {
                importance: importance,
                multiple_characters: false,
                display_name: fileItem.name,
              },
            };
            meta.files[fileIndex] = characterItem;
          } else {
            throw new Error(`${fileName} はsettingファイルではありません。`);
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
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param multipleCharacters 複数キャラクターフラグ
   * @returns 処理結果
   */
  async setMultipleCharacters(
    dirPath: string,
    fileName: string,
    multipleCharacters: boolean,
  ): Promise<FileManagementResult> {
    try {
      const result = await this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          // キャラクターファイルの場合のみ処理
          if (hasCharacterProperty(fileItem)) {
            fileItem.character.multiple_characters = multipleCharacters;
          } else if (fileItem.type === 'setting') {
            // settingファイルをcharacterファイルに変換するため、新しいCharacterItemを作成
            const characterItem: CharacterItem = {
              ...fileItem,
              character: {
                importance: 'sub',
                multiple_characters: multipleCharacters,
                display_name: fileItem.name,
              },
            };
            meta.files[fileIndex] = characterItem;
          } else {
            throw new Error(`${fileName} はsettingファイルではありません。`);
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
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 処理結果
   */
  async removeCharacter(dirPath: string, fileName: string): Promise<FileManagementResult> {
    try {
      const result = await this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          // キャラクターファイルの場合のみ処理
          if (hasCharacterProperty(fileItem)) {
            // 型安全にcharacterプロパティを削除
            const { character, ...restItem } = fileItem;
            meta.files[fileIndex] = restItem;
          }
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
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @param foreshadowingData 伏線データ
   * @returns 処理結果
   */
  async setForeshadowing(
    dirPath: string,
    fileName: string,
    foreshadowingData: ForeshadowingData,
  ): Promise<FileManagementResult> {
    try {
      const result = await this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          // 伏線ファイルの場合のみ処理
          if (isForeshadowingItem(fileItem)) {
            fileItem.foreshadowing = {
              plants: foreshadowingData.plants,
              payoff: foreshadowingData.payoff,
            };
          } else if (fileItem.type === 'setting') {
            // settingファイルを伏線ファイルに変換
            const foreshadowingItem: ForeshadowingItem = {
              ...fileItem,
              foreshadowing: {
                plants: foreshadowingData.plants,
                payoff: foreshadowingData.payoff,
              },
            };
            meta.files[fileIndex] = foreshadowingItem;
          }
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
   * @param dirPath ディレクトリパス
   * @param fileName ファイル名
   * @returns 処理結果
   */
  async removeForeshadowing(dirPath: string, fileName: string): Promise<FileManagementResult> {
    try {
      const result = await this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === fileName);
        if (fileIndex === -1) {
          throw new Error(`.dialogoi-meta.yaml内にファイル ${fileName} が見つかりません。`);
        }

        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined) {
          // 伏線ファイルの場合のみ処理
          if (isForeshadowingItem(fileItem)) {
            // 型安全にforeshadowingプロパティを削除
            const { foreshadowing, ...restItem } = fileItem;
            meta.files[fileIndex] = restItem;
          }
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
}
