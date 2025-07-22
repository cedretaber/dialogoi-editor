import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent } from '../test-utils';
import { ReviewSection } from './ReviewSection';
import assert from 'assert';
import type { ReviewCount } from '../types/FileDetails';

suite('ReviewSection コンポーネント', () => {
  let mockReviewCount: ReviewCount;

  setup(() => {
    // 各テスト前にモックデータをリセット
    mockReviewCount = {
      open: 3,
      in_progress: 2,
      resolved: 5,
      dismissed: 1,
    };
  });

  suite('基本表示', () => {
    test('セクションヘッダーが表示される', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      assert(screen.getByText('レビュー (11件)'));
    });

    test('レビュー統計が正しく表示される', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      assert(screen.getByText('未対応:'));
      assert(screen.getByText('3'));
      assert(screen.getByText('対応中:'));
      assert(screen.getByText('2'));
      assert(screen.getByText('解決済み:'));
      assert(screen.getByText('5'));
    });

    test('レビュー件数の計算が正しく行われる', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      // 総件数 = open(3) + in_progress(2) + resolved(5) + dismissed(1) = 11
      assert(screen.getByText('レビュー (11件)'));
    });

    test('各統計項目が正しい構造で表示される', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      const openStat = screen.getByText('未対応:').closest('.review-stat');
      assert(openStat);
      const openCount = openStat?.querySelector('.review-count');
      assert(openCount);
      assert.strictEqual(openCount.textContent, '3');

      const inProgressStat = screen.getByText('対応中:').closest('.review-stat');
      assert(inProgressStat);
      const inProgressCount = inProgressStat?.querySelector('.review-count');
      assert(inProgressCount);
      assert.strictEqual(inProgressCount.textContent, '2');

      const resolvedStat = screen.getByText('解決済み:').closest('.review-stat');
      assert(resolvedStat);
      const resolvedCount = resolvedStat?.querySelector('.review-count');
      assert(resolvedCount);
      assert.strictEqual(resolvedCount.textContent, '5');
    });
  });

  suite('展開・折りたたみ機能', () => {
    test('初期状態では展開されている', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      // 統計が見えている = 展開されている
      assert(screen.getByText('未対応:'));
      assert(screen.getByText('対応中:'));
      assert(screen.getByText('解決済み:'));
    });

    test('ヘッダーをクリックすると折りたたまれる', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      const header = screen.getByText('レビュー (11件)').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('レビュー (11件)')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });

    test('折りたたみ状態でヘッダーをクリックすると展開される', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      const header = screen.getByText('レビュー (11件)').closest('button');
      assert(header);

      // 一度折りたたむ
      fireEvent.click(header);

      // 再度クリックして展開
      fireEvent.click(header);

      // 展開状態の確認
      const content = screen
        .getByText('レビュー (11件)')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(!content?.classList.contains('collapsed'));
    });

    test('シェブロンアイコンの状態が正しく切り替わる', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      const chevron = screen
        .getByText('レビュー (11件)')
        .closest('button')
        ?.querySelector('.section-chevron');
      assert(chevron);

      // 初期状態（展開）
      assert(!chevron.classList.contains('collapsed'));

      const header = screen.getByText('レビュー (11件)').closest('button');
      assert(header);

      // 折りたたみ
      fireEvent.click(header);
      assert(chevron.classList.contains('collapsed'));

      // 再展開
      fireEvent.click(header);
      assert(!chevron.classList.contains('collapsed'));
    });
  });

  suite('レビュー件数計算のテスト', () => {
    test('すべての項目が0の場合', () => {
      const emptyReviewCount = { open: 0, in_progress: 0, resolved: 0, dismissed: 0 };
      render(<ReviewSection reviewCount={emptyReviewCount} />);

      assert(screen.getByText('レビュー (0件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('対応中:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('解決済み:').parentElement?.textContent?.includes('0'));
    });

    test('一部の項目のみ値がある場合', () => {
      const partialReviewCount = { open: 2, resolved: 3 };
      render(<ReviewSection reviewCount={partialReviewCount} />);

      assert(screen.getByText('レビュー (5件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('2'));
      assert(screen.getByText('対応中:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('解決済み:').parentElement?.textContent?.includes('3'));
    });

    test('undefined値が混在している場合', () => {
      const undefinedMixedCount = { open: 1, in_progress: undefined, resolved: 2 };
      render(<ReviewSection reviewCount={undefinedMixedCount} />);

      // undefined は 0 として扱われるべき
      assert(screen.getByText('レビュー (3件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('1'));
      assert(screen.getByText('対応中:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('解決済み:').parentElement?.textContent?.includes('2'));
    });

    test('dismissedプロパティも計算に含まれる', () => {
      const reviewCountWithDismissed = {
        open: 1,
        in_progress: 1,
        resolved: 1,
        dismissed: 2,
      };
      render(<ReviewSection reviewCount={reviewCountWithDismissed} />);

      // dismissed は表示されないが、総計には含まれる
      assert(screen.getByText('レビュー (5件)'));
    });
  });

  suite('エッジケース', () => {
    test('空のreviewCountオブジェクトでも正常に動作する', () => {
      const emptyReviewCount = {};
      render(<ReviewSection reviewCount={emptyReviewCount} />);

      assert(screen.getByText('レビュー (0件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('対応中:').parentElement?.textContent?.includes('0'));
      assert(screen.getByText('解決済み:').parentElement?.textContent?.includes('0'));
    });

    test('負の値が含まれている場合も正常に処理される', () => {
      // 実際のアプリケーションでは起こりにくいが、型安全性のテスト
      const negativeReviewCount = { open: -1, in_progress: 2, resolved: 1 };
      render(<ReviewSection reviewCount={negativeReviewCount} />);

      assert(screen.getByText('レビュー (2件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('-1'));
    });

    test('非常に大きな数値でも正常に処理される', () => {
      const largeReviewCount = { open: 999, in_progress: 1000, resolved: 2000 };
      render(<ReviewSection reviewCount={largeReviewCount} />);

      assert(screen.getByText('レビュー (3999件)'));
      assert(screen.getByText('未対応:').parentElement?.textContent?.includes('999'));
      assert(screen.getByText('対応中:').parentElement?.textContent?.includes('1000'));
      assert(screen.getByText('解決済み:').parentElement?.textContent?.includes('2000'));
    });
  });

  suite('アクセシビリティ', () => {
    test('ヘッダーボタンがbutton要素として正しく実装されている', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      const header = screen.getByText('レビュー (11件)').closest('button');
      assert(header);
      assert.strictEqual(header.tagName, 'BUTTON');
      assert.strictEqual(header.getAttribute('type'), 'button');
    });

    test('統計項目の構造が正しい', () => {
      render(<ReviewSection reviewCount={mockReviewCount} />);

      // .review-stats コンテナが存在する
      const statsContainer = screen.getByText('未対応:').closest('.review-stats');
      assert(statsContainer);

      // 各統計項目が .review-stat クラスを持つ
      const statItems = statsContainer?.querySelectorAll('.review-stat');
      assert.strictEqual(statItems?.length, 3);

      // 各統計項目に .review-count クラスの要素が含まれている
      statItems?.forEach((item) => {
        assert(item.querySelector('.review-count'));
      });
    });
  });

  suite('表示されないプロパティのテスト', () => {
    test('dismissedプロパティは表示されないが計算に含まれる', () => {
      const reviewCountWithDismissed = {
        open: 1,
        in_progress: 1,
        resolved: 1,
        dismissed: 5,
      };
      render(<ReviewSection reviewCount={reviewCountWithDismissed} />);

      // dismissed の表示がないことを確認
      assert(!screen.queryByText('dismissed'));
      assert(!screen.queryByText('無視'));
      assert(!screen.queryByText('却下'));

      // しかし総計には含まれている
      assert(screen.getByText('レビュー (8件)'));
    });
  });
});
