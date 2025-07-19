import { suite, test, setup } from 'mocha';
import * as assert from 'assert';
import { TreeViewFilterService } from './TreeViewFilterService.js';
import { DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

suite('TreeViewFilterService テストスイート', () => {
  let filterService: TreeViewFilterService;

  setup(() => {
    filterService = new TreeViewFilterService();
  });

  suite('フィルター状態管理', () => {
    test('初期状態ではフィルターが無効', () => {
      const filterState = filterService.getFilterState();
      assert.strictEqual(filterState.isActive, false);
      assert.strictEqual(filterState.filterType, null);
      assert.strictEqual(filterState.filterValue, '');
      assert.strictEqual(filterService.isFilterActive(), false);
    });

    test('タグフィルターを設定できる', () => {
      filterService.setTagFilter('主人公');
      const filterState = filterService.getFilterState();

      assert.strictEqual(filterState.isActive, true);
      assert.strictEqual(filterState.filterType, 'tag');
      assert.strictEqual(filterState.filterValue, '主人公');
      assert.strictEqual(filterService.isFilterActive(), true);
    });

    test('参照関係フィルターを設定できる', () => {
      filterService.setReferenceFilter('chapter1.md');
      const filterState = filterService.getFilterState();

      assert.strictEqual(filterState.isActive, true);
      assert.strictEqual(filterState.filterType, 'reference');
      assert.strictEqual(filterState.filterValue, 'chapter1.md');
      assert.strictEqual(filterService.isFilterActive(), true);
    });

    test('ファイル種別フィルターを設定できる', () => {
      filterService.setFileTypeFilter('content');
      const filterState = filterService.getFilterState();

      assert.strictEqual(filterState.isActive, true);
      assert.strictEqual(filterState.filterType, 'fileType');
      assert.strictEqual(filterState.filterValue, 'content');
      assert.strictEqual(filterService.isFilterActive(), true);
    });

    test('フィルターを解除できる', () => {
      filterService.setTagFilter('主人公');
      filterService.clearFilter();

      const filterState = filterService.getFilterState();
      assert.strictEqual(filterState.isActive, false);
      assert.strictEqual(filterState.filterType, null);
      assert.strictEqual(filterState.filterValue, '');
      assert.strictEqual(filterService.isFilterActive(), false);
    });

    test('フィルター設定時に値が正規化される', () => {
      filterService.setTagFilter('  主人公  ');
      const filterState = filterService.getFilterState();
      assert.strictEqual(filterState.filterValue, '主人公');
    });

    test('フィルター設定時に大文字小文字が正規化される', () => {
      filterService.setTagFilter('HERO');
      const filterState = filterService.getFilterState();
      assert.strictEqual(filterState.filterValue, 'hero');
    });

    test('getFilterStateは状態のコピーを返す', () => {
      filterService.setTagFilter('test');
      const state1 = filterService.getFilterState();
      const state2 = filterService.getFilterState();

      // 異なるオブジェクトインスタンス
      assert.notStrictEqual(state1, state2);
      // 同じ内容
      assert.deepStrictEqual(state1, state2);

      // 元の状態を変更しても影響しない
      state1.isActive = false;
      assert.strictEqual(filterService.getFilterState().isActive, true);
    });
  });

  suite('タグフィルタリング機能', () => {
    const testItems: DialogoiTreeItem[] = [
      {
        name: 'chapter1.md',
        type: 'content',
        path: '/test/chapter1.md',
        tags: ['主人公', '冒険'],
      },
      {
        name: 'chapter2.md',
        type: 'content',
        path: '/test/chapter2.md',
        tags: ['バトル', '魔法'],
      },
      {
        name: 'character1.md',
        type: 'setting',
        path: '/test/character1.md',
        tags: ['主人公', 'キャラクター'],
      },
      {
        name: 'character2.md',
        type: 'setting',
        path: '/test/character2.md',
        tags: ['敵', 'キャラクター'],
      },
      {
        name: 'settings.md',
        type: 'setting',
        path: '/test/settings.md',
        tags: ['世界観'],
      },
      {
        name: 'noTags.md',
        type: 'content',
        path: '/test/noTags.md',
        // tagsプロパティなし
      },
    ];

    test('フィルターなしで全てのファイルが返される', () => {
      const result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 6);
    });

    test('主人公タグでフィルタリング', () => {
      filterService.setTagFilter('主人公');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 2);
      const fileNames = result.map((item) => item.name);
      assert.deepStrictEqual(fileNames.sort(), ['chapter1.md', 'character1.md']);
    });

    test('キャラクタータグでフィルタリング', () => {
      filterService.setTagFilter('キャラクター');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 2);
      const fileNames = result.map((item) => item.name);
      assert.deepStrictEqual(fileNames.sort(), ['character1.md', 'character2.md']);
    });

    test('存在しないタグでフィルタリングすると空の結果', () => {
      filterService.setTagFilter('存在しないタグ');
      const result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 0);
    });

    test('部分一致でフィルタリング', () => {
      filterService.setTagFilter('主');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 2);
      const fileNames = result.map((item) => item.name);
      assert.deepStrictEqual(fileNames.sort(), ['chapter1.md', 'character1.md']);
    });

    test('大文字小文字を無視してフィルタリング', () => {
      // 英語の大文字小文字で検証
      const englishTestItems: DialogoiTreeItem[] = [
        {
          name: 'hero.md',
          type: 'content',
          path: '/test/hero.md',
          tags: ['Hero', 'Adventure'],
        },
      ];

      filterService.setTagFilter('hero');
      const result1 = filterService.applyFilter(englishTestItems);

      filterService.setTagFilter('HERO');
      const result2 = filterService.applyFilter(englishTestItems);

      // 同じ結果が得られる
      assert.strictEqual(result1.length, result2.length);
      assert.strictEqual(result1.length, 1);
      if (result1.length > 0 && result2.length > 0) {
        assert.strictEqual(result1[0]?.name, result2[0]?.name);
      }
    });

    test('タグがないファイルは除外される', () => {
      filterService.setTagFilter('主人公');
      const result = filterService.applyFilter(testItems);

      const noTagsFile = result.find((item) => item.name === 'noTags.md');
      assert.strictEqual(noTagsFile, undefined);
    });
  });

  suite('参照関係フィルタリング機能', () => {
    const testItems: DialogoiTreeItem[] = [
      {
        name: 'chapter1.md',
        type: 'content',
        path: '/test/chapter1.md',
        references: ['character1.md', 'settings.md'],
      },
      {
        name: 'chapter2.md',
        type: 'content',
        path: '/test/chapter2.md',
        references: ['character2.md', 'magic.md'],
      },
      {
        name: 'character1.md',
        type: 'setting',
        path: '/test/character1.md',
        // referencesプロパティなし
      },
    ];

    test('参照関係でフィルタリング', () => {
      filterService.setReferenceFilter('character1.md');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.name, 'chapter1.md');
    });

    test('参照関係の部分一致フィルタリング', () => {
      filterService.setReferenceFilter('character');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 2);
      const fileNames = result.map((item) => item.name);
      assert.deepStrictEqual(fileNames.sort(), ['chapter1.md', 'chapter2.md']);
    });

    test('参照関係がないファイルは除外される', () => {
      filterService.setReferenceFilter('character1.md');
      const result = filterService.applyFilter(testItems);

      const noRefsFile = result.find((item) => item.name === 'character1.md');
      assert.strictEqual(noRefsFile, undefined);
    });
  });

  suite('ファイル種別フィルタリング機能', () => {
    const testItems: DialogoiTreeItem[] = [
      {
        name: 'chapter1.md',
        type: 'content',
        path: '/test/chapter1.md',
      },
      {
        name: 'character1.md',
        type: 'setting',
        path: '/test/character1.md',
      },
      {
        name: 'subdir',
        type: 'subdirectory',
        path: '/test/subdir',
      },
    ];

    test('contentタイプでフィルタリング', () => {
      filterService.setFileTypeFilter('content');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.name, 'chapter1.md');
    });

    test('settingタイプでフィルタリング', () => {
      filterService.setFileTypeFilter('setting');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.name, 'character1.md');
    });

    test('部分一致でフィルタリング', () => {
      filterService.setFileTypeFilter('sub');
      const result = filterService.applyFilter(testItems);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0]?.name, 'subdir');
    });
  });

  suite('複合テストケース', () => {
    test('空の配列を渡しても問題なし', () => {
      filterService.setTagFilter('test');
      const result = filterService.applyFilter([]);
      assert.strictEqual(result.length, 0);
    });

    test('空のフィルター値では全てのアイテムが返される', () => {
      filterService.setTagFilter('');
      const testItems: DialogoiTreeItem[] = [
        { name: 'test.md', type: 'content', path: '/test.md', tags: ['tag1'] },
      ];
      const result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 1);
    });

    test('フィルター種別を変更しても正しく動作する', () => {
      const testItems: DialogoiTreeItem[] = [
        {
          name: 'test.md',
          type: 'content',
          path: '/test.md',
          tags: ['hero'],
          references: ['char.md'],
        },
      ];

      // タグフィルター
      filterService.setTagFilter('hero');
      let result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 1);

      // 参照関係フィルターに変更
      filterService.setReferenceFilter('char.md');
      result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 1);

      // ファイル種別フィルターに変更
      filterService.setFileTypeFilter('content');
      result = filterService.applyFilter(testItems);
      assert.strictEqual(result.length, 1);
    });
  });
});
