import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { suite, test } from 'mocha';
import { CharacterService } from './CharacterService.js';

suite('CharacterService テストスイート', () => {
  let testDir: string;

  setup(() => {
    // 一時テストディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-character-test-'));
  });

  teardown(() => {
    // テストディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('extractDisplayName', () => {
    test('最初の # 見出しから表示名を取得する', () => {
      const testFile = path.join(testDir, 'character.md');
      fs.writeFileSync(testFile, '# 田中太郎\n\n## 基本情報\n- 年齢: 16歳');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, '田中太郎');
    });

    test('見出しが複数ある場合は最初の # 見出しを取得する', () => {
      const testFile = path.join(testDir, 'character.md');
      fs.writeFileSync(testFile, '# 主要キャラクター\n\n## 田中太郎\n\n# 別の見出し');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, '主要キャラクター');
    });

    test('見出しが見つからない場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'character.md');
      fs.writeFileSync(testFile, '普通のテキスト\n\n## サブ見出し');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'character');
    });

    test('ファイルが存在しない場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'nonexistent.md');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'nonexistent');
    });

    test('拡張子なしファイルの場合はファイル名全体を返す', () => {
      const testFile = path.join(testDir, 'character');
      fs.writeFileSync(testFile, '普通のテキスト');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'character');
    });

    test('空のファイルの場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'empty.md');
      fs.writeFileSync(testFile, '');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'empty');
    });

    test('空白のみの見出しの場合はファイル名を返す', () => {
      const testFile = path.join(testDir, 'blank.md');
      fs.writeFileSync(testFile, '#   \n\n内容');

      const displayName = CharacterService.extractDisplayName(testFile);
      assert.strictEqual(displayName, 'blank');
    });
  });
});
