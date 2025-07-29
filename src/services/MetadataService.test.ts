import assert from 'assert';
import { MetadataService } from './MetadataService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { createContentItem } from '../test/testHelpers.js';

suite('MetadataService テストスイート', () => {
  let metadataService: MetadataService;
  let mockFileRepository: MockFileRepository;

  setup(async () => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    metadataService = container.getMetadataService();

    // テスト用ディレクトリ構造の準備
    mockFileRepository.createDirectoryForTest('/test');

    const testItem = createContentItem({
      name: 'test.txt',
      path: '/test/test.txt',
      tags: ['tag1'],
      references: ['/other/file.txt'],
    });

    const notagItem = createContentItem({
      name: 'notag.txt',
      path: '/test/notag.txt',
      tags: [],
      references: [],
    });

    const metaYamlContent = `readme: README.md
files:
  - name: ${testItem.name}
    type: ${testItem.type}
    path: ${testItem.path}
    hash: ${testItem.hash}
    tags:
      - tag1
    references:
      - /other/file.txt
    comments: '${testItem.comments}'
    isUntracked: ${testItem.isUntracked}
    isMissing: ${testItem.isMissing}
  - name: ${notagItem.name}
    type: ${notagItem.type}
    path: ${notagItem.path}
    hash: ${notagItem.hash}
    tags: []
    references: []
    comments: '${notagItem.comments}'
    isUntracked: ${notagItem.isUntracked}
    isMissing: ${notagItem.isMissing}
`;

    await mockFileRepository.writeFileAsync(
      mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
      metaYamlContent,
    );
  });

  suite('タグ操作', () => {
    test('タグを追加できる', async () => {
      const newTag = 'tag2';
      const result = await metadataService.addTag('/test', 'test.txt', newTag);

      assert.strictEqual(result.success, true);

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('tag2'));
    });

    test('存在しないファイルにタグを追加するとエラー', async () => {
      const newTag = 'tag2';
      const result = await metadataService.addTag('/test', 'nonexistent.txt', newTag);

      assert.strictEqual(result.success, false);
      assert(result.message?.includes('見つかりません'));
    });

    test('タグを削除できる', async () => {
      const result = await metadataService.removeTag('/test', 'test.txt', 'tag1');

      assert.strictEqual(result.success, true);

      // メタデータからタグが削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('tag1'));
    });

    test('タグを完全置換できる', async () => {
      const newTags = ['newtag1', 'newtag2'];
      const result = await metadataService.setTags('/test', 'test.txt', newTags);

      assert.strictEqual(result.success, true);

      // 新しいタグのみ存在することを確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert.strictEqual(metaContent.includes('newtag1'), true);
      assert.strictEqual(metaContent.includes('newtag2'), true);
    });

    test('タグがないファイルにタグを追加できる', async () => {
      const newTag = 'tag3';
      const result = await metadataService.addTag('/test', 'notag.txt', newTag);

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('tag3'));
    });
  });

  suite('参照操作', () => {
    test('参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'test.txt', '/new/reference.txt');

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('/new/reference.txt'));
    });

    test('参照を削除できる', async () => {
      const result = await metadataService.removeReference('/test', 'test.txt', '/other/file.txt');

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('/other/file.txt'));
    });

    test('参照を完全置換できる', async () => {
      const newRefs = ['/ref1.txt', '/ref2.txt'];
      const result = await metadataService.setReferences('/test', 'test.txt', newRefs);

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('/other/file.txt'));
      assert(metaContent.includes('/ref1.txt'));
      assert(metaContent.includes('/ref2.txt'));
    });

    test('参照がないファイルに参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'notag.txt', '/new/ref.txt');

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('/new/ref.txt'));
    });
  });

  suite('汎用メタデータ操作', () => {
    test('updateMetaYamlで任意の更新ができる', async () => {
      const result = await metadataService.updateMetaYaml('/test', (meta) => {
        meta.readme = 'updated-readme.md';
        return meta;
      });

      assert.strictEqual(result.success, true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('readme: updated-readme.md'));
    });
  });

  suite('エラーハンドリング', () => {
    test('メタデータファイルが存在しない場合のエラー', async () => {
      // 存在しないディレクトリ
      const newTag = 'tag';
      const result = await metadataService.addTag('/nonexistent', 'file.txt', newTag);

      assert.strictEqual(result.success, false);
      // メッセージが存在することを確認
      assert.strictEqual(!!result.message, true);
    });
  });
});
