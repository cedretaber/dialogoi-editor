import { MetaYamlUtils } from './MetaYamlUtils.js';
import { MetaYaml } from '../models/MetaYaml.js';
import {
  DialogoiTreeItem,
  SubdirectoryItem,
  ContentItem,
  SettingItem,
  hasValidComments,
} from '../models/DialogoiTreeItem.js';

describe('MetaYamlUtils テストスイート', () => {
  describe('parseMetaYaml', () => {
    it('正常なYAMLを正しく解析する', () => {
      const yamlContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    hash: "abc123"
    tags:
      - 重要
      - 序章
    references:
      - settings/world.md
    comments: ".chapter1.txt.comments.yaml"
  - name: settings
    type: subdirectory`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.readme).toBe('README.md');
      expect(result?.files.length).toBe(2);

      const file1 = result?.files[0];
      expect(file1?.name).toBe('chapter1.txt');
      expect(file1?.type).toBe('content');
      // file1のtypeがcontentであることを確認済み、型アサーションで安全にアクセス
      const contentItem = file1 as DialogoiTreeItem & { type: 'content' };
      expect(contentItem.tags).toEqual(['重要', '序章']);
      expect(contentItem.references).toEqual(['settings/world.md']);
      expect(contentItem.comments).toBe('.chapter1.txt.comments.yaml');
      expect(contentItem.hash).toBe('abc123');
      // 実行時プロパティはダミー値で設定される
      expect(contentItem.path).toBe('');
      expect(contentItem.isUntracked).toBe(false);
      expect(contentItem.isMissing).toBe(false);
    });

    it('最小構成のYAMLを正しく解析する', () => {
      const yamlContent = `files:
  - name: test.txt
    type: content
    hash: "hash123"
    tags: []
    references: []`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.readme).toBe(undefined);
      expect(result?.files.length).toBe(1);
      expect(result?.files[0]?.name).toBe('test.txt');
      expect(result?.files[0]?.type).toBe('content');
      // 実行時プロパティはダミー値で設定される
      expect(result?.files[0]?.path).toBe('');
      expect(result?.files[0]?.isUntracked).toBe(false);
      expect(result?.files[0]?.isMissing).toBe(false);
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

    it('commentsフィールドがないコンテンツファイルを正しく解析する', () => {
      const yamlContent = `files:
  - name: test-no-comments.txt
    type: content
    path: /test/test-no-comments.txt
    hash: "hash456"
    tags: []
    references: []
    isUntracked: false
    isMissing: false`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.files.length).toBe(1);

      const file = result?.files[0];
      expect(file?.name).toBe('test-no-comments.txt');
      expect(file?.type).toBe('content');
      const contentItem = file as ContentItem;
      expect(contentItem.comments).toBeUndefined();
    });

    it('commentsフィールドがない設定ファイルを正しく解析する', () => {
      const yamlContent = `files:
  - name: setting-no-comments.md
    type: setting
    path: /test/setting-no-comments.md
    hash: "hash789"
    tags: []
    isUntracked: false
    isMissing: false`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      expect(result).not.toBe(null);
      expect(result?.files.length).toBe(1);

      const file = result?.files[0];
      expect(file?.name).toBe('setting-no-comments.md');
      expect(file?.type).toBe('setting');
      const settingItem = file as SettingItem;
      expect(settingItem.comments).toBeUndefined();
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
      // 実行時プロパティが除去されていることを確認
      expect(result.includes('path:')).toBeFalsy();
      expect(result.includes('isUntracked:')).toBeFalsy();
      expect(result.includes('isMissing:')).toBeFalsy();
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
      // 実行時プロパティが除去されていることを確認
      expect(result.includes('path:')).toBeFalsy();
      expect(result.includes('isUntracked:')).toBeFalsy();
      expect(result.includes('isMissing:')).toBeFalsy();
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

    it('commentsフィールドがないContentItemを正しく変換する', () => {
      const meta: MetaYaml = {
        files: [
          {
            name: 'test-no-comments.txt',
            type: 'content',
            path: '/test/test-no-comments.txt',
            hash: 'abc123',
            tags: ['tag1'],
            references: ['ref1'],
            // comments は省略（undefined）
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);
      expect(typeof result).toBe('string');
      expect(result.includes('name: test-no-comments.txt')).toBeTruthy();
      expect(result.includes('type: content')).toBeTruthy();
      expect(result.includes('hash: abc123')).toBeTruthy();
      // commentsフィールドがYAMLに含まれていないことを確認
      expect(result.includes('comments:')).toBeFalsy();
      // 実行時プロパティが除去されていることを確認
      expect(result.includes('path:')).toBeFalsy();
      expect(result.includes('isUntracked:')).toBeFalsy();
      expect(result.includes('isMissing:')).toBeFalsy();
    });

    it('commentsフィールドがないSettingItemを正しく変換する', () => {
      const meta: MetaYaml = {
        files: [
          {
            name: 'setting-no-comments.md',
            type: 'setting',
            path: '/test/setting-no-comments.md',
            hash: 'def456',
            tags: ['setting-tag'],
            // comments は省略（undefined）
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);
      expect(typeof result).toBe('string');
      expect(result.includes('name: setting-no-comments.md')).toBeTruthy();
      expect(result.includes('type: setting')).toBeTruthy();
      expect(result.includes('hash: def456')).toBeTruthy();
      // commentsフィールドがYAMLに含まれていないことを確認
      expect(result.includes('comments:')).toBeFalsy();
      // 実行時プロパティが除去されていることを確認
      expect(result.includes('path:')).toBeFalsy();
      expect(result.includes('isUntracked:')).toBeFalsy();
      expect(result.includes('isMissing:')).toBeFalsy();
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
      expect(firstError).toBeDefined();
      if (firstError === undefined) {
        throw new Error('firstError should be defined');
      }
      expect(firstError.includes('name フィールドは必須です')).toBeTruthy();
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
      expect(firstError).toBeDefined();
      if (firstError === undefined) {
        throw new Error('firstError should be defined');
      }
      expect(
        firstError.includes(
          'type フィールドは content, setting, subdirectory のいずれかである必要があります',
        ),
      ).toBeTruthy();
    });

    it('commentsフィールドがないコンテンツアイテムのバリデーションが成功する', () => {
      const item: ContentItem = {
        name: 'test-no-comments.txt',
        type: 'content',
        path: '/test/test-no-comments.txt',
        hash: 'abc123',
        tags: ['tag1'],
        references: ['ref1'],
        // comments は省略（undefined）
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(0);
    });

    it('commentsフィールドがない設定アイテムのバリデーションが成功する', () => {
      const item: SettingItem = {
        name: 'setting-no-comments.md',
        type: 'setting',
        path: '/test/setting-no-comments.md',
        hash: 'def456',
        tags: ['setting-tag'],
        // comments は省略（undefined）
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(0);
    });

    it('commentsが空文字列のコンテンツアイテムのバリデーションが成功する', () => {
      const item: ContentItem = {
        name: 'test-empty-comments.txt',
        type: 'content',
        path: '/test/test-empty-comments.txt',
        hash: 'ghi789',
        tags: [],
        references: [],
        comments: '', // 空文字列は許可される
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      expect(errors.length).toBe(0);
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
      if (firstError === undefined) {
        throw new Error('firstError should not be undefined');
      }
      expect(firstError.includes('files フィールドは配列である必要があります')).toBeTruthy();
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

  describe('hasValidComments 型ガード関数', () => {
    it('有効なcommentsを持つContentItemでtrueを返す', () => {
      const item: ContentItem = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        hash: 'abc123',
        tags: [],
        references: [],
        comments: '.test.txt.comments.yaml',
        isUntracked: false,
        isMissing: false,
      };

      const result = hasValidComments(item);
      expect(result).toBe(true);

      // 型ガードテスト - 条件外でexpectを実行
      const isString = result && typeof item.comments === 'string';
      const hasLength = result && item.comments !== undefined && item.comments.length > 0;
      expect(isString).toBe(true);
      expect(hasLength).toBe(true);
    });

    it('有効なcommentsを持つSettingItemでtrueを返す', () => {
      const item: SettingItem = {
        name: 'setting.md',
        type: 'setting',
        path: '/test/setting.md',
        hash: 'def456',
        tags: [],
        comments: '.setting.md.comments.yaml',
        isUntracked: false,
        isMissing: false,
      };

      const result = hasValidComments(item);
      expect(result).toBe(true);

      // 型ガードテスト - 条件外でexpectを実行
      const isString = result && typeof item.comments === 'string';
      const hasLength = result && item.comments !== undefined && item.comments.length > 0;
      expect(isString).toBe(true);
      expect(hasLength).toBe(true);
    });

    it('commentsがundefinedのContentItemでfalseを返す', () => {
      const item: ContentItem = {
        name: 'test-no-comments.txt',
        type: 'content',
        path: '/test/test-no-comments.txt',
        hash: 'ghi789',
        tags: [],
        references: [],
        // comments: undefined
        isUntracked: false,
        isMissing: false,
      };

      expect(hasValidComments(item)).toBe(false);
    });

    it('commentsが空文字列のSettingItemでfalseを返す', () => {
      const item: SettingItem = {
        name: 'setting-empty-comments.md',
        type: 'setting',
        path: '/test/setting-empty-comments.md',
        hash: 'jkl012',
        tags: [],
        comments: '', // 空文字列
        isUntracked: false,
        isMissing: false,
      };

      expect(hasValidComments(item)).toBe(false);
    });

    it('SubdirectoryItemでfalseを返す', () => {
      const item: SubdirectoryItem = {
        name: 'subdirectory',
        type: 'subdirectory',
        path: '/test/subdirectory',
        isUntracked: false,
        isMissing: false,
      };

      expect(hasValidComments(item)).toBe(false);
    });

    it('commentsフィールドがない（"comments" in item === false）場合にfalseを返す', () => {
      // commentsプロパティが存在しないオブジェクトを作成
      const itemBase = {
        name: 'test-no-prop.txt',
        type: 'content' as const,
        path: '/test/test-no-prop.txt',
        hash: 'mno345',
        tags: [],
        references: [],
        isUntracked: false,
        isMissing: false,
      };

      // commentsプロパティを意図的に除外したオブジェクトを作成
      const item = itemBase as ContentItem;

      expect(hasValidComments(item)).toBe(false);
    });
  });
});
