import * as assert from 'assert';
import * as path from 'path';
import { ProjectPathNormalizationService } from './ProjectPathNormalizationService.js';

suite('ProjectPathNormalizationService テストスイート', () => {
  let service: ProjectPathNormalizationService;
  const testProjectRoot = '/home/user/novel-project';

  setup(() => {
    service = new ProjectPathNormalizationService(testProjectRoot);
  });

  suite('normalizeToProjectPath', () => {
    test('プロジェクトルート相対パスはそのまま返す', () => {
      const result = service.normalizeToProjectPath(
        'settings/characters/hero.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, 'settings/characters/hero.md');
    });

    test('現在ファイルからの相対パスをプロジェクトルート相対パスに変換', () => {
      const result = service.normalizeToProjectPath(
        '../settings/world.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, 'settings/world.md');
    });

    test('複雑な相対パスを正規化', () => {
      const result = service.normalizeToProjectPath(
        '../../settings/characters/hero.md',
        '/home/user/novel-project/contents/volume1/chapter1.md',
      );
      assert.strictEqual(result, 'settings/characters/hero.md');
    });

    test('同一ディレクトリ内のファイル参照', () => {
      const result = service.normalizeToProjectPath(
        './hero.md',
        '/home/user/novel-project/settings/characters/villain.md',
      );
      assert.strictEqual(result, 'settings/characters/hero.md');
    });

    test('プロジェクト外のファイルはnullを返す', () => {
      const result = service.normalizeToProjectPath(
        '../../../external/file.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, null);
    });

    test('外部URLはnullを返す', () => {
      const testUrls = [
        'https://example.com/page.html',
        'http://example.com',
        'ftp://files.example.com/file.zip',
        'mailto:user@example.com',
        'tel:+1234567890',
      ];

      testUrls.forEach((url) => {
        const result = service.normalizeToProjectPath(
          url,
          '/home/user/novel-project/contents/chapter1.md',
        );
        assert.strictEqual(result, null, `URL ${url} should return null`);
      });
    });

    test('絶対パスは対象外', () => {
      const result = service.normalizeToProjectPath(
        '/absolute/path/to/file.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, null);
    });
  });

  suite('resolveProjectPath', () => {
    test('プロジェクトルート相対パスを絶対パスに変換', () => {
      const result = service.resolveProjectPath('settings/world.md');
      assert.strictEqual(result, path.join(testProjectRoot, 'settings/world.md'));
    });

    test('ルートディレクトリのファイル', () => {
      const result = service.resolveProjectPath('README.md');
      assert.strictEqual(result, path.join(testProjectRoot, 'README.md'));
    });
  });

  suite('getProjectRelativePath', () => {
    test('絶対パスをプロジェクトルート相対パスに変換', () => {
      const absolutePath = path.join(testProjectRoot, 'settings', 'world.md');
      const result = service.getProjectRelativePath(absolutePath);
      assert.strictEqual(result, 'settings/world.md');
    });

    test('プロジェクト外の絶対パスはnullを返す', () => {
      const result = service.getProjectRelativePath('/external/path/file.md');
      assert.strictEqual(result, null);
    });

    test('プロジェクトルート自体のファイル', () => {
      const absolutePath = path.join(testProjectRoot, 'dialogoi.yaml');
      const result = service.getProjectRelativePath(absolutePath);
      assert.strictEqual(result, 'dialogoi.yaml');
    });
  });

  suite('isSamePath', () => {
    test('同じパスの場合true', () => {
      assert.strictEqual(service.isSamePath('settings/world.md', 'settings/world.md'), true);
    });

    test('異なるパスの場合false', () => {
      assert.strictEqual(
        service.isSamePath('settings/world.md', 'settings/characters/hero.md'),
        false,
      );
    });

    test('パス区切り文字が異なっても同じパスと認識', () => {
      assert.strictEqual(service.isSamePath('settings\\world.md', 'settings/world.md'), true);
    });
  });

  suite('Windows パス対応', () => {
    test('Windows形式のパス区切り文字を正規化', () => {
      const result = service.normalizeToProjectPath(
        'settings\\characters\\hero.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, 'settings/characters/hero.md');
    });
  });

  suite('エッジケース', () => {
    test('空文字列の場合', () => {
      const result = service.normalizeToProjectPath(
        '',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, null);
    });

    test('ドット単体（現在ディレクトリ）', () => {
      const result = service.normalizeToProjectPath(
        '.',
        '/home/user/novel-project/contents/chapter1.md',
      );
      // ドット（現在ディレクトリ）は contents ディレクトリを指す
      assert.strictEqual(result, 'contents');
    });

    test('ファイル名にスペースが含まれる場合', () => {
      const result = service.normalizeToProjectPath(
        '../settings/character name.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, 'settings/character name.md');
    });

    test('日本語ファイル名', () => {
      const result = service.normalizeToProjectPath(
        '../設定/キャラクター/主人公.md',
        '/home/user/novel-project/contents/chapter1.md',
      );
      assert.strictEqual(result, '設定/キャラクター/主人公.md');
    });
  });
});
