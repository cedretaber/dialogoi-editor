import * as assert from 'assert';
import * as path from 'path';
import { FileOperationService } from './FileOperationService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';

// 型アサーション関数
function assertNotNull<T>(value: T | null): asserts value is T {
  assert.notStrictEqual(value, null);
}

function assertNotUndefined<T>(value: T | undefined): asserts value is T {
  assert.notStrictEqual(value, undefined);
}

suite('FileOperationService テストスイート', () => {
  let service: FileOperationService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  const testDir = '/test/project';
  const metaYamlPath = path.join(testDir, '.dialogoi-meta.yaml');

  setup(() => {
    mockFileRepository = new MockFileRepository();
    metaYamlService = new MetaYamlService(mockFileRepository);
    service = new FileOperationService(mockFileRepository, metaYamlService);

    // テスト用のディレクトリとmeta.yamlを作成
    const testDirUri = mockFileRepository.createFileUri(testDir);
    mockFileRepository.mkdirSync(testDirUri);
    const meta = MetaYamlUtils.createMetaYaml('README.md');
    const metaContent = MetaYamlUtils.stringifyMetaYaml(meta);
    const metaUri = mockFileRepository.createFileUri(metaYamlPath);
    mockFileRepository.writeFileSync(metaUri, metaContent);
  });

  teardown(() => {
    mockFileRepository.reset();
  });

  suite('createFile', () => {
    test('通常ファイルを正常に作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'test.txt', 'content', 'テスト内容');

      // 検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'test.txt を作成しました。');

      // ファイルが作成されている
      const fileUri = mockFileRepository.createFileUri(path.join(testDir, 'test.txt'));
      assert.strictEqual(mockFileRepository.existsSync(fileUri), true);
      assert.strictEqual(mockFileRepository.readFileSync(fileUri, 'utf8'), 'テスト内容');

      // meta.yamlが更新されている
      const meta = metaYamlService.loadMetaYaml(testDir);

      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');

      assertNotUndefined(fileItem);
      assert.strictEqual(fileItem.type, 'content');
    });

    test('タグ付きファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'tagged.md', 'setting', '', ['タグ1', 'タグ2']);

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'tagged.md');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ2']);
    });

    test('キャラクターサブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'character.md', 'setting', '', [], 'character');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'character.md');
      assertNotUndefined(fileItem);
      assert.strictEqual(fileItem.character !== undefined, true);
      assertNotUndefined(fileItem.character);
      assert.strictEqual(fileItem.character.importance, 'main');
      assert.strictEqual(fileItem.character.multiple_characters, false);
    });

    test('伏線サブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(
        testDir,
        'foreshadowing.md',
        'setting',
        '',
        [],
        'foreshadowing',
      );

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'foreshadowing.md');
      assertNotUndefined(fileItem);
      assert.strictEqual(fileItem.foreshadowing !== undefined, true);
      assertNotUndefined(fileItem.foreshadowing);
      assert.deepStrictEqual(fileItem.foreshadowing.plants, []);
      assert.strictEqual(fileItem.foreshadowing.payoff.location, '');
      assert.strictEqual(fileItem.foreshadowing.payoff.comment, '');
    });

    test('用語集サブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'glossary.md', 'setting', '', [], 'glossary');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'glossary.md');
      assertNotUndefined(fileItem);
      assert.strictEqual(fileItem.glossary, true);
    });

    test('サブディレクトリを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'subdir', 'subdirectory');

      // 検証
      assert.strictEqual(result.success, true);

      // ディレクトリが作成されている
      const subdirUri = mockFileRepository.createFileUri(path.join(testDir, 'subdir'));
      assert.strictEqual(mockFileRepository.existsSync(subdirUri), true);

      // サブディレクトリ内にmeta.yamlとREADME.mdが作成されている
      const subMetaUri = mockFileRepository.joinPath(subdirUri, '.dialogoi-meta.yaml');
      const subReadmeUri = mockFileRepository.joinPath(subdirUri, 'README.md');
      assert.strictEqual(mockFileRepository.existsSync(subMetaUri), true);
      assert.strictEqual(mockFileRepository.existsSync(subReadmeUri), true);
    });

    test('既存ファイルと同名のファイル作成は失敗する', () => {
      // 準備：ファイルを作成
      service.createFile(testDir, 'existing.txt', 'content');

      // 実行：同名ファイルを作成
      const result = service.createFile(testDir, 'existing.txt', 'content');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('既に存在します'), true);
    });

    test('ファイル種別に応じたデフォルトコンテンツが設定される', () => {
      // 本文ファイル（.txt）
      service.createFile(testDir, 'content.txt', 'content');
      const contentUri = mockFileRepository.createFileUri(path.join(testDir, 'content.txt'));
      const contentText = mockFileRepository.readFileSync(contentUri, 'utf8');
      assert.strictEqual(contentText, 'content\n\n');

      // 設定ファイル（.md）
      service.createFile(testDir, 'setting.md', 'setting');
      const settingUri = mockFileRepository.createFileUri(path.join(testDir, 'setting.md'));
      const settingText = mockFileRepository.readFileSync(settingUri, 'utf8');
      assert.strictEqual(settingText, '# setting\n\n');
    });
  });

  suite('deleteFile', () => {
    test('ファイルを正常に削除する', () => {
      // 準備：ファイルを作成
      service.createFile(testDir, 'to_delete.txt', 'content');

      // 実行
      const result = service.deleteFile(testDir, 'to_delete.txt');

      // 検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'to_delete.txt を削除しました。');

      // ファイルが削除されている
      const fileUri = mockFileRepository.createFileUri(path.join(testDir, 'to_delete.txt'));
      assert.strictEqual(mockFileRepository.existsSync(fileUri), false);

      // meta.yamlからも削除されている
      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'to_delete.txt');
      assert.strictEqual(fileItem, undefined);
    });

    test('存在しないファイルの削除は失敗する', () => {
      // 実行
      const result = service.deleteFile(testDir, 'nonexistent.txt');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('見つかりません'), true);
    });
  });

  suite('renameFile', () => {
    test('ファイルを正常にリネームする', () => {
      // 準備：ファイルを作成
      service.createFile(testDir, 'old_name.txt', 'content', 'テスト内容');

      // 実行
      const result = service.renameFile(testDir, 'old_name.txt', 'new_name.txt');

      // 検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message.includes('new_name.txt にリネーム'), true);

      // 古いファイルが存在しない
      const oldUri = mockFileRepository.createFileUri(path.join(testDir, 'old_name.txt'));
      assert.strictEqual(mockFileRepository.existsSync(oldUri), false);

      // 新しいファイルが存在する
      const newUri = mockFileRepository.createFileUri(path.join(testDir, 'new_name.txt'));
      assert.strictEqual(mockFileRepository.existsSync(newUri), true);
      assert.strictEqual(mockFileRepository.readFileSync(newUri, 'utf8'), 'テスト内容');

      // meta.yamlが更新されている
      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const oldItem = meta.files.find((f) => f.name === 'old_name.txt');
      const newItem = meta.files.find((f) => f.name === 'new_name.txt');
      assert.strictEqual(oldItem, undefined);
      assert.strictEqual(newItem !== undefined, true);
    });

    test('存在しないファイルのリネームは失敗する', () => {
      // 実行
      const result = service.renameFile(testDir, 'nonexistent.txt', 'new_name.txt');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('見つかりません'), true);
    });

    test('既存ファイルと同名へのリネームは失敗する', () => {
      // 準備：2つのファイルを作成
      service.createFile(testDir, 'file1.txt', 'content');
      service.createFile(testDir, 'file2.txt', 'content');

      // 実行：file1をfile2にリネーム
      const result = service.renameFile(testDir, 'file1.txt', 'file2.txt');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('既に存在します'), true);
    });
  });

  suite('reorderFiles', () => {
    test('ファイル順序を正常に変更する', () => {
      // 準備：複数のファイルを作成
      service.createFile(testDir, 'file1.txt', 'content');
      service.createFile(testDir, 'file2.txt', 'content');
      service.createFile(testDir, 'file3.txt', 'content');

      // 初期状態を確認
      const metaBefore = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(metaBefore);
      const fileNamesBefore = metaBefore.files.map((f) => f.name);
      // console.log('FileNames before reorder:', fileNamesBefore);

      // 実行：インデックス0のファイルをインデックス2に移動
      const result = service.reorderFiles(testDir, 0, 2);

      // 検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'ファイルの順序を変更しました。');

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileNames = meta.files.map((f) => f.name);
      // console.log('FileNames after reorder:', fileNames);

      // 並び替えが正しく実行されたことを確認
      assert.strictEqual(fileNames.length, fileNamesBefore.length);
      // 最初のファイルがインデックス2に移動したことを確認
      assert.strictEqual(fileNames[2], fileNamesBefore[0]);
    });

    test('無効なインデックスでの並び替えは失敗する', () => {
      // 実行：範囲外のインデックス
      const result = service.reorderFiles(testDir, 0, 10);

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('無効なインデックス'), true);
    });
  });

  suite('タグ操作', () => {
    test('ファイルにタグを追加する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content');

      // 実行
      const result = service.addTag(testDir, 'test.txt', 'テストタグ');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.tags, ['テストタグ']);
    });

    test('重複タグの追加は失敗する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content', '', ['既存タグ']);

      // 実行
      const result = service.addTag(testDir, 'test.txt', '既存タグ');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('既に存在します'), true);
    });

    test('ファイルからタグを削除する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content', '', ['削除タグ', '保持タグ']);

      // 実行
      const result = service.removeTag(testDir, 'test.txt', '削除タグ');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.tags, ['保持タグ']);
    });

    test('ファイルのタグを一括設定する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content');

      // 実行
      const result = service.setTags(testDir, 'test.txt', ['タグ1', 'タグ2', 'タグ1']); // 重複あり

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ2']); // 重複が除去され、ソートされている
    });
  });

  suite('参照操作', () => {
    test('ファイルに参照を追加する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content');

      // 実行
      const result = service.addReference(testDir, 'test.txt', 'settings/character.md');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.references, ['settings/character.md']);
    });

    test('ファイルから参照を削除する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content');
      service.addReference(testDir, 'test.txt', 'ref1.md');
      service.addReference(testDir, 'test.txt', 'ref2.md');

      // 実行
      const result = service.removeReference(testDir, 'test.txt', 'ref1.md');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'test.txt');
      assertNotUndefined(fileItem);
      assert.deepStrictEqual(fileItem.references, ['ref2.md']);
    });
  });

  suite('キャラクター操作', () => {
    test('キャラクター重要度を設定する', () => {
      // 準備
      service.createFile(testDir, 'character.md', 'setting');

      // 実行
      const result = service.setCharacterImportance(testDir, 'character.md', 'sub');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'character.md');
      assertNotUndefined(fileItem);
      assertNotUndefined(fileItem.character);
      assert.strictEqual(fileItem.character.importance, 'sub');
    });

    test('複数キャラクターフラグを設定する', () => {
      // 準備
      service.createFile(testDir, 'character.md', 'setting');

      // 実行
      const result = service.setMultipleCharacters(testDir, 'character.md', true);

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'character.md');
      assertNotUndefined(fileItem);
      assertNotUndefined(fileItem.character);
      assert.strictEqual(fileItem.character.multiple_characters, true);
    });

    test('キャラクター設定を削除する', () => {
      // 準備
      service.createFile(testDir, 'character.md', 'setting', '', [], 'character');

      // 実行
      const result = service.removeCharacter(testDir, 'character.md');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      assertNotNull(meta);
      const fileItem = meta.files.find((f) => f.name === 'character.md');
      assertNotUndefined(fileItem);
      assert.strictEqual(fileItem.character, undefined);
    });
  });

  suite('エラーケース', () => {
    test('meta.yamlが存在しないディレクトリでの操作は失敗する', () => {
      const invalidDir = '/test/invalid';
      const invalidDirUri = mockFileRepository.createFileUri(invalidDir);
      mockFileRepository.mkdirSync(invalidDirUri);

      // 実行
      const result = service.createFile(invalidDir, 'test.txt', 'content');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('.dialogoi-meta.yamlが見つからない'), true);
    });

    test('存在しないファイルへのタグ操作は失敗する', () => {
      // 実行
      const result = service.addTag(testDir, 'nonexistent.txt', 'タグ');

      // 検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('見つかりません'), true);
    });
  });

  // === 非同期版メソッドのテスト ===
  suite('非同期版メソッドテスト', () => {
    suite('createFileAsync', () => {
      test('通常ファイルを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'test.txt', 'content', 'テスト内容');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'test.txt を作成しました。');

        // ファイルが作成されていることを確認
        const filePath = path.join(testDir, 'test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, true);

        const content = await mockFileRepository.readFileAsync(fileUri, 'utf8');
        assert.strictEqual(content, 'テスト内容');

        // meta.yamlにファイル情報が追加されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'test.txt');
        assertNotUndefined(fileItem);
        assert.strictEqual(fileItem.type, 'content');
        assert.strictEqual(fileItem.path, filePath);
      });

      test('サブディレクトリを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'subdir', 'subdirectory');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'subdir を作成しました。');

        // ディレクトリが作成されていることを確認
        const dirPath = path.join(testDir, 'subdir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, true);

        // サブディレクトリ内にmeta.yamlとREADME.mdが作成されていることを確認
        const metaPath = path.join(dirPath, '.dialogoi-meta.yaml');
        const metaUri = mockFileRepository.createFileUri(metaPath);
        const metaExists = await mockFileRepository.existsAsync(metaUri);
        assert.strictEqual(metaExists, true);

        const readmePath = path.join(dirPath, 'README.md');
        const readmeUri = mockFileRepository.createFileUri(readmePath);
        const readmeExists = await mockFileRepository.existsAsync(readmeUri);
        assert.strictEqual(readmeExists, true);
      });

      test('既に存在するファイルを作成しようとするとエラーになる', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 実行 - 同名ファイルを再度作成
        const result = await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル existing.txt は既に存在します。');
      });

      test('タグ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'tagged.txt',
          'content',
          'タグ付きコンテンツ',
          ['タグ1', 'タグ2'],
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'tagged.txt');
        assertNotUndefined(fileItem);
        assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ2']);
      });

      test('キャラクターサブタイプ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'character.md',
          'setting',
          '',
          [],
          'character',
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'character.md');
        assertNotUndefined(fileItem);
        assertNotUndefined(fileItem.character);
        assert.strictEqual(fileItem.character.importance, 'main');
        assert.strictEqual(fileItem.character.multiple_characters, false);
      });
    });

    suite('deleteFileAsync', () => {
      test('通常ファイルを正常に削除する', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'delete-test.txt', 'content', 'テスト内容');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-test.txt');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-test.txt を削除しました。');

        // ファイルが削除されていることを確認
        const filePath = path.join(testDir, 'delete-test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, false);

        // meta.yamlからファイル情報が削除されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'delete-test.txt');
        assert.strictEqual(fileItem, undefined);
      });

      test('サブディレクトリを正常に削除する', async () => {
        // 準備 - サブディレクトリを作成
        await service.createFileAsync(testDir, 'delete-dir', 'subdirectory');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-dir');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-dir を削除しました。');

        // ディレクトリが削除されていることを確認
        const dirPath = path.join(testDir, 'delete-dir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, false);
      });

      test('存在しないファイルを削除しようとするとエラーになる', async () => {
        // 実行
        const result = await service.deleteFileAsync(testDir, 'nonexistent.txt');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル nonexistent.txt が見つかりません。');
      });
    });

    suite('readFileAsync と writeFileAsync', () => {
      test('ファイルを書き込んで読み込む', async () => {
        const filePath = path.join(testDir, 'read-write-test.txt');
        const testContent = 'テスト内容です\n複数行のテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // 読み込み
        const readContent = await service.readFileAsync(filePath);

        // 検証
        assert.strictEqual(readContent, testContent);
      });

      test('存在するファイルの内容を上書きする', async () => {
        const filePath = path.join(testDir, 'overwrite-test.txt');
        const initialContent = '初期内容';
        const updatedContent = '更新された内容';

        // 初期書き込み
        await service.writeFileAsync(filePath, initialContent);

        // 読み込み確認
        let content = await service.readFileAsync(filePath);
        assert.strictEqual(content, initialContent);

        // 上書き
        await service.writeFileAsync(filePath, updatedContent);

        // 読み込み確認
        content = await service.readFileAsync(filePath);
        assert.strictEqual(content, updatedContent);
      });

      test('エンコーディングを指定してファイルを読み込む', async () => {
        const filePath = path.join(testDir, 'encoding-test.txt');
        const testContent = 'UTF-8でエンコードされたテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // UTF-8で読み込み
        const readContent = await service.readFileAsync(filePath, 'utf8');

        // 検証
        assert.strictEqual(readContent, testContent);
      });
    });

    suite('existsAsync', () => {
      test('存在するファイルでtrueを返す', async () => {
        // 準備 - ファイルを作成
        const filePath = path.join(testDir, 'exists-test.txt');
        await service.writeFileAsync(filePath, 'テスト内容');

        // 実行・検証
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, true);
      });

      test('存在しないファイルでfalseを返す', async () => {
        // 実行・検証
        const filePath = path.join(testDir, 'nonexistent.txt');
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, false);
      });

      test('存在するディレクトリでtrueを返す', async () => {
        // 実行・検証
        const exists = await service.existsAsync(testDir);
        assert.strictEqual(exists, true);
      });
    });

    suite('同期・非同期の相互運用テスト', () => {
      test('同期版と非同期版で同じ結果を返す', async () => {
        const fileName = 'sync-async-test.txt';
        const content = '同期・非同期テスト内容';

        // 同期版でファイル作成
        const syncResult = service.createFile(testDir, fileName, 'content', content, [
          'テストタグ',
        ]);
        assert.strictEqual(syncResult.success, true);

        // 非同期版でファイル読み込み
        const filePath = path.join(testDir, fileName);
        const asyncReadContent = await service.readFileAsync(filePath);
        assert.strictEqual(asyncReadContent, content);

        // 非同期版でファイル存在確認
        const asyncExists = await service.existsAsync(filePath);
        assert.strictEqual(asyncExists, true);

        // 同期版と非同期版でメタデータ読み込みして比較
        const syncMeta = metaYamlService.loadMetaYaml(testDir);
        const asyncMeta = await metaYamlService.loadMetaYamlAsync(testDir);
        assert.deepStrictEqual(syncMeta, asyncMeta);

        // 非同期版でファイル削除
        const asyncDeleteResult = await service.deleteFileAsync(testDir, fileName);
        assert.strictEqual(asyncDeleteResult.success, true);

        // 同期版で存在確認
        const syncExistsAfterDelete = await service.existsAsync(filePath);
        assert.strictEqual(syncExistsAfterDelete, false);
      });
    });
  });
});
