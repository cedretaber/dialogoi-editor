import * as path from 'path';
import { ForeshadowingService, ForeshadowingData } from './ForeshadowingService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MockMetaYamlService } from '../repositories/MockMetaYamlService.js';
import { isForeshadowingItem, MetaYamlUtils } from '../utils/MetaYamlUtils.js';

describe('ForeshadowingService', () => {
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let foreshadowingService: ForeshadowingService;
  let novelRootAbsolutePath: string;

  beforeEach(() => {
    // モックサービスを初期化
    mockFileRepository = new MockFileRepository();
    metaYamlService = new MockMetaYamlService();
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

  describe('extractDisplayNameAsync', () => {
    it('マークダウンファイルの見出しから表示名を取得', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'settings/foreshadowings/mystery.md');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      expect(displayName).toBe('謎の正体');
    });

    it('見出しがない場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'contents/chapter1.txt');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      expect(displayName).toBe('chapter1');
    });

    it('存在しないファイルの場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'nonexistent.txt');
      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);
      expect(displayName).toBe('nonexistent');
    });
  });

  describe('validatePathAsync', () => {
    it('存在するファイルパスは有効', async () => {
      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/chapter1.txt',
      );
      expect(valid).toBe(true);
    });

    it('存在しないファイルパスは無効', async () => {
      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/nonexistent.txt',
      );
      expect(valid).toBe(false);
    });

    it('空文字列は無効', async () => {
      const valid = await foreshadowingService.validatePathAsync(novelRootAbsolutePath, '');
      expect(valid).toBe(false);
    });
  });

  describe('validateForeshadowingAsync', () => {
    it('有効な伏線データの検証', async () => {
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
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('埋蔵位置が空の場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length > 0).toBeTruthy();
      expect(result.errors.some((error) => error.includes('埋蔵位置'))).toBeTruthy();
    });

    it('回収位置が空の場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: '', comment: '' }, // 空の位置
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length > 0).toBeTruthy();
      expect(result.errors.some((error) => error.includes('回収位置'))).toBeTruthy();
    });

    it('存在しないファイルパスの場合エラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: 'ヒント1' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length >= 2).toBeTruthy(); // 植込み位置と回収位置の両方でエラー
      expect(result.errors.some((error) => error.includes('埋蔵位置 1'))).toBeTruthy();
      expect(result.errors.some((error) => error.includes('回収位置'))).toBeTruthy();
    });

    it('複数埋蔵位置の一部が無効な場合エラー', async () => {
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
      expect(result.valid).toBe(false);
      expect(result.errors.length > 0).toBeTruthy();
      expect(
        result.errors.some(
          (error) => error.includes('埋蔵位置 2') && error.includes('nonexistent.txt'),
        ),
      ).toBeTruthy();
    });
  });

  describe('getForeshadowingStatusAsync', () => {
    it('両方のファイルが存在する場合は resolved', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(status).toBe('resolved');
    });

    it('全ての埋蔵位置が存在し回収位置が未作成の場合は fully_planted', async () => {
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
      expect(status).toBe('fully_planted');
    });

    it('一部の埋蔵位置のみ存在する場合は partially_planted', async () => {
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
      expect(status).toBe('partially_planted');
    });

    it('回収位置のみ存在する場合は planned', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent.txt', comment: '未作成の埋蔵位置' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(status).toBe('planned');
    });

    it('両方とも存在しない場合は error', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: '埋蔵位置' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収位置' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(status).toBe('error');
    });

    it('植込み位置が空の場合は error', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [], // 空の配列
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );
      expect(status).toBe('error');
    });
  });

  describe('Phase 2: CRUD操作', () => {
    // テスト用のmeta.yamlセットアップ
    beforeEach(() => {
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

      // YAMLをパースしてMockMetaYamlServiceに設定
      const parsedMeta = MetaYamlUtils.parseMetaYaml(metaYamlContent);
      if (parsedMeta) {
        (metaYamlService as MockMetaYamlService).setMetaYaml(novelRootAbsolutePath, parsedMeta);
      }
    });

    it('addPlant - 植込み位置を正常に追加', async () => {
      const plant = { location: 'contents/chapter1.txt', comment: '最初のヒント' };

      const result = await foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線の植込み位置を追加しました')).toBeTruthy();

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      expect(meta).not.toBe(null);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      expect(fileItem).not.toBe(undefined);
      if (fileItem === undefined) {
        return;
      }

      // 型ガードを使って安全にforeshadowingプロパティにアクセス
      if (isForeshadowingItem(fileItem)) {
        expect(fileItem.foreshadowing.plants.length).toBe(1);
        expect(fileItem.foreshadowing.plants[0]?.location).toBe('contents/chapter1.txt');
        expect(fileItem.foreshadowing.plants[0]?.comment).toBe('最初のヒント');
      } else {
        throw new Error('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    it('removePlant - 植込み位置を正常に削除', async () => {
      // 先に植込み位置を追加
      const plant = { location: 'contents/chapter1.txt', comment: '削除予定' };
      await foreshadowingService.addPlant(novelRootAbsolutePath, 'test.md', plant);

      const result = await foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 0);

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線の植込み位置を削除しました')).toBeTruthy();

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      expect(meta).not.toBe(null);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      expect(fileItem).not.toBe(undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        expect(fileItem.foreshadowing.plants.length).toBe(0);
      } else {
        throw new Error('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    it('updatePlant - 植込み位置を正常に更新', async () => {
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

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線の植込み位置を更新しました')).toBeTruthy();

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      expect(fileItem).not.toBe(undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        expect(fileItem.foreshadowing.plants[0]?.location).toBe('contents/chapter2.txt');
        expect(fileItem.foreshadowing.plants[0]?.comment).toBe('更新後');
      } else {
        throw new Error('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    it('setPayoff - 回収位置を正常に設定', async () => {
      const payoff = { location: 'contents/chapter5.txt', comment: '真相明示' };

      const result = await foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線の回収位置を設定しました')).toBeTruthy();

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      expect(fileItem).not.toBe(undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        expect(fileItem.foreshadowing.payoff.location).toBe('contents/chapter5.txt');
        expect(fileItem.foreshadowing.payoff.comment).toBe('真相明示');
      } else {
        throw new Error('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    it('removePayoff - 回収位置を正常に削除', async () => {
      // 先に回収位置を設定
      const payoff = { location: 'contents/chapter5.txt', comment: '削除予定' };
      await foreshadowingService.setPayoff(novelRootAbsolutePath, 'test.md', payoff);

      const result = await foreshadowingService.removePayoff(novelRootAbsolutePath, 'test.md');

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線の回収位置を削除しました')).toBeTruthy();

      // meta.yamlの内容を確認
      const meta = await metaYamlService.loadMetaYamlAsync(novelRootAbsolutePath);
      if (meta === null) {
        return;
      }
      const fileItem = meta.files.find((f) => f.name === 'test.md');
      expect(fileItem).not.toBe(undefined);

      if (fileItem && isForeshadowingItem(fileItem)) {
        expect(fileItem.foreshadowing.payoff.location).toBe('');
        expect(fileItem.foreshadowing.payoff.comment).toBe('');
      } else {
        throw new Error('fileItemにforeshadowingプロパティが存在しません');
      }
    });

    it('エラーケース - 存在しないファイル', async () => {
      const plant = { location: 'contents/chapter1.txt', comment: 'テスト' };

      const result = await foreshadowingService.addPlant(
        novelRootAbsolutePath,
        'nonexistent.md',
        plant,
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('ファイル nonexistent.md が見つかりません')).toBeTruthy();
    });

    it('エラーケース - 無効なインデックス', async () => {
      const result = await foreshadowingService.removePlant(novelRootAbsolutePath, 'test.md', 999);

      expect(result.success).toBe(false);
      expect(result.message.includes('無効なインデックス')).toBeTruthy();
    });
  });
});
