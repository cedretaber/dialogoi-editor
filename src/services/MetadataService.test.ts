import { MetadataService } from './MetadataService.js';
import { MetaYamlService } from './MetaYamlService.js';
import { createContentItem } from '../test/testHelpers.js';
import { MockProxy, mock } from 'jest-mock-extended';
import { MetaYaml } from '../utils/MetaYamlUtils.js';

describe('MetadataService テストスイート', () => {
  let metadataService: MetadataService;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let testMetaYaml: MetaYaml;

  beforeEach(async () => {
    // モックの作成
    mockMetaYamlService = mock<MetaYamlService>();

    // MetadataServiceの初期化
    metadataService = new MetadataService(mockMetaYamlService);

    // テスト用MetaYamlデータの作成
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

    testMetaYaml = {
      readme: 'README.md',
      files: [testItem, notagItem],
    };

    // MetaYamlServiceのモック実装
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation(async () => {
      // deep copyを返す
      return JSON.parse(JSON.stringify(testMetaYaml));
    });

    mockMetaYamlService.saveMetaYamlAsync.mockImplementation(async (_dirPath, metaYaml) => {
      testMetaYaml = JSON.parse(JSON.stringify(metaYaml));
      return true;
    });
  });

  describe('タグ操作', () => {
    it('タグを追加できる', async () => {
      const newTag = 'tag2';
      const result = await metadataService.addTag('/test', 'test.txt', newTag);

      expect(result.success).toBe(true);

      // saveMetaYamlAsyncが正しく呼び出されたか確認
      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              tags: expect.arrayContaining(['tag1', 'tag2']),
            }),
          ]),
        }),
      );
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

      // saveMetaYamlAsyncが正しく呼び出されたか確認
      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              tags: expect.not.arrayContaining(['tag1']),
            }),
          ]),
        }),
      );
    });

    it('タグを完全置換できる', async () => {
      const newTags = ['newtag1', 'newtag2'];
      const result = await metadataService.setTags('/test', 'test.txt', newTags);

      expect(result.success).toBe(true);

      // 新しいタグのみ存在することを確認
      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              tags: ['newtag1', 'newtag2'],
            }),
          ]),
        }),
      );
    });

    it('タグがないファイルにタグを追加できる', async () => {
      const newTag = 'tag3';
      const result = await metadataService.addTag('/test', 'notag.txt', newTag);

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'notag.txt',
              tags: ['tag3'],
            }),
          ]),
        }),
      );
    });
  });

  describe('参照操作', () => {
    it('参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'test.txt', '/new/reference.txt');

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              references: expect.arrayContaining(['/other/file.txt', '/new/reference.txt']),
            }),
          ]),
        }),
      );
    });

    it('参照を削除できる', async () => {
      const result = await metadataService.removeReference('/test', 'test.txt', '/other/file.txt');

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              references: expect.not.arrayContaining(['/other/file.txt']),
            }),
          ]),
        }),
      );
    });

    it('参照を完全置換できる', async () => {
      const newRefs = ['/ref1.txt', '/ref2.txt'];
      const result = await metadataService.setReferences('/test', 'test.txt', newRefs);

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
              references: ['/ref1.txt', '/ref2.txt'],
            }),
          ]),
        }),
      );
    });

    it('参照がないファイルに参照を追加できる', async () => {
      const result = await metadataService.addReference('/test', 'notag.txt', '/new/ref.txt');

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'notag.txt',
              references: ['/new/ref.txt'],
            }),
          ]),
        }),
      );
    });
  });

  describe('汎用メタデータ操作', () => {
    it('updateMetaYamlで任意の更新ができる', async () => {
      const result = await metadataService.updateMetaYaml('/test', (meta) => {
        meta.readme = 'updated-readme.md';
        return meta;
      });

      expect(result.success).toBe(true);

      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          readme: 'updated-readme.md',
        }),
      );
    });
  });

  describe('エラーハンドリング', () => {
    it('メタデータファイルが存在しない場合のエラー', async () => {
      // loadMetaYamlAsyncがnullを返すようにモック設定
      mockMetaYamlService.loadMetaYamlAsync.mockResolvedValueOnce(null);
      
      const newTag = 'tag';
      const result = await metadataService.addTag('/nonexistent', 'file.txt', newTag);

      expect(result.success).toBe(false);
      expect(result.message).toContain('.dialogoi-meta.yamlが見つからないか、読み込みに失敗しました。');
    });
  });
});
