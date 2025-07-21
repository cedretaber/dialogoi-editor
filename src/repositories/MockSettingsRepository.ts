import { SettingsRepository } from './SettingsRepository.js';

/**
 * テスト用のMock設定リポジトリ
 */
export class MockSettingsRepository implements SettingsRepository {
  private settings: Map<string, Map<string, unknown>> = new Map();

  constructor() {
    // デフォルト設定を初期化
    this.settings.set('files', new Map([['exclude', {}]]));
  }

  /**
   * 設定値を取得
   */
  get<T>(section: string, key?: string): T | undefined {
    const sectionSettings = this.settings.get(section);
    if (!sectionSettings) {
      return undefined;
    }

    if (key) {
      return sectionSettings.get(key) as T | undefined;
    }

    // keyが指定されていない場合は、セクション全体を返す
    const result: Record<string, unknown> = {};
    sectionSettings.forEach((value, k) => {
      result[k] = value;
    });
    return result as T;
  }

  /**
   * 設定値を更新
   */
  async update(
    section: string,
    key: string | undefined,
    value: unknown,
    _target: 'global' | 'workspace', // テストではtargetは無視
  ): Promise<boolean> {
    try {
      let sectionSettings = this.settings.get(section);
      if (!sectionSettings) {
        sectionSettings = new Map();
        this.settings.set(section, sectionSettings);
      }

      if (key) {
        sectionSettings.set(key, value);
      } else {
        // keyが指定されていない場合は、セクション全体を更新
        sectionSettings.clear();
        if (value && typeof value === 'object') {
          Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
            sectionSettings!.set(k, v);
          });
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * テスト用：全設定をクリア
   */
  clear(): void {
    this.settings.clear();
    // デフォルト設定を再初期化
    this.settings.set('files', new Map([['exclude', {}]]));
  }

  /**
   * テスト用：設定を直接セット
   */
  setSettings(section: string, key: string, value: unknown): void {
    let sectionSettings = this.settings.get(section);
    if (!sectionSettings) {
      sectionSettings = new Map();
      this.settings.set(section, sectionSettings);
    }
    sectionSettings.set(key, value);
  }
}