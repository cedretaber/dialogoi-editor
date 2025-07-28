import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import { FilePathMapService } from './FilePathMapService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('FilePathMapService テストスイート', () => {
  let service: FilePathMapService;
  let container: TestServiceContainer;
  let mockFileRepo: MockFileRepository;

  setup(() => {
    container = TestServiceContainer.create();
    mockFileRepo = container.getMockFileRepository();
    // FilePathMapServiceは具体的なnovelRootPathが必要なので、テストごとに個別作成
  });

  teardown(() => {
    container.cleanup();
  });

  suite('buildFileMap', () => {
    test('プロジェクト全体をスキャンしてファイルマップを構築できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      // ルートのmeta.yaml
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

      // settingsディレクトリのmeta.yaml
      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/.dialogoi-meta.yaml`,
        `
files:
  - name: "world.md"
    type: "setting"
  - name: "characters"
    type: "subdirectory"
`,
      );

      // characters ディレクトリのmeta.yaml
      mockFileRepo.createFileForTest(
        `${novelRoot}/settings/characters/.dialogoi-meta.yaml`,
        `
files:
  - name: "hero.md"
    type: "setting"
    character:
      importance: "main"
      display_name: "主人公"
`,
      );

      // ファイルマップを構築
      await service.buildFileMap(novelRoot);

      // マップサイズを確認
      assert.strictEqual(service.getMapSize(), 5); // 第1章.md, settings, world.md, characters, hero.md

      // 各ファイルの情報を確認
      const chapterEntry = service.getFileEntry('第1章.md');
      assert.notStrictEqual(chapterEntry, null);
      if (chapterEntry !== null) {
        assert.strictEqual(chapterEntry.fileType, 'content');
        assert.strictEqual(chapterEntry.isCharacter, false);
      }

      const heroEntry = service.getFileEntry('settings/characters/hero.md');
      assert.notStrictEqual(heroEntry, null);
      if (heroEntry !== null) {
        assert.strictEqual(heroEntry.fileType, 'setting');
        assert.strictEqual(heroEntry.isCharacter, true);
      }
    });

    test('meta.yamlが存在しないディレクトリはスキップされる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      // ルートのmeta.yamlのみ作成
      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "第1章.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);

      assert.strictEqual(service.getMapSize(), 1);
    });
  });

  suite('isProjectFile', () => {
    test('プロジェクト内ファイルを正しく判定できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

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

      // ファイルマップを構築
      await service.buildFileMap(novelRoot);

      const currentFile = `${novelRoot}/第1章.md`;

      // プロジェクト内ファイル
      assert.strictEqual(service.isProjectFile('settings/world.md', currentFile), true);
      assert.strictEqual(service.isProjectFile('./settings/world.md', currentFile), true);

      // プロジェクト外ファイル
      assert.strictEqual(service.isProjectFile('/external/file.md', currentFile), false);
      assert.strictEqual(service.isProjectFile('../external/file.md', currentFile), false);

      // 存在しないファイル
      assert.strictEqual(service.isProjectFile('nonexistent.md', currentFile), false);

      // 外部リンク
      assert.strictEqual(service.isProjectFile('https://example.com', currentFile), false);
    });
  });

  suite('resolveFileAbsolutePath', () => {
    test('相対パスから絶対パスに正しく解決できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

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

      await service.buildFileMap(novelRoot);

      const currentFile = `${novelRoot}/第1章.md`;

      // プロジェクト内ファイルの解決
      const resolved = service.resolveFileAbsolutePath('settings/world.md', currentFile);
      assert.strictEqual(resolved, `${novelRoot}/settings/world.md`);

      // 存在しないファイル
      const notFound = service.resolveFileAbsolutePath('nonexistent.md', currentFile);
      assert.strictEqual(notFound, null);
    });
  });

  suite('updateFile', () => {
    test('ファイル追加時にマップが更新される', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files: []
`,
      );

      await service.buildFileMap(novelRoot);
      assert.strictEqual(service.getMapSize(), 0);

      // ファイルを追加
      const newItem = {
        name: 'new.md',
        type: 'content' as const,
        path: `${novelRoot}/new.md`,
      };

      service.updateFile(`${novelRoot}/new.md`, newItem);

      assert.strictEqual(service.getMapSize(), 1);
      const entry = service.getFileEntry('new.md');
      assert.notStrictEqual(entry, null);
      if (entry !== null) {
        assert.strictEqual(entry.fileName, 'new.md');
        assert.strictEqual(entry.fileType, 'content');
      }
    });

    test('ファイル削除時にマップから除去される', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "test.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);
      assert.strictEqual(service.getMapSize(), 1);

      // ファイルを削除
      service.updateFile(`${novelRoot}/test.md`, null);

      assert.strictEqual(service.getMapSize(), 0);
      assert.strictEqual(service.getFileEntry('test.md'), null);
    });
  });

  suite('getFileEntry', () => {
    test('存在するファイルの情報を取得できる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "character.md"
    type: "setting"
    character:
      importance: "main"
      display_name: "主人公"
  - name: "glossary.md"
    type: "setting"
    glossary: true
`,
      );

      await service.buildFileMap(novelRoot);

      // キャラクターファイル
      const characterEntry = service.getFileEntry('character.md');
      assert.notStrictEqual(characterEntry, null);
      if (characterEntry !== null) {
        assert.strictEqual(characterEntry.fileName, 'character.md');
        assert.strictEqual(characterEntry.fileType, 'setting');
        assert.strictEqual(characterEntry.isCharacter, true);
      }

      // 用語集ファイル
      const glossaryEntry = service.getFileEntry('glossary.md');
      assert.notStrictEqual(glossaryEntry, null);
      if (glossaryEntry !== null) {
        assert.strictEqual(glossaryEntry.fileName, 'glossary.md');
        assert.strictEqual(glossaryEntry.fileType, 'setting');
        assert.strictEqual(glossaryEntry.isCharacter, false);
        assert.strictEqual(glossaryEntry.glossary, true);
      }

      // 存在しないファイル
      assert.strictEqual(service.getFileEntry('nonexistent.md'), null);
    });
  });

  suite('clear', () => {
    test('ファイルマップをクリアできる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      const metaYamlService = container.getMetaYamlService();
      const coreFileService = container.getCoreFileService(novelRoot);
      service = new FilePathMapService(metaYamlService, coreFileService);

      mockFileRepo.createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "test.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);
      assert.strictEqual(service.getMapSize(), 1);

      service.clear();
      assert.strictEqual(service.getMapSize(), 0);
    });
  });
});
