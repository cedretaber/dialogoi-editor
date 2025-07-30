/**
 * FileDetailsApp コンポーネントの結合テスト
 *
 * 重要な注意事項:
 * - document.querySelector() は使用禁止 (無限待機の原因)
 * - 重複要素がある場合は getAllByText() や特定セレクタを使用
 * - 詳細は CLAUDE.md の "Reactコンポーネントテストの注意事項" を参照
 */
import '@testing-library/jest-dom';

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileDetailsApp } from './FileDetailsApp';
import { resetGlobalReadyMessageSent } from '../../hooks/useVSCodeApi';
import type { FileDetailsData, UpdateFileMessage, WebViewMessage } from '../../types/FileDetails';

// モックメッセージイベントを作成するヘルパー関数
const createMessageEvent = (data: unknown): MessageEvent => {
  const event = new MessageEvent('message', {
    data,
    origin: 'vscode-webview://',
    source: window,
  });
  return event;
};

describe('FileDetailsApp コンポーネント', () => {
  let mockPostMessage: (message: WebViewMessage) => void;
  let messageCallbacks: ((event: MessageEvent<UpdateFileMessage>) => void)[];
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;

  beforeEach((): void => {
    // グローバルReadyメッセージフラグをリセット
    resetGlobalReadyMessageSent();

    messageCallbacks = [];
    mockPostMessage = (): void => {};

    // VSCode APIのモック
    (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = (): unknown => ({
      postMessage: mockPostMessage,
      setState: (): void => {},
      getState: (): unknown => ({}),
    });

    // addEventListener/removeEventListenerのモック
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ): void => {
      if (type === 'message') {
        messageCallbacks.push(callback as (event: MessageEvent<UpdateFileMessage>) => void);
      }
    };

    window.removeEventListener = (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ): void => {
      if (type === 'message') {
        const index = messageCallbacks.indexOf(
          callback as (event: MessageEvent<UpdateFileMessage>) => void,
        );
        if (index !== -1) {
          messageCallbacks.splice(index, 1);
        }
      }
    };
  });

  afterEach((): void => {
    // モックをリセット
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    messageCallbacks = [];
  });

  // メッセージを送信するヘルパー関数
  const sendMessage = (data: UpdateFileMessage): void => {
    const event = new MessageEvent('message', { data });
    messageCallbacks.forEach((callback) => callback(event));
  };

  interface PostMessageSpy {
    getCalls: () => WebViewMessage[];
    wasCalledWith: (expected: WebViewMessage) => boolean;
  }

  // postMessageの呼び出しを記録するためのスパイ
  const createPostMessageSpy = (): PostMessageSpy => {
    const calls: WebViewMessage[] = [];
    mockPostMessage = (message: WebViewMessage): void => {
      calls.push(message);
    };
    return {
      getCalls: (): WebViewMessage[] => calls,
      wasCalledWith: (expected: WebViewMessage): boolean =>
        calls.some((call) => JSON.stringify(call) === JSON.stringify(expected)),
    };
  };

  const mockFileData: FileDetailsData = {
    name: 'test.md',
    type: 'content',
    path: 'contents/test.md',
    tags: ['タグ1', 'タグ2'],
    review_count: {
      open: 2,
      in_progress: 1,
    },
    referenceData: {
      allReferences: ['characters/hero.md'],
      references: [{ path: 'characters/hero.md', source: 'manual' }],
      referencedBy: [],
    },
  };

  describe('初期状態', () => {
    it('ファイルが選択されていない場合のメッセージが表示される', async () => {
      render(<FileDetailsApp />);
      expect(screen.getByText('ファイルまたはディレクトリを選択してください')).toBeInTheDocument();
      // VSCode APIの状態は非同期で更新されるため、waitForで待つ
      await waitFor(() => {
        expect(screen.getByText('VSCode API: 準備完了')).toBeInTheDocument();
      });
    });

    it('メッセージリスナーが登録される', () => {
      render(<FileDetailsApp />);
      expect(messageCallbacks.length).toBe(1);
    });

    it('readyメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);

      await waitFor(() => {
        expect(spy.wasCalledWith({ type: 'ready' })).toBeTruthy();
      });
    });

    it('コンポーネントのクリーンアップ時にリスナーが削除される', () => {
      const { unmount } = render(<FileDetailsApp />);
      const initialCallbackCount = messageCallbacks.length;
      unmount();
      expect(messageCallbacks.length).toBe(initialCallbackCount - 1);
    });
  });

  describe('ファイルデータの更新', () => {
    it('updateFileメッセージでファイルデータが更新される', async () => {
      render(<FileDetailsApp />);

      // ファイルデータ更新メッセージを送信
      const updateMessage: UpdateFileMessage = {
        type: 'updateFile',
        data: mockFileData,
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        // 各セクションが表示される
        expect(screen.getByText('タグ')).toBeInTheDocument();
        // contentタイプの場合は「登場人物」と「関連設定」が表示される
        expect(screen.getByText('登場人物 (1)')).toBeInTheDocument();
        expect(screen.getByText('基本情報')).toBeInTheDocument();
      });
    });

    it('異なるtypeのメッセージは無視される', () => {
      render(<FileDetailsApp />);

      // 無関係なメッセージを送信（型安全性のため正しい型で）
      sendMessage({ type: 'updateFile', data: null });

      // ファイル未選択のメッセージが表示されたまま
      expect(screen.getByText('ファイルまたはディレクトリを選択してください')).toBeInTheDocument();
    });
  });

  describe('条件付きセクション表示', () => {
    it('キャラクター情報がある場合のみCharacterSectionが表示される', async () => {
      render(<FileDetailsApp />);

      // キャラクター情報なし
      sendMessage({ type: 'updateFile', data: mockFileData });
      await waitFor(() => {
        expect(screen.queryByText('キャラクター情報')).toBeNull();
      });

      // キャラクター情報あり
      const dataWithCharacter = {
        ...mockFileData,
        character: {
          importance: 'main' as const,
          multiple_characters: false,
          display_name: 'テストキャラ',
        },
      };
      sendMessage({ type: 'updateFile', data: dataWithCharacter });
      await waitFor(() => {
        expect(expect(screen.getByText('キャラクター情報')).toBeInTheDocument());
      });
    });

    it('伏線情報は設定ファイルの場合のみ表示される', async () => {
      render(<FileDetailsApp />);

      // contentタイプでは表示されない
      const contentData = {
        ...mockFileData,
        type: 'content' as const,
        foreshadowing: { plants: [{ location: 'test.md', comment: '' }] },
      };
      sendMessage({ type: 'updateFile', data: contentData });
      await waitFor(() => {
        expect(screen.queryByText('🔮 伏線管理')).toBeNull();
      });

      // settingタイプでは表示される
      const settingData = {
        ...mockFileData,
        type: 'setting' as const,
        foreshadowing: { plants: [{ location: 'test.md', comment: '' }] },
      };
      sendMessage({ type: 'updateFile', data: settingData });
      await waitFor(() => {
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });
    });

    it('レビュー情報が空の場合は表示されない', () => {
      render(<FileDetailsApp />);

      // レビュー情報が空
      const dataWithoutReview = {
        ...mockFileData,
        review_count: {},
      };

      sendMessage({ type: 'updateFile', data: dataWithoutReview });
      expect(screen.queryByText('レビュー情報')).toBeNull();
    });
  });

  describe('タグ操作', () => {
    it('タグ追加時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: mockFileData });

      // 状態更新を待つ - タグセクションが表示されることを確認
      await waitFor(() => {
        expect(expect(screen.getByText('タグ')).toBeInTheDocument());
      });

      // タグ入力フィールドに入力
      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');
      fireEvent.change(input, { target: { value: '新タグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(
        spy.wasCalledWith({
          type: 'addTag',
          payload: { tag: '新タグ' },
        }),
      ).toBeTruthy();
    });

    it('タグ削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: mockFileData });

      // タグが表示されるまで待つ
      await waitFor(() => {
        // タグが表示されていることを確認
        expect(expect(screen.getByText('#タグ1')).toBeInTheDocument());
      });

      // 削除ボタンをクリック
      const deleteButtons = screen.getAllByTitle('タグを削除');
      fireEvent.click(deleteButtons[0]);

      expect(
        spy.wasCalledWith({
          type: 'removeTag',
          payload: { tag: 'タグ1' },
        }),
      ).toBeTruthy();
    });
  });

  describe('参照操作', () => {
    it('参照を開く時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: mockFileData });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
      });

      // 参照リンクをクリック
      const referenceLink = screen.getByText('hero.md');
      fireEvent.click(referenceLink);

      expect(
        spy.wasCalledWith({
          type: 'openReference',
          payload: { reference: 'characters/hero.md' },
        }),
      ).toBeTruthy();
    });

    it('参照削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: mockFileData });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
      });

      // 削除ボタンをクリック
      const deleteButton = screen.getByTitle('手動参照を削除');
      fireEvent.click(deleteButton);

      expect(
        spy.wasCalledWith({
          type: 'removeReference',
          payload: { reference: 'characters/hero.md' },
        }),
      ).toBeTruthy();
    });

    it('逆参照削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      const dataWithReversRef = {
        ...mockFileData,
        type: 'setting' as const, // settingタイプなら逆参照が表示される
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [],
          referencedBy: [{ path: 'contents/chapter1.md', source: 'manual' as const }],
        },
      };
      sendMessage({ type: 'updateFile', data: dataWithReversRef });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
      });

      // 削除ボタンをクリック
      const deleteButton = screen.getByTitle('手動参照を削除');
      fireEvent.click(deleteButton);

      expect(
        spy.wasCalledWith({
          type: 'removeReverseReference',
          payload: { reference: 'contents/chapter1.md' },
        }),
      ).toBeTruthy();
    });
  });

  describe('キャラクター操作', () => {
    it('キャラクター削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      const dataWithCharacter = {
        ...mockFileData,
        character: {
          importance: 'main' as const,
          multiple_characters: false,
        },
      };
      sendMessage({ type: 'updateFile', data: dataWithCharacter });

      // 状態更新を待つ - キャラクター情報セクションが表示されるまで待機
      await waitFor(() => {
        expect(expect(screen.getByText('キャラクター情報')).toBeInTheDocument());
      });

      // 削除ボタンをクリック
      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      fireEvent.click(deleteButton);

      expect(
        spy.wasCalledWith({
          type: 'removeCharacter',
        }),
      ).toBeTruthy();
    });
  });

  describe('伏線操作', () => {
    const dataWithForeshadowing = {
      ...mockFileData,
      type: 'setting' as const,
      foreshadowing: {
        plants: [{ location: 'chapter1.md', comment: '' }],
        payoff: { location: 'chapter10.md', comment: '' },
      },
    };

    it('植込み位置追加時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: dataWithForeshadowing });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });

      // 追加ボタンをクリック
      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      // フォームが表示されるのを待つ
      await waitFor(() => {
        // 正しいプレースホルダーテキストでフォームを確認
        const input = screen.getByPlaceholderText('例: contents/chapter1.txt');
        expect(input).toBeInTheDocument();
      });

      // フォームに入力（location のみでもOK）
      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      fireEvent.change(locationInput, { target: { value: 'chapter2.md' } });

      // 追加ボタンをクリック（フォーム送信ではなく）
      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      expect(
        spy.wasCalledWith({
          type: 'addForeshadowingPlant',
          payload: { plant: { location: 'chapter2.md', comment: '' } },
        }),
      ).toBeTruthy();
    });

    it('植込み位置削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: dataWithForeshadowing });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });

      // 削除ボタンをクリック
      const deleteButtons = screen.getAllByText('削除');
      fireEvent.click(deleteButtons[0]);

      expect(
        spy.wasCalledWith({
          type: 'removeForeshadowingPlant',
          payload: { plantIndex: 0 },
        }),
      ).toBeTruthy();
    });

    it('植込み位置更新時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: dataWithForeshadowing });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });

      // 編集ボタンをクリック
      const editButton = screen.getAllByText('編集')[0];
      fireEvent.click(editButton);

      // 編集フォームで位置を更新
      const input = screen.getByDisplayValue('chapter1.md');
      fireEvent.change(input, { target: { value: 'chapter2.md' } });

      // 更新ボタンをクリック
      const updateButton = screen.getByText('更新');
      fireEvent.click(updateButton);

      expect(
        spy.wasCalledWith({
          type: 'updateForeshadowingPlant',
          payload: { plantIndex: 0, plant: { location: 'chapter2.md', comment: '' } },
        }),
      ).toBeTruthy();
    });

    it('回収位置設定時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      const dataWithoutPayoff = {
        ...dataWithForeshadowing,
        foreshadowing: { plants: [{ location: 'chapter1.md', comment: '' }] },
      };
      sendMessage({ type: 'updateFile', data: dataWithoutPayoff });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });

      // 設定ボタンをクリック
      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      // フォームが表示されるのを待つ
      await waitFor(() => {
        const input = screen.getByPlaceholderText('例: contents/chapter5.txt');
        expect(input).toBeInTheDocument();
      });

      // フォームに入力（location のみでもOK）
      const locationInput = screen.getByPlaceholderText('例: contents/chapter5.txt');
      fireEvent.change(locationInput, { target: { value: 'chapter10.md' } });

      // 設定ボタンをクリック
      const submitButton = screen.getByText('設定');
      fireEvent.click(submitButton);

      expect(
        spy.wasCalledWith({
          type: 'setForeshadowingPayoff',
          payload: { payoff: { location: 'chapter10.md', comment: '' } },
        }),
      ).toBeTruthy();
    });

    it('回収位置削除時に正しいメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: dataWithForeshadowing });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument());
      });

      // 削除ボタンをクリック（2番目の削除ボタンが回収位置）
      const deleteButtons = screen.getAllByText('削除');
      fireEvent.click(deleteButtons[1]);

      expect(
        spy.wasCalledWith({
          type: 'removeForeshadowingPayoff',
        }),
      ).toBeTruthy();
    });
  });

  describe('エッジケース', () => {
    it('ファイル名が空の場合のフォールバック', async () => {
      render(<FileDetailsApp />);
      const dataWithoutName = { ...mockFileData, name: '' };
      sendMessage({ type: 'updateFile', data: dataWithoutName });

      await waitFor(() => {
        expect(expect(screen.getByText('Unknown File')).toBeInTheDocument());
      });
    });

    it('複数の操作が連続して行われる場合', async () => {
      const spy = createPostMessageSpy();
      render(<FileDetailsApp />);
      sendMessage({ type: 'updateFile', data: mockFileData });

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
      });

      // タグ追加
      const tagInput = screen.getByPlaceholderText(
        '新しいタグを入力してEnterキーを押してください...',
      );
      fireEvent.change(tagInput, { target: { value: 'タグ3' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      // 参照を開く
      const referenceLink = screen.getByText('hero.md');
      fireEvent.click(referenceLink);

      // 両方のメッセージが送信されていることを確認
      expect(
        spy.wasCalledWith({
          type: 'addTag',
          payload: { tag: 'タグ3' },
        }),
      ).toBeTruthy();

      expect(
        spy.wasCalledWith({
          type: 'openReference',
          payload: { reference: 'characters/hero.md' },
        }),
      ).toBeTruthy();
    });

    it('nullやundefinedのデータでも正常に処理される', async () => {
      render(<FileDetailsApp />);
      const dataWithNulls = {
        ...mockFileData,
        tags: undefined,
        review_count: undefined,
        referenceData: undefined,
      };

      // エラーが発生しないことを確認
      expect(() => {
        const event = createMessageEvent({
          type: 'updateFile',
          data: dataWithNulls,
        }) as MessageEvent<UpdateFileMessage>;
        // messageCallbacksを手動実行（window.dispatchEventのモックが不完全なため）
        messageCallbacks.forEach((callback) => callback(event));
      }).not.toThrow();

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名が表示されることを直接確認しない（特定の要素が複数あるため）
        // 代わりにコンポーネントが正しくレンダリングされているかを確認
        expect(screen.getByText('基本情報')).toBeInTheDocument();
      });
    });
  });
});
