import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { DialogoiTreeDataProvider } from './DialogoiTreeDataProvider.js';

suite('DialogoiTreeDataProvider テストスイート', () => {
  let testDir: string;
  let provider: DialogoiTreeDataProvider;

  setup(() => {
    // テスト用の一時ディレクトリを作成
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-tree-test-'));
    provider = new DialogoiTreeDataProvider();
  });

  teardown(() => {
    // テスト用ディレクトリを削除
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  suite('getTreeItem', () => {
    test('content タイプのアイテムは正しいアイコンを持つ', () => {
      const item = {
        name: 'test.txt',
        type: 'content' as const,
        path: path.join(testDir, 'test.txt'),
      };

      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem.label, 'test.txt');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      if (treeItem.iconPath instanceof vscode.ThemeIcon) {
        assert.strictEqual(treeItem.iconPath.id, 'file-text');
      }
    });

    test('setting タイプのアイテムは正しいアイコンを持つ', () => {
      const item = {
        name: 'setting.md',
        type: 'setting' as const,
        path: path.join(testDir, 'setting.md'),
      };

      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem.label, 'setting.md');
      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      if (treeItem.iconPath instanceof vscode.ThemeIcon) {
        assert.strictEqual(treeItem.iconPath.id, 'gear');
      }
    });

    test('glossary タイプのアイテムは book アイコンを持つ', () => {
      const item = {
        name: 'glossary.md',
        type: 'setting' as const,
        path: path.join(testDir, 'glossary.md'),
        glossary: true,
      };

      const treeItem = provider.getTreeItem(item);

      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      if (treeItem.iconPath instanceof vscode.ThemeIcon) {
        assert.strictEqual(treeItem.iconPath.id, 'book');
      }
    });

    test('character タイプのアイテムは person アイコンを持つ', () => {
      const item = {
        name: 'character.md',
        type: 'setting' as const,
        path: path.join(testDir, 'character.md'),
        character: {
          main: true,
          multi: false,
        },
      };

      const treeItem = provider.getTreeItem(item);

      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      if (treeItem.iconPath instanceof vscode.ThemeIcon) {
        assert.strictEqual(treeItem.iconPath.id, 'person');
      }
    });

    test('foreshadowing タイプのアイテムは eye アイコンを持つ', () => {
      const item = {
        name: 'foreshadowing.md',
        type: 'setting' as const,
        path: path.join(testDir, 'foreshadowing.md'),
        foreshadowing: {
          start: 'chapter1.txt',
          goal: 'chapter10.txt',
        },
      };

      const treeItem = provider.getTreeItem(item);

      assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
      if (treeItem.iconPath instanceof vscode.ThemeIcon) {
        assert.strictEqual(treeItem.iconPath.id, 'eye');
      }
    });

    test('subdirectory タイプのアイテムはアイコンを持たない', () => {
      const item = {
        name: 'contents',
        type: 'subdirectory' as const,
        path: path.join(testDir, 'contents'),
      };

      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem.label, 'contents');
      assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
      assert.strictEqual(treeItem.iconPath, undefined);
    });

    test('タグが設定されているアイテムはtooltipを持つ', () => {
      const item = {
        name: 'test.txt',
        type: 'content' as const,
        path: path.join(testDir, 'test.txt'),
        tags: ['テスト', '第1章'],
      };

      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem.tooltip, 'タグ: #テスト #第1章');
    });

    test('レビュー数が設定されているアイテムはdescriptionを持つ', () => {
      const item = {
        name: 'test.txt',
        type: 'content' as const,
        path: path.join(testDir, 'test.txt'),
        review_count: {
          open: 3,
          resolved: 2,
        },
      };

      const treeItem = provider.getTreeItem(item);

      assert.strictEqual(treeItem.description, '(3 レビュー)');
    });

    test('ファイルアイテムはクリックコマンドを持つ', () => {
      const item = {
        name: 'test.txt',
        type: 'content' as const,
        path: path.join(testDir, 'test.txt'),
      };

      const treeItem = provider.getTreeItem(item);

      assert.ok(treeItem.command);
      assert.strictEqual(treeItem.command.command, 'vscode.open');
      assert.strictEqual(treeItem.command.title, 'Open');
    });
  });

  suite('getChildren', () => {
    test('小説ルートが見つからない場合は空配列を返す', async () => {
      const children = await provider.getChildren();
      assert.strictEqual(children.length, 0);
    });

    test('要素が指定された場合はそのディレクトリのファイルを返す', async () => {
      // テスト用のディレクトリとファイルを作成
      const contentsDir = path.join(testDir, 'contents');
      fs.mkdirSync(contentsDir);

      const metaYaml = `
readme: README.md
files:
  - name: chapter1.txt
    type: content
    tags: ["第1章"]
`;
      fs.writeFileSync(path.join(contentsDir, 'meta.yaml'), metaYaml);

      const element = {
        name: 'contents',
        type: 'subdirectory' as const,
        path: contentsDir,
      };

      const children = await provider.getChildren(element);

      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0]?.name, 'chapter1.txt');
      assert.strictEqual(children[0]?.type, 'content');
      assert.deepStrictEqual(children[0]?.tags, ['第1章']);
    });
  });
});
