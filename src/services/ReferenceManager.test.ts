import * as assert from 'assert';
import * as path from 'path';
import { ReferenceManager } from './ReferenceManager.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { ServiceContainer } from '../di/ServiceContainer.js';

suite('ReferenceManager テストスイート', () => {
  let testDir: string;
  let refManager: ReferenceManager;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;

  setup(() => {
    // TestServiceContainerを初期化
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    testDir = '/tmp/dialogoi-ref-test';

    // ServiceContainerをテスト用に設定
    ServiceContainer.setTestInstance(testContainer);

    // テスト用のプロジェクト構造を作成
    createTestProject();

    // ReferenceManagerのインスタンスを取得
    refManager = ReferenceManager.getInstance();
    refManager.clear(); // 前のテストの影響を除去
  });

  teardown(() => {
    // モックファイルサービスをリセット
    mockFileRepository.reset();
    refManager.clear();
    testContainer.cleanup();
    ServiceContainer.clearTestInstance();
  });

  function createTestProject(): void {
    // ルートディレクトリを作成
    mockFileRepository.addDirectory(testDir);
    mockFileRepository.addFile(path.join(testDir, 'dialogoi.yaml'), 'version: 1.0');

    // ルートの.dialogoi-meta.yamlを作成
    const rootMeta = `readme: README.md
files:
  - name: contents
    type: subdirectory
  - name: settings
    type: subdirectory
`;
    mockFileRepository.addFile(path.join(testDir, '.dialogoi-meta.yaml'), rootMeta);

    // contentsディレクトリと.dialogoi-meta.yamlを作成
    const contentsDir = path.join(testDir, 'contents');
    mockFileRepository.addDirectory(contentsDir);

    const contentsMeta = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    references:
      - settings/world.md
      - settings/characters/hero.md
  - name: chapter2.txt
    type: content
    references:
      - settings/magic.md
`;
    mockFileRepository.addFile(path.join(contentsDir, '.dialogoi-meta.yaml'), contentsMeta);
    mockFileRepository.addFile(path.join(contentsDir, 'chapter1.txt'), 'Chapter 1 content');
    mockFileRepository.addFile(path.join(contentsDir, 'chapter2.txt'), 'Chapter 2 content');

    // settingsディレクトリと.dialogoi-meta.yamlを作成
    const settingsDir = path.join(testDir, 'settings');
    mockFileRepository.addDirectory(settingsDir);

    const settingsMeta = `readme: README.md
files:
  - name: world.md
    type: setting
  - name: magic.md
    type: setting
  - name: characters
    type: subdirectory
`;
    mockFileRepository.addFile(path.join(settingsDir, '.dialogoi-meta.yaml'), settingsMeta);
    mockFileRepository.addFile(path.join(settingsDir, 'world.md'), 'World setting');
    mockFileRepository.addFile(path.join(settingsDir, 'magic.md'), 'Magic system');

    // settings/charactersディレクトリと.dialogoi-meta.yamlを作成
    const charactersDir = path.join(settingsDir, 'characters');
    mockFileRepository.addDirectory(charactersDir);

    const charactersMeta = `readme: README.md
files:
  - name: hero.md
    type: setting
    character:
      importance: main
      multiple_characters: false
`;
    mockFileRepository.addFile(path.join(charactersDir, '.dialogoi-meta.yaml'), charactersMeta);
    mockFileRepository.addFile(path.join(charactersDir, 'hero.md'), 'Hero character');
  }

  test('初期化が正しく動作する', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // chapter1.txtの参照関係をチェック
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    const chapter1RefPaths = chapter1Refs.references.map((ref) => ref.path);
    assert.deepStrictEqual(chapter1RefPaths, ['settings/world.md', 'settings/characters/hero.md']);

    // chapter2.txtの参照関係をチェック
    const chapter2Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter2.txt'));
    const chapter2RefPaths = chapter2Refs.references.map((ref) => ref.path);
    assert.deepStrictEqual(chapter2RefPaths, ['settings/magic.md']);

    // 逆参照もチェック
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    const worldRefByPaths = worldRefs.referencedBy.map((ref) => ref.path);
    assert.deepStrictEqual(worldRefByPaths, ['contents/chapter1.txt']);

    const heroRefs = refManager.getReferences(
      path.join(testDir, 'settings', 'characters', 'hero.md'),
    );
    const heroRefByPaths = heroRefs.referencedBy.map((ref) => ref.path);
    assert.deepStrictEqual(heroRefByPaths, ['contents/chapter1.txt']);

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    const magicRefByPaths = magicRefs.referencedBy.map((ref) => ref.path);
    assert.deepStrictEqual(magicRefByPaths, ['contents/chapter2.txt']);
  });

  test('単一ファイルの参照関係を更新できる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const newReferences = ['settings/world.md', 'settings/magic.md']; // hero.mdを削除、magic.mdを追加

    refManager.updateFileReferences(filePath, newReferences);

    // 更新後の参照関係をチェック
    const chapter1Refs = refManager.getReferences(filePath);
    const chapter1RefPaths = chapter1Refs.references.map((ref) => ref.path);
    assert.deepStrictEqual(chapter1RefPaths, newReferences);

    // 逆参照もチェック
    const heroRefs = refManager.getReferences(
      path.join(testDir, 'settings', 'characters', 'hero.md'),
    );
    assert.strictEqual(heroRefs.referencedBy.length, 0); // chapter1.txtからの参照が削除されている

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    const magicRefByPaths = magicRefs.referencedBy.map((ref) => ref.path).sort();
    assert.deepStrictEqual(
      magicRefByPaths,
      ['contents/chapter1.txt', 'contents/chapter2.txt'].sort(),
    );
  });

  test('存在しないファイルの参照関係を取得すると空の配列が返る', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const nonExistentPath = path.join(testDir, 'non-existent.txt');
    const refs = refManager.getReferences(nonExistentPath);

    assert.deepStrictEqual(refs.references, []);
    assert.deepStrictEqual(refs.referencedBy, []);
  });

  test('clearメソッドで参照関係がクリアされる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // 初期化後は参照関係がある
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    assert.notStrictEqual(chapter1Refs.references.length, 0);

    refManager.clear();

    // クリア後は参照関係が空になる
    const chapter1RefsAfter = refManager.getReferences(
      path.join(testDir, 'contents', 'chapter1.txt'),
    );
    assert.deepStrictEqual(chapter1RefsAfter.references, []);
    assert.deepStrictEqual(chapter1RefsAfter.referencedBy, []);
  });

  test('ファイルの存在チェック（非同期版）が正しく動作する', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // 存在するファイル
    assert.strictEqual(await refManager.checkFileExistsAsync('settings/world.md'), true);
    assert.strictEqual(await refManager.checkFileExistsAsync('contents/chapter1.txt'), true);

    // 存在しないファイル
    assert.strictEqual(await refManager.checkFileExistsAsync('non-existent.md'), false);
    assert.strictEqual(await refManager.checkFileExistsAsync('settings/non-existent.md'), false);
  });

  test('無効な参照先ファイルを取得（非同期版）できる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // chapter1.txtに存在しない参照を追加
    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const referencesWithInvalid = [
      'settings/world.md', // 存在する
      'settings/non-existent.md', // 存在しない
      'invalid/path.md', // 存在しない
    ];

    refManager.updateFileReferences(filePath, referencesWithInvalid);

    const invalidRefs = await refManager.getInvalidReferencesAsync(filePath);
    assert.deepStrictEqual(
      invalidRefs.sort(),
      ['settings/non-existent.md', 'invalid/path.md'].sort(),
    );
  });

  test('空の参照配列で更新すると参照関係が削除される', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');

    // 最初は参照がある
    const initialRefs = refManager.getReferences(filePath);
    assert.notStrictEqual(initialRefs.references.length, 0);

    // 空の配列で更新
    refManager.updateFileReferences(filePath, []);

    // 参照が削除される
    const updatedRefs = refManager.getReferences(filePath);
    assert.deepStrictEqual(updatedRefs.references, []);

    // 逆参照も削除される
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    assert.strictEqual(
      worldRefs.referencedBy.some((ref) => ref.path === 'contents/chapter1.txt'),
      false,
    );
  });

  test('同じファイルを複数回参照しても重複しない', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const duplicateReferences = [
      'settings/world.md',
      'settings/world.md', // 重複
      'settings/magic.md',
    ];

    refManager.updateFileReferences(filePath, duplicateReferences);

    const refs = refManager.getReferences(filePath);
    const refPaths = refs.references.map((ref) => ref.path);
    assert.deepStrictEqual(refPaths, ['settings/world.md', 'settings/magic.md']);

    // 逆参照も重複しない
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    const chapter1Count = worldRefs.referencedBy.filter(
      (ref) => ref.path === 'contents/chapter1.txt',
    ).length;
    assert.strictEqual(chapter1Count, 1);
  });

  test('シングルトンパターンが正しく動作する', () => {
    const instance1 = ReferenceManager.getInstance();
    const instance2 = ReferenceManager.getInstance();

    assert.strictEqual(instance1, instance2, '同じインスタンスが返されるべき');
  });

  test('ファイルの存在チェック（非同期版）が正しく動作する', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // 存在するファイル
    assert.strictEqual(await refManager.checkFileExistsAsync('settings/world.md'), true);
    assert.strictEqual(await refManager.checkFileExistsAsync('contents/chapter1.txt'), true);

    // 存在しないファイル
    assert.strictEqual(await refManager.checkFileExistsAsync('non-existent.md'), false);
    assert.strictEqual(await refManager.checkFileExistsAsync('settings/non-existent.md'), false);
  });

  test('無効な参照先ファイルを取得（非同期版）できる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // chapter1.txtに存在しない参照を追加
    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const referencesWithInvalid = [
      'settings/world.md', // 存在する
      'settings/non-existent.md', // 存在しない
      'invalid/path.md', // 存在しない
    ];

    refManager.updateFileReferences(filePath, referencesWithInvalid);

    const invalidRefs = await refManager.getInvalidReferencesAsync(filePath);
    assert.deepStrictEqual(
      invalidRefs.sort(),
      ['settings/non-existent.md', 'invalid/path.md'].sort(),
    );
  });
});
