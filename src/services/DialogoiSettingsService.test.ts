import { mock, MockProxy } from 'jest-mock-extended';
import { DialogoiSettingsService } from './DialogoiSettingsService.js';
import { SettingsRepository, ExcludePatterns } from '../repositories/SettingsRepository.js';

describe('DialogoiSettingsService テストスイート', () => {
  let service: DialogoiSettingsService;
  let mockRepository: MockProxy<SettingsRepository>;
  let settingsStorage: Map<string, Map<string, unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    settingsStorage = new Map<string, Map<string, unknown>>();
    
    // jest-mock-extendedでモック作成
    mockRepository = mock<SettingsRepository>();
    
    // SettingsRepositoryモックの設定
    setupSettingsRepositoryMocks();
    
    service = new DialogoiSettingsService(mockRepository);
  });
  
  function setupSettingsRepositoryMocks(): void {
    mockRepository.get.mockImplementation(<T>(section: string, key?: string): T | undefined => {
      const sectionStorage = settingsStorage.get(section);
      if (!sectionStorage) {
        return undefined;
      }
      
      if (key) {
        return sectionStorage.get(key) as T | undefined;
      } else {
        // セクション全体を返す場合
        const result: Record<string, unknown> = {};
        for (const [k, v] of sectionStorage.entries()) {
          result[k] = v;
        }
        return result as T;
      }
    });
    
    mockRepository.update.mockImplementation(async (
      section: string,
      key: string | undefined,
      value: unknown,
      _target: 'global' | 'workspace'
    ): Promise<boolean> => {
      try {
        if (!settingsStorage.has(section)) {
          settingsStorage.set(section, new Map<string, unknown>());
        }
        const sectionStorage = settingsStorage.get(section)!;
        
        if (key) {
          sectionStorage.set(key, value);
        } else {
          // セクション全体を更新する場合
          sectionStorage.clear();
          if (typeof value === 'object' && value !== null) {
            for (const [k, v] of Object.entries(value)) {
              sectionStorage.set(k, v);
            }
          }
        }
        return true;
      } catch {
        return false;
      }
    });
  }
  
  function setSettings(section: string, key: string, value: unknown): void {
    if (!settingsStorage.has(section)) {
      settingsStorage.set(section, new Map<string, unknown>());
    }
    settingsStorage.get(section)!.set(key, value);
  }

  describe('addDialogoiExcludePatterns', () => {
    it('Dialogoi関連パターンを正常に追加する', async () => {
      // 実行
      const result = await service.addDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<ExcludePatterns>('files', 'exclude');
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
      setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.addDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<ExcludePatterns>('files', 'exclude');
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
      setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.removeDialogoiExcludePatterns();

      // 検証
      expect(result).toBe(true);

      const currentExclude = mockRepository.get<ExcludePatterns>('files', 'exclude');
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
      setSettings('files', 'exclude', excludePatterns);

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
      setSettings('files', 'exclude', excludePatterns);

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
      setSettings('files', 'exclude', excludePatterns);

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
      setSettings('files', 'exclude', excludePatterns);

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
      setSettings('files', 'exclude', existingExclude);

      // 実行
      const result = await service.addWorkspaceExcludePatterns();

      // 検証
      expect(result).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('設定更新エラー時にfalseを返す', async () => {
      // updateメソッドがエラーを返すように設定
      mockRepository.update.mockResolvedValue(false);
      
      // 実行
      const result = await service.addDialogoiExcludePatterns();
      
      // 検証
      expect(result).toBe(false);
    });
    
    it('設定取得エラー時の動作確認', () => {
      // getメソッドがエラーを投げるように設定
      mockRepository.get.mockImplementation(() => {
        throw new Error('Settings access error');
      });
      
      // 実行
      const result = service.hasDialogoiExcludePatterns();
      
      // 検証（エラー時はfalseを返す）
      expect(result).toBe(false);
      
      // getCurrentExcludePatterns も同様にエラーハンドリングをテスト
      const patterns = service.getCurrentExcludePatterns();
      expect(patterns).toEqual({});
    });
  });
});
