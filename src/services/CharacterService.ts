import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem, hasCharacterProperty } from '../models/DialogoiTreeItem.js';

export class CharacterService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

  /**
   * マークダウンファイルから表示名を取得（非同期版）
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns 表示名（見出しが見つからない場合はファイル名）
   */
  async extractDisplayName(fileAbsolutePath: string): Promise<string> {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return this.getFileNameWithoutExtension(fileAbsolutePath);
      }

      const content = await this.fileRepository.readFileAsync(fileUri, 'utf-8');
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

  /**
   * ファイルがキャラクターファイルかどうかを判定（非同期版）
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns キャラクターファイルの場合true
   */
  async isCharacterFile(fileAbsolutePath: string): Promise<boolean> {
    try {
      const dirPath = path.dirname(fileAbsolutePath);
      const fileName = path.basename(fileAbsolutePath);
      const meta = await this.metaYamlService.loadMetaYamlAsync(dirPath);

      if (!meta) {
        return false;
      }

      const fileItem = meta.files.find((item) => item.name === fileName);
      return fileItem !== undefined && hasCharacterProperty(fileItem);
    } catch {
      return false;
    }
  }

  /**
   * プロジェクトルート相対パスからファイル情報を取得（非同期版）
   * @param projectRelativePath プロジェクトルートからの相対パス
   * @param novelRootAbsolutePath プロジェクトルートの絶対パス
   * @returns ファイル情報またはnull
   */
  async getFileInfo(
    projectRelativePath: string,
    novelRootAbsolutePath: string,
  ): Promise<DialogoiTreeItem | null> {
    try {
      const absolutePath = path.join(novelRootAbsolutePath, projectRelativePath);
      const dirPath = path.dirname(absolutePath);
      const fileName = path.basename(absolutePath);
      const meta = await this.metaYamlService.loadMetaYamlAsync(dirPath);

      if (!meta) {
        return null;
      }

      const fileItem = meta.files.find((item) => item.name === fileName);
      return fileItem || null;
    } catch {
      return null;
    }
  }
}
