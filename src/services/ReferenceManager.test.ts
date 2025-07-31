import { mock, MockProxy } from 'jest-mock-extended';
import * as path from 'path';
import { ReferenceManager } from './ReferenceManager.js';
import { FileRepository, DirectoryEntry } from '../repositories/FileRepository.js';
import { HyperlinkExtractorService } from './HyperlinkExtractorService.js';
import { FilePathMapService } from './FilePathMapService.js';
import { MetaYamlService } from './MetaYamlService.js';
import { ServiceContainer } from '../di/ServiceContainer.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as yaml from 'js-yaml';

describe('ReferenceManager テストスイート', () => {
  let testDir: string;
  let refManager: ReferenceManager;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockHyperlinkExtractorService: MockProxy<HyperlinkExtractorService>;
  let mockFilePathMapService: MockProxy<FilePathMapService>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();

    // ファイルシステムの初期化
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockHyperlinkExtractorService = mock<HyperlinkExtractorService>();
    mockFilePathMapService = mock<FilePathMapService>();
    mockMetaYamlService = mock<MetaYamlService>();

    testDir = '/tmp/dialogoi-ref-test';

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    // ServiceContainerのモック設定
    const mockServiceContainer = mock<ServiceContainer>();
    mockServiceContainer.getFilePathMapService.mockReturnValue(mockFilePathMapService);
    mockServiceContainer.getHyperlinkExtractorService.mockReturnValue(
      mockHyperlinkExtractorService,
    );
    mockServiceContainer.getMetaYamlService.mockReturnValue(mockMetaYamlService);
    jest.spyOn(ServiceContainer, 'getInstance').mockReturnValue(mockServiceContainer);

    // テスト用のプロジェクト構造を作成
    createTestProject();

    // ReferenceManagerのインスタンスを取得
    refManager = ReferenceManager.getInstance();
    refManager.clear(); // 前のテストの影響を除去
  });

  afterEach(() => {
    // モックを復元
    jest.restoreAllMocks();
    refManager.clear();
  });

  function setupFileSystemMocks(): void {
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });

    // createDirectoryUriのモック
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath, fsPath: dirPath } as Uri;
    });

    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    // readFileAsyncのモック
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        (uri: Uri, encoding?: string) => Promise<string | Uint8Array>
      >
    ).mockImplementation((uri: Uri, encoding?: string): Promise<string | Uint8Array> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      if (encoding !== undefined) {
        return Promise.resolve(content);
      } else {
        return Promise.resolve(new TextEncoder().encode(content));
      }
    });

    // readdirAsyncのモック
    mockFileRepository.readdirAsync.mockImplementation((uri: Uri) => {
      const entries: DirectoryEntry[] = [];
      const basePath = uri.path;

      // ファイルを探す
      for (const filePath of Array.from(fileSystem.keys())) {
        if (path.dirname(filePath) === basePath) {
          const name = path.basename(filePath);
          entries.push({
            name,
            isFile: () => true,
            isDirectory: () => false,
          });
        }
      }

      // ディレクトリを探す
      for (const dirPath of Array.from(directories)) {
        if (path.dirname(dirPath) === basePath) {
          const name = path.basename(dirPath);
          entries.push({
            name,
            isFile: () => false,
            isDirectory: () => true,
          });
        }
      }

      return Promise.resolve(entries);
    });

    // 依存サービスのモック設定
    mockFilePathMapService.buildFileMap.mockResolvedValue();
    mockHyperlinkExtractorService.extractProjectLinksAsync.mockResolvedValue([]);

    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((absolutePath: string) => {
      const metaPath = path.join(absolutePath, '.dialogoi-meta.yaml');
      const content = fileSystem.get(metaPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(yaml.load(content) as MetaYaml);
      } catch {
        return Promise.resolve(null);
      }
    });
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  function createTestProject(): void {
    // ルートディレクトリを作成
    addDirectory(testDir);
    addFile(path.join(testDir, 'dialogoi.yaml'), 'version: 1.0');

    // ルートの.dialogoi-meta.yamlを作成
    const rootMeta = `readme: README.md
files:
  - name: contents
    type: subdirectory
    path: /tmp/dialogoi-ref-test/contents
    isUntracked: false
    isMissing: false
  - name: settings
    type: subdirectory
    path: /tmp/dialogoi-ref-test/settings
    isUntracked: false
    isMissing: false
`;
    addFile(path.join(testDir, '.dialogoi-meta.yaml'), rootMeta);

    // contentsディレクトリと.dialogoi-meta.yamlを作成
    const contentsDir = path.join(testDir, 'contents');
    addDirectory(contentsDir);

    const contentsMeta = `readme: README.md
files:
  - name: chapter1.txt
    type: content
    path: /tmp/dialogoi-ref-test/contents/chapter1.txt
    hash: hash1
    tags: []
    references:
      - settings/world.md
      - settings/characters/hero.md
    comments: ''
    isUntracked: false
    isMissing: false
  - name: chapter2.txt
    type: content
    path: /tmp/dialogoi-ref-test/contents/chapter2.txt
    hash: hash2
    tags: []
    references:
      - settings/magic.md
    comments: ''
    isUntracked: false
    isMissing: false
`;
    addFile(path.join(contentsDir, '.dialogoi-meta.yaml'), contentsMeta);
    addFile(path.join(contentsDir, 'chapter1.txt'), 'Chapter 1 content');
    addFile(path.join(contentsDir, 'chapter2.txt'), 'Chapter 2 content');

    // settingsディレクトリと.dialogoi-meta.yamlを作成
    const settingsDir = path.join(testDir, 'settings');
    addDirectory(settingsDir);

    const settingsMeta = `readme: README.md
files:
  - name: world.md
    type: setting
    path: /tmp/dialogoi-ref-test/settings/world.md
    hash: hash3
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: magic.md
    type: setting
    path: /tmp/dialogoi-ref-test/settings/magic.md
    hash: hash4
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
  - name: characters
    type: subdirectory
    path: /tmp/dialogoi-ref-test/settings/characters
    isUntracked: false
    isMissing: false
`;
    addFile(path.join(settingsDir, '.dialogoi-meta.yaml'), settingsMeta);
    addFile(path.join(settingsDir, 'world.md'), 'World setting');
    addFile(path.join(settingsDir, 'magic.md'), 'Magic system');

    // settings/charactersディレクトリと.dialogoi-meta.yamlを作成
    const charactersDir = path.join(settingsDir, 'characters');
    addDirectory(charactersDir);

    const charactersMeta = `readme: README.md
files:
  - name: hero.md
    type: setting
    path: /tmp/dialogoi-ref-test/settings/characters/hero.md
    hash: hash5
    tags: []
    comments: ''
    isUntracked: false
    isMissing: false
    character:
      importance: main
      multiple_characters: false
      display_name: ''
`;
    addFile(path.join(charactersDir, '.dialogoi-meta.yaml'), charactersMeta);
    addFile(path.join(charactersDir, 'hero.md'), 'Hero character');
  }

  it('初期化が正しく動作する', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // chapter1.txtの参照関係をチェック
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    const chapter1RefPaths = chapter1Refs.references.map((ref) => ref.path);
    expect(chapter1RefPaths).toEqual(['settings/world.md', 'settings/characters/hero.md']);

    // chapter2.txtの参照関係をチェック
    const chapter2Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter2.txt'));
    const chapter2RefPaths = chapter2Refs.references.map((ref) => ref.path);
    expect(chapter2RefPaths).toEqual(['settings/magic.md']);

    // 逆参照もチェック
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    const worldRefByPaths = worldRefs.referencedBy.map((ref) => ref.path);
    expect(worldRefByPaths).toEqual(['contents/chapter1.txt']);

    const heroRefs = refManager.getReferences(
      path.join(testDir, 'settings', 'characters', 'hero.md'),
    );
    const heroRefByPaths = heroRefs.referencedBy.map((ref) => ref.path);
    expect(heroRefByPaths).toEqual(['contents/chapter1.txt']);

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    const magicRefByPaths = magicRefs.referencedBy.map((ref) => ref.path);
    expect(magicRefByPaths).toEqual(['contents/chapter2.txt']);
  });

  it('単一ファイルの参照関係を更新できる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const newReferences = ['settings/world.md', 'settings/magic.md']; // hero.mdを削除、magic.mdを追加

    refManager.updateFileReferences(filePath, newReferences);

    // 更新後の参照関係をチェック
    const chapter1Refs = refManager.getReferences(filePath);
    const chapter1RefPaths = chapter1Refs.references.map((ref) => ref.path);
    expect(chapter1RefPaths).toEqual(newReferences);

    // 逆参照もチェック
    const heroRefs = refManager.getReferences(
      path.join(testDir, 'settings', 'characters', 'hero.md'),
    );
    expect(heroRefs.referencedBy.length).toBe(0); // chapter1.txtからの参照が削除されている

    const magicRefs = refManager.getReferences(path.join(testDir, 'settings', 'magic.md'));
    const magicRefByPaths = magicRefs.referencedBy.map((ref) => ref.path).sort();
    expect(magicRefByPaths).toEqual(['contents/chapter1.txt', 'contents/chapter2.txt'].sort());
  });

  it('存在しないファイルの参照関係を取得すると空の配列が返る', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const nonExistentPath = path.join(testDir, 'non-existent.txt');
    const refs = refManager.getReferences(nonExistentPath);

    expect(refs.references).toEqual([]);
    expect(refs.referencedBy).toEqual([]);
  });

  it('clearメソッドで参照関係がクリアされる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // 初期化後は参照関係がある
    const chapter1Refs = refManager.getReferences(path.join(testDir, 'contents', 'chapter1.txt'));
    expect(chapter1Refs.references.length).not.toBe(0);

    refManager.clear();

    // クリア後は参照関係が空になる
    const chapter1RefsAfter = refManager.getReferences(
      path.join(testDir, 'contents', 'chapter1.txt'),
    );
    expect(chapter1RefsAfter.references).toEqual([]);
    expect(chapter1RefsAfter.referencedBy).toEqual([]);
  });

  it('ファイルの存在チェック（非同期版）が正しく動作する', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // 存在するファイル
    expect(await refManager.checkFileExistsAsync('settings/world.md')).toBe(true);
    expect(await refManager.checkFileExistsAsync('contents/chapter1.txt')).toBe(true);

    // 存在しないファイル
    expect(await refManager.checkFileExistsAsync('non-existent.md')).toBe(false);
    expect(await refManager.checkFileExistsAsync('settings/non-existent.md')).toBe(false);
  });

  it('無効な参照先ファイルを取得（非同期版）できる', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    // chapter1.txtに存在しない参照を追加
    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const referencesWithInvalid = [
      'settings/world.md', // 存在する
      'settings/non-existent.md', // 存在しない
      'invalid/path.md', // 存在しない
    ];

    refManager.updateFileReferences(filePath, referencesWithInvalid);

    const invalidRefs = await refManager.getInvalidReferencesAsync(filePath);
    expect(invalidRefs.sort()).toEqual(['settings/non-existent.md', 'invalid/path.md'].sort());
  });

  it('空の参照配列で更新すると参照関係が削除される', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');

    // 最初は参照がある
    const initialRefs = refManager.getReferences(filePath);
    expect(initialRefs.references.length).not.toBe(0);

    // 空の配列で更新
    refManager.updateFileReferences(filePath, []);

    // 参照が削除される
    const updatedRefs = refManager.getReferences(filePath);
    expect(updatedRefs.references).toEqual([]);

    // 逆参照も削除される
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    expect(worldRefs.referencedBy.some((ref) => ref.path === 'contents/chapter1.txt')).toBe(false);
  });

  it('同じファイルを複数回参照しても重複しない', async () => {
    await refManager.initialize(testDir, mockFileRepository);

    const filePath = path.join(testDir, 'contents', 'chapter1.txt');
    const duplicateReferences = [
      'settings/world.md',
      'settings/world.md', // 重複
      'settings/magic.md',
    ];

    refManager.updateFileReferences(filePath, duplicateReferences);

    const refs = refManager.getReferences(filePath);
    const refPaths = refs.references.map((ref) => ref.path);
    expect(refPaths).toEqual(['settings/world.md', 'settings/magic.md']);

    // 逆参照も重複しない
    const worldRefs = refManager.getReferences(path.join(testDir, 'settings', 'world.md'));
    const chapter1Count = worldRefs.referencedBy.filter(
      (ref) => ref.path === 'contents/chapter1.txt',
    ).length;
    expect(chapter1Count).toBe(1);
  });

  it('シングルトンパターンが正しく動作する', () => {
    const instance1 = ReferenceManager.getInstance();
    const instance2 = ReferenceManager.getInstance();

    expect(instance1).toBe(instance2);
  });
});
