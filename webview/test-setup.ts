// Happy-DOMを使用してブラウザ環境をグローバルに登録
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import * as React from 'react';

// Happy-DOMでブラウザ環境をシミュレート
GlobalRegistrator.register();

// VSCode APIのモック型定義
interface VSCodeApi {
  postMessage: (message: unknown) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
}

// グローバル型の拡張
declare global {
  var acquireVsCodeApi: () => VSCodeApi;
}

// ReactをグローバルにExport (JSX変換用)
(globalThis as { React?: typeof React }).React = React;

// VSCode APIのモック実装
globalThis.acquireVsCodeApi = (): VSCodeApi => ({
  postMessage: (message: unknown): void => {
    // テスト時はpostMessageを記録できるよう空の実装
    // eslint-disable-next-line no-console
    console.log('Mock postMessage:', message);
  },
  setState: (state: unknown): void => {
    // テスト時の状態管理モック
    // eslint-disable-next-line no-console
    console.log('Mock setState:', state);
  },
  getState: (): unknown => {
    // テスト時の状態取得モック
    return {};
  },
});

// テスト環境設定完了
