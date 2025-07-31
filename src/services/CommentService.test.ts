import { mock, MockProxy } from 'jest-mock-extended';
import * as path from 'path';
import { CommentService } from './CommentService.js';
import { CreateCommentOptions } from '../models/Comment.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { DialogoiPathService } from './DialogoiPathService.js';
import { Uri } from '../interfaces/Uri.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';

describe('CommentService テストスイート', () => {
  let workspaceRootPath: string;
  let commentService: CommentService;
  let testRelativeFilePath: string;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let mockDialogoiPathService: MockProxy<DialogoiPathService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;
  let workspaceRoot: Uri;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();

    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockDialogoiYamlService = mock<DialogoiYamlService>();
    mockDialogoiPathService = mock<DialogoiPathService>();

    // テスト用のワークスペースを設定
    workspaceRootPath = '/workspace';
    workspaceRoot = { path: workspaceRootPath, fsPath: workspaceRootPath } as Uri;

    // サービスインスタンス作成
    commentService = new CommentService(
      mockFileRepository,
      mockDialogoiYamlService,
      mockDialogoiPathService,
      workspaceRoot,
    );
    testRelativeFilePath = 'test.txt';

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    // テスト用ディレクトリとファイルを作成
    addDirectory(workspaceRootPath);
    const fullTestAbsolutePath = path.join(workspaceRootPath, testRelativeFilePath);
    addFile(fullTestAbsolutePath, 'Hello, World!\nThis is a test file.\n');
  });

  function setupFileSystemMocks(): void {
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });

    // joinPathのモック
    mockFileRepository.joinPath.mockImplementation((base: Uri, ...segments: string[]) => {
      const joinedPath = path.join(base.path, ...segments);
      return { path: joinedPath, fsPath: joinedPath } as Uri;
    });

    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    // readFileAsyncのモック
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, encoding?: string): Promise<string | Uint8Array> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      if (encoding !== undefined) {
        return Promise.resolve(content);
      } else {
        return Promise.resolve(new TextEncoder().encode(content));
      }
    });

    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, data: string | Uint8Array) => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
      fileSystem.set(uri.path, content);
      return Promise.resolve();
    });

    // unlinkAsyncのモック
    mockFileRepository.unlinkAsync.mockImplementation((uri: Uri) => {
      fileSystem.delete(uri.path);
      return Promise.resolve();
    });

    // DialogoiYamlServiceのモック設定
    mockDialogoiYamlService.loadDialogoiYamlAsync.mockImplementation((absolutePath: string) => {
      const dialogoiPath = path.join(absolutePath, 'dialogoi.yaml');
      const content = fileSystem.get(dialogoiPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }

      // 簡単なパーシング（テスト用）
      const lines = content.split('\n');
      const result: Partial<DialogoiYaml> = {};
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key !== undefined && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          if (key.trim() === 'author') {
            result.author = value.replace(/["']/g, '');
          } else if (key.trim() === 'title') {
            result.title = value.replace(/["']/g, '');
          }
        }
      }
      return Promise.resolve(result as DialogoiYaml);
    });

    // DialogoiPathServiceのモック設定
    mockDialogoiPathService.resolveCommentPath.mockImplementation((filePath: string) => {
      // 新しいパス構造: /workspace/.dialogoi/{relativePath}/.{filename}.comments.yaml
      const relativePath = path.relative(workspaceRootPath, path.dirname(filePath));
      const filename = path.basename(filePath);

      if (relativePath === '' || relativePath === '.') {
        // ルートディレクトリの場合
        return path.join(workspaceRootPath, '.dialogoi', `.${filename}.comments.yaml`);
      } else {
        // サブディレクトリの場合
        return path.join(
          workspaceRootPath,
          '.dialogoi',
          relativePath,
          `.${filename}.comments.yaml`,
        );
      }
    });

    mockDialogoiPathService.ensureDialogoiDirectory.mockImplementation((targetPath: string) => {
      // .dialogoi/ 内のディレクトリ構造を作成
      const relativePath = path.relative(workspaceRootPath, targetPath);

      if (relativePath === '' || relativePath === '.') {
        // ルートディレクトリの場合
        addDirectory(path.join(workspaceRootPath, '.dialogoi'));
      } else {
        // サブディレクトリの場合
        addDirectory(path.join(workspaceRootPath, '.dialogoi', relativePath));
      }

      return Promise.resolve();
    });
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  describe('addCommentAsync', () => {
    it('新しいコメントを追加する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'これはテストコメントです',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // DialogoiPathServiceのメソッド呼び出しを検証
      expect(mockDialogoiPathService.resolveCommentPath).toHaveBeenCalledWith(
        path.join(workspaceRootPath, testRelativeFilePath),
      );
      expect(mockDialogoiPathService.ensureDialogoiDirectory).toHaveBeenCalledWith(
        workspaceRootPath,
      );

      // コメントファイルが作成されているか確認
      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(1);
      expect(commentFile?.comments[0]?.id).toBe(1);
      expect(commentFile?.comments[0]?.target_file).toBe('test.txt#L1');
      expect(commentFile?.comments[0]?.content).toBe('これはテストコメントです');
      expect(commentFile?.comments[0]?.status).toBe('open');
      expect(commentFile?.comments[0]?.posted_by).toBe('author');
      expect(commentFile?.comments[0]?.created_at).toBeTruthy();
      expect(commentFile?.comments[0]?.file_hash).toBeTruthy();

      // resolveCommentPathが適切に呼ばれることを確認（add時、既存ファイル読み込み時、load時）
      expect(mockDialogoiPathService.resolveCommentPath).toHaveBeenCalledTimes(3);
    });

    it('複数行コメントを追加する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        endLine: 3,
        content: '複数行にわたるコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments[0]?.id).toBe(1);
      expect(commentFile?.comments[0]?.target_file).toBe('test.txt#L1-L3');
      expect(commentFile?.comments[0]?.content).toBe('複数行にわたるコメント');
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
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(2);
      expect(commentFile?.comments[0]?.content).toBe('最初のコメント');
      expect(commentFile?.comments[1]?.content).toBe('2番目のコメント');
    });

    it('dialogoi.yamlからauthor情報を取得してposted_byに設定する', async () => {
      // テスト用のdialogoi.yamlを作成
      const dialogoiYamlContent = `title: テスト小説
author: テスト著者
version: 1.0.0
created_at: '2024-01-01T00:00:00Z'`;

      addFile(`${workspaceRootPath}/dialogoi.yaml`, dialogoiYamlContent);

      const options: CreateCommentOptions = {
        line: 10,
        content: 'author情報テスト',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // コメントファイルを読み込み、posted_byを確認
      const commentFile = await commentService.loadCommentFileAsync(testRelativeFilePath);
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(1);
      expect(commentFile?.comments[0]?.posted_by).toBe('テスト著者');
    });

    it('dialogoi.yamlが存在しない場合はデフォルト値が使用される', async () => {
      // テスト用ファイルを作成
      const anotherFilePath = path.join(workspaceRootPath, 'another.txt');
      addFile(anotherFilePath, 'Another test file content.');

      const options: CreateCommentOptions = {
        line: 5,
        content: 'デフォルト値テスト',
      };

      await commentService.addCommentAsync('another.txt', options);

      // コメントファイルを読み込み、posted_byがデフォルト値になっているか確認
      const commentFile = await commentService.loadCommentFileAsync('another.txt');
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(1);
      expect(commentFile?.comments[0]?.posted_by).toBe('author');
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

      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(1);
      expect(commentFile?.comments[0]?.content).toBe('テストコメント');
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
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments[0]?.status).toBe('resolved');
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
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments[0]?.content).toBe('更新されたコメント');
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
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments[0]?.content).toBe('更新されたコメント');
      expect(commentFile?.comments[0]?.status).toBe('resolved');
    });

    it('存在しないコメントファイルを更新しようとするとエラーが発生する', async () => {
      await expect(
        commentService.updateCommentAsync('nonexistent.txt', 0, { status: 'resolved' }),
      ).rejects.toThrow('更新対象のコメントが見つかりません');
    });

    it('無効なコメントインデックスでエラーが発生する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      await expect(
        commentService.updateCommentAsync(testRelativeFilePath, 999, { status: 'resolved' }),
      ).rejects.toThrow('更新対象のコメントが見つかりません');
    });
  });

  describe('deleteCommentAsync', () => {
    it('コメントを削除する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '削除対象のコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // モック呼び出し回数をリセット
      jest.clearAllMocks();

      await commentService.deleteCommentAsync(testRelativeFilePath, 0);

      // DialogoiPathServiceのメソッド呼び出しを検証
      expect(mockDialogoiPathService.resolveCommentPath).toHaveBeenCalledWith(
        path.join(workspaceRootPath, testRelativeFilePath),
      );

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
      expect(commentFile).not.toBeNull();
      expect(commentFile?.comments.length).toBe(1);
      expect(commentFile?.comments[0]?.content).toBe('2番目のコメント');
      expect(commentFile?.comments[0]?.id).toBe(2);
    });

    it('存在しないコメントファイルからの削除でエラーが発生する', async () => {
      await expect(commentService.deleteCommentAsync('nonexistent.txt', 0)).rejects.toThrow(
        '削除対象のコメントが見つかりません',
      );
    });

    it('無効なコメントインデックスでエラーが発生する', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: 'テストコメント',
      };

      await commentService.addCommentAsync(testRelativeFilePath, options);

      await expect(commentService.deleteCommentAsync(testRelativeFilePath, 999)).rejects.toThrow(
        '削除対象のコメントが見つかりません',
      );
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
      addFile(fullTestAbsolutePath, 'Changed content!\nThis is modified.\n');

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
      addFile(fullTestAbsolutePath, 'Changed content!\n');

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
      await expect(commentService.updateFileHashAsync('nonexistent.txt')).resolves.not.toThrow();
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

  describe('DialogoiPathService統合テスト', () => {
    it('saveCommentFileAsyncがensureDialogoiDirectoryを呼び出す', async () => {
      const options: CreateCommentOptions = {
        line: 1,
        content: '新しいディレクトリにコメント追加',
      };

      // モックをクリア
      jest.clearAllMocks();

      await commentService.addCommentAsync(testRelativeFilePath, options);

      // DialogoiPathServiceのメソッド呼び出しを検証
      expect(mockDialogoiPathService.ensureDialogoiDirectory).toHaveBeenCalledWith(
        workspaceRootPath, // ファイルの親ディレクトリ
      );
      expect(mockDialogoiPathService.resolveCommentPath).toHaveBeenCalledWith(
        path.join(workspaceRootPath, testRelativeFilePath),
      );
    });

    it('loadCommentFileAsyncがresolveCommentPathを呼び出す', async () => {
      // モックをクリア
      jest.clearAllMocks();

      // 存在しないファイルでも呼び出し確認
      await commentService.loadCommentFileAsync('nonexistent.txt');

      expect(mockDialogoiPathService.resolveCommentPath).toHaveBeenCalledWith(
        path.join(workspaceRootPath, 'nonexistent.txt'),
      );
    });
  });

  describe('データ妥当性検証', () => {
    it('不正なYAMLファイルをロードするとエラーが発生する', async () => {
      // 新しいパス構造に対応: .dialogoi/.{filename}.comments.yaml
      const commentFilePath = path.join(
        workspaceRootPath,
        '.dialogoi',
        `.${testRelativeFilePath}.comments.yaml`,
      );
      addFile(commentFilePath, 'file_hash: "test"\ninvalid: yaml: [unclosed');

      await expect(commentService.loadCommentFileAsync(testRelativeFilePath)).rejects.toThrow(
        'コメントファイル読み込みエラー',
      );
    });

    it('不正な形式のコメントファイルをロードするとエラーが発生する', async () => {
      // 新しいパス構造に対応: .dialogoi/.{filename}.comments.yaml
      const commentFilePath = path.join(
        workspaceRootPath,
        '.dialogoi',
        `.${testRelativeFilePath}.comments.yaml`,
      );
      addFile(commentFilePath, 'comments:\n  - invalid_field: "no required fields"');

      await expect(commentService.loadCommentFileAsync(testRelativeFilePath)).rejects.toThrow(
        'コメントファイルの形式が正しくありません',
      );
    });
  });
});
