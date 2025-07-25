import { describe, it, beforeEach, afterEach } from 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

/**
 * editorCommentCommands.tsは主にVSCode API依存の関数で構成されているため、
 * 単体テストでは内部ロジックのヘルパー関数をテストします。
 *
 * 実際のコマンド動作は統合テスト（VSCode環境）で確認します。
 */
describe('editorCommentCommands ヘルパー関数テスト', () => {
  let mockFileRepository: MockFileRepository;
  let workspaceRootPath: string;
  let testProjectPath: string;

  beforeEach(() => {
    // テスト用サービスコンテナを初期化
    const container = TestServiceContainer.getInstance();
    container.reset();

    // モックファイルサービスを取得
    mockFileRepository = container.getMockFileRepository();

    // テスト用のワークスペースとプロジェクトを設定
    workspaceRootPath = '/workspace';
    testProjectPath = path.join(workspaceRootPath, 'novel');

    // テスト用プロジェクト構造を作成
    const dialogoiYamlContent = `title: テスト小説
author: テスト著者
version: 1.0.0
created_at: '2024-01-01T00:00:00Z'`;

    const metaYamlContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
  - name: chapter2.txt
    type: content`;

    mockFileRepository.addFile(path.join(testProjectPath, 'dialogoi.yaml'), dialogoiYamlContent);
    mockFileRepository.addFile(path.join(testProjectPath, '.dialogoi-meta.yaml'), metaYamlContent);
    mockFileRepository.addFile(
      path.join(testProjectPath, 'chapter1.txt'),
      'これはテスト章です。\n2行目の内容。\n3行目の内容。',
    );
    mockFileRepository.addFile(path.join(testProjectPath, 'chapter2.txt'), '別の章の内容です。');
  });

  afterEach(() => {
    // テスト用サービスコンテナをリセット
    TestServiceContainer.getInstance().reset();
  });

  describe('相対パス変換のテスト', () => {
    it('プロジェクト内ファイルの相対パス変換が正常に動作する', async () => {
      const container = TestServiceContainer.getInstance();
      const dialogoiYamlService = container.getDialogoiYamlService();

      // プロジェクト内ファイルの絶対パス
      const absoluteFilePath = path.join(testProjectPath, 'chapter1.txt');

      // プロジェクトルートを検索（上向き検索）
      const projectRoot = await dialogoiYamlService.findProjectRootAsync(absoluteFilePath);
      assert.strictEqual(projectRoot, testProjectPath);

      // 相対パスを計算（実際の関数の戻り値をテスト）
      const relativePath = path.relative(projectRoot, absoluteFilePath);
      assert.strictEqual(relativePath, 'chapter1.txt');
    });

    it('プロジェクト外ファイルの場合はnullが返される', async () => {
      const container = TestServiceContainer.getInstance();
      const dialogoiYamlService = container.getDialogoiYamlService();

      // プロジェクト外ディレクトリのファイルパス（存在するファイルを作成）
      const outsideFilePath = '/some/other/path/test.txt';
      mockFileRepository.addFile(outsideFilePath, 'test content');

      // プロジェクトルートを検索
      const projectRoot = await dialogoiYamlService.findProjectRootAsync(outsideFilePath);
      assert.strictEqual(projectRoot, null);
    });

    it('上位ディレクトリを参照するパスは無効として扱われる', async () => {
      const container = TestServiceContainer.getInstance();
      const dialogoiYamlService = container.getDialogoiYamlService();

      // プロジェクトルートの上位ディレクトリのファイル
      const upperFilePath = path.join(workspaceRootPath, 'outside.txt');

      // プロジェクトルートを検索（プロジェクトルートから開始）
      const projectRoot = await dialogoiYamlService.findProjectRootAsync(testProjectPath);
      assert.strictEqual(projectRoot, testProjectPath);

      // 相対パスを計算
      const relativePath = path.relative(projectRoot, upperFilePath);
      // '../outside.txt' のような形式になり、上位ディレクトリ参照となる
      assert.ok(relativePath.startsWith('..'));
    });
  });

  describe('CommentService統合テスト', () => {
    it('選択範囲からのコメント追加が正常に動作する', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      // 単一行コメントの追加
      await commentService.addCommentAsync('chapter1.txt', {
        line: 1,
        content: 'エディタから追加されたコメント',
      });

      // コメントが正しく追加されたか確認
      const commentFile = await commentService.loadCommentFileAsync('chapter1.txt');
      assert.ok(commentFile !== null);

      if (commentFile !== null) {
        assert.strictEqual(commentFile.comments.length, 1);
        assert.strictEqual(commentFile.comments[0]?.id, 1);
        assert.strictEqual(commentFile.comments[0]?.target_file, 'chapter1.txt#L1');
        assert.strictEqual(commentFile.comments[0]?.content, 'エディタから追加されたコメント');
        assert.strictEqual(commentFile.comments[0]?.status, 'open');
        assert.strictEqual(commentFile.comments[0]?.posted_by, 'テスト著者');
      }
    });

    it('複数行選択範囲からのコメント追加が正常に動作する', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      // 複数行コメントの追加
      await commentService.addCommentAsync('chapter1.txt', {
        line: 1,
        endLine: 3,
        content: '複数行にわたるコメント',
      });

      // コメントが正しく追加されたか確認
      const commentFile = await commentService.loadCommentFileAsync('chapter1.txt');
      assert.ok(commentFile !== null);

      if (commentFile !== null) {
        assert.strictEqual(commentFile.comments.length, 1);
        assert.strictEqual(commentFile.comments[0]?.target_file, 'chapter1.txt#L1-L3');
        assert.strictEqual(commentFile.comments[0]?.content, '複数行にわたるコメント');
      }
    });

    it('空のコンテンツでコメントが作成される（後で編集用）', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      // 空のコンテンツでコメント追加
      await commentService.addCommentAsync('chapter1.txt', {
        line: 2,
        content: '', // 空のコンテンツ
      });

      // コメントが正しく追加されたか確認
      const commentFile = await commentService.loadCommentFileAsync('chapter1.txt');
      assert.ok(commentFile !== null);

      if (commentFile !== null) {
        assert.strictEqual(commentFile.comments.length, 1);
        assert.strictEqual(commentFile.comments[0]?.content, '');
        assert.strictEqual(commentFile.comments[0]?.status, 'open');
      }
    });

    it('複数のコメントが順次追加される', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      // 複数のコメントを追加
      await commentService.addCommentAsync('chapter1.txt', {
        line: 1,
        content: '最初のコメント',
      });

      await commentService.addCommentAsync('chapter1.txt', {
        line: 2,
        content: '2番目のコメント',
      });

      // コメントが正しく追加されたか確認
      const commentFile = await commentService.loadCommentFileAsync('chapter1.txt');
      assert.ok(commentFile !== null);

      if (commentFile !== null) {
        assert.strictEqual(commentFile.comments.length, 2);
        assert.strictEqual(commentFile.comments[0]?.id, 1);
        assert.strictEqual(commentFile.comments[0]?.content, '最初のコメント');
        assert.strictEqual(commentFile.comments[1]?.id, 2);
        assert.strictEqual(commentFile.comments[1]?.content, '2番目のコメント');
      }
    });
  });

  describe('エラーケースのテスト', () => {
    it('存在しないファイルへのコメント追加でエラーが発生する', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      try {
        await commentService.addCommentAsync('nonexistent.txt', {
          line: 1,
          content: 'エラーテスト',
        });
        assert.fail('エラーが発生すべきです');
      } catch (error) {
        assert.ok(error instanceof Error);
        // ファイルが見つからないエラーまたはプロジェクトルートが見つからないエラー
        assert.ok(
          error.message.includes('ファイルが見つかりません') ||
            error.message.includes('プロジェクトルート'),
        );
      }
    });

    it('無効な行番号でもコメントは作成される（バリデーションなし）', async () => {
      const container = TestServiceContainer.getInstance();
      const workspaceUri = mockFileRepository.createFileUri(testProjectPath);
      const commentService = container.getCommentService(workspaceUri);

      // 無効な行番号（0や負の数）でもコメントは作成される
      await commentService.addCommentAsync('chapter1.txt', {
        line: 0,
        content: '行番号0のコメント',
      });

      await commentService.addCommentAsync('chapter1.txt', {
        line: -1,
        content: '負の行番号のコメント',
      });

      // コメントが作成されることを確認
      const commentFile = await commentService.loadCommentFileAsync('chapter1.txt');
      assert.ok(commentFile !== null);

      if (commentFile !== null) {
        assert.strictEqual(commentFile.comments.length, 2);
        assert.strictEqual(commentFile.comments[0]?.target_file, 'chapter1.txt#L0');
        assert.strictEqual(commentFile.comments[1]?.target_file, 'chapter1.txt#L-1');
      }
    });
  });
});
