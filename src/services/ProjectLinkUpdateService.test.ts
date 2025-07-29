import * as assert from 'assert';
import * as path from 'path';
import { ProjectLinkUpdateService } from './ProjectLinkUpdateService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { hasReferencesProperty } from '../utils/MetaYamlUtils.js';
import {
  createContentItem,
  createSubdirectoryItem,
  createSettingItem,
  createCharacterItem,
} from '../test/testHelpers.js';

suite('ProjectLinkUpdateService テストスイート', () => {
  let service: ProjectLinkUpdateService;
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
    service = new ProjectLinkUpdateService(mockFileRepository, metaYamlService, testProjectRoot);

    // テスト用のプロジェクト構造を作成
    createTestProject();
  });

  teardown(() => {
    mockFileRepository.reset();
    testContainer.cleanup();
    ServiceContainer.clearTestInstance();
  });

  function createTestProject(): void {
    // プロジェクトルート
    mockFileRepository.addDirectory(testProjectRoot);
    mockFileRepository.addFile(path.join(testProjectRoot, 'dialogoi.yaml'), 'version: 1.0');

    // ルートのmeta.yaml
    const contentsSubdir = createSubdirectoryItem({
      name: 'contents',
      path: path.join(testProjectRoot, 'contents'),
    });
    const settingsSubdir = createSubdirectoryItem({
      name: 'settings',
      path: path.join(testProjectRoot, 'settings'),
    });

    const rootMeta = `readme: README.md
files:
  - name: ${contentsSubdir.name}
    type: ${contentsSubdir.type}
    path: ${contentsSubdir.path}
    isUntracked: ${contentsSubdir.isUntracked}
    isMissing: ${contentsSubdir.isMissing}
  - name: ${settingsSubdir.name}
    type: ${settingsSubdir.type}
    path: ${settingsSubdir.path}
    isUntracked: ${settingsSubdir.isUntracked}
    isMissing: ${settingsSubdir.isMissing}
`;
    mockFileRepository.addFile(path.join(testProjectRoot, '.dialogoi-meta.yaml'), rootMeta);

    // contentsディレクトリ
    const contentsDir = path.join(testProjectRoot, 'contents');
    mockFileRepository.addDirectory(contentsDir);

    const chapter1Item = createContentItem({
      name: 'chapter1.md',
      path: path.join(contentsDir, 'chapter1.md'),
      references: ['settings/world.md', 'settings/characters/hero.md'],
    });
    const chapter2Item = createContentItem({
      name: 'chapter2.md',
      path: path.join(contentsDir, 'chapter2.md'),
    });

    const contentsMeta = `readme: README.md
files:
  - name: ${chapter1Item.name}
    type: ${chapter1Item.type}
    path: ${chapter1Item.path}
    hash: ${chapter1Item.hash}
    tags: []
    references:
      - settings/world.md
      - settings/characters/hero.md
    comments: ${chapter1Item.comments}
    isUntracked: ${chapter1Item.isUntracked}
    isMissing: ${chapter1Item.isMissing}
  - name: ${chapter2Item.name}
    type: ${chapter2Item.type}
    path: ${chapter2Item.path}
    hash: ${chapter2Item.hash}
    tags: []
    references: []
    comments: ${chapter2Item.comments}
    isUntracked: ${chapter2Item.isUntracked}
    isMissing: ${chapter2Item.isMissing}
`;
    mockFileRepository.addFile(path.join(contentsDir, '.dialogoi-meta.yaml'), contentsMeta);

    // マークダウンファイル（リンクを含む）
    const chapter1Content = `# 第1章

この章では[世界設定](settings/world.md)と[主人公](settings/characters/hero.md)について説明します。

また、[外部リンク](https://example.com)は更新対象外です。
`;
    mockFileRepository.addFile(path.join(contentsDir, 'chapter1.md'), chapter1Content);

    const chapter2Content = `# 第2章

この章では[世界設定](settings/world.md)について詳しく説明します。
`;
    mockFileRepository.addFile(path.join(contentsDir, 'chapter2.md'), chapter2Content);

    // settingsディレクトリ
    const settingsDir = path.join(testProjectRoot, 'settings');
    mockFileRepository.addDirectory(settingsDir);

    const worldItem = createSettingItem({
      name: 'world.md',
      path: path.join(settingsDir, 'world.md'),
    });
    const charactersSubdir = createSubdirectoryItem({
      name: 'characters',
      path: path.join(settingsDir, 'characters'),
    });

    const settingsMeta = `readme: README.md
files:
  - name: ${worldItem.name}
    type: ${worldItem.type}
    path: ${worldItem.path}
    hash: ${worldItem.hash}
    tags: []
    comments: ${worldItem.comments}
    isUntracked: ${worldItem.isUntracked}
    isMissing: ${worldItem.isMissing}
  - name: ${charactersSubdir.name}
    type: ${charactersSubdir.type}
    path: ${charactersSubdir.path}
    isUntracked: ${charactersSubdir.isUntracked}
    isMissing: ${charactersSubdir.isMissing}
`;
    mockFileRepository.addFile(path.join(settingsDir, '.dialogoi-meta.yaml'), settingsMeta);

    mockFileRepository.addFile(path.join(settingsDir, 'world.md'), '# 世界設定\n\n世界の詳細設定');

    // settings/charactersディレクトリ
    const charactersDir = path.join(settingsDir, 'characters');
    mockFileRepository.addDirectory(charactersDir);

    const heroItem = createCharacterItem({
      name: 'hero.md',
      path: path.join(charactersDir, 'hero.md'),
      character: {
        importance: 'main',
        multiple_characters: false,
        display_name: '',
      },
    });

    const charactersMeta = `readme: README.md
files:
  - name: ${heroItem.name}
    type: ${heroItem.type}
    path: ${heroItem.path}
    hash: ${heroItem.hash}
    tags: []
    comments: ${heroItem.comments}
    isUntracked: ${heroItem.isUntracked}
    isMissing: ${heroItem.isMissing}
    character:
      importance: main
      multiple_characters: false
      display_name: ''
`;
    mockFileRepository.addFile(path.join(charactersDir, '.dialogoi-meta.yaml'), charactersMeta);

    mockFileRepository.addFile(
      path.join(charactersDir, 'hero.md'),
      '# 主人公\n\nメインキャラクター',
    );
  }

  test('ファイル名変更時のマークダウンリンク更新', async () => {
    // world.md → world-setting.md にリネーム
    const result = await service.updateLinksAfterFileOperation(
      'settings/world.md',
      'settings/world-setting.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 3); // chapter1.md, chapter2.md, contents/.dialogoi-meta.yaml
    assert.strictEqual(result.failedFiles.length, 0);

    // chapter1.mdの内容確認
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    const chapter1Content = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');

    assert.strictEqual(
      chapter1Content.includes('[世界設定](settings/world-setting.md)'),
      true,
      'chapter1.mdのリンクが更新されている（プロジェクトルート相対パス）',
    );
    assert.strictEqual(
      chapter1Content.includes('[主人公](settings/characters/hero.md)'),
      true,
      '他のリンクは変更されていない（プロジェクトルート相対パス）',
    );
    assert.strictEqual(
      chapter1Content.includes('[外部リンク](https://example.com)'),
      true,
      '外部リンクは変更されていない',
    );

    // chapter2.mdの内容確認
    const chapter2Path = path.join(testProjectRoot, 'contents', 'chapter2.md');
    const chapter2Uri = mockFileRepository.createFileUri(chapter2Path);
    const chapter2Content = await mockFileRepository.readFileAsync(chapter2Uri, 'utf8');

    assert.strictEqual(
      chapter2Content.includes('[世界設定](settings/world-setting.md)'),
      true,
      'chapter2.mdのリンクが更新されている（プロジェクトルート相対パス）',
    );
  });

  test('meta.yamlファイルのreferences更新', async () => {
    // hero.md → main-character.md にリネーム
    const result = await service.updateLinksAfterFileOperation(
      'settings/characters/hero.md',
      'settings/characters/main-character.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 2); // chapter1.md, contents/.dialogoi-meta.yaml

    // contents/.dialogoi-meta.yamlの内容確認
    const metaYamlService = testContainer.getMetaYamlService();
    const contentsDir = path.join(testProjectRoot, 'contents');
    const meta = await metaYamlService.loadMetaYamlAsync(contentsDir);

    assert.notStrictEqual(meta, null);
    if (meta === null) {
      throw new Error('meta should not be null');
    }
    const chapter1Item = meta.files.find((file) => file.name === 'chapter1.md');
    assert.notStrictEqual(chapter1Item, undefined);
    if (chapter1Item && hasReferencesProperty(chapter1Item)) {
      assert.deepStrictEqual(chapter1Item.references, [
        'settings/world.md',
        'settings/characters/main-character.md',
      ]);
    }
  });

  test('ファイル移動時の複数リンク更新', async () => {
    // charactersディレクトリ全体を別の場所に移動したと仮定
    // hero.md が settings/characters/hero.md → settings/people/hero.md に移動
    const result = await service.updateLinksAfterFileOperation(
      'settings/characters/hero.md',
      'settings/people/hero.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 2); // chapter1.md, contents/.dialogoi-meta.yaml

    // マークダウンファイルの更新確認
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    const chapter1Content = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');

    assert.strictEqual(
      chapter1Content.includes('[主人公](settings/people/hero.md)'),
      true,
      'マークダウンリンクが正しく更新されている（プロジェクトルート相対パス）',
    );

    // meta.yamlの更新確認
    const metaYamlService = testContainer.getMetaYamlService();
    const contentsDir = path.join(testProjectRoot, 'contents');
    const meta = await metaYamlService.loadMetaYamlAsync(contentsDir);

    assert.notStrictEqual(meta, null);
    if (meta === null) {
      throw new Error('meta should not be null');
    }
    const chapter1Item = meta.files.find((file) => file.name === 'chapter1.md');
    assert.notStrictEqual(chapter1Item, undefined);
    if (chapter1Item && hasReferencesProperty(chapter1Item)) {
      assert.deepStrictEqual(chapter1Item.references, [
        'settings/world.md',
        'settings/people/hero.md',
      ]);
    }
  });

  test('プロジェクト外リンクは更新しない', async () => {
    // 外部URLや絶対パスは更新対象外
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const chapter1Uri = mockFileRepository.createFileUri(chapter1Path);
    const originalContent = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');

    const result = await service.updateLinksAfterFileOperation(
      'external/file.md',
      'external/renamed.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 0);

    // ファイル内容が変更されていないことを確認
    const updatedContent = await mockFileRepository.readFileAsync(chapter1Uri, 'utf8');
    assert.strictEqual(originalContent, updatedContent);
  });

  test('存在しないファイルの更新は無視', async () => {
    const result = await service.updateLinksAfterFileOperation(
      'settings/nonexistent.md',
      'settings/still-nonexistent.md',
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length, 0);
    assert.strictEqual(result.failedFiles.length, 0);
  });

  test('scanFileForProjectLinks デバッグ機能', async () => {
    const chapter1Path = path.join(testProjectRoot, 'contents', 'chapter1.md');
    const projectLinks = await service.scanFileForProjectLinks(chapter1Path);

    assert.deepStrictEqual(
      projectLinks.sort(),
      ['settings/world.md', 'settings/characters/hero.md'].sort(),
    );
  });

  test('複雑なマークダウンリンクパターンの処理', async () => {
    // 複雑なリンクパターンを含むファイルを作成
    const complexMarkdownContent = `# 複雑なリンクテスト

[通常のリンク](settings/world.md)
[スペース付きテキスト](settings/world.md "タイトル付きリンク")
[複数行にまたがる
リンク](settings/world.md)

**太字内の[リンク](settings/world.md)**

\`コード内の[リンク](settings/world.md)\`

> 引用内の[リンク](settings/world.md)

- リスト内の[リンク](settings/world.md)
`;

    const complexFilePath = path.join(testProjectRoot, 'contents', 'complex.md');
    mockFileRepository.addFile(complexFilePath, complexMarkdownContent);

    const result = await service.updateLinksAfterFileOperation(
      'settings/world.md',
      'settings/new-world.md',
    );

    assert.strictEqual(result.success, true);

    const complexFileUri = mockFileRepository.createFileUri(complexFilePath);
    const updatedContent = await mockFileRepository.readFileAsync(complexFileUri, 'utf8');

    // 複数の箇所でリンクが更新されていることを確認
    const linkCount = (updatedContent.match(/settings\/new-world\.md/g) || []).length;
    assert.strictEqual(linkCount >= 5, true, '複数のリンクが更新されている');

    // 元のリンクが残っていないことを確認
    assert.strictEqual(
      updatedContent.includes('settings/world.md'),
      false,
      '古いリンクが残っていない',
    );
  });

  test('パフォーマンステスト（大量ファイル）', async () => {
    // 大量のファイルを作成してパフォーマンスをテスト
    const fileCount = 100;

    for (let i = 0; i < fileCount; i++) {
      const filePath = path.join(testProjectRoot, 'contents', `file${i}.md`);
      const content = `# ファイル${i}\n\n[世界設定](../settings/world.md)への参照`;
      mockFileRepository.addFile(filePath, content);
    }

    const startTime = Date.now();
    const result = await service.updateLinksAfterFileOperation(
      'settings/world.md',
      'settings/world-new.md',
    );
    const endTime = Date.now();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.updatedFiles.length >= fileCount, true);

    // パフォーマンス要件：100ファイルで5秒以内
    const executionTime = endTime - startTime;
    assert.strictEqual(executionTime < 5000, true, `実行時間: ${executionTime}ms`);
  });
});
