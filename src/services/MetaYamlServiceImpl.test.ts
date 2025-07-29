import * as assert from 'assert';
import { MetaYamlServiceImpl } from './MetaYamlServiceImpl.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { createContentItem, createSubdirectoryItem } from '../test/testHelpers.js';

suite('MetaYamlServiceImpl テストスイート', () => {
  let service: MetaYamlServiceImpl;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;

  setup(() => {
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    service = testContainer.getMetaYamlService() as MetaYamlServiceImpl;
  });

  teardown(() => {
    mockFileRepository.reset();
    testContainer.cleanup();
  });

  suite('loadMetaYamlAsync', () => {
    test('正常な.dialogoi-meta.yamlファイルを読み込む', async () => {
      const testDir = '/test/project';

      const contentItem = createContentItem({
        name: 'chapter1.txt',
        path: `${testDir}/chapter1.txt`,
        tags: ['重要', '序章'],
      });

      const subdirItem = createSubdirectoryItem({
        name: 'settings',
        path: `${testDir}/settings`,
      });

      const metaContent = `readme: README.md
files:
  - name: ${contentItem.name}
    type: ${contentItem.type}
    path: ${contentItem.path}
    hash: ${contentItem.hash}
    tags:
      - 重要
      - 序章
    references: []
    comments: ${contentItem.comments}
    isUntracked: ${contentItem.isUntracked}
    isMissing: ${contentItem.isMissing}
  - name: ${subdirItem.name}
    type: ${subdirItem.type}
    path: ${subdirItem.path}
    isUntracked: ${subdirItem.isUntracked}
    isMissing: ${subdirItem.isMissing}`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.loadMetaYamlAsync(testDir);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 2);
      assert.strictEqual(result?.files[0]?.name, 'chapter1.txt');
      assert.strictEqual(result?.files[0]?.type, 'content');
      assert.deepStrictEqual(result?.files[0]?.tags, ['重要', '序章']);
      assert.strictEqual(result?.files[1]?.name, 'settings');
      assert.strictEqual(result?.files[1]?.type, 'subdirectory');
    });

    test('.dialogoi-meta.yamlファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = await service.loadMetaYamlAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('不正なYAMLファイルの場合nullを返す', async () => {
      const testDir = '/test/project';
      const invalidYaml = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /test/project/chapter1.txt
    hash: hash123
    tags: []
    references: []
    comments: ''
    isUntracked: false
    isMissing: false
  - invalid: yaml: content`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, invalidYaml);

      const result = await service.loadMetaYamlAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('空の.dialogoi-meta.yamlファイルの場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, '');

      const result = await service.loadMetaYamlAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('最小構成の.dialogoi-meta.yamlファイルを読み込む', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.loadMetaYamlAsync(testDir);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, undefined);
      assert.strictEqual(result?.files.length, 0);
    });
  });

  suite('saveMetaYamlAsync', () => {
    test('正常なMetaYamlオブジェクトを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            comments: '.chapter1.txt.comments.yaml',
            hash: 'abc123',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: `${testDir}/settings`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      assert.strictEqual(result, true);

      // 保存されたファイルを確認
      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('readme: README.md'));
      assert.ok(savedContent.includes('name: chapter1.txt'));
      assert.ok(savedContent.includes('type: content'));
      assert.ok(savedContent.includes('comments: .chapter1.txt.comments.yaml'));
      assert.ok(savedContent.includes('hash: abc123'));
    });

    test('空のfilesを持つMetaYamlを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      assert.strictEqual(result, true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('readme: README.md'));
      assert.ok(savedContent.includes('files: []'));
    });

    test('readmeがないMetaYamlを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        files: [
          createContentItem({
            name: 'test.txt',
            path: `${testDir}/test.txt`,
            hash: 'hash123',
            comments: '.test.txt.comments.yaml',
          }),
        ],
      };

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      assert.strictEqual(result, true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('name: test.txt'));
      assert.ok(savedContent.includes('type: content'));
      assert.ok(!savedContent.includes('readme:'));
    });

    test('バリデーションエラーがある場合falseを返す', async () => {
      const testDir = '/test/project';
      const invalidMeta = {
        readme: 'README.md',
        files: [
          {
            name: '', // 空の名前はエラー
            type: 'content',
            path: `${testDir}/test.txt`,
          },
        ],
      } as MetaYaml;

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, invalidMeta);
      assert.strictEqual(result, false);

      // .dialogoi-meta.yamlファイルが作成されていないことを確認
      const metaUri = mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaUri), false);
    });

    test('複数のバリデーションエラーがある場合falseを返す', async () => {
      const testDir = '/test/project';
      const invalidMeta = {
        files: [
          {
            name: '', // 空の名前はエラー
            type: 'invalid', // 不正なタイプはエラー
            path: `${testDir}/test.txt`,
            tags: 'invalid', // 文字列はエラー（配列である必要がある）
            character: {
              importance: 'invalid', // 不正な重要度はエラー
              multiple_characters: 'invalid', // 不正な型はエラー
            },
          },
        ],
      } as unknown as MetaYaml;

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, invalidMeta);
      assert.strictEqual(result, false);
    });
  });

  suite('getReadmeFilePathAsync', () => {
    test('readmeファイルが存在する場合パスを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      assert.strictEqual(result, `${testDir}/README.md`);
    });

    test('readmeファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      // README.mdファイルは作成しない

      const result = await service.getReadmeFilePathAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('.dialogoi-meta.yamlにreadmeが設定されていない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.getReadmeFilePathAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('.dialogoi-meta.yamlが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = await service.getReadmeFilePathAsync(testDir);
      assert.strictEqual(result, null);
    });

    test('相対パスのreadmeファイルを正しく解決する', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: docs/README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addDirectory(`${testDir}/docs`);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/docs/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      assert.strictEqual(result, `${testDir}/docs/README.md`);
    });
  });

  suite('findNovelRootAsync', () => {
    test('dialogoi.yamlが存在するディレクトリを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/novel';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      assert.strictEqual(result, novelRoot);
    });

    test('深い階層のdialogoiプロジェクトを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/projects/novel/src';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects`);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects/novel`);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      assert.strictEqual(result, novelRoot);
    });

    test('複数のdialogoiプロジェクトがある場合最初に見つかったものを返す', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot1 = '/test/workspace/project1';
      const novelRoot2 = '/test/workspace/project2';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(novelRoot1);
      mockFileRepository.addDirectory(novelRoot2);
      mockFileRepository.addFile(`${novelRoot1}/dialogoi.yaml`, 'version: 1.0');
      mockFileRepository.addFile(`${novelRoot2}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      // どちらか一方が返されることを確認（実装に依存）
      assert.ok(result === novelRoot1 || result === novelRoot2);
    });

    test('dialogoi.yamlが存在しない場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/project1`);
      mockFileRepository.addDirectory(`${workspaceRoot}/project2`);

      const result = await service.findNovelRootAsync(workspaceRoot);
      assert.strictEqual(result, null);
    });

    test('ワークスペースルート自体にdialogoiプロジェクトがある場合', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addFile(`${workspaceRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      assert.strictEqual(result, workspaceRoot);
    });

    test('空のディレクトリの場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);

      const result = await service.findNovelRootAsync(workspaceRoot);
      assert.strictEqual(result, null);
    });
  });

  suite('相互運用テスト', () => {
    test('loadMetaYamlとsaveMetaYamlの相互運用', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            tags: ['重要', '序章'],
            references: ['settings/world.md'],
            comments: '.chapter1.txt.comments.yaml',
            hash: 'abc123',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);

      // 保存 -> 読み込み -> 保存 -> 読み込み
      const saveResult1 = await service.saveMetaYamlAsync(testDir, meta);
      assert.strictEqual(saveResult1, true);

      const loadResult1 = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(loadResult1, null);

      if (loadResult1 !== null) {
        const saveResult2 = await service.saveMetaYamlAsync(testDir, loadResult1);
        assert.strictEqual(saveResult2, true);

        const loadResult2 = await service.loadMetaYamlAsync(testDir);
        assert.notStrictEqual(loadResult2, null);

        // 両方の読み込み結果が同じであることを確認
        assert.deepStrictEqual(loadResult1, loadResult2);
      }
    });
  });

  suite('タグ操作テスト', () => {
    test('updateFileTagsでタグを正常に更新する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1', '既存タグ2'],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを更新
      const newTags = ['新タグ1', '新タグ2', '新タグ3'];
      const result = await service.updateFileTags(testDir, fileName, newTags);
      assert.strictEqual(result, true);

      // 更新されたタグを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, newTags);
        }
      }
    });

    test('updateFileTagsでタグを空にする', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1', '既存タグ2'],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを空にする
      const result = await service.updateFileTags(testDir, fileName, []);
      assert.strictEqual(result, true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, []);
        }
      }
    });

    test('addFileTagで新しいタグを追加する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 新しいタグを追加
      const result = await service.addFileTag(testDir, fileName, '新タグ');
      assert.strictEqual(result, true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, ['既存タグ1', '新タグ']);
        }
      }
    });

    test('addFileTagで重複タグを追加しても成功する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['既存タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 既存のタグを追加
      const result = await service.addFileTag(testDir, fileName, '既存タグ1');
      assert.strictEqual(result, true);

      // タグが重複していないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, ['既存タグ1']);
        }
      }
    });

    test('addFileTagでタグがないファイルに新規追加', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: `.${fileName}.comments.yaml`,
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 新しいタグを追加
      const result = await service.addFileTag(testDir, fileName, '新タグ');
      assert.strictEqual(result, true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, ['新タグ']);
        }
      }
    });

    test('removeFileTagでタグを削除する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1', 'タグ2', 'タグ3'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // タグを削除
      const result = await service.removeFileTag(testDir, fileName, 'タグ2');
      assert.strictEqual(result, true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ3']);
        }
      }
    });

    test('removeFileTagで最後のタグを削除するとtagsフィールドが削除される', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 最後のタグを削除
      const result = await service.removeFileTag(testDir, fileName, 'タグ1');
      assert.strictEqual(result, true);

      // tagsフィールドが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, []);
        }
      }
    });

    test('removeFileTagで存在しないタグを削除しても成功する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            hash: 'hash123',
            tags: ['タグ1'],
            references: [],
            comments: '.test.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 存在しないタグを削除
      const result = await service.removeFileTag(testDir, fileName, '存在しないタグ');
      assert.strictEqual(result, true);

      // タグが変更されていないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          assert.deepStrictEqual(fileItem.tags, ['タグ1']);
        }
      }
    });

    test('.dialogoi-meta.yamlが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';

      mockFileRepository.addDirectory(testDir);

      const updateResult = await service.updateFileTags(testDir, fileName, ['タグ']);
      assert.strictEqual(updateResult, false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(addResult, false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(removeResult, false);
    });

    test('ファイルが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'nonexistent.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      const updateResult = await service.updateFileTags(testDir, fileName, ['タグ']);
      assert.strictEqual(updateResult, false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(addResult, false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(removeResult, true); // タグがない場合は成功とする仕様
    });
  });

  suite('moveFileInMetadata', () => {
    test('同じディレクトリ内でのファイル並び替え', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${testDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file2.txt',
            type: 'content',
            path: `${testDir}/file2.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file2.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file3.txt',
            type: 'content',
            path: `${testDir}/file3.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file3.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // file1.txt（インデックス0）をインデックス2に移動
      const result = await service.moveFileInMetadata(testDir, testDir, 'file1.txt', 2);

      assert.strictEqual(result.success, true);

      // メタデータを再読み込みして順序を確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        assert.strictEqual(updatedMeta.files.length, 3);
        assert.strictEqual(updatedMeta.files[0]?.name, 'file2.txt');
        assert.strictEqual(updatedMeta.files[1]?.name, 'file3.txt');
        assert.strictEqual(updatedMeta.files[2]?.name, 'file1.txt');
      }
    });

    test('異なるディレクトリ間でのファイル移動', async () => {
      const sourceDir = '/test/source';
      const targetDir = '/test/target';

      const sourceMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${sourceDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
          {
            name: 'file2.txt',
            type: 'content',
            path: `${sourceDir}/file2.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file2.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const targetMeta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file3.txt',
            type: 'content',
            path: `${targetDir}/file3.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file3.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(sourceDir);
      mockFileRepository.addDirectory(targetDir);
      await service.saveMetaYamlAsync(sourceDir, sourceMeta);
      await service.saveMetaYamlAsync(targetDir, targetMeta);

      // file1.txtを移動
      const result = await service.moveFileInMetadata(sourceDir, targetDir, 'file1.txt', 0);

      assert.strictEqual(result.success, true);

      // 移動元を確認
      const updatedSourceMeta = await service.loadMetaYamlAsync(sourceDir);
      assert.notStrictEqual(updatedSourceMeta, null);
      if (updatedSourceMeta !== null) {
        assert.strictEqual(updatedSourceMeta.files.length, 1);
        assert.strictEqual(updatedSourceMeta.files[0]?.name, 'file2.txt');
      }

      // 移動先を確認
      const updatedTargetMeta = await service.loadMetaYamlAsync(targetDir);
      assert.notStrictEqual(updatedTargetMeta, null);
      if (updatedTargetMeta !== null) {
        assert.strictEqual(updatedTargetMeta.files.length, 2);
        assert.strictEqual(updatedTargetMeta.files[0]?.name, 'file1.txt');
        assert.strictEqual(updatedTargetMeta.files[1]?.name, 'file3.txt');
        // パスが更新されていることを確認
        assert.strictEqual(updatedTargetMeta.files[0]?.path, `${targetDir}/file1.txt`);
      }
    });

    test('同じディレクトリ内で重複ファイル移動を試行（エラーにならない）', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'file1.txt',
            type: 'content',
            path: `${testDir}/file1.txt`,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.file1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      await service.saveMetaYamlAsync(testDir, meta);

      // 同じディレクトリ内で同名ファイルを移動（重複だがエラーにならない）
      const result = await service.moveFileInMetadata(testDir, testDir, 'file1.txt', 0);

      assert.strictEqual(result.success, true);
    });
  });
});
