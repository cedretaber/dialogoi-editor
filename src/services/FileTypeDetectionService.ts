import * as path from 'path';

/**
 * ファイル種別の検出方法
 */
export type FileTypeDetectionMethod = 'extension' | 'directory' | 'manual';

/**
 * ファイル種別検出サービス
 * ProjectCreationServiceから抽出・改良
 */
export class FileTypeDetectionService {
  /**
   * ファイル種別の自動判定
   * ユーザー方針: .txt→content（本文）, .md→setting（設定）
   * @param filePath ファイルパス
   * @param detectionMethod 検出方法
   * @returns ファイル種別
   */
  detectFileType(
    filePath: string,
    detectionMethod: FileTypeDetectionMethod = 'extension',
  ): 'content' | 'setting' {
    switch (detectionMethod) {
      case 'extension':
        return this.detectByExtension(filePath);
      case 'directory':
        return this.detectByDirectory(filePath);
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
  detectByExtension(filePath: string): 'content' | 'setting' {
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
   * ディレクトリ名ベースのファイル種別判定
   * @param filePath ファイルパス
   * @returns ファイル種別
   */
  detectByDirectory(filePath: string): 'content' | 'setting' {
    const dirName = path.dirname(filePath).toLowerCase();
    const segments = dirName.split(path.sep);

    // ディレクトリ名から判定
    for (const segment of segments) {
      // content系のディレクトリ
      if (
        segment.includes('content') ||
        segment.includes('chapter') ||
        segment.includes('episode') ||
        segment.includes('scene')
      ) {
        return 'content';
      }

      // setting系のディレクトリ
      if (
        segment.includes('setting') ||
        segment.includes('character') ||
        segment.includes('world') ||
        segment.includes('glossary') ||
        segment.includes('reference')
      ) {
        return 'setting';
      }
    }

    // ディレクトリからの判定ができない場合は拡張子ベースにフォールバック
    return this.detectByExtension(filePath);
  }

  /**
   * 除外パターンにマッチするかチェック
   * ProjectCreationServiceから移植
   * @param relativePath 相対パス
   * @param excludePatterns 除外パターン
   * @returns 除外対象かどうか
   */
  isExcluded(relativePath: string, excludePatterns: string[]): boolean {
    const fileName = path.basename(relativePath);

    for (const pattern of excludePatterns) {
      // 単純なパターンマッチング実装
      const fileNameMatch = this.matchesPattern(fileName, pattern);
      const relativePathMatch = this.matchesPattern(relativePath, pattern);

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
  private matchesPattern(text: string, pattern: string): boolean {
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
