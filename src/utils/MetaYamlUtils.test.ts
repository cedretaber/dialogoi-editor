import {
  MetaYamlUtils,
  MetaYaml,
  DialogoiTreeItem,
  SubdirectoryItem,
  ContentItem,
} from './MetaYamlUtils.js';

describe('MetaYamlUtils テストスイート', () => {
  describe('parseMetaYaml', () => {
    it('正常なYAMLを正しく解析する', () => {
      const yamlContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/chapter1.txt
    hash: "abc123"
    tags:
      - 重要
      - 序章
    references:
      - settings/world.md
    comments: ".chapter1.txt.comments.yaml"
    isUntracked: false
    isMissing: false
  - name: settings
    type: subdirectory
    path: /test/settings
    isUntracked: false
    isMissing: false`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.readme).toBe('README.md');
      expect(result?.files.length).toBe(2);

      const file1 = result?.files[0];
      expect(file1?.name).toBe('chapter1.txt');
      expect(file1?.type).toBe('content');
      if (file1?.type === 'content') {
        const contentItem = file1;
        expect(contentItem.tags).toEqual(['重要', '序章']);
        expect(contentItem.references).toEqual(['settings/world.md']);
        expect(contentItem.comments).toBe('.chapter1.txt.comments.yaml');
        expect(contentItem.hash).toBe('abc123');
      }
    });

    it('最小構成のYAMLを正しく解析する', () => {
      const yamlContent = `files:
  - name: test.txt
    type: content
    path: /test/test.txt
    hash: "hash123"
    tags: []
    references: []
    comments: ".test.txt.comments.yaml"
    isUntracked: false
    isMissing: false`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.readme).toBe(undefined);
      expect(result?.files.length).toBe(1);
      expect(result?.files[0]?.name).toBe('test.txt');
      expect(result?.files[0]?.type).toBe('content');
      expect(result?.files[0]?.path).toBe('/test/test.txt');
    });

    it('空のfilesを正しく解析する', () => {
      const yamlContent = `readme: README.md
files: []`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.readme).toBe('README.md');
      expect(result?.files.length).toBe(0);
    });

    it('不正なYAMLの場合nullを返す', () => {
      const invalidYaml = `readme: README.md
files:
  - name: test.txt
    type: content
    path: /test/test.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - invalid: yaml: syntax`;

      const result = MetaYamlUtils.parseMetaYaml(invalidYaml);
      expect(result).toBe(null);
    });

    it('空文字列の場合nullを返す', () => {
      const result = MetaYamlUtils.parseMetaYaml('');
      expect(result).toBe(null);
    });

    it('filesが未定義の場合nullを返す', () => {
      const yamlContent = `readme: README.md`;
      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).toBe(null);
    });
  });

  describe('stringifyMetaYaml', () => {
    it('正常なMetaYamlオブジェクトをYAML文字列に変換する', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            hash: 'abc123',
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: '/test/settings',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);

      // 結果の検証
      expect(typeof result).toBe('string');
      expect(result.includes('readme: README.md')).toBeTruthy();
      expect(result.includes('name: chapter1.txt')).toBeTruthy();
      expect(result.includes('type: content')).toBeTruthy();
      expect(result.includes('hash: abc123')).toBeTruthy();
    });

    it('readmeがない場合も正しく変換する', () => {
      const meta = {
        files: [
          {
            name: 'test.txt',
            type: 'content',
            path: '/test/test.txt',
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.test.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      } as unknown as MetaYaml;

      const result = MetaYamlUtils.stringifyMetaYaml(meta);

      expect(typeof result).toBe('string');
      expect(result.includes('name: test.txt')).toBeTruthy();
      expect(result.includes('type: content')).toBeTruthy();
      expect(!result.includes('readme:')).toBeTruthy();
    });

    it('空のfilesを持つMetaYamlを正しく変換する', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);
      expect(typeof result).toBe('string');
      expect(result.includes('readme: README.md')).toBeTruthy();
      expect(result.includes('files: []')).toBeTruthy();
    });
  });

  describe('validateDialogoiTreeItem', () => {
    it('正常なコンテンツアイテムのバリデーションが成功する', () => {
      const item: ContentItem = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        hash: 'abc123',
        tags: ['tag1', 'tag2'],
        references: ['ref1', 'ref2'],
        comments: '.test.txt.comments.yaml',
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(0);
    });

    it('正常なサブディレクトリアイテムのバリデーションが成功する', () => {
      const item: SubdirectoryItem = {
        name: 'settings',
        type: 'subdirectory',
        path: '/test/settings',
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(0);
    });

    it('nameが空の場合エラーを返す', () => {
      const item: ContentItem = {
        name: '',
        type: 'content',
        path: '/test/test.txt',
        hash: 'abc123',
        tags: [],
        references: [],
        comments: '.test.txt.comments.yaml',
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        expect(firstError.includes('name フィールドは必須です')).toBeTruthy();
      }
    });

    it('不正なtypeの場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'invalid',
        path: '/test/test.txt',
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        expect(
          firstError.includes(
            'type フィールドは content, setting, subdirectory のいずれかである必要があります',
          ),
        ).toBeTruthy();
      }
    });
  });

  describe('validateMetaYaml', () => {
    it('正常なMetaYamlのバリデーションが成功する', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'test.txt',
            type: 'content',
            path: '/test/test.txt',
            hash: 'abc123',
            tags: [],
            references: [],
            comments: '.test.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: '/test/settings',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      expect(errors.length).toBe(0);
    });

    it('filesが配列でない場合エラーを返す', () => {
      const invalidMeta = {
        readme: 'README.md',
        files: 'invalid',
      } as unknown as MetaYaml;

      const errors = MetaYamlUtils.validateMetaYaml(invalidMeta);
      expect(errors.length).toBe(1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        expect(firstError.includes('files フィールドは配列である必要があります')).toBeTruthy();
      }
    });

    it('ファイルアイテムのエラーがある場合インデックス付きでエラーを返す', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'valid.txt',
            type: 'content',
            path: '/test/valid.txt',
            hash: 'abc123',
            tags: [],
            references: [],
            comments: '.valid.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: '',
            type: 'invalid',
            path: '/test/invalid.txt',
          } as unknown as DialogoiTreeItem,
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      expect(errors.length > 0).toBeTruthy();
      expect(errors.some((error) => error.includes('files[1]:'))).toBeTruthy();
    });
  });

  describe('createMetaYaml', () => {
    it('新しいMetaYamlを作成', () => {
      const meta = MetaYamlUtils.createMetaYaml('README.md');
      expect(meta.readme).toBe('README.md');
      expect(meta.files.length).toBe(0);
      expect(Array.isArray(meta.files)).toBeTruthy();

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      expect(errors.length).toBe(0);
    });

    it('readmeなしで新しいMetaYamlを作成', () => {
      const meta = MetaYamlUtils.createMetaYaml();
      expect(meta.readme).toBe(undefined);
      expect(meta.files.length).toBe(0);
      expect(Array.isArray(meta.files)).toBeTruthy();
    });
  });
});
