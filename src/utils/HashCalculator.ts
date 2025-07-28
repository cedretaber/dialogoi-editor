import { createHash } from 'crypto';

/**
 * ハッシュ計算ユーティリティ
 * 純粋なハッシュ計算関数群（ファイル読み込みは呼び出し元が実行）
 */
export class HashCalculator {
  /**
   * 文字列の SHA-256 ハッシュを計算
   * @param content ハッシュ化する文字列
   * @returns SHA-256 ハッシュ文字列（プレフィックス付き）
   */
  static calculateContentHash(content: string): string {
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * バイナリデータの SHA-256 ハッシュを計算
   * @param data ハッシュ化するバイナリデータ
   * @returns SHA-256 ハッシュ文字列（プレフィックス付き）
   */
  static calculateBinaryHash(data: Buffer): string {
    const hash = createHash('sha256').update(data).digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * ハッシュ値を検証
   * @param content 検証対象の文字列
   * @param expectedHash 期待されるハッシュ値
   * @returns ハッシュが一致するかどうか
   */
  static verifyContentHash(content: string, expectedHash: string): boolean {
    const actualHash = HashCalculator.calculateContentHash(content);
    return actualHash === expectedHash;
  }

  /**
   * バイナリデータのハッシュ値を検証
   * @param data 検証対象のバイナリデータ
   * @param expectedHash 期待されるハッシュ値
   * @returns ハッシュが一致するかどうか
   */
  static verifyBinaryHash(data: Buffer, expectedHash: string): boolean {
    const actualHash = HashCalculator.calculateBinaryHash(data);
    return actualHash === expectedHash;
  }

  /**
   * ハッシュ文字列からアルゴリズムを取得
   * @param hash ハッシュ文字列
   * @returns アルゴリズム名
   */
  static getHashAlgorithm(hash: string): string {
    const colonIndex = hash.indexOf(':');
    if (colonIndex === -1) {
      return 'unknown';
    }
    return hash.substring(0, colonIndex);
  }

  /**
   * ハッシュ文字列からハッシュ値を取得
   * @param hash ハッシュ文字列
   * @returns ハッシュ値
   */
  static getHashValue(hash: string): string {
    const colonIndex = hash.indexOf(':');
    if (colonIndex === -1) {
      return hash;
    }
    return hash.substring(colonIndex + 1);
  }
}
