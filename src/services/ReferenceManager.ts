import * as path from 'path';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';
import { FileOperationService } from '../interfaces/FileOperationService.js';

export interface ReferenceInfo {
  references: string[]; // このファイルが参照しているファイル
  referencedBy: string[]; // このファイルを参照しているファイル
}

export class ReferenceManager {
  private static instance: ReferenceManager | null = null;
  private referencesMap: Map<string, ReferenceInfo> = new Map();
  private novelRoot: string | null = null;
  private fileOperationService: FileOperationService | null = null;

  private constructor() {}

  static getInstance(): ReferenceManager {
    if (!ReferenceManager.instance) {
      ReferenceManager.instance = new ReferenceManager();
    }
    return ReferenceManager.instance;
  }

  /**
   * 参照関係を初期化（全meta.yamlを走査）
   */
  initialize(novelRoot: string, fileOperationService: FileOperationService): void {
    this.novelRoot = novelRoot;
    this.fileOperationService = fileOperationService;
    this.referencesMap.clear();
    this.scanAllReferences(novelRoot);
  }

  /**
   * 参照関係を更新（単一ファイルの変更時）
   */
  updateFileReferences(filePath: string, newReferences: string[]): void {
    if (this.novelRoot === null) {
      return;
    }

    const relativePath = path.relative(this.novelRoot, filePath);

    // 既存の参照を削除
    this.removeFileReferences(relativePath);

    // 新しい参照を追加
    this.addFileReferences(relativePath, newReferences);
  }

  /**
   * 指定ファイルの参照情報を取得
   */
  getReferences(filePath: string): ReferenceInfo {
    const relativePath =
      this.novelRoot !== null ? path.relative(this.novelRoot, filePath) : filePath;
    return this.referencesMap.get(relativePath) || { references: [], referencedBy: [] };
  }

  /**
   * 参照関係をクリア
   */
  clear(): void {
    this.referencesMap.clear();
    this.novelRoot = null;
  }

  /**
   * 全meta.yamlを再帰的に走査して参照関係を構築
   */
  private scanAllReferences(dirPath: string): void {
    this.scanDirectoryReferences(dirPath, '');
  }

  /**
   * 指定ディレクトリのmeta.yamlを読み込み、参照関係を構築
   */
  private scanDirectoryReferences(dirPath: string, relativeDirPath: string): void {
    const meta = MetaYamlUtils.loadMetaYaml(dirPath);
    if (!meta) {
      return;
    }

    // このディレクトリ内のファイルの参照関係を処理
    for (const file of meta.files) {
      const fileRelativePath = path.join(relativeDirPath, file.name);

      if (file.type === 'subdirectory') {
        // サブディレクトリを再帰的に処理
        const subDirPath = path.join(dirPath, file.name);
        this.scanDirectoryReferences(subDirPath, fileRelativePath);
      } else if (file.references && file.references.length > 0) {
        // ファイルの参照関係を追加
        this.addFileReferences(fileRelativePath, file.references);
      }
    }
  }

  /**
   * ファイルの参照関係を追加
   */
  private addFileReferences(sourceFile: string, referencedFiles: string[]): void {
    // 正規化されたパスを使用
    const normalizedSourceFile = path.normalize(sourceFile);

    // 参照元ファイルのエントリを取得または作成
    let sourceInfo = this.referencesMap.get(normalizedSourceFile);
    if (!sourceInfo) {
      sourceInfo = { references: [], referencedBy: [] };
      this.referencesMap.set(normalizedSourceFile, sourceInfo);
    }

    // 参照先ファイルを追加
    for (const referencedFile of referencedFiles) {
      const normalizedReferencedFile = path.normalize(referencedFile);

      // 重複チェック
      if (!sourceInfo.references.includes(normalizedReferencedFile)) {
        sourceInfo.references.push(normalizedReferencedFile);
      }

      // 逆参照を追加
      let targetInfo = this.referencesMap.get(normalizedReferencedFile);
      if (!targetInfo) {
        targetInfo = { references: [], referencedBy: [] };
        this.referencesMap.set(normalizedReferencedFile, targetInfo);
      }

      if (!targetInfo.referencedBy.includes(normalizedSourceFile)) {
        targetInfo.referencedBy.push(normalizedSourceFile);
      }
    }
  }

  /**
   * ファイルの参照関係を削除
   */
  private removeFileReferences(sourceFile: string): void {
    const normalizedSourceFile = path.normalize(sourceFile);
    const sourceInfo = this.referencesMap.get(normalizedSourceFile);

    if (sourceInfo) {
      // 逆参照を削除
      for (const referencedFile of sourceInfo.references) {
        const targetInfo = this.referencesMap.get(referencedFile);
        if (targetInfo) {
          targetInfo.referencedBy = targetInfo.referencedBy.filter(
            (file) => file !== normalizedSourceFile,
          );
        }
      }

      // 参照元の参照リストをクリア
      sourceInfo.references = [];
    }
  }

  /**
   * 参照先ファイルが存在するかチェック
   */
  checkFileExists(referencedFile: string): boolean {
    if (this.novelRoot === null || this.fileOperationService === null) {
      return false;
    }

    const fullPath = path.join(this.novelRoot, referencedFile);
    const fileUri = this.fileOperationService.createFileUri(fullPath);
    return this.fileOperationService.existsSync(fileUri);
  }

  /**
   * 存在しない参照先ファイルを取得
   */
  getInvalidReferences(filePath: string): string[] {
    const references = this.getReferences(filePath);
    return references.references.filter((ref) => !this.checkFileExists(ref));
  }

  /**
   * デバッグ用：現在の参照関係を表示
   */
  debugPrintReferences(): void {
    console.warn('=== Reference Manager Debug ===');
    for (const [file, info] of this.referencesMap) {
      console.warn(`${file}:`);
      console.warn(`  references: [${info.references.join(', ')}]`);
      console.warn(`  referencedBy: [${info.referencedBy.join(', ')}]`);
    }
  }
}
