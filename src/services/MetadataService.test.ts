import { MetadataService } from './MetadataService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { createContentItem } from '../test/testHelpers.js';

describe('MetadataService テストスイート', () => {
  let metadataService: MetadataService;
  let mockFileRepository: MockFileRepository;

  beforeEach(async () => {
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

  describe('タグ操作', () => {
    it('タグを追加できる', async () => {
      const newTag = 'tag2';
      const result = await metadataService.addTag('/test', 'test.txt', newTag);

      expect(result.success).toBe(true);

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('tag2')).toBeTruthy();
    });

    it('存在しないファイルにタグを追加するとエラー', async () => {
      const newTag = 'tag2';
      const result = await metadataService.addTag('/test', 'nonexistent.txt', newTag);

      expect(result.success).toBe(false);
      expect(result.message?.includes('見つかりません')).toBeTruthy();
    });

    it('タグを削除できる', async () => {
      const result = await metadataService.removeTag('/test', 'test.txt', 'tag1');

      expect(result.success).toBe(true);

      // メタデータからタグが削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('tag1')).toBeFalsy();
    });

    it('タグを完全置換できる', async () => {
      const newTags = ['newtag1', 'newtag2'];
      const result = await metadataService.setTags('/test', 'test.txt', newTags);

      expect(result.success).toBe(true);

      // 新しいタグのみ存在することを確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('newtag1')).toBe(true);
      expect(metaContent.includes('newtag2')).toBe(true);
    });

    it('タグがないファイルにタグを追加できる', async () => {
      const newTag = 'tag3';
      const result = await metadataService.addTag('/test', 'notag.txt', newTag);

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('tag3')).toBeTruthy();
    });
  });

  describe('参照操作', () => {
    it('参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'test.txt', '/new/reference.txt');

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('/new/reference.txt')).toBeTruthy();
    });

    it('参照を削除できる', async () => {
      const result = await metadataService.removeReference('/test', 'test.txt', '/other/file.txt');

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('/other/file.txt')).toBeFalsy();
    });

    it('参照を完全置換できる', async () => {
      const newRefs = ['/ref1.txt', '/ref2.txt'];
      const result = await metadataService.setReferences('/test', 'test.txt', newRefs);

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('/other/file.txt')).toBeFalsy();
      expect(metaContent.includes('/ref1.txt')).toBeTruthy();
      expect(metaContent.includes('/ref2.txt')).toBeTruthy();
    });

    it('参照がないファイルに参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'notag.txt', '/new/ref.txt');

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('/new/ref.txt')).toBeTruthy();
    });
  });

  describe('汎用メタデータ操作', () => {
    it('updateMetaYamlで任意の更新ができる', async () => {
      const result = await metadataService.updateMetaYaml('/test', (meta) => {
        meta.readme = 'updated-readme.md';
        return meta;
      });

      expect(result.success).toBe(true);

      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      expect(metaContent.includes('readme: updated-readme.md')).toBeTruthy();
    });
  });

  describe('エラーハンドリング', () => {
    it('メタデータファイルが存在しない場合のエラー', async () => {
      // 存在しないディレクトリ
      const newTag = 'tag';
      const result = await metadataService.addTag('/nonexistent', 'file.txt', newTag);

      expect(result.success).toBe(false);
      // メッセージが存在することを確認
      expect(!!result.message).toBe(true);
    });
  });
});
