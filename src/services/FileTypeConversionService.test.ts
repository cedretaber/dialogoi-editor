import { mock, MockProxy } from 'jest-mock-extended';
import * as yaml from 'js-yaml';
import { FileTypeConversionService } from './FileTypeConversionService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { FileChangeNotificationService } from './FileChangeNotificationService.js';
import { EventEmitterRepository } from '../repositories/EventEmitterRepository.js';
import { FileChangeEvent } from './FileChangeNotificationService.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import * as path from 'path';

describe('FileTypeConversionService テストスイート', () => {
  let service: FileTypeConversionService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();

    // FileChangeNotificationServiceを初期化（シングルトン）
    const mockEventEmitterRepository = mock<EventEmitterRepository<FileChangeEvent>>();
    FileChangeNotificationService.setInstance(mockEventEmitterRepository);

    // モックの設定
    setupMocks();

    service = new FileTypeConversionService(mockFileRepository, mockMetaYamlService);
  });

  function setupMocks(): void {
    // FileRepository のモック
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });

    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath, fsPath: dirPath } as Uri;
    });

    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    (
      mockFileRepository.readFileAsync as jest.MockedFunction<
        typeof mockFileRepository.readFileAsync
      >
    ).mockImplementation((uri: Uri, _encoding?: string) => {
      const content = fileSystem.get(uri.path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${uri.path}`));
      }
      return Promise.resolve(content);
    });

    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, content: string) => {
      fileSystem.set(uri.path, content);
      return Promise.resolve();
    });

    // MetaYamlService のモック
    mockMetaYamlService.loadMetaYamlAsync.mockImplementation((dirPath: string) => {
      const yamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
      const content = fileSystem.get(yamlPath);
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
      (dirPath: string, metaData: MetaYaml) => {
        const yamlPath = path.join(dirPath, '.dialogoi-meta.yaml');
        const yamlContent = yaml.dump(metaData);
        fileSystem.set(yamlPath, yamlContent);
        return Promise.resolve(true);
      },
    );
  }

  function createDirectoryForTest(dirPath: string): void {
    directories.add(dirPath);
  }

  function createFileForTest(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  describe('convertFileType', () => {
    it('contentファイルをsettingに変更する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: absoluteFilePath,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を実行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.oldType).toBe('content');
      expect(result.newType).toBe('setting');
      expect(result.message.includes('contentからsettingに変更しました')).toBeTruthy();

      // meta.yamlが更新されたことを確認
      const updatedMetaYaml = await mockMetaYamlService.loadMetaYamlAsync(testDir);
      expect(updatedMetaYaml).toBeTruthy();
      const updatedFile = updatedMetaYaml?.files.find((file) => file.name === fileName);
      expect(updatedFile?.type).toBe('setting');
    });

    it('settingファイルをcontentに変更する', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, '# Character Info');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: absoluteFilePath,
            hash: 'hash456',
            tags: [],
            comments: '.character.md.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を実行
      const result = await service.convertFileType(absoluteFilePath, 'content');

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.oldType).toBe('setting');
      expect(result.newType).toBe('content');
      expect(result.message.includes('settingからcontentに変更しました')).toBeTruthy();

      // meta.yamlが更新されたことを確認
      const updatedMetaYaml = await mockMetaYamlService.loadMetaYamlAsync(testDir);
      expect(updatedMetaYaml).toBeTruthy();
      const updatedFile = updatedMetaYaml?.files.find((file) => file.name === fileName);
      expect(updatedFile?.type).toBe('content');
    });

    it('既に同じ種別の場合は何もしない', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: absoluteFilePath,
            hash: 'hash123',
            tags: [],
            references: [],
            comments: '.chapter1.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 同じ種別に変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'content');

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.oldType).toBe('content');
      expect(result.newType).toBe('content');
      expect(result.message.includes('既にcontent種別です')).toBeTruthy();
    });

    it('存在しないファイルの場合はエラーを返す', async () => {
      const absoluteFilePath = '/test/project/nonexistent.txt';

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message.includes('ファイルが存在しません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('meta.yamlが存在しない場合はエラーを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // ファイルのみ作成（meta.yamlなし）
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message.includes('管理対象として登録されていません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('meta.yamlに登録されていないファイルの場合はエラーを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Unregistered content');

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // 別のファイルだけが登録されたmeta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: 'other.txt',
            type: 'content' as const,
            path: `${testDir}/other.txt`,
            hash: 'hash456',
            tags: [],
            references: [],
            comments: '.other.txt.comments.yaml',
            isUntracked: false,
            isMissing: false,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を試行
      const result = await service.convertFileType(absoluteFilePath, 'setting');

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message.includes('管理対象として登録されていません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('サブディレクトリの種別変更は拒否される', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createDirectoryForTest(absoluteDirPath);

      // dialogoi.yamlを作成（プロジェクトルート検出のため）
      const dialogoiYamlPath = `${testDir}/dialogoi.yaml`;
      const dialogoiYamlContent = yaml.dump({
        title: 'テストプロジェクト',
        author: 'テスト著者',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
      });
      createFileForTest(dialogoiYamlPath, dialogoiYamlContent);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, yaml.dump(metaYaml));

      // 種別変更を試行
      const result = await service.convertFileType(absoluteDirPath, 'setting');

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message.includes('ディレクトリの種別は変更できません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });
  });

  describe('getCurrentFileType', () => {
    it('contentファイルの種別を正しく取得する', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      expect(type).toBe('content');
    });

    it('settingファイルの種別を正しく取得する', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, '# Character Info');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      expect(type).toBe('setting');
    });

    it('meta.yamlが存在しない場合はnullを返す', async () => {
      const absoluteFilePath = '/test/project/chapter1.txt';

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      expect(type).toBe(null);
    });

    it('ファイルが登録されていない場合はnullを返す', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);

      // 空のmeta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteFilePath);

      // 結果を検証
      expect(type).toBe(null);
    });

    it('サブディレクトリの場合はnullを返す', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 種別を取得
      const type = await service.getCurrentFileType(absoluteDirPath);

      // 結果を検証
      expect(type).toBe(null);
    });
  });

  describe('isFileTypeConvertible', () => {
    it('contentファイルは変更可能', async () => {
      const testDir = '/test/project';
      const fileName = 'chapter1.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Chapter 1 content');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'content' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      expect(convertible).toBe(true);
    });

    it('settingファイルは変更可能', async () => {
      const testDir = '/test/project';
      const fileName = 'character.md';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, '# Character Info');

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: fileName,
            type: 'setting' as const,
            path: fileName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      expect(convertible).toBe(true);
    });

    it('存在しないファイルは変更不可', async () => {
      const absoluteFilePath = '/test/project/nonexistent.txt';

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      expect(convertible).toBe(false);
    });

    it('サブディレクトリは変更不可', async () => {
      const testDir = '/test/project';
      const dirName = 'subdirectory';
      const absoluteDirPath = `${testDir}/${dirName}`;

      // テスト環境を準備
      createDirectoryForTest(testDir);
      createDirectoryForTest(absoluteDirPath);

      // meta.yamlを作成
      const metaYaml = {
        readme: 'README.md',
        files: [
          {
            name: dirName,
            type: 'subdirectory' as const,
            path: dirName,
          },
        ],
      };

      const metaYamlPath = `${testDir}/.dialogoi-meta.yaml`;
      createFileForTest(metaYamlPath, JSON.stringify(metaYaml));

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteDirPath);

      // 結果を検証
      expect(convertible).toBe(false);
    });

    it('管理対象外ファイルは変更不可', async () => {
      const testDir = '/test/project';
      const fileName = 'unregistered.txt';
      const absoluteFilePath = `${testDir}/${fileName}`;

      // ファイルのみ作成（meta.yamlなし）
      createDirectoryForTest(testDir);
      createFileForTest(absoluteFilePath, 'Unregistered content');

      // 変更可能性を確認
      const convertible = await service.isFileTypeConvertible(absoluteFilePath);

      // 結果を検証
      expect(convertible).toBe(false);
    });
  });
});
