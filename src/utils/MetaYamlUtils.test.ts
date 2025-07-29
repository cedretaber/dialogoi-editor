import * as assert from 'assert';
import {
  MetaYamlUtils,
  MetaYaml,
  DialogoiTreeItem,
  SubdirectoryItem,
  ContentItem,
} from './MetaYamlUtils.js';

suite('MetaYamlUtils テストスイート', () => {
  suite('parseMetaYaml', () => {
    test('正常なYAMLを正しく解析する', () => {
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
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 2);

      const file1 = result?.files[0];
      assert.strictEqual(file1?.name, 'chapter1.txt');
      assert.strictEqual(file1?.type, 'content');
      if (file1?.type === 'content') {
        const contentItem = file1;
        assert.deepStrictEqual(contentItem.tags, ['重要', '序章']);
        assert.deepStrictEqual(contentItem.references, ['settings/world.md']);
        assert.strictEqual(contentItem.comments, '.chapter1.txt.comments.yaml');
        assert.strictEqual(contentItem.hash, 'abc123');
      }
    });

    test('最小構成のYAMLを正しく解析する', () => {
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
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, undefined);
      assert.strictEqual(result?.files.length, 1);
      assert.strictEqual(result?.files[0]?.name, 'test.txt');
      assert.strictEqual(result?.files[0]?.type, 'content');
      assert.strictEqual(result?.files[0]?.path, '/test/test.txt');
    });

    test('空のfilesを正しく解析する', () => {
      const yamlContent = `readme: README.md
files: []`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 0);
    });

    test('不正なYAMLの場合nullを返す', () => {
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
      assert.strictEqual(result, null);
    });

    test('空文字列の場合nullを返す', () => {
      const result = MetaYamlUtils.parseMetaYaml('');
      assert.strictEqual(result, null);
    });

    test('filesが未定義の場合nullを返す', () => {
      const yamlContent = `readme: README.md`;
      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.strictEqual(result, null);
    });
  });

  suite('stringifyMetaYaml', () => {
    test('正常なMetaYamlオブジェクトをYAML文字列に変換する', () => {
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
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.includes('readme: README.md'));
      assert.ok(result.includes('name: chapter1.txt'));
      assert.ok(result.includes('type: content'));
      assert.ok(result.includes('hash: abc123'));
    });

    test('readmeがない場合も正しく変換する', () => {
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

      assert.strictEqual(typeof result, 'string');
      assert.ok(result.includes('name: test.txt'));
      assert.ok(result.includes('type: content'));
      assert.ok(!result.includes('readme:'));
    });

    test('空のfilesを持つMetaYamlを正しく変換する', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.includes('readme: README.md'));
      assert.ok(result.includes('files: []'));
    });
  });

  suite('validateDialogoiTreeItem', () => {
    test('正常なコンテンツアイテムのバリデーションが成功する', () => {
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
      assert.strictEqual(errors.length, 0);
    });

    test('正常なサブディレクトリアイテムのバリデーションが成功する', () => {
      const item: SubdirectoryItem = {
        name: 'settings',
        type: 'subdirectory',
        path: '/test/settings',
        isUntracked: false,
        isMissing: false,
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 0);
    });

    test('nameが空の場合エラーを返す', () => {
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
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('name フィールドは必須です'));
      }
    });

    test('不正なtypeの場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'invalid',
        path: '/test/test.txt',
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(
          firstError.includes(
            'type フィールドは content, setting, subdirectory のいずれかである必要があります',
          ),
        );
      }
    });
  });

  suite('validateMetaYaml', () => {
    test('正常なMetaYamlのバリデーションが成功する', () => {
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
      assert.strictEqual(errors.length, 0);
    });

    test('filesが配列でない場合エラーを返す', () => {
      const invalidMeta = {
        readme: 'README.md',
        files: 'invalid',
      } as unknown as MetaYaml;

      const errors = MetaYamlUtils.validateMetaYaml(invalidMeta);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('files フィールドは配列である必要があります'));
      }
    });

    test('ファイルアイテムのエラーがある場合インデックス付きでエラーを返す', () => {
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
      assert.ok(errors.length > 0);
      assert.ok(errors.some((error) => error.includes('files[1]:')));
    });
  });

  suite('createMetaYaml', () => {
    test('新しいMetaYamlを作成', () => {
      const meta = MetaYamlUtils.createMetaYaml('README.md');
      assert.strictEqual(meta.readme, 'README.md');
      assert.strictEqual(meta.files.length, 0);
      assert.ok(Array.isArray(meta.files));

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('readmeなしで新しいMetaYamlを作成', () => {
      const meta = MetaYamlUtils.createMetaYaml();
      assert.strictEqual(meta.readme, undefined);
      assert.strictEqual(meta.files.length, 0);
      assert.ok(Array.isArray(meta.files));
    });
  });
});
