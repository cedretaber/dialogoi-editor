import * as assert from 'assert';
import * as path from 'path';
import { ForeshadowingService, ForeshadowingData } from './ForeshadowingService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';

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

  suite('extractDisplayName', () => {
    test('マークダウンファイルの見出しから表示名を取得', () => {
      const filePath = path.join(novelRootAbsolutePath, 'settings/foreshadowings/mystery.md');
      const displayName = foreshadowingService.extractDisplayName(filePath);
      assert.strictEqual(displayName, '謎の正体');
    });

    test('見出しがない場合はファイル名を返す', () => {
      const filePath = path.join(novelRootAbsolutePath, 'contents/chapter1.txt');
      const displayName = foreshadowingService.extractDisplayName(filePath);
      assert.strictEqual(displayName, 'chapter1');
    });

    test('存在しないファイルの場合はファイル名を返す', () => {
      const filePath = path.join(novelRootAbsolutePath, 'nonexistent.txt');
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
        plants: [
          { location: 'contents/chapter1.txt', comment: '最初のヒント' },
          { location: 'contents/chapter2.txt', comment: '補強情報' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '真相の開示' },
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
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some((error) => error.includes('埋蔵位置')));
    });

    test('回収位置が空の場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: '', comment: '' }, // 空の位置
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some((error) => error.includes('回収位置')));
    });

    test('存在しないファイルパスの場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: 'ヒント1' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収' },
      };

      const result = foreshadowingService.validateForeshadowing(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length >= 2); // 植込み位置と回収位置の両方でエラー
      assert.ok(result.errors.some((error) => error.includes('埋蔵位置 1')));
      assert.ok(result.errors.some((error) => error.includes('回収位置')));
    });

    test('複数埋蔵位置の一部が無効な場合エラー', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: '有効な位置' },
          { location: 'contents/nonexistent.txt', comment: '無効な位置' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '回収' },
      };

      const result = foreshadowingService.validateForeshadowing(
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

  suite('getForeshadowingStatus', () => {
    test('両方のファイルが存在する場合は resolved', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'resolved');
    });

    test('全ての埋蔵位置が存在し回収位置が未作成の場合は fully_planted', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: 'ヒント1' },
          { location: 'contents/chapter2.txt', comment: 'ヒント2' },
        ],
        payoff: { location: 'contents/nonexistent.txt', comment: '未作成の回収' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'fully_planted');
    });

    test('一部の埋蔵位置のみ存在する場合は partially_planted', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'contents/chapter1.txt', comment: '存在する位置' },
          { location: 'contents/nonexistent.txt', comment: '存在しない位置' },
        ],
        payoff: { location: 'contents/chapter3.txt', comment: '回収' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'partially_planted');
    });

    test('回収位置のみ存在する場合は planned', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent.txt', comment: '未作成の埋蔵位置' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'planned');
    });

    test('両方とも存在しない場合は error', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: '埋蔵位置' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収位置' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      assert.strictEqual(status, 'error');
    });

    test('植込み位置が空の場合は error', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = foreshadowingService.getForeshadowingStatus(
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
      const metaYamlContent = `files:
  - name: test.md
    type: setting
    path: ${novelRootAbsolutePath}/settings/test.md
    foreshadowing:
      plants: []
      payoff:
        location: ""
        comment: ""`;
      mockFileRepository.addFile(metaYamlPath, metaYamlContent);
    });

    test('addPlant - 植込み位置を正常に追加', () => {
      const plant = { location: 'contents/chapter1.txt', comment: '最初のヒント' };
      
      const result = foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を追加しました'));
      
      // meta.yamlの内容を確認
      const meta = metaYamlService.loadMetaYaml(novelRootAbsolutePath);
      assert.notStrictEqual(meta, null);
      const fileItem = meta!.files.find(f => f.name === 'test.md');
      assert.notStrictEqual(fileItem, undefined);
      assert.strictEqual(fileItem!.foreshadowing!.plants.length, 1);
      assert.strictEqual(fileItem!.foreshadowing!.plants[0]!.location, 'contents/chapter1.txt');
      assert.strictEqual(fileItem!.foreshadowing!.plants[0]!.comment, '最初のヒント');
    });

    test('removePlant - 植込み位置を正常に削除', () => {
      // 先に植込み位置を追加
      const plant = { location: 'contents/chapter1.txt', comment: '削除予定' };
      foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);
      
      const result = foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 0);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を削除しました'));
      
      // meta.yamlの内容を確認
      const meta = metaYamlService.loadMetaYaml(novelRootAbsolutePath);
      assert.notStrictEqual(meta, null);
      const fileItem = meta!.files.find(f => f.name === 'test.md');
      assert.strictEqual(fileItem!.foreshadowing!.plants.length, 0);
    });

    test('updatePlant - 植込み位置を正常に更新', () => {
      // 先に植込み位置を追加
      const initialPlant = { location: 'contents/chapter1.txt', comment: '初期' };
      foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', initialPlant);
      
      const updatedPlant = { location: 'contents/chapter2.txt', comment: '更新後' };
      const result = foreshadowingService.updatePlant(novelRootAbsolutePath, 'test.md', 0, updatedPlant);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の植込み位置を更新しました'));
      
      // meta.yamlの内容を確認
      const meta = metaYamlService.loadMetaYaml(novelRootAbsolutePath);
      const fileItem = meta!.files.find(f => f.name === 'test.md');
      assert.strictEqual(fileItem!.foreshadowing!.plants[0]!.location, 'contents/chapter2.txt');
      assert.strictEqual(fileItem!.foreshadowing!.plants[0]!.comment, '更新後');
    });

    test('setPayoff - 回収位置を正常に設定', () => {
      const payoff = { location: 'contents/chapter5.txt', comment: '真相明示' };
      
      const result = foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の回収位置を設定しました'));
      
      // meta.yamlの内容を確認
      const meta = metaYamlService.loadMetaYaml(novelRootAbsolutePath);
      const fileItem = meta!.files.find(f => f.name === 'test.md');
      assert.strictEqual(fileItem!.foreshadowing!.payoff.location, 'contents/chapter5.txt');
      assert.strictEqual(fileItem!.foreshadowing!.payoff.comment, '真相明示');
    });

    test('removePayoff - 回収位置を正常に削除', () => {
      // 先に回収位置を設定
      const payoff = { location: 'contents/chapter5.txt', comment: '削除予定' };
      foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);
      
      const result = foreshadowingService.removePayoff(novelRootAbsolutePath, 'test.md');
      
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('伏線の回収位置を削除しました'));
      
      // meta.yamlの内容を確認
      const meta = metaYamlService.loadMetaYaml(novelRootAbsolutePath);
      const fileItem = meta!.files.find(f => f.name === 'test.md');
      assert.strictEqual(fileItem!.foreshadowing!.payoff.location, '');
      assert.strictEqual(fileItem!.foreshadowing!.payoff.comment, '');
    });

    test('エラーケース - 存在しないファイル', () => {
      const plant = { location: 'contents/chapter1.txt', comment: 'テスト' };
      
      const result = foreshadowingService.addPlant(novelRootAbsolutePath, 'nonexistent.md', plant);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ファイル nonexistent.md が見つかりません'));
    });

    test('エラーケース - 無効なインデックス', () => {
      const result = foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 999);
      
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('無効なインデックス'));
    });
  });
});
