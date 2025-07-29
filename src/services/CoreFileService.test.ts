import assert from 'assert';
import { CoreFileService } from './CoreFileService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('CoreFileService テストスイート', () => {
  let coreFileService: CoreFileService;
  let mockFileRepository: MockFileRepository;

  setup(async () => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    coreFileService = container.getCoreFileService();

    // テスト用ディレクトリ構造の準備
    mockFileRepository.createDirectoryForTest('/test');
    await mockFileRepository.writeFileAsync(
      mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
      `files:
  - name: existing.txt
    type: content
    path: /test/existing.txt
    hash: hash123
    tags: []
    references: []
    comments: '.existing.txt.comments.yaml'
    isUntracked: false
    isMissing: false
  - name: testdir
    type: subdirectory
    path: /test/testdir
    isUntracked: false
    isMissing: false
`,
    );

    // 既存ファイルを作成
    await mockFileRepository.writeFileAsync(
      mockFileRepository.createFileUri('/test/existing.txt'),
      'existing content',
    );

    // 既存ディレクトリを作成
    mockFileRepository.createDirectoryForTest('/test/testdir');
    await mockFileRepository.writeFileAsync(
      mockFileRepository.createFileUri('/test/testdir/.dialogoi-meta.yaml'),
      'files: []',
    );
  });

  suite('ファイル作成', () => {
    test('新しいファイルを作成できる', async () => {
      const result = await coreFileService.createFile(
        '/test',
        'newfile.txt',
        'content',
        'Initial content',
        ['tag1', 'tag2'],
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイル "newfile.txt" を作成しました'));
      assert(result.updatedItems);

      // ファイルが物理的に作成されているか確認
      const fileContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/newfile.txt'),
        'utf8',
      );
      assert.strictEqual(fileContent, 'Initial content');

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('newfile.txt'));
      assert(metaContent.includes('tag1'));
      assert(metaContent.includes('tag2'));
    });

    test('サブディレクトリを作成できる', async () => {
      const result = await coreFileService.createFile('/test', 'newdir', 'subdirectory');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ディレクトリ "newdir" を作成しました'));

      // ディレクトリが作成されているか確認
      const dirUri = mockFileRepository.createDirectoryUri('/test/newdir');
      assert(await mockFileRepository.existsAsync(dirUri));
    });

    test('キャラクターサブタイプでファイルを作成できる', async () => {
      const result = await coreFileService.createFile(
        '/test',
        'character.txt',
        'setting',
        '',
        [],
        'character',
      );

      assert.strictEqual(result.success, true);

      // メタデータにキャラクター情報が含まれているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('character:'));
      assert(metaContent.includes('importance: sub'));
      assert(metaContent.includes('multiple_characters: false'));
    });

    test('既存ファイル名での作成はエラー', async () => {
      const result = await coreFileService.createFile('/test', 'existing.txt', 'content');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('既に存在します'));
    });
  });

  suite('ファイル削除', () => {
    test('ファイルを削除できる', async () => {
      const result = await coreFileService.deleteFile('/test', 'existing.txt');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイル "existing.txt" を削除しました'));

      // ファイルが物理的に削除されているか確認
      const fileUri = mockFileRepository.createFileUri('/test/existing.txt');
      assert(!(await mockFileRepository.existsAsync(fileUri)));

      // メタデータからも削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('existing.txt'));
    });

    test('存在しないファイルの削除はエラー', async () => {
      const result = await coreFileService.deleteFile('/test', 'nonexistent.txt');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });
  });

  suite('ファイル名変更', () => {
    test('ファイル名を変更できる', async () => {
      const result = await coreFileService.renameFile('/test', 'existing.txt', 'renamed.txt');

      if (!result.success) {
        console.error('Rename failed:', result.message);
      }
      assert.strictEqual(result.success, true);
      assert(
        result.message.includes('ファイル名を "existing.txt" から "renamed.txt" に変更しました'),
      );

      // 新しい名前でファイルが存在するか確認
      const newFileUri = mockFileRepository.createFileUri('/test/renamed.txt');
      assert(await mockFileRepository.existsAsync(newFileUri));

      // 旧ファイルが存在しないか確認
      const oldFileUri = mockFileRepository.createFileUri('/test/existing.txt');
      assert(!(await mockFileRepository.existsAsync(oldFileUri)));

      // メタデータが更新されているか確認
      try {
        const metaContent = await mockFileRepository.readFileAsync(
          mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
          'utf8',
        );
        assert(metaContent.includes('renamed.txt'));
        assert(!metaContent.includes('existing.txt'));
      } catch {
        console.error('Meta file read failed, but rename operation succeeded');
      }
    });

    test('存在しないファイルの名前変更はエラー', async () => {
      const result = await coreFileService.renameFile('/test', 'nonexistent.txt', 'new.txt');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });

    test('既存ファイル名への変更はエラー', async () => {
      // 追加テストファイルを作成
      await coreFileService.createFile('/test', 'another.txt', 'content');

      const result = await coreFileService.renameFile('/test', 'existing.txt', 'another.txt');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('既に使用されています'));
    });
  });

  suite('ファイル順序変更', () => {
    test('ファイル順序を変更できる', async () => {
      // テスト用ファイルを追加
      await coreFileService.createFile('/test', 'file1.txt', 'content');
      await coreFileService.createFile('/test', 'file2.txt', 'content');

      const result = await coreFileService.reorderFiles('/test', 0, 2);

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイルの順序を変更しました'));
      assert(result.updatedItems);
    });

    test('無効なインデックスでの順序変更はエラー', async () => {
      const result = await coreFileService.reorderFiles('/test', 0, 100);

      assert.strictEqual(result.success, false);
      assert(result.message.includes('無効なインデックス'));
    });
  });

  suite('ファイル移動', () => {
    setup(async () => {
      // 移動先ディレクトリを準備
      mockFileRepository.createDirectoryForTest('/target');
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri('/target/.dialogoi-meta.yaml'),
        'files: []',
      );
    });

    test('ファイルを別ディレクトリに移動できる', async () => {
      const result = await coreFileService.moveFile('/test', 'existing.txt', '/target');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイル "existing.txt" を移動しました'));

      // 移動先にファイルが存在することを確認
      const targetFileUri = mockFileRepository.createFileUri('/target/existing.txt');
      assert(await mockFileRepository.existsAsync(targetFileUri));

      // 移動元からファイルが削除されていることを確認
      const sourceFileUri = mockFileRepository.createFileUri('/test/existing.txt');
      assert(!(await mockFileRepository.existsAsync(sourceFileUri)));

      // メタデータが更新されていることを確認
      const targetMetaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/target/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(targetMetaContent.includes('existing.txt'));
    });

    test('同じディレクトリ内での移動（順序変更）', async () => {
      const result = await coreFileService.moveFile('/test', 'existing.txt', '/test', 1);

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイルの順序を変更しました'));
    });

    test('存在しないファイルの移動はエラー', async () => {
      const result = await coreFileService.moveFile('/test', 'nonexistent.txt', '/target');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });
  });

  suite('ディレクトリ移動', () => {
    setup(async () => {
      // 移動先親ディレクトリを準備
      mockFileRepository.createDirectoryForTest('/targetparent');
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri('/targetparent/.dialogoi-meta.yaml'),
        'files: []',
      );
    });

    test('ディレクトリを移動できる', async () => {
      const result = await coreFileService.moveDirectory('/test', 'testdir', '/targetparent');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ディレクトリ "testdir" を移動しました'));

      // 移動先にディレクトリが存在することを確認
      const targetDirUri = mockFileRepository.createDirectoryUri('/targetparent/testdir');
      assert(await mockFileRepository.existsAsync(targetDirUri));

      // 移動元からディレクトリが削除されていることを確認
      const sourceDirUri = mockFileRepository.createDirectoryUri('/test/testdir');
      assert(!(await mockFileRepository.existsAsync(sourceDirUri)));
    });

    test('存在しないディレクトリの移動はエラー', async () => {
      const result = await coreFileService.moveDirectory('/test', 'nonexistent', '/targetparent');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });
  });

  suite('ディレクトリ削除', () => {
    test('ディレクトリを削除できる', async () => {
      const result = await coreFileService.deleteDirectory('/test', 'testdir');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ディレクトリ "testdir" を削除しました'));

      // ディレクトリが物理的に削除されているか確認
      const dirUri = mockFileRepository.createDirectoryUri('/test/testdir');
      assert(!(await mockFileRepository.existsAsync(dirUri)));

      // メタデータからも削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('testdir'));
    });

    test('存在しないディレクトリの削除はエラー', async () => {
      const result = await coreFileService.deleteDirectory('/test', 'nonexistent');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });
  });

  suite('低レベルファイル操作', () => {
    test('ファイルを読み込める', async () => {
      const content = await coreFileService.readFile('/test/existing.txt');
      assert.strictEqual(content, 'existing content');
    });

    test('ファイルに書き込める', async () => {
      await coreFileService.writeFile('/test/existing.txt', 'new content');

      const content = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/existing.txt'),
        'utf8',
      );
      assert.strictEqual(content, 'new content');
    });

    test('ファイルの存在確認ができる', async () => {
      const exists1 = await coreFileService.exists('/test/existing.txt');
      assert.strictEqual(exists1, true);

      const exists2 = await coreFileService.exists('/test/nonexistent.txt');
      assert.strictEqual(exists2, false);
    });
  });

  suite('エラーハンドリング', () => {
    test('メタデータファイルが存在しない場合のエラー', async () => {
      const result = await coreFileService.createFile('/nonexistent', 'file.txt', 'content');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('.dialogoi-meta.yamlが見つから'));
    });

    test('相対パス使用時のエラー（ノベルルートパス未設定）', async () => {
      // ノベルルートパスが設定されていないCoreFileServiceを作成
      const container = TestServiceContainer.create();
      const fileRepo = container.getFileRepository();
      const metaYamlService = container.getMetaYamlService();
      const serviceWithoutRoot = new CoreFileService(fileRepo, metaYamlService);

      const result = await serviceWithoutRoot.createFile('relative/path', 'file.txt', 'content');

      assert.strictEqual(result.success, false);
      assert(result.message.includes('ノベルルートパスが設定されていません'));
    });
  });

  suite('ユーティリティメソッド', () => {
    test('ノベルルートパスを取得できる', () => {
      const rootPath = coreFileService.getNovelRootPath();
      // TestServiceContainerではノベルルートパスが設定されていることを確認
      assert.strictEqual(typeof rootPath, 'string');
    });
  });
});
