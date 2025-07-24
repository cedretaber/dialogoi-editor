import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { HyperlinkExtractorService } from './HyperlinkExtractorService.js';
import { FilePathMapService } from './FilePathMapService.js';

export interface ReferenceEntry {
  path: string;
  source: 'manual' | 'hyperlink'; // 手動追加かハイパーリンク由来か
}

export interface ReferenceInfo {
  references: ReferenceEntry[]; // このファイルが参照しているファイル
  referencedBy: ReferenceEntry[]; // このファイルを参照しているファイル
}

export class ReferenceManager {
  private static instance: ReferenceManager | null = null;
  private referencesMap: Map<string, ReferenceInfo> = new Map();
  private novelRoot: string | null = null;
  private fileRepository: FileRepository | null = null;
  private hyperlinkExtractorService: HyperlinkExtractorService | null = null;
  private filePathMapService: FilePathMapService | null = null;

  private constructor() {}

  static getInstance(): ReferenceManager {
    if (!ReferenceManager.instance) {
      ReferenceManager.instance = new ReferenceManager();
    }
    return ReferenceManager.instance;
  }

  /**
   * 初期化済みかどうかを確認
   */
  isInitialized(): boolean {
    return this.novelRoot !== null && this.fileRepository !== null;
  }

  /**
   * 参照関係を初期化（全.dialogoi-meta.yamlを走査）
   */
  initialize(novelRoot: string, fileRepository: FileRepository): void {
    this.novelRoot = novelRoot;
    this.fileRepository = fileRepository;
    this.referencesMap.clear();

    // ServiceContainerから新しいサービスを取得
    const serviceContainer = ServiceContainer.getInstance();
    this.filePathMapService = serviceContainer.getFilePathMapService();
    this.hyperlinkExtractorService = serviceContainer.getHyperlinkExtractorService();

    // ファイルマップを構築
    this.filePathMapService.buildFileMap(novelRoot);

    this.scanAllReferences(novelRoot);
  }

  /**
   * 参照関係を更新（単一ファイルの変更時）
   */
  updateFileReferences(filePath: string, newReferences: string[]): void {
    if (this.novelRoot === null) {
      return;
    }

    const relativePath = path.relative(this.novelRoot, filePath).replace(/\\/g, '/');

    // 既存の手動参照を削除
    this.removeFileReferences(relativePath, 'manual');

    // 新しい手動参照を追加
    this.addFileReferences(relativePath, newReferences, 'manual');
  }

  /**
   * ファイルのハイパーリンク参照を更新（非同期版）
   */
  async updateFileHyperlinkReferencesAsync(filePath: string): Promise<void> {
    if (this.novelRoot === null || this.hyperlinkExtractorService === null) {
      return;
    }

    const relativePath = path.relative(this.novelRoot, filePath).replace(/\\/g, '/');

    // 既存のハイパーリンク参照を削除
    this.removeFileReferences(relativePath, 'hyperlink');

    // 新しいハイパーリンク参照を抽出・追加
    const hyperlinkReferences =
      await this.hyperlinkExtractorService.extractProjectLinksAsync(filePath);
    this.addFileReferences(relativePath, hyperlinkReferences, 'hyperlink');
  }

  /**
   * ファイルの全参照関係を更新（手動+ハイパーリンク・非同期版）
   */
  async updateFileAllReferencesAsync(filePath: string, manualReferences: string[]): Promise<void> {
    this.updateFileReferences(filePath, manualReferences);
    await this.updateFileHyperlinkReferencesAsync(filePath);
  }

  /**
   * 指定ファイルの参照情報を取得
   */
  getReferences(filePath: string): ReferenceInfo {
    const relativePath =
      this.novelRoot !== null
        ? path.relative(this.novelRoot, filePath).replace(/\\/g, '/')
        : filePath;
    return this.referencesMap.get(relativePath) || { references: [], referencedBy: [] };
  }

  /**
   * 指定ファイルの手動参照のみ取得
   */
  getManualReferences(filePath: string): string[] {
    const info = this.getReferences(filePath);
    return info.references.filter((ref) => ref.source === 'manual').map((ref) => ref.path);
  }

  /**
   * 指定ファイルのハイパーリンク参照のみ取得
   */
  getHyperlinkReferences(filePath: string): string[] {
    const info = this.getReferences(filePath);
    return info.references.filter((ref) => ref.source === 'hyperlink').map((ref) => ref.path);
  }

  /**
   * 全参照パス配列を取得（後方互換性のため）
   */
  getAllReferencePaths(filePath: string): string[] {
    const info = this.getReferences(filePath);
    return info.references.map((ref) => ref.path);
  }

  /**
   * 参照関係をクリア
   */
  clear(): void {
    this.referencesMap.clear();
    this.novelRoot = null;
    this.fileRepository = null;
    this.hyperlinkExtractorService = null;
    this.filePathMapService = null;
  }

  /**
   * 全.dialogoi-meta.yamlを再帰的に走査して参照関係を構築
   */
  private scanAllReferences(dirPath: string): void {
    this.scanDirectoryReferences(dirPath, '');
  }

  /**
   * 指定ディレクトリの.dialogoi-meta.yamlを読み込み、参照関係を構築
   */
  private scanDirectoryReferences(dirPath: string, relativeDirPath: string): void {
    if (!this.fileRepository) {
      return;
    }
    const metaYamlService = ServiceContainer.getInstance().getMetaYamlService();
    const meta = metaYamlService.loadMetaYaml(dirPath);
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
      } else {
        // ファイルの手動参照関係を追加
        if (file.references && file.references.length > 0) {
          this.addFileReferences(fileRelativePath, file.references, 'manual');
        }

        // ハイパーリンク参照を抽出・追加（.mdファイルのみ）
        if (
          file.name.endsWith('.md') &&
          this.novelRoot !== null &&
          this.novelRoot !== undefined &&
          this.novelRoot !== '' &&
          this.hyperlinkExtractorService
        ) {
          // TODO: ReferenceManagerの@deprecated削除時に対応
          // const absoluteFilePath = path.join(dirPath, file.name);
          // const hyperlinkReferences =
          //   this.hyperlinkExtractorService.extractProjectLinks(absoluteFilePath);
          // if (hyperlinkReferences.length > 0) {
          //   this.addFileReferences(fileRelativePath, hyperlinkReferences, 'hyperlink');
          // }
        }
      }
    }
  }

  /**
   * ファイルの参照関係を追加
   */
  private addFileReferences(
    sourceFile: string,
    referencedFiles: string[],
    source: 'manual' | 'hyperlink',
  ): void {
    // 正規化されたパスを使用
    const normalizedSourceFile = sourceFile.replace(/\\/g, '/');

    // 参照元ファイルのエントリを取得または作成
    let sourceInfo = this.referencesMap.get(normalizedSourceFile);
    if (!sourceInfo) {
      sourceInfo = { references: [], referencedBy: [] };
      this.referencesMap.set(normalizedSourceFile, sourceInfo);
    }

    // 参照先ファイルを追加
    for (const referencedFile of referencedFiles) {
      const normalizedReferencedFile = referencedFile.replace(/\\/g, '/');

      // 重複チェック（同じパス・同じソースの組み合わせ）
      const existingRef = sourceInfo.references.find(
        (ref) => ref.path === normalizedReferencedFile && ref.source === source,
      );

      if (!existingRef) {
        sourceInfo.references.push({
          path: normalizedReferencedFile,
          source: source,
        });
      }

      // 逆参照を追加
      let targetInfo = this.referencesMap.get(normalizedReferencedFile);
      if (!targetInfo) {
        targetInfo = { references: [], referencedBy: [] };
        this.referencesMap.set(normalizedReferencedFile, targetInfo);
      }

      const existingBackRef = targetInfo.referencedBy.find(
        (ref) => ref.path === normalizedSourceFile && ref.source === source,
      );

      if (!existingBackRef) {
        targetInfo.referencedBy.push({
          path: normalizedSourceFile,
          source: source,
        });
      }
    }
  }

  /**
   * ファイルの参照関係を削除
   */
  private removeFileReferences(sourceFile: string, sourceType?: 'manual' | 'hyperlink'): void {
    const normalizedSourceFile = sourceFile.replace(/\\/g, '/');
    const sourceInfo = this.referencesMap.get(normalizedSourceFile);

    if (sourceInfo) {
      // 削除対象の参照を特定
      const referencesToRemove = sourceType
        ? sourceInfo.references.filter((ref) => ref.source === sourceType)
        : sourceInfo.references;

      // 逆参照を削除
      for (const refEntry of referencesToRemove) {
        const targetInfo = this.referencesMap.get(refEntry.path);
        if (targetInfo) {
          targetInfo.referencedBy = targetInfo.referencedBy.filter(
            (backRef) =>
              !(
                backRef.path === normalizedSourceFile &&
                (!sourceType || backRef.source === sourceType)
              ),
          );
        }
      }

      // 参照元の参照リストから削除
      if (sourceType) {
        sourceInfo.references = sourceInfo.references.filter((ref) => ref.source !== sourceType);
      } else {
        sourceInfo.references = [];
      }
    }
  }

  /**
   * 参照先ファイルが存在するかチェック（非同期版）
   * TODO: Phase 3での利用を想定
   */
  async checkFileExistsAsync(referencedFile: string): Promise<boolean> {
    if (this.novelRoot === null || this.fileRepository === null) {
      return false;
    }

    const fullPath = path.join(this.novelRoot, referencedFile);
    const fileUri = this.fileRepository.createFileUri(fullPath);
    return this.fileRepository.existsAsync(fileUri);
  }

  /**
   * 存在しない参照先ファイルを取得（非同期版）
   * TODO: Phase 3での利用を想定
   */
  async getInvalidReferencesAsync(filePath: string): Promise<string[]> {
    const references = this.getReferences(filePath);
    const result: string[] = [];

    for (const ref of references.references) {
      const exists = await this.checkFileExistsAsync(ref.path);
      if (!exists) {
        result.push(ref.path);
      }
    }

    return result;
  }
}
