import { mock, MockProxy } from 'jest-mock-extended';
import { FilePathMapService } from './FilePathMapService.js';
import { MetaYamlService } from './MetaYamlService.js';
import { CoreFileService } from './CoreFileService.js';
import { DialogoiTreeItem } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';
import * as yaml from 'js-yaml';
import * as path from 'path';

describe('FilePathMapService テストスイート', () => {
  let service: FilePathMapService;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let mockCoreFileService: MockProxy<CoreFileService>;
  let fileSystem: Map<string, string>;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem = new Map<string, string>();

    // jest-mock-extendedでモック作成
    mockMetaYamlService = mock<MetaYamlService>();
    mockCoreFileService = mock<CoreFileService>();

    // モックの設定
    setupMocks();

    // FilePathMapServiceは具体的なnovelRootPathが必要なので、テストごとに個別作成
  });

  function setupMocks(): void {
    // MetaYamlService のモック
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((dirPath: string) => {
      const yamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
      const content = fileSystem.get(yamlPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(yaml.load(content) as MetaYaml);
      } catch {
        return Promise.resolve(null);
      }
    });

    // CoreFileService のモック - getNovelRootPathのみ設定
    mockCoreFileService.getNovelRootPath.mockReturnValue('/test/novel');
  }

  function createFileForTest(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  describe('buildFileMap', () => {
    it('プロジェクト全体をスキャンしてファイルマップを構築できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      // ルートのmeta.yaml
      createFileForTest(
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
      createFileForTest(
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
      createFileForTest(
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
      expect(service.getMapSize()).toBe(5); // 第1章.md, settings, world.md, characters, hero.md

      // 各ファイルの情報を確認
      const chapterEntry = service.getFileEntry('第1章.md');
      expect(chapterEntry).not.toBe(null);
      if (!chapterEntry) {
        throw new Error('chapterEntry should not be null');
      }
      expect(chapterEntry.fileType).toBe('content');
      expect(chapterEntry.isCharacter).toBe(false);

      const heroEntry = service.getFileEntry('settings/characters/hero.md');
      expect(heroEntry).not.toBe(null);
      if (!heroEntry) {
        throw new Error('heroEntry should not be null');
      }
      expect(heroEntry.fileType).toBe('setting');
      expect(heroEntry.isCharacter).toBe(true);
    });

    it('meta.yamlが存在しないディレクトリはスキップされる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      // ルートのmeta.yamlのみ作成
      createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "第1章.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);

      expect(service.getMapSize()).toBe(1);
    });
  });

  describe('isProjectFile', () => {
    it('プロジェクト内ファイルを正しく判定できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
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

      createFileForTest(
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
      expect(service.isProjectFile('settings/world.md', currentFile)).toBe(true);
      expect(service.isProjectFile('./settings/world.md', currentFile)).toBe(true);

      // プロジェクト外ファイル
      expect(service.isProjectFile('/external/file.md', currentFile)).toBe(false);
      expect(service.isProjectFile('../external/file.md', currentFile)).toBe(false);

      // 存在しないファイル
      expect(service.isProjectFile('nonexistent.md', currentFile)).toBe(false);

      // 外部リンク
      expect(service.isProjectFile('https://example.com', currentFile)).toBe(false);
    });
  });

  describe('resolveFileAbsolutePath', () => {
    it('相対パスから絶対パスに正しく解決できる', async () => {
      // テストプロジェクト構造を作成
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
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

      createFileForTest(
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
      expect(resolved).toBe(`${novelRoot}/settings/world.md`);

      // 存在しないファイル
      const notFound = service.resolveFileAbsolutePath('nonexistent.md', currentFile);
      expect(notFound).toBe(null);
    });
  });

  describe('updateFile', () => {
    it('ファイル追加時にマップが更新される', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files: []
`,
      );

      await service.buildFileMap(novelRoot);
      expect(service.getMapSize()).toBe(0);

      // ファイルを追加
      const newItem: DialogoiTreeItem = {
        name: 'new.md',
        type: 'content' as const,
        path: `${novelRoot}/new.md`,
        hash: 'newhash',
        tags: [],
        references: [],
        isUntracked: false,
        isMissing: false,
      };

      service.updateFile(`${novelRoot}/new.md`, newItem);

      expect(service.getMapSize()).toBe(1);
      const entry = service.getFileEntry('new.md');
      expect(entry).not.toBe(null);
      if (!entry) {
        throw new Error('entry should not be null');
      }
      expect(entry.fileName).toBe('new.md');
      expect(entry.fileType).toBe('content');
    });

    it('ファイル削除時にマップから除去される', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "test.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);
      expect(service.getMapSize()).toBe(1);

      // ファイルを削除
      service.updateFile(`${novelRoot}/test.md`, null);

      expect(service.getMapSize()).toBe(0);
      expect(service.getFileEntry('test.md')).toBe(null);
    });
  });

  describe('getFileEntry', () => {
    it('存在するファイルの情報を取得できる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
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
      expect(characterEntry).not.toBe(null);
      if (!characterEntry) {
        throw new Error('characterEntry should not be null');
      }
      expect(characterEntry.fileName).toBe('character.md');
      expect(characterEntry.fileType).toBe('setting');
      expect(characterEntry.isCharacter).toBe(true);

      // 用語集ファイル
      const glossaryEntry = service.getFileEntry('glossary.md');
      expect(glossaryEntry).not.toBe(null);
      if (!glossaryEntry) {
        throw new Error('glossaryEntry should not be null');
      }
      expect(glossaryEntry.fileName).toBe('glossary.md');
      expect(glossaryEntry.fileType).toBe('setting');
      expect(glossaryEntry.isCharacter).toBe(false);
      expect(glossaryEntry.glossary).toBe(true);

      // 存在しないファイル
      expect(service.getFileEntry('nonexistent.md')).toBe(null);
    });
  });

  describe('clear', () => {
    it('ファイルマップをクリアできる', async () => {
      const novelRoot = '/test/novel';

      // ServiceをnovelRootPathと共に作成
      service = new FilePathMapService(mockMetaYamlService, mockCoreFileService);

      createFileForTest(
        `${novelRoot}/.dialogoi-meta.yaml`,
        `
project_name: "テストプロジェクト"
files:
  - name: "test.md"
    type: "content"
`,
      );

      await service.buildFileMap(novelRoot);
      expect(service.getMapSize()).toBe(1);

      service.clear();
      expect(service.getMapSize()).toBe(0);
    });
  });
});
