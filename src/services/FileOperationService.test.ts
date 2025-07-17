import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FileOperationService } from './FileOperationService.js';

suite('FileOperationService テストスイート', () => {
  let testDir: string;

  setup(() => {
    // テスト用の一時ディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-fileop-test-'));

    // 基本的なmeta.yamlを作成
    const metaYaml = `
readme: README.md
files:
  - name: existing.txt
    type: content
    tags: ["既存"]
`;
    fs.writeFileSync(path.join(testDir, 'meta.yaml'), metaYaml);
    fs.writeFileSync(path.join(testDir, 'existing.txt'), '既存のファイル');
  });

  teardown(() => {
    // テスト用ディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('createFile', () => {
    test('新しいファイルを作成する', () => {
      const result = FileOperationService.createFile(
        testDir,
        'new.txt',
        'content',
        '新しいファイル',
        ['テスト'],
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('new.txt を作成しました'));

      // ファイルが作成されることを確認
      const filePath = path.join(testDir, 'new.txt');
      assert.ok(fs.existsSync(filePath));
      assert.strictEqual(fs.readFileSync(filePath, 'utf8'), '新しいファイル');

      // meta.yamlが更新されることを確認
      assert.ok(result.updatedItems);
      assert.strictEqual(result.updatedItems.length, 2);
      assert.ok(result.updatedItems.some((item) => item.name === 'new.txt'));
    });

    test('サブディレクトリを作成する', () => {
      const result = FileOperationService.createFile(testDir, 'newdir', 'subdirectory');

      assert.strictEqual(result.success, true);

      // ディレクトリが作成されることを確認
      const dirPath = path.join(testDir, 'newdir');
      assert.ok(fs.existsSync(dirPath));
      assert.ok(fs.lstatSync(dirPath).isDirectory());

      // デフォルトファイルが作成されることを確認
      assert.ok(fs.existsSync(path.join(dirPath, 'meta.yaml')));
      assert.ok(fs.existsSync(path.join(dirPath, 'README.md')));
    });

    test('既存ファイルの場合はエラーを返す', () => {
      const result = FileOperationService.createFile(testDir, 'existing.txt', 'content');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に存在します'));
    });
  });

  suite('deleteFile', () => {
    test('ファイルを削除する', () => {
      const result = FileOperationService.deleteFile(testDir, 'existing.txt');

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('existing.txt を削除しました'));

      // ファイルが削除されることを確認
      const filePath = path.join(testDir, 'existing.txt');
      assert.ok(!fs.existsSync(filePath));

      // meta.yamlが更新されることを確認
      assert.ok(result.updatedItems);
      assert.strictEqual(result.updatedItems.length, 0);
    });

    test('存在しないファイルの場合はエラーを返す', () => {
      const result = FileOperationService.deleteFile(testDir, 'nonexistent.txt');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('見つかりません'));
    });
  });

  suite('renameFile', () => {
    test('ファイル名を変更する', () => {
      const result = FileOperationService.renameFile(testDir, 'existing.txt', 'renamed.txt');

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('renamed.txt にリネームしました'));

      // ファイルがリネームされることを確認
      const oldPath = path.join(testDir, 'existing.txt');
      const newPath = path.join(testDir, 'renamed.txt');
      assert.ok(!fs.existsSync(oldPath));
      assert.ok(fs.existsSync(newPath));

      // meta.yamlが更新されることを確認
      assert.ok(result.updatedItems);
      assert.ok(result.updatedItems.some((item) => item.name === 'renamed.txt'));
    });

    test('存在しないファイルの場合はエラーを返す', () => {
      const result = FileOperationService.renameFile(testDir, 'nonexistent.txt', 'new.txt');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('見つかりません'));
    });

    test('既存ファイル名の場合はエラーを返す', () => {
      // 別のファイルを作成
      fs.writeFileSync(path.join(testDir, 'another.txt'), 'another');

      const result = FileOperationService.renameFile(testDir, 'existing.txt', 'another.txt');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に存在します'));
    });
  });

  suite('reorderFiles', () => {
    setup(() => {
      // 複数のファイルを含むmeta.yamlを作成
      const metaYaml = `
readme: README.md
files:
  - name: file1.txt
    type: content
  - name: file2.txt
    type: content
  - name: file3.txt
    type: content
`;
      fs.writeFileSync(path.join(testDir, 'meta.yaml'), metaYaml);
    });

    test('ファイルの順序を変更する', () => {
      const result = FileOperationService.reorderFiles(testDir, 0, 2);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('順序を変更しました'));

      // 順序が変更されることを確認
      assert.ok(result.updatedItems);
      assert.strictEqual(result.updatedItems[0]?.name, 'file2.txt');
      assert.strictEqual(result.updatedItems[1]?.name, 'file3.txt');
      assert.strictEqual(result.updatedItems[2]?.name, 'file1.txt');
    });

    test('無効なインデックスの場合はエラーを返す', () => {
      const result = FileOperationService.reorderFiles(testDir, 0, 10);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('無効なインデックス'));
    });
  });

  suite('タグ操作', () => {
    test('タグを追加する', () => {
      const result = FileOperationService.addTag(testDir, 'existing.txt', 'new-tag');

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('タグ "new-tag" を追加しました'));

      // タグが追加されることを確認
      assert.ok(result.updatedItems);
      const targetFile = result.updatedItems.find((item) => item.name === 'existing.txt');
      assert.ok(targetFile);
      assert.ok(targetFile.tags !== undefined && targetFile.tags.includes('new-tag'));
      assert.ok(targetFile.tags !== undefined && targetFile.tags.includes('既存'));
    });

    test('既存のタグを追加しようとするとエラーを返す', () => {
      const result = FileOperationService.addTag(testDir, 'existing.txt', '既存');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に存在します'));
    });

    test('タグを削除する', () => {
      const result = FileOperationService.removeTag(testDir, 'existing.txt', '既存');

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('タグ "既存" を削除しました'));

      // タグが削除されることを確認
      assert.ok(result.updatedItems);
      const targetFile = result.updatedItems.find((item) => item.name === 'existing.txt');
      assert.ok(targetFile);
      assert.ok(targetFile.tags === undefined || !targetFile.tags.includes('既存'));
    });

    test('存在しないタグを削除しようとするとエラーを返す', () => {
      const result = FileOperationService.removeTag(testDir, 'existing.txt', 'nonexistent');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('見つかりません'));
    });

    test('タグを一括設定する', () => {
      const newTags = ['tag1', 'tag2', 'tag3'];
      const result = FileOperationService.setTags(testDir, 'existing.txt', newTags);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('タグを設定しました'));

      // タグが設定されることを確認
      assert.ok(result.updatedItems);
      const targetFile = result.updatedItems.find((item) => item.name === 'existing.txt');
      assert.ok(targetFile);
      assert.deepStrictEqual(targetFile.tags, newTags);
    });

    test('空のタグ配列を設定するとタグが削除される', () => {
      const result = FileOperationService.setTags(testDir, 'existing.txt', []);

      assert.strictEqual(result.success, true);

      // タグが削除されることを確認
      assert.ok(result.updatedItems);
      const targetFile = result.updatedItems.find((item) => item.name === 'existing.txt');
      assert.ok(targetFile);
      assert.strictEqual(targetFile.tags, undefined);
    });

    test('重複したタグを設定すると重複が削除される', () => {
      const tagsWithDuplicates = ['tag1', 'tag2', 'tag1', 'tag3', 'tag2'];
      const result = FileOperationService.setTags(testDir, 'existing.txt', tagsWithDuplicates);

      assert.strictEqual(result.success, true);

      // 重複が削除されてソートされることを確認
      assert.ok(result.updatedItems);
      const targetFile = result.updatedItems.find((item) => item.name === 'existing.txt');
      assert.ok(targetFile);
      assert.deepStrictEqual(targetFile.tags, ['tag1', 'tag2', 'tag3']);
    });

    test('存在しないファイルにタグを追加しようとするとエラーを返す', () => {
      const result = FileOperationService.addTag(testDir, 'nonexistent.txt', 'tag');

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('見つかりません'));
    });
  });
});
