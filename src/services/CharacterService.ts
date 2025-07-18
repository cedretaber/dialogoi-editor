import * as path from 'path';
import { FileOperationService } from '../interfaces/FileOperationService.js';

export class CharacterService {
  constructor(private fileOperationService: FileOperationService) {}

  /**
   * マークダウンファイルから表示名を取得
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 表示名（見出しが見つからない場合はファイル名）
   */
  extractDisplayName(fileAbsolutePath: string): string {
    try {
      const fileUri = this.fileOperationService.createFileUri(fileAbsolutePath);

      if (!this.fileOperationService.existsSync(fileUri)) {
        return this.getFileNameWithoutExtension(fileAbsolutePath);
      }

      const content = this.fileOperationService.readFileSync(fileUri, 'utf-8');
      const lines = content.split('\n');

      // 最初の # 見出しを探す
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('# ')) {
          return trimmedLine.substring(2).trim();
        }
      }

      // 見出しが見つからない場合はファイル名（拡張子なし）を返す
      return this.getFileNameWithoutExtension(fileAbsolutePath);
    } catch (error) {
      console.error('表示名の取得に失敗しました:', error);
      return this.getFileNameWithoutExtension(fileAbsolutePath);
    }
  }

  /**
   * ファイルパスから拡張子を除いたファイル名を取得
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 拡張子を除いたファイル名
   */
  private getFileNameWithoutExtension(fileAbsolutePath: string): string {
    const fileName = path.basename(fileAbsolutePath);
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
  }
}
