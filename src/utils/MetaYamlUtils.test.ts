import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MetaYamlUtils, DialogoiTreeItem } from './MetaYamlUtils.js';

suite('MetaYamlUtils テストスイート', () => {
  let testDir: string;

  setup(() => {
    // テスト用の一時ディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-test-'));
  });

  teardown(() => {
    // テスト用ディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('parseMetaYaml', () => {
    test('正常なYAMLを正しく解析する', () => {
      const yamlContent = `
readme: README.md
files:
  - name: test.txt
    type: content
    tags: ["テスト"]
`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);

      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 1);
      assert.strictEqual(result?.files[0]?.name, 'test.txt');
      assert.strictEqual(result?.files[0]?.type, 'content');
      assert.deepStrictEqual(result?.files[0]?.tags, ['テスト']);
    });

    test('不正なYAMLはnullを返す', () => {
      const invalidYaml = `
readme: README.md
files:
  - name: test.txt
    type: content
    tags: ["テスト"
`;

      const result = MetaYamlUtils.parseMetaYaml(invalidYaml);
      assert.strictEqual(result, null);
    });

    test('filesフィールドがない場合はnullを返す', () => {
      const yamlContent = `
readme: README.md
`;

      const result = MetaYamlUtils.parseMetaYaml(yamlContent);
      assert.strictEqual(result, null);
    });
  });

  suite('loadMetaYaml', () => {
    test('存在するmeta.yamlファイルを読み込む', () => {
      const metaYamlPath = path.join(testDir, 'meta.yaml');
      const yamlContent = `
readme: README.md
files:
  - name: test.txt
    type: content
`;

      fs.writeFileSync(metaYamlPath, yamlContent);

      const result = MetaYamlUtils.loadMetaYaml(testDir);

      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 1);
      assert.strictEqual(result?.files[0]?.name, 'test.txt');
    });

    test('存在しないディレクトリの場合はnullを返す', () => {
      const nonExistentDir = path.join(testDir, 'nonexistent');

      const result = MetaYamlUtils.loadMetaYaml(nonExistentDir);
      assert.strictEqual(result, null);
    });

    test('meta.yamlファイルが存在しない場合はnullを返す', () => {
      const result = MetaYamlUtils.loadMetaYaml(testDir);
      assert.strictEqual(result, null);
    });
  });

  suite('getReadmeFilePath', () => {
    test('指定されたreadmeファイルのパスを返す', () => {
      const metaYamlPath = path.join(testDir, 'meta.yaml');
      const readmePath = path.join(testDir, 'README.md');

      const yamlContent = `
readme: README.md
files:
  - name: test.txt
    type: content
`;

      fs.writeFileSync(metaYamlPath, yamlContent);
      fs.writeFileSync(readmePath, '# テストREADME');

      const result = MetaYamlUtils.getReadmeFilePath(testDir);
      assert.strictEqual(result, readmePath);
    });

    test('readmeファイルが存在しない場合はnullを返す', () => {
      const metaYamlPath = path.join(testDir, 'meta.yaml');

      const yamlContent = `
readme: README.md
files:
  - name: test.txt
    type: content
`;

      fs.writeFileSync(metaYamlPath, yamlContent);

      const result = MetaYamlUtils.getReadmeFilePath(testDir);
      assert.strictEqual(result, null);
    });
  });

  suite('findNovelRoot', () => {
    test('dialogoi.yamlファイルがあるディレクトリを見つける', () => {
      const novelDir = path.join(testDir, 'novel');
      fs.mkdirSync(novelDir);

      const dialogoiYamlPath = path.join(novelDir, 'dialogoi.yaml');
      fs.writeFileSync(dialogoiYamlPath, 'title: テスト小説');

      const result = MetaYamlUtils.findNovelRoot(testDir);
      assert.strictEqual(result, novelDir);
    });

    test('dialogoi.yamlファイルがない場合はnullを返す', () => {
      const result = MetaYamlUtils.findNovelRoot(testDir);
      assert.strictEqual(result, null);
    });

    test('サブディレクトリ内のdialogoiファイルも見つける', () => {
      const subDir = path.join(testDir, 'projects', 'novel');
      fs.mkdirSync(subDir, { recursive: true });

      const dialogoiYamlPath = path.join(subDir, 'dialogoi.yaml');
      fs.writeFileSync(dialogoiYamlPath, 'title: テスト小説');

      const result = MetaYamlUtils.findNovelRoot(testDir);
      assert.strictEqual(result, subDir);
    });
  });

  suite('validateDialogoiTreeItem', () => {
    test('正常なTreeItemは検証エラーなし', () => {
      const item: DialogoiTreeItem = {
        name: 'test.txt',
        type: 'content',
        path: '/test/path',
        tags: ['テスト'],
        referenced: ['settings/character.md'],
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.strictEqual(errors.length, 0);
    });

    test('nameフィールドが空の場合はエラー', () => {
      const item: DialogoiTreeItem = {
        name: '',
        type: 'content',
        path: '/test/path',
      };

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.ok(errors.some((error) => error.includes('name フィールドは必須です')));
    });

    test('不正なtypeフィールドの場合はエラー', () => {
      const item = {
        name: 'test.txt',
        type: 'invalid',
        path: '/test/path',
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.ok(errors.some((error) => error.includes('type フィールドは')));
    });

    test('characterフィールドの型が不正な場合はエラー', () => {
      const item = {
        name: 'character.md',
        type: 'setting',
        path: '/test/path',
        character: {
          main: 'yes',
          multi: false,
        },
      } as unknown as DialogoiTreeItem;

      const errors = MetaYamlUtils.validateDialogoiTreeItem(item);
      assert.ok(errors.some((error) => error.includes('character.main')));
    });
  });

  suite('validateMetaYaml', () => {
    test('正常なMetaYamlは検証エラーなし', () => {
      const meta = {
        readme: 'README.md',
        files: [
          {
            name: 'test.txt',
            type: 'content' as const,
            path: '/test/path',
          },
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.strictEqual(errors.length, 0);
    });

    test('filesが配列でない場合はエラー', () => {
      const meta = {
        readme: 'README.md',
        files: 'not-an-array',
      } as unknown as Parameters<typeof MetaYamlUtils.validateMetaYaml>[0];

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.ok(
        errors.some((error) => error.includes('files フィールドは配列である必要があります')),
      );
    });

    test('files内の要素に問題がある場合はエラー', () => {
      const meta = {
        readme: 'README.md',
        files: [
          {
            name: '',
            type: 'content' as const,
            path: '/test/path',
          },
        ],
      };

      const errors = MetaYamlUtils.validateMetaYaml(meta);
      assert.ok(errors.some((error) => error.includes('files[0]')));
    });
  });
});
