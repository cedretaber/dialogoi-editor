import * as path from 'path';

/**
 * ファイル種別の検出方法
 */
export type FileTypeDetectionMethod = 'extension' | 'manual';

/**
 * ファイル種別検出ユーティリティ
 * 元FileTypeDetectionServiceから移行、DI不要な静的メソッドに変更
 */
export class FileTypeDetector {
  /**
   * ファイル種別の自動判定
   * ユーザー方針: .txt→content（本文）, .md→setting（設定）
   * @param filePath ファイルパス
   * @param detectionMethod 検出方法
   * @returns ファイル種別
   */
  static detectFileType(
    filePath: string,
    detectionMethod: FileTypeDetectionMethod = 'extension',
  ): 'content' | 'setting' {
    switch (detectionMethod) {
      case 'extension':
        return FileTypeDetector.detectByExtension(filePath);
      case 'manual':
        // 手動選択の場合はデフォルトとしてsettingを返す
        return 'setting';
      default:
        return 'setting';
    }
  }

  /**
   * 拡張子ベースのファイル種別判定
   * @param filePath ファイルパス
   * @returns ファイル種別
   */
  static detectByExtension(filePath: string): 'content' | 'setting' {
    const extension = path.extname(filePath).toLowerCase();

    // ユーザー方針: .txt→content（本文）, .md→setting（設定）
    if (extension === '.txt') {
      return 'content';
    } else if (extension === '.md') {
      return 'setting';
    } else {
      // デフォルトは setting として扱う
      return 'setting';
    }
  }

  /**
   * 除外パターンにマッチするかチェック
   * ProjectCreationServiceから移植
   * @param relativePath 相対パス
   * @param excludePatterns 除外パターン
   * @returns 除外対象かどうか
   */
  static isExcluded(relativePath: string, excludePatterns: string[]): boolean {
    const fileName = path.basename(relativePath);

    for (const pattern of excludePatterns) {
      // 単純なパターンマッチング実装
      const fileNameMatch = FileTypeDetector.matchesPattern(fileName, pattern);
      const relativePathMatch = FileTypeDetector.matchesPattern(relativePath, pattern);

      if (fileNameMatch || relativePathMatch) {
        return true;
      }
    }

    return false;
  }

  /**
   * 単純なパターンマッチング
   * ProjectCreationServiceから移植
   * @param text マッチ対象のテキスト
   * @param pattern パターン
   * @returns マッチするかどうか
   */
  private static matchesPattern(text: string, pattern: string): boolean {
    // ドットで始まるファイル/ディレクトリ（特別パターン）
    if (pattern === '.*') {
      return text.startsWith('.');
    }

    // 完全一致
    if (text === pattern) {
      return true;
    }

    // ワイルドカードマッチング（簡単な実装）
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(text);
    }

    return false;
  }
}
