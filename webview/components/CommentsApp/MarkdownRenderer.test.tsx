import '@testing-library/jest-dom';
import { render, screen } from '../../test-utils';
import { MarkdownRenderer, calculateTodoProgress } from './MarkdownRenderer';

describe('MarkdownRenderer コンポーネント', () => {
  describe('基本レンダリング機能', () => {
    it('プレーンテキストが正しくレンダリングされる', () => {
      render(<MarkdownRenderer content="プレーンテキストです" />);

      // react-markdownがモックされているため、基本的なレンダリングのみ確認
      expect(screen.getByText('プレーンテキストです')).toBeInTheDocument();
    });

    it('コンテンツが正しく渡される', () => {
      const content = 'テストコンテンツ';
      render(<MarkdownRenderer content={content} />);

      expect(screen.getByText(content)).toBeInTheDocument();
    });

    it('空のコンテンツを処理できる', () => {
      render(<MarkdownRenderer content="" />);

      // エラーなくレンダリングされることを確認
      const container = document.querySelector('.markdown-content');
      expect(container).toBeInTheDocument();
    });

    it('カスタムクラス名が設定される', () => {
      render(<MarkdownRenderer content="テスト" className="custom-markdown" />);

      const container = document.querySelector('.custom-markdown');
      expect(container).toBeInTheDocument();
    });

    it('デフォルトクラス名が設定される', () => {
      render(<MarkdownRenderer content="テスト" />);

      const container = document.querySelector('.markdown-content');
      expect(container).toBeInTheDocument();
    });
  });
});

describe('calculateTodoProgress ユーティリティ関数', () => {
  it('TODOがない場合', () => {
    const content = '通常のテキストです';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('全て未完了のTODO', () => {
    const content = '- [ ] タスク1\n- [ ] タスク2\n- [ ] タスク3';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('全て完了済みのTODO', () => {
    const content = '- [x] タスク1\n- [X] タスク2\n- [x] タスク3';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(3);
    expect(progress.percentage).toBe(100);
  });

  it('一部完了のTODO', () => {
    const content = '- [x] 完了タスク\n- [ ] 未完了タスク1\n- [ ] 未完了タスク2';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(1);
    expect(progress.percentage).toBe(33); // Math.round(1/3 * 100) = 33
  });

  it('異なるリストマーカーでのTODO', () => {
    const content = '* [x] アスタリスク\n+ [ ] プラス\n- [X] ハイフン';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(2);
    expect(progress.percentage).toBe(67); // Math.round(2/3 * 100) = 67
  });

  it('インデントされたTODO', () => {
    const content =
      '  - [x] インデント2スペース\n\t- [ ] インデントタブ\n    - [x] インデント4スペース';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(2);
    expect(progress.percentage).toBe(67);
  });

  it('TODO以外のチェックボックスは無視される', () => {
    const content = 'テキスト [x] これはTODOではない\n- [x] これはTODO\n普通のリスト項目';
    const progress = calculateTodoProgress(content);

    expect(progress.total).toBe(1);
    expect(progress.completed).toBe(1);
    expect(progress.percentage).toBe(100);
  });
});
