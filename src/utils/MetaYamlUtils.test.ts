import * as assert from 'assert';
import {
  MetaYamlUtils,
  MetaYaml,
  DialogoiTreeItem,
  // 新しい型システム
  NewMetaYaml,
  SubdirectoryItem,
  ContentItem,
  SettingItem,
  CharacterItem,
  ForeshadowingItem,
  GlossaryItem,
  // 型ガード関数
  isSubdirectoryItem,
  isContentItem,
  isSettingItem,
  isCharacterItem,
  isForeshadowingItem,
  isGlossaryItem,
  // 変換関数
  convertToNewDialogoiTreeItem,
  convertToLegacyDialogoiTreeItem,
  convertToNewMetaYaml,
} from './MetaYamlUtils.js';

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

  // ===== 新しい型システムのテスト（Phase 2実装） =====
  
  suite('新しい型システム: 型ガード関数', () => {
    test('isSubdirectoryItem: サブディレクトリアイテムを正しく判定', () => {
      const item: SubdirectoryItem = {
        name: 'settings',
        type: 'subdirectory',
        path: '/test/settings',
        isUntracked: false,
        isMissing: false,
      };
      
      assert.strictEqual(isSubdirectoryItem(item), true);
      assert.strictEqual(isContentItem(item), false);
      assert.strictEqual(isSettingItem(item), false);
    });

    test('isContentItem: コンテンツアイテムを正しく判定', () => {
      const item: ContentItem = {
        name: 'chapter1.txt',
        type: 'content',
        path: '/test/chapter1.txt',
        isUntracked: false,
        isMissing: false,
        hash: 'abc123',
        tags: ['重要'],
        references: ['settings/world.md'],
        comments: '.chapter1.txt.comments.yaml',
      };
      
      assert.strictEqual(isContentItem(item), true);
      assert.strictEqual(isSubdirectoryItem(item), false);
      assert.strictEqual(isSettingItem(item), false);
    });

    test('isCharacterItem: キャラクターアイテムを正しく判定', () => {
      const item: CharacterItem = {
        name: 'hero.md',
        type: 'setting',
        path: '/test/hero.md',
        isUntracked: false,
        isMissing: false,
        hash: 'def456',
        tags: ['キャラクター'],
        comments: '.hero.md.comments.yaml',
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: '主人公',
        },
      };
      
      assert.strictEqual(isCharacterItem(item), true);
      assert.strictEqual(isSettingItem(item), false);
      assert.strictEqual(isForeshadowingItem(item), false);
      assert.strictEqual(isGlossaryItem(item), false);
    });

    test('isForeshadowingItem: 伏線アイテムを正しく判定', () => {
      const item: ForeshadowingItem = {
        name: 'plot.md',
        type: 'setting',
        path: '/test/plot.md',
        isUntracked: false,
        isMissing: false,
        hash: 'ghi789',
        tags: ['伏線'],
        comments: '.plot.md.comments.yaml',
        foreshadowing: {
          plants: [{ location: 'chapter1.txt', comment: '伏線設置' }],
          payoff: { location: 'chapter10.txt', comment: '伏線回収' },
        },
      };
      
      assert.strictEqual(isForeshadowingItem(item), true);
      assert.strictEqual(isCharacterItem(item), false);
      assert.strictEqual(isSettingItem(item), false);
      assert.strictEqual(isGlossaryItem(item), false);
    });

    test('isGlossaryItem: 用語集アイテムを正しく判定', () => {
      const item: GlossaryItem = {
        name: 'glossary.md',
        type: 'setting',
        path: '/test/glossary.md',
        isUntracked: false,
        isMissing: false,
        hash: 'jkl012',
        tags: ['用語集'],
        comments: '.glossary.md.comments.yaml',
        glossary: true,
      };
      
      assert.strictEqual(isGlossaryItem(item), true);
      assert.strictEqual(isCharacterItem(item), false);
      assert.strictEqual(isForeshadowingItem(item), false);
      assert.strictEqual(isSettingItem(item), false);
    });

    test('isSettingItem: 基本設定アイテムを正しく判定', () => {
      const item: SettingItem = {
        name: 'world.md',
        type: 'setting',
        path: '/test/world.md',
        isUntracked: false,
        isMissing: false,
        hash: 'mno345',
        tags: ['世界観'],
        comments: '.world.md.comments.yaml',
      };
      
      assert.strictEqual(isSettingItem(item), true);
      assert.strictEqual(isCharacterItem(item), false);
      assert.strictEqual(isForeshadowingItem(item), false);
      assert.strictEqual(isGlossaryItem(item), false);
    });
  });

  suite('新しい型システム: バリデーション', () => {
    test('validateNewDialogoiTreeItem: 正常なコンテンツアイテム', () => {
      const item: ContentItem = {
        name: 'chapter1.txt',
        type: 'content',
        path: '/test/chapter1.txt',
        isUntracked: false,
        isMissing: false,
        hash: 'abc123',
        tags: ['重要'],
        references: ['settings/world.md'],
        comments: '.chapter1.txt.comments.yaml',
      };
      
      const errors = MetaYamlUtils.validateNewDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 0);
    });

    test('validateNewDialogoiTreeItem: 正常なキャラクターアイテム', () => {
      const item: CharacterItem = {
        name: 'hero.md',
        type: 'setting',
        path: '/test/hero.md',
        isUntracked: false,
        isMissing: false,
        hash: 'def456',
        tags: ['キャラクター'],
        comments: '.hero.md.comments.yaml',
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: '主人公',
        },
      };
      
      const errors = MetaYamlUtils.validateNewDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 0);
    });

    test('validateNewDialogoiTreeItem: nameが空の場合エラー', () => {
      const item: SubdirectoryItem = {
        name: '',
        type: 'subdirectory',
        path: '/test/settings',
        isUntracked: false,
        isMissing: false,
      };
      
      const errors = MetaYamlUtils.validateNewDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0]?.includes('name フィールドは必須です'));
    });

    test('validateNewDialogoiTreeItem: contentアイテムのhashが空の場合エラー', () => {
      const item: ContentItem = {
        name: 'chapter1.txt',
        type: 'content',
        path: '/test/chapter1.txt',
        isUntracked: false,
        isMissing: false,
        hash: '',
        tags: [],
        references: [],
        comments: '',
      };
      
      const errors = MetaYamlUtils.validateNewDialogoiTreeItem(item);
      assert.ok(errors.some(error => error.includes('content アイテムには hash フィールドが必須です')));
    });

    test('validateNewMetaYaml: 正常なNewMetaYaml', () => {
      const meta: NewMetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            isUntracked: false,
            isMissing: false,
            hash: 'abc123',
            tags: ['重要'],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
          },
        ],
      };
      
      const errors = MetaYamlUtils.validateNewMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('validateNewMetaYaml: readmeが空の場合エラー', () => {
      const meta: NewMetaYaml = {
        readme: '',
        files: [],
      };
      
      const errors = MetaYamlUtils.validateNewMetaYaml(meta);
      assert.strictEqual(errors.length, 1);
      assert.ok(errors[0]?.includes('readme フィールドは必須です'));
    });
  });

  suite('新しい型システム: 変換関数', () => {
    test('convertToNewDialogoiTreeItem: 旧subdirectoryから新SubdirectoryItemへ', () => {
      const oldItem: DialogoiTreeItem = {
        name: 'settings',
        type: 'subdirectory',
        path: '/test/settings',
        isUntracked: true,
        isMissing: false,
      };
      
      const newItem = convertToNewDialogoiTreeItem(oldItem);
      assert.strictEqual(newItem.name, 'settings');
      assert.strictEqual(newItem.type, 'subdirectory');
      assert.strictEqual(newItem.path, '/test/settings');
      assert.strictEqual(newItem.isUntracked, true);
      assert.strictEqual(newItem.isMissing, false);
      assert.strictEqual(isSubdirectoryItem(newItem), true);
    });

    test('convertToNewDialogoiTreeItem: 旧contentから新ContentItemへ', () => {
      const oldItem: DialogoiTreeItem = {
        name: 'chapter1.txt',
        type: 'content',
        path: '/test/chapter1.txt',
        hash: 'abc123',
        tags: ['重要', '序章'],
        references: ['settings/world.md'],
        comments: '.chapter1.txt.comments.yaml',
      };
      
      const newItem = convertToNewDialogoiTreeItem(oldItem);
      assert.strictEqual(isContentItem(newItem), true);
      if (isContentItem(newItem)) {
        assert.strictEqual(newItem.name, 'chapter1.txt');
        assert.strictEqual(newItem.type, 'content');
        assert.strictEqual(newItem.hash, 'abc123');
        assert.deepStrictEqual(newItem.tags, ['重要', '序章']);
        assert.deepStrictEqual(newItem.references, ['settings/world.md']);
        assert.strictEqual(newItem.comments, '.chapter1.txt.comments.yaml');
      }
    });

    test('convertToNewDialogoiTreeItem: 旧characterから新CharacterItemへ', () => {
      const oldItem: DialogoiTreeItem = {
        name: 'hero.md',
        type: 'setting',
        path: '/test/hero.md',
        hash: 'def456',
        tags: ['キャラクター'],
        comments: '.hero.md.comments.yaml',
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: '主人公',
        },
      };
      
      const newItem = convertToNewDialogoiTreeItem(oldItem);
      assert.strictEqual(isCharacterItem(newItem), true);
      if (isCharacterItem(newItem)) {
        assert.strictEqual(newItem.character.importance, 'main');
        assert.strictEqual(newItem.character.multiple_characters, false);
        assert.strictEqual(newItem.character.display_name, '主人公');
      }
    });

    test('convertToLegacyDialogoiTreeItem: 新ContentItemから旧contentへ', () => {
      const newItem: ContentItem = {
        name: 'chapter1.txt',
        type: 'content',
        path: '/test/chapter1.txt',
        isUntracked: false,
        isMissing: false,
        hash: 'abc123',
        tags: ['重要'],
        references: ['settings/world.md'],
        comments: '.chapter1.txt.comments.yaml',
      };
      
      const oldItem = convertToLegacyDialogoiTreeItem(newItem);
      assert.strictEqual(oldItem.name, 'chapter1.txt');
      assert.strictEqual(oldItem.type, 'content');
      assert.strictEqual(oldItem.hash, 'abc123');
      assert.deepStrictEqual(oldItem.tags, ['重要']);
      assert.deepStrictEqual(oldItem.references, ['settings/world.md']);
      assert.strictEqual(oldItem.comments, '.chapter1.txt.comments.yaml');
    });

    test('convertToNewMetaYaml: 旧MetaYamlから新MetaYamlへ', () => {
      const oldMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            hash: 'abc123',
            tags: ['重要'],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
          },
        ],
      };
      
      const newMeta = convertToNewMetaYaml(oldMeta);
      assert.strictEqual(newMeta.readme, 'README.md');
      assert.strictEqual(newMeta.files.length, 1);
      const firstFile = newMeta.files[0];
      assert.notStrictEqual(firstFile, undefined);
      if (firstFile !== undefined) {
        assert.strictEqual(isContentItem(firstFile), true);
      }
    });

    test('往復変換テスト: 旧→新→旧', () => {
      const originalItem: DialogoiTreeItem = {
        name: 'hero.md',
        type: 'setting',
        path: '/test/hero.md',
        hash: 'def456',
        tags: ['キャラクター'],
        comments: '.hero.md.comments.yaml',
        character: {
          importance: 'main',
          multiple_characters: false,
          display_name: '主人公',
        },
        isUntracked: true,
        isMissing: false,
      };
      
      const newItem = convertToNewDialogoiTreeItem(originalItem);
      const backToOldItem = convertToLegacyDialogoiTreeItem(newItem);
      
      // 主要フィールドが保持されていることを確認
      assert.strictEqual(backToOldItem.name, originalItem.name);
      assert.strictEqual(backToOldItem.type, originalItem.type);
      assert.strictEqual(backToOldItem.path, originalItem.path);
      assert.strictEqual(backToOldItem.hash, originalItem.hash);
      assert.deepStrictEqual(backToOldItem.tags, originalItem.tags);
      assert.strictEqual(backToOldItem.character?.importance, originalItem.character?.importance);
      assert.strictEqual(backToOldItem.character?.multiple_characters, originalItem.character?.multiple_characters);
      assert.strictEqual(backToOldItem.character?.display_name, originalItem.character?.display_name);
    });
  });

  suite('新しい型システム: ユーティリティ関数', () => {
    test('createNewMetaYaml: 新しいMetaYamlを作成', () => {
      const meta = MetaYamlUtils.createNewMetaYaml('README.md');
      assert.strictEqual(meta.readme, 'README.md');
      assert.strictEqual(meta.files.length, 0);
      assert.ok(Array.isArray(meta.files));
      
      const errors = MetaYamlUtils.validateNewMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('stringifyNewMetaYaml: 新MetaYamlをYAML文字列に変換', () => {
      const meta: NewMetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/chapter1.txt',
            isUntracked: false,
            isMissing: false,
            hash: 'abc123',
            tags: ['重要'],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
          },
        ],
      };
      
      const yamlString = MetaYamlUtils.stringifyNewMetaYaml(meta);
      assert.ok(yamlString.includes('readme: README.md'));
      assert.ok(yamlString.includes('name: chapter1.txt'));
      assert.ok(yamlString.includes('type: content'));
      assert.ok(yamlString.includes('hash: abc123'));
    });
  });
});
