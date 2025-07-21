/**
 * 設定管理のための抽象インターフェース
 * VSCode設定へのアクセスを抽象化
 */
export interface SettingsRepository {
  /**
   * 設定値を取得
   * @param section 設定セクション名
   * @param key 設定キー
   * @returns 設定値
   */
  get<T>(section: string, key?: string): T | undefined;

  /**
   * 設定値を更新
   * @param section 設定セクション名
   * @param key 設定キー（値がundefinedの場合はセクション全体を更新）
   * @param value 新しい値
   * @param target 設定ターゲット（Global/Workspace）
   * @returns 成功したかどうか
   */
  update(
    section: string,
    key: string | undefined,
    value: unknown,
    target: 'global' | 'workspace',
  ): Promise<boolean>;
}

/**
 * 設定の除外パターン型
 */
export type ExcludePatterns = { [pattern: string]: boolean };
