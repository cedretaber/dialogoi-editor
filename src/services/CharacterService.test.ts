import * as assert from 'assert';
import * as path from 'path';
import { suite, test } from 'mocha';
import { CharacterService } from './CharacterService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('CharacterService テストスイート', () => {
  let mockFileRepository: MockFileRepository;
  let characterService: CharacterService;
  let testDir: string;

  setup(() => {
    // 各テストの前にモックサービスを初期化
    mockFileRepository = new MockFileRepository();
    characterService = new CharacterService(mockFileRepository);
    testDir = '/tmp/dialogoi-character-test';

    // テスト用ディレクトリを作成
    mockFileRepository.addDirectory(testDir);
  });

  teardown(() => {
    // 各テストの後にモックサービスをリセット
    mockFileRepository.reset();
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
});
