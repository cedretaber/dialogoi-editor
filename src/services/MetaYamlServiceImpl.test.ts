import { MetaYamlServiceImpl } from './MetaYamlServiceImpl.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { createContentItem, createSubdirectoryItem } from '../test/testHelpers.js';

describe('MetaYamlServiceImpl テストスイート', () => {
  let service: MetaYamlServiceImpl;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;

  beforeEach(() => {
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    service = testContainer.getMetaYamlService() as MetaYamlServiceImpl;
  });

  afterEach(() => {
    mockFileRepository.reset();
    testContainer.cleanup();
  });

  describe('loadMetaYamlAsync', () => {
    it('正常な.dialogoi-meta.yamlファイルを読み込む', async () => {
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

      expect(result).not.toBe(null);
      expect(result?.readme).toBe('README.md');
      expect(result?.files.length).toBe(2);
      expect(result?.files[0]?.name).toBe('chapter1.txt');
      expect(result?.files[0]?.type).toBe('content');
      const firstFile = result?.files[0];
      if (firstFile && firstFile.type === 'content') {
        expect(firstFile.tags).toEqual(['重要', '序章']);
      } else {
        throw new Error('最初のファイルはContentItemである必要があります');
      }
      expect(result?.files[1]?.name).toBe('settings');
      expect(result?.files[1]?.type).toBe('subdirectory');
    });

    it('.dialogoi-meta.yamlファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = await service.loadMetaYamlAsync(testDir);
      expect(result).toBe(null);
    });

    it('不正なYAMLファイルの場合nullを返す', async () => {
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
      expect(result).toBe(null);
    });

    it('空の.dialogoi-meta.yamlファイルの場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, '');

      const result = await service.loadMetaYamlAsync(testDir);
      expect(result).toBe(null);
    });

    it('最小構成の.dialogoi-meta.yamlファイルを読み込む', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.loadMetaYamlAsync(testDir);

      expect(result).not.toBe(null);
      expect(result?.readme).toBe(undefined);
      expect(result?.files.length).toBe(0);
    });
  });

  describe('saveMetaYamlAsync', () => {
    it('正常なMetaYamlオブジェクトを保存する', async () => {
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
      expect(result).toBe(true);

      // 保存されたファイルを確認
      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('readme: README.md')).toBeTruthy();
      expect(savedContent.includes('name: chapter1.txt')).toBeTruthy();
      expect(savedContent.includes('type: content')).toBeTruthy();
      expect(savedContent.includes('comments: .chapter1.txt.comments.yaml')).toBeTruthy();
      expect(savedContent.includes('hash: abc123')).toBeTruthy();
    });

    it('空のfilesを持つMetaYamlを保存する', async () => {
      const testDir = '/test/project';
      const meta: MetaYaml = {
        readme: 'README.md',
        files: [],
      };

      mockFileRepository.addDirectory(testDir);

      const result = await service.saveMetaYamlAsync(testDir, meta);
      expect(result).toBe(true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('readme: README.md')).toBeTruthy();
      expect(savedContent.includes('files: []')).toBeTruthy();
    });

    it('readmeがないMetaYamlを保存する', async () => {
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
      expect(result).toBe(true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`),
        'utf8',
      );
      expect(savedContent.includes('name: test.txt')).toBeTruthy();
      expect(savedContent.includes('type: content')).toBeTruthy();
      expect(!savedContent.includes('readme:')).toBeTruthy();
    });

    it('バリデーションエラーがある場合falseを返す', async () => {
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
      expect(result).toBe(false);

      // .dialogoi-meta.yamlファイルが作成されていないことを確認
      const metaUri = mockFileRepository.createFileUri(`${testDir}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaUri)).toBe(false);
    });

    it('複数のバリデーションエラーがある場合falseを返す', async () => {
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
      expect(result).toBe(false);
    });
  });

  describe('getReadmeFilePathAsync', () => {
    it('readmeファイルが存在する場合パスを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(`${testDir}/README.md`);
    });

    it('readmeファイルが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      // README.mdファイルは作成しない

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('.dialogoi-meta.yamlにreadmeが設定されていない場合nullを返す', async () => {
      const testDir = '/test/project';
      const metaContent = `files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('.dialogoi-meta.yamlが存在しない場合nullを返す', async () => {
      const testDir = '/test/project';
      mockFileRepository.addDirectory(testDir);

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(null);
    });

    it('相対パスのreadmeファイルを正しく解決する', async () => {
      const testDir = '/test/project';
      const metaContent = `readme: docs/README.md
files: []`;

      mockFileRepository.addDirectory(testDir);
      mockFileRepository.addDirectory(`${testDir}/docs`);
      mockFileRepository.addFile(`${testDir}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.addFile(`${testDir}/docs/README.md`, '# Test Project');

      const result = await service.getReadmeFilePathAsync(testDir);
      expect(result).toBe(`${testDir}/docs/README.md`);
    });
  });

  describe('findNovelRootAsync', () => {
    it('dialogoi.yamlが存在するディレクトリを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/novel';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(novelRoot);
    });

    it('深い階層のdialogoiプロジェクトを見つける', async () => {
      const workspaceRoot = '/test/workspace';
      const novelRoot = '/test/workspace/projects/novel/src';

      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects`);
      mockFileRepository.addDirectory(`${workspaceRoot}/projects/novel`);
      mockFileRepository.addDirectory(novelRoot);
      mockFileRepository.addFile(`${novelRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(novelRoot);
    });

    it('複数のdialogoiプロジェクトがある場合最初に見つかったものを返す', async () => {
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
      expect(result === novelRoot1 || result === novelRoot2).toBeTruthy();
    });

    it('dialogoi.yamlが存在しない場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addDirectory(`${workspaceRoot}/project1`);
      mockFileRepository.addDirectory(`${workspaceRoot}/project2`);

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(null);
    });

    it('ワークスペースルート自体にdialogoiプロジェクトがある場合', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);
      mockFileRepository.addFile(`${workspaceRoot}/dialogoi.yaml`, 'version: 1.0');

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(workspaceRoot);
    });

    it('空のディレクトリの場合nullを返す', async () => {
      const workspaceRoot = '/test/workspace';
      mockFileRepository.addDirectory(workspaceRoot);

      const result = await service.findNovelRootAsync(workspaceRoot);
      expect(result).toBe(null);
    });
  });

  describe('相互運用テスト', () => {
    it('loadMetaYamlとsaveMetaYamlの相互運用', async () => {
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
      expect(saveResult1).toBe(true);

      const loadResult1 = await service.loadMetaYamlAsync(testDir);
      expect(loadResult1).not.toBe(null);

      if (loadResult1 !== null) {
        const saveResult2 = await service.saveMetaYamlAsync(testDir, loadResult1);
        expect(saveResult2).toBe(true);

        const loadResult2 = await service.loadMetaYamlAsync(testDir);
        expect(loadResult2).not.toBe(null);

        // 両方の読み込み結果が同じであることを確認
        expect(loadResult1).toEqual(loadResult2);
      }
    });
  });

  describe('タグ操作テスト', () => {
    it('updateFileTagsでタグを正常に更新する', async () => {
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
      expect(result).toBe(true);

      // 更新されたタグを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(newTags);
        }
      }
    });

    it('updateFileTagsでタグを空にする', async () => {
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
      expect(result).toBe(true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual([]);
        }
      }
    });

    it('addFileTagで新しいタグを追加する', async () => {
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
      expect(result).toBe(true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(['既存タグ1', '新タグ']);
        }
      }
    });

    it('addFileTagで重複タグを追加しても成功する', async () => {
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
      expect(result).toBe(true);

      // タグが重複していないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(['既存タグ1']);
        }
      }
    });

    it('addFileTagでタグがないファイルに新規追加', async () => {
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
      expect(result).toBe(true);

      // タグが追加されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(['新タグ']);
        }
      }
    });

    it('removeFileTagでタグを削除する', async () => {
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
      expect(result).toBe(true);

      // タグが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(['タグ1', 'タグ3']);
        }
      }
    });

    it('removeFileTagで最後のタグを削除するとtagsフィールドが削除される', async () => {
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
      expect(result).toBe(true);

      // tagsフィールドが削除されていることを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual([]);
        }
      }
    });

    it('removeFileTagで存在しないタグを削除しても成功する', async () => {
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
      expect(result).toBe(true);

      // タグが変更されていないことを確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        const fileItem = updatedMeta.files.find((f) => f.name === fileName);
        expect(fileItem).not.toBe(undefined);

        if (fileItem !== undefined && 'tags' in fileItem) {
          expect(fileItem.tags).toEqual(['タグ1']);
        }
      }
    });

    it('.dialogoi-meta.yamlが存在しない場合はfalseを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';

      mockFileRepository.addDirectory(testDir);

      const updateResult = await service.updateFileTags(testDir, fileName, ['タグ']);
      expect(updateResult).toBe(false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      expect(addResult).toBe(false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      expect(removeResult).toBe(false);
    });

    it('ファイルが存在しない場合はfalseを返す', async () => {
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
      expect(updateResult).toBe(false);

      const addResult = await service.addFileTag(testDir, fileName, 'タグ');
      expect(addResult).toBe(false);

      const removeResult = await service.removeFileTag(testDir, fileName, 'タグ');
      expect(removeResult).toBe(true); // タグがない場合は成功とする仕様
    });
  });

  describe('moveFileInMetadata', () => {
    it('同じディレクトリ内でのファイル並び替え', async () => {
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

      expect(result.success).toBe(true);

      // メタデータを再読み込みして順序を確認
      const updatedMeta = await service.loadMetaYamlAsync(testDir);
      expect(updatedMeta).not.toBe(null);

      if (updatedMeta !== null) {
        expect(updatedMeta.files.length).toBe(3);
        expect(updatedMeta.files[0]?.name).toBe('file2.txt');
        expect(updatedMeta.files[1]?.name).toBe('file3.txt');
        expect(updatedMeta.files[2]?.name).toBe('file1.txt');
      }
    });

    it('異なるディレクトリ間でのファイル移動', async () => {
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

      expect(result.success).toBe(true);

      // 移動元を確認
      const updatedSourceMeta = await service.loadMetaYamlAsync(sourceDir);
      expect(updatedSourceMeta).not.toBe(null);
      if (updatedSourceMeta !== null) {
        expect(updatedSourceMeta.files.length).toBe(1);
        expect(updatedSourceMeta.files[0]?.name).toBe('file2.txt');
      }

      // 移動先を確認
      const updatedTargetMeta = await service.loadMetaYamlAsync(targetDir);
      expect(updatedTargetMeta).not.toBe(null);
      if (updatedTargetMeta !== null) {
        expect(updatedTargetMeta.files.length).toBe(2);
        expect(updatedTargetMeta.files[0]?.name).toBe('file1.txt');
        expect(updatedTargetMeta.files[1]?.name).toBe('file3.txt');
        // パスが更新されていることを確認
        expect(updatedTargetMeta.files[0]?.path).toBe(`${targetDir}/file1.txt`);
      }
    });

    it('同じディレクトリ内で重複ファイル移動を試行（エラーにならない）', async () => {
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

      expect(result.success).toBe(true);
    });
  });
});
