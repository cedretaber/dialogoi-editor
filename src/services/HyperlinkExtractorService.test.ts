import { HyperlinkExtractorService } from './HyperlinkExtractorService.js';
import { FilePathMapService } from './FilePathMapService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

describe('HyperlinkExtractorService テストスイート', () => {
  let service: HyperlinkExtractorService;
  let container: TestServiceContainer;
  let mockFileRepo: MockFileRepository;

  beforeEach(() => {
    container = TestServiceContainer.create();
    mockFileRepo = container.getFileRepository() as MockFileRepository;
    // HyperlinkExtractorServiceは具体的なnovelRootPathが必要なので、テストごとに個別作成
  });

  afterEach(() => {
    container.cleanup();
  });

  describe('parseMarkdownLinks', () => {
    it('基本的なマークダウンリンクを抽出できる', () => {
      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService();
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService();
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService();
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService();
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

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
    it('プロジェクト内リンクのみをフィルタリングできる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "第1章.md"
    type: "content"
  - name: "settings"
    type: "subdirectory"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "world.md"
    type: "setting"
  - name: "character.md"
    type: "setting"
    character:
      importance: "main"
`,
      );

      await filePathMapService.buildFileMap(novelRoot);

      const links = [
        { text: 'プロジェクト内', url: 'settings/world.md' },
        { text: '外部サイト', url: 'https://example.com' },
        { text: 'プロジェクト内キャラ', url: 'settings/character.md' },
        { text: '存在しない', url: 'nonexistent.md' },
        { text: 'ページ内アンカー', url: '#section1' },
      ];

      const currentFile = `${novelRoot}/第1章.md`;
      const projectLinks = service.filterProjectLinks(links, currentFile);

      expect(projectLinks.length).toBe(2);
      expect(projectLinks.includes('settings/world.md')).toBe(true);
      expect(projectLinks.includes('settings/character.md')).toBe(true);
    });

    it('相対パスも正しく処理される', async () => {
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "第1章.md"
    type: "content"
  - name: "settings"
    type: "subdirectory"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "world.md"
    type: "setting"
`,
      );

      await filePathMapService.buildFileMap(novelRoot);

      const links = [
        { text: 'カレント相対', url: './settings/world.md' },
        { text: '親ディレクトリ', url: '../settings/world.md' },
        { text: 'プロジェクトルート相対', url: 'settings/world.md' },
      ];

      const currentFile = `${novelRoot}/第1章.md`;
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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "第1章.md"
    type: "content"
  - name: "settings"
    type: "subdirectory"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "world.md"
    type: "setting"
  - name: "character.md"
    type: "setting"
    character:
      importance: "main"
`,
      );

      // 第1章.mdファイルの内容
      mockFileRepo.createFileForTest(
        `${novelRoot}/第1章.md`,
        `
# 第1章

この章では[世界設定](settings/world.md)と[主人公](settings/character.md)について説明します。

また、[GitHub](https://github.com)というサイトも参照してください。
存在しない[ファイル](nonexistent.md)へのリンクもあります。
      `,
      );

      await filePathMapService.buildFileMap(novelRoot);

      const projectLinks = await service.extractProjectLinksAsync(`${novelRoot}/第1章.md`);

      expect(projectLinks.length).toBe(2);
      expect(projectLinks.includes('settings/world.md')).toBe(true);
      expect(projectLinks.includes('settings/character.md')).toBe(true);
    });

    it('存在しないファイルは空配列を返す', async () => {
      const projectLinks = await service.extractProjectLinksAsync('/nonexistent/file.md');
      expect(projectLinks.length).toBe(0);
    });

    it('リンクが含まれていないファイルは空配列を返す', async () => {
      const novelRoot = '/test/novel';

      mockFileRepo.createFileForTest(
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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "test.md"
    type: "content"
  - name: "target.md"
    type: "setting"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/test.md`,
        `
[リンク](target.md)
      `,
      );

      await filePathMapService.buildFileMap(novelRoot);

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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "file1.md"
    type: "content"
  - name: "file2.md"
    type: "content"
  - name: "target.md"
    type: "setting"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/file1.md`,
        `
[ターゲット](target.md)
      `,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/file2.md`,
        `
[同じターゲット](target.md)
[外部](https://example.com)
      `,
      );

      await filePathMapService.buildFileMap(novelRoot);

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
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      // プロジェクトルート
      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "settings"
    type: "subdirectory"
  - name: "contents"
    type: "subdirectory"
`,
      );

      // 本文ディレクトリ
      mockFileRepo.createFileForTest(
        `${novelRoot}/contents/.dialogoi-meta.yaml`,
        `
files:
  - name: "01_prologue.txt"
    type: "content"
    order: 1
`,
      );

      mockFileRepo.createFileForTest(`${novelRoot}/contents/01_prologue.txt`, 'プロローグの内容');

      // 設定ディレクトリ
      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "character.md"
    type: "setting"
    order: 1
`,
      );

      // ユーザが追加したリンクを含む設定ファイル
      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/character.md`,
        `# キャラクター設定

メインキャラクターが登場する箇所：
[01_prologue.txt](contents/01_prologue.txt)

その他の情報...`,
      );

      await filePathMapService.buildFileMap(novelRoot);

      // デバッグ：ファイルマップの状態を確認
      // テスト対象のファイルが正しく認識されているかチェック
      const isProjectFile = filePathMapService.isProjectFile(
        'contents/01_prologue.txt',
        `${novelRoot}/settings/character.md`,
      );
      expect(isProjectFile).toBe(true);

      // パス解決もテスト
      const resolvedPath = filePathMapService.resolveFileAbsolutePath(
        'contents/01_prologue.txt',
        `${novelRoot}/settings/character.md`,
      );
      expect(resolvedPath).toBe(`${novelRoot}/contents/01_prologue.txt`);

      // デバッグ：パースされるリンクを確認
      const content = await mockFileRepo.readFileAsync(
        mockFileRepo.createFileUri(`${novelRoot}/settings/character.md`),
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

      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "chapter1.md"
    type: "content"
  - name: "settings"
    type: "subdirectory"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "world.md"
    type: "setting"
`,
      );

      mockFileRepo.createFileForTest(
        `${novelRoot}/chapter1.md`,
        `
[世界設定](settings/world.md)
[外部リンク](https://example.com)
`,
      );

      await filePathMapService.buildFileMap(novelRoot);

      const links = await service.extractProjectLinksAsync(`${novelRoot}/chapter1.md`);

      expect(links.length).toBe(1);
      expect(links[0]).toBe('settings/world.md');
    });

    it('複数ファイルのリンクを一括抽出（非同期版）できる', async () => {
      const novelRoot = '/test/novel';

      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "file1.md"
    type: "content"
  - name: "file2.md"
    type: "content"
  - name: "target.md"
    type: "setting"
`,
      );

      mockFileRepo.createFileForTest(`${novelRoot}/file1.md`, `[ターゲット](target.md)`);

      mockFileRepo.createFileForTest(`${novelRoot}/file2.md`, `[同じターゲット](target.md)`);

      await filePathMapService.buildFileMap(novelRoot);

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

      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, coreFileService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "chapter.md"
    type: "content"
  - name: "target.md"
    type: "setting"
`,
      );

      mockFileRepo.createFileForTest(`${novelRoot}/chapter.md`, `[リンク](target.md)`);

      await filePathMapService.buildFileMap(novelRoot);

      const refreshedLinks = await service.refreshFileLinksAsync(`${novelRoot}/chapter.md`);

      expect(refreshedLinks.length).toBe(1);
      expect(refreshedLinks[0]).toBe('target.md');
    });
  });
});
