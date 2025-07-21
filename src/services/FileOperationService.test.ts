import * as assert from 'assert';
import * as path from 'path';
import { FileOperationService } from './FileOperationService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';

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
      assert.strictEqual(meta !== null, true);
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.strictEqual(fileItem !== undefined, true);
      assert.strictEqual(fileItem!.type, 'content');
    });

    test('タグ付きファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'tagged.md', 'setting', '', ['タグ1', 'タグ2']);

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'tagged.md');
      assert.deepStrictEqual(fileItem!.tags, ['タグ1', 'タグ2']);
    });

    test('キャラクターサブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'character.md', 'setting', '', [], 'character');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'character.md');
      assert.strictEqual(fileItem!.character !== undefined, true);
      assert.strictEqual(fileItem!.character!.importance, 'main');
      assert.strictEqual(fileItem!.character!.multiple_characters, false);
    });

    test('伏線サブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'foreshadowing.md', 'setting', '', [], 'foreshadowing');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'foreshadowing.md');
      assert.strictEqual(fileItem!.foreshadowing !== undefined, true);
      assert.strictEqual(fileItem!.foreshadowing!.start, '');
      assert.strictEqual(fileItem!.foreshadowing!.goal, '');
    });

    test('用語集サブタイプでファイルを作成する', () => {
      // 実行
      const result = service.createFile(testDir, 'glossary.md', 'setting', '', [], 'glossary');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'glossary.md');
      assert.strictEqual(fileItem!.glossary, true);
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
      const fileItem = meta!.files.find(f => f.name === 'to_delete.txt');
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
      const oldItem = meta!.files.find(f => f.name === 'old_name.txt');
      const newItem = meta!.files.find(f => f.name === 'new_name.txt');
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
      const fileNamesBefore = metaBefore!.files.map(f => f.name);
      console.log('FileNames before reorder:', fileNamesBefore);

      // 実行：インデックス0のファイルをインデックス2に移動
      const result = service.reorderFiles(testDir, 0, 2);

      // 検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'ファイルの順序を変更しました。');

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileNames = meta!.files.map(f => f.name);
      console.log('FileNames after reorder:', fileNames);
      
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
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.deepStrictEqual(fileItem!.tags, ['テストタグ']);
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
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.deepStrictEqual(fileItem!.tags, ['保持タグ']);
    });

    test('ファイルのタグを一括設定する', () => {
      // 準備
      service.createFile(testDir, 'test.txt', 'content');

      // 実行
      const result = service.setTags(testDir, 'test.txt', ['タグ1', 'タグ2', 'タグ1']); // 重複あり

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.deepStrictEqual(fileItem!.tags, ['タグ1', 'タグ2']); // 重複が除去され、ソートされている
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
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.deepStrictEqual(fileItem!.references, ['settings/character.md']);
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
      const fileItem = meta!.files.find(f => f.name === 'test.txt');
      assert.deepStrictEqual(fileItem!.references, ['ref2.md']);
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
      const fileItem = meta!.files.find(f => f.name === 'character.md');
      assert.strictEqual(fileItem!.character!.importance, 'sub');
    });

    test('複数キャラクターフラグを設定する', () => {
      // 準備
      service.createFile(testDir, 'character.md', 'setting');

      // 実行
      const result = service.setMultipleCharacters(testDir, 'character.md', true);

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'character.md');
      assert.strictEqual(fileItem!.character!.multiple_characters, true);
    });

    test('キャラクター設定を削除する', () => {
      // 準備
      service.createFile(testDir, 'character.md', 'setting', '', [], 'character');

      // 実行
      const result = service.removeCharacter(testDir, 'character.md');

      // 検証
      assert.strictEqual(result.success, true);

      const meta = metaYamlService.loadMetaYaml(testDir);
      const fileItem = meta!.files.find(f => f.name === 'character.md');
      assert.strictEqual(fileItem!.character, undefined);
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
});