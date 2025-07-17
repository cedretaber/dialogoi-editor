import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ReviewService } from './ReviewService.js';
import { CreateReviewOptions } from '../models/Review.js';

describe('ReviewService テストスイート', () => {
  let tempDirAbsolutePath: string;
  let workspaceRoot: vscode.Uri;
  let reviewService: ReviewService;
  let testRelativeFilePath: string;

  beforeEach(() => {
    // テンポラリディレクトリを作成
    tempDirAbsolutePath = fs.mkdtempSync(path.join(__dirname, 'temp-'));
    workspaceRoot = vscode.Uri.file(tempDirAbsolutePath);
    reviewService = new ReviewService(workspaceRoot);
    testRelativeFilePath = 'test.txt';
    
    // テストファイルを作成
    const fullTestAbsolutePath = path.join(tempDirAbsolutePath, testRelativeFilePath);
    fs.writeFileSync(fullTestAbsolutePath, 'Hello, World!\nThis is a test file.\n');
  });

  afterEach(() => {
    // テンポラリディレクトリを削除
    if (fs.existsSync(tempDirAbsolutePath)) {
      fs.rmSync(tempDirAbsolutePath, { recursive: true, force: true });
    }
  });

  describe('addReview', () => {
    it('新しいレビューを追加する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'これは提案です'
      };

      const reviewIndex = await reviewService.addReview(testRelativeFilePath, options);
      
      assert.strictEqual(reviewIndex, 0);
      
      // レビューファイルが作成されているか確認
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
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
        content: '最初のレビュー'
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '2番目のレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options1);
      const reviewIndex = await reviewService.addReview(testRelativeFilePath, options2);
      
      assert.strictEqual(reviewIndex, 1);
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews.length, 2);
        assert.strictEqual(reviewFile.reviews[1]?.content, '2番目のレビュー');
      }
    });
  });

  describe('loadReviewFile', () => {
    it('存在しないレビューファイルを読み込む', async () => {
      const reviewFile = await reviewService.loadReviewFile('nonexistent.txt');
      assert.ok(reviewFile);
    });

    it('レビューファイルを正しく読み込む', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'info',
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      
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
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      await reviewService.updateReview(testRelativeFilePath, 0, { status: 'resolved' });
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
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
        content: '元のレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      await reviewService.updateReview(testRelativeFilePath, 0, { content: '更新されたレビュー' });
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews[0]?.content, '更新されたレビュー');
      }
    });

    it('存在しないレビューファイルを更新しようとするとエラーが発生する', async () => {
      try {
        await reviewService.updateReview('nonexistent.txt', 0, { status: 'resolved' });
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
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      
      try {
        await reviewService.updateReview(testRelativeFilePath, 999, { status: 'resolved' });
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
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      await reviewService.deleteReview(testRelativeFilePath, 0);
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      assert.ok(reviewFile === null); // ファイルが削除されている
    });

    it('複数のレビューから1つを削除する', async () => {
      const options1: CreateReviewOptions = {
        line: 1,
        reviewer: '編集者A',
        type: 'human',
        severity: 'warning',
        content: '最初のレビュー'
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '2番目のレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options1);
      await reviewService.addReview(testRelativeFilePath, options2);
      await reviewService.deleteReview(testRelativeFilePath, 0);
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
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
        content: '未対応レビュー'
      };

      const options2: CreateReviewOptions = {
        line: 2,
        reviewer: '編集者B',
        type: 'human',
        severity: 'error',
        content: '解決済みレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options1);
      await reviewService.addReview(testRelativeFilePath, options2);
      await reviewService.updateReview(testRelativeFilePath, 1, { status: 'resolved' });
      
      const summary = await reviewService.getReviewSummary(testRelativeFilePath);
      
      assert.ok(summary !== null);
      if (summary !== null) {
        assert.strictEqual(summary.open, 1);
        assert.strictEqual(summary.resolved, 1);
        assert.strictEqual(summary.in_progress, 0);
        assert.strictEqual(summary.dismissed, 0);
      }
    });

    it('レビューが存在しない場合は null を返す', async () => {
      const summary = await reviewService.getReviewSummary(testRelativeFilePath);
      assert.ok(summary === null);
    });
  });

  describe('addComment', () => {
    it('レビューにコメントを追加する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      await reviewService.addComment(testRelativeFilePath, 0, {
        author: '執筆者',
        content: 'コメントありがとうございます'
      });
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews[0]?.thread?.length, 1);
        assert.strictEqual(reviewFile.reviews[0]?.thread?.[0]?.author, '執筆者');
        assert.strictEqual(reviewFile.reviews[0]?.thread?.[0]?.content, 'コメントありがとうございます');
      }
    });

    it('複数のコメントを追加する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー'
      };

      await reviewService.addReview(testRelativeFilePath, options);
      await reviewService.addComment(testRelativeFilePath, 0, {
        author: '執筆者',
        content: '最初のコメント'
      });
      await reviewService.addComment(testRelativeFilePath, 0, {
        author: '編集者',
        content: '2番目のコメント'
      });
      
      const reviewFile = await reviewService.loadReviewFile(testRelativeFilePath);
      assert.ok(reviewFile !== null);
      if (reviewFile !== null) {
        assert.strictEqual(reviewFile.reviews[0]?.thread?.length, 2);
        assert.strictEqual(reviewFile.reviews[0]?.thread?.[1]?.content, '2番目のコメント');
      }
    });
  });
});