import * as assert from 'assert';
import * as path from 'path';
import { FileOperationService } from './FileOperationService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYamlUtils } from '../utils/MetaYamlUtils.js';

// 型アサーション関数
function assertNotNull<T>(value: T | null): asserts value is T {
  assert.notStrictEqual(value, null);
}

function assertNotUndefined<T>(value: T | undefined): asserts value is T {
  assert.notStrictEqual(value, undefined);
}

suite('FileOperationService テストスイート', () => {
  let service: FileOperationService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;

  const testDir = '/test/project';
  const metaYamlPath = path.join(testDir, '.dialogoi-meta.yaml');

  setup(async () => {
    mockFileRepository = new MockFileRepository();
    metaYamlService = new MetaYamlService(mockFileRepository);
    service = new FileOperationService(mockFileRepository, metaYamlService);

    // テスト用のディレクトリとmeta.yamlを作成
    const testDirUri = mockFileRepository.createFileUri(testDir);
    await mockFileRepository.createDirectoryAsync(testDirUri);
    const meta = MetaYamlUtils.createMetaYaml('README.md');
    const metaContent = MetaYamlUtils.stringifyMetaYaml(meta);
    const metaUri = mockFileRepository.createFileUri(metaYamlPath);
    await mockFileRepository.writeFileAsync(metaUri, metaContent);
  });

  teardown(() => {
    mockFileRepository.reset();
  });

  suite('FileOperationService テスト', () => {
    suite('createFileAsync', () => {
      test('通常ファイルを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'test.txt', 'content', 'テスト内容');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'test.txt を作成しました。');

        // ファイルが作成されていることを確認
        const filePath = path.join(testDir, 'test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, true);

        const content = await mockFileRepository.readFileAsync(fileUri, 'utf8');
        assert.strictEqual(content, 'テスト内容');

        // meta.yamlにファイル情報が追加されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'test.txt');
        assertNotUndefined(fileItem);
        assert.strictEqual(fileItem.type, 'content');
        assert.strictEqual(fileItem.path, filePath);
      });

      test('サブディレクトリを正常に作成する', async () => {
        // 実行
        const result = await service.createFileAsync(testDir, 'subdir', 'subdirectory');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'subdir を作成しました。');

        // ディレクトリが作成されていることを確認
        const dirPath = path.join(testDir, 'subdir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, true);

        // サブディレクトリ内にmeta.yamlとREADME.mdが作成されていることを確認
        const metaPath = path.join(dirPath, '.dialogoi-meta.yaml');
        const metaUri = mockFileRepository.createFileUri(metaPath);
        const metaExists = await mockFileRepository.existsAsync(metaUri);
        assert.strictEqual(metaExists, true);

        const readmePath = path.join(dirPath, 'README.md');
        const readmeUri = mockFileRepository.createFileUri(readmePath);
        const readmeExists = await mockFileRepository.existsAsync(readmeUri);
        assert.strictEqual(readmeExists, true);
      });

      test('既に存在するファイルを作成しようとするとエラーになる', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 実行 - 同名ファイルを再度作成
        const result = await service.createFileAsync(testDir, 'existing.txt', 'content');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル existing.txt は既に存在します。');
      });

      test('タグ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'tagged.txt',
          'content',
          'タグ付きコンテンツ',
          ['タグ1', 'タグ2'],
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'tagged.txt');
        assertNotUndefined(fileItem);
        assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ2']);
      });

      test('キャラクターサブタイプ付きファイルを作成する', async () => {
        // 実行
        const result = await service.createFileAsync(
          testDir,
          'character.md',
          'setting',
          '',
          [],
          'character',
        );

        // 検証
        assert.strictEqual(result.success, true);

        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'character.md');
        assertNotUndefined(fileItem);
        assertNotUndefined(fileItem.character);
        assert.strictEqual(fileItem.character.importance, 'main');
        assert.strictEqual(fileItem.character.multiple_characters, false);
      });
    });

    suite('deleteFileAsync', () => {
      test('通常ファイルを正常に削除する', async () => {
        // 準備 - ファイルを作成
        await service.createFileAsync(testDir, 'delete-test.txt', 'content', 'テスト内容');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-test.txt');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-test.txt を削除しました。');

        // ファイルが削除されていることを確認
        const filePath = path.join(testDir, 'delete-test.txt');
        const fileUri = mockFileRepository.createFileUri(filePath);
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, false);

        // meta.yamlからファイル情報が削除されていることを確認
        const meta = await metaYamlService.loadMetaYamlAsync(testDir);
        assertNotNull(meta);
        const fileItem = meta.files.find((f) => f.name === 'delete-test.txt');
        assert.strictEqual(fileItem, undefined);
      });

      test('サブディレクトリを正常に削除する', async () => {
        // 準備 - サブディレクトリを作成
        await service.createFileAsync(testDir, 'delete-dir', 'subdirectory');

        // 実行
        const result = await service.deleteFileAsync(testDir, 'delete-dir');

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.message, 'delete-dir を削除しました。');

        // ディレクトリが削除されていることを確認
        const dirPath = path.join(testDir, 'delete-dir');
        const dirUri = mockFileRepository.createFileUri(dirPath);
        const dirExists = await mockFileRepository.existsAsync(dirUri);
        assert.strictEqual(dirExists, false);
      });

      test('存在しないファイルを削除しようとするとエラーになる', async () => {
        // 実行
        const result = await service.deleteFileAsync(testDir, 'nonexistent.txt');

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, 'ファイル nonexistent.txt が見つかりません。');
      });
    });

    suite('readFileAsync と writeFileAsync', () => {
      test('ファイルを書き込んで読み込む', async () => {
        const filePath = path.join(testDir, 'read-write-test.txt');
        const testContent = 'テスト内容です\n複数行のテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // 読み込み
        const readContent = await service.readFileAsync(filePath);

        // 検証
        assert.strictEqual(readContent, testContent);
      });

      test('存在するファイルの内容を上書きする', async () => {
        const filePath = path.join(testDir, 'overwrite-test.txt');
        const initialContent = '初期内容';
        const updatedContent = '更新された内容';

        // 初期書き込み
        await service.writeFileAsync(filePath, initialContent);

        // 読み込み確認
        let content = await service.readFileAsync(filePath);
        assert.strictEqual(content, initialContent);

        // 上書き
        await service.writeFileAsync(filePath, updatedContent);

        // 読み込み確認
        content = await service.readFileAsync(filePath);
        assert.strictEqual(content, updatedContent);
      });

      test('エンコーディングを指定してファイルを読み込む', async () => {
        const filePath = path.join(testDir, 'encoding-test.txt');
        const testContent = 'UTF-8でエンコードされたテキスト';

        // 書き込み
        await service.writeFileAsync(filePath, testContent);

        // UTF-8で読み込み
        const readContent = await service.readFileAsync(filePath, 'utf8');

        // 検証
        assert.strictEqual(readContent, testContent);
      });
    });

    suite('existsAsync', () => {
      test('存在するファイルでtrueを返す', async () => {
        // 準備 - ファイルを作成
        const filePath = path.join(testDir, 'exists-test.txt');
        await service.writeFileAsync(filePath, 'テスト内容');

        // 実行・検証
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, true);
      });

      test('存在しないファイルでfalseを返す', async () => {
        // 実行・検証
        const filePath = path.join(testDir, 'nonexistent.txt');
        const exists = await service.existsAsync(filePath);
        assert.strictEqual(exists, false);
      });

      test('存在するディレクトリでtrueを返す', async () => {
        // 実行・検証
        const exists = await service.existsAsync(testDir);
        assert.strictEqual(exists, true);
      });
    });

    suite('moveFileAsync', () => {
      test('ファイルを異なるディレクトリに移動する', async () => {
        // 準備
        const sourceDir = path.join(testDir, 'source');
        const targetDir = path.join(testDir, 'target');
        const fileName = 'test-file.txt';

        // ディレクトリを作成
        const sourceDirUri = mockFileRepository.createDirectoryUri(sourceDir);
        const targetDirUri = mockFileRepository.createDirectoryUri(targetDir);
        await mockFileRepository.createDirectoryAsync(sourceDirUri);
        await mockFileRepository.createDirectoryAsync(targetDirUri);

        // 移動元・移動先にmeta.yamlを作成
        const sourceMeta = {
          readme: 'README.md',
          files: [{ name: fileName, type: 'content' as const }],
        };
        const targetMeta = {
          readme: 'README.md',
          files: [],
        };

        const sourceMetaUri = mockFileRepository.createFileUri(
          path.join(sourceDir, '.dialogoi-meta.yaml'),
        );
        const targetMetaUri = mockFileRepository.createFileUri(
          path.join(targetDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(sourceMetaUri, JSON.stringify(sourceMeta));
        await mockFileRepository.writeFileAsync(targetMetaUri, JSON.stringify(targetMeta));

        // 移動元ファイルを作成
        const sourceFilePath = path.join(sourceDir, fileName);
        const sourceFileUri = mockFileRepository.createFileUri(sourceFilePath);
        await mockFileRepository.writeFileAsync(sourceFileUri, 'テスト内容');

        // 実行
        const result = await service.moveFileAsync(sourceDir, fileName, targetDir);

        // 検証
        assert.strictEqual(result.success, true);
        assert.strictEqual(
          result.message,
          `${fileName} を ${sourceDir} から ${targetDir} に移動しました。`,
        );

        // ファイルが移動されていることを確認
        const targetFilePath = path.join(targetDir, fileName);
        const targetFileUri = mockFileRepository.createFileUri(targetFilePath);
        const targetExists = await mockFileRepository.existsAsync(targetFileUri);
        const sourceExists = await mockFileRepository.existsAsync(sourceFileUri);
        assert.strictEqual(targetExists, true);
        assert.strictEqual(sourceExists, false);
      });

      test('移動元ファイルが存在しない場合はエラーになる', async () => {
        // 準備
        const sourceDir = path.join(testDir, 'source');
        const targetDir = path.join(testDir, 'target');
        const fileName = 'nonexistent.txt';

        const sourceDirUri = mockFileRepository.createDirectoryUri(sourceDir);
        const targetDirUri = mockFileRepository.createDirectoryUri(targetDir);
        await mockFileRepository.createDirectoryAsync(sourceDirUri);
        await mockFileRepository.createDirectoryAsync(targetDirUri);

        // 実行
        const result = await service.moveFileAsync(sourceDir, fileName, targetDir);

        // 検証
        assert.strictEqual(result.success, false);
        assert.strictEqual(result.message, `移動元ファイル ${fileName} が見つかりません。`);
      });

      test('相対パスでも正しく処理される', async () => {
        // 準備: ノベルルート設定のサービスを作成
        const serviceWithRoot = new FileOperationService(
          mockFileRepository,
          metaYamlService,
          testDir,
        );

        const sourceDir = 'source'; // 相対パス
        const targetDir = 'target'; // 相対パス
        const fileName = 'relative-test.txt';

        const absoluteSourceDir = path.join(testDir, sourceDir);
        const absoluteTargetDir = path.join(testDir, targetDir);

        const absoluteSourceDirUri = mockFileRepository.createDirectoryUri(absoluteSourceDir);
        const absoluteTargetDirUri = mockFileRepository.createDirectoryUri(absoluteTargetDir);
        await mockFileRepository.createDirectoryAsync(absoluteSourceDirUri);
        await mockFileRepository.createDirectoryAsync(absoluteTargetDirUri);

        // meta.yamlファイルを作成
        const sourceMeta = {
          readme: 'README.md',
          files: [{ name: fileName, type: 'content' as const }],
        };
        const targetMeta = {
          readme: 'README.md',
          files: [],
        };

        const sourceMetaUri = mockFileRepository.createFileUri(
          path.join(absoluteSourceDir, '.dialogoi-meta.yaml'),
        );
        const targetMetaUri = mockFileRepository.createFileUri(
          path.join(absoluteTargetDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(sourceMetaUri, JSON.stringify(sourceMeta));
        await mockFileRepository.writeFileAsync(targetMetaUri, JSON.stringify(targetMeta));

        // 移動元ファイルを作成
        const sourceFileUri = mockFileRepository.createFileUri(
          path.join(absoluteSourceDir, fileName),
        );
        await mockFileRepository.writeFileAsync(sourceFileUri, 'テスト内容');

        // 実行（相対パスで指定）
        const result = await serviceWithRoot.moveFileAsync(sourceDir, fileName, targetDir);

        // 検証
        assert.strictEqual(result.success, true);

        // ファイルが移動されていることを確認
        const targetFileUri = mockFileRepository.createFileUri(
          path.join(absoluteTargetDir, fileName),
        );
        const targetExists = await mockFileRepository.existsAsync(targetFileUri);
        const sourceExists = await mockFileRepository.existsAsync(sourceFileUri);
        assert.strictEqual(targetExists, true);
        assert.strictEqual(sourceExists, false);
      });

      test('同じディレクトリ内での並び替え（ファイル移動なし）', async () => {
        // 準備: ノベルルート設定のサービスを作成
        const serviceWithRoot = new FileOperationService(
          mockFileRepository,
          metaYamlService,
          testDir,
        );

        const dirPath = 'contents'; // 相対パス
        const fileName = 'reorder-test.txt';

        const absoluteDirPath = path.join(testDir, dirPath);
        const absoluteDirUri = mockFileRepository.createDirectoryUri(absoluteDirPath);
        await mockFileRepository.createDirectoryAsync(absoluteDirUri);

        // meta.yamlファイルを作成
        const meta = {
          readme: 'README.md',
          files: [
            { name: fileName, type: 'content' as const },
            { name: 'other.txt', type: 'content' as const },
          ],
        };

        const metaUri = mockFileRepository.createFileUri(
          path.join(absoluteDirPath, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(metaUri, JSON.stringify(meta));

        // ファイルを作成
        const fileUri = mockFileRepository.createFileUri(path.join(absoluteDirPath, fileName));
        await mockFileRepository.writeFileAsync(fileUri, 'テスト内容');

        const otherFileUri = mockFileRepository.createFileUri(
          path.join(absoluteDirPath, 'other.txt'),
        );
        await mockFileRepository.writeFileAsync(otherFileUri, 'その他の内容');

        // 実行（同じディレクトリ内での移動 = 並び替え）
        const result = await serviceWithRoot.moveFileAsync(dirPath, fileName, dirPath, 1);

        // 検証
        assert.strictEqual(result.success, true, `操作が失敗しました: ${result.message}`);

        // ファイルは物理的に移動されていないことを確認
        const fileExists = await mockFileRepository.existsAsync(fileUri);
        assert.strictEqual(fileExists, true);
      });

      test('コメントファイルも一緒に移動される', async () => {
        // テストディレクトリ構造を作成
        const sourceDir = '/test/project/source';
        const targetDir = '/test/project/target';

        const sourceDirUri = mockFileRepository.createDirectoryUri(sourceDir);
        const targetDirUri = mockFileRepository.createDirectoryUri(targetDir);
        await mockFileRepository.createDirectoryAsync(sourceDirUri);
        await mockFileRepository.createDirectoryAsync(targetDirUri);

        const fileName = 'test-file.txt';
        const commentFileName = '.test-file.txt.comments.yaml';

        // 移動元のmeta.yamlを作成（コメントファイル付き）
        const sourceMeta = {
          readme: 'README.md',
          files: [
            {
              name: fileName,
              type: 'content' as const,
              path: path.join(sourceDir, fileName),
              comments: commentFileName,
            },
          ],
        };

        const sourceMetaUri = mockFileRepository.createFileUri(
          path.join(sourceDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(
          sourceMetaUri,
          MetaYamlUtils.stringifyMetaYaml(sourceMeta),
        );

        // 移動先のmeta.yamlを作成
        const targetMeta = {
          readme: 'README.md',
          files: [] as Array<{
            name: string;
            type: 'content' | 'setting' | 'subdirectory';
            path: string;
            comments?: string;
          }>,
        };

        const targetMetaUri = mockFileRepository.createFileUri(
          path.join(targetDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(
          targetMetaUri,
          MetaYamlUtils.stringifyMetaYaml(targetMeta),
        );

        // 移動元にファイルとコメントファイルを作成
        const sourceFileUri = mockFileRepository.createFileUri(path.join(sourceDir, fileName));
        await mockFileRepository.writeFileAsync(sourceFileUri, 'テスト内容');

        const sourceCommentUri = mockFileRepository.createFileUri(
          path.join(sourceDir, commentFileName),
        );
        await mockFileRepository.writeFileAsync(
          sourceCommentUri,
          'comments:\n  - id: 1\n    content: テストコメント',
        );

        // 移動実行
        const result = await service.moveFileAsync(sourceDir, fileName, targetDir);

        // 検証
        assert.strictEqual(result.success, true, `移動が失敗しました: ${result.message}`);

        // メインファイルが移動されたことを確認
        const sourceFileExists = await mockFileRepository.existsAsync(sourceFileUri);
        assert.strictEqual(sourceFileExists, false, '移動元のファイルが削除されていません');

        const targetFileUri = mockFileRepository.createFileUri(path.join(targetDir, fileName));
        const targetFileExists = await mockFileRepository.existsAsync(targetFileUri);
        assert.strictEqual(targetFileExists, true, '移動先にファイルが作成されていません');

        // コメントファイルも移動されたことを確認
        const sourceCommentExists = await mockFileRepository.existsAsync(sourceCommentUri);
        assert.strictEqual(
          sourceCommentExists,
          false,
          '移動元のコメントファイルが削除されていません',
        );

        const targetCommentUri = mockFileRepository.createFileUri(
          path.join(targetDir, commentFileName),
        );
        const targetCommentExists = await mockFileRepository.existsAsync(targetCommentUri);
        assert.strictEqual(
          targetCommentExists,
          true,
          '移動先にコメントファイルが作成されていません',
        );

        // コメントファイルの内容が保持されていることを確認
        const commentContent = await mockFileRepository.readFileAsync(targetCommentUri, 'utf8');
        assert.strictEqual(
          commentContent.includes('テストコメント'),
          true,
          'コメントファイルの内容が保持されていません',
        );
      });

      test('コメントファイルが設定されていない場合は通常の移動のみ実行される', async () => {
        // テストディレクトリ構造を作成
        const sourceDir = '/test/project/source';
        const targetDir = '/test/project/target';

        const sourceDirUri = mockFileRepository.createDirectoryUri(sourceDir);
        const targetDirUri = mockFileRepository.createDirectoryUri(targetDir);
        await mockFileRepository.createDirectoryAsync(sourceDirUri);
        await mockFileRepository.createDirectoryAsync(targetDirUri);

        const fileName = 'test-file.txt';

        // 移動元のmeta.yamlを作成（コメントファイルなし）
        const sourceMeta = {
          readme: 'README.md',
          files: [
            {
              name: fileName,
              type: 'content' as const,
              path: path.join(sourceDir, fileName),
              // commentsプロパティなし
            },
          ],
        };

        const sourceMetaUri = mockFileRepository.createFileUri(
          path.join(sourceDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(
          sourceMetaUri,
          MetaYamlUtils.stringifyMetaYaml(sourceMeta),
        );

        // 移動先のmeta.yamlを作成
        const targetMeta = {
          readme: 'README.md',
          files: [] as Array<{
            name: string;
            type: 'content' | 'setting' | 'subdirectory';
            path: string;
          }>,
        };

        const targetMetaUri = mockFileRepository.createFileUri(
          path.join(targetDir, '.dialogoi-meta.yaml'),
        );
        await mockFileRepository.writeFileAsync(
          targetMetaUri,
          MetaYamlUtils.stringifyMetaYaml(targetMeta),
        );

        // 移動元にファイルを作成
        const sourceFileUri = mockFileRepository.createFileUri(path.join(sourceDir, fileName));
        await mockFileRepository.writeFileAsync(sourceFileUri, 'テスト内容');

        // 移動実行
        const result = await service.moveFileAsync(sourceDir, fileName, targetDir);

        // 検証
        assert.strictEqual(result.success, true, `移動が失敗しました: ${result.message}`);

        // メインファイルが移動されたことを確認
        const sourceFileExists = await mockFileRepository.existsAsync(sourceFileUri);
        assert.strictEqual(sourceFileExists, false, '移動元のファイルが削除されていません');

        const targetFileUri = mockFileRepository.createFileUri(path.join(targetDir, fileName));
        const targetFileExists = await mockFileRepository.existsAsync(targetFileUri);
        assert.strictEqual(targetFileExists, true, '移動先にファイルが作成されていません');
      });
    });
  });
});
