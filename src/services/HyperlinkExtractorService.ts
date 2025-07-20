import * as path from 'path';
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
   * マークダウンファイルからプロジェクト内のハイパーリンクを抽出
   * @param fileAbsolutePath ファイルの絶対パス
   * @returns プロジェクト内ファイルの相対パス配列
   */
  extractProjectLinks(fileAbsolutePath: string): string[] {
    try {
      const fileUri = this.fileRepository.createFileUri(fileAbsolutePath);

      if (!this.fileRepository.existsSync(fileUri)) {
        return [];
      }

      const content = this.fileRepository.readFileSync(fileUri, 'utf-8');
      const allLinks = this.parseMarkdownLinks(content);

      return this.filterProjectLinks(allLinks, fileAbsolutePath);
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
      if (this.filePathMapService.isProjectFile(link.url, currentFileAbsolutePath)) {
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
      // FilePathMapService で解決した絶対パスから相対パスを取得する方法を使用
      const resolvedAbsolutePath = this.filePathMapService.resolveFileAbsolutePath(
        linkUrl,
        currentFileAbsolutePath,
      );
      if (
        resolvedAbsolutePath === null ||
        resolvedAbsolutePath === undefined ||
        resolvedAbsolutePath === ''
      ) {
        return null;
      }

      // resolveFileAbsolutePath で既に正しい絶対パスが取得できているので、
      // そこから相対パスを計算する
      return this.extractRelativePathFromAbsolute(resolvedAbsolutePath, currentFileAbsolutePath);
    } catch {
      return null;
    }
  }

  /**
   * 絶対パスからプロジェクト相対パスを抽出
   * @param absolutePath 絶対パス
   * @param currentFileAbsolutePath 現在のファイルの絶対パス
   * @returns プロジェクト相対パス
   */
  private extractRelativePathFromAbsolute(
    absolutePath: string,
    currentFileAbsolutePath: string,
  ): string | null {
    try {
      // currentFileの親ディレクトリから相対的にリンクパスがどこを指しているかを計算
      const currentDir = path.dirname(currentFileAbsolutePath);
      let testPath = currentDir;

      // プロジェクトルートを見つけるまで上に辿る
      while (testPath !== path.dirname(testPath)) {
        const metaYamlPath = path.join(testPath, '.dialogoi-meta.yaml');
        const fileUri = this.fileRepository.createFileUri(metaYamlPath);

        if (this.fileRepository.existsSync(fileUri)) {
          // .dialogoi-meta.yaml が見つかった = プロジェクトルート候補
          const content = this.fileRepository.readFileSync(fileUri, 'utf-8');
          if (content.includes('project_name:')) {
            // プロジェクトルートが見つかった
            const relativePath = path.relative(testPath, absolutePath);
            return relativePath.replace(/\\/g, '/');
          }
        }
        testPath = path.dirname(testPath);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * ファイルの更新時にハイパーリンクを再抽出
   * @param fileAbsolutePath 更新されたファイルの絶対パス
   * @returns 新しいプロジェクト内リンク配列
   */
  refreshFileLinks(fileAbsolutePath: string): string[] {
    return this.extractProjectLinks(fileAbsolutePath);
  }

  /**
   * 複数ファイルのハイパーリンクを一括抽出
   * @param fileAbsolutePaths ファイルの絶対パス配列
   * @returns ファイルパスをキーとした、プロジェクト内リンクのマップ
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
