import { mock, MockProxy } from 'jest-mock-extended';
import { FileManagementService } from './FileManagementService.js';
import { ForeshadowingData } from './ForeshadowingService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as yaml from 'js-yaml';

describe('FileManagementService テストスイート', () => {
  let fileManagementService: FileManagementService;
  let mockFileRepository: MockProxy<FileRepository>;
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
    mockMetaYamlService = mock<MetaYamlService>();

    // サービスインスタンス作成
    fileManagementService = new FileManagementService(mockFileRepository, mockMetaYamlService);

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    // テスト用ディレクトリ構造の準備
    addDirectory('/test');
    addFile(
      '/test/.dialogoi-meta.yaml',
      `readme: README.md
files:
  - name: character.txt
    type: setting
    path: /test/character.txt
    hash: hash123
    tags: []
    comments: '.character.txt.comments.yaml'
    isUntracked: false
    isMissing: false
    character:
      importance: sub
      multiple_characters: false
      display_name: 'テストキャラクター'
  - name: foreshadow.txt
    type: setting
    path: /test/foreshadow.txt
    hash: hash456
    tags: []
    comments: '.foreshadow.txt.comments.yaml'
    isUntracked: false
    isMissing: false
    foreshadowing:
      plants: []
      payoff:
        location: ""
        comment: ""
  - name: plain.txt
    type: setting
    path: /test/plain.txt
    hash: hash789
    tags: []
    comments: '.plain.txt.comments.yaml'
    isUntracked: false
    isMissing: false
`,
    );
  });

  function setupFileSystemMocks(): void {
    // createFileUriのモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath } as Uri;
    });

    // createDirectoryUriのモック
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath } as Uri;
    });

    // existsAsyncのモック
    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    // readFileAsyncのモック
    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, _encoding?: string): Promise<string> => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      return Promise.resolve(content);
    });

    // writeFileAsyncのモック
    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, data: string | Uint8Array) => {
      const content = typeof data === 'string' ? data : new TextDecoder().decode(data);
      fileSystem.set(uri.path, content);
      return Promise.resolve();
    });

    // MetaYamlServiceのモック設定
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((absolutePath: string) => {
      const metaPath = absolutePath + '/.dialogoi-meta.yaml';
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

    mockMetaYamlService.saveMetaYamlAsync.mockImplementation(
      (absolutePath: string, metaData: MetaYaml) => {
        const metaPath = absolutePath + '/.dialogoi-meta.yaml';
        const yamlContent = yaml.dump(metaData);
        fileSystem.set(metaPath, yamlContent);
        return Promise.resolve(true);
      },
    );
  }

  // テスト用ヘルパー関数
  function addFile(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  function addDirectory(dirPath: string): void {
    directories.add(dirPath);
  }

  describe('既存機能テスト', () => {
    it('管理対象外ファイルを管理対象に追加できる', async () => {
      // 新しいファイルを作成
      addFile('/test/new-file.txt', 'New content');

      const result = await fileManagementService.addFileToManagement(
        '/test/new-file.txt',
        'content',
      );

      expect(result.success).toBe(true);
      expect(result.message.includes('管理対象に追加しました')).toBeTruthy();

      // メタデータが更新されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('new-file.txt')).toBeTruthy();
    });

    it('存在しないファイルの追加はエラー', async () => {
      const result = await fileManagementService.addFileToManagement(
        '/test/nonexistent.txt',
        'content',
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('ファイルが存在しません')).toBeTruthy();
    });

    it('管理対象からファイルを削除できる', async () => {
      const result = await fileManagementService.removeFileFromManagement('/test/plain.txt');

      expect(result.success).toBe(true);
      expect(result.message.includes('管理対象から削除しました')).toBeTruthy();

      // メタデータから削除されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('plain.txt')).toBeFalsy();
    });

    it('欠損ファイルを作成できる', async () => {
      const result = await fileManagementService.createMissingFile(
        '/test/missing.txt',
        'Test content',
      );

      expect(result.success).toBe(true);
      expect(result.message.includes('ファイルを作成しました')).toBeTruthy();

      // ファイルが作成されているか確認
      const fileContent = fileSystem.get('/test/missing.txt');
      expect(fileContent).toBe('Test content');
    });
  });

  describe('キャラクター操作', () => {
    it('キャラクター重要度を設定できる', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'character.txt',
        'main',
      );

      expect(result.success).toBe(true);
      expect(result.message.includes('キャラクター重要度を "main" に設定しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // メタデータが更新されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('importance: main')).toBeTruthy();
    });

    it('存在しないファイルにキャラクター重要度を設定するとエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'nonexistent.txt',
        'main',
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });

    it('複数キャラクターフラグを設定できる', async () => {
      const result = await fileManagementService.setMultipleCharacters(
        '/test',
        'character.txt',
        true,
      );

      expect(result.success).toBe(true);
      expect(
        result.message.includes('複数キャラクターフラグを "有効" に設定しました'),
      ).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // メタデータが更新されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('multiple_characters: true')).toBeTruthy();
    });

    it('新規ファイルに複数キャラクターフラグを設定できる', async () => {
      const result = await fileManagementService.setMultipleCharacters('/test', 'plain.txt', false);

      expect(result.success).toBe(true);
      expect(
        result.message.includes('複数キャラクターフラグを "無効" に設定しました'),
      ).toBeTruthy();

      // メタデータが更新されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('importance: sub')).toBeTruthy();
      expect(metaContent?.includes('multiple_characters: false')).toBeTruthy();
    });

    it('キャラクター設定を削除できる', async () => {
      // まずキャラクター設定を追加
      await fileManagementService.setCharacterImportance('/test', 'character.txt', 'main');

      // 削除
      const result = await fileManagementService.removeCharacter('/test', 'character.txt');

      expect(result.success).toBe(true);
      expect(result.message.includes('キャラクター設定を削除しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // メタデータからキャラクター設定が削除されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('character:')).toBeFalsy();
    });
  });

  describe('伏線操作', () => {
    it('伏線設定を設定できる', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          {
            location: 'Chapter 1:10',
            comment: 'Plant 1',
          },
        ],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };

      const result = await fileManagementService.setForeshadowing(
        '/test',
        'foreshadow.txt',
        foreshadowingData,
      );

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線設定を更新しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // メタデータが更新されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('foreshadowing:')).toBeTruthy();
      expect(metaContent?.includes('Plant 1')).toBeTruthy();
      expect(metaContent?.includes('Payoff')).toBeTruthy();
    });

    it('存在しないファイルに伏線設定を設定するとエラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };

      const result = await fileManagementService.setForeshadowing(
        '/test',
        'nonexistent.txt',
        foreshadowingData,
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });

    it('伏線設定を削除できる', async () => {
      // まず伏線設定を追加
      const foreshadowingData: ForeshadowingData = {
        plants: [],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };
      await fileManagementService.setForeshadowing('/test', 'foreshadow.txt', foreshadowingData);

      // 削除
      const result = await fileManagementService.removeForeshadowing('/test', 'foreshadow.txt');

      expect(result.success).toBe(true);
      expect(result.message.includes('伏線設定を削除しました')).toBeTruthy();
      expect(result.updatedItems).toBeTruthy();

      // メタデータから伏線設定が削除されているか確認
      const metaContent = fileSystem.get('/test/.dialogoi-meta.yaml');
      expect(metaContent?.includes('foreshadowing:')).toBeFalsy();
    });
  });

  describe('エラーハンドリング', () => {
    it('メタデータファイルが存在しない場合のエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/nonexistent',
        'file.txt',
        'main',
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('.dialogoi-meta.yamlが見つから')).toBeTruthy();
    });

    it('存在しないファイルに対する操作はエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'nonexistent.txt',
        'main',
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('見つかりません')).toBeTruthy();
    });
  });
});
