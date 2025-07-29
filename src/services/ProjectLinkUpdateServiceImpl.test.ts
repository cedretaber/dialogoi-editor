import * as path from 'path';
import { ProjectLinkUpdateServiceImpl } from './ProjectLinkUpdateServiceImpl.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { ServiceContainer } from '../di/ServiceContainer.js';

describe('ProjectLinkUpdateServiceImpl テストスイート', () => {
  let service: ProjectLinkUpdateServiceImpl;
  let mockFileRepository: MockFileRepository;
  let testContainer: TestServiceContainer;
  let testProjectRoot: string;

  beforeEach(() => {
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

  afterEach(() => {
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

  it('ファイル名変更時のマークダウンリンク更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_renamed.md',
    );

    expect(result.success).toBe(true);
    expect(result.updatedFiles.length).toBe(2); // chapter1.md, chapter2.md

    // chapter1.mdの内容確認
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    const chapter1Content = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');

    expect(chapter1Content.includes('../settings/character1_renamed.md')).toBeTruthy();
    expect(!chapter1Content.includes('../settings/character1.md')).toBeTruthy();
    // 外部リンクは変更されない
    expect(chapter1Content.includes('https://example.com')).toBeTruthy();

    // chapter2.mdの内容確認
    const chapter2Path = path.join(testProjectRoot, 'contents', 'chapter2.md');
    const chapter2Uri = mockFileRepository.createFileUri(chapter2Path);
    const chapter2Content = await mockFileRepository.readFileAsync(chapter2Uri, 'utf8');

    expect(chapter2Content.includes('../settings/character1_renamed.md')).toBeTruthy();
  });

  it('meta.yamlファイルのreferences更新', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/character1.md',
      'settings/character1_moved.md',
    );

    expect(result.success).toBe(true);

    // contents/.dialogoi-meta.yamlの確認
    const contentsMetaPath = path.join(testProjectRoot, 'contents', '.dialogoi-meta.yaml');
    const contentsMetaUri = mockFileRepository.createFileUri(contentsMetaPath);
    const metaContent = await mockFileRepository.readFileAsync(contentsMetaUri, 'utf8');

    expect(metaContent.includes('settings/character1_moved.md')).toBeTruthy();
    expect(!metaContent.includes('settings/character1.md')).toBeTruthy();
  });

  it('ファイル移動時の複数リンク更新', async () => {
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

    expect(result.success).toBe(true);

    // chapter1.mdの内容確認（複数のリンクが全て更新される）
    const updatedContent = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');
    const character1Links = (updatedContent.match(/\.\.\/settings\/heroes\/character1\.md/g) || [])
      .length;
    expect(character1Links).toBe(2); // 2箇所のリンクが更新されている

    // character2.mdのリンクは変更されない
    expect(updatedContent.includes('../settings/character2.md')).toBeTruthy();
  });

  it('プロジェクト外リンクは更新しない', async () => {
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

    expect(result.success).toBe(true);

    // 外部リンクテストファイルの確認
    const updatedContent = await mockFileRepository.readFileAsync(testFileUri, 'utf8');

    // 内部リンクのみ更新される
    expect(updatedContent.includes('../settings/character1_new.md')).toBeTruthy();
    // 外部リンクは変更されない
    expect(updatedContent.includes('https://example.com/character1.md')).toBeTruthy();
    expect(updatedContent.includes('/absolute/path/character1.md')).toBeTruthy();
  });

  it('存在しないファイルの更新は無視', async () => {
    // 存在しないファイルのリンクを含む設定で実行
    const result = await service.updateLinksAfterFileOperation(
      'nonexistent/file.md',
      'also_nonexistent/file.md',
    );

    // 処理は成功するが、更新されるファイルはない
    expect(result.success).toBe(true);
    expect(result.updatedFiles.length).toBe(0);
  });

  it('scanFileForProjectLinks デバッグ機能', async () => {
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const projectLinks = await service.scanFileForProjectLinks(chapter1Path);

    // プロジェクト内リンクのみが抽出される
    expect(projectLinks.includes('settings/character1.md')).toBeTruthy();
    expect(projectLinks.includes('settings/character2.md')).toBeTruthy();
    // 外部リンクは含まれない
    expect(projectLinks.some((link) => link.includes('example.com'))).toBeFalsy();
  });

  it('複雑なマークダウンリンクパターンの処理', async () => {
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

    expect(result.success).toBe(true);

    const updatedContent = await mockFileRepository.readFileAsync(testUri, 'utf8');

    // 各パターンが正しく更新されているかチェック
    expect(updatedContent.includes('[通常リンク](../settings/new_character1.md)).toBeTruthy()'));
    expect(
      updatedContent.includes(
        '[タイトル付きリンク](../settings/new_character1.md "キャラクター1の説明").toBeTruthy()',
      ),
    );
    expect(updatedContent.includes('[空テキスト](../settings/new_character1.md)).toBeTruthy()'));
    expect(updatedContent.includes('[特殊文字#含む](../settings/new_character1.md#section)).toBeTruthy()'));
    expect(updatedContent.includes('[  空白あり  ](../settings/new_character1.md)).toBeTruthy()'));
  });

  it('パフォーマンステスト（大量ファイル）', async () => {
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

    expect(result.success).toBe(true);
    // 処理時間が合理的範囲内であることを確認（10秒以内）
    expect(endTime - startTime < 10000).toBeTruthy();
  });
});
