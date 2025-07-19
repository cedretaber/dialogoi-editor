/* eslint-disable no-console */
import { suite, test, setup, teardown } from 'mocha';
import * as assert from 'assert';
import { Logger } from './Logger.js';

suite('Logger テストスイート', () => {
  let logger: Logger;
  let originalNodeEnv: string | undefined;
  let consoleLogs: string[] = [];
  let consoleWarns: string[] = [];
  let consoleErrors: string[] = [];

  // console メソッドのモック
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  setup(() => {
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

  teardown(() => {
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

  test('シングルトンパターンが正しく動作する', () => {
    const logger1 = Logger.getInstance();
    const logger2 = Logger.getInstance();

    assert.strictEqual(logger1, logger2, 'Loggerインスタンスは同一であるべき');
  });

  test('開発環境でdebugログが出力される', () => {
    process.env['NODE_ENV'] = 'development';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    assert.strictEqual(consoleLogs.length, 1, 'debugログが1つ出力されるべき');
    assert.ok(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[DEBUG] テストデバッグメッセージ'),
      'DEBUG プレフィックスが含まれるべき',
    );
  });

  test('本番環境ではdebugログが出力されない', () => {
    process.env['NODE_ENV'] = 'production';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    assert.strictEqual(consoleLogs.length, 0, 'debugログは出力されないべき');
  });

  test('テスト環境でdebugログが出力される', () => {
    process.env['NODE_ENV'] = 'test';
    logger.reset();

    logger.debug('テストデバッグメッセージ');

    assert.strictEqual(consoleLogs.length, 1, 'debugログが1つ出力されるべき');
    assert.ok(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[DEBUG] テストデバッグメッセージ'),
      'DEBUG プレフィックスが含まれるべき',
    );
  });

  test('infoログが正しく出力される', () => {
    logger.info('情報メッセージ');

    assert.strictEqual(consoleLogs.length, 1, 'infoログが1つ出力されるべき');
    assert.ok(
      consoleLogs[0] !== undefined && consoleLogs[0].includes('[INFO] 情報メッセージ'),
      'INFO プレフィックスが含まれるべき',
    );
  });

  test('warnログが正しく出力される', () => {
    logger.warn('警告メッセージ');

    assert.strictEqual(consoleWarns.length, 1, 'warnログが1つ出力されるべき');
    assert.ok(
      consoleWarns[0] !== undefined && consoleWarns[0].includes('[WARN] 警告メッセージ'),
      'WARN プレフィックスが含まれるべき',
    );
  });

  test('errorログが正しく出力される（エラーオブジェクトなし）', () => {
    logger.error('エラーメッセージ');

    assert.strictEqual(consoleErrors.length, 1, 'errorログが1つ出力されるべき');
    assert.ok(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーメッセージ'),
      'ERROR プレフィックスが含まれるべき',
    );
  });

  test('errorログが正しく出力される（エラーオブジェクト付き）', () => {
    const testError = new Error('テストエラー');
    logger.error('エラーが発生しました', testError);

    assert.strictEqual(consoleErrors.length, 1, 'errorログが1つ出力されるべき');
    assert.ok(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーが発生しました'),
      'ERROR プレフィックスが含まれるべき',
    );
    assert.ok(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('テストエラー'),
      'エラーメッセージが含まれるべき',
    );
  });

  test('errorログが正しく出力される（非Errorオブジェクト付き）', () => {
    logger.error('エラーが発生しました', 'カスタムエラー');

    assert.strictEqual(consoleErrors.length, 1, 'errorログが1つ出力されるべき');
    assert.ok(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('[ERROR] エラーが発生しました'),
      'ERROR プレフィックスが含まれるべき',
    );
    assert.ok(
      consoleErrors[0] !== undefined && consoleErrors[0].includes('カスタムエラー'),
      'カスタムエラーが含まれるべき',
    );
  });

  test('追加の引数が正しく処理される', () => {
    logger.info('メッセージ', 'arg1', 123, { key: 'value' });

    assert.strictEqual(consoleLogs.length, 1, 'infoログが1つ出力されるべき');
    const output = consoleLogs[0];
    assert.ok(
      output !== undefined && output.includes('[INFO] メッセージ'),
      'メインメッセージが含まれるべき',
    );
    assert.ok(output !== undefined && output.includes('arg1'), 'arg1が含まれるべき');
    assert.ok(output !== undefined && output.includes('123'), '数値引数が含まれるべき');
    assert.ok(
      output !== undefined && output.includes('[object Object]'),
      'オブジェクト引数が含まれるべき',
    );
  });
});
