import * as path from 'path';
import { Logger } from '../utils/Logger.js';
import { CharacterService } from './CharacterService.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { FileChangeNotificationService } from './FileChangeNotificationService.js';
import { ReferenceManager } from './ReferenceManager.js';

/**
 * ドロップされたファイル情報
 */
export interface DroppedFileInfo {
  type: 'dialogoi-file';
  path: string; // プロジェクトルート相対パス
  name: string; // ファイル名
  fileType: 'content' | 'setting' | 'subdirectory';
  absolutePath: string; // 絶対パス
}

/**
 * ドロップ処理の結果
 */
export interface DropResult {
  success: boolean;
  message: string;
  insertText?: string; // 設定ファイル用：挿入するテキスト
  insertPosition?: {
    // 設定ファイル用：挿入位置（相対）
    line: number;
    character: number;
  };
}

/**
 * ドラッグ&ドロップ処理のビジネスロジック（VSCode非依存）
 */
export class DropHandlerService {
  private logger = Logger.getInstance();
  private fileChangeNotificationService = FileChangeNotificationService.getInstance();

  constructor(
    private characterService: CharacterService,
    private metaYamlService: MetaYamlService,
    private dialogoiYamlService: DialogoiYamlService,
  ) {}

  /**
   * ドロップ処理のメイン関数
   */
  public async handleDrop(
    targetFileAbsolutePath: string,
    droppedData: DroppedFileInfo,
  ): Promise<DropResult> {
    this.logger.info(
      `ドロップ処理: ${droppedData.name} → ${path.basename(targetFileAbsolutePath)}`,
    );

    try {
      // ドロップ先ファイルの種別を判定
      const targetFileType = await this.determineTargetFileType(targetFileAbsolutePath);
      if (!targetFileType) {
        return {
          success: false,
          message: 'ドロップ先のファイルがDialogoiプロジェクトのファイルではありません。',
        };
      }

      if (targetFileType === 'content') {
        // 本文ファイル: referencesに追加
        return await this.handleDropToContentFile(targetFileAbsolutePath, droppedData);
      } else if (targetFileType === 'setting') {
        // 設定ファイル: マークダウンリンク挿入
        return await this.handleDropToSettingFile(targetFileAbsolutePath, droppedData);
      } else {
        return {
          success: false,
          message: 'サブディレクトリへのドロップはサポートされていません。',
        };
      }
    } catch (error) {
      this.logger.error('ドロップ処理エラー', error instanceof Error ? error : String(error));
      return {
        success: false,
        message: `ドロップ処理に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * ドロップ先ファイルの種別を判定
   */
  private async determineTargetFileType(
    targetFileAbsolutePath: string,
  ): Promise<'content' | 'setting' | null> {
    // プロジェクトルートを取得
    const projectRootAbsolutePath =
      await this.dialogoiYamlService.findProjectRootAsync(targetFileAbsolutePath);
    if (projectRootAbsolutePath === null || projectRootAbsolutePath === undefined) {
      return null;
    }

    // プロジェクト相対パスに変換
    const fileProjectRelativePath = this.getRelativePathFromProject(
      targetFileAbsolutePath,
      projectRootAbsolutePath,
    );
    if (fileProjectRelativePath === null || fileProjectRelativePath === undefined) {
      return null;
    }

    // CharacterServiceを使用してファイル種別を判定
    const fileInfo = await this.characterService.getFileInfo(
      fileProjectRelativePath,
      projectRootAbsolutePath,
    );
    if (!fileInfo) {
      return null;
    }

    return fileInfo.type === 'content' ? 'content' : 'setting';
  }

  /**
   * 本文ファイルへのドロップ処理（references追加）
   */
  private async handleDropToContentFile(
    targetFileAbsolutePath: string,
    droppedData: DroppedFileInfo,
  ): Promise<DropResult> {
    // プロジェクトルートを取得
    const projectRootAbsolutePath =
      await this.dialogoiYamlService.findProjectRootAsync(targetFileAbsolutePath);
    if (projectRootAbsolutePath === null || projectRootAbsolutePath === undefined) {
      return {
        success: false,
        message: 'プロジェクトルートが見つかりません。',
      };
    }

    // ドロップ先ファイルのディレクトリとファイル名を取得
    const targetDirAbsolutePath = path.dirname(targetFileAbsolutePath);
    const targetFileName = path.basename(targetFileAbsolutePath);

    // ドロップされたファイルのパスは既にプロジェクト相対パスなのでそのまま使用
    const droppedFileProjectRelativePath = droppedData.path;

    if (droppedFileProjectRelativePath === null || droppedFileProjectRelativePath === undefined) {
      return {
        success: false,
        message: '参照パスの正規化に失敗しました。',
      };
    }

    // meta.yamlのreferencesに追加
    const meta = await this.metaYamlService.loadMetaYamlAsync(targetDirAbsolutePath);
    if (!meta) {
      return {
        success: false,
        message: 'meta.yamlファイルが見つかりません。',
      };
    }

    const fileItem = meta.files.find((item) => item.name === targetFileName);
    if (!fileItem) {
      return {
        success: false,
        message: `ファイル "${targetFileName}" がmeta.yamlに見つかりません。`,
      };
    }

    // 重複チェック
    const existingReferences = fileItem.references || [];
    if (existingReferences.includes(droppedFileProjectRelativePath)) {
      return {
        success: true,
        message: `参照 "${droppedFileProjectRelativePath}" は既に存在します。`,
      };
    }

    // 参照を追加
    fileItem.references = [...existingReferences, droppedFileProjectRelativePath];

    // meta.yamlを保存
    const success = await this.metaYamlService.saveMetaYamlAsync(targetDirAbsolutePath, meta);
    if (success === true) {
      // ReferenceManagerを更新
      const referenceManager = ReferenceManager.getInstance();
      const updatedReferences = fileItem.references ?? [];
      referenceManager.updateFileReferences(targetFileAbsolutePath, updatedReferences);

      // 参照更新イベントを通知
      this.fileChangeNotificationService.notifyReferenceUpdated(targetFileAbsolutePath, {
        operation: 'add',
        reference: droppedFileProjectRelativePath,
        fileName: targetFileName,
        source: 'drag_and_drop',
      });

      return {
        success: true,
        message: `参照 "${droppedData.name}" を追加しました。`,
      };
    } else {
      return {
        success: false,
        message: 'meta.yamlの保存に失敗しました。',
      };
    }
  }

  /**
   * 設定ファイルへのドロップ処理（マークダウンリンク挿入）
   */
  private async handleDropToSettingFile(
    targetFileAbsolutePath: string,
    droppedData: DroppedFileInfo,
  ): Promise<DropResult> {
    // プロジェクトルートを取得
    const projectRootAbsolutePath =
      await this.dialogoiYamlService.findProjectRootAsync(targetFileAbsolutePath);
    if (projectRootAbsolutePath === null || projectRootAbsolutePath === undefined) {
      return {
        success: false,
        message: 'プロジェクトルートが見つかりません。',
      };
    }

    // ドロップされたファイルのプロジェクトルートからの相対パスを使用
    // （ファイルからファイルへの相対パスではなく、常にプロジェクトルート相対）
    const droppedFileProjectRelativePath = droppedData.path;

    // Windows用のパス区切り文字を正規化
    const normalizedProjectRelativePath = droppedFileProjectRelativePath.replace(/\\/g, '/');

    if (
      normalizedProjectRelativePath === null ||
      normalizedProjectRelativePath === undefined ||
      normalizedProjectRelativePath === ''
    ) {
      return {
        success: false,
        message: 'プロジェクト相対パスの取得に失敗しました。',
      };
    }

    // マークダウンリンクを生成（プロジェクトルートからの相対パスを使用）
    const linkText = droppedData.name;
    const linkPath = normalizedProjectRelativePath;
    const markdownLink = `[${linkText}](${linkPath})`;

    return {
      success: true,
      message: `マークダウンリンク "${linkText}" を生成しました。`,
      insertText: markdownLink,
      insertPosition: { line: 0, character: 0 }, // VSCode側で実際の位置を設定
    };
  }

  /**
   * プロジェクトルートからの相対パスを取得
   */
  private getRelativePathFromProject(
    fileAbsolutePath: string,
    projectRootAbsolutePath: string,
  ): string | null {
    if (!fileAbsolutePath.startsWith(projectRootAbsolutePath)) {
      return null;
    }
    const fileProjectRelativePath = path.relative(projectRootAbsolutePath, fileAbsolutePath);
    return fileProjectRelativePath.replace(/\\/g, '/'); // Windows対応
  }
}
