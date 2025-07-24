import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { TagSection } from './TagSection';
import assert from 'assert';

suite('TagSection コンポーネント', () => {
  let mockOnTagAdd: (tag: string) => void;
  let mockOnTagRemove: (tag: string) => void;
  let addedTags: string[];
  let removedTags: string[];

  setup(() => {
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

  suite('基本表示', () => {
    test('タグがない場合は「タグがありません」と表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      assert(screen.getByText('タグがありません'));
    });

    test('タグがある場合はタグリストが表示される', () => {
      render(
        <TagSection
          tags={['テスト', '小説']}
          onTagAdd={mockOnTagAdd}
          onTagRemove={mockOnTagRemove}
        />,
      );

      assert(screen.getByText('#テスト'));
      assert(screen.getByText('#小説'));
    });

    test('入力フィールドが表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');
      assert(input);
      assert.strictEqual((input as HTMLInputElement).type, 'text');
    });

    test('セクションヘッダーが表示される', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      assert(screen.getByText('タグ'));
    });
  });

  suite('展開・折りたたみ機能', () => {
    test('初期状態では展開されている', () => {
      render(
        <TagSection tags={['テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      // タグが見えている = 展開されている
      assert(screen.getByText('#テスト'));
    });

    test('ヘッダーをクリックすると折りたたまれる', () => {
      render(
        <TagSection tags={['テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const header = screen.getByText('タグ').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('タグ')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });
  });

  suite('タグ追加機能', () => {
    test('Enterキーでタグを追加できる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '新しいタグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      assert.strictEqual(addedTags.length, 1);
      assert.strictEqual(addedTags[0], '新しいタグ');
    });

    test('フォーム送信でタグを追加できる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: 'フォームテスト' } });
      if (form) {
        fireEvent.submit(form);
      }

      assert.strictEqual(addedTags.length, 1);
      assert.strictEqual(addedTags[0], 'フォームテスト');
    });

    test('前後の空白は自動的にトリムされる', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '  トリムテスト  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      assert.strictEqual(addedTags[0], 'トリムテスト');
    });

    test('タグ追加後は入力フィールドがクリアされる', async () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'クリアテスト' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        assert.strictEqual((input as HTMLInputElement).value, '');
      });
    });

    test('空文字列は追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      assert.strictEqual(addedTags.length, 0);
    });

    test('空白のみの文字列は追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      assert.strictEqual(addedTags.length, 0);
    });
  });

  suite('重複チェック機能', () => {
    test('重複するタグは追加されない', () => {
      render(
        <TagSection tags={['既存タグ']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '既存タグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      assert.strictEqual(addedTags.length, 0);
    });

    test('重複タグ入力後は入力フィールドがクリアされる', async () => {
      render(
        <TagSection tags={['既存タグ']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: '既存タグ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        assert.strictEqual((input as HTMLInputElement).value, '');
      });
    });
  });

  suite('タグ削除機能', () => {
    test('削除ボタンをクリックするとタグが削除される', () => {
      render(
        <TagSection tags={['削除テスト']} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />,
      );

      const deleteButton = screen.getByTitle('タグを削除');
      fireEvent.click(deleteButton);

      assert.strictEqual(removedTags.length, 1);
      assert.strictEqual(removedTags[0], '削除テスト');
    });

    test('複数タグがある場合は対応するタグが削除される', () => {
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

      assert.strictEqual(removedTags.length, 1);
      assert.strictEqual(removedTags[0], 'タグ2');
    });
  });

  suite('プロパティの型チェック', () => {
    test('tagsプロパティが未定義でもエラーにならない', () => {
      // undefined が渡された場合のテスト
      assert.doesNotThrow(() => {
        render(<TagSection onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);
      });

      assert(screen.getByText('タグがありません'));
    });

    test('空の配列が渡されても正常に動作する', () => {
      assert.doesNotThrow(() => {
        render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);
      });

      assert(screen.getByText('タグがありません'));
    });
  });

  suite('キーボードイベント', () => {
    test('Enter以外のキーでは何も実行されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      assert.strictEqual(addedTags.length, 0);
    });

    test('Tabキーでもタグは追加されない', () => {
      render(<TagSection tags={[]} onTagAdd={mockOnTagAdd} onTagRemove={mockOnTagRemove} />);

      const input = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください...');

      fireEvent.change(input, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(input, { key: 'Tab' });

      assert.strictEqual(addedTags.length, 0);
    });
  });
});
