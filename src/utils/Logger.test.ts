/* eslint-disable no-console */
import { Logger } from './Logger.js';

describe('Logger テストスイート', () => {
  let logger: Logger;
  let originalNodeEnv: string | undefined;
  let consoleLogs: string[] = [];
  let consoleWarns: string[] = [];
  let consoleErrors: string[] = [];

  // console メソッドのモック
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // 環境変数を保存
    originalNodeEnv = process.env['NODE_ENV'];

    // ログキャプチャ用の配列をリセット
    consoleLogs = [];
    consoleWarns = [];
    consoleErrors = [];

    // console メソッドをモック
    console.log = (...args: unknown[]): void => {
      consoleLogs.push(args.join(' '));
    };
    console.warn = (...args: unknown[]): void => {
      consoleWarns.push(args.join(' '));
    };
    console.error = (...args: unknown[]): void => {
      consoleErrors.push(args.join(' '));
    };

    logger = Logger.getInstance();
  });

  afterEach(() => {
    // console メソッドを復元
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;

    // 環境変数を復元
    if (originalNodeEnv !== undefined) {
      process.env['NODE_ENV'] = originalNodeEnv;
    } else {
      delete process.env['NODE_ENV'];
    }

    // Loggerインスタンスをリセット
    logger.reset();
  });

  it('シングルトンパターンが正しく動作する', () => {
    const logger1 = Logger.getInstance();
    const logger2 = Logger.getInstance();

    expect(logger1).toBe(logger2);
  });

  it('開発環境でdebugログが出力される', () => {
    process.env['NODE_ENV'] = 'development';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    expect(consoleLogs.length).toBe(1);
    expect(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[DEBUG] テストデバッグメッセージ'),
    ).toBeTruthy();
  });

  it('本番環境ではdebugログが出力されない', () => {
    process.env['NODE_ENV'] = 'production';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    expect(consoleLogs.length).toBe(0);
  });

  it('テスト環境でdebugログが出力される', () => {
    process.env['NODE_ENV'] = 'test';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    expect(consoleLogs.length).toBe(1);
    expect(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[DEBUG] テストデバッグメッセージ'),
    ).toBeTruthy();
  });

  it('infoログが正しく出力される', () => {
    logger.info('情報メッセージ');

    expect(consoleLogs.length).toBe(1);
    expect(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[INFO] 情報メッセージ'),
    ).toBeTruthy();
  });

  it('warnログが正しく出力される', () => {
    logger.warn('警告メッセージ');

    expect(consoleWarns.length).toBe(1);
    expect(
      consoleWarns[0] !== undefined && consoleWarns[0].includes('[WARN] 警告メッセージ'),
    ).toBeTruthy();
  });

  it('errorログが正しく出力される（エラーオブジェクトなし）', () => {
    logger.error('エラーメッセージ');

    expect(consoleErrors.length).toBe(1);
    expect(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーメッセージ'),
    ).toBeTruthy();
  });

  it('errorログが正しく出力される（エラーオブジェクト付き）', () => {
    const testError = new Error('テストエラー');
    logger.error('エラーが発生しました', testError);

    expect(consoleErrors.length).toBe(1);
    expect(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーが発生しました'),
    ).toBeTruthy();
    expect(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('テストエラー'),
    ).toBeTruthy();
  });

  it('errorログが正しく出力される（非Errorオブジェクト付き）', () => {
    logger.error('エラーが発生しました', 'カスタムエラー');

    expect(consoleErrors.length).toBe(1);
    expect(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーが発生しました'),
    ).toBeTruthy();
    expect(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('カスタムエラー'),
    ).toBeTruthy();
  });

  it('追加の引数が正しく処理される', () => {
    logger.info('メッセージ', 'arg1', 123, { key: 'value' });

    expect(consoleLogs.length).toBe(1);
    const output = consoleLogs[0];
    expect(output !== undefined && output.includes('[INFO] メッセージ')).toBeTruthy();
    expect(output !== undefined && output.includes('arg1')).toBeTruthy();
    expect(output !== undefined && output.includes('123')).toBeTruthy();
    expect(output !== undefined && output.includes('[object Object]')).toBeTruthy();
  });
});
