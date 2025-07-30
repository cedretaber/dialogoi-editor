// Jestはグローバルにdescribe, it等が定義されているためimport不要
import * as path from 'path';
import { CommentService } from './CommentService.js';
import { CreateCommentOptions } from '../models/Comment.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

describe('CommentService テストスイート', () => {
  let workspaceRootPath: string;
  let commentService: CommentService;
  let testRelativeFilePath: string;
  let mockFileRepository: MockFileRepository;

  beforeEach(() => {
    // テスト用サービスコンテナを作成
    const container = TestServiceContainer.create();

    // モックファイルサービスを取得
    mockFileRepository = container.getFileRepository() as MockFileRepository;

    // テスト用のワークスペースを設定
    workspaceRootPath = '/workspace';
    const workspaceRoot = mockFileRepository.createFileUri(workspaceRootPath);
    commentService = container.getCommentService(workspaceRoot);
    testRelativeFilePath = 'test.txt';

    // テストファイルを作成
    const fullTestAbsolutePath = path.join(workspaceRootPath, testRelativeFilePath);
    mockFileRepository.addFile(fullTestAbsolutePath, 'Hello, World!\nThis is a test file.\n');
  });

  afterEach(() => {
    // テスト用サービスコンテナをリセット
    TestServiceContainer.create().reset();
  });

  describe('addCommentAsync', () => {
    it('新しいコメントを追加する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'これはテストコメントです',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // コメントファイルが作成されているか確認
      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(1);
        expect(commentFile.comments[0]?.id).toBe(1);
        expect(commentFile.comments[0]?.target_file).toBe('test.txt#L1');
        expect(commentFile.comments[0]?.content).toBe('これはテストコメントです');
        expect(commentFile.comments[0]?.status).toBe('open');
        expect(commentFile.comments[0]?.posted_by).toBe('author');
        expect(commentFile.comments[0]?.created_at).toBeTruthy();
        expect(commentFile.comments[0]?.file_hash).toBeTruthy();
      }
    });

    it('複数行コメントを追加する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        endLine: 3,
        content: '複数行にわたるコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments[0]?.id).toBe(1);
        expect(commentFile.comments[0]?.target_file).toBe('test.txt#L1-L3');
        expect(commentFile.comments[0]?.content).toBe('複数行にわたるコメント');
      }
    });

    it('既存のコメントファイルに追加する', async () => {
      const options1: CreateCommentOptions = {
        line: 1,
        content: '最初のコメント',
      };

      const options2: CreateCommentOptions = {
        line: 2,
        content: '2番目のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options1);
      await commentService.addCommentAsync(testRelativeFilePath, options2);

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(2);
        expect(commentFile.comments[0]?.content).toBe('最初のコメント');
        expect(commentFile.comments[1]?.content).toBe('2番目のコメント');
      }
    });

    it('dialogoi.yamlからauthor情報を取得してposted_byに設定する', async () => {
      // テスト用のdialogoi.yamlを作成
      const dialogoiYamlContent = `title: テスト小説
author: テスト著者
version: 1.0.0
created_at: '2024-01-01T00:00:00Z'`;

      const dialogoiYamlUri = mockFileRepository.createFileUri(
        `${workspaceRootPath}/dialogoi.yaml`,
      );
      await mockFileRepository.writeFileAsync(dialogoiYamlUri, dialogoiYamlContent);

      const options: CreateCommentOptions = {
        line: 10,
        content: 'author情報テスト',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // コメントファイルを読み込み、posted_byを確認
      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(1);
        expect(commentFile.comments[0]?.posted_by).toBe('テスト著者');
      }
    });

    it('dialogoi.yamlが存在しない場合はデフォルト値が使用される', async () => {
      // テスト用ファイルを作成
      const anotherFilePath = path.join(workspaceRootPath, 'another.txt');
      mockFileRepository.addFile(anotherFilePath, 'Another test file content.');

      const options: CreateCommentOptions = {
        line: 5,
        content: 'デフォルト値テスト',
      };

      await commentService.addCommentAsync('another.txt', options);

      // コメントファイルを読み込み、posted_byがデフォルト値になっているか確認
      const commentFile = await commentService.loadCommentFileAsync('another.txt');
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(1);
        expect(commentFile.comments[0]?.posted_by).toBe('author');
      }
    });
  });

  describe('loadCommentFileAsync', () => {
    it('存在しないコメントファイルを読み込む', async () => {
      const commentFile = await commentService.loadCommentFileAsync('nonexistent.txt');
      expect(commentFile).toBe(null);
    });

    it('コメントファイルを正しく読み込む', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);

      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(1);
        expect(commentFile.comments[0]?.content).toBe('テストコメント');
      }
    });
  });

  describe('updateCommentAsync', () => {
    it('コメントのステータスを更新する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      await commentService.updateCommentAsync(testRelativeFilePath, 0, { status: 'resolved' });

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments[0]?.status).toBe('resolved');
      }
    });

    it('コメントの内容を更新する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '元のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      await commentService.updateCommentAsync(testRelativeFilePath, 0, {
        content: '更新されたコメント',
      });

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments[0]?.content).toBe('更新されたコメント');
      }
    });

    it('ステータスとコンテンツを同時に更新する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '元のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      await commentService.updateCommentAsync(testRelativeFilePath, 0, {
        content: '更新されたコメント',
        status: 'resolved',
      });

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments[0]?.content).toBe('更新されたコメント');
        expect(commentFile.comments[0]?.status).toBe('resolved');
      }
    });

    it('存在しないコメントファイルを更新しようとするとエラーが発生する', async () => {
      try {
        await commentService.updateCommentAsync('nonexistent.txt', 0, { status: 'resolved' });
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('更新対象のコメントが見つかりません');
      }
    });

    it('無効なコメントインデックスでエラーが発生する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      try {
        await commentService.updateCommentAsync(testRelativeFilePath, 999, { status: 'resolved' });
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('更新対象のコメントが見つかりません');
      }
    });
  });

  describe('deleteCommentAsync', () => {
    it('コメントを削除する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '削除対象のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      await commentService.deleteCommentAsync(testRelativeFilePath, 0);

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      // コメントが全て削除された場合、ファイル自体が削除される
      expect(commentFile).toBe(null);
    });

    it('複数のコメントのうち1つを削除する', async () => {
      const options1: CreateCommentOptions = {
        line: 1,
        content: '最初のコメント',
      };

      const options2: CreateCommentOptions = {
        line: 2,
        content: '2番目のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options1);
      await commentService.addCommentAsync(testRelativeFilePath, options2);
      await commentService.deleteCommentAsync(testRelativeFilePath, 0);

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile !== null).toBeTruthy();
      if (commentFile !== null) {
        expect(commentFile.comments.length).toBe(1);
        expect(commentFile.comments[0]?.content).toBe('2番目のコメント');
        expect(commentFile.comments[0]?.id).toBe(2);
      }
    });

    it('存在しないコメントファイルからの削除でエラーが発生する', async () => {
      try {
        await commentService.deleteCommentAsync('nonexistent.txt', 0);
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('削除対象のコメントが見つかりません');
      }
    });

    it('無効なコメントインデックスでエラーが発生する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      try {
        await commentService.deleteCommentAsync(testRelativeFilePath, 999);
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('削除対象のコメントが見つかりません');
      }
    });
  });

  describe('isFileChangedAsync', () => {
    it('ファイルが変更されていない場合はfalseを返す', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      const isChanged = await commentService.isFileChangedAsync(testRelativeFilePath);
      expect(isChanged).toBe(false);
    });

    it('ファイルが変更された場合はtrueを返す', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // ファイル内容を変更
      const fullTestAbsolutePath = path.join(workspaceRootPath, testRelativeFilePath);
      mockFileRepository.addFile(fullTestAbsolutePath, 'Changed content!\nThis is modified.\n');

      const isChanged = await commentService.isFileChangedAsync(testRelativeFilePath);
      expect(isChanged).toBe(true);
    });

    it('コメントファイルが存在しない場合はfalseを返す', async () => {
      const isChanged = await commentService.isFileChangedAsync('nonexistent.txt');
      expect(isChanged).toBe(false);
    });
  });

  describe('updateFileHashAsync', () => {
    it('ファイルハッシュを更新する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // ファイル内容を変更
      const fullTestAbsolutePath = path.join(workspaceRootPath, testRelativeFilePath);
      mockFileRepository.addFile(fullTestAbsolutePath, 'Changed content!\n');

      // 変更前は true
      let isChanged = await commentService.isFileChangedAsync(testRelativeFilePath);
      expect(isChanged).toBe(true);

      // ハッシュを更新
      await commentService.updateFileHashAsync(testRelativeFilePath);

      // 更新後は false
      isChanged = await commentService.isFileChangedAsync(testRelativeFilePath);
      expect(isChanged).toBe(false);
    });

    it('コメントファイルが存在しない場合は何もしない', async () => {
      // エラーが発生しないことを確認
      await commentService.updateFileHashAsync('nonexistent.txt');
      // エラーが発生しなければテスト成功
    });
  });

  describe('getCommentSummaryAsync', () => {
    it('コメントがない場合は空のサマリーを返す', async () => {
      const summary = await commentService.getCommentSummaryAsync('nonexistent.txt');
      expect(summary).toEqual({ open: 0 });
    });

    it('未完了コメントのみの場合', async () => {
      const options1: CreateCommentOptions = {
        line: 1,
        content: '未完了コメント1',
      };

      const options2: CreateCommentOptions = {
        line: 2,
        content: '未完了コメント2',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options1);
      await commentService.addCommentAsync(testRelativeFilePath, options2);

      const summary = await commentService.getCommentSummaryAsync(testRelativeFilePath);
      expect(summary).toEqual({ open: 2 });
    });

    it('完了・未完了が混在する場合', async () => {
      const options1: CreateCommentOptions = {
        line: 1,
        content: '未完了コメント',
      };

      const options2: CreateCommentOptions = {
        line: 2,
        content: '完了予定コメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options1);
      await commentService.addCommentAsync(testRelativeFilePath, options2);

      // 1つを完了に変更
      await commentService.updateCommentAsync(testRelativeFilePath, 1, { status: 'resolved' });

      const summary = await commentService.getCommentSummaryAsync(testRelativeFilePath);
      expect(summary).toEqual({ open: 1, resolved: 1 });
    });

    it('全てが完了している場合', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '完了コメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);
      await commentService.updateCommentAsync(testRelativeFilePath, 0, { status: 'resolved' });

      const summary = await commentService.getCommentSummaryAsync(testRelativeFilePath);
      expect(summary).toEqual({ open: 0, resolved: 1 });
    });
  });

  describe('データ妥当性検証', () => {
    it('不正なYAMLファイルをロードするとエラーが発生する', async () => {
      const commentFilePath = path.join(
        workspaceRootPath,
        `.${testRelativeFilePath}.comments.yaml`,
      );
      mockFileRepository.addFile(commentFilePath, 'file_hash: "test"\ninvalid: yaml: [unclosed');

      try {
        await commentService.loadCommentFileAsync(testRelativeFilePath);
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('コメントファイル読み込みエラー');
      }
    });

    it('不正な形式のコメントファイルをロードするとエラーが発生する', async () => {
      const commentFilePath = path.join(
        workspaceRootPath,
        `.${testRelativeFilePath}.comments.yaml`,
      );
      mockFileRepository.addFile(
        commentFilePath,
        'comments:\n  - invalid_field: "no required fields"',
      );

      try {
        await commentService.loadCommentFileAsync(testRelativeFilePath);
        throw new Error('エラーが発生すべきです');
      } catch (error) {
        expect((error as Error).message).toContain('コメントファイルの形式が正しくありません');
      }
    });
  });
});
