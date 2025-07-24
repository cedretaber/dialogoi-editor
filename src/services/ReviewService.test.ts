import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { ReviewService } from './ReviewService.js';
import { CreateReviewOptions } from '../models/Review.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

describe('ReviewService テストスイート', () => {
  let workspaceRootPath: string;
  let reviewService: ReviewService;
  let testRelativeFilePath: string;
  let mockFileRepository: MockFileRepository;

  beforeEach(() => {
    // テスト用サービスコンテナを初期化
    const container = TestServiceContainer.getInstance();
    container.reset();

    // モックファイルサービスを取得
    mockFileRepository = container.getMockFileRepository();

    // テスト用のワークスペースを設定
    workspaceRootPath = '/workspace';
    const workspaceRoot = mockFileRepository.createFileUri(workspaceRootPath);
    reviewService = container.getReviewService(workspaceRoot);
    testRelativeFilePath = 'test.txt';

    // テストファイルを作成
    const fullTestAbsolutePath = path.join(workspaceRootPath, testRelativeFilePath);
    mockFileRepository.addFile(fullTestAbsolutePath, 'Hello, World!\nThis is a test file.\n');
  });

  afterEach(() => {
    // テスト用サービスコンテナをリセット
    TestServiceContainer.getInstance().reset();
  });

  describe('addReview', () => {
    it('新しいレビューを追加する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'これは提案です',
      };

      const reviewIndex = await reviewService.addReviewAsync(testRelativeFilePath, options);

      assert.strictEqual(reviewIndex, 0);

      // レビューファイルが作成されているか確認
      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.target_file, testRelativeFilePath);
        assert.strictEqual(reviewFile.reviews.length, 1);
        assert.strictEqual(reviewFile.reviews[0]?.content, 'これは提案です');
        assert.strictEqual(reviewFile.reviews[0]?.reviewer, 'テスト編集者');
        assert.strictEqual(reviewFile.reviews[0]?.status, 'open');
      }
    });

    it('既存のレビューファイルに追加する', async () => {
      const options1: CreateReviewOptions = {
        line: 1,
        reviewer: '編集者A',
        type: 'human',
        severity: 'warning',
        content: '最初のレビュー',
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '2番目のレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options1);
      const reviewIndex = await reviewService.addReviewAsync(testRelativeFilePath, options2);

      assert.strictEqual(reviewIndex, 1);

      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews.length, 2);
        assert.strictEqual(reviewFile.reviews[1]?.content, '2番目のレビュー');
      }
    });
  });

  describe('loadReviewFile', () => {
    it('存在しないレビューファイルを読み込む', async () => {
      const reviewFile = await reviewService.loadReviewFileAsync('nonexistent.txt');
      assert.strictEqual(reviewFile, null);
    });

    it('レビューファイルを正しく読み込む', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'info',
        content: 'テストレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options);
      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);

      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.target_file, testRelativeFilePath);
        assert.strictEqual(reviewFile.reviews.length, 1);
      }
    });
  });

  describe('updateReview', () => {
    it('レビューのステータスを更新する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options);
      await reviewService.updateReviewAsync(testRelativeFilePath, 0, { status: 'resolved' });

      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews[0]?.status, 'resolved');
      }
    });

    it('レビューのコンテンツを更新する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: '元のレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options);
      await reviewService.updateReviewAsync(testRelativeFilePath, 0, {
        content: '更新されたレビュー',
      });

      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews[0]?.content, '更新されたレビュー');
      }
    });

    it('存在しないレビューファイルを更新しようとするとエラーが発生する', async () => {
      try {
        await reviewService.updateReviewAsync('nonexistent.txt', 0, { status: 'resolved' });
        assert.fail('エラーが発生すべきです');
      } catch (error) {
        assert.ok((error as Error).message.includes('レビューファイルが見つかりません'));
      }
    });

    it('無効なレビューインデックスでエラーが発生する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options);

      try {
        await reviewService.updateReviewAsync(testRelativeFilePath, 999, { status: 'resolved' });
        assert.fail('エラーが発生すべきです');
      } catch (error) {
        assert.ok((error as Error).message.includes('無効なレビューインデックス'));
      }
    });
  });

  describe('deleteReview', () => {
    it('レビューを削除する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options);
      await reviewService.deleteReviewAsync(testRelativeFilePath, 0);

      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile === null); // ファイルが削除されている
    });

    it('複数のレビューから1つを削除する', async () => {
      const options1: CreateReviewOptions = {
        line: 1,
        reviewer: '編集者A',
        type: 'human',
        severity: 'warning',
        content: '最初のレビュー',
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '2番目のレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options1);
      await reviewService.addReviewAsync(testRelativeFilePath, options2);
      await reviewService.deleteReviewAsync(testRelativeFilePath, 0);

      const reviewFile = await reviewService.loadReviewFileAsync(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews.length, 1);
        assert.strictEqual(reviewFile.reviews[0]?.content, '2番目のレビュー');
      }
    });
  });

  describe('getReviewSummary', () => {
    it('レビューサマリーを取得する', async () => {
      const options1: CreateReviewOptions = {
        line: 1,
        reviewer: '編集者A',
        type: 'human',
        severity: 'warning',
        content: '未対応レビュー',
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '解決済みレビュー',
      };

      await reviewService.addReviewAsync(testRelativeFilePath, options1);
      await reviewService.addReviewAsync(testRelativeFilePath, options2);
      await reviewService.updateReviewAsync(testRelativeFilePath, 1, { status: 'resolved' });

      const summary = await reviewService.getReviewSummaryAsync(testRelativeFilePath);

      assert.ok(summary !== null);
      if (summary !== null) {
        assert.strictEqual(summary.open, 1);
        assert.strictEqual(summary.resolved, 1);
        assert.strictEqual(summary.in_progress, 0);
        assert.strictEqual(summary.dismissed, 0);
      }
    });

    it('レビューが存在しない場合は null を返す', async () => {
      const summary = await reviewService.getReviewSummaryAsync(testRelativeFilePath);
      assert.ok(summary === null);
    });
  });
});
