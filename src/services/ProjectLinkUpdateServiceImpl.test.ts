import * as assert from 'assert';
import * as path from 'path';
import { ProjectLinkUpdateServiceImpl } from './ProjectLinkUpdateServiceImpl.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { ServiceContainer } from '../di/ServiceContainer.js';

suite('ProjectLinkUpdateServiceImpl テストスイート', () => {
  let service: ProjectLinkUpdateServiceImpl;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;
  let testProjectRoot: string;

  setup(() => {
    // TestServiceContainerを初期化
    testContainer = TestServiceContainer.create();
    mockFileRepository = testContainer.getFileRepository() as MockFileRepository;
    testProjectRoot = '/tmp/test-project';

    // ServiceContainerをテスト用に設定
    ServiceContainer.setTestInstance(testContainer);

    // MetaYamlServiceを取得
    const metaYamlService = testContainer.getMetaYamlService();

    // ProjectLinkUpdateServiceを初期化
    service = new ProjectLinkUpdateServiceImpl(
      mockFileRepository,
      metaYamlService,
      testProjectRoot,
    );

    // テスト用のプロジェクト構造を作成
    createTestProject();
  });

  teardown(() => {
    ServiceContainer.clearTestInstance();
    mockFileRepository.reset();
  });

  function createTestProject(): void {
    const projectPath = testProjectRoot;

    // dialogoi.yamlを作成
    const dialogoiYamlContent = `title: テストプロジェクト
author: テスト著者
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
`;
    mockFileRepository.addFile(path.join(projectPath, 'dialogoi.yaml'), dialogoiYamlContent);

    // contentsディレクトリ
    const contentsDir = path.join(projectPath, 'contents');
    mockFileRepository.addDirectory(contentsDir);

    // contents/.dialogoi-meta.yaml
    mockFileRepository.addFile(
      path.join(contentsDir, '.dialogoi-meta.yaml'),
      `readme: README.md
files:
  - name: chapter1.md
    type: content
    path: ${path.join(contentsDir, 'chapter1.md')}
    hash: hash1
    tags: []
    references: ["settings/character1.md"]
    comments: ""
    isUntracked: false
    isMissing: false
  - name: chapter2.md
    type: content
    path: ${path.join(contentsDir, 'chapter2.md')}
    hash: hash2
    tags: []
    references: []
    comments: ""
    isUntracked: false
    isMissing: false
  - name: sub1
    type: subdirectory
    path: ${path.join(contentsDir, 'sub1')}
`,
    );

    // コンテンツファイル
    const chapter1Content = `# 第1章

[キャラクター1](../settings/character1.md) が登場します。
[キャラクター2](../settings/character2.md) も出てきます。
[外部リンク](https://example.com) もあります。
`;
    mockFileRepository.addFile(path.join(contentsDir, 'chapter1.md'), chapter1Content);

    const chapter2Content = `# 第2章

[キャラクター1](../settings/character1.md) の冒険が続きます。
`;
    mockFileRepository.addFile(path.join(contentsDir, 'chapter2.md'), chapter2Content);

    // settingsディレクトリ
    const settingsDir = path.join(projectPath, 'settings');
    mockFileRepository.addDirectory(settingsDir);

    // settings/.dialogoi-meta.yaml
    mockFileRepository.addFile(
      path.join(settingsDir, '.dialogoi-meta.yaml'),
      `readme: README.md
files:
  - name: character1.md
    type: character
    path: ${path.join(settingsDir, 'character1.md')}
    hash: hash3
    tags: ["主人公"]
    comments: ""
    isUntracked: false
    isMissing: false
    character:
      importance: "main"
      isMultipleCharacters: false
  - name: character2.md
    type: setting
    path: ${path.join(settingsDir, 'character2.md')}
    hash: hash4
    tags: ["脇役"]
    comments: ""
    isUntracked: false
    isMissing: false
`,
    );

    // 設定ファイル
    mockFileRepository.addFile(
      path.join(settingsDir, 'character1.md'),
      '# キャラクター1\n\n主人公です。',
    );
    mockFileRepository.addFile(
      path.join(settingsDir, 'character2.md'),
      '# キャラクター2\n\n脇役です。',
    );
  }

  test('ファイル名変更時のマークダウンリンク更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_renamed.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 2); // chapter1.md, chapter2.md

    // chapter1.mdの内容確認
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    const chapter1Content = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');

    assert.ok(chapter1Content.includes('../settings/character1_renamed.md'));
    assert.ok(!chapter1Content.includes('../settings/character1.md'));
    // 外部リンクは変更されない
    assert.ok(chapter1Content.includes('https://example.com'));

    // chapter2.mdの内容確認
    const chapter2Path = path.join(testProjectRoot, 'contents', 'chapter2.md');
    const chapter2Uri = mockFileRepository.createFileUri(chapter2Path);
    const chapter2Content = await mockFileRepository.readFileAsync(chapter2Uri, 'utf8');

    assert.ok(chapter2Content.includes('../settings/character1_renamed.md'));
  });

  test('meta.yamlファイルのreferences更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_moved.md',
    );

    assert.strictEqual(result.success, true);

    // contents/.dialogoi-meta.yamlの確認
    const contentsMetaPath = path.join(testProjectRoot, 'contents', '.dialogoi-meta.yaml');
    const contentsMetaUri = mockFileRepository.createFileUri(contentsMetaPath);
    const metaContent = await mockFileRepository.readFileAsync(contentsMetaUri, 'utf8');

    assert.ok(metaContent.includes('settings/character1_moved.md'));
    assert.ok(!metaContent.includes('settings/character1.md'));
  });

  test('ファイル移動時の複数リンク更新', async () => {
    // chapter1.mdに更に多くのリンクを追加
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const moreLinksContent = `# 第1章

[キャラクター1](../settings/character1.md) が登場します。
[同じキャラクター](../settings/character1.md) が再度言及されます。
[キャラクター2](../settings/character2.md) も出てきます。
`;
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    await mockFileRepository.writeFileAsync(chapter1Uri, moreLinksContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/heroes/character1.md',
    );

    assert.strictEqual(result.success, true);

    // chapter1.mdの内容確認（複数のリンクが全て更新される）
    const updatedContent = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');
    const character1Links = (updatedContent.match(/\.\.\/settings\/heroes\/character1\.md/g) || [])
      .length;
    assert.strictEqual(character1Links, 2); // 2箇所のリンクが更新されている

    // character2.mdのリンクは変更されない
    assert.ok(updatedContent.includes('../settings/character2.md'));
  });

  test('プロジェクト外リンクは更新しない', async () => {
    // 外部リンクを含むファイルを作成
    const externalLinksContent = `# テスト

[内部リンク](../settings/character1.md)
[外部リンク](https://example.com/character1.md)
[絶対パス](/absolute/path/character1.md)
`;
    const testFilePath = path.join(testProjectRoot, 'contents', 'external_test.md');
    const testFileUri = mockFileRepository.createFileUri(testFilePath);
    await mockFileRepository.writeFileAsync(testFileUri, externalLinksContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_new.md',
    );

    assert.strictEqual(result.success, true);

    // 外部リンクテストファイルの確認
    const updatedContent = await mockFileRepository.readFileAsync(testFileUri, 'utf8');

    // 内部リンクのみ更新される
    assert.ok(updatedContent.includes('../settings/character1_new.md'));
    // 外部リンクは変更されない
    assert.ok(updatedContent.includes('https://example.com/character1.md'));
    assert.ok(updatedContent.includes('/absolute/path/character1.md'));
  });

  test('存在しないファイルの更新は無視', async () => {
    // 存在しないファイルのリンクを含む設定で実行
    const result = await service.updateLinksAfterFileOperation(
      'nonexistent/file.md',
      'also_nonexistent/file.md',
    );

    // 処理は成功するが、更新されるファイルはない
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 0);
  });

  test('scanFileForProjectLinks デバッグ機能', async () => {
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const projectLinks = await service.scanFileForProjectLinks(chapter1Path);

    // プロジェクト内リンクのみが抽出される
    assert.ok(projectLinks.includes('settings/character1.md'));
    assert.ok(projectLinks.includes('settings/character2.md'));
    // 外部リンクは含まれない
    assert.ok(!projectLinks.some((link) => link.includes('example.com')));
  });

  test('複雑なマークダウンリンクパターンの処理', async () => {
    const complexContent = `# 複雑なテスト

[通常リンク](../settings/character1.md)
[タイトル付きリンク](../settings/character1.md "キャラクター1の説明")
[空テキスト](../settings/character1.md)
[特殊文字#含む](../settings/character1.md#section)
[  空白あり  ](../settings/character1.md)
`;

    const testPath = path.join(testProjectRoot, 'contents', 'complex_test.md');
    const testUri = mockFileRepository.createFileUri(testPath);
    await mockFileRepository.writeFileAsync(testUri, complexContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/new_character1.md',
    );

    assert.strictEqual(result.success, true);

    const updatedContent = await mockFileRepository.readFileAsync(testUri, 'utf8');

    // 各パターンが正しく更新されているかチェック
    assert.ok(updatedContent.includes('[通常リンク](../settings/new_character1.md)'));
    assert.ok(
      updatedContent.includes(
        '[タイトル付きリンク](../settings/new_character1.md "キャラクター1の説明")',
      ),
    );
    assert.ok(updatedContent.includes('[空テキスト](../settings/new_character1.md)'));
    assert.ok(updatedContent.includes('[特殊文字#含む](../settings/new_character1.md#section)'));
    assert.ok(updatedContent.includes('[  空白あり  ](../settings/new_character1.md)'));
  });

  test('パフォーマンステスト（大量ファイル）', async () => {
    // 大量のファイルとリンクを作成
    const largeProjectPath = '/tmp/large-project';
    const fileCount = 50;

    // 大量のマークダウンファイルを作成
    for (let i = 1; i <= fileCount; i++) {
      const filePath = path.join(largeProjectPath, 'contents', `file${i}.md`);
      const content = `# ファイル${i}\n[ターゲット](../settings/target.md)\n`;
      mockFileRepository.addFile(filePath, content);
    }

    // 新しいサービスインスタンスを大きなプロジェクト用に作成
    const metaYamlService = testContainer.getMetaYamlService();
    const largeProjectService = new ProjectLinkUpdateServiceImpl(
      mockFileRepository,
      metaYamlService,
      largeProjectPath,
    );

    const startTime = Date.now();
    const result = await largeProjectService.updateLinksAfterFileOperation(
      'settings/target.md',
      'settings/new_target.md',
    );
    const endTime = Date.now();

    assert.strictEqual(result.success, true);
    // 処理時間が合理的範囲内であることを確認（10秒以内）
    assert.ok(endTime - startTime < 10000, `処理時間が長すぎます: ${endTime - startTime}ms`);
  });
});
