import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MetaYamlUtils, DialogoiTreeItem, MetaYaml } from '../utils/MetaYamlUtils.js';

export interface FileOperationResult {
  success: boolean;
  message: string;
  updatedItems?: DialogoiTreeItem[];
}

export class FileOperationService {
  /**
   * 新しいファイルを作成し、meta.yamlに追加する
   */
  static createFile(
    dirPath: string,
    fileName: string,
    fileType: 'content' | 'setting' | 'subdirectory',
    initialContent: string = '',
    tags: string[] = [],
  ): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);

      // ファイルが既に存在する場合はエラー
      if (fs.existsSync(filePath)) {
        return {
          success: false,
          message: `ファイル ${fileName} は既に存在します。`,
        };
      }

      // ファイルを作成
      if (fileType === 'subdirectory') {
        fs.mkdirSync(filePath);

        // サブディレクトリにはデフォルトのmeta.yamlとREADME.mdを作成
        const defaultMetaYaml = `readme: README.md\nfiles: []\n`;
        const defaultReadme = `# ${fileName}\n\n`;

        fs.writeFileSync(path.join(filePath, 'meta.yaml'), defaultMetaYaml);
        fs.writeFileSync(path.join(filePath, 'README.md'), defaultReadme);
      } else {
        // ファイルタイプに応じて初期コンテンツを設定
        let content = initialContent;
        if (content === '') {
          if (fileType === 'content' && fileName.endsWith('.txt')) {
            // 拡張子を除いたベース名を取得
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `${baseName}\n\n`;
          } else if (fileType === 'setting' && fileName.endsWith('.md')) {
            // 拡張子を除いたベース名を取得
            const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
            content = `# ${baseName}\n\n`;
          }
        }
        fs.writeFileSync(filePath, content);
      }

      // meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const newItem: DialogoiTreeItem = {
          name: fileName,
          type: fileType,
          path: filePath,
          tags: tags.length > 0 ? tags : undefined,
        };

        meta.files.push(newItem);
        return meta;
      });

      if (!result.success) {
        // meta.yaml更新に失敗した場合は作成したファイルを削除
        if (fs.existsSync(filePath)) {
          if (fileType === 'subdirectory') {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
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
   * ファイルを削除し、meta.yamlから除去する
   */
  static deleteFile(dirPath: string, fileName: string): FileOperationResult {
    try {
      const filePath = path.join(dirPath, fileName);

      // ファイルが存在しない場合はエラー
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: `ファイル ${fileName} が見つかりません。`,
        };
      }

      // meta.yamlから削除
      const result = this.updateMetaYaml(dirPath, (meta) => {
        meta.files = meta.files.filter((file) => file.name !== fileName);
        return meta;
      });

      if (!result.success) {
        return result;
      }

      // ファイルを削除
      const isDirectory = fs.lstatSync(filePath).isDirectory();
      if (isDirectory) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
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
  static reorderFiles(dirPath: string, fromIndex: number, toIndex: number): FileOperationResult {
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
  static renameFile(dirPath: string, oldName: string, newName: string): FileOperationResult {
    try {
      const oldPath = path.join(dirPath, oldName);
      const newPath = path.join(dirPath, newName);

      // 元ファイルが存在しない場合はエラー
      if (!fs.existsSync(oldPath)) {
        return {
          success: false,
          message: `ファイル ${oldName} が見つかりません。`,
        };
      }

      // 新しい名前のファイルが既に存在する場合はエラー
      if (fs.existsSync(newPath)) {
        return {
          success: false,
          message: `ファイル ${newName} は既に存在します。`,
        };
      }

      // meta.yamlを更新
      const result = this.updateMetaYaml(dirPath, (meta) => {
        const fileIndex = meta.files.findIndex((file) => file.name === oldName);
        if (fileIndex === -1) {
          throw new Error(`meta.yaml内にファイル ${oldName} が見つかりません。`);
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
      fs.renameSync(oldPath, newPath);

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
   * meta.yamlを更新する共通メソッド
   */
  private static updateMetaYaml(
    dirPath: string,
    updateFunction: (meta: MetaYaml) => MetaYaml,
  ): FileOperationResult {
    try {
      const metaPath = path.join(dirPath, 'meta.yaml');

      // meta.yamlを読み込み
      const meta = MetaYamlUtils.loadMetaYaml(dirPath);
      if (meta === null) {
        return {
          success: false,
          message: 'meta.yamlが見つからないか、読み込みに失敗しました。',
        };
      }

      // 更新を実行
      const updatedMeta = updateFunction(meta);

      // バリデーション
      const validationErrors = MetaYamlUtils.validateMetaYaml(updatedMeta);
      if (validationErrors.length > 0) {
        return {
          success: false,
          message: `meta.yaml検証エラー: ${validationErrors.join(', ')}`,
        };
      }

      // meta.yamlを保存
      const yamlContent = yaml.dump(updatedMeta, {
        flowLevel: -1,
        lineWidth: -1,
      });
      fs.writeFileSync(metaPath, yamlContent);

      // パスを更新したアイテムを返す
      const updatedItems = updatedMeta.files.map((file) => ({
        ...file,
        path: path.join(dirPath, file.name),
      }));

      return {
        success: true,
        message: 'meta.yamlを更新しました。',
        updatedItems,
      };
    } catch (error) {
      return {
        success: false,
        message: `meta.yaml更新エラー: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
