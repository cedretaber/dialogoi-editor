import { suite, test } from 'mocha';
import { render } from '../../test-utils';
import assert from 'assert';
import { MarkdownRenderer, calculateTodoProgress } from './MarkdownRenderer';

suite('MarkdownRenderer コンポーネント', () => {
  suite('基本レンダリング機能', () => {
    test('プレーンテキストが正しくレンダリングされる', () => {
      render(<MarkdownRenderer content="プレーンテキストです" />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');
      assert(
        container.textContent?.includes('プレーンテキストです'),
        'プレーンテキストが含まれていません',
      );
    });

    test('基本的なマークダウンが正しくレンダリングされる', () => {
      const content = '**太字**と*斜体*と`コード`のテスト';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      // 各要素の存在確認
      const strongElement = container.querySelector('strong');
      const emElement = container.querySelector('em');
      const codeElement = container.querySelector('code');

      assert(
        strongElement && strongElement.textContent === '太字',
        '太字要素が正しくレンダリングされていません',
      );
      assert(
        emElement && emElement.textContent === '斜体',
        '斜体要素が正しくレンダリングされていません',
      );
      assert(
        codeElement && codeElement.textContent === 'コード',
        'コード要素が正しくレンダリングされていません',
      );
    });

    test('リストが正しくレンダリングされる', () => {
      const content = '- アイテム1\n- アイテム2\n- アイテム3';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const ulElement = container.querySelector('ul');
      assert(ulElement, 'ul要素が見つかりません');

      const liElements = ulElement.querySelectorAll('li');
      assert(liElements.length === 3, 'li要素の数が正しくありません');
      assert(liElements[0].textContent === 'アイテム1', '最初のリスト項目が正しくありません');
      assert(liElements[1].textContent === 'アイテム2', '二番目のリスト項目が正しくありません');
      assert(liElements[2].textContent === 'アイテム3', '三番目のリスト項目が正しくありません');
    });

    test('番号付きリストが正しくレンダリングされる', () => {
      const content = '1. 第一項目\n2. 第二項目\n3. 第三項目';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const olElement = container.querySelector('ol');
      assert(olElement, 'ol要素が見つかりません');

      const liElements = olElement.querySelectorAll('li');
      assert(liElements.length === 3, 'li要素の数が正しくありません');
      assert(liElements[0].textContent === '第一項目', '第一項目が正しくありません');
      assert(liElements[1].textContent === '第二項目', '第二項目が正しくありません');
      assert(liElements[2].textContent === '第三項目', '第三項目が正しくありません');
    });

    test('コードブロックが正しくレンダリングされる', () => {
      const content = '```javascript\nconst test = "hello";\nconsole.log(test);\n```';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const preElement = container.querySelector('pre');
      const codeElement = container.querySelector('pre code');

      assert(preElement, 'pre要素が見つかりません');
      assert(codeElement, 'code要素が見つかりません');
      assert(
        codeElement.textContent?.includes('const test = "hello";'),
        'コードブロックの内容が正しくありません',
      );
      assert(
        codeElement.textContent?.includes('console.log(test);'),
        'コードブロックの内容が正しくありません',
      );
    });

    test('インラインコードが正しくレンダリングされる', () => {
      const content = 'ここに`インラインコード`があります';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const codeElement = container.querySelector('code');
      assert(codeElement, 'code要素が見つかりません');
      assert(
        codeElement.textContent === 'インラインコード',
        'インラインコードの内容が正しくありません',
      );

      // react-markdownではインラインコードでもpre/codeの構造になることがある
      // コードが正しく表示されていることを確認
      assert(
        container.textContent?.includes('インラインコード'),
        'インラインコードのテキストが表示されていません',
      );
    });
  });

  suite('TODOチェックボックス機能', () => {
    test('未チェックのTODOアイテムが正しくレンダリングされる', () => {
      const content = '- [ ] 未完了のタスク\n- [x] 完了済みのタスク';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      assert(checkboxes.length === 2, 'チェックボックスの数が正しくありません');

      // 最初のチェックボックスは未チェック
      assert(
        !(checkboxes[0] as HTMLInputElement).checked,
        '最初のチェックボックスがチェックされています',
      );
      // 二番目のチェックボックスはチェック済み
      assert(
        (checkboxes[1] as HTMLInputElement).checked,
        '二番目のチェックボックスがチェックされていません',
      );
    });

    test('チェックボックスは無効化されていてクリックできない', () => {
      const content = '- [ ] 未完了タスク1\n- [ ] 未完了タスク2\n- [x] 完了済みタスク';

      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      assert(checkboxes.length === 3, 'チェックボックスの数が正しくありません');

      // 全てのチェックボックスが無効化されていることを確認
      checkboxes.forEach((checkbox, index) => {
        const input = checkbox as HTMLInputElement;
        assert(input.disabled === true, `チェックボックス${index}が無効化されていません`);
        assert(input.readOnly === true, `チェックボックス${index}がreadOnlyになっていません`);
      });
    });

    test('TODOアイテムにtask-list-itemクラスが付与される', () => {
      const content = '- [ ] タスク1\n- 通常のリスト項目';
      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      const liElements = container.querySelectorAll('li');
      assert(liElements.length === 2, 'li要素の数が正しくありません');

      // react-markdownではTODOアイテムにtask-list-itemクラスが付与される
      assert(
        liElements[0].classList.contains('task-list-item'),
        '最初のli要素にtask-list-itemクラスが付与されていません',
      );
      // 二番目のli要素には付与されない
      assert(
        !liElements[1].classList.contains('task-list-item'),
        '二番目のli要素にtask-list-itemクラスが付与されています',
      );
    });

    test('チェックボックスが無効化されてレンダリングされる', () => {
      const content = '- [ ] テストタスク';

      render(<MarkdownRenderer content={content} />);

      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      assert(checkbox, 'チェックボックス要素が見つかりません');

      // チェックボックスが無効化されていることを確認
      assert(checkbox.disabled, 'チェックボックスがdisabledになっていません');
      assert(checkbox.readOnly, 'チェックボックスがreadOnlyになっていません');
      assert(checkbox.type === 'checkbox', 'チェックボックスのタイプが正しくありません');
    });

    test('TODOチェックボックスの状態が正しく表示される', () => {
      const content = '- [ ] タスク1\n- [x] タスク2';

      render(<MarkdownRenderer content={content} />);

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      assert(checkboxes.length === 2, 'チェックボックスの数が正しくありません');

      // 最初のチェックボックスは未チェック
      assert(
        !(checkboxes[0] as HTMLInputElement).checked,
        '最初のチェックボックスがチェックされています',
      );
      // 二番目のチェックボックスはチェック済み
      assert(
        (checkboxes[1] as HTMLInputElement).checked,
        '二番目のチェックボックスがチェックされていません',
      );
    });
  });

  suite('カスタムクラス名', () => {
    test('デフォルトのクラス名が設定される', () => {
      render(<MarkdownRenderer content="テスト" />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');
    });

    test('カスタムクラス名が設定される', () => {
      render(<MarkdownRenderer content="テスト" className="custom-markdown" />);

      const container = document.querySelector('.custom-markdown');
      assert(container, 'カスタムクラス名の要素が見つかりません');

      // デフォルトクラスは存在しない
      const defaultContainer = document.querySelector('.markdown-content');
      assert(!defaultContainer, 'デフォルトクラス名の要素が存在しています');
    });
  });

  suite('エッジケース', () => {
    test('空の内容を処理できる', () => {
      render(<MarkdownRenderer content="" />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');
    });

    test('複雑なマークダウンを処理できる', () => {
      const content = `# 見出し1
      
## 見出し2

**太字**と*斜体*のテキスト

- [ ] TODOアイテム1
- [x] 完了済みアイテム
- 通常のリスト項目

\`\`\`typescript
const test: string = "hello";
console.log(test);
\`\`\`

インライン\`コード\`もあります。`;

      render(<MarkdownRenderer content={content} />);

      const container = document.querySelector('.markdown-content');
      assert(container, 'markdown-contentクラスの要素が見つかりません');

      // 各要素の存在確認
      assert(container.querySelector('h1'), 'h1要素が見つかりません');
      assert(container.querySelector('h2'), 'h2要素が見つかりません');
      assert(container.querySelector('strong'), 'strong要素が見つかりません');
      assert(container.querySelector('em'), 'em要素が見つかりません');
      assert(
        container.querySelector('input[type="checkbox"]'),
        'チェックボックス要素が見つかりません',
      );
      assert(container.querySelector('pre code'), 'コードブロック要素が見つかりません');
      assert(container.querySelector('li.task-list-item'), 'TODOアイテム要素が見つかりません');
    });

    test('コールバック関数なしでも動作する', () => {
      const content = '- [ ] テストタスク';

      // エラーなく表示される
      render(<MarkdownRenderer content={content} />);

      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
      assert(checkbox, 'チェックボックス要素が見つかりません');

      // チェックボックスが正しく表示されることを確認
      assert(checkbox.type === 'checkbox', 'チェックボックスのタイプが正しくありません');
    });
  });
});

suite('calculateTodoProgress ユーティリティ関数', () => {
  test('TODOがない場合', () => {
    const content = '通常のテキストです';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 0, '総タスク数が正しくありません');
    assert(progress.completed === 0, '完了タスク数が正しくありません');
    assert(progress.percentage === 0, '進捗パーセンテージが正しくありません');
  });

  test('全て未完了のTODO', () => {
    const content = '- [ ] タスク1\n- [ ] タスク2\n- [ ] タスク3';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 3, '総タスク数が正しくありません');
    assert(progress.completed === 0, '完了タスク数が正しくありません');
    assert(progress.percentage === 0, '進捗パーセンテージが正しくありません');
  });

  test('全て完了済みのTODO', () => {
    const content = '- [x] タスク1\n- [X] タスク2\n- [x] タスク3';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 3, '総タスク数が正しくありません');
    assert(progress.completed === 3, '完了タスク数が正しくありません');
    assert(progress.percentage === 100, '進捗パーセンテージが正しくありません');
  });

  test('一部完了のTODO', () => {
    const content = '- [x] 完了タスク\n- [ ] 未完了タスク1\n- [ ] 未完了タスク2';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 3, '総タスク数が正しくありません');
    assert(progress.completed === 1, '完了タスク数が正しくありません');
    assert(progress.percentage === 33, '進捗パーセンテージが正しくありません'); // Math.round(1/3 * 100) = 33
  });

  test('異なるリストマーカーでのTODO', () => {
    const content = '* [x] アスタリスク\n+ [ ] プラス\n- [X] ハイフン';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 3, '総タスク数が正しくありません');
    assert(progress.completed === 2, '完了タスク数が正しくありません');
    assert(progress.percentage === 67, '進捗パーセンテージが正しくありません'); // Math.round(2/3 * 100) = 67
  });

  test('インデントされたTODO', () => {
    const content =
      '  - [x] インデント2スペース\n\t- [ ] インデントタブ\n    - [x] インデント4スペース';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 3, '総タスク数が正しくありません');
    assert(progress.completed === 2, '完了タスク数が正しくありません');
    assert(progress.percentage === 67, '進捗パーセンテージが正しくありません');
  });

  test('TODO以外のチェックボックスは無視される', () => {
    const content = 'テキスト [x] これはTODOではない\n- [x] これはTODO\n普通のリスト項目';
    const progress = calculateTodoProgress(content);

    assert(progress.total === 1, '総タスク数が正しくありません');
    assert(progress.completed === 1, '完了タスク数が正しくありません');
    assert(progress.percentage === 100, '進捗パーセンテージが正しくありません');
  });
});
