import { useState, useEffect, useRef, useCallback } from 'react';
import type { VSCodeApi } from '../types/FileDetails';

// グローバルレベルでready メッセージの重複送信を防止
let globalReadyMessageSent = false;

// テスト用のリセット関数（テスト環境でのみ使用）
export const resetGlobalReadyMessageSent = (): void => {
  globalReadyMessageSent = false;
};

/**
 * VSCode API の遅延初期化用汎用フック
 * WebViewコンポーネントでVSCode APIとの通信を管理
 */
export const useVSCodeApi = <TMessage = unknown>(
  readyMessage?: TMessage,
): {
  postMessage: (message: TMessage) => boolean;
  isVSCodeReady: boolean;
  getVSCodeApi: () => VSCodeApi | null;
} => {
  const vsCodeRef = useRef<VSCodeApi | null>(null);
  const [isVSCodeReady, setIsVSCodeReady] = useState(false);

  const getVSCodeApi = useCallback((): VSCodeApi | null => {
    if (!vsCodeRef.current) {
      try {
        if (typeof acquireVsCodeApi !== 'undefined') {
          vsCodeRef.current = acquireVsCodeApi();
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }
    return vsCodeRef.current;
  }, []);

  const postMessage = useCallback(
    (message: TMessage): boolean => {
      const api = getVSCodeApi();
      if (api) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
          (api.postMessage as any)(message);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [getVSCodeApi],
  );

  useEffect((): (() => void) => {
    // WebViewが初期化された後にVSCode APIを取得
    const timer = setTimeout(() => {
      const api = getVSCodeApi();
      if (api && !globalReadyMessageSent) {
        setIsVSCodeReady(true);
        // 準備完了を通知（readyMessageが指定されている場合）
        if (readyMessage) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
          (api.postMessage as any)(readyMessage);
          globalReadyMessageSent = true;
        }
      }
    }, 100); // 短い遅延でWebViewの初期化を待つ

    return (): void => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列を空にして初回のみ実行（getVSCodeApiとreadyMessageの依存を意図的に除外）

  return { postMessage, isVSCodeReady, getVSCodeApi };
};
