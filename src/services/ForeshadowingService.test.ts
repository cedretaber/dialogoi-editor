import * as assert from 'assert';
import * as path from 'path';
import { ForeshadowingService, ForeshadowingData } from './ForeshadowingService.js';
import { MockFileOperationService } from './MockFileOperationService.js';

suite('ForeshadowingService', () => {
  let mockFileService: MockFileOperationService;
  let foreshadowingService: ForeshadowingService;
  let novelRootAbsolutePath: string;

  setup(() => {
    // モックサービスを初期化
    mockFileService = new MockFileOperationService();
    foreshadowingService = new ForeshadowingService(mockFileService);
    novelRootAbsolutePath = '/tmp/dialogoi-test/novel';

    // テスト用のファイル構造を作成
    const contentsDir = path.join(novelRootAbsolutePath, 'contents');
    const settingsDir = path.join(novelRootAbsolutePath, 'settings');
    const foreshadowingsDir = path.join(settingsDir, 'foreshadowings');

    // ディレクトリを作成
    mockFileService.addDirectory(novelRootAbsolutePath);
    mockFileService.addDirectory(contentsDir);
    mockFileService.addDirectory(settingsDir);
    mockFileService.addDirectory(foreshadowingsDir);

    // テスト用ファイルを作成
    mockFileService.addFile(path.join(contentsDir, 'chapter1.txt'), 'Chapter 1 content');
    mockFileService.addFile(path.join(contentsDir, 'chapter2.txt'), 'Chapter 2 content');
    mockFileService.addFile(
      path.join(foreshadowingsDir, 'mystery.md'),
      '# 謎の手がかり\n\n重要な伏線の説明',
    );
    mockFileService.addFile(
      path.join(foreshadowingsDir, 'no-heading.md'),
      '伏線の内容（見出しなし）',
    );
  });

  teardown(() => {
    // モックサービスをリセット
    mockFileService.reset();
  });

  suite('extractDisplayName', () => {
    test('マークダウンファイルの見出しから表示名を取得', () => {
      const filePath = path.join(novelRootAbsolutePath, 'settings', 'foreshadowings', 'mystery.md');
      const displayName = foreshadowingService.extractDisplayName(filePath);
      assert.strictEqual(displayName, '謎の手がかり');
    });

    test('見出しがない場合はファイル名を返す', () => {
      const filePath = path.join(
        novelRootAbsolutePath,
        'settings',
        'foreshadowings',
        'no-heading.md',
      );
      const displayName = foreshadowingService.extractDisplayName(filePath);
      assert.strictEqual(displayName, 'no-heading');
    });

    test('存在しないファイルの場合はファイル名を返す', () => {
      const filePath = path.join(
        novelRootAbsolutePath,
        'settings',
        'foreshadowings',
        'nonexistent.md',
      );
      const displayName = foreshadowingService.extractDisplayName(filePath);
      assert.strictEqual(displayName, 'nonexistent');
    });
  });

  suite('validatePath', () => {
    test('存在するファイルパスは有効', () => {
      const valid = foreshadowingService.validatePath(
        novelRootAbsolutePath,
        'contents/chapter1.txt',
      );
      assert.strictEqual(valid, true);
    });

    test('存在しないファイルパスは無効', () => {
      const valid = foreshadowingService.validatePath(
        novelRootAbsolutePath,
        'contents/nonexistent.txt',
      );
      assert.strictEqual(valid, false);
    });

    test('空文字列は無効', () => {
      const valid = foreshadowingService.validatePath(novelRootAbsolutePath, '');
      assert.strictEqual(valid, false);
    });
  });

  suite('validateForeshadowing', () => {
    test('有効な伏線データの検証', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/chapter1.txt',
        goal: 'contents/chapter2.txt',
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('埋蔵位置が空の場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        start: '',
        goal: 'contents/chapter2.txt',
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0], '埋蔵位置（start）が指定されていません');
    });

    test('回収位置が空の場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/chapter1.txt',
        goal: '',
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0], '回収位置（goal）が指定されていません');
    });

    test('存在しないファイルパスの場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/nonexistent1.txt',
        goal: 'contents/nonexistent2.txt',
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.errors.length, 2);
      assert.strictEqual(
        result.errors[0],
        '埋蔵位置のファイルが存在しません: contents/nonexistent1.txt',
      );
      assert.strictEqual(
        result.errors[1],
        '回収位置のファイルが存在しません: contents/nonexistent2.txt',
      );
    });
  });

  suite('getForeshadowingStatus', () => {
    test('両方のファイルが存在する場合は resolved', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/chapter1.txt',
        goal: 'contents/chapter2.txt',
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'resolved');
    });

    test('埋蔵位置のみ存在する場合は planted', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/chapter1.txt',
        goal: 'contents/nonexistent.txt',
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'planted');
    });

    test('回収位置のみ存在する場合は planned', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/nonexistent.txt',
        goal: 'contents/chapter2.txt',
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'planned');
    });

    test('両方とも存在しない場合は error', () => {
      const foreshadowingData: ForeshadowingData = {
        start: 'contents/nonexistent1.txt',
        goal: 'contents/nonexistent2.txt',
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'error');
    });
  });
});
