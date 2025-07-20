import * as assert from 'assert';
import * as path from 'path';
import { suite, test } from 'mocha';
import { CharacterService } from './CharacterService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MetaYamlService } from './MetaYamlService.js';

suite('CharacterService テストスイート', () => {
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let characterService: CharacterService;
  let testDir: string;
  let testContainer: TestServiceContainer;

  setup(() => {
    // TestServiceContainerを使用してサービスを初期化
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    metaYamlService = testContainer.getMetaYamlService();
    characterService = new CharacterService(mockFileRepository, metaYamlService);
    testDir = '/tmp/dialogoi-character-test';

    // テスト用ディレクトリを作成
    mockFileRepository.addDirectory(testDir);
  });

  teardown(() => {
    // 各テストの後にモックサービスをリセット
    mockFileRepository.reset();
    testContainer.cleanup();
  });

  suite('extractDisplayName', () => {
    test('最初の # 見出しから表示名を取得する', () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '# 田中太郎\n\n## 基本情報\n- 年齢: 16歳');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, '田中太郎');
    });

    test('見出しが複数ある場合は最初の # 見出しを取得する', () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '# 主要キャラクター\n\n## 田中太郎\n\n# 別の見出し');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, '主要キャラクター');
    });

    test('見出しが見つからない場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'character.md');
      mockFileRepository.addFile(testFile, '普通のテキスト\n\n## サブ見出し');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'character');
    });

    test('ファイルが存在しない場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'nonexistent.md');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'nonexistent');
    });

    test('拡張子なしファイルの場合はファイル名全体を返す', () => {
      const testFile = path.join(testDir, 'character');
      mockFileRepository.addFile(testFile, '普通のテキスト');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'character');
    });

    test('空のファイルの場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'empty.md');
      mockFileRepository.addFile(testFile, '');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'empty');
    });

    test('空白のみの見出しの場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'blank.md');
      mockFileRepository.addFile(testFile, '#   \n\n内容');

      const displayName = characterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'blank');
    });
  });

  suite('isCharacterFile', () => {
    test('キャラクターファイルの場合trueを返す', () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: hero.md
    type: setting
    character:
      importance: main
      multiple_characters: false
`;
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = characterService.isCharacterFile(charFile);
      assert.strictEqual(result, true);
    });

    test('通常の設定ファイルの場合falseを返す', () => {
      const settingFile = path.join(testDir, 'world.md');
      mockFileRepository.addFile(settingFile, '# 世界設定\n\n世界観の説明');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: world.md
    type: setting
`;
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = characterService.isCharacterFile(settingFile);
      assert.strictEqual(result, false);
    });

    test('メタデータファイルが存在しない場合falseを返す', () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      const result = characterService.isCharacterFile(charFile);
      assert.strictEqual(result, false);
    });

    test('ファイルがメタデータに存在しない場合falseを返す', () => {
      const charFile = path.join(testDir, 'hero.md');
      mockFileRepository.addFile(charFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成（hero.mdは含まれない）
      const metaContent = `readme: README.md
files:
  - name: world.md
    type: setting
`;
      mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), metaContent);

      const result = characterService.isCharacterFile(charFile);
      assert.strictEqual(result, false);
    });
  });

  suite('getFileInfo', () => {
    const novelRoot = '/tmp/novel-project';

    setup(() => {
      // ノベルプロジェクトのディレクトリ構造を作成
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addDirectory(path.join(novelRoot, 'settings'));
      mockFileRepository.addDirectory(path.join(novelRoot, 'settings', 'characters'));
    });

    test('ファイル情報を正しく取得する', () => {
      const heroFile = path.join(novelRoot, 'settings', 'characters', 'hero.md');
      mockFileRepository.addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

      // .dialogoi-meta.yamlを作成
      const metaContent = `readme: README.md
files:
  - name: hero.md
    type: setting
    character:
      importance: main
      multiple_characters: false
    tags:
      - 主人公
      - 戦士
`;
      const metaPath = path.join(novelRoot, 'settings', 'characters', '.dialogoi-meta.yaml');
      mockFileRepository.addFile(metaPath, metaContent);

      const fileInfo = characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      assert.notStrictEqual(fileInfo, null);
      assert.strictEqual(fileInfo?.name, 'hero.md');
      assert.strictEqual(fileInfo?.type, 'setting');
      assert.strictEqual(fileInfo?.character?.importance, 'main');
      assert.deepStrictEqual(fileInfo?.tags, ['主人公', '戦士']);
    });

    test('ファイルが存在しない場合nullを返す', () => {
      const fileInfo = characterService.getFileInfo('settings/characters/notexist.md', novelRoot);
      assert.strictEqual(fileInfo, null);
    });

    test('メタデータファイルが存在しない場合nullを返す', () => {
      const heroFile = path.join(novelRoot, 'settings', 'characters', 'hero.md');
      mockFileRepository.addFile(heroFile, '# 主人公\n\n勇敢な冒険者');

      const fileInfo = characterService.getFileInfo('settings/characters/hero.md', novelRoot);
      assert.strictEqual(fileInfo, null);
    });
  });
});
