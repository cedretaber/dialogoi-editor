import * as path from 'path';

/**
 * プロジェクトルート相対パスの正規化ユーティリティ
 * 元ProjectPathNormalizationServiceから移行、静的メソッドに変更
 */
export class PathNormalizer {
  /**
   * 任意の相対パスをプロジェクトルート相対パスに正規化
   * @param linkPath リンクパス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @returns 正規化されたプロジェクトルート相対パス、変換できない場合はnull
   */
  static normalizeToProjectPath(
    linkPath: string,
    currentFileAbsolutePath: string,
    novelRootAbsolutePath: string,
  ): string | null {
    // 空文字列の場合はnull
    if (!linkPath || linkPath.trim() === '') {
      return null;
    }

    // 外部URLやプロトコル付きリンクは対象外
    if (PathNormalizer.isExternalLink(linkPath)) {
      return null;
    }

    // 既にプロジェクトルート相対パスの場合はそのまま返す
    if (PathNormalizer.isProjectRootRelativePath(linkPath)) {
      return PathNormalizer.normalizePathSeparators(linkPath);
    }

    // 現在ファイルからの相対パスを絶対パスに変換
    const currentDirAbsolutePath = path.dirname(currentFileAbsolutePath);
    const targetAbsolutePath = path.resolve(currentDirAbsolutePath, linkPath);

    // プロジェクトルートからの相対パスに変換
    const relativeFromRoot = path.relative(novelRootAbsolutePath, targetAbsolutePath);

    // プロジェクト外のファイルの場合はnull
    if (relativeFromRoot.startsWith('..')) {
      return null;
    }

    return PathNormalizer.normalizePathSeparators(relativeFromRoot);
  }

  /**
   * プロジェクトルート相対パスを絶対パスに変換
   * @param projectRelativePath プロジェクトルート相対パス
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @returns 絶対パス
   */
  static resolveProjectPath(projectRelativePath: string, novelRootAbsolutePath: string): string {
    return path.join(novelRootAbsolutePath, projectRelativePath);
  }

  /**
   * 絶対パスをプロジェクトルート相対パスに変換
   * @param absolutePath 絶対パス
   * @param novelRootAbsolutePath 小説ルートの絶対パス
   * @returns プロジェクトルート相対パス、プロジェクト外の場合はnull
   */
  static getProjectRelativePath(
    absolutePath: string,
    novelRootAbsolutePath: string,
  ): string | null {
    const relativePath = path.relative(novelRootAbsolutePath, absolutePath);

    // プロジェクト外の場合はnull
    if (relativePath.startsWith('..')) {
      return null;
    }

    return PathNormalizer.normalizePathSeparators(relativePath);
  }

  /**
   * パスがプロジェクトルート相対パスかチェック
   * @param linkPath チェック対象のパス
   * @returns プロジェクトルート相対パスの場合true
   */
  private static isProjectRootRelativePath(linkPath: string): boolean {
    return (
      !linkPath.startsWith('./') &&
      !linkPath.startsWith('../') &&
      linkPath !== '.' &&
      linkPath !== '..' &&
      !path.isAbsolute(linkPath) &&
      !PathNormalizer.isExternalLink(linkPath)
    );
  }

  /**
   * 外部リンク（URL）かチェック
   * @param linkPath チェック対象のパス
   * @returns 外部リンクの場合true
   */
  private static isExternalLink(linkPath: string): boolean {
    return (
      linkPath.startsWith('http://') ||
      linkPath.startsWith('https://') ||
      linkPath.startsWith('ftp://') ||
      linkPath.startsWith('mailto:') ||
      linkPath.startsWith('tel:')
    );
  }

  /**
   * パス区切り文字をUnix形式に正規化（Windows対応）
   * @param filePath 正規化対象のパス
   * @returns 正規化されたパス
   */
  static normalizePathSeparators(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 2つのプロジェクトルート相対パスが同じファイルを指すかチェック
   * @param path1 比較対象のパス1
   * @param path2 比較対象のパス2
   * @returns 同じファイルを指す場合true
   */
  static isSamePath(path1: string, path2: string): boolean {
    const normalized1 = PathNormalizer.normalizePathSeparators(path1);
    const normalized2 = PathNormalizer.normalizePathSeparators(path2);
    return normalized1 === normalized2;
  }
}
