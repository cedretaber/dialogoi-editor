import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { ProjectPathNormalizationService } from './ProjectPathNormalizationService.js';

/**
 * リンク更新結果
 */
export interface LinkUpdateResult {
  success: boolean;
  message: string;
  updatedFiles: string[];
  failedFiles: { path: string; error: string }[];
  totalScannedFiles: number;
}

/**
 * プロジェクト全体のリンク更新サービス
 */
export class ProjectLinkUpdateService {
  private pathNormalizationService: ProjectPathNormalizationService;

  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
    private novelRootAbsolutePath: string,
  ) {
    this.pathNormalizationService = new ProjectPathNormalizationService(novelRootAbsolutePath);
  }

  /**
   * ファイル移動・改名時にプロジェクト全体のリンクを更新
   */
  updateLinksAfterFileOperation(
    oldProjectRelativePath: string,
    newProjectRelativePath: string,
  ): LinkUpdateResult {
    const updatedFiles: string[] = [];
    const failedFiles: { path: string; error: string }[] = [];
    let totalScannedFiles = 0;

    try {
      // プロジェクト内の全.mdファイルを検索してハイパーリンク更新
      const markdownFiles = this.findAllMarkdownFiles();
      totalScannedFiles += markdownFiles.length;

      for (const markdownFile of markdownFiles) {
        try {
          const updated = this.updateLinksInMarkdownFile(
            markdownFile,
            oldProjectRelativePath,
            newProjectRelativePath,
          );
          if (updated) {
            updatedFiles.push(markdownFile);
          }
        } catch (error) {
          failedFiles.push({
            path: markdownFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // .dialogoi-meta.yamlファイルのreferencesも更新
      const metaFiles = this.findAllMetaYamlFiles();
      totalScannedFiles += metaFiles.length;

      for (const metaFile of metaFiles) {
        try {
          const updated = this.updateReferencesInMetaFile(
            metaFile,
            oldProjectRelativePath,
            newProjectRelativePath,
          );
          if (updated) {
            updatedFiles.push(metaFile);
          }
        } catch (error) {
          failedFiles.push({
            path: metaFile,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const isSuccess = failedFiles.length === 0;
      const message = isSuccess
        ? `${updatedFiles.length}個のファイルのリンクを更新しました`
        : `${updatedFiles.length}個のファイルを更新、${failedFiles.length}個のファイルで失敗しました`;

      return {
        success: isSuccess,
        message,
        updatedFiles,
        failedFiles,
        totalScannedFiles,
      };
    } catch (error) {
      return {
        success: false,
        message: `リンク更新処理でエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        updatedFiles,
        failedFiles,
        totalScannedFiles,
      };
    }
  }

  /**
   * 単一マークダウンファイル内のリンクを更新
   */
  private updateLinksInMarkdownFile(
    fileAbsolutePath: string,
    oldProjectRelativePath: string,
    newProjectRelativePath: string,
  ): boolean {
    const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);
    const content = this.fileRepository.readFileSync(fileUri, 'utf8');

    // マークダウンリンクの正規表現パターン
    // [テキスト](リンク先) および [テキスト](リンク先 "タイトル") の形式をマッチ
    const linkPattern = /\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;
    let hasUpdates = false;

    const updatedContent = content.replace(
      linkPattern,
      (match: string, text: string, url: string) => {
        // プロジェクト内リンクのみ更新対象
        const normalizedUrl = this.pathNormalizationService.normalizeToProjectPath(
          url,
          fileAbsolutePath,
        );

        if (
          normalizedUrl !== null &&
          normalizedUrl !== '' &&
          this.pathNormalizationService.isSamePath(normalizedUrl, oldProjectRelativePath)
        ) {
          hasUpdates = true;
          return `[${text}](${newProjectRelativePath})`;
        }

        return match;
      },
    );

    if (hasUpdates) {
      this.fileRepository.writeFileSync(fileUri, updatedContent);
    }

    return hasUpdates;
  }

  /**
   * .dialogoi-meta.yamlファイルのreferencesを更新
   */
  private updateReferencesInMetaFile(
    metaFileAbsolutePath: string,
    oldProjectRelativePath: string,
    newProjectRelativePath: string,
  ): boolean {
    const dirPath = path.dirname(metaFileAbsolutePath);
    const meta = this.metaYamlService.loadMetaYaml(dirPath);

    if (!meta) {
      return false;
    }

    let hasUpdates = false;

    // 各ファイルのreferencesをチェック
    for (const fileItem of meta.files) {
      if (fileItem.references && Array.isArray(fileItem.references)) {
        const updatedReferences = fileItem.references.map((ref) => {
          if (this.pathNormalizationService.isSamePath(ref, oldProjectRelativePath)) {
            hasUpdates = true;
            return newProjectRelativePath;
          }
          return ref;
        });

        if (hasUpdates) {
          fileItem.references = updatedReferences;
        }
      }
    }

    if (hasUpdates) {
      const saveResult = this.metaYamlService.saveMetaYaml(dirPath, meta);
      return saveResult;
    }

    return false;
  }

  /**
   * プロジェクト内の全.mdファイルを再帰的に検索
   */
  private findAllMarkdownFiles(): string[] {
    const markdownFiles: string[] = [];

    const walkDirectory = (dirAbsolutePath: string): void => {
      const dirUri = this.fileRepository.createFileUri(dirAbsolutePath);
      try {
        const entries = this.fileRepository.readdirSync(dirUri);

        for (const entry of entries) {
          const entryName = typeof entry === 'string' ? entry : entry.name;
          const entryAbsolutePath = path.join(dirAbsolutePath, entryName);
          const entryUri = this.fileRepository.createFileUri(entryAbsolutePath);

          try {
            const stat = this.fileRepository.lstatSync(entryUri);

            if (stat.isDirectory()) {
              // ディレクトリの場合は再帰的に走査
              walkDirectory(entryAbsolutePath);
            } else if (entryName.endsWith('.md')) {
              // .mdファイルの場合はリストに追加
              markdownFiles.push(entryAbsolutePath);
            }
          } catch {
            // ファイルのstat取得に失敗した場合は無視
            continue;
          }
        }
      } catch {
        // ディレクトリ読み込みエラーは無視
      }
    };

    walkDirectory(this.novelRootAbsolutePath);
    return markdownFiles;
  }

  /**
   * プロジェクト内の全.dialogoi-meta.yamlファイルを検索
   */
  private findAllMetaYamlFiles(): string[] {
    const metaFiles: string[] = [];

    const walkDirectory = (dirAbsolutePath: string): void => {
      const dirUri = this.fileRepository.createFileUri(dirAbsolutePath);
      try {
        const entries = this.fileRepository.readdirSync(dirUri);

        for (const entry of entries) {
          const entryName = typeof entry === 'string' ? entry : entry.name;
          if (entryName === '.dialogoi-meta.yaml') {
            const metaFileAbsolutePath = path.join(dirAbsolutePath, entryName);
            metaFiles.push(metaFileAbsolutePath);
          } else {
            const entryAbsolutePath = path.join(dirAbsolutePath, entryName);
            const entryUri = this.fileRepository.createFileUri(entryAbsolutePath);

            try {
              const stat = this.fileRepository.lstatSync(entryUri);
              if (stat.isDirectory()) {
                walkDirectory(entryAbsolutePath);
              }
            } catch {
              // ファイルのstat取得に失敗した場合は無視
              continue;
            }
          }
        }
      } catch {
        // ディレクトリ読み込みエラーは無視
      }
    };

    walkDirectory(this.novelRootAbsolutePath);
    return metaFiles;
  }

  /**
   * 指定ファイルがプロジェクト内のリンクを含むかチェック（デバッグ用）
   */
  scanFileForProjectLinks(fileAbsolutePath: string): string[] {
    const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);
    const content = this.fileRepository.readFileSync(fileUri, 'utf8');
    const projectLinks: string[] = [];

    const linkPattern = /\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const url = match[2];
      if (url !== undefined && url !== null && url !== '') {
        const normalizedUrl = this.pathNormalizationService.normalizeToProjectPath(
          url,
          fileAbsolutePath,
        );

        if (normalizedUrl !== null && normalizedUrl !== '') {
          projectLinks.push(normalizedUrl);
        }
      }
    }

    return projectLinks;
  }
}
