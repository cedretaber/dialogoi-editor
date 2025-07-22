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
  postMessage: (_message: unknown): void => {
    // テスト時はpostMessageを記録できるよう空の実装
    // 本番環境では実際のメッセージ送信が行われる
  },
  setState: (_state: unknown): void => {
    // テスト時の状態管理モック
    // 本番環境では実際の状態保存が行われる
  },
  getState: (): unknown => {
    // テスト時の状態取得モック
    return {};
  },
});
