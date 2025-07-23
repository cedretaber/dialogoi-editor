import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import { DropHandlerService, DroppedFileInfo } from './DropHandlerService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('DropHandlerService テストスイート', () => {
  let dropHandlerService: DropHandlerService;
  let mockFileRepository: MockFileRepository;
  let container: TestServiceContainer;

  setup(() => {
    container = TestServiceContainer.create();
    mockFileRepository = container.getMockFileRepository();
    dropHandlerService = container.getDropHandlerService();
  });

  teardown(() => {
    container.cleanup();
  });

  suite('handleDrop - 本文ファイルへのドロップ', () => {
    test('本文ファイルに設定ファイルをドロップした場合、referencesに追加される', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';
      const settingsDir = '/test/project/settings';

      // dialogoi.yaml
      mockFileRepository.addFile(
        `${projectRoot}/dialogoi.yaml`,
        `title: テスト小説
author: テスト作者
version: 1.0.0
created_at: 2024-01-01T00:00:00.000Z
tags: []`,
      );

      // 本文ファイルとmeta.yaml
      mockFileRepository.addFile(`${contentsDir}/chapter1.txt`, '第一章の内容');
      mockFileRepository.addFile(
        `${contentsDir}/.dialogoi-meta.yaml`,
        `files:
  - name: chapter1.txt
    type: content
    order: 1
    references: []`,
      );

      // 設定ファイル
      mockFileRepository.addFile(`${settingsDir}/character1.md`, '# キャラクター1');
      mockFileRepository.addFile(
        `${settingsDir}/.dialogoi-meta.yaml`,
        `files:
  - name: character1.md
    type: setting
    subtype: character
    order: 1`,
      );

      // ドロップデータを準備（プロジェクト相対パス）
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md', // DropHandlerServiceはプロジェクト相対パスを期待
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, '参照 "character1.md" を追加しました。');
      assert.strictEqual(result.insertText, undefined);

      // meta.yamlに参照が追加されたことを確認
      const metaUri = mockFileRepository.createFileUri(`${contentsDir}/.dialogoi-meta.yaml`);
      const metaContent = await mockFileRepository.readFileAsync(metaUri, 'utf8');
      assert.match(metaContent, /references:\s*\n\s*- settings\/character1\.md/);
    });

    test('既に存在する参照をドロップした場合、重複追加されない', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';
      const settingsDir = '/test/project/settings';

      // dialogoi.yaml
      mockFileRepository.addFile(
        `${projectRoot}/dialogoi.yaml`,
        `title: テスト小説
author: テスト作者
version: 1.0.0
created_at: 2024-01-01T00:00:00.000Z
tags: []`,
      );

      // 既に参照が存在する本文ファイル
      mockFileRepository.addFile(`${contentsDir}/chapter1.txt`, '第一章の内容');
      mockFileRepository.addFile(
        `${contentsDir}/.dialogoi-meta.yaml`,
        `files:
  - name: chapter1.txt
    type: content
    order: 1
    references:
      - settings/character1.md`,
      );

      // 設定ファイル
      mockFileRepository.addFile(`${settingsDir}/character1.md`, '# キャラクター1');

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, '参照 "settings/character1.md" は既に存在します。');
    });
  });

  suite('handleDrop - 設定ファイルへのドロップ', () => {
    test('設定ファイルにファイルをドロップした場合、マークダウンリンクが生成される', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const settingsDir = '/test/project/settings';
      const charactersDir = '/test/project/settings/characters';

      // dialogoi.yaml
      mockFileRepository.addFile(
        `${projectRoot}/dialogoi.yaml`,
        `title: テスト小説
author: テスト作者
version: 1.0.0
created_at: 2024-01-01T00:00:00.000Z
tags: []`,
      );

      // 設定ファイル
      mockFileRepository.addFile(`${settingsDir}/overview.md`, '# 概要');
      mockFileRepository.addFile(
        `${settingsDir}/.dialogoi-meta.yaml`,
        `files:
  - name: overview.md
    type: setting
    order: 1`,
      );

      // ドロップ対象ファイル
      mockFileRepository.addFile(`${charactersDir}/hero.md`, '# 主人公');
      mockFileRepository.addFile(
        `${charactersDir}/.dialogoi-meta.yaml`,
        `files:
  - name: hero.md
    type: setting
    subtype: character
    order: 1`,
      );

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/characters/hero.md',
        name: 'hero.md',
        fileType: 'setting',
        absolutePath: 'settings/characters/hero.md',
      };

      // 設定ファイルにドロップ
      const result = await dropHandlerService.handleDrop(`${settingsDir}/overview.md`, droppedData);

      // 結果を検証
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'マークダウンリンク "hero.md" を生成しました。');
      assert.strictEqual(result.insertText, '[hero.md](settings/characters/hero.md)');
      assert.deepStrictEqual(result.insertPosition, { line: 0, character: 0 });
    });
  });

  suite('handleDrop - エラーケース', () => {
    test('Dialogoiプロジェクト外のファイルにドロップした場合、エラーになる', async () => {
      // プロジェクト外のファイル
      const outsideFile = '/outside/file.txt';
      mockFileRepository.addFile(outsideFile, 'プロジェクト外のファイル');

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // プロジェクト外のファイルにドロップ
      const result = await dropHandlerService.handleDrop(outsideFile, droppedData);

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(
        result.message,
        'ドロップ先のファイルがDialogoiプロジェクトのファイルではありません。',
      );
    });

    test('meta.yamlが存在しないディレクトリの本文ファイルにドロップした場合、エラーになる', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';

      // dialogoi.yaml
      mockFileRepository.addFile(
        `${projectRoot}/dialogoi.yaml`,
        `title: テスト小説
author: テスト作者
version: 1.0.0
created_at: 2024-01-01T00:00:00.000Z
tags: []`,
      );

      // meta.yamlが存在しない本文ファイル
      mockFileRepository.addFile(`${contentsDir}/chapter1.txt`, '第一章の内容');

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      assert.strictEqual(result.success, false);
      assert.strictEqual(
        result.message,
        'ドロップ先のファイルがDialogoiプロジェクトのファイルではありません。',
      );
    });
  });
});
