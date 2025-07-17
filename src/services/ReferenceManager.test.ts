import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ReferenceManager } from './ReferenceManager.js';

suite('ReferenceManager テストスイート', () => {
  let testDir: string;
  let refManager: ReferenceManager;

  setup(() => {
    // テスト用の一時ディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-ref-test-'));
    
    // テスト用のプロジェクト構造を作成
    createTestProject();
    
    // ReferenceManagerのインスタンスを取得
    refManager = ReferenceManager.getInstance();
    refManager.clear(); // 前のテストの影響を除去
  });

  teardown(() => {
    // テストディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    refManager.clear();
  });

  function createTestProject(): void {
    // ルートディレクトリにdialogoi.yamlとmeta.yamlを作成
    fs.writeFileSync(path.join(testDir, 'dialogoi.yaml'), 'version: 1.0');
    
    // ルートのmeta.yamlを作成
    const rootMeta = `readme: README.md
files:
  - name: contents
    type: subdirectory
  - name: settings
    type: subdirectory
`;
    fs.writeFileSync(path.join(testDir, 'meta.yaml'), rootMeta);

    // contentsディレクトリとmeta.yamlを作成
    const contentsDir = path.join(testDir, 'contents');
    fs.mkdirSync(contentsDir);
    
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
    fs.writeFileSync(path.join(contentsDir, 'meta.yaml'), contentsMeta);
    fs.writeFileSync(path.join(contentsDir, 'chapter1.txt'), 'Chapter 1 content');
    fs.writeFileSync(path.join(contentsDir, 'chapter2.txt'), 'Chapter 2 content');

    // settingsディレクトリとmeta.yamlを作成
    const settingsDir = path.join(testDir, 'settings');
    fs.mkdirSync(settingsDir);
    
    const settingsMeta = `readme: README.md
files:
  - name: world.md
    type: setting
  - name: magic.md
    type: setting
  - name: characters
    type: subdirectory
`;
    fs.writeFileSync(path.join(settingsDir, 'meta.yaml'), settingsMeta);
    fs.writeFileSync(path.join(settingsDir, 'world.md'), 'World setting');
    fs.writeFileSync(path.join(settingsDir, 'magic.md'), 'Magic system');

    // settings/charactersディレクトリとmeta.yamlを作成
    const charactersDir = path.join(settingsDir, 'characters');
    fs.mkdirSync(charactersDir);
    
    const charactersMeta = `readme: README.md
files:
  - name: hero.md
    type: setting
    character:
      main: true
      multi: false
`;
    fs.writeFileSync(path.join(charactersDir, 'meta.yaml'), charactersMeta);
    fs.writeFileSync(path.join(charactersDir, 'hero.md'), 'Hero character');
  }

  test('初期化が正しく動作する', () => {
    refManager.initialize(testDir);

    // chapter1.txtの参照関係をチェック
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    assert.deepStrictEqual(chapter1Refs.references, ['settings/world.md', 'settings/characters/hero.md']);

    // chapter2.txtの参照関係をチェック
    const chapter2Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter2.txt'));
    assert.deepStrictEqual(chapter2Refs.references, ['settings/magic.md']);

    // 逆参照もチェック
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    assert.deepStrictEqual(worldRefs.referencedBy, ['contents/chapter1.txt']);

    const heroRefs = refManager.getReferences(path.join(testDir, 'settings', 'characters', 'hero.md'));
    assert.deepStrictEqual(heroRefs.referencedBy, ['contents/chapter1.txt']);

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    assert.deepStrictEqual(magicRefs.referencedBy, ['contents/chapter2.txt']);
  });

  test('単一ファイルの参照関係を更新できる', () => {
    refManager.initialize(testDir);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const newReferences = ['settings/world.md', 'settings/magic.md']; // hero.mdを削除、magic.mdを追加

    refManager.updateFileReferences(filePath, newReferences);

    // 更新後の参照関係をチェック
    const chapter1Refs = refManager.getReferences(filePath);
    assert.deepStrictEqual(chapter1Refs.references, newReferences);

    // 逆参照もチェック
    const heroRefs = refManager.getReferences(path.join(testDir, 'settings', 'characters', 'hero.md'));
    assert.strictEqual(heroRefs.referencedBy.length, 0); // chapter1.txtからの参照が削除されている

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    assert.deepStrictEqual(magicRefs.referencedBy.sort(), ['contents/chapter1.txt', 'contents/chapter2.txt'].sort());
  });

  test('存在しないファイルの参照関係を取得すると空の配列が返る', () => {
    refManager.initialize(testDir);

    const nonExistentPath = path.join(testDir, 'non-existent.txt');
    const refs = refManager.getReferences(nonExistentPath);

    assert.deepStrictEqual(refs.references, []);
    assert.deepStrictEqual(refs.referencedBy, []);
  });

  test('clearメソッドで参照関係がクリアされる', () => {
    refManager.initialize(testDir);

    // 初期化後は参照関係がある
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    assert.notStrictEqual(chapter1Refs.references.length, 0);

    refManager.clear();

    // クリア後は参照関係が空になる
    const chapter1RefsAfter = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    assert.deepStrictEqual(chapter1RefsAfter.references, []);
    assert.deepStrictEqual(chapter1RefsAfter.referencedBy, []);
  });

  test('ファイルの存在チェックが正しく動作する', () => {
    refManager.initialize(testDir);

    // 存在するファイル
    assert.strictEqual(refManager.checkFileExists('settings/world.md'), true);
    assert.strictEqual(refManager.checkFileExists('contents/chapter1.txt'), true);

    // 存在しないファイル
    assert.strictEqual(refManager.checkFileExists('non-existent.md'), false);
    assert.strictEqual(refManager.checkFileExists('settings/non-existent.md'), false);
  });

  test('無効な参照先ファイルを取得できる', () => {
    refManager.initialize(testDir);

    // chapter1.txtに存在しない参照を追加
    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const referencesWithInvalid = [
      'settings/world.md',        // 存在する
      'settings/non-existent.md', // 存在しない
      'invalid/path.md'          // 存在しない
    ];

    refManager.updateFileReferences(filePath, referencesWithInvalid);

    const invalidRefs = refManager.getInvalidReferences(filePath);
    assert.deepStrictEqual(invalidRefs.sort(), ['settings/non-existent.md', 'invalid/path.md'].sort());
  });

  test('空の参照配列で更新すると参照関係が削除される', () => {
    refManager.initialize(testDir);

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
    assert.strictEqual(worldRefs.referencedBy.includes('contents/chapter1.txt'), false);
  });

  test('同じファイルを複数回参照しても重複しない', () => {
    refManager.initialize(testDir);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const duplicateReferences = [
      'settings/world.md',
      'settings/world.md',  // 重複
      'settings/magic.md'
    ];

    refManager.updateFileReferences(filePath, duplicateReferences);

    const refs = refManager.getReferences(filePath);
    assert.deepStrictEqual(refs.references, ['settings/world.md', 'settings/magic.md']);

    // 逆参照も重複しない
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    const chapter1Count = worldRefs.referencedBy.filter(ref => ref === 'contents/chapter1.txt').length;
    assert.strictEqual(chapter1Count, 1);
  });

  test('シングルトンパターンが正しく動作する', () => {
    const instance1 = ReferenceManager.getInstance();
    const instance2 = ReferenceManager.getInstance();
    
    assert.strictEqual(instance1, instance2, '同じインスタンスが返されるべき');
  });
});