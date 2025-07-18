import { createHash } from 'crypto';
import { FileRepository } from '../repositories/FileRepository.js';
import { Uri } from '../interfaces/Uri.js';

/**
 * ファイルハッシュ計算サービス
 */
export class HashService {
  constructor(public fileRepository: FileRepository) {}
  /**
   * ファイルの SHA-256 ハッシュを計算
   * @param fileUri ファイルの URI
   * @returns SHA-256 ハッシュ文字列（プレフィックス付き）
   */
  calculateFileHash(fileUri: Uri): string {
    try {
      const content = this.fileRepository.readFileSync(fileUri, null);
      const hash = createHash('sha256').update(content).digest('hex');
      return `sha256:${hash}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`ファイルハッシュの計算に失敗しました: ${errorMessage}`);
    }
  }

  /**
   * ファイルの内容からハッシュを計算
   * @param content ファイルの内容（文字列）
   * @returns SHA-256 ハッシュ文字列（プレフィックス付き）
   */
  calculateContentHash(content: string): string {
    const hash = createHash('sha256').update(content, 'utf8').digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * ハッシュを検証
   * @param fileUri ファイルの URI
   * @param expectedHash 期待されるハッシュ値
   * @returns ハッシュが一致するかどうか
   */
  verifyFileHash(fileUri: Uri, expectedHash: string): boolean {
    try {
      const actualHash = this.calculateFileHash(fileUri);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('ハッシュ検証エラー:', error);
      return false;
    }
  }

  /**
   * ハッシュ文字列からアルゴリズムを取得
   * @param hash ハッシュ文字列
   * @returns アルゴリズム名
   */
  getHashAlgorithm(hash: string): string {
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
  getHashValue(hash: string): string {
    const colonIndex = hash.indexOf(':');
    if (colonIndex === -1) {
      return hash;
    }
    return hash.substring(colonIndex + 1);
  }
}
