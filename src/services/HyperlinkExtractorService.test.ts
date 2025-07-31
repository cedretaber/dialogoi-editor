import { mock, MockProxy } from 'jest-mock-extended';
import { HyperlinkExtractorService } from './HyperlinkExtractorService.js';
import { FilePathMapService } from './FilePathMapService.js';
import { FileRepository } from '../repositories/FileRepository.js';

describe('HyperlinkExtractorService テストスイート', () => {
  let service: HyperlinkExtractorService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockFilePathMapService: MockProxy<FilePathMapService>;

  // ファイルシステムの状態をシミュレート
  const fileSystem = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem.clear();
    
    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockFilePathMapService = mock<FilePathMapService>();
    
    // ファイルシステムのモック実装
    mockFileRepository.readFileAsync.mockImplementation(async (uri: any, encoding?: any): Promise<any> => {
      const path = typeof uri === 'string' ? uri : uri.fsPath;
      const content = fileSystem.get(path);
      if (content === undefined) {
        throw new Error(`File not found: ${path}`);
      }
      if (encoding) {
        return content;
      }
      return new TextEncoder().encode(content);
    });
    
    mockFileRepository.existsAsync.mockImplementation(async (uri) => {
      const path = typeof uri === 'string' ? uri : uri.fsPath;
      return fileSystem.has(path);
    });
    
    mockFileRepository.createFileUri.mockImplementation((path) => ({
      fsPath: path,
      scheme: 'file',
      authority: '',
      path: path,
      query: '',
      fragment: '',
      with: jest.fn(),
      toJSON: jest.fn(),
      toString: jest.fn(() => path)
    }));
    
    // FilePathMapServiceのモック設定
    mockFilePathMapService.buildFileMap.mockResolvedValue();
    mockFilePathMapService.isProjectFile.mockImplementation((relativePath) => {
      // 外部URLやアンカーは除外
      if (relativePath.startsWith('http') || relativePath.startsWith('mailto') || relativePath.startsWith('#')) {
        return false;
      }
      // プロジェクト内のファイルとして扱うパターン
      const projectFiles = [
        'settings/world.md',
        'settings/character.md', 
        'target.md',
        'contents/01_prologue.txt',
        './settings/world.md',
        '../settings/world.md'
      ];
      return projectFiles.includes(relativePath) || relativePath.includes('settings/world.md') ||
             relativePath.includes('settings/character.md') || relativePath.includes('target.md') ||
             relativePath.includes('contents/01_prologue.txt');
    });
    mockFilePathMapService.resolveFileAbsolutePath.mockImplementation((relativePath) => {
      // シンプルなパス解決ロジック
      const novelRoot = '/test/novel';
      return `${novelRoot}/${relativePath}`;
    });
    mockFilePathMapService.resolveRelativePathFromRoot.mockImplementation((linkUrl) => {
      // パスを正規化してプロジェクトルートからの相対パスとして返す
      if (linkUrl.includes('settings/world.md')) {
        return 'settings/world.md';
      } else if (linkUrl.includes('settings/character.md')) {
        return 'settings/character.md';
      } else if (linkUrl.includes('target.md')) {
        return 'target.md';
      } else if (linkUrl.includes('contents/01_prologue.txt')) {
        return 'contents/01_prologue.txt';
      }
      return linkUrl;
    });
  });

  // ヘルパー関数：テスト用ファイルを作成
  const createFileForTest = (filePath: string, content: string): void => {
    fileSystem.set(filePath, content);
  };

  describe('parseMarkdownLinks', () => {
    it('基本的なマークダウンリンクを抽出できる', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const content = `
# テストファイル

これは[テストリンク](test.md)です。
別の[リンク](../settings/world.md)もあります。
      `;

      const links = service.parseMarkdownLinks(content);

      expect(links.length).toBe(2);
      expect(links[0]?.text).toBe('テストリンク');
      expect(links[0]?.url).toBe('test.md');
      expect(links[1]?.text).toBe('リンク');
      expect(links[1]?.url).toBe('../settings/world.md');
    });

    it('タイトル付きマークダウンリンクを抽出できる', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const content = `
[リンク](test.md "タイトル")
[別のリンク](world.md "世界設定")
      `;

      const links = service.parseMarkdownLinks(content);

      expect(links.length).toBe(2);
      expect(links[0]?.text).toBe('リンク');
      expect(links[0]?.url).toBe('test.md');
      expect(links[0]?.title).toBe('タイトル');
      expect(links[1]?.text).toBe('別のリンク');
      expect(links[1]?.url).toBe('world.md');
      expect(links[1]?.title).toBe('世界設定');
    });

    it('外部リンクも抽出される', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const content = `
[GitHub](https://github.com)
[ローカルファイル](./test.md)
[メール](mailto:test@example.com)
      `;

      const links = service.parseMarkdownLinks(content);

      expect(links.length).toBe(3);
      expect(links[0]?.url).toBe('https://github.com');
      expect(links[1]?.url).toBe('./test.md');
      expect(links[2]?.url).toBe('mailto:test@example.com');
    });

    it('空のテキストやURLも処理される', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const content = `
[](empty-url.md)
[空のURL]()
      `;

      const links = service.parseMarkdownLinks(content);

      expect(links.length).toBe(2);
      expect(links[0]?.text).toBe('');
      expect(links[0]?.url).toBe('empty-url.md');
      expect(links[1]?.text).toBe('空のURL');
      expect(links[1]?.url).toBe('');
    });
  });

  describe('filterProjectLinks', () => {
    it('プロジェクト内リンクのみをフィルタリングできる', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const links = [
        { text: 'プロジェクト内', url: 'settings/world.md' },
        { text: '外部サイト', url: 'https://example.com' },
        { text: 'プロジェクト内キャラ', url: 'settings/character.md' },
        { text: '存在しない', url: 'nonexistent.md' },
        { text: 'ページ内アンカー', url: '#section1' },
      ];

      const currentFile = `/test/novel/第1章.md`;
      const projectLinks = service.filterProjectLinks(links, currentFile);

      expect(projectLinks.length).toBe(2);
      expect(projectLinks.includes('settings/world.md')).toBe(true);
      expect(projectLinks.includes('settings/character.md')).toBe(true);
    });

    it('相対パスも正しく処理される', () => {
      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      const links = [
        { text: 'カレント相対', url: './settings/world.md' },
        { text: '親ディレクトリ', url: '../settings/world.md' },
        { text: 'プロジェクトルート相対', url: 'settings/world.md' },
      ];

      const currentFile = `/test/novel/第1章.md`;
      const projectLinks = service.filterProjectLinks(links, currentFile);

      // 全て同じファイルを指しているので、重複除去されて1つになる
      expect(projectLinks.length).toBe(1);
      expect(projectLinks[0]).toBe('settings/world.md');
    });
  });

  describe('extractProjectLinksAsync', () => {
    it('ファイルからプロジェクト内リンクを抽出できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      // 第1章.mdファイルの内容
      createFileForTest(
        `${novelRoot}/第1章.md`,
        `
# 第1章

この章では[世界設定](settings/world.md)と[主人公](settings/character.md)について説明します。

また、[GitHub](https://github.com)というサイトも参照してください。
存在しない[ファイル](nonexistent.md)へのリンクもあります。
      `,
      );

      const projectLinks = await service.extractProjectLinksAsync(`${novelRoot}/第1章.md`);

      expect(projectLinks.length).toBe(2);
      expect(projectLinks.includes('settings/world.md')).toBe(true);
      expect(projectLinks.includes('settings/character.md')).toBe(true);
    });

    it('存在しないファイルは空配列を返す', async () => {
      // サービスを作成（空のファイルマップ）
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);
      
      const projectLinks = await service.extractProjectLinksAsync('/nonexistent/file.md');
      expect(projectLinks.length).toBe(0);
    });

    it('リンクが含まれていないファイルは空配列を返す', async () => {
      const novelRoot = '/test/novel';

      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);
      
      createFileForTest(
        `${novelRoot}/simple.md`,
        `
# シンプルなファイル

リンクは含まれていません。
      `,
      );

      const projectLinks = await service.extractProjectLinksAsync(`${novelRoot}/simple.md`);
      expect(projectLinks.length).toBe(0);
    });
  });

  describe('refreshFileLinksAsync', () => {
    it('ファイルのリンクを再抽出できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      createFileForTest(
        `${novelRoot}/test.md`,
        `
[リンク](target.md)
      `,
      );

      const projectLinks = await service.refreshFileLinksAsync(`${novelRoot}/test.md`);

      expect(projectLinks.length).toBe(1);
      expect(projectLinks[0]).toBe('target.md');
    });
  });

  describe('extractProjectLinksFromFilesAsync', () => {
    it('複数ファイルのリンクを一括抽出できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      createFileForTest(
        `${novelRoot}/file1.md`,
        `
[ターゲット](target.md)
      `,
      );

      createFileForTest(
        `${novelRoot}/file2.md`,
        `
[同じターゲット](target.md)
[外部](https://example.com)
      `,
      );

      const filePaths = [`${novelRoot}/file1.md`, `${novelRoot}/file2.md`];
      const result = await service.extractProjectLinksFromFilesAsync(filePaths);

      expect(result.size).toBe(2);

      const file1Links = result.get(`${novelRoot}/file1.md`);
      expect(file1Links).not.toBe(undefined);
      if (file1Links !== undefined) {
        expect(file1Links.length).toBe(1);
        expect(file1Links[0]).toBe('target.md');
      }

      const file2Links = result.get(`${novelRoot}/file2.md`);
      expect(file2Links).not.toBe(undefined);
      if (file2Links !== undefined) {
        expect(file2Links.length).toBe(1);
        expect(file2Links[0]).toBe('target.md');
      }
    });

    it('ユーザケース：設定ファイルから本文ファイルへのリンクを抽出（デバッグ版）', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      // ユーザが追加したリンクを含む設定ファイル
      createFileForTest(
        `${novelRoot}/settings/character.md`,
        `# キャラクター設定

メインキャラクターが登場する箇所：
[01_prologue.txt](contents/01_prologue.txt)

その他の情報...`,
      );

      // デバッグ：ファイルマップの状態を確認
      // テスト対象のファイルが正しく認識されているかチェック
      const isProjectFile = mockFilePathMapService.isProjectFile(
        'contents/01_prologue.txt',
        `${novelRoot}/settings/character.md`,
      );
      expect(isProjectFile).toBe(true);

      // パス解決もテスト
      const resolvedPath = mockFilePathMapService.resolveFileAbsolutePath(
        'contents/01_prologue.txt',
        `${novelRoot}/settings/character.md`,
      );
      expect(resolvedPath).toBe(`${novelRoot}/contents/01_prologue.txt`);

      // デバッグ：パースされるリンクを確認
      const content = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${novelRoot}/settings/character.md`),
        'utf-8',
      );

      const allLinks = service.parseMarkdownLinks(content);
      expect(allLinks.length).toBe(1);
      expect(allLinks[0]?.text).toBe('01_prologue.txt');
      expect(allLinks[0]?.url).toBe('contents/01_prologue.txt');

      // プロジェクト内リンクを抽出
      const projectLinks = await service.extractProjectLinksAsync(
        `${novelRoot}/settings/character.md`,
      );

      // 検証
      expect(projectLinks.length).toBe(1);
      expect(projectLinks[0]).toBe('contents/01_prologue.txt');
    });
  });

  describe('非同期メソッドテスト', () => {
    it('ファイルからプロジェクト内リンクを抽出（非同期版）できる', async () => {
      const novelRoot = '/test/novel';

      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      createFileForTest(
        `${novelRoot}/chapter1.md`,
        `
[世界設定](settings/world.md)
[外部リンク](https://example.com)
`,
      );

      const links = await service.extractProjectLinksAsync(`${novelRoot}/chapter1.md`);

      expect(links.length).toBe(1);
      expect(links[0]).toBe('settings/world.md');
    });

    it('複数ファイルのリンクを一括抽出（非同期版）できる', async () => {
      const novelRoot = '/test/novel';

      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      createFileForTest(`${novelRoot}/file1.md`, `[ターゲット](target.md)`);

      createFileForTest(`${novelRoot}/file2.md`, `[同じターゲット](target.md)`);

      const filePaths = [`${novelRoot}/file1.md`, `${novelRoot}/file2.md`];
      const result = await service.extractProjectLinksFromFilesAsync(filePaths);

      expect(result.size).toBe(2);

      const file1Links = result.get(`${novelRoot}/file1.md`);
      expect(file1Links).not.toBe(undefined);
      if (file1Links !== undefined) {
        expect(file1Links.length).toBe(1);
        expect(file1Links[0]).toBe('target.md');
      }

      const file2Links = result.get(`${novelRoot}/file2.md`);
      expect(file2Links).not.toBe(undefined);
      if (file2Links !== undefined) {
        expect(file2Links.length).toBe(1);
        expect(file2Links[0]).toBe('target.md');
      }
    });

    it('refreshFileLinksAsync で更新されたリンクを取得できる', async () => {
      const novelRoot = '/test/novel';

      service = new HyperlinkExtractorService(mockFileRepository, mockFilePathMapService);

      createFileForTest(`${novelRoot}/chapter.md`, `[リンク](target.md)`);

      const refreshedLinks = await service.refreshFileLinksAsync(`${novelRoot}/chapter.md`);

      expect(refreshedLinks.length).toBe(1);
      expect(refreshedLinks[0]).toBe('target.md');
    });
  });
});