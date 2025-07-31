import * as path from 'path';
import { ForeshadowingService, ForeshadowingData } from './ForeshadowingService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { mock, MockProxy } from 'jest-mock-extended';

describe('ForeshadowingService', () => {
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let foreshadowingService: ForeshadowingService;
  let novelRootAbsolutePath: string;

  beforeEach(() => {
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();

    foreshadowingService = new ForeshadowingService(mockFileRepository, mockMetaYamlService);
    novelRootAbsolutePath = '/tmp/dialogoi-test/novel';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===== 非同期版メソッドのテスト =====

  describe('extractDisplayNameAsync', () => {
    it('マークダウンファイルの見出しから表示名を取得', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'settings/foreshadowings/mystery.md');

      // モック設定：ファイルが存在し、マークダウン見出しを含む
      mockFileRepository.existsAsync.mockResolvedValue(true);
      mockFileRepository.readFileAsync.mockResolvedValue(
        '# 謎の正体\n\nこの章では重要な謎について説明する。',
      );

      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);

      expect(mockFileRepository.existsAsync).toHaveBeenCalled();
      expect(mockFileRepository.readFileAsync).toHaveBeenCalled();
      expect(displayName).toBe('謎の正体');
    });

    it('見出しがない場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'contents/chapter1.txt');

      // モック設定：ファイルが存在するが見出しがない
      mockFileRepository.existsAsync.mockResolvedValue(true);
      mockFileRepository.readFileAsync.mockResolvedValue('Chapter 1 content');

      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);

      expect(displayName).toBe('chapter1');
    });

    it('存在しないファイルの場合はファイル名を返す', async () => {
      const filePath = path.join(novelRootAbsolutePath, 'nonexistent.txt');

      // モック設定：ファイルが存在しない
      mockFileRepository.existsAsync.mockResolvedValue(false);

      const displayName = await foreshadowingService.extractDisplayNameAsync(filePath);

      expect(mockFileRepository.existsAsync).toHaveBeenCalled();
      expect(displayName).toBe('nonexistent');
    });
  });

  describe('validatePathAsync', () => {
    it('存在するファイルパスは有効', async () => {
      // モック設定：ファイルが存在する
      mockFileRepository.existsAsync.mockResolvedValue(true);

      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/chapter1.txt',
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalled();
      expect(valid).toBe(true);
    });

    it('存在しないファイルパスは無効', async () => {
      // モック設定：ファイルが存在しない
      mockFileRepository.existsAsync.mockResolvedValue(false);

      const valid = await foreshadowingService.validatePathAsync(
        novelRootAbsolutePath,
        'contents/nonexistent.txt',
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalled();
      expect(valid).toBe(false);
    });

    it('空文字列は無効', async () => {
      const valid = await foreshadowingService.validatePathAsync(novelRootAbsolutePath, '');

      // 空文字列の場合はファイル存在確認は呼ばれない
      expect(mockFileRepository.existsAsync).not.toHaveBeenCalled();
      expect(valid).toBe(false);
    });
  });

  describe('validateForeshadowingAsync', () => {
    it('有効な伏線データの検証', async () => {
      // モック設定：すべてのファイルが存在する
      mockFileRepository.existsAsync.mockResolvedValue(true);

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

      // 3つのファイル存在確認が呼ばれる（plants×2 + payoff×1）
      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(3);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('埋蔵位置が空の場合エラー', async () => {
      // モック設定：payoffファイルは存在する
      mockFileRepository.existsAsync.mockResolvedValue(true);

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
      // モック設定：plantsファイルは存在する
      mockFileRepository.existsAsync.mockResolvedValue(true);

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
      // モック設定：すべてのファイルが存在しない
      mockFileRepository.existsAsync.mockResolvedValue(false);

      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: 'ヒント1' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収' },
      };

      const result = await foreshadowingService.validateForeshadowingAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(2);
      expect(result.valid).toBe(false);
      expect(result.errors.length >= 2).toBeTruthy(); // 植込み位置と回収位置の両方でエラー
      expect(result.errors.some((error) => error.includes('埋蔵位置 1'))).toBeTruthy();
      expect(result.errors.some((error) => error.includes('回収位置'))).toBeTruthy();
    });

    it('複数埋蔵位置の一部が無効な場合エラー', async () => {
      // モック設定：1つ目のファイルは存在、2つ目と3つ目は存在しない
      mockFileRepository.existsAsync
        .mockResolvedValueOnce(true) // chapter1.txt
        .mockResolvedValueOnce(false) // nonexistent.txt
        .mockResolvedValueOnce(true); // chapter3.txt

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

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(3);
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
      // モック設定：すべてのファイルが存在する
      mockFileRepository.existsAsync.mockResolvedValue(true);

      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/chapter1.txt', comment: 'ヒント' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(2);
      expect(status).toBe('resolved');
    });

    it('全ての埋蔵位置が存在し回収位置が未作成の場合は fully_planted', async () => {
      // モック設定：plantsは存在、payoffは存在しない
      mockFileRepository.existsAsync
        .mockResolvedValueOnce(true) // chapter1.txt
        .mockResolvedValueOnce(true) // chapter2.txt
        .mockResolvedValueOnce(false); // nonexistent.txt (payoff)

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

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(3);
      expect(status).toBe('fully_planted');
    });

    it('一部の埋蔵位置のみ存在する場合は partially_planted', async () => {
      // モック設定：1つ目のplantは存在、2つ目は存在しない、payoffは存在
      mockFileRepository.existsAsync
        .mockResolvedValueOnce(true) // chapter1.txt
        .mockResolvedValueOnce(false) // nonexistent.txt
        .mockResolvedValueOnce(true); // chapter3.txt (payoff)

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

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(3);
      expect(status).toBe('partially_planted');
    });

    it('回収位置のみ存在する場合は planned', async () => {
      // モック設定：plantは存在しない、payoffは存在する
      mockFileRepository.existsAsync
        .mockResolvedValueOnce(false) // nonexistent.txt (plant)
        .mockResolvedValueOnce(true); // chapter2.txt (payoff)

      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent.txt', comment: '未作成の埋蔵位置' }],
        payoff: { location: 'contents/chapter2.txt', comment: '回収' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(2);
      expect(status).toBe('planned');
    });

    it('両方とも存在しない場合は error', async () => {
      // モック設定：すべてのファイルが存在しない
      mockFileRepository.existsAsync.mockResolvedValue(false);

      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'contents/nonexistent1.txt', comment: '埋蔵位置' }],
        payoff: { location: 'contents/nonexistent2.txt', comment: '回収位置' },
      };

      const status = await foreshadowingService.getForeshadowingStatusAsync(
        novelRootAbsolutePath,
        foreshadowingData,
      );

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(2);
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

      // 空の配列の場合はファイル存在確認は呼ばれない
      expect(mockFileRepository.existsAsync).not.toHaveBeenCalled();
      expect(status).toBe('error');
    });
  });
});
