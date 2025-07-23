import { FileRepository } from '../repositories/FileRepository.js';
import { FilePathMapService } from './FilePathMapService.js';

/**
 * マークダウンリンクの情報
 */
export interface MarkdownLink {
  /** リンクテキスト */
  text: string;
  /** リンクURL */
  url: string;
  /** リンクタイトル（任意） */
  title?: string;
}

/**
 * マークダウンファイルからハイパーリンクを抽出し、プロジェクト内リンクを管理するサービス
 */
export class HyperlinkExtractorService {
  constructor(
    private fileRepository: FileRepository,
    private filePathMapService: FilePathMapService,
  ) {}

  /**
   * マークダウンファイルからプロジェクト内のハイパーリンクを抽出（非同期版）
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns プロジェクト内ファイルの相対パス配列
   * TODO: Phase 3での利用を想定
   */
  async extractProjectLinksAsync(fileAbsolutePath: string): Promise<string[]> {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!(await this.fileRepository.existsAsync(fileUri))) {
        return [];
      }

      const content = await this.fileRepository.readFileAsync(fileUri, 'utf8');
      const allLinks = this.parseMarkdownLinks(content);
      const projectLinks = this.filterProjectLinks(allLinks, fileAbsolutePath);

      return projectLinks;
    } catch {
      return [];
    }
  }

  /**
   * マークダウンファイルからプロジェクト内のハイパーリンクを抽出
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns プロジェクト内ファイルの相対パス配列
   * @deprecated Use extractProjectLinksAsync instead for better VSCode integration
   */
  extractProjectLinks(fileAbsolutePath: string): string[] {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!this.fileRepository.existsSync(fileUri)) {
        return [];
      }

      const content = this.fileRepository.readFileSync(fileUri, 'utf-8');
      const allLinks = this.parseMarkdownLinks(content);
      const projectLinks = this.filterProjectLinks(allLinks, fileAbsolutePath);

      return projectLinks;
    } catch {
      return [];
    }
  }

  /**
   * マークダウンコンテンツからリンクをパース
   * @param content マークダウンコンテンツ
   * @returns パースされたリンク配列
   */
  parseMarkdownLinks(content: string): MarkdownLink[] {
    const links: MarkdownLink[] = [];

    // マークダウンリンクの正規表現パターン
    // [テキスト](URL) および [テキスト](URL "タイトル") の形式をマッチ
    // 空のURLも許可するために*を使用
    const linkPattern = /\[([^\]]*)\]\(([^\s)]*)(?:\s+"([^"]*)")?\)/g;

    let match;
    while ((match = linkPattern.exec(content)) !== null) {
      const [, text, url, title] = match;
      links.push({
        text: text ?? '',
        url: url ?? '',
        title: title ?? undefined,
      });
    }

    return links;
  }

  /**
   * リンクからプロジェクト内リンクのみをフィルタリング
   * @param links 全リンク配列
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクト内ファイルの相対パス配列
   */
  filterProjectLinks(links: MarkdownLink[], currentFileAbsolutePath: string): string[] {
    const projectLinks: string[] = [];

    for (const link of links) {
      // 外部リンクをスキップ
      if (this.isExternalLink(link.url)) {
        continue;
      }

      // プロジェクト内ファイルかチェック
      const isProjectFile = this.filePathMapService.isProjectFile(
        link.url,
        currentFileAbsolutePath,
      );

      if (isProjectFile) {
        // プロジェクトルートからの相対パスに正規化
        const normalizedPath = this.normalizeToProjectRelativePath(
          link.url,
          currentFileAbsolutePath,
        );

        if (
          normalizedPath !== null &&
          normalizedPath !== undefined &&
          normalizedPath !== '' &&
          !projectLinks.includes(normalizedPath)
        ) {
          projectLinks.push(normalizedPath);
        }
      }
    }

    return projectLinks;
  }

  /**
   * 外部リンクかどうかを判定
   * @param url URL
   * @returns 外部リンクの場合true
   */
  private isExternalLink(url: string): boolean {
    return (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('file://') ||
      url.startsWith('mailto:') ||
      url.startsWith('#')
    ); // ページ内アンカー
  }

  /**
   * リンクをプロジェクトルートからの相対パスに正規化
   * @param linkUrl リンクURL
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクトルートからの相対パス、解決できない場合はnull
   */
  private normalizeToProjectRelativePath(
    linkUrl: string,
    currentFileAbsolutePath: string,
  ): string | null {
    try {
      // FilePathMapServiceで既にプロジェクト相対パスが計算済みなので、それを直接取得
      const resolvedRelativePath = this.filePathMapService.isProjectFile(
        linkUrl,
        currentFileAbsolutePath,
      )
        ? this.filePathMapService.resolveRelativePathFromRoot(linkUrl, currentFileAbsolutePath)
        : null;

      return resolvedRelativePath;
    } catch {
      return null;
    }
  }

  /**
   * ファイルの更新時にハイパーリンクを再抽出（非同期版）
   * @param fileAbsolutePath 更新されたファイルの絶対パス
   * @returns 新しいプロジェクト内リンク配列
   * TODO: Phase 3での利用を想定
   */
  async refreshFileLinksAsync(fileAbsolutePath: string): Promise<string[]> {
    return this.extractProjectLinksAsync(fileAbsolutePath);
  }

  /**
   * ファイルの更新時にハイパーリンクを再抽出
   * @param fileAbsolutePath 更新されたファイルの絶対パス
   * @returns 新しいプロジェクト内リンク配列
   * @deprecated Use refreshFileLinksAsync instead for better VSCode integration
   */
  refreshFileLinks(fileAbsolutePath: string): string[] {
    return this.extractProjectLinks(fileAbsolutePath);
  }

  /**
   * 複数ファイルのハイパーリンクを一括抽出（非同期版）
   * @param fileAbsolutePaths ファイルの絶対パス配列
   * @returns ファイルパスをキーとした、プロジェクト内リンクのマップ
   * TODO: Phase 3での利用を想定
   */
  async extractProjectLinksFromFilesAsync(
    fileAbsolutePaths: string[],
  ): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    for (const filePath of fileAbsolutePaths) {
      const links = await this.extractProjectLinksAsync(filePath);
      result.set(filePath, links);
    }

    return result;
  }

  /**
   * 複数ファイルのハイパーリンクを一括抽出
   * @param fileAbsolutePaths ファイルの絶対パス配列
   * @returns ファイルパスをキーとした、プロジェクト内リンクのマップ
   * @deprecated Use extractProjectLinksFromFilesAsync instead for better VSCode integration
   */
  extractProjectLinksFromFiles(fileAbsolutePaths: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>();

    for (const filePath of fileAbsolutePaths) {
      const links = this.extractProjectLinks(filePath);
      result.set(filePath, links);
    }

    return result;
  }
}
