import * as assert from 'assert';
import * as path from 'path';
import { ForeshadowingService, ForeshadowingData } from './ForeshadowingService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { isForeshadowingItem } from '../utils/MetaYamlUtils.js';

suite('ForeshadowingService', () => {
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let foreshadowingService: ForeshadowingService;
  let novelRootAbsolutePath: string;

  setup(() => {
    // モックサービスを初期化
    mockFileRepository = new MockFileRepository();
    metaYamlService = new MetaYamlService(mockFileRepository);
    foreshadowingService = new ForeshadowingService(mockFileRepository, metaYamlService);
    novelRootAbsolutePath = '/tmp/dialogoi-test/novel';

    // テスト用のファイル構造を作成
    const contentsDir = path.join(novelRootAbsolutePath, 'contents');
    const settingsDir = path.join(novelRootAbsolutePath, 'settings');
    const foreshadowingsDir = path.join(settingsDir, 'foreshadowings');

    // ディレクトリを作成
    mockFileRepository.addDirectory(novelRootAbsolutePath);
    mockFileRepository.addDirectory(contentsDir);
    mockFileRepository.addDirectory(settingsDir);
    mockFileRepository.addDirectory(foreshadowingsDir);

    // テスト用ファイルを作成
    mockFileRepository.addFile(path.join(contentsDir, 'chapter1.txt'), 'Chapter 1 content');
    mockFileRepository.addFile(path.join(contentsDir, 'chapter2.txt'), 'Chapter 2 content');
    mockFileRepository.addFile(path.join(contentsDir, 'chapter3.txt'), 'Chapter 3 content');
    mockFileRepository.addFile(path.join(contentsDir, 'chapter4.txt'), 'Chapter 4 content');
    mockFileRepository.addFile(path.join(contentsDir, 'chapter5.txt'), 'Chapter 5 content');

    // マークダウンファイルも作成（表示名テスト用）
    mockFileRepository.addFile(
      path.join(foreshadowingsDir, 'mystery.md'),
      '# 謎の正体\n\nこの章では重要な謎について説明する。',
    );
  });

  // ===== 非同期版メソッドのテスト =====

  suite('extractDisplayNameAsync', () => {
    test('マークダウンファイルの見出しから表示名を取得', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'settings/foreshadowings/mystery.md');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      assert.strictEqual(displayName, '謎の正体');
    });

    test('見出しがない場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'contents/chapter1.txt');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      assert.strictEqual(displayName, 'chapter1');
    });

    test('存在しないファイルの場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'nonexistent.txt');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      assert.strictEqual(displayName, 'nonexistent');
    });
  });

  suite('validatePathAsync', () => {
    test('存在するファイルパスは有効', async () => {
      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/chapter1.txt',
      );
      assert.strictEqual(valid, true);
    });

    test('存在しないファイルパスは無効', async () => {
      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/nonexistent.txt',
      );
      assert.strictEqual(valid, false);
    });

    test('空文字列は無効', async () => {
      const valid = await foreshadowingService.validatePathAsync(novelRootAbsolutePath, '');
      assert.strictEqual(valid, false);
    });
  });

  suite('validateForeshadowingAsync', () => {
    test('有効な伏線データの検証', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: '最初のヒント' },
          { location: 'contents/chapter2.txt', comment: '補強情報' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '真相の開示' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('埋蔵位置が空の場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some((error) => error.includes('埋蔵位置')));
    });

    test('回収位置が空の場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: '', comment: '' }, // 空の位置
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some((error) => error.includes('回収位置')));
    });

    test('存在しないファイルパスの場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: 'ヒント1' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length >= 2); // 植込み位置と回収位置の両方でエラー
      assert.ok(result.errors.some((error) => error.includes('埋蔵位置 1')));
      assert.ok(result.errors.some((error) => error.includes('回収位置')));
    });

    test('複数埋蔵位置の一部が無効な場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: '有効な位置' },
          { location: 'contents/nonexistent.txt', comment: '無効な位置' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(
        result.errors.some(
          (error) => error.includes('埋蔵位置 2') && error.includes('nonexistent.txt'),
        ),
      );
    });
  });

  suite('getForeshadowingStatusAsync', () => {
    test('両方のファイルが存在する場合は resolved', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'resolved');
    });

    test('全ての埋蔵位置が存在し回収位置が未作成の場合は fully_planted', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: 'ヒント1' },
          { location: 'contents/chapter2.txt', comment: 'ヒント2' },
        ],
        payoff: { location: 'contents/nonexistent.txt', comment: '未作成の回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'fully_planted');
    });

    test('一部の埋蔵位置のみ存在する場合は partially_planted', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: '存在する位置' },
          { location: 'contents/nonexistent.txt', comment: '存在しない位置' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'partially_planted');
    });

    test('回収位置のみ存在する場合は planned', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent.txt', comment: '未作成の埋蔵位置' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'planned');
    });

    test('両方とも存在しない場合は error', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: '埋蔵位置' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収位置' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'error');
    });

    test('植込み位置が空の場合は error', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'error');
    });
  });

  suite('Phase 2: CRUD操作', () => {
    // テスト用のmeta.yamlセットアップ
    setup(() => {
      const metaYamlPath = path.join(novelRootAbsolutePath, '.dialogoi-meta.yaml');
      const metaYamlContent = `readme: README.md
files:
  - name: test.md
    type: setting
    path: ${novelRootAbsolutePath}/settings/test.md
    hash: testhash
    tags: []
    comments: '.test.md.comments.yaml'
    isUntracked: false
    isMissing: false
    foreshadowing:
      plants: []
      payoff:
        location: ""
        comment: ""`;
      mockFileRepository.addFile(metaYamlPath, metaYamlContent);
    });

    test('addPlant - 植込み位置を正常に追加', async () => {
      const plant = { location: 'contents/chapter1.txt', comment: '最初のヒント' };

      const result = await foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を追加しました'));

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      assert.notStrictEqual(meta, null);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);
      if (fileItem === undefined) {
        return;
      }

      // 型ガードを使って安全にforeshadowingプロパティにアクセス
      if (isForeshadowingItem(fileItem)) {
        assert.strictEqual(fileItem.foreshadowing.plants.length, 1);
        assert.strictEqual(fileItem.foreshadowing.plants[0]?.location, 'contents/chapter1.txt');
        assert.strictEqual(fileItem.foreshadowing.plants[0]?.comment, '最初のヒント');
      } else {
        assert.fail('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    test('removePlant - 植込み位置を正常に削除', async () => {
      // 先に植込み位置を追加
      const plant = { location: 'contents/chapter1.txt', comment: '削除予定' };
      await foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);

      const result = await foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 0);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を削除しました'));

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      assert.notStrictEqual(meta, null);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        assert.strictEqual(fileItem.foreshadowing.plants.length, 0);
      } else {
        assert.fail('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    test('updatePlant - 植込み位置を正常に更新', async () => {
      // 先に植込み位置を追加
      const initialPlant = { location: 'contents/chapter1.txt', comment: '初期' };
      await foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', initialPlant);

      const updatedPlant = { location: 'contents/chapter2.txt', comment: '更新後' };
      const result = await foreshadowingService.updatePlant(
        novelRootAbsolutePath,
        'test.md',
        0,
        updatedPlant,
      );

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を更新しました'));

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        assert.strictEqual(fileItem.foreshadowing.plants[0]?.location, 'contents/chapter2.txt');
        assert.strictEqual(fileItem.foreshadowing.plants[0]?.comment, '更新後');
      } else {
        assert.fail('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    test('setPayoff - 回収位置を正常に設定', async () => {
      const payoff = { location: 'contents/chapter5.txt', comment: '真相明示' };

      const result = await foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の回収位置を設定しました'));

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        assert.strictEqual(fileItem.foreshadowing.payoff.location, 'contents/chapter5.txt');
        assert.strictEqual(fileItem.foreshadowing.payoff.comment, '真相明示');
      } else {
        assert.fail('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    test('removePayoff - 回収位置を正常に削除', async () => {
      // 先に回収位置を設定
      const payoff = { location: 'contents/chapter5.txt', comment: '削除予定' };
      await foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);

      const result = await foreshadowingService.removePayoff(novelRootAbsolutePath, 'test.md');

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の回収位置を削除しました'));

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        assert.strictEqual(fileItem.foreshadowing.payoff.location, '');
        assert.strictEqual(fileItem.foreshadowing.payoff.comment, '');
      } else {
        assert.fail('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    test('エラーケース - 存在しないファイル', async () => {
      const plant = { location: 'contents/chapter1.txt', comment: 'テスト' };

      const result = await foreshadowingService.addPlant(
        novelRootAbsolutePath,
        'nonexistent.md',
        plant,
      );

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ファイル nonexistent.md が見つかりません'));
    });

    test('エラーケース - 無効なインデックス', async () => {
      const result = await foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 999);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('無効なインデックス'));
    });
  });
});
