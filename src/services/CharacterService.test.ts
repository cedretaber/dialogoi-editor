import { mock, MockProxy } from 'jest-mock-extended';
import * as path from 'path';
import { CharacterService } from './CharacterService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { Uri } from '../interfaces/Uri.js';
import { DialogoiTreeItem, hasCharacterProperty } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';
import * as yaml from 'js-yaml';

describe('CharacterService テストスイート', () => {
  let characterService: CharacterService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;
  let testDir: string;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();

    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();

    // サービスインスタンス作成
    characterService = new CharacterService(mockFileRepository, mockMetaYamlService);
    testDir = '/tmp/dialogoi-character-test';

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    // テスト用ディレクトリを作成
    addDirectory(testDir);
  });

  function setupFileSystemMocks(): void {
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath } as Uri;
    });

    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    // readFileAsyncのモック
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, encoding?: string): Promise<string | Uint8Array> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      if (encoding !== undefined) {
        return Promise.resolve(content);
      } else {
        return Promise.resolve(new TextEncoder().encode(content));
      }
    });

    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((absolutePath: string) => {
      const metaPath = absolutePath + '/.dialogoi-meta.yaml';
      const content = fileSystem.get(metaPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(yaml.load(content) as MetaYaml);
      } catch {
        return Promise.resolve(null);
      }
    });
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  describe('extractDisplayName', () => {
    it('最初の # 見出しから表示名を取得する', async () => {
      const testFile = path.join(testDir, 'character.md');
      addFile(testFile, '# 田中太郎\n\n## 基本情報\n- 年齢: 16歳');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('田中太郎');
    });

    it('見出しが複数ある場合は最初の # 見出しを取得する', async () => {
      const testFile = path.join(testDir, 'character.md');
      addFile(testFile, '# 主要キャラクター\n\n## 田中太郎\n\n# 別の見出し');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('主要キャラクター');
    });

    it('見出しが見つからない場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'character.md');
      addFile(testFile, '普通のテキスト\n\n## サブ見出し');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('character');
    });

    it('ファイルが存在しない場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'nonexistent.md');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('nonexistent');
    });

    it('拡張子なしファイルの場合はファイル名全体を返す', async () => {
      const testFile = path.join(testDir, 'character');
      addFile(testFile, '普通のテキスト');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('character');
    });

    it('空のファイルの場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'empty.md');
      addFile(testFile, '');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('empty');
    });

    it('空白のみの見出しの場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'blank.md');
      addFile(testFile, '#   \n\n内容');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('blank');
    });
  });

  describe('isCharacterFile', () => {
    it('キャラクターファイルの場合trueを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: hero.md
    type: setting
    path: /tmp/dialogoi-character-test/hero.md
    hash: hash123
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
    character:
      importance: main
      multiple_characters: false
      display_name: ''
`;
      addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(true);
    });

    it('通常の設定ファイルの場合falseを返す', async () => {
      const settingFile = path.join(testDir, 'world.md');
      addFile(settingFile, '# 世界設定\n\n世界観の説明');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: world.md
    type: setting
    path: /tmp/dialogoi-character-test/world.md
    hash: hash456
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
`;
      addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(settingFile);
      expect(result).toBe(false);
    });

    it('メタデータファイルが存在しない場合falseを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(false);
    });

    it('ファイルがメタデータに存在しない場合falseを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成（hero.mdは含まれない）
      const metaContent = `readme: README.md
files:
  - name: world.md
    type: setting
    path: /tmp/dialogoi-character-test/world.md
    hash: hash456
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
`;
      addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    const novelRoot = '/tmp/novel-project';

    beforeEach(() => {
      // ノベルプロジェクトのディレクトリ構造を作成
      addDirectory(novelRoot);
      addDirectory(path.join(novelRoot, 'settings'));
      addDirectory(path.join(novelRoot, 'settings', 'characters'));
    });

    it('ファイル情報を正しく取得する', async () => {
      const heroFile = path.join(novelRoot, 'settings', 'characters', 'hero.md');
      addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: hero.md
    type: setting
    path: /tmp/novel-project/settings/characters/hero.md
    hash: hash789
    tags:
      - 主人公
      - 戦士
    comments: ''
    isUntracked: false
    isMissing: false
    character:
      importance: main
      multiple_characters: false
      display_name: ''
`;
      const metaPath = path.join(novelRoot, 'settings', 'characters', '.dialogoi-meta.yaml');
      addFile(metaPath, metaContent);

      const fileInfo = await characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      expect(fileInfo).not.toBe(null);
      expect(fileInfo?.name).toBe('hero.md');
      expect(fileInfo?.type).toBe('setting');

      // 型ガードを使って安全にcharacterプロパティにアクセス
      expect(fileInfo).not.toBeNull();
      expect(hasCharacterProperty(fileInfo as DialogoiTreeItem)).toBe(true);

      // fileInfoがnullでないことを既に確認したので、安全にアクセス
      const nonNullFileInfo = fileInfo as DialogoiTreeItem;
      // hasCharacterPropertyがtrueを返したことを既に確認しているので、characterプロパティは存在する
      // 型ガードが成功していることを確認済みなので、型アサーションで安全にアクセス
      expect(hasCharacterProperty(nonNullFileInfo)).toBe(true);
      if (!hasCharacterProperty(nonNullFileInfo)) {
        throw new Error('Character property should exist');
      }
      expect(nonNullFileInfo.character.importance).toBe('main');
      expect(nonNullFileInfo.type).toBe('setting');
      expect(nonNullFileInfo.tags).toEqual(['主人公', '戦士']);
    });

    it('ファイルが存在しない場合nullを返す', async () => {
      const fileInfo = await characterService.getFileInfo(
        'settings/characters/notexist.md',
        novelRoot,
      );
      expect(fileInfo).toBe(null);
    });

    it('メタデータファイルが存在しない場合nullを返す', async () => {
      const heroFile = path.join(novelRoot, 'settings', 'characters', 'hero.md');
      addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

      const fileInfo = await characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      expect(fileInfo).toBe(null);
    });
  });
});
