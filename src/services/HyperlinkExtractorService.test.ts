import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import { HyperlinkExtractorService } from './HyperlinkExtractorService.js';
import { FilePathMapService } from './FilePathMapService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('HyperlinkExtractorService テストスイート', () => {
  let service: HyperlinkExtractorService;
  let container: TestServiceContainer;
  let mockFileRepo: MockFileRepository;

  setup(() => {
    container = TestServiceContainer.create();
    mockFileRepo = container.getMockFileRepository();
    // HyperlinkExtractorServiceは具体的なnovelRootPathが必要なので、テストごとに個別作成
  });

  teardown(() => {
    container.cleanup();
  });

  suite('parseMarkdownLinks', () => {
    test('基本的なマークダウンリンクを抽出できる', () => {
      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService();
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      const content = `
# テストファイル

これは[テストリンク](test.md)です。
別の[リンク](../settings/world.md)もあります。
      `;

      const links = service.parseMarkdownLinks(content);

      assert.strictEqual(links.length, 2);
      assert.strictEqual(links[0]?.text, 'テストリンク');
      assert.strictEqual(links[0]?.url, 'test.md');
      assert.strictEqual(links[1]?.text, 'リンク');
      assert.strictEqual(links[1]?.url, '../settings/world.md');
    });

    test('タイトル付きマークダウンリンクを抽出できる', () => {
      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService();
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      const content = `
[リンク](test.md "タイトル")
[別のリンク](world.md "世界設定")
      `;

      const links = service.parseMarkdownLinks(content);

      assert.strictEqual(links.length, 2);
      assert.strictEqual(links[0]?.text, 'リンク');
      assert.strictEqual(links[0]?.url, 'test.md');
      assert.strictEqual(links[0]?.title, 'タイトル');
      assert.strictEqual(links[1]?.text, '別のリンク');
      assert.strictEqual(links[1]?.url, 'world.md');
      assert.strictEqual(links[1]?.title, '世界設定');
    });

    test('外部リンクも抽出される', () => {
      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService();
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      const content = `
[GitHub](https://github.com)
[ローカルファイル](./test.md)
[メール](mailto:test@example.com)
      `;

      const links = service.parseMarkdownLinks(content);

      assert.strictEqual(links.length, 3);
      assert.strictEqual(links[0]?.url, 'https://github.com');
      assert.strictEqual(links[1]?.url, './test.md');
      assert.strictEqual(links[2]?.url, 'mailto:test@example.com');
    });

    test('空のテキストやURLも処理される', () => {
      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService();
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
      service = new HyperlinkExtractorService(mockFileRepo, filePathMapService);

      const content = `
[](empty-url.md)
[空のURL]()
      `;

      const links = service.parseMarkdownLinks(content);

      assert.strictEqual(links.length, 2);
      assert.strictEqual(links[0]?.text, '');
      assert.strictEqual(links[0]?.url, 'empty-url.md');
      assert.strictEqual(links[1]?.text, '空のURL');
      assert.strictEqual(links[1]?.url, '');
    });
  });

  suite('filterProjectLinks', () => {
    test('プロジェクト内リンクのみをフィルタリングできる', () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
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

      filePathMapService.buildFileMap(novelRoot);

      const links = [
        { text: 'プロジェクト内', url: 'settings/world.md' },
        { text: '外部サイト', url: 'https://example.com' },
        { text: 'プロジェクト内キャラ', url: 'settings/character.md' },
        { text: '存在しない', url: 'nonexistent.md' },
        { text: 'ページ内アンカー', url: '#section1' },
      ];

      const currentFile = `${novelRoot}/第1章.md`;
      const projectLinks = service.filterProjectLinks(links, currentFile);

      assert.strictEqual(projectLinks.length, 2);
      assert.strictEqual(projectLinks.includes('settings/world.md'), true);
      assert.strictEqual(projectLinks.includes('settings/character.md'), true);
    });

    test('相対パスも正しく処理される', () => {
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
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

      filePathMapService.buildFileMap(novelRoot);

      const links = [
        { text: 'カレント相対', url: './settings/world.md' },
        { text: '親ディレクトリ', url: '../settings/world.md' },
        { text: 'プロジェクトルート相対', url: 'settings/world.md' },
      ];

      const currentFile = `${novelRoot}/第1章.md`;
      const projectLinks = service.filterProjectLinks(links, currentFile);

      // 全て同じファイルを指しているので、重複除去されて1つになる
      assert.strictEqual(projectLinks.length, 1);
      assert.strictEqual(projectLinks[0], 'settings/world.md');
    });
  });

  suite('extractProjectLinks', () => {
    test('ファイルからプロジェクト内リンクを抽出できる', () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
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

      filePathMapService.buildFileMap(novelRoot);

      const projectLinks = service.extractProjectLinks(`${novelRoot}/第1章.md`);

      assert.strictEqual(projectLinks.length, 2);
      assert.strictEqual(projectLinks.includes('settings/world.md'), true);
      assert.strictEqual(projectLinks.includes('settings/character.md'), true);
    });

    test('存在しないファイルは空配列を返す', () => {
      const projectLinks = service.extractProjectLinks('/nonexistent/file.md');
      assert.strictEqual(projectLinks.length, 0);
    });

    test('リンクが含まれていないファイルは空配列を返す', () => {
      const novelRoot = '/test/novel';

      mockFileRepo.createFileForTest(
        `${novelRoot}/simple.md`,
        `
# シンプルなファイル

リンクは含まれていません。
      `,
      );

      const projectLinks = service.extractProjectLinks(`${novelRoot}/simple.md`);
      assert.strictEqual(projectLinks.length, 0);
    });
  });

  suite('refreshFileLinks', () => {
    test('ファイルのリンクを再抽出できる', () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
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

      filePathMapService.buildFileMap(novelRoot);

      const projectLinks = service.refreshFileLinks(`${novelRoot}/test.md`);

      assert.strictEqual(projectLinks.length, 1);
      assert.strictEqual(projectLinks[0], 'target.md');
    });
  });

  suite('extractProjectLinksFromFiles', () => {
    test('複数ファイルのリンクを一括抽出できる', () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // サービスを作成
      const metaYamlService = container.getMetaYamlService();
      const fileOpService = container.getFileOperationService(novelRoot);
      const filePathMapService = new FilePathMapService(metaYamlService, fileOpService);
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

      filePathMapService.buildFileMap(novelRoot);

      const filePaths = [`${novelRoot}/file1.md`, `${novelRoot}/file2.md`];
      const result = service.extractProjectLinksFromFiles(filePaths);

      assert.strictEqual(result.size, 2);

      const file1Links = result.get(`${novelRoot}/file1.md`);
      assert.notStrictEqual(file1Links, undefined);
      if (file1Links !== undefined) {
        assert.strictEqual(file1Links.length, 1);
        assert.strictEqual(file1Links[0], 'target.md');
      }

      const file2Links = result.get(`${novelRoot}/file2.md`);
      assert.notStrictEqual(file2Links, undefined);
      if (file2Links !== undefined) {
        assert.strictEqual(file2Links.length, 1);
        assert.strictEqual(file2Links[0], 'target.md');
      }
    });
  });
});
