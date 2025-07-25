/**
 * ファイル行番号URL のパース結果
 */
export interface ParsedFileLineUrl {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

/**
 * GitHub式のファイル行番号URLをパースする
 * @param url "contents/chapter1.txt#L42" または "contents/chapter1.txt#L4-L7" 形式
 * @returns パース結果
 */
export function parseFileLineUrl(url: string): ParsedFileLineUrl {
  const match = url.match(/^(.+?)(?:#L(\d+)(?:-L?(\d+))?)?$/);
  if (!match) {
    throw new Error(`Invalid file line URL format: ${url}`);
  }

  const filePath = match[1] ?? '';

  // ファイルパスの最低限のバリデーション
  if (filePath.length === 0 || filePath.trim().length === 0) {
    throw new Error(`Invalid file line URL format: ${url}`);
  }

  // 行番号指定がある場合のバリデーション
  if (url.includes('#L')) {
    const linePattern = /#L\d+(?:-L?\d+)?$/;
    if (!linePattern.test(url)) {
      throw new Error(`Invalid file line URL format: ${url}`);
    }
  }

  return {
    filePath,
    startLine: match[2] !== undefined ? parseInt(match[2], 10) : undefined,
    endLine: match[3] !== undefined ? parseInt(match[3], 10) : undefined,
  };
}

/**
 * ファイルパスと行番号からGitHub式のファイル行番号URLを生成する
 * @param filePath ファイルパス
 * @param startLine 開始行番号
 * @param endLine 終了行番号（省略可）
 * @returns GitHub式のファイル行番号URL
 */
export function formatFileLineUrl(filePath: string, startLine?: number, endLine?: number): string {
  if (startLine === undefined) {
    return filePath;
  }
  if (endLine !== undefined && endLine !== startLine) {
    return `${filePath}#L${startLine}-L${endLine}`;
  }
  return `${filePath}#L${startLine}`;
}

// 後方互換性のためのエイリアス（コメント機能で使用）
export const parseTargetFile = parseFileLineUrl;
export const formatTargetFile = formatFileLineUrl;
export type ParsedTargetFile = ParsedFileLineUrl;
