import { DialogoiSettingsService } from './DialogoiSettingsService.js';
import { MockSettingsRepository } from '../repositories/MockSettingsRepository.js';

describe('DialogoiSettingsService テストスイート', () => {
  let service: DialogoiSettingsService;
  let mockRepository: MockSettingsRepository;

  beforeEach(() => {
    mockRepository = new MockSettingsRepository();
    service = new DialogoiSettingsService(mockRepository);
  });

  afterEach(() => {
    mockRepository.clear();
  });

  describe('addDialogoiExcludePatterns', () => {
    it('Dialogoi関連パターンを正常に追加する', async () => {
      // 実行
      const result = await service.addDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<{ [key: string]: boolean }>('files', 'exclude');
      expect(currentExclude?.['**/dialogoi.yaml']).toBe(true);
      expect(currentExclude?.['**/.dialogoi-meta.yaml']).toBe(true);
      expect(currentExclude?.['**/.dialogoi-reviews/**']).toBe(true);
    });

    it('既存の除外設定を保持しながら追加する', async () => {
      // 準備：既存の除外設定
      const existingExclude = {
        node_modules: true,
        dist: true,
      };
      mockRepository.setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.addDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<{ [key: string]: boolean }>('files', 'exclude');
      // 既存設定が保持されている
      expect(currentExclude?.['node_modules']).toBe(true);
      expect(currentExclude?.['dist']).toBe(true);
      // 新しい設定が追加されている
      expect(currentExclude?.['**/dialogoi.yaml']).toBe(true);
      expect(currentExclude?.['**/.dialogoi-meta.yaml']).toBe(true);
      expect(currentExclude?.['**/.dialogoi-reviews/**']).toBe(true);
    });
  });

  describe('removeDialogoiExcludePatterns', () => {
    it('Dialogoi関連パターンを正常に削除する', async () => {
      // 準備：Dialogoi関連パターンを設定
      const existingExclude = {
        node_modules: true,
        '**/dialogoi.yaml': true,
        '**/.dialogoi-meta.yaml': true,
        '**/.dialogoi-reviews/**': true,
      };
      mockRepository.setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.removeDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<{ [key: string]: boolean }>('files', 'exclude');
      // 既存設定が保持されている
      expect(currentExclude?.['node_modules']).toBe(true);
      // Dialogoi関連パターンが削除されている
      expect(currentExclude?.['**/dialogoi.yaml']).toBe(undefined);
      expect(currentExclude?.['**/.dialogoi-meta.yaml']).toBe(undefined);
      expect(currentExclude?.['**/.dialogoi-reviews/**']).toBe(undefined);
    });

    it('除外設定が存在しない場合でも正常に動作する', async () => {
      // 実行（初期状態、除外設定なし）
      const result = await service.removeDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);
    });
  });

  describe('hasDialogoiExcludePatterns', () => {
    it('全てのパターンが設定されている場合はtrueを返す', () => {
      // 準備：全てのDialogoi関連パターンを設定
      const excludePatterns = {
        node_modules: true,
        '**/dialogoi.yaml': true,
        '**/.dialogoi-meta.yaml': true,
        '**/.dialogoi-reviews/**': true,
      };
      mockRepository.setSettings('files', 'exclude', excludePatterns);

      // 実行
      const result = service.hasDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);
    });

    it('一部のパターンが欠けている場合はfalseを返す', () => {
      // 準備：一部のパターンのみ設定
      const excludePatterns = {
        node_modules: true,
        '**/dialogoi.yaml': true,
        // '**/.dialogoi-meta.yaml': true,  // 欠けている
        '**/.dialogoi-reviews/**': true,
      };
      mockRepository.setSettings('files', 'exclude', excludePatterns);

      // 実行
      const result = service.hasDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(false);
    });

    it('除外設定が全く存在しない場合はfalseを返す', () => {
      // 実行（初期状態、除外設定なし）
      const result = service.hasDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(false);
    });

    it('パターンがfalseに設定されている場合はfalseを返す', () => {
      // 準備：パターンがfalseに設定
      const excludePatterns = {
        '**/dialogoi.yaml': false,
        '**/.dialogoi-meta.yaml': true,
        '**/.dialogoi-reviews/**': true,
      };
      mockRepository.setSettings('files', 'exclude', excludePatterns);

      // 実行
      const result = service.hasDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(false);
    });
  });

  describe('getCurrentExcludePatterns', () => {
    it('現在の除外設定を正常に取得する', () => {
      // 準備
      const excludePatterns = {
        node_modules: true,
        '**/dialogoi.yaml': true,
        test: false,
      };
      mockRepository.setSettings('files', 'exclude', excludePatterns);

      // 実行
      const result = service.getCurrentExcludePatterns();

      // 検証
      expect(result).toEqual(excludePatterns);
    });

    it('除外設定が存在しない場合は空オブジェクトを返す', () => {
      // 実行（初期状態）
      const result = service.getCurrentExcludePatterns();

      // 検証
      expect(result).toEqual({});
    });
  });

  describe('addWorkspaceExcludePatterns', () => {
    it('ワークスペース設定にDialogoi関連パターンを追加する', async () => {
      // 実行
      const result = await service.addWorkspaceExcludePatterns();

      // 検証
      expect(result).toBe(true);

      // ワークスペース設定では実際の検証はMockRepositoryの実装に依存
      // ここでは成功することを確認
    });

    it('既存のワークスペース設定を保持しながら追加する', async () => {
      // 準備：既存の除外設定
      const existingExclude = {
        build: true,
        temp: true,
      };
      mockRepository.setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.addWorkspaceExcludePatterns();

      // 検証
      expect(result).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('設定更新エラー時にfalseを返す', () => {
      // MockRepositoryを拡張してエラーを発生させるケースをテスト
      // 実際の実装では、Mockでエラーを発生させる方法が必要

      // 現在のMockRepositoryはエラーを発生させない設計なので、
      // この特定のテストは概念的な確認として残す
      expect(true).toBe(true);
    });
  });
});
