import * as path from 'path';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';
import { MetaYamlService } from './MetaYamlService.js';
import { CoreFileService } from './CoreFileService.js';

/**
 * プロジェクト内ファイルのメタデータエントリ
 */
export interface FileMapEntry {
  /** ファイル名（拡張子込み） */
  fileName: string;
  /** キャラクターファイルかどうか */
  isCharacter: boolean;
  /** プロジェクトルートからの相対パス */
  relativePathFromRoot: string;
  /** ファイルタイプ */
  fileType: 'content' | 'setting' | 'subdirectory';
  /** 他の必要なメタデータ */
  glossary?: boolean;
  foreshadowing?: boolean;
}

/**
 * プロジェクト内ファイルマップを管理するサービス
 *
 * このサービスは、プロジェクト内の全ファイルのメタデータをメモリ上に保持し、
 * ファイルパスの解決やファイル種別の判定を高速に行えるようにします。
 */
export class FilePathMapService {
  private fileMap: Map<string, FileMapEntry> = new Map();
  private currentNovelRootPath?: string;

  constructor(
    private metaYamlService: MetaYamlService,
    private coreFileService: CoreFileService,
  ) {}

  /**
   * プロジェクト全体をスキャンしてファイルマップを構築
   * @param novelRootAbsolutePath プロジェクトルートの絶対パス
   */
  async buildFileMap(novelRootAbsolutePath: string): Promise<void> {
    this.currentNovelRootPath = novelRootAbsolutePath;
    this.fileMap.clear();
    await this.scanDirectory(novelRootAbsolutePath, novelRootAbsolutePath);
  }

  /**
   * ディレクトリを再帰的にスキャンしてファイルマップに追加
   * @param dirAbsolutePath スキャンするディレクトリの絶対パス
   * @param novelRootAbsolutePath プロジェクトルートの絶対パス
   */
  private async scanDirectory(
    dirAbsolutePath: string,
    novelRootAbsolutePath: string,
  ): Promise<void> {
    const meta = await this.metaYamlService.loadMetaYamlAsync(dirAbsolutePath);
    if (!meta) {
      return;
    }

    for (const item of meta.files) {
      const absolutePath = path.join(dirAbsolutePath, item.name);
      const relativePathFromRoot = path.relative(novelRootAbsolutePath, absolutePath);

      // 正規化（Windowsでも/を使用）
      const normalizedPath = relativePathFromRoot.replace(/\\/g, '/');

      const entry: FileMapEntry = {
        fileName: item.name,
        isCharacter: item.character !== undefined,
        relativePathFromRoot: normalizedPath,
        fileType: item.type,
        glossary: item.glossary,
        foreshadowing: item.foreshadowing !== undefined,
      };

      this.fileMap.set(normalizedPath, entry);

      // サブディレクトリの場合は再帰的にスキャン
      if (item.type === 'subdirectory') {
        await this.scanDirectory(absolutePath, novelRootAbsolutePath);
      }
    }
  }

  /**
   * リンク先がプロジェクト内ファイルか判定
   * @param linkRelativePath リンクの相対パス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクト内ファイルの場合true
   */
  isProjectFile(linkRelativePath: string, currentFileAbsolutePath: string): boolean {
    const resolvedPath = this.resolveRelativePathFromRootPrivate(
      linkRelativePath,
      currentFileAbsolutePath,
    );
    const hasInMap = resolvedPath !== null && this.fileMap.has(resolvedPath);

    return hasInMap;
  }

  /**
   * リンクの相対パスをプロジェクトルートからの相対パスに解決（公開版）
   * @param linkRelativePath リンクの相対パス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクトルートからの相対パス
   */
  resolveRelativePathFromRoot(
    linkRelativePath: string,
    currentFileAbsolutePath: string,
  ): string | null {
    return this.resolveRelativePathFromRootPrivate(linkRelativePath, currentFileAbsolutePath);
  }

  /**
   * 相対パスから絶対パスに解決
   * @param linkRelativePath リンクの相対パス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns 絶対パス、解決できない場合はnull
   */
  resolveFileAbsolutePath(
    linkRelativePath: string,
    currentFileAbsolutePath: string,
  ): string | null {
    let novelRootPath = this.coreFileService.getNovelRootPath();

    // FileOperationServiceからノベルルートが取得できない場合は、
    // 保存されたcurrentNovelRootPathを使用
    if (novelRootPath === undefined || novelRootPath === null || novelRootPath === '') {
      novelRootPath = this.currentNovelRootPath;
    }

    if (novelRootPath === undefined || novelRootPath === null || novelRootPath === '') {
      return null;
    }

    const resolvedRelativePath = this.resolveRelativePathFromRootPrivate(
      linkRelativePath,
      currentFileAbsolutePath,
    );

    if (
      resolvedRelativePath === null ||
      resolvedRelativePath === undefined ||
      resolvedRelativePath === ''
    ) {
      return null;
    }

    // ファイルがプロジェクト内に存在するかチェック
    if (!this.fileMap.has(resolvedRelativePath)) {
      return null;
    }

    return path.join(novelRootPath, resolvedRelativePath);
  }

  /**
   * リンクの相対パスをプロジェクトルートからの相対パスに解決
   * @param linkRelativePath リンクの相対パス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクトルートからの相対パス
   */
  private resolveRelativePathFromRootPrivate(
    linkRelativePath: string,
    currentFileAbsolutePath: string,
  ): string | null {
    let novelRootPath = this.coreFileService.getNovelRootPath();

    // FileOperationServiceからノベルルートが取得できない場合は、
    // 保存されたcurrentNovelRootPathを使用
    if (novelRootPath === undefined || novelRootPath === null || novelRootPath === '') {
      novelRootPath = this.currentNovelRootPath;
    }

    if (novelRootPath === undefined || novelRootPath === null || novelRootPath === '') {
      return null;
    }

    try {
      // 外部リンクの場合はnull
      if (this.isExternalLink(linkRelativePath)) {
        return null;
      }

      // プロジェクトルートからの相対パスの場合はそのまま返す
      if (
        !linkRelativePath.startsWith('./') &&
        !linkRelativePath.startsWith('../') &&
        !path.isAbsolute(linkRelativePath)
      ) {
        return linkRelativePath.replace(/\\/g, '/');
      }

      // 現在のファイルのディレクトリ
      const currentDir = path.dirname(currentFileAbsolutePath);

      // 相対パスを解決
      const absolutePath = path.resolve(currentDir, linkRelativePath);

      // プロジェクトルートからの相対パスに変換
      const relativeFromRoot = path.relative(novelRootPath, absolutePath);

      // プロジェクト外の場合はnull
      if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
        return null;
      }

      return relativeFromRoot.replace(/\\/g, '/');
    } catch {
      return null;
    }
  }

  /**
   * 外部リンクかどうかを判定
   * @param linkPath リンクパス
   * @returns 外部リンクの場合true
   */
  private isExternalLink(linkPath: string): boolean {
    return (
      linkPath.startsWith('http://') ||
      linkPath.startsWith('https://') ||
      linkPath.startsWith('file://') ||
      linkPath.startsWith('mailto:')
    );
  }

  /**
   * ファイル変更時のマップ更新
   * @param fileAbsolutePath ファイルの絶対パス
   * @param item ファイルアイテム、削除の場合はnull
   */
  updateFile(fileAbsolutePath: string, item: DialogoiTreeItem | null): void {
    const novelRootPath = this.coreFileService.getNovelRootPath();
    if (novelRootPath === undefined || novelRootPath === null || novelRootPath === '') {
      return;
    }

    const relativePathFromRoot = path.relative(novelRootPath, fileAbsolutePath).replace(/\\/g, '/');

    if (item === null) {
      // ファイル削除
      this.fileMap.delete(relativePathFromRoot);
    } else {
      // ファイル追加・更新
      const entry: FileMapEntry = {
        fileName: item.name,
        isCharacter: item.character !== undefined,
        relativePathFromRoot,
        fileType: item.type,
        glossary: item.glossary,
        foreshadowing: item.foreshadowing !== undefined,
      };
      this.fileMap.set(relativePathFromRoot, entry);
    }
  }

  /**
   * ファイルメタデータの取得
   * @param relativePathFromRoot プロジェクトルートからの相対パス
   * @returns ファイルエントリ、存在しない場合はnull
   */
  getFileEntry(relativePathFromRoot: string): FileMapEntry | null {
    const normalizedPath = relativePathFromRoot.replace(/\\/g, '/');
    return this.fileMap.get(normalizedPath) || null;
  }

  /**
   * ファイルマップのサイズを取得（デバッグ用）
   * @returns マップ内のエントリ数
   */
  getMapSize(): number {
    return this.fileMap.size;
  }

  /**
   * ファイルマップをクリア
   */
  clear(): void {
    this.fileMap.clear();
  }
}
