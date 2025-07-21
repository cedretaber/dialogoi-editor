import * as assert from 'assert';
import { MetaYamlService } from './MetaYamlService.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import { ReviewSummary } from '../models/Review.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('MetaYamlService テストスイート', () => {
  let service: MetaYamlService;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;

  setup(() => {
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    service = testContainer.getMetaYamlService();
  });

  teardown(() => {
    mockFileRepository.reset();
    testContainer.cleanup();
  });

  suite('loadMetaYaml', () => {
    test('正常な.dialogoi-meta.yamlファイルを読み込む', () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: ${testDir}/chapter1.txt
    tags:
      - 重要
      - 序章
  - name: settings
    type: subdirectory
    path: ${testDir}/settings`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.loadMetaYaml(testDir);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, 'README.md');
      assert.strictEqual(result?.files.length, 2);
      assert.strictEqual(result?.files[0]?.name, 'chapter1.txt');
      assert.strictEqual(result?.files[0]?.type, 'content');
      assert.deepStrictEqual(result?.files[0]?.tags, ['重要', '序章']);
      assert.strictEqual(result?.files[1]?.name, 'settings');
      assert.strictEqual(result?.files[1]?.type, 'subdirectory');
    });

    test('.dialogoi-meta.yamlファイルが存在しない場合nullを返す', () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = service.loadMetaYaml(testDir);
      assert.strictEqual(result, null);
    });

    test('不正なYAMLファイルの場合nullを返す', () => {
      const testDir = '/test/project';
      const invalidYaml = `readme: README.md
files:
  - name: chapter1.txt
    type: content
  - invalid: yaml: content`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, invalidYaml);

      const result = service.loadMetaYaml(testDir);
      assert.strictEqual(result, null);
    });

    test('空の.dialogoi-meta.yamlファイルの場合nullを返す', () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, '');

      const result = service.loadMetaYaml(testDir);
      assert.strictEqual(result, null);
    });

    test('最小構成の.dialogoi-meta.yamlファイルを読み込む', () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.loadMetaYaml(testDir);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.readme, undefined);
      assert.strictEqual(result?.files.length, 0);
    });
  });

  suite('saveMetaYaml', () => {
    test('正常なMetaYamlオブジェクトを保存する', () => {
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
            character: {
              importance: 'main',
              multiple_characters: false,
              display_name: '主人公',
            },
            foreshadowing: {
              plants: [{ location: 'chapter1.txt', comment: '伏線の設置' }],
              payoff: { location: 'chapter10.txt', comment: '伏線の回収' },
            },
            reviews: 'chapter1.txt_reviews.yaml',
            review_count: {
              open: 2,
              in_progress: 1,
              resolved: 3,
              dismissed: 0,
            },
            glossary: true,
            hash: 'abc123',
          },
          {
            name: 'settings',
            type: 'subdirectory',
            path: `${testDir}/settings`,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);

      const result = service.saveMetaYaml(testDir, meta);
      assert.strictEqual(result, true);

      // 保存されたファイルを確認
      const savedContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('readme: README.md'));
      assert.ok(savedContent.includes('name: chapter1.txt'));
      assert.ok(savedContent.includes('type: content'));
      assert.ok(savedContent.includes('importance: main'));
      assert.ok(savedContent.includes('display_name: 主人公'));
      assert.ok(savedContent.includes('location: chapter1.txt'));
      assert.ok(savedContent.includes('location: chapter10.txt'));
      assert.ok(savedContent.includes('open: 2'));
      assert.ok(savedContent.includes('glossary: true'));
      assert.ok(savedContent.includes('hash: abc123'));
    });

    test('空のfilesを持つMetaYamlを保存する', () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      mockFileRepository.addDirectory(testDir);

      const result = service.saveMetaYaml(testDir, meta);
      assert.strictEqual(result, true);

      const savedContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('readme: README.md'));
      assert.ok(savedContent.includes('files: []'));
    });

    test('readmeがないMetaYamlを保存する', () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        files: [
          {
            name: 'test.txt',
            type: 'content',
            path: `${testDir}/test.txt`,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);

      const result = service.saveMetaYaml(testDir, meta);
      assert.strictEqual(result, true);

      const savedContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      assert.ok(savedContent.includes('name: test.txt'));
      assert.ok(savedContent.includes('type: content'));
      assert.ok(!savedContent.includes('readme:'));
    });

    test('バリデーションエラーがある場合falseを返す', () => {
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

      const result = service.saveMetaYaml(testDir, invalidMeta);
      assert.strictEqual(result, false);

      // .dialogoi-meta.yamlファイルが作成されていないことを確認
      const metaUri = mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`);
      assert.strictEqual(mockFileRepository.existsSync(metaUri), false);
    });

    test('複数のバリデーションエラーがある場合falseを返す', () => {
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

      const result = service.saveMetaYaml(testDir, invalidMeta);
      assert.strictEqual(result, false);
    });
  });

  suite('getReadmeFilePath', () => {
    test('readmeファイルが存在する場合パスを返す', () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/README.md`, '# Test Project');

      const result = service.getReadmeFilePath(testDir);
      assert.strictEqual(result, `${testDir}/README.md`);
    });

    test('readmeファイルが存在しない場合nullを返す', () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      // README.mdファイルは作成しない

      const result = service.getReadmeFilePath(testDir);
      assert.strictEqual(result, null);
    });

    test('.dialogoi-meta.yamlにreadmeが設定されていない場合nullを返す', () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.getReadmeFilePath(testDir);
      assert.strictEqual(result, null);
    });

    test('.dialogoi-meta.yamlが存在しない場合nullを返す', () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = service.getReadmeFilePath(testDir);
      assert.strictEqual(result, null);
    });

    test('相対パスのreadmeファイルを正しく解決する', () => {
      const testDir = '/test/project';
      const metaContent = `readme: docs/README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addDirectory(`${testDir}/docs`);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/docs/README.md`, '# Test Project');

      const result = service.getReadmeFilePath(testDir);
      assert.strictEqual(result, `${testDir}/docs/README.md`);
    });
  });

  suite('findNovelRoot', () => {
    test('dialogoi.yamlが存在するディレクトリを見つける', () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/novel';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = service.findNovelRoot(workspaceRoot);
      assert.strictEqual(result, novelRoot);
    });

    test('深い階層のdialogoiプロジェクトを見つける', () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/projects/novel/src';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects`);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects/novel`);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = service.findNovelRoot(workspaceRoot);
      assert.strictEqual(result, novelRoot);
    });

    test('複数のdialogoiプロジェクトがある場合最初に見つかったものを返す', () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot1 = '/test/workspace/project1';
      const novelRoot2 = '/test/workspace/project2';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(novelRoot1);
      mockFileRepository.addDirectory(novelRoot2);
      mockFileRepository.addFile(`${novelRoot1}/dialogoi.yaml`, 'version: 1.0');
      mockFileRepository.addFile(`${novelRoot2}/dialogoi.yaml`, 'version: 1.0');

      const result = service.findNovelRoot(workspaceRoot);
      // どちらか一方が返されることを確認（実装に依存）
      assert.ok(result === novelRoot1 || result === novelRoot2);
    });

    test('dialogoi.yamlが存在しない場合nullを返す', () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/project1`);
      mockFileRepository.addDirectory(`${workspaceRoot}/project2`);

      const result = service.findNovelRoot(workspaceRoot);
      assert.strictEqual(result, null);
    });

    test('ワークスペースルート自体にdialogoiプロジェクトがある場合', () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addFile(`${workspaceRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = service.findNovelRoot(workspaceRoot);
      assert.strictEqual(result, workspaceRoot);
    });

    test('空のディレクトリの場合nullを返す', () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);

      const result = service.findNovelRoot(workspaceRoot);
      assert.strictEqual(result, null);
    });
  });

  suite('updateReviewInfo', () => {
    test('レビュー情報を正常に更新する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const reviewSummary: ReviewSummary = {
        open: 2,
        in_progress: 1,
        resolved: 3,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, true);

      // 更新された.dialogoi-meta.yamlを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(typeof fileItem.reviews, 'string');
          assert.strictEqual(fileItem.review_count?.open, 2);
          assert.strictEqual(fileItem.review_count?.in_progress, 1);
          assert.strictEqual(fileItem.review_count?.resolved, 3);
          assert.strictEqual(fileItem.review_count?.dismissed, undefined);
        }
      }
    });

    test('レビュー情報がない場合（null）は削除する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}
    reviews: chapter1.txt_reviews.yaml
    review_count:
      open: 2
      resolved: 1`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.updateReviewInfo(testDir, fileName, null);
      assert.strictEqual(result, true);

      // 更新された.dialogoi-meta.yamlを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.reviews, undefined);
          assert.strictEqual(fileItem.review_count, undefined);
        }
      }
    });

    test('レビュー件数がすべて0の場合は削除する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const reviewSummary: ReviewSummary = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, true);

      // 更新された.dialogoi-meta.yamlを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.reviews, undefined);
          assert.strictEqual(fileItem.review_count, undefined);
        }
      }
    });

    test('0でない値のみが設定される', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const reviewSummary: ReviewSummary = {
        open: 1,
        in_progress: 0,
        resolved: 2,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, true);

      // 更新された.dialogoi-meta.yamlを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.review_count?.open, 1);
          assert.strictEqual(fileItem.review_count?.in_progress, undefined);
          assert.strictEqual(fileItem.review_count?.resolved, 2);
          assert.strictEqual(fileItem.review_count?.dismissed, undefined);
        }
      }
    });

    test('.dialogoi-meta.yamlが存在しない場合falseを返す', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      mockFileRepository.addDirectory(testDir);

      const reviewSummary: ReviewSummary = {
        open: 1,
        in_progress: 0,
        resolved: 0,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, false);
    });

    test('ファイルが存在しない場合falseを返す', () => {
      const testDir = '/test/project';
      const fileName = 'nonexistent.txt';
      const metaContent = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: ${testDir}/chapter1.txt`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const reviewSummary: ReviewSummary = {
        open: 1,
        in_progress: 0,
        resolved: 0,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, false);
    });

    test('不正な.dialogoi-meta.yamlの場合falseを返す', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const invalidMeta = `invalid: yaml: content`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, invalidMeta);

      const reviewSummary: ReviewSummary = {
        open: 1,
        in_progress: 0,
        resolved: 0,
        dismissed: 0,
      };

      const result = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(result, false);
    });
  });

  suite('removeReviewInfo', () => {
    test('レビュー情報を正常に削除する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}
    reviews: chapter1.txt_reviews.yaml
    review_count:
      open: 2
      resolved: 1`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.removeReviewInfo(testDir, fileName);
      assert.strictEqual(result, true);

      // 更新された.dialogoi-meta.yamlを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.reviews, undefined);
          assert.strictEqual(fileItem.review_count, undefined);
        }
      }
    });

    test('レビュー情報がない場合でも成功する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const metaContent = `readme: README.md
files:
  - name: ${fileName}
    type: content
    path: ${testDir}/${fileName}`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = service.removeReviewInfo(testDir, fileName);
      assert.strictEqual(result, true);

      // .dialogoi-meta.yamlに変更がないことを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.reviews, undefined);
          assert.strictEqual(fileItem.review_count, undefined);
        }
      }
    });
  });

  suite('相互運用テスト', () => {
    test('loadMetaYamlとsaveMetaYamlの相互運用', () => {
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
            character: {
              importance: 'main',
              multiple_characters: false,
              display_name: '主人公',
            },
            foreshadowing: {
              plants: [{ location: 'chapter1.txt', comment: '伏線の設置' }],
              payoff: { location: 'chapter10.txt', comment: '伏線の回収' },
            },
            reviews: 'chapter1.txt_reviews.yaml',
            review_count: {
              open: 2,
              in_progress: 1,
              resolved: 3,
              dismissed: 0,
            },
            glossary: true,
            hash: 'abc123',
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);

      // 保存 -> 読み込み -> 保存 -> 読み込み
      const saveResult1 = service.saveMetaYaml(testDir, meta);
      assert.strictEqual(saveResult1, true);

      const loadResult1 = service.loadMetaYaml(testDir);
      assert.notStrictEqual(loadResult1, null);

      if (loadResult1 !== null) {
        const saveResult2 = service.saveMetaYaml(testDir, loadResult1);
        assert.strictEqual(saveResult2, true);

        const loadResult2 = service.loadMetaYaml(testDir);
        assert.notStrictEqual(loadResult2, null);

        // 両方の読み込み結果が同じであることを確認
        assert.deepStrictEqual(loadResult1, loadResult2);
      }
    });

    test('updateReviewInfoとloadMetaYamlの相互運用', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      const reviewSummary: ReviewSummary = {
        open: 2,
        in_progress: 1,
        resolved: 3,
        dismissed: 0,
      };

      // レビュー情報を更新
      const updateResult = service.updateReviewInfo(testDir, fileName, reviewSummary);
      assert.strictEqual(updateResult, true);

      // 読み込んでレビュー情報を確認
      const loadedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(loadedMeta, null);

      if (loadedMeta !== null) {
        const fileItem = loadedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(typeof fileItem.reviews, 'string');
          assert.strictEqual(fileItem.review_count?.open, 2);
          assert.strictEqual(fileItem.review_count?.in_progress, 1);
          assert.strictEqual(fileItem.review_count?.resolved, 3);
          assert.strictEqual(fileItem.review_count?.dismissed, undefined);
        }
      }

      // レビュー情報を削除
      const removeResult = service.removeReviewInfo(testDir, fileName);
      assert.strictEqual(removeResult, true);

      // 読み込んでレビュー情報が削除されていることを確認
      const loadedMeta2 = service.loadMetaYaml(testDir);
      assert.notStrictEqual(loadedMeta2, null);

      if (loadedMeta2 !== null) {
        const fileItem2 = loadedMeta2.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem2, undefined);

        if (fileItem2 !== undefined) {
          assert.strictEqual(fileItem2.reviews, undefined);
          assert.strictEqual(fileItem2.review_count, undefined);
        }
      }
    });
  });

  suite('タグ操作テスト', () => {
    test('updateFileTagsでタグを正常に更新する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['既存タグ1', '既存タグ2'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // タグを更新
      const newTags = ['新タグ1', '新タグ2', '新タグ3'];
      const result = service.updateFileTags(testDir, fileName, newTags);
      assert.strictEqual(result, true);

      // 更新されたタグを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, newTags);
        }
      }
    });

    test('updateFileTagsでタグを空にする', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['既存タグ1', '既存タグ2'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // タグを空にする
      const result = service.updateFileTags(testDir, fileName, []);
      assert.strictEqual(result, true);

      // タグが削除されていることを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.tags, undefined);
        }
      }
    });

    test('addFileTagで新しいタグを追加する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['既存タグ1'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // 新しいタグを追加
      const result = service.addFileTag(testDir, fileName, '新タグ');
      assert.strictEqual(result, true);

      // タグが追加されていることを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, ['既存タグ1', '新タグ']);
        }
      }
    });

    test('addFileTagで重複タグを追加しても成功する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['既存タグ1'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // 既存のタグを追加
      const result = service.addFileTag(testDir, fileName, '既存タグ1');
      assert.strictEqual(result, true);

      // タグが重複していないことを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, ['既存タグ1']);
        }
      }
    });

    test('addFileTagでタグがないファイルに新規追加', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // 新しいタグを追加
      const result = service.addFileTag(testDir, fileName, '新タグ');
      assert.strictEqual(result, true);

      // タグが追加されていることを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, ['新タグ']);
        }
      }
    });

    test('removeFileTagでタグを削除する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['タグ1', 'タグ2', 'タグ3'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // タグを削除
      const result = service.removeFileTag(testDir, fileName, 'タグ2');
      assert.strictEqual(result, true);

      // タグが削除されていることを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, ['タグ1', 'タグ3']);
        }
      }
    });

    test('removeFileTagで最後のタグを削除するとtagsフィールドが削除される', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['タグ1'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // 最後のタグを削除
      const result = service.removeFileTag(testDir, fileName, 'タグ1');
      assert.strictEqual(result, true);

      // tagsフィールドが削除されていることを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.strictEqual(fileItem.tags, undefined);
        }
      }
    });

    test('removeFileTagで存在しないタグを削除しても成功する', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content',
            path: `${testDir}/${fileName}`,
            tags: ['タグ1'],
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      // 存在しないタグを削除
      const result = service.removeFileTag(testDir, fileName, '存在しないタグ');
      assert.strictEqual(result, true);

      // タグが変更されていないことを確認
      const updatedMeta = service.loadMetaYaml(testDir);
      assert.notStrictEqual(updatedMeta, null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        assert.notStrictEqual(fileItem, undefined);

        if (fileItem !== undefined) {
          assert.deepStrictEqual(fileItem.tags, ['タグ1']);
        }
      }
    });

    test('.dialogoi-meta.yamlが存在しない場合はfalseを返す', () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';

      mockFileRepository.addDirectory(testDir);

      const updateResult = service.updateFileTags(testDir, fileName, ['タグ']);
      assert.strictEqual(updateResult, false);

      const addResult = service.addFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(addResult, false);

      const removeResult = service.removeFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(removeResult, false);
    });

    test('ファイルが存在しない場合はfalseを返す', () => {
      const testDir = '/test/project';
      const fileName = 'nonexistent.txt';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: `${testDir}/chapter1.txt`,
          },
        ],
      };

      mockFileRepository.addDirectory(testDir);
      service.saveMetaYaml(testDir, meta);

      const updateResult = service.updateFileTags(testDir, fileName, ['タグ']);
      assert.strictEqual(updateResult, false);

      const addResult = service.addFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(addResult, false);

      const removeResult = service.removeFileTag(testDir, fileName, 'タグ');
      assert.strictEqual(removeResult, true); // タグがない場合は成功とする仕様
    });
  });
});
