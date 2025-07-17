import { describe, it, beforeEach, afterEach } from 'mocha';
import { assert } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ReviewService } from './ReviewService.js';
import { CreateReviewOptions } from '../models/Review.js';

describe('ReviewService テストスイート', () => {
  let tempDir: string;
  let workspaceRoot: vscode.Uri;
  let reviewService: ReviewService;
  let testFilePath: string;

  beforeEach(() => {
    // テンポラリディレクトリを作成
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
    workspaceRoot = vscode.Uri.file(tempDir);
    reviewService = new ReviewService(workspaceRoot);
    testFilePath = 'test.txt';
    
    // テストファイルを作成
    const fullTestFilePath = path.join(tempDir, testFilePath);
    fs.writeFileSync(fullTestFilePath, 'Hello, World!\nThis is a test file.\n');
  });

  afterEach(() => {
    // テンポラリディレクトリを削除
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
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

      const reviewIndex = await reviewService.addReview(testFilePath, options);
      
      assert.equal(reviewIndex, 0);
      
      // レビューファイルが作成されているか確認
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.isNotNull(reviewFile);
      assert.equal(reviewFile!.target_file, testFilePath);
      assert.equal(reviewFile!.reviews.length, 1);
      assert.equal(reviewFile!.reviews[0]?.content, 'これは提案です');
      assert.equal(reviewFile!.reviews[0]?.reviewer, 'テスト編集者');
      assert.equal(reviewFile!.reviews[0]?.status, 'open');
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

      await reviewService.addReview(testFilePath, options1);
      const reviewIndex = await reviewService.addReview(testFilePath, options2);
      
      assert.equal(reviewIndex, 1);
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews.length, 2);
      assert.equal(reviewFile!.reviews[1]?.content, '2番目のレビュー');
    });
  });

  describe('loadReviewFile', () => {
    it('存在しないレビューファイルを読み込む', async () => {
      const reviewFile = await reviewService.loadReviewFile('nonexistent.txt');
      assert.isNull(reviewFile);
    });

    it('レビューファイルを正しく読み込む', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'info',
        content: 'テストレビュー'
      };

      await reviewService.addReview(testFilePath, options);
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      
      assert.isNotNull(reviewFile);
      assert.equal(reviewFile!.target_file, testFilePath);
      assert.equal(reviewFile!.reviews.length, 1);
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

      await reviewService.addReview(testFilePath, options);
      await reviewService.updateReview(testFilePath, 0, { status: 'resolved' });
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews[0]?.status, 'resolved');
    });

    it('レビューのコンテンツを更新する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: '元のレビュー'
      };

      await reviewService.addReview(testFilePath, options);
      await reviewService.updateReview(testFilePath, 0, { content: '更新されたレビュー' });
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews[0]?.content, '更新されたレビュー');
    });

    it('存在しないレビューファイルを更新しようとするとエラーが発生する', async () => {
      try {
        await reviewService.updateReview('nonexistent.txt', 0, { status: 'resolved' });
        assert.fail('エラーが発生すべきです');
      } catch (error) {
        assert.include((error as Error).message, 'レビューファイルが見つかりません');
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

      await reviewService.addReview(testFilePath, options);
      
      try {
        await reviewService.updateReview(testFilePath, 999, { status: 'resolved' });
        assert.fail('エラーが発生すべきです');
      } catch (error) {
        assert.include((error as Error).message, '無効なレビューインデックス');
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

      await reviewService.addReview(testFilePath, options);
      await reviewService.deleteReview(testFilePath, 0);
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.isNull(reviewFile); // ファイルが削除されている
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

      await reviewService.addReview(testFilePath, options1);
      await reviewService.addReview(testFilePath, options2);
      await reviewService.deleteReview(testFilePath, 0);
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews.length, 1);
      assert.equal(reviewFile!.reviews[0]?.content, '2番目のレビュー');
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

      await reviewService.addReview(testFilePath, options1);
      await reviewService.addReview(testFilePath, options2);
      await reviewService.updateReview(testFilePath, 1, { status: 'resolved' });
      
      const summary = await reviewService.getReviewSummary(testFilePath);
      
      assert.isNotNull(summary);
      assert.equal(summary!.open, 1);
      assert.equal(summary!.resolved, 1);
      assert.equal(summary!.in_progress, 0);
      assert.equal(summary!.dismissed, 0);
    });

    it('レビューが存在しない場合は null を返す', async () => {
      const summary = await reviewService.getReviewSummary(testFilePath);
      assert.isNull(summary);
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

      await reviewService.addReview(testFilePath, options);
      await reviewService.addComment(testFilePath, 0, {
        author: '執筆者',
        content: 'コメントありがとうございます'
      });
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews[0]?.thread?.length, 1);
      assert.equal(reviewFile!.reviews[0]?.thread?.[0]?.author, '執筆者');
      assert.equal(reviewFile!.reviews[0]?.thread?.[0]?.content, 'コメントありがとうございます');
    });

    it('複数のコメントを追加する', async () => {
      const options: CreateReviewOptions = {
        line: 1,
        reviewer: 'テスト編集者',
        type: 'human',
        severity: 'suggestion',
        content: 'テストレビュー'
      };

      await reviewService.addReview(testFilePath, options);
      await reviewService.addComment(testFilePath, 0, {
        author: '執筆者',
        content: '最初のコメント'
      });
      await reviewService.addComment(testFilePath, 0, {
        author: '編集者',
        content: '2番目のコメント'
      });
      
      const reviewFile = await reviewService.loadReviewFile(testFilePath);
      assert.equal(reviewFile!.reviews[0]?.thread?.length, 2);
      assert.equal(reviewFile!.reviews[0]?.thread?.[1]?.content, '2番目のコメント');
    });
  });
});