import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { CommentsApp } from './CommentsApp';
import { resetGlobalReadyMessageSent } from '../../hooks/useVSCodeApi';

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

describe('CommentsApp コンポーネント', () => {
  let mockPostMessage: (message: unknown) => void;
  let postedMessages: unknown[];

  beforeEach(() => {
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

    // window.confirm のモック
    // eslint-disable-next-line no-undef
    global.confirm = (): boolean => true;
  });

  describe('初期表示とマウント', () => {
    it('初期状態では適切な要素が表示される', () => {
      render(<CommentsApp />);

      // ヘッダーの確認
      expect(screen.getByText('コメント・TODO')).toBeInTheDocument();
      // ファイル未選択状態の確認
      expect(screen.getByText('ファイルを選択してください')).toBeInTheDocument();
      // コメント追加ボタンの確認
      expect(screen.getByText('+ コメントを追加')).toBeInTheDocument();
    });

    it('コンポーネントマウント時にreadyメッセージが送信される', async () => {
      render(<CommentsApp />);

      await waitFor(() => {
        expect(postedMessages.length).toBe(1);
        expect(postedMessages[0]).toEqual({ type: 'ready' });
      });
    });
  });

  describe('VSCodeメッセージ受信処理', () => {
    it('updateCommentsメッセージを受信してファイル情報を表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              id: 1,
              target_file: 'test.md#L1',
              file_hash: 'sha256:abc123',
              content: 'テストコメント',
              posted_by: 'test-user',
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
        expect(screen.getByText('test.md')).toBeInTheDocument();
        // コメント内容の表示確認
        expect(screen.getByText('テストコメント')).toBeInTheDocument();
        // 行番号の表示確認
        expect(screen.getByText('行1')).toBeInTheDocument();
      });
    });

    it('コメントがない場合の表示', async () => {
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
        expect(screen.getByText('empty.md')).toBeInTheDocument();
        // コメントなしの表示確認
        expect(screen.getByText('コメントはありません')).toBeInTheDocument();
      });
    });

    it('複数行コメントの表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              id: 1,
              target_file: 'test.md#L5-L8',
              file_hash: 'sha256:abc123',
              content: '複数行コメント',
              posted_by: 'test-user',
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
        expect(screen.getByText('行5-8')).toBeInTheDocument();
      });
    });

    it('解決済みコメントの表示', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              id: 1,
              target_file: 'test.md#L1',
              file_hash: 'sha256:abc123',
              content: '解決済みコメント',
              posted_by: 'test-user',
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
        expect(screen.getByText('✅')).toBeInTheDocument();
        // ボタンテキストの確認
        expect(screen.getByText('未完了に戻す')).toBeInTheDocument();
      });
    });

    it('エラーメッセージの表示', async () => {
      render(<CommentsApp />);

      const errorMessage = {
        type: 'error',
        message: 'テストエラーメッセージ',
      };

      window.dispatchEvent(createMessageEvent(errorMessage));

      await waitFor(() => {
        // エラーメッセージの表示確認
        expect(screen.getByText('エラー: テストエラーメッセージ')).toBeInTheDocument();
      });
    });
  });

  describe('コメント追加機能', () => {
    it('コメント追加ボタンをクリックするとフォームが表示される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      // フォーム要素の確認
      expect(screen.getByLabelText('行番号')).toBeInTheDocument();
      expect(screen.getByLabelText('コメント')).toBeInTheDocument();
      expect(screen.getByText('追加')).toBeInTheDocument();
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    it('有効な値でコメント追加を実行', async () => {
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
        expect(addCommentMessage).toBeTruthy();
        expect(addCommentMessage.payload).toEqual({
          line: 42,
          content: '新しいコメント',
        });
      });

      // フォームがリセットされることを確認
      expect(screen.queryByLabelText('行番号')).toBe(null);
    });

    it('無効な行番号でエラー表示', () => {
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
      expect(screen.getByText('エラー: 有効な行番号を入力してください')).toBeInTheDocument();
    });

    it('空のコメント内容でエラー表示', () => {
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
      expect(screen.getByText('エラー: コメント内容を入力してください')).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームが閉じる', () => {
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
      expect(screen.queryByLabelText('行番号')).toBe(null);
      // 追加ボタンが再表示されることを確認
      expect(screen.getByText('+ コメントを追加')).toBeInTheDocument();
    });
  });

  describe('コメント操作機能', () => {
    const setupCommentsUI = async (): Promise<void> => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              id: 1,
              target_file: 'test.md#L1',
              file_hash: 'sha256:abc123',
              content: '最初のコメント',
              posted_by: 'test-user',
              status: 'open' as const,
              created_at: '2025-01-22T10:00:00Z',
            },
            {
              id: 2,
              target_file: 'test.md#L5',
              file_hash: 'sha256:abc123',
              content: '2番目のコメント',
              posted_by: 'test-user',
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
        expect(screen.getByText('test.md')).toBeInTheDocument();
        expect(screen.getByText('最初のコメント')).toBeInTheDocument();
      });
    };

    it('行ジャンプボタンをクリックしてメッセージ送信', async () => {
      await setupCommentsUI();

      const jumpButtons = screen.getAllByText(/行\d/);
      fireEvent.click(jumpButtons[0]);

      await waitFor(() => {
        const jumpMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'jumpToLine'),
        ) as { type: string; payload: { line: number; endLine?: number } };
        expect(jumpMessage).toBeTruthy();
        expect(jumpMessage.payload).toEqual({
          line: 1,
          endLine: undefined,
        });
      });
    });

    it('ステータス切り替えボタンをクリック', async () => {
      await setupCommentsUI();

      const toggleButtons = screen.getAllByText(/完了にする|未完了に戻す/);
      fireEvent.click(toggleButtons[0]);

      await waitFor(() => {
        const toggleMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'toggleCommentStatus'),
        ) as { type: string; payload: { commentIndex: number } };
        expect(toggleMessage).toBeTruthy();
        expect(toggleMessage.payload).toEqual({
          commentIndex: 0,
        });
      });
    });

    it('削除ボタンをクリック', async () => {
      await setupCommentsUI();

      const deleteButtons = screen.getAllByText('削除');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        const deleteMessage = postedMessages.find((msg: unknown) =>
          isMessageWithType(msg, 'deleteComment'),
        ) as { type: string; payload: { commentIndex: number } };
        expect(deleteMessage).toBeTruthy();
        expect(deleteMessage.payload).toEqual({
          commentIndex: 0,
        });
      });
    });
  });

  describe('日付表示機能', () => {
    it('作成日時が正しく表示される', async () => {
      render(<CommentsApp />);

      const updateMessage = {
        type: 'updateComments',
        data: {
          fileName: 'test.md',
          filePath: '/path/to/test.md',
          comments: [
            {
              id: 1,
              target_file: 'test.md#L1',
              file_hash: 'sha256:abc123',
              content: '日付テスト',
              posted_by: 'test-user',
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
        expect(screen.getByText('日付テスト')).toBeInTheDocument();
      });

      // comment-metaクラスの要素が存在することを確認（waitFor外で実行）
      const commentMeta = document.querySelector('.comment-meta');
      expect(commentMeta).toBeTruthy();
      expect(commentMeta?.textContent && commentMeta.textContent.length > 0).toBeTruthy();
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なメッセージタイプを受信してもエラーにならない', () => {
      render(<CommentsApp />);

      const invalidMessage = {
        type: 'unknown_type',
        data: 'invalid data',
      };

      // エラーが発生しないことを確認
      expect(() => {
        window.dispatchEvent(createMessageEvent(invalidMessage));
      }).not.toThrow();
    });

    it('メッセージデータが不完全でもエラーにならない', () => {
      render(<CommentsApp />);

      const incompleteMessage = {
        type: 'updateComments',
        data: {
          // 一部のプロパティが欠落
          fileName: 'test.md',
        },
      };

      expect(() => {
        window.dispatchEvent(createMessageEvent(incompleteMessage));
      }).not.toThrow();
    });
  });

  describe('入力値バリデーション', () => {
    it('負の行番号は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '-1' } });
      fireEvent.change(contentInput, { target: { value: 'テスト' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      expect(screen.getByText('エラー: 有効な行番号を入力してください')).toBeInTheDocument();
    });

    it('非数値の行番号は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: 'abc' } });
      fireEvent.change(contentInput, { target: { value: 'テスト' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      expect(screen.getByText('エラー: 有効な行番号を入力してください')).toBeInTheDocument();
    });

    it('空白のみのコメント内容は拒否される', () => {
      render(<CommentsApp />);

      const addButton = screen.getByText('+ コメントを追加');
      fireEvent.click(addButton);

      const lineInput = screen.getByLabelText('行番号');
      const contentInput = screen.getByLabelText('コメント');
      fireEvent.change(lineInput, { target: { value: '1' } });
      fireEvent.change(contentInput, { target: { value: '   ' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      expect(screen.getByText('エラー: コメント内容を入力してください')).toBeInTheDocument();
    });
  });

  describe('UI状態管理', () => {
    it('エラー表示後にコメント追加が成功するとエラーがクリアされる', async () => {
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

      expect(screen.getByText('エラー: 有効な行番号を入力してください')).toBeInTheDocument();

      // 正しい値で再試行
      fireEvent.change(lineInput, { target: { value: '1' } });
      submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // エラーがクリアされることを確認
      await waitFor(() => {
        expect(screen.queryByText('エラー: 有効な行番号を入力してください')).toBe(null);
      });
    });

    it('updateCommentsメッセージ受信後にエラーがクリアされる', async () => {
      render(<CommentsApp />);

      // エラーメッセージを表示
      const errorMessage = {
        type: 'error',
        message: 'テストエラー',
      };
      window.dispatchEvent(createMessageEvent(errorMessage));

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByText('エラー: テストエラー')).toBeInTheDocument();
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
        expect(screen.getByText('test.md')).toBeInTheDocument();
      });

      // この時点でエラーがクリアされているはず
      expect(screen.queryByText('エラー: テストエラー')).toBe(null);
    });
  });
});
