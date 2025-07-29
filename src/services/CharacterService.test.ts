import * as path from 'path';
import { CharacterService } from './CharacterService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MetaYamlService } from './MetaYamlService.js';
import { hasCharacterProperty } from '../utils/MetaYamlUtils.js';

describe('CharacterService テストスイート', () => {
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let characterService: CharacterService;
  let testDir: string;
  let testContainer: TestServiceContainer;

  beforeEach(() => {
    // TestServiceContainerを使用してサービスを初期化
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    metaYamlService = testContainer.getMetaYamlService();
    characterService = new CharacterService(mockFileRepository, metaYamlService);
    testDir = '/tmp/dialogoi-character-test';

    // テスト用ディレクトリを作成
    mockFileRepository.addDirectory(testDir);
  });

  afterEach(() => {
    // 各テストの後にモックサービスをリセット
    mockFileRepository.reset();
    testContainer.cleanup();
  });

  describe('extractDisplayName', () => {
    it('最初の # 見出しから表示名を取得する', async () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '# 田中太郎\n\n## 基本情報\n- 年齢: 16歳');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('田中太郎');
    });

    it('見出しが複数ある場合は最初の # 見出しを取得する', async () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '# 主要キャラクター\n\n## 田中太郎\n\n# 別の見出し');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('主要キャラクター');
    });

    it('見出しが見つからない場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '普通のテキスト\n\n## サブ見出し');

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
      mockFileRepository.addFile(testFile, '普通のテキスト');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('character');
    });

    it('空のファイルの場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'empty.md');
      mockFileRepository.addFile(testFile, '');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('empty');
    });

    it('空白のみの見出しの場合はファイル名を返す', async () => {
      const testFile = path.join(testDir, 'blank.md');
      mockFileRepository.addFile(testFile, '#   \n\n内容');

      const displayName = await characterService.extractDisplayName(testFile);
      expect(displayName).toBe('blank');
    });
  });

  describe('isCharacterFile', () => {
    it('キャラクターファイルの場合trueを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

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
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(true);
    });

    it('通常の設定ファイルの場合falseを返す', async () => {
      const settingFile = path.join(testDir, 'world.md');
      mockFileRepository.addFile(settingFile, '# 世界設定\n\n世界観の説明');

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
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(settingFile);
      expect(result).toBe(false);
    });

    it('メタデータファイルが存在しない場合falseを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(false);
    });

    it('ファイルがメタデータに存在しない場合falseを返す', async () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

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
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = await characterService.isCharacterFile(charFile);
      expect(result).toBe(false);
    });
  });

  describe('getFileInfo', () => {
    const novelRoot = '/tmp/novel-project';

    beforeEach(() => {
      // ノベルプロジェクトのディレクトリ構造を作成
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addDirectory(path.join(novelRoot, 'settings'));
      mockFileRepository.addDirectory(path.join(novelRoot, 'settings', 'characters'));
    });

    it('ファイル情報を正しく取得する', async () => {
      const heroFile = path.join(novelRoot, 'settings', 'characters', 'hero.md');
      mockFileRepository.addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

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
      mockFileRepository.addFile(metaPath, metaContent);

      const fileInfo = await characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      expect(fileInfo).not.toBe(null);
      expect(fileInfo?.name).toBe('hero.md');
      expect(fileInfo?.type).toBe('setting');

      // 型ガードを使って安全にcharacterプロパティにアクセス
      if (fileInfo !== null && hasCharacterProperty(fileInfo)) {
        expect(fileInfo.character.importance).toBe('main');
      } else {
        fail('fileInfoにcharacterプロパティが存在しません');
      }

      expect(fileInfo?.tags).toEqual(['主人公', '戦士']);
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
      mockFileRepository.addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

      const fileInfo = await characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      expect(fileInfo).toBe(null);
    });
  });
});
