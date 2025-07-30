import { DialogoiYamlUtils, DialogoiYaml } from './DialogoiYamlUtils.js';

describe('DialogoiYamlUtils テストスイート', () => {
  describe('parseDialogoiYaml', () => {
    it('正常なYAMLを正しく解析する', () => {
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
created_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー", "冒険"]`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      expect(result).not.toBe(null);
      expect(result?.title).toBe('テスト小説');
      expect(result?.author).toBe('テスト著者');
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
      expect(result?.tags).toEqual(['ファンタジー', '冒険']);
    });

    it('最小構成のYAMLを正しく解析する', () => {
      const yamlContent = `title: "最小テスト"
author: "著者"
created_at: "2024-01-01T00:00:00Z"`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      expect(result).not.toBe(null);
      expect(result?.title).toBe('最小テスト');
      expect(result?.author).toBe('著者');
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
      expect(result?.tags).toBe(undefined);
    });

    it('必須フィールドが欠けている場合nullを返す', () => {
      const yamlContent = `title: "テスト小説"
author: "テスト著者"`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      expect(result).toBe(null);
    });

    it('不正なYAML形式の場合nullを返す', () => {
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
invalid: yaml: syntax`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      expect(result).toBe(null);
    });

    it('空の内容の場合nullを返す', () => {
      const result = DialogoiYamlUtils.parseDialogoiYaml('');

      expect(result).toBe(null);
    });
  });

  describe('stringifyDialogoiYaml', () => {
    it('DialogoiYamlオブジェクトをYAML文字列に変換する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー', '冒険'],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: ['*.tmp'],
        },
      };

      const result = DialogoiYamlUtils.stringifyDialogoiYaml(data);

      expect(result.includes('title: テスト小説')).toBeTruthy();
      expect(result.includes('author: テスト著者')).toBeTruthy();
      expect(
        result.includes("created_at: '2024-01-01T00:00:00Z'") ||
          result.includes('created_at: 2024-01-01T00:00:00Z'),
      ).toBeTruthy();
      expect(result.includes('tags:')).toBeTruthy();
      expect(result.includes('- ファンタジー')).toBeTruthy();
      expect(result.includes('- 冒険')).toBeTruthy();
    });

    it('空のtagsでも正しく変換する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = DialogoiYamlUtils.stringifyDialogoiYaml(data);

      expect(result.includes('title: テスト小説')).toBeTruthy();
      expect(result.includes('author: テスト著者')).toBeTruthy();
      expect(
        result.includes("created_at: '2024-01-01T00:00:00Z'") ||
          result.includes('created_at: 2024-01-01T00:00:00Z'),
      ).toBeTruthy();
      expect(result.includes('tags: []')).toBeTruthy(); // 空のtagsが出力される
    });
  });

  describe('validateDialogoiYaml', () => {
    it('正常なデータのバリデーションが成功する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー'],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('必須フィールドが欠けている場合エラーを返す', () => {
      const data = {
        title: '',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
      } as DialogoiYaml;

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('title'))).toBeTruthy();
    });

    it('不正な日付形式の場合エラーを返す', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01',
        tags: [],
        updated_at: '2024-01-01',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2); // created_atとupdated_atの両方がエラー
      expect(result.errors.some((error) => error.includes('created_at'))).toBeTruthy();
      expect(result.errors.some((error) => error.includes('updated_at'))).toBeTruthy();
    });

    it('tagsが配列でない場合エラーを返す', () => {
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: 'ファンタジー' as unknown as string[],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('tags'))).toBeTruthy();
    });

    it('複数のエラーがある場合すべてのエラーを返す', () => {
      const data = {
        title: '',
        author: '',
        created_at: '',
        tags: 'not-array' as unknown as string[],
        updated_at: '',
        project_settings: {
          readme_filename: '',
          exclude_patterns: [],
        },
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      expect(result.isValid).toBe(false);
      expect(result.errors.length >= 5).toBeTruthy(); // title, author, created_at, updated_at, tags
    });
  });

  describe('createDialogoiYaml', () => {
    it('基本的なDialogoiYamlオブジェクトを作成する', () => {
      const result = DialogoiYamlUtils.createDialogoiYaml('新しい小説', '新しい著者');

      expect(result.title).toBe('新しい小説');
      expect(result.author).toBe('新しい著者');
      expect(result.created_at).toBeTruthy();
      expect(!isNaN(new Date(result.created_at).getTime())).toBeTruthy();
      expect(result.tags).toEqual([]);
      expect(result.updated_at).toBe(result.created_at);
      expect(result.project_settings).toEqual({
        readme_filename: 'README.md',
        exclude_patterns: [
          '.*',
          '.DS_Store',
          'Thumbs.db',
          'desktop.ini',
          '$RECYCLE.BIN',
          '.Trash',
          '.git',
          '.gitignore',
          '.hg',
          '.svn',
          '*.tmp',
          '*.temp',
          '*.log',
          '*.bak',
          '*.old',
          'node_modules',
          'dist',
          'build',
        ],
      });
    });

    it('タグ付きのDialogoiYamlオブジェクトを作成する', () => {
      const tags = ['ファンタジー', '冒険'];
      const result = DialogoiYamlUtils.createDialogoiYaml('新しい小説', '新しい著者', tags);

      expect(result.title).toBe('新しい小説');
      expect(result.author).toBe('新しい著者');
      expect(result.created_at).toBeTruthy();
      expect(result.tags).toEqual(tags);
      expect(result.updated_at).toBe(result.created_at);
      expect(result.project_settings).toEqual({
        readme_filename: 'README.md',
        exclude_patterns: [
          '.*',
          '.DS_Store',
          'Thumbs.db',
          'desktop.ini',
          '$RECYCLE.BIN',
          '.Trash',
          '.git',
          '.gitignore',
          '.hg',
          '.svn',
          '*.tmp',
          '*.temp',
          '*.log',
          '*.bak',
          '*.old',
          'node_modules',
          'dist',
          'build',
        ],
      });
    });

    it('created_atが現在時刻に近い値になる', () => {
      const before = new Date().toISOString();
      const result = DialogoiYamlUtils.createDialogoiYaml('テスト', 'テスト');
      const after = new Date().toISOString();

      expect(result.created_at >= before).toBeTruthy();
      expect(result.created_at <= after).toBeTruthy();
      expect(result.updated_at).toBe(result.created_at);
    });
  });
});
