import * as path from 'path';

/**
 * プロジェクトルート相対パスの正規化サービス
 */
export class ProjectPathNormalizationService {
  constructor(private novelRootAbsolutePath: string) {}

  /**
   * 任意の相対パスをプロジェクトルート相対パスに正規化
   */
  normalizeToProjectPath(linkPath: string, currentFileAbsolutePath: string): string | null {
    // 空文字列の場合はnull
    if (!linkPath || linkPath.trim() === '') {
      return null;
    }

    // 外部URLやプロトコル付きリンクは対象外
    if (this.isExternalLink(linkPath)) {
      return null;
    }

    // 既にプロジェクトルート相対パスの場合はそのまま返す
    if (this.isProjectRootRelativePath(linkPath)) {
      return this.normalizePathSeparators(linkPath);
    }

    // 現在ファイルからの相対パスを絶対パスに変換
    const currentDirAbsolutePath = path.dirname(currentFileAbsolutePath);
    const targetAbsolutePath = path.resolve(currentDirAbsolutePath, linkPath);

    // プロジェクトルートからの相対パスに変換
    const relativeFromRoot = path.relative(this.novelRootAbsolutePath, targetAbsolutePath);

    // プロジェクト外のファイルの場合はnull
    if (relativeFromRoot.startsWith('..')) {
      return null;
    }

    return this.normalizePathSeparators(relativeFromRoot);
  }

  /**
   * プロジェクトルート相対パスを絶対パスに変換
   */
  resolveProjectPath(projectRelativePath: string): string {
    return path.join(this.novelRootAbsolutePath, projectRelativePath);
  }

  /**
   * 絶対パスをプロジェクトルート相対パスに変換
   */
  getProjectRelativePath(absolutePath: string): string | null {
    const relativePath = path.relative(this.novelRootAbsolutePath, absolutePath);

    // プロジェクト外の場合はnull
    if (relativePath.startsWith('..')) {
      return null;
    }

    return this.normalizePathSeparators(relativePath);
  }

  /**
   * パスがプロジェクトルート相対パスかチェック
   */
  private isProjectRootRelativePath(linkPath: string): boolean {
    return (
      !linkPath.startsWith('./') &&
      !linkPath.startsWith('../') &&
      linkPath !== '.' &&
      linkPath !== '..' &&
      !path.isAbsolute(linkPath) &&
      !this.isExternalLink(linkPath)
    );
  }

  /**
   * 外部リンク（URL）かチェック
   */
  private isExternalLink(linkPath: string): boolean {
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
   */
  private normalizePathSeparators(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 2つのプロジェクトルート相対パスが同じファイルを指すかチェック
   */
  isSamePath(path1: string, path2: string): boolean {
    const normalized1 = this.normalizePathSeparators(path1);
    const normalized2 = this.normalizePathSeparators(path2);
    return normalized1 === normalized2;
  }
}
