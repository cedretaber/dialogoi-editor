import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { CommentsApp } from './CommentsApp';
import { resetGlobalReadyMessageSent } from '../hooks/useVSCodeApi';
import assert from 'assert';

// モックメッセージイベントを作成するヘルパー関数
const createMessageEvent = (data: unknown): MessageEvent => {
  const event = new MessageEvent('message', {
    data,
    origin: 'vscode-webview://',
    source: window,
  });
  return event;
};

// 型ガード関数を定義
const isMessageWithType = (msg: unknown, type: string): boolean => {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as { type: string }).type === type
  );
};

suite('CommentsApp コンポーネント', () => {
  let mockPostMessage: (message: unknown) => void;
  let postedMessages: unknown[];

  setup(() => {
    // 各テスト前にVSCode APIモックをリセット
    resetGlobalReadyMessageSent();
    postedMessages = [];

    // VSCode API のモック
    mockPostMessage = (message: unknown): void => {
      postedMessages.push(message);
    };

    // グローバルなacquireVsCodeApiをモック
    // eslint-disable-next-line no-undef
    global.acquireVsCodeApi = (): {
      postMessage: (message: unknown) => void;
      setState: (state: unknown) => void;
      getState: () => unknown;
    } => ({
      postMessage: mockPostMessage,
      setState: (): void => {},
      getState: (): unknown => ({}),
    });
  });

  suite('初期表示とマウント', () => {
    test('初期状態では適切な要素が表示される', () => {
      render(<CommentsApp />);

      // ヘッダーの確認
      assert(screen.getByText('コメント・TODO'));
      // ファイル未選択状態の確認
      assert(screen.getByText('ファイルを選択してください'));
      // コメント追加ボタンの確認
      assert(screen.getByText('+ コメントを追加'));
    });

    test('コンポーネントマウント時にreadyメッセージが送信される', async () => {
      render(<CommentsApp />);

      await waitFor(() => {
        assert.strictEqual(postedMessages.length, 1);
        assert.deepStrictEqual(postedMessages[0], { type: 'ready' });
      });
    });
  });

  suite('VSCodeメッセージ受信処理', () => {
    test('updateCommentsメッセージを受信してファイル情報を表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              line: 1,
              content: 'テストコメント',
              status: 'open' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
          ],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      // 状態更新を待つ
      await waitFor(() => {
        // ファイル名の表示確認
        assert(screen.getByText('test.md'));
        // コメント内容の表示確認
        assert(screen.getByText('テストコメント'));
        // 行番号の表示確認
        assert(screen.getByText('行1'));
      });
    });

    test('コメントがない場合の表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'empty.md',
          filePath: '/path/to/empty.md',
          comments: [],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      await waitFor(() => {
        // ファイル名の表示確認
        assert(screen.getByText('empty.md'));
        // コメントなしの表示確認
        assert(screen.getByText('コメントはありません'));
      });
    });

    test('複数行コメントの表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              line: 5,
              endLine: 8,
              content: '複数行コメント',
              status: 'open' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
          ],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      await waitFor(() => {
        // 複数行の行番号表示確認
        assert(screen.getByText('行5-8'));
      });
    });

    test('解決済みコメントの表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              line: 1,
              content: '解決済みコメント',
              status: 'resolved' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
          ],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      await waitFor(() => {
        // 解決済みアイコンの確認
        assert(screen.getByText('✅'));
        // ボタンテキストの確認
        assert(screen.getByText('未完了に戻す'));
      });
    });

    test('エラーメッセージの表示', async () => {
      render(<CommentsApp />);

      const errorMessage = {
        type: 'error',
        message: 'テストエラーメッセージ',
      };

      window.dispatchEvent(createMessageEvent(errorMessage));

      await waitFor(() => {
        // エラーメッセージの表示確認
        assert(screen.getByText('エラー: テストエラーメッセージ'));
      });
    });
  });

  suite('コメント追加機能', () => {
    test('コメント追加ボタンをクリックするとフォームが表示される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // フォーム要素の確認
      assert(screen.getByLabelText('行番号'));
      assert(screen.getByLabelText('コメント'));
      assert(screen.getByText('追加'));
      assert(screen.getByText('キャンセル'));
    });

    test('有効な値でコメント追加を実行', async () => {
      render(<CommentsApp />);

      // フォームを表示
      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // 入力値を設定
      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '42' } });
      fireEvent.change(contentInput, { target: { value: '新しいコメント' } });

      // 追加ボタンをクリック
      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // メッセージ送信の確認
      await waitFor(() => {
        const addCommentMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'addComment'),
        ) as { type: string; payload: { line: number; content: string } };
        assert(addCommentMessage);
        assert.deepStrictEqual(addCommentMessage.payload, {
          line: 42,
          content: '新しいコメント',
        });
      });

      // フォームがリセットされることを確認
      assert.strictEqual(screen.queryByLabelText('行番号'), null);
    });

    test('無効な行番号でエラー表示', () => {
      render(<CommentsApp />);

      // フォームを表示
      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // 無効な行番号を入力
      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '0' } });
      fireEvent.change(contentInput, { target: { value: 'テストコメント' } });

      // 追加ボタンをクリック
      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // エラーメッセージの確認
      assert(screen.getByText('エラー: 有効な行番号を入力してください'));
    });

    test('空のコメント内容でエラー表示', () => {
      render(<CommentsApp />);

      // フォームを表示
      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // 行番号のみ入力
      const lineInput = screen.getByLabelText('行番号');
      fireEvent.change(lineInput, { target: { value: '1' } });

      // 追加ボタンをクリック
      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // エラーメッセージの確認
      assert(screen.getByText('エラー: コメント内容を入力してください'));
    });

    test('キャンセルボタンでフォームが閉じる', () => {
      render(<CommentsApp />);

      // フォームを表示
      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // 入力値を設定
      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '10' } });
      fireEvent.change(contentInput, { target: { value: 'キャンセルテスト' } });

      // キャンセルボタンをクリック
      const cancelButton = screen.getByText('キャンセル');
      fireEvent.click(cancelButton);

      // フォームが非表示になることを確認
      assert.strictEqual(screen.queryByLabelText('行番号'), null);
      // 追加ボタンが再表示されることを確認
      assert(screen.getByText('+ コメントを追加'));
    });
  });

  suite('コメント操作機能', () => {
    const setupCommentsUI = async (): Promise<void> => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              line: 1,
              content: '最初のコメント',
              status: 'open' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
            {
              line: 5,
              content: '2番目のコメント',
              status: 'resolved' as const,
              created_at: '2025-01-22T11:00:00Z',
            },
          ],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      // 状態更新を待つ
      await waitFor(() => {
        assert(screen.getByText('test.md'));
        assert(screen.getByText('最初のコメント'));
      });
    };

    test('行ジャンプボタンをクリックしてメッセージ送信', async () => {
      await setupCommentsUI();

      const jumpButtons = screen.getAllByText(/行\d/);
      fireEvent.click(jumpButtons[0]);

      await waitFor(() => {
        const jumpMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'jumpToLine'),
        ) as { type: string; payload: { line: number; endLine?: number } };
        assert(jumpMessage);
        assert.deepStrictEqual(jumpMessage.payload, {
          line: 1,
          endLine: undefined,
        });
      });
    });

    test('ステータス切り替えボタンをクリック', async () => {
      await setupCommentsUI();

      const toggleButtons = screen.getAllByText(/完了にする|未完了に戻す/);
      fireEvent.click(toggleButtons[0]);

      await waitFor(() => {
        const toggleMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'toggleCommentStatus'),
        ) as { type: string; payload: { commentIndex: number } };
        assert(toggleMessage);
        assert.deepStrictEqual(toggleMessage.payload, {
          commentIndex: 0,
        });
      });
    });

    test('削除ボタンをクリック', async () => {
      await setupCommentsUI();

      const deleteButtons = screen.getAllByText('削除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const deleteMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'deleteComment'),
        ) as { type: string; payload: { commentIndex: number } };
        assert(deleteMessage);
        assert.deepStrictEqual(deleteMessage.payload, {
          commentIndex: 0,
        });
      });
    });
  });

  suite('日付表示機能', () => {
    test('作成日時が正しく表示される', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              line: 1,
              content: '日付テスト',
              status: 'open' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
          ],
          isFileChanged: false,
        },
      };

      window.dispatchEvent(createMessageEvent(updateMessage));

      await waitFor(() => {
        // 日付が表示されることを確認（具体的な形式は環境依存のため存在のみ確認）
        // コメント内容が表示されていることを確認
        assert(screen.getByText('日付テスト'));
      });

      // comment-metaクラスの要素が存在することを確認（waitFor外で実行）
      const commentMeta = document.querySelector('.comment-meta');
      assert(commentMeta);
      assert(commentMeta.textContent && commentMeta.textContent.length > 0);
    });
  });

  suite('エラーハンドリング', () => {
    test('不正なメッセージタイプを受信してもエラーにならない', () => {
      render(<CommentsApp />);

      const invalidMessage = {
        type: 'unknown_type',
        data: 'invalid data',
      };

      // エラーが発生しないことを確認
      assert.doesNotThrow(() => {
        window.dispatchEvent(createMessageEvent(invalidMessage));
      });
    });

    test('メッセージデータが不完全でもエラーにならない', () => {
      render(<CommentsApp />);

      const incompleteMessage = {
        type: 'updateComments',
        data: {
          // 一部のプロパティが欠落
          fileName: 'test.md',
        },
      };

      assert.doesNotThrow(() => {
        window.dispatchEvent(createMessageEvent(incompleteMessage));
      });
    });
  });

  suite('入力値バリデーション', () => {
    test('負の行番号は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '-1' } });
      fireEvent.change(contentInput, { target: { value: 'テスト' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert(screen.getByText('エラー: 有効な行番号を入力してください'));
    });

    test('非数値の行番号は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: 'abc' } });
      fireEvent.change(contentInput, { target: { value: 'テスト' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert(screen.getByText('エラー: 有効な行番号を入力してください'));
    });

    test('空白のみのコメント内容は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '1' } });
      fireEvent.change(contentInput, { target: { value: '   ' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert(screen.getByText('エラー: コメント内容を入力してください'));
    });
  });

  suite('UI状態管理', () => {
    test('エラー表示後にコメント追加が成功するとエラーがクリアされる', async () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // まずエラーを発生させる
      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '0' } });
      fireEvent.change(contentInput, { target: { value: 'テスト' } });

      let submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert(screen.getByText('エラー: 有効な行番号を入力してください'));

      // 正しい値で再試行
      fireEvent.change(lineInput, { target: { value: '1' } });
      submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // エラーがクリアされることを確認
      await waitFor(() => {
        assert.strictEqual(screen.queryByText('エラー: 有効な行番号を入力してください'), null);
      });
    });

    test('updateCommentsメッセージ受信後にエラーがクリアされる', async () => {
      render(<CommentsApp />);

      // エラーメッセージを表示
      const errorMessage = {
        type: 'error',
        message: 'テストエラー',
      };
      window.dispatchEvent(createMessageEvent(errorMessage));

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        assert(screen.getByText('エラー: テストエラー'));
      });

      // updateCommentsメッセージを送信
      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [],
          isFileChanged: false,
        },
      };
      window.dispatchEvent(createMessageEvent(updateMessage));

      // エラーがクリアされることを確認（waitForの代わりに直接確認）
      await waitFor(() => {
        // ファイル名が表示されることでupdateCommentsメッセージが処理されたことを確認
        assert(screen.getByText('test.md'));
      });

      // この時点でエラーがクリアされているはず
      assert.strictEqual(screen.queryByText('エラー: テストエラー'), null);
    });
  });
});
