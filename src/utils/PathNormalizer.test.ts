import * as path from 'path';
import { PathNormalizer } from './PathNormalizer.js';

describe('PathNormalizer テストスイート', () => {
  const testProjectRoot = '/home/user/novel-project';

  describe('normalizeToProjectPath', () => {
    it('プロジェクトルート相対パスはそのまま返す', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        'settings/characters/hero.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/characters/hero.md');
    });

    it('現在ファイルからの相対パスをプロジェクトルート相対パスに変換', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '../settings/world.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/world.md');
    });

    it('複雑な相対パスを正規化', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '../../settings/characters/hero.md',
        '/home/user/novel-project/contents/volume1/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/characters/hero.md');
    });

    it('同一ディレクトリ内のファイル参照', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        './hero.md',
        '/home/user/novel-project/settings/characters/villain.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/characters/hero.md');
    });

    it('プロジェクト外のファイルはnullを返す', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '../../../external/file.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe(null);
    });

    it('外部URLはnullを返す', () => {
      const testUrls = [
        'https://example.com/page.html',
        'http://example.com',
        'ftp://files.example.com/file.zip',
        'mailto:user@example.com',
        'tel:+1234567890',
      ];

      testUrls.forEach((url) => {
        const result = PathNormalizer.normalizeToProjectPath(
          url,
          '/home/user/novel-project/contents/chapter1.md',
          testProjectRoot,
        );
        expect(result).toBe(null);
      });
    });

    it('絶対パスは対象外', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '/absolute/path/to/file.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe(null);
    });
  });

  describe('resolveProjectPath', () => {
    it('プロジェクトルート相対パスを絶対パスに変換', () => {
      const result = PathNormalizer.resolveProjectPath('settings/world.md', testProjectRoot);
      expect(result).toBe(path.join(testProjectRoot, 'settings/world.md'));
    });

    it('ルートディレクトリのファイル', () => {
      const result = PathNormalizer.resolveProjectPath('README.md', testProjectRoot);
      expect(result).toBe(path.join(testProjectRoot, 'README.md'));
    });
  });

  describe('getProjectRelativePath', () => {
    it('絶対パスをプロジェクトルート相対パスに変換', () => {
      const absolutePath = path.join(testProjectRoot, 'settings', 'world.md');
      const result = PathNormalizer.getProjectRelativePath(absolutePath, testProjectRoot);
      expect(result).toBe('settings/world.md');
    });

    it('プロジェクト外の絶対パスはnullを返す', () => {
      const result = PathNormalizer.getProjectRelativePath(
        '/external/path/file.md',
        testProjectRoot,
      );
      expect(result).toBe(null);
    });

    it('プロジェクトルート自体のファイル', () => {
      const absolutePath = path.join(testProjectRoot, 'dialogoi.yaml');
      const result = PathNormalizer.getProjectRelativePath(absolutePath, testProjectRoot);
      expect(result).toBe('dialogoi.yaml');
    });
  });

  describe('isSamePath', () => {
    it('同じパスの場合true', () => {
      expect(PathNormalizer.isSamePath('settings/world.md', 'settings/world.md')).toBe(true);
    });

    it('異なるパスの場合false', () => {
      expect(PathNormalizer.isSamePath('settings/world.md', 'settings/characters/hero.md')).toBe(
        false,
      );
    });

    it('パス区切り文字が異なっても同じパスと認識', () => {
      expect(PathNormalizer.isSamePath('settings\\world.md', 'settings/world.md')).toBe(true);
    });
  });

  describe('Windows パス対応', () => {
    it('Windows形式のパス区切り文字を正規化', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        'settings\\characters\\hero.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/characters/hero.md');
    });
  });

  describe('エッジケース', () => {
    it('空文字列の場合', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe(null);
    });

    it('ドット単体（現在ディレクトリ）', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '.',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      // ドット（現在ディレクトリ）は contents ディレクトリを指す
      expect(result).toBe('contents');
    });

    it('ファイル名にスペースが含まれる場合', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '../settings/character name.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('settings/character name.md');
    });

    it('日本語ファイル名', () => {
      const result = PathNormalizer.normalizeToProjectPath(
        '../設定/キャラクター/主人公.md',
        '/home/user/novel-project/contents/chapter1.md',
        testProjectRoot,
      );
      expect(result).toBe('設定/キャラクター/主人公.md');
    });
  });

  describe('normalizePathSeparators', () => {
    it('Windows形式のパス区切り文字をUnix形式に変換', () => {
      const result = PathNormalizer.normalizePathSeparators('settings\\characters\\hero.md');
      expect(result).toBe('settings/characters/hero.md');
    });

    it('混在したパス区切り文字を統一', () => {
      const result = PathNormalizer.normalizePathSeparators('settings/characters\\hero.md');
      expect(result).toBe('settings/characters/hero.md');
    });

    it('Unix形式のパスはそのまま', () => {
      const result = PathNormalizer.normalizePathSeparators('settings/characters/hero.md');
      expect(result).toBe('settings/characters/hero.md');
    });
  });
});
