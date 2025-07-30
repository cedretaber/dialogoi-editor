import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { CommentItem } from './CommentItem';

// テスト用のサンプルコメント（新データ構造対応）
const createSampleComment = (
  overrides = {},
): {
  id: number;
  target_file: string;
  file_hash: string;
  content: string;
  posted_by: string;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at?: string;
} => ({
  id: 1,
  target_file: 'contents/test.txt#L42',
  file_hash: 'sha256:testHashValue',
  content: 'これはテストコメントです',
  posted_by: 'author',
  status: 'open' as const,
  created_at: '2025-01-24T10:00:00Z',
  ...overrides,
});

describe('CommentItem コンポーネント', () => {
  let mockOnToggleStatus: (index: number) => void;
  let mockOnDelete: (index: number) => void;
  let mockOnEdit: (index: number, content: string) => void;
  let mockOnJumpToLine: (line: number, endLine?: number) => void;
  let callHistory: { method: string; args: unknown[] }[];

  beforeEach(() => {
    callHistory = [];

    mockOnToggleStatus = (index: number): void => {
      callHistory.push({ method: 'onToggleStatus', args: [index] });
    };

    mockOnDelete = (index: number): void => {
      callHistory.push({ method: 'onDelete', args: [index] });
    };

    mockOnEdit = (index: number, content: string): void => {
      callHistory.push({ method: 'onEdit', args: [index, content] });
    };

    mockOnJumpToLine = (line: number, endLine?: number): void => {
      callHistory.push({ method: 'onJumpToLine', args: [line, endLine] });
    };
  });

  describe('基本表示', () => {
    it('コメントが正しく表示される', () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // コメント内容が表示される（react-markdownがモックされているためプレーンテキスト）
      expect(screen.getByText(comment.content)).toBeInTheDocument();

      // ステータスバッジ
      expect(screen.getByText('未完了')).toBeInTheDocument();

      // 作成日時（投稿者情報は現在表示されていない）

      // 作成日時（日本語フォーマット）
      expect(screen.getByText(/2025\/1\/24/)).toBeInTheDocument();
    });

    it('resolvedステータスが正しく表示される', () => {
      const comment = createSampleComment({ status: 'resolved' });

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      expect(screen.getByText('完了')).toBeInTheDocument();
    });

    it('行番号リンクが表示される', () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // 行番号リンク
      expect(screen.getByText('行42')).toBeInTheDocument();
    });

    it('範囲指定の行番号が正しく表示される', () => {
      const comment = createSampleComment({
        target_file: 'contents/test.txt#L10-L15',
      });

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      expect(screen.getByText('行10-15')).toBeInTheDocument();
    });
  });

  describe('ボタン操作', () => {
    it('ステータス切り替えボタンが動作する', () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={2}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      const toggleButton = screen.getByText('完了にする');
      fireEvent.click(toggleButton);

      expect(callHistory).toHaveLength(1);
      expect(callHistory[0]).toEqual({
        method: 'onToggleStatus',
        args: [2],
      });
    });

    it('削除ボタンが動作する', () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={1}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      const deleteButton = screen.getByText('削除');
      fireEvent.click(deleteButton);

      expect(callHistory).toHaveLength(1);
      expect(callHistory[0]).toEqual({
        method: 'onDelete',
        args: [1],
      });
    });

    it('行番号クリックでジャンプ機能が動作する', () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      const lineLink = screen.getByText('行42');
      fireEvent.click(lineLink);

      expect(callHistory).toHaveLength(1);
      expect(callHistory[0]).toEqual({
        method: 'onJumpToLine',
        args: [42, undefined],
      });
    });

    it('範囲指定行番号のクリックが正しく動作する', () => {
      const comment = createSampleComment({
        target_file: 'contents/test.txt#L10-L15',
      });

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      const lineLink = screen.getByText('行10-15');
      fireEvent.click(lineLink);

      expect(callHistory).toHaveLength(1);
      expect(callHistory[0]).toEqual({
        method: 'onJumpToLine',
        args: [10, 15],
      });
    });
  });

  describe('編集機能', () => {
    it('編集ボタンをクリックすると編集モードになる', async () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // コンテンツをクリックして編集モードに
      const previewMode = screen.getByText('これはテストコメントです').closest('.preview-mode');
      if (!previewMode) {
        throw new Error('preview-mode要素が見つかりません');
      }
      fireEvent.click(previewMode);

      // 編集フォームが表示される
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });
    });

    it('編集内容を保存できる', async () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // コンテンツをクリックして編集モードに
      const previewMode = screen.getByText('これはテストコメントです').closest('.preview-mode');
      if (!previewMode) {
        throw new Error('preview-mode要素が見つかりません');
      }
      fireEvent.click(previewMode);

      const textbox = await screen.findByRole('textbox');
      fireEvent.change(textbox, { target: { value: '更新されたコメント' } });

      // onBlurで保存される
      fireEvent.blur(textbox);

      expect(callHistory).toHaveLength(1);
      expect(callHistory[0]).toEqual({
        method: 'onEdit',
        args: [0, '更新されたコメント'],
      });
    });

    it('編集をキャンセルできる', async () => {
      const comment = createSampleComment();

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // コンテンツをクリックして編集モードに
      const previewMode = screen.getByText('これはテストコメントです').closest('.preview-mode');
      if (!previewMode) {
        throw new Error('preview-mode要素が見つかりません');
      }
      fireEvent.click(previewMode);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument();
      });

      const textbox = screen.getByRole('textbox');
      // Escapeキーでキャンセル
      fireEvent.keyDown(textbox, { key: 'Escape' });

      // 編集モードが終了し、元のコンテンツが表示される
      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByText(comment.content)).toBeInTheDocument();
      });

      // onEditは呼ばれない
      expect(callHistory).toHaveLength(0);
    });
  });

  describe('エッジケース', () => {
    it('不正な行番号フォーマットでもエラーにならない', () => {
      const comment = createSampleComment({
        target_file: 'contents/test.txt#invalid',
      });

      expect(() => {
        render(
          <CommentItem
            comment={comment}
            index={0}
            onToggleStatus={mockOnToggleStatus}
            onDelete={mockOnDelete}
            onEdit={mockOnEdit}
            onJumpToLine={mockOnJumpToLine}
          />,
        );
      }).not.toThrow();
    });

    it('空のコメント内容でも表示される', () => {
      const comment = createSampleComment({ content: '' });

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      // コンポーネントがレンダリングされることを確認
      expect(screen.getByText('未完了')).toBeInTheDocument();
    });

    it('長いコメント内容が正しく表示される', () => {
      const longContent = 'これは非常に長いコメントです。'.repeat(10);
      const comment = createSampleComment({ content: longContent });

      render(
        <CommentItem
          comment={comment}
          index={0}
          onToggleStatus={mockOnToggleStatus}
          onDelete={mockOnDelete}
          onEdit={mockOnEdit}
          onJumpToLine={mockOnJumpToLine}
        />,
      );

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });
  });
});
