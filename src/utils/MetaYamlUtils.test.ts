import * as assert from 'assert';
import { MetaYamlUtils, MetaYaml, DialogoiTreeItem } from './MetaYamlUtils.js';

suite('MetaYamlUtils テストスイート', () => {
  suite('parseMetaYaml', () => {
    test('正常なYAMLを正しく解析する', () => {
      const yamlContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/chapter1.txt
    tags:
      - 重要
      - 序章
    references:
      - settings/world.md
    character:
      importance: main
      multiple_characters: false
      display_name: "主人公"
    foreshadowing:
      plants:
        - location: "chapter1.txt"
          comment: "伏線設置"
      payoff:
        location: "chapter10.txt"
        comment: "伏線回収"
    comments: ".chapter1.txt.comments.yaml"
    glossary: true
    hash: "abc123"
  - name: settings
    type: subdirectory
    path: /test/settings`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 2);

      const file1 = result?.files[0];
      assert.strictEqual(file1?.name, 'chapter1.txt');
      assert.strictEqual(file1?.type, 'content');
      assert.deepStrictEqual(file1?.tags, ['重要', '序章']);
      assert.deepStrictEqual(file1?.references, ['settings/world.md']);
      assert.strictEqual(file1?.character?.importance, 'main');
      assert.strictEqual(file1?.character?.multiple_characters, false);
      assert.strictEqual(file1?.character?.display_name, '主人公');
      assert.strictEqual(file1?.foreshadowing?.plants?.[0]?.location, 'chapter1.txt');
      assert.strictEqual(file1?.foreshadowing?.payoff?.location, 'chapter10.txt');
      assert.strictEqual(file1?.comments, '.chapter1.txt.comments.yaml');
      assert.strictEqual(file1?.glossary, true);
      assert.strictEqual(file1?.hash, 'abc123');
    });

    test('最小構成のYAMLを正しく解析する', () => {
      const yamlContent = `files:
  - name: test.txt
    type: content
    path: /test/test.txt`;

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

    test('filesフィールドがない場合nullを返す', () => {
      const yamlContent = `readme: README.md`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.strictEqual(result, null);
    });

    test('不正なYAML形式の場合nullを返す', () => {
      const yamlContent = `readme: README.md
files:
  - name: test.txt
    type: content
    path: /test/test.txt
  - invalid: yaml: content`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.strictEqual(result, null);
    });

    test('空の内容の場合nullを返す', () => {
      const result = MetaYamlUtils.parseMetaYaml('');
      assert.strictEqual(result, null);
    });

    test('nullの内容の場合nullを返す', () => {
      const yamlContent = `---`;
      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.strictEqual(result, null);
    });
  });

  suite('stringifyMetaYaml', () => {
    test('MetaYamlオブジェクトをYAML文字列に変換する', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            character: {
              importance: 'main',
              multiple_characters: false,
              display_name: '主人公',
            },
            foreshadowing: {
              plants: [{ location: 'chapter1.txt', comment: '伏線設置' }],
              payoff: { location: 'chapter10.txt', comment: '伏線回収' },
            },
            comments: '.chapter1.txt.comments.yaml',
            glossary: true,
            hash: 'abc123',
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: '/test/settings',
          },
        ],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);

      // 結果の検証
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.includes('readme: README.md'));
      assert.ok(result.includes('name: chapter1.txt'));
      assert.ok(result.includes('type: content'));
      assert.ok(result.includes('type: subdirectory'));
      assert.ok(result.includes('importance: main'));
      assert.ok(result.includes('multiple_characters: false'));
      assert.ok(result.includes('display_name: 主人公'));
      assert.ok(result.includes('location: chapter1.txt'));
      assert.ok(result.includes('location: chapter10.txt'));
      assert.ok(result.includes('comments: .chapter1.txt.comments.yaml'));
      assert.ok(result.includes('glossary: true'));
      assert.ok(result.includes('hash: abc123'));
    });

    test('readmeがない場合も正しく変換する', () => {
      const meta: MetaYaml = {
        files: [
          {
            name: 'test.txt',
            type: 'content',
            path: '/test/test.txt',
          },
        ],
      };

      const result = MetaYamlUtils.stringifyMetaYaml(meta);

      assert.strictEqual(typeof result, 'string');
      assert.ok(result.includes('name: test.txt'));
      assert.ok(result.includes('type: content'));
      assert.ok(!result.includes('readme:'));
    });

    test('空のfiles配列も正しく変換する', () => {
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
    test('正常なアイテムのバリデーションが成功する', () => {
      const item: DialogoiTreeItem = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        tags: ['tag1', 'tag2'],
        references: ['ref1', 'ref2'],
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: 'テストキャラクター',
        },
        foreshadowing: {
          plants: [{ location: 'chapter1.txt', comment: '伏線設置' }],
          payoff: { location: 'chapter10.txt', comment: '伏線回収' },
        },
        comments: '.test.txt.comments.yaml',
        glossary: true,
        hash: 'abc123',
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 0);
    });

    test('nameが空の場合エラーを返す', () => {
      const item: DialogoiTreeItem = {
        name: '',
        type: 'content',
        path: '/test/test.txt',
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('name フィールドは必須です'));
      }
    });

    test('不正なtype値の場合エラーを返す', () => {
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

    test('tagsが配列でない場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        tags: 'invalid',
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('tags フィールドは配列である必要があります'));
      }
    });

    test('referencesが配列でない場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        references: 'invalid',
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('references フィールドは配列である必要があります'));
      }
    });

    test('character.importanceが不正な値の場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        character: {
          importance: 'invalid',
          multiple_characters: false,
        },
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(
          firstError.includes(
            'character.importance は main, sub, background のいずれかである必要があります',
          ),
        );
      }
    });

    test('character.multiple_charactersがbooleanでない場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        character: {
          importance: 'main',
          multiple_characters: 'invalid',
        },
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(
          firstError.includes('character.multiple_characters は boolean である必要があります'),
        );
      }
    });

    test('character.display_nameが文字列でない場合エラーを返す', () => {
      const item = {
        name: 'test.txt',
        type: 'content',
        path: '/test/test.txt',
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: 123,
        },
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('character.display_name は string である必要があります'));
      }
    });

    test('複数のエラーがある場合すべてのエラーを返す', () => {
      const item = {
        name: '',
        type: 'invalid',
        path: '/test/test.txt',
        tags: 'invalid',
        references: 'invalid',
        character: {
          importance: 'invalid',
          multiple_characters: 'invalid',
          display_name: 123,
        },
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 7);
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
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: '/test/settings',
          },
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('filesが配列でない場合エラーを返す', () => {
      const meta = {
        readme: 'README.md',
        files: 'invalid',
      } as unknown as MetaYaml;

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.strictEqual(errors.length, 1);
      const firstError = errors[0];
      if (firstError !== undefined) {
        assert.ok(firstError.includes('files フィールドは配列である必要があります'));
      }
    });

    test('空のfiles配列は正常', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('ファイルアイテムのエラーがある場合インデックス付きでエラーを返す', () => {
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'valid.txt',
            type: 'content',
            path: '/test/valid.txt',
          },
          {
            name: '',
            type: 'invalid',
            path: '/test/invalid.txt',
          } as unknown as DialogoiTreeItem,
          {
            name: 'another.txt',
            type: 'content',
            path: '/test/another.txt',
            tags: 'invalid',
          } as unknown as DialogoiTreeItem,
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.ok(errors.length > 0);
      assert.ok(errors.some((error) => error.includes('files[1]:')));
      assert.ok(errors.some((error) => error.includes('files[2]:')));
    });
  });

  suite('createMetaYaml', () => {
    test('readmeファイル名を指定して新しいMetaYamlを作成する', () => {
      const result = MetaYamlUtils.createMetaYaml('README.md');
      assert.strictEqual(result.readme, 'README.md');
      assert.strictEqual(result.files.length, 0);
      assert.ok(Array.isArray(result.files));
    });

    test('readmeファイル名を指定せずに新しいMetaYamlを作成する', () => {
      const result = MetaYamlUtils.createMetaYaml();
      assert.strictEqual(result.readme, undefined);
      assert.strictEqual(result.files.length, 0);
      assert.ok(Array.isArray(result.files));
    });

    test('空文字列のreadmeファイル名を指定して新しいMetaYamlを作成する', () => {
      const result = MetaYamlUtils.createMetaYaml('');
      assert.strictEqual(result.readme, '');
      assert.strictEqual(result.files.length, 0);
      assert.ok(Array.isArray(result.files));
    });

    test('作成されたMetaYamlがバリデーションを通過する', () => {
      const result = MetaYamlUtils.createMetaYaml('README.md');
      const errors = MetaYamlUtils.validateMetaYaml(result);
      assert.strictEqual(errors.length, 0);
    });
  });

  suite('相互変換テスト', () => {
    test('parseMetaYamlとstringifyMetaYamlの相互変換', () => {
      const originalMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            character: {
              importance: 'main',
              multiple_characters: false,
              display_name: '主人公',
            },
            foreshadowing: {
              plants: [{ location: 'chapter1.txt', comment: '伏線設置' }],
              payoff: { location: 'chapter10.txt', comment: '伏線回収' },
            },
            comments: '.chapter1.txt.comments.yaml',
            glossary: true,
            hash: 'abc123',
          },
        ],
      };

      // stringify -> parse -> stringify の変換テスト
      const yamlString = MetaYamlUtils.stringifyMetaYaml(originalMeta);
      const parsedMeta = MetaYamlUtils.parseMetaYaml(yamlString);
      assert.notStrictEqual(parsedMeta, null);

      if (parsedMeta !== null) {
        const yamlString2 = MetaYamlUtils.stringifyMetaYaml(parsedMeta);
        const parsedMeta2 = MetaYamlUtils.parseMetaYaml(yamlString2);

        // 両方の変換結果が同じであることを確認
        assert.deepStrictEqual(parsedMeta, parsedMeta2);
      }
    });

    test('バリデーションエラーがある場合の相互変換', () => {
      const yamlWithError = `readme: README.md
files:
  - name: ""
    type: invalid
    path: /test/test.txt`;

      const parsedMeta = MetaYamlUtils.parseMetaYaml(yamlWithError);
      assert.notStrictEqual(parsedMeta, null);

      if (parsedMeta !== null) {
        const errors = MetaYamlUtils.validateMetaYaml(parsedMeta);
        assert.ok(errors.length > 0);
      }
    });
  });
});
