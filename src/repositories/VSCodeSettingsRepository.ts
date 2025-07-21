import * as vscode from 'vscode';
import { SettingsRepository } from './SettingsRepository.js';

/**
 * VSCode設定のリポジトリ実装
 */
export class VSCodeSettingsRepository implements SettingsRepository {
  /**
   * 設定値を取得
   */
  get<T>(section: string, key?: string): T | undefined {
    const config = vscode.workspace.getConfiguration(section);
    if (key) {
      return config.get<T>(key);
    }
    // keyが指定されていない場合は、セクション全体の設定を返す
    return config as unknown as T;
  }

  /**
   * 設定値を更新
   */
  async update(
    section: string,
    key: string | undefined,
    value: unknown,
    target: 'global' | 'workspace',
  ): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration(section);
      const configTarget =
        target === 'global'
          ? vscode.ConfigurationTarget.Global
          : vscode.ConfigurationTarget.Workspace;

      if (key) {
        await config.update(key, value, configTarget);
      } else {
        // keyが指定されていない場合は、セクション全体を更新
        // VSCode APIではセクション全体の更新はサポートされていないため、
        // 各キーを個別に更新する
        if (value && typeof value === 'object') {
          for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            await config.update(k, v, configTarget);
          }
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}