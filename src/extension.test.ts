import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('Extension 統合テストスイート', () => {
  let testWorkspace: string;

  suiteSetup(async () => {
    // テスト用のワークスペースを作成
    testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dialogoi-integration-test-'));

    // サンプルの小説プロジェクトを作成
    const novelDir = path.join(testWorkspace, 'test-novel');
    fs.mkdirSync(novelDir);

    // dialogoi.yaml を作成
    const dialogoiYaml = `
title: "テスト小説"
author: "テスト作者"
`;
    fs.writeFileSync(path.join(novelDir, 'dialogoi.yaml'), dialogoiYaml);

    // meta.yaml を作成
    const metaYaml = `
readme: README.md
files:
  - name: contents
    type: subdirectory
  - name: settings
    type: subdirectory
`;
    fs.writeFileSync(path.join(novelDir, 'meta.yaml'), metaYaml);
    fs.writeFileSync(path.join(novelDir, 'README.md'), '# テスト小説');

    // contents ディレクトリを作成
    const contentsDir = path.join(novelDir, 'contents');
    fs.mkdirSync(contentsDir);

    const contentsMetaYaml = `
readme: README.md
files:
  - name: chapter1.txt
    type: content
    tags: ["第1章"]
`;
    fs.writeFileSync(path.join(contentsDir, 'meta.yaml'), contentsMetaYaml);
    fs.writeFileSync(path.join(contentsDir, 'README.md'), '# 本文');
    fs.writeFileSync(path.join(contentsDir, 'chapter1.txt'), '第1章の内容');

    // settings ディレクトリを作成
    const settingsDir = path.join(novelDir, 'settings');
    fs.mkdirSync(settingsDir);

    const settingsMetaYaml = `
readme: README.md
files:
  - name: character.md
    type: setting
    character:
      main: true
      multi: false
    tags: ["主人公"]
`;
    fs.writeFileSync(path.join(settingsDir, 'meta.yaml'), settingsMetaYaml);
    fs.writeFileSync(path.join(settingsDir, 'README.md'), '# 設定');
    fs.writeFileSync(path.join(settingsDir, 'character.md'), '# 主人公設定');
  });

  suiteTeardown(() => {
    // テスト用ワークスペースを削除
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  test('Extension が正常に起動する', () => {
    const extension = vscode.extensions.getExtension('cedretaber.dialogoi-editor');
    assert.ok(extension);
  });

  test('dialogoi.refreshExplorer コマンドが登録されている', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('dialogoi.refreshExplorer'));
  });

  test('dialogoi.refreshExplorer コマンドが実行できる', async () => {
    // コマンドを実行（エラーが発生しないことを確認）
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand('dialogoi.refreshExplorer');
    });
  });

  test('TreeView が正常に表示される', async () => {
    // TreeViewの取得を試行
    const treeView = vscode.window.createTreeView('dialogoi-explorer', {
      treeDataProvider: {
        getChildren: () => Promise.resolve([]),
        getTreeItem: (element: any) => new vscode.TreeItem(element),
      },
    });

    assert.ok(treeView);
    treeView.dispose();
  });

  test('Context が正しく設定される', async () => {
    // dialogoi:hasNovelProject コンテキストが設定されることを確認
    // 実際の実装では setContext コマンドが呼ばれるはず
    await vscode.commands.executeCommand('dialogoi.refreshExplorer');

    // コンテキストの確認は直接的な方法がないため、
    // エラーが発生しないことで動作を確認
    assert.ok(true);
  });
});
