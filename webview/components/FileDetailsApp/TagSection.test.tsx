import '@testing-library/jest-dom';

import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { TagSection } from './TagSection';

describe('TagSection コンポーネント', () => {
  let mockOnTagAdd: (tag: string) => void;
  let mockOnTagRemove: (tag: string) => void;
  let addedTags: string[];
  let removedTags: string[];

  beforeEach(() => {
    // 各テスト前にモック関数をリセット
    addedTags = [];
    removedTags = [];

    mockOnTagAdd = (tag: string): void => {
      addedTags.push(tag);
    };

    mockOnTagRemove = (tag: string): void => {
      removedTags.push(tag);
    };
  });

  describe('基本表示', () => {
    it('タグがない場合は「タグがありません」と表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      expect(screen.getByText('タグがありません')).toBeInTheDocument();
    });

    it('タグがある場合はタグリストが表示される', () => {
      render(
        <TagSection
          tags={['テスト', '小説']}
          onTagAdd={mockOnTagAdd}
          onTagRemove={mockOnTagRemove}
        />,
      );

      expect(screen.getByText('#テスト')).toBeInTheDocument();
      expect(screen.getByText('#小説')).toBeInTheDocument();
    });

    it('入力フィールドが表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');
      expect(input).toBeTruthy();
      expect((input as HTMLInputElement).type).toBe('text');
    });

    it('セクションヘッダーが表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      expect(screen.getByText('タグ')).toBeInTheDocument();
    });
  });

  describe('展開・折りたたみ機能', () => {
    it('初期状態では展開されている', () => {
      render(
        <TagSection tags={['テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      // タグが見えている = 展開されている
      expect(screen.getByText('#テスト')).toBeInTheDocument();
    });

    it('ヘッダーをクリックすると折りたたまれる', () => {
      render(
        <TagSection tags={['テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const header = screen.getByText('タグ').closest('button');
      expect(header).not.toBeNull();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('タグ')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });
  });

  describe('タグ追加機能', () => {
    it('Enterキーでタグを追加できる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '新しいタグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(addedTags).toHaveLength(1);
      expect(addedTags[0]).toBe('新しいタグ');
    });

    it('フォーム送信でタグを追加できる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: 'フォームテスト' } });
      if (form) {
        fireEvent.submit(form);
      }

      expect(addedTags).toHaveLength(1);
      expect(addedTags[0]).toBe('フォームテスト');
    });

    it('前後の空白は自動的にトリムされる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '  トリムテスト  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(addedTags[0]).toBe('トリムテスト');
    });

    it('タグ追加後は入力フィールドがクリアされる', async () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'クリアテスト' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('');
      });
    });

    it('空文字列は追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(addedTags).toHaveLength(0);
    });

    it('空白のみの文字列は追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(addedTags).toHaveLength(0);
    });
  });

  describe('重複チェック機能', () => {
    it('重複するタグは追加されない', () => {
      render(
        <TagSection tags={['既存タグ']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '既存タグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(addedTags).toHaveLength(0);
    });

    it('重複タグ入力後は入力フィールドがクリアされる', async () => {
      render(
        <TagSection tags={['既存タグ']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '既存タグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('');
      });
    });
  });

  describe('タグ削除機能', () => {
    it('削除ボタンをクリックするとタグが削除される', () => {
      render(
        <TagSection tags={['削除テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const deleteButton = screen.getByTitle('タグを削除');
      fireEvent.click(deleteButton);

      expect(removedTags).toHaveLength(1);
      expect(removedTags[0]).toBe('削除テスト');
    });

    it('複数タグがある場合は対応するタグが削除される', () => {
      render(
        <TagSection
          tags={['タグ1', 'タグ2', 'タグ3']}
          onTagAdd={mockOnTagAdd}
          onTagRemove={mockOnTagRemove}
        />,
      );

      // すべての削除ボタンを取得
      const deleteButtons = screen.getAllByTitle('タグを削除');

      // 2番目のタグ（タグ2）を削除
      fireEvent.click(deleteButtons[1]);

      expect(removedTags).toHaveLength(1);
      expect(removedTags[0]).toBe('タグ2');
    });
  });

  describe('プロパティの型チェック', () => {
    it('tagsプロパティが未定義でもエラーにならない', () => {
      // undefined が渡された場合のテスト
      expect(() => {
        render(
          <TagSection tags={undefined} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
        );
      }).not.toThrow();

      expect(screen.getByText('タグがありません')).toBeInTheDocument();
    });

    it('空の配列が渡されても正常に動作する', () => {
      expect(() => {
        render(
          <TagSection tags={undefined} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
        );
      }).not.toThrow();

      expect(screen.getByText('タグがありません')).toBeInTheDocument();
    });
  });

  describe('キーボードイベント', () => {
    it('Enter以外のキーでは何も実行されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(addedTags).toHaveLength(0);
    });

    it('Tabキーでもタグは追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(addedTags).toHaveLength(0);
    });
  });
});
