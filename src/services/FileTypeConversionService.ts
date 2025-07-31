import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { FileChangeNotificationService } from './FileChangeNotificationService.js';
import { DialogoiTreeItem, MetaYaml, ContentItem, SettingItem } from '../utils/MetaYamlUtils.js';
import { Logger } from '../utils/Logger.js';
import * as path from 'path';

/**
 * ファイル種別変換結果
 */
export interface FileTypeConversionResult {
  success: boolean;
  message: string;
  oldType?: 'content' | 'setting';
  newType?: 'content' | 'setting';
  errors?: string[];
}

/**
 * ファイル種別変換オプション
 */
export interface FileTypeConversionOptions {
  confirmationRequired?: boolean; // 確認ダイアログが必要か（デフォルト: true）
  updateReferences?: boolean; // 参照関係の更新（将来の拡張用、現在未使用）
}

/**
 * ファイル種別変換サービス
 * 管理対象ファイルの種別（content ↔ setting）を変更する機能を提供
 */
export class FileTypeConversionService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private fileChangeNotificationService: FileChangeNotificationService,
  ) {}

  /**
   * ファイルの種別を変更する
   * @param absoluteFilePath 変更対象ファイルの絶対パス
   * @param newType 新しい種別
   * @param options 変換オプション
   * @returns 変換結果
   */
  async convertFileType(
    absoluteFilePath: string,
    newType: 'content' | 'setting',
    _options?: FileTypeConversionOptions,
  ): Promise<FileTypeConversionResult> {
    const logger = Logger.getInstance();

    try {
      logger.debug(`[FileTypeConversion] convertFileType開始: ${absoluteFilePath} -> ${newType}`);

      // 1. ファイル存在確認
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      const fileExists = await this.fileRepository.existsAsync(fileUri);
      logger.debug(`[FileTypeConversion] ファイル存在確認: ${fileExists}`);

      if (!fileExists) {
        return {
          success: false,
          message: `ファイルが存在しません: ${absoluteFilePath}`,
          errors: ['対象ファイルが見つかりませんでした'],
        };
      }

      // 2. プロジェクト内からファイルを検索
      logger.debug(`[FileTypeConversion] findFileInProject開始: ${absoluteFilePath}`);
      const fileEntry = await this.findFileInProject(absoluteFilePath);
      logger.debug(`[FileTypeConversion] findFileInProject結果:`, fileEntry);

      if (!fileEntry) {
        return {
          success: false,
          message: `ファイルが管理対象として登録されていません: ${absoluteFilePath}`,
          errors: ['プロジェクト内でファイルエントリが見つかりませんでした'],
        };
      }

      // ファイルが含まれるmeta.yamlを見つける
      const containingMeta = await this.findContainingMetaYaml(absoluteFilePath);
      if (!containingMeta) {
        return {
          success: false,
          message: `meta.yamlファイルが見つかりません`,
          errors: ['ファイルを管理しているmeta.yamlが見つかりませんでした'],
        };
      }

      const { dirPath: directoryPath, metaYaml } = containingMeta;
      if (metaYaml === null || metaYaml === undefined || typeof metaYaml !== 'object') {
        return {
          success: false,
          message: 'meta.yamlファイルの形式が不正です',
          errors: ['meta.yamlの内容を解析できませんでした'],
        };
      }
      const fileName = path.basename(absoluteFilePath);

      // 4. 現在の種別と新しい種別が同じ場合は何もしない
      const currentType = fileEntry.type as 'content' | 'setting';
      if (currentType === newType) {
        return {
          success: true,
          message: `ファイルは既に${newType}種別です`,
          oldType: currentType,
          newType: newType,
        };
      }

      // 5. サブディレクトリの場合は変更できない
      if (fileEntry.type === 'subdirectory') {
        return {
          success: false,
          message: 'ディレクトリの種別は変更できません',
          errors: ['対象がディレクトリのため、種別変更は対応していません'],
        };
      }

      // 6. meta.yamlでファイル種別を更新
      const updatedFileEntry: DialogoiTreeItem = this.convertFileTypeInternal(fileEntry, newType);

      if (!Array.isArray(metaYaml.files)) {
        return {
          success: false,
          message: 'meta.yamlのfiles配列が不正です',
          errors: ['meta.yamlのfiles配列を読み込めませんでした'],
        };
      }

      const updatedFiles = metaYaml.files.map((file: DialogoiTreeItem) =>
        file.name === fileName ? updatedFileEntry : file,
      );

      const updatedMetaYaml: MetaYaml = {
        ...metaYaml,
        files: updatedFiles,
      };

      // 7. meta.yamlを保存
      const saveSuccess = await this.metaYamlService.saveMetaYamlAsync(
        directoryPath,
        updatedMetaYaml,
      );

      if (!saveSuccess) {
        return {
          success: false,
          message: 'meta.yamlファイルの更新に失敗しました',
          errors: ['ファイルシステムへの書き込みエラーが発生しました'],
        };
      }

      // 8. ファイル変更通知を送信
      this.fileChangeNotificationService.notifyMetaYamlUpdated(
        path.join(directoryPath, '.dialogoi-meta.yaml'),
      );

      return {
        success: true,
        message: `ファイル種別を${currentType}から${newType}に変更しました`,
        oldType: currentType,
        newType: newType,
      };
    } catch (error) {
      return {
        success: false,
        message: `ファイル種別変更中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * ファイルの現在の種別を取得する
   * @param absoluteFilePath ファイルの絶対パス
   * @returns ファイル種別、見つからない場合はnull
   */
  async getCurrentFileType(absoluteFilePath: string): Promise<'content' | 'setting' | null> {
    const logger = Logger.getInstance();
    try {
      logger.debug(`[FileTypeConversion] getCurrentFileType開始: ${absoluteFilePath}`);

      // プロジェクトルートから再帰的に検索
      const fileEntry = await this.findFileInProject(absoluteFilePath);
      logger.debug(`[FileTypeConversion] getCurrentFileType - findFileInProject結果:`, fileEntry);

      if (!fileEntry || fileEntry.type === 'subdirectory') {
        logger.debug(
          `[FileTypeConversion] getCurrentFileType - ファイルエントリなしまたはサブディレクトリ`,
        );
        return null;
      }

      logger.debug(`[FileTypeConversion] getCurrentFileType - 種別返却: ${fileEntry.type}`);
      return fileEntry.type;
    } catch (error) {
      logger.debug(
        `[FileTypeConversion] getCurrentFileTypeでエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * プロジェクト内からファイルを再帰的に検索する
   * @param absoluteFilePath 検索対象ファイルの絶対パス
   * @returns ファイルのDialogoiTreeItem、見つからない場合はnull
   */
  private async findFileInProject(absoluteFilePath: string): Promise<DialogoiTreeItem | null> {
    const logger = Logger.getInstance();

    // まず直接のディレクトリから検索
    const directoryPath = path.dirname(absoluteFilePath);
    const fileName = path.basename(absoluteFilePath);

    logger.debug(
      `[FileTypeConversion] findFileInProject - directoryPath: ${directoryPath}, fileName: ${fileName}`,
    );

    // 直接のディレクトリにmeta.yamlがあるか確認
    const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
    logger.debug(
      `[FileTypeConversion] 直接ディレクトリのmeta.yaml:`,
      metaYaml ? '見つかった' : 'なし',
    );

    if (metaYaml) {
      const fileEntry = metaYaml.files.find((file) => file.name === fileName);
      logger.debug(`[FileTypeConversion] 直接ディレクトリでのファイル検索結果:`, fileEntry);
      if (fileEntry) {
        return fileEntry;
      }
    }

    // プロジェクトルートを見つける
    let currentDir = directoryPath;
    let projectRoot: string | null = null;

    logger.debug(`[FileTypeConversion] プロジェクトルート検索開始: ${currentDir}`);

    while (currentDir !== path.dirname(currentDir)) {
      const dialogoiYamlPath = path.join(currentDir, 'dialogoi.yaml');
      const dialogoiYamlUri = this.fileRepository.createFileUri(dialogoiYamlPath);

      const exists = await this.fileRepository.existsAsync(dialogoiYamlUri);
      logger.debug(`[FileTypeConversion] dialogoi.yaml確認: ${dialogoiYamlPath} -> ${exists}`);

      if (exists) {
        projectRoot = currentDir;
        break;
      }

      currentDir = path.dirname(currentDir);
    }

    logger.debug(`[FileTypeConversion] プロジェクトルート検索結果: ${projectRoot}`);

    if (projectRoot === null || projectRoot === undefined || projectRoot === '') {
      return null;
    }

    // プロジェクトルートから再帰的に検索
    const relativePath = path.relative(projectRoot, absoluteFilePath);
    logger.debug(`[FileTypeConversion] 再帰検索開始 - relativePath: ${relativePath}`);

    const result = await this.searchFileRecursively(projectRoot, relativePath);
    logger.debug(`[FileTypeConversion] 再帰検索結果:`, result);

    return result;
  }

  /**
   * ディレクトリを再帰的に検索してファイルを見つける
   * @param currentDir 現在のディレクトリ
   * @param targetRelativePath 検索対象の相対パス
   * @returns ファイルのDialogoiTreeItem、見つからない場合はnull
   */
  private async searchFileRecursively(
    currentDir: string,
    targetRelativePath: string,
  ): Promise<DialogoiTreeItem | null> {
    const logger = Logger.getInstance();
    logger.debug(
      `[FileTypeConversion] searchFileRecursively開始 - currentDir: ${currentDir}, targetRelativePath: ${targetRelativePath}`,
    );

    const metaYaml = await this.metaYamlService.loadMetaYamlAsync(currentDir);
    if (!metaYaml) {
      logger.debug(`[FileTypeConversion] meta.yamlが見つからない: ${currentDir}`);
      return null;
    }

    logger.debug(`[FileTypeConversion] meta.yamlのfiles数: ${metaYaml.files.length}`);
    metaYaml.files.forEach((file, index) => {
      logger.debug(
        `[FileTypeConversion] files[${index}]: name="${file.name}", type="${file.type}", path="${file.path || 'undefined'}"`,
      );
    });

    for (const item of metaYaml.files) {
      // ファイル名の直接比較
      const targetFileName = path.basename(targetRelativePath);
      logger.debug(
        `[FileTypeConversion] ファイル名比較: "${item.name}" === "${targetFileName}" && "${item.type}" !== "subdirectory"`,
      );
      if (item.name === targetFileName && item.type !== 'subdirectory') {
        logger.debug(`[FileTypeConversion] ファイル名一致で発見: ${item.name}`);
        return item;
      }

      // パスの完全一致をチェック（プロジェクトルートからの相対パス）
      logger.debug(
        `[FileTypeConversion] パス完全一致比較: "${item.path}" === "${targetRelativePath}"`,
      );
      if (item.path === targetRelativePath) {
        logger.debug(`[FileTypeConversion] パス完全一致で発見: ${item.path}`);
        return item;
      }

      // サブディレクトリの場合は再帰的に検索
      if (item.type === 'subdirectory') {
        const subDirPath = path.join(currentDir, item.name);
        // targetRelativePathがこのサブディレクトリ内にあるかチェック
        const startsWithSep = targetRelativePath.startsWith(item.name + path.sep);
        const startsWithSlash = targetRelativePath.startsWith(item.name + '/');
        logger.debug(
          `[FileTypeConversion] サブディレクトリチェック: "${targetRelativePath}".startsWith("${item.name + path.sep}") = ${startsWithSep}, "${targetRelativePath}".startsWith("${item.name}/") = ${startsWithSlash}`,
        );

        if (startsWithSep || startsWithSlash) {
          // サブディレクトリ内の相対パスを計算
          const subRelativePath = targetRelativePath.substring(item.name.length + 1);
          logger.debug(
            `[FileTypeConversion] サブディレクトリ再帰検索: subDirPath="${subDirPath}", subRelativePath="${subRelativePath}"`,
          );
          const result = await this.searchFileRecursively(subDirPath, subRelativePath);
          if (result) {
            logger.debug(`[FileTypeConversion] サブディレクトリで発見: ${result.name}`);
            return result;
          }
        }
      }
    }

    logger.debug(`[FileTypeConversion] searchFileRecursively終了 - 見つからず`);
    return null;
  }

  /**
   * ファイルを含むmeta.yamlとそのディレクトリを見つける
   * @param absoluteFilePath ファイルの絶対パス
   * @returns meta.yamlとディレクトリパス、見つからない場合はnull
   */
  private async findContainingMetaYaml(
    absoluteFilePath: string,
  ): Promise<{ dirPath: string; metaYaml: MetaYaml } | null> {
    // プロジェクトルートを見つける
    let currentDir = path.dirname(absoluteFilePath);
    let projectRoot: string | null = null;

    while (currentDir !== path.dirname(currentDir)) {
      const dialogoiYamlPath = path.join(currentDir, 'dialogoi.yaml');
      const dialogoiYamlUri = this.fileRepository.createFileUri(dialogoiYamlPath);

      if (await this.fileRepository.existsAsync(dialogoiYamlUri)) {
        projectRoot = currentDir;
        break;
      }

      currentDir = path.dirname(currentDir);
    }

    if (projectRoot === null || projectRoot === undefined || projectRoot === '') {
      return null;
    }

    // プロジェクトルートから再帰的に検索
    const relativePath = path.relative(projectRoot, absoluteFilePath);
    return await this.searchContainingMetaYaml(projectRoot, relativePath);
  }

  /**
   * ファイルを含むmeta.yamlを再帰的に検索
   * @param currentDir 現在のディレクトリ
   * @param targetRelativePath 検索対象の相対パス
   * @returns meta.yamlとディレクトリパス
   */
  private async searchContainingMetaYaml(
    currentDir: string,
    targetRelativePath: string,
  ): Promise<{ dirPath: string; metaYaml: MetaYaml } | null> {
    const metaYaml = await this.metaYamlService.loadMetaYamlAsync(currentDir);
    if (!metaYaml) {
      return null;
    }

    // 現在のディレクトリ内のファイルをチェック
    const fileName = path.basename(targetRelativePath);
    const targetDir = path.dirname(targetRelativePath);

    if (targetDir === '.' || targetDir === '') {
      // ファイルが現在のディレクトリ直下にある場合
      if (metaYaml.files.some((f: DialogoiTreeItem) => f.name === fileName)) {
        return { dirPath: currentDir, metaYaml };
      }
    }

    // サブディレクトリを再帰的に検索
    for (const item of metaYaml.files) {
      if (item.type === 'subdirectory') {
        const subDirPath = path.join(currentDir, item.name);
        const subRelativePath = path.relative(item.name, targetRelativePath);

        if (!subRelativePath.startsWith('..')) {
          const result = await this.searchContainingMetaYaml(subDirPath, subRelativePath);
          if (result) {
            return result;
          }
        }
      }
    }

    return null;
  }

  /**
   * ファイルが種別変更可能かどうかを判定する
   * @param absoluteFilePath ファイルの絶対パス
   * @returns 変更可能な場合はtrue
   */
  async isFileTypeConvertible(absoluteFilePath: string): Promise<boolean> {
    const logger = Logger.getInstance();
    try {
      logger.debug(`[FileTypeConversion] isFileTypeConvertible開始: ${absoluteFilePath}`);

      // ファイルが存在するか確認
      const fileUri = this.fileRepository.createFileUri(absoluteFilePath);
      const fileExists = await this.fileRepository.existsAsync(fileUri);
      logger.debug(`[FileTypeConversion] ファイル存在確認: ${fileExists}`);

      if (!fileExists) {
        logger.debug(`[FileTypeConversion] ファイルが存在しないため変換不可`);
        return false;
      }

      // 現在の種別を取得
      logger.debug(`[FileTypeConversion] getCurrentFileType呼び出し`);
      const currentType = await this.getCurrentFileType(absoluteFilePath);
      logger.debug(`[FileTypeConversion] 現在の種別: ${currentType}`);

      // content または setting の場合のみ変更可能
      const isConvertible = currentType === 'content' || currentType === 'setting';
      logger.debug(`[FileTypeConversion] 変換可能判定: ${isConvertible}`);
      return isConvertible;
    } catch (error) {
      logger.debug(
        `[FileTypeConversion] isFileTypeConvertibleでエラー: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * ファイル種別を変換する（メタデータの適切な変換を行う）
   * @param sourceItem 変換元のファイルアイテム
   * @param newType 新しいファイル種別
   * @returns 変換後のファイルアイテム
   */
  private convertFileTypeInternal(
    sourceItem: DialogoiTreeItem,
    newType: 'content' | 'setting',
  ): DialogoiTreeItem {
    // 基本プロパティは保持
    // 型ガードを使用してプロパティに安全にアクセス
    const hash = 'hash' in sourceItem ? sourceItem.hash : '';
    const tags = 'tags' in sourceItem ? sourceItem.tags : [];
    const comments = 'comments' in sourceItem ? sourceItem.comments : '';

    const baseProperties = {
      name: sourceItem.name,
      path: sourceItem.path,
      hash: hash,
      tags: tags,
      comments: comments,
      isUntracked: sourceItem.isUntracked,
      isMissing: sourceItem.isMissing,
    };

    if (newType === 'content') {
      // setting → content: referencesを空配列で初期化
      const contentItem: ContentItem = {
        ...baseProperties,
        type: 'content',
        references: [], // 新規初期化
      };
      return contentItem;
    } else {
      // content → setting: referencesを除去、特別な種別情報も除去
      const settingItem: SettingItem = {
        ...baseProperties,
        type: 'setting',
        // references, character, foreshadowing, glossary は含めない
      };
      return settingItem;
    }
  }
}
