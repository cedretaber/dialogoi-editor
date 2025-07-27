/**
 * 統一されたログ出力サービス
 * 開発環境では詳細なログを出力し、本番環境では適切にフィルタリング
 */
export class Logger {
  private static instance: Logger | null = null;
  private debugMode: boolean;

  private constructor() {
    // NODE_ENVでデバッグモードを判定（一時的にデバッグを強制有効化）
    this.debugMode = true;
    // this.debugMode =
    //   process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test';
  }

  /**
   * Logger のシングルトンインスタンスを取得
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * デバッグ情報のログ出力
   * 開発環境でのみ出力される
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.debugMode) {
      // eslint-disable-next-line no-console
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 情報ログの出力
   */
  info(message: string, ...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${message}`, ...args);
  }

  /**
   * 警告ログの出力
   */
  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  /**
   * エラーログの出力
   */
  error(message: string, error?: Error | string, ...args: unknown[]): void {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}`, error.message, error.stack, ...args);
    } else if (error !== undefined) {
      console.error(`[ERROR] ${message}`, error, ...args);
    } else {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * テスト環境での設定リセット
   */
  reset(): void {
    this.debugMode =
      process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test';
  }
}
