import { suite, test } from 'mocha';
import * as assert from 'assert';
import { DialogoiYamlUtils, DialogoiYaml } from './DialogoiYamlUtils.js';

suite('DialogoiYamlUtils テストスイート', () => {
  suite('parseDialogoiYaml', () => {
    test('正常なYAMLを正しく解析する', () => {
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
created_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー", "冒険"]`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, 'テスト小説');
      assert.strictEqual(result?.author, 'テスト著者');
      assert.strictEqual(result?.created_at, '2024-01-01T00:00:00Z');
      assert.deepStrictEqual(result?.tags, ['ファンタジー', '冒険']);
    });

    test('最小構成のYAMLを正しく解析する', () => {
      const yamlContent = `title: "最小テスト"
author: "著者"
created_at: "2024-01-01T00:00:00Z"`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.title, '最小テスト');
      assert.strictEqual(result?.author, '著者');
      assert.strictEqual(result?.created_at, '2024-01-01T00:00:00Z');
      assert.strictEqual(result?.tags, undefined);
    });

    test('必須フィールドが欠けている場合nullを返す', () => {
      const yamlContent = `title: "テスト小説"
author: "テスト著者"`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      assert.strictEqual(result, null);
    });

    test('不正なYAML形式の場合nullを返す', () => {
      const yamlContent = `title: "テスト小説"
  author: "テスト著者"`;

      const result = DialogoiYamlUtils.parseDialogoiYaml(yamlContent);

      assert.strictEqual(result, null);
    });

    test('空の内容の場合nullを返す', () => {
      const result = DialogoiYamlUtils.parseDialogoiYaml('');

      assert.strictEqual(result, null);
    });
  });

  suite('stringifyDialogoiYaml', () => {
    test('DialogoiYamlオブジェクトをYAML文字列に変換する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー', '冒険'],
      };

      const result = DialogoiYamlUtils.stringifyDialogoiYaml(data);

      assert.ok(result.includes('title: テスト小説'));
      assert.ok(result.includes('author: テスト著者'));
      assert.ok(
        result.includes("created_at: '2024-01-01T00:00:00Z'") ||
          result.includes('created_at: 2024-01-01T00:00:00Z'),
      );
      assert.ok(result.includes('tags:'));
      assert.ok(result.includes('- ファンタジー'));
      assert.ok(result.includes('- 冒険'));
    });

    test('tagsがない場合も正しく変換する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = DialogoiYamlUtils.stringifyDialogoiYaml(data);

      assert.ok(result.includes('title: テスト小説'));
      assert.ok(result.includes('author: テスト著者'));
      assert.ok(
        result.includes("created_at: '2024-01-01T00:00:00Z'") ||
          result.includes('created_at: 2024-01-01T00:00:00Z'),
      );
      assert.ok(!result.includes('tags:'));
    });
  });

  suite('validateDialogoiYaml', () => {
    test('正常なデータのバリデーションが成功する', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー'],
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('必須フィールドが欠けている場合エラーを返す', () => {
      const data = {
        title: '',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
      } as DialogoiYaml;

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('title')));
    });

    test('不正な日付形式の場合エラーを返す', () => {
      const data: DialogoiYaml = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01',
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('created_at')));
    });

    test('tagsが配列でない場合エラーを返す', () => {
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: 'ファンタジー' as unknown as string[],
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some((error) => error.includes('tags')));
    });

    test('複数のエラーがある場合すべてのエラーを返す', () => {
      const data = {
        title: '',
        author: '',
        created_at: 'invalid-date',
        tags: 'not-array' as unknown as string[],
      };

      const result = DialogoiYamlUtils.validateDialogoiYaml(data);

      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.length >= 4);
    });
  });

  suite('createDialogoiYaml', () => {
    test('基本的なDialogoiYamlオブジェクトを作成する', () => {
      const result = DialogoiYamlUtils.createDialogoiYaml('新しい小説', '新しい著者');

      assert.strictEqual(result.title, '新しい小説');
      assert.strictEqual(result.author, '新しい著者');
      assert.ok(result.created_at);
      assert.ok(!isNaN(new Date(result.created_at).getTime()));
      assert.deepStrictEqual(result.tags, []);
    });

    test('タグ付きのDialogoiYamlオブジェクトを作成する', () => {
      const tags = ['ファンタジー', '冒険'];
      const result = DialogoiYamlUtils.createDialogoiYaml('新しい小説', '新しい著者', tags);

      assert.strictEqual(result.title, '新しい小説');
      assert.strictEqual(result.author, '新しい著者');
      assert.ok(result.created_at);
      assert.deepStrictEqual(result.tags, tags);
    });

    test('created_atが現在時刻に近い値になる', () => {
      const before = new Date().toISOString();
      const result = DialogoiYamlUtils.createDialogoiYaml('テスト', 'テスト');
      const after = new Date().toISOString();

      assert.ok(result.created_at >= before);
      assert.ok(result.created_at <= after);
    });
  });
});
