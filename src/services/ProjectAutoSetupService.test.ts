import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { Uri } from '../interfaces/Uri.js';
import { MetaYaml } from '../utils/MetaYamlUtils.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';
import * as yaml from 'js-yaml';
import * as path from 'path';

describe('ProjectAutoSetupService テストスイート', () => {
  let projectAutoSetupService: ProjectAutoSetupService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem = new Map<string, string>();
    directories = new Set<string>();

    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockMetaYamlService = mock<MetaYamlService>();
    mockDialogoiYamlService = mock<DialogoiYamlService>();

    // ファイルシステムモックの設定
    setupFileSystemMocks();

    projectAutoSetupService = new ProjectAutoSetupService(
      mockFileRepository,
      mockMetaYamlService,
      mockDialogoiYamlService,
    );
  });

  function setupFileSystemMocks(): void {
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });

    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath, fsPath: dirPath } as Uri;
    });

    mockFileRepository.existsAsync.mockImplementation((uri: Uri) => {
      return Promise.resolve(fileSystem.has(uri.path) || directories.has(uri.path));
    });

    mockFileRepository.createDirectoryAsync.mockImplementation((uri: Uri) => {
      directories.add(uri.path);
      return Promise.resolve();
    });

    mockFileRepository.writeFileAsync.mockImplementation((uri: Uri, content: string) => {
      fileSystem.set(uri.path, content);
      return Promise.resolve();
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

    mockFileRepository.readdirAsync.mockImplementation((uri: Uri) => {
      const dirPath = uri.path;
      const items: Array<{ name: string; isFile: () => boolean; isDirectory: () => boolean }> = [];

      // ファイルを検索
      for (const filePath of fileSystem.keys()) {
        if (path.dirname(filePath) === dirPath) {
          const name = path.basename(filePath);
          items.push({
            name,
            isFile: () => true,
            isDirectory: () => false,
          });
        }
      }

      // ディレクトリを検索（直接の子ディレクトリのみ）
      for (const directoryPath of directories) {
        if (path.dirname(directoryPath) === dirPath) {
          const name = path.basename(directoryPath);
          items.push({
            name,
            isFile: () => false,
            isDirectory: () => true,
          });
        }
      }

      return Promise.resolve(items);
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

    // DialogoiYamlService のモック
    mockDialogoiYamlService.isDialogoiProjectRootAsync.mockImplementation((projectRoot: string) => {
      return Promise.resolve(fileSystem.has(path.join(projectRoot, 'dialogoi.yaml')));
    });

    mockDialogoiYamlService.loadDialogoiYamlAsync.mockImplementation((projectRoot: string) => {
      const yamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const content = fileSystem.get(yamlPath);
      if (content === undefined) {
        return Promise.resolve(null);
      }
      try {
        return Promise.resolve(yaml.load(content) as DialogoiYaml);
      } catch {
        return Promise.resolve(null);
      }
    });

    mockDialogoiYamlService.getExcludePatternsAsync.mockImplementation(
      async (projectRoot: string) => {
        const dialogoiData = await mockDialogoiYamlService.loadDialogoiYamlAsync(projectRoot);
        if (dialogoiData?.project_settings?.exclude_patterns) {
          return dialogoiData.project_settings.exclude_patterns;
        }
        return ['.*', '*.tmp', 'node_modules', '.git'];
      },
    );
  }

  function createDirectoryForTest(dirPath: string): void {
    directories.add(dirPath);
  }

  function createFileForTest(filePath: string, content: string): void {
    fileSystem.set(filePath, content);
  }

  describe('setupProjectStructure', () => {
    it('基本的なプロジェクト構造をセットアップできる', async () => {
      const projectRoot = '/test/project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);
      createDirectoryForTest(`${projectRoot}/contents`);
      createDirectoryForTest(`${projectRoot}/settings`);

      // dialogoi.yamlを作成（Dialogoiプロジェクトとして認識させるため）
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
project_settings:
  exclude_patterns:
    - ".*"
    - "*.tmp"
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      expect(result.success).toBe(true);
      expect(result.processedDirectories).toBe(3); // プロジェクトルート + 2つのサブディレクトリ
      expect(result.createdFiles).toBe(6); // 各ディレクトリに.dialogoi-meta.yaml + README.md

      // .dialogoi-meta.yamlが作成されていることを確認
      const metaYamlPath = `${projectRoot}/.dialogoi-meta.yaml`;
      const metaYamlUri = mockFileRepository.createFileUri(metaYamlPath);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(true);

      // README.mdが作成されていることを確認
      const readmePath = `${projectRoot}/README.md`;
      const readmeUri = mockFileRepository.createFileUri(readmePath);
      expect(await mockFileRepository.existsAsync(readmeUri)).toBe(true);
    });

    it('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-project';
      createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.processedDirectories).toBe(0);
      expect(result.createdFiles).toBe(0);
    });

    it('既存ファイルを上書きしないオプションが動作する', async () => {
      const projectRoot = '/test/existing-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存の.dialogoi-meta.yamlを作成
      const existingMetaContent = `readme: README.md
files:
  - name: existing.txt
    type: content
    path: /test/existing-project/existing.txt
    hash: existingHash
    tags: []
    references: []
    comments: '.existing.txt.comments.yaml'
    isUntracked: false
    isMissing: false`;
      createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, existingMetaContent);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot, {
        overwriteExisting: false,
      });

      expect(result.success).toBe(true);

      // 既存のmeta.yamlが変更されていないことを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      const content = await mockFileRepository.readFileAsync(metaYamlUri, 'utf8');
      expect(content.includes('existing.txt')).toBeTruthy();
    });

    it('最小テンプレートと詳細テンプレートが正しく生成される', async () => {
      const projectRoot = '/test/template-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 詳細テンプレートで実行
      const result = await projectAutoSetupService.setupProjectStructure(projectRoot, {
        readmeTemplate: 'detailed',
      });

      expect(result.success).toBe(true);

      // README.mdの内容を確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      expect(readmeContent.includes('## 概要')).toBeTruthy();
      expect(readmeContent.includes('## ファイル一覧')).toBeTruthy();
      expect(readmeContent.includes('## 関連情報')).toBeTruthy();
    });
  });

  describe('registerAllFiles', () => {
    it('全ファイルを正常に登録する', async () => {
      const projectRoot = '/test/register-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);
      createDirectoryForTest(`${projectRoot}/contents`);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
project_settings:
  exclude_patterns:
    - ".*"
    - "*.tmp"
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // .dialogoi-meta.yamlを作成
      const metaContent = `files: []`;
      createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);
      createFileForTest(`${projectRoot}/contents/.dialogoi-meta.yaml`, metaContent);

      // テスト用ファイルを作成
      createFileForTest(`${projectRoot}/chapter1.txt`, 'Chapter 1 content');
      createFileForTest(`${projectRoot}/setting.md`, '# Setting');
      createFileForTest(`${projectRoot}/contents/chapter2.txt`, 'Chapter 2 content');

      // 除外対象ファイルも作成
      createFileForTest(`${projectRoot}/.gitignore`, '# Git ignore');
      createFileForTest(`${projectRoot}/temp.tmp`, 'temporary');
      createFileForTest(`${projectRoot}/README.md`, '# Project README');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(3); // chapter1.txt, setting.md, chapter2.txt (README.mdは除外)
      // skippedFiles: .gitignore, temp.tmp, .dialogoi-meta.yaml(2つ), dialogoi.yaml, README.md = 6ファイル
      expect(result.skippedFiles).toBe(6); // 管理ファイルと除外ファイル

      // meta.yamlが更新されていることを確認
      const updatedMeta = await mockMetaYamlService.loadMetaYamlAsync(projectRoot);
      expect(updatedMeta).not.toBe(null);
      expect(updatedMeta?.files.length).toBe(3); // chapter1.txt, setting.md, subdirectory'contents'

      const chapter1Entry = updatedMeta?.files.find((f) => f.name === 'chapter1.txt');
      expect(chapter1Entry).not.toBe(undefined);
      expect(chapter1Entry?.type).toBe('content');

      const settingEntry = updatedMeta?.files.find((f) => f.name === 'setting.md');
      expect(settingEntry).not.toBe(undefined);
      expect(settingEntry?.type).toBe('setting');
    });

    it('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-register';
      createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.registeredFiles).toBe(0);
      expect(result.skippedFiles).toBe(0);
    });

    it('meta.yamlが存在しないディレクトリは警告してスキップする', async () => {
      const projectRoot = '/test/no-meta-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);
      createDirectoryForTest(`${projectRoot}/nometa`);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // プロジェクトルートにのみmeta.yamlを作成
      const metaContent = `files: []`;
      createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);
      // サブディレクトリにはmeta.yamlを作成しない

      // テスト用ファイルを作成
      createFileForTest(`${projectRoot}/root.txt`, 'Root content');
      createFileForTest(`${projectRoot}/nometa/orphan.txt`, 'Orphan content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(1); // root.txtのみ登録される

      // プロジェクトルートのmeta.yamlが更新されていることを確認
      const updatedMeta = await mockMetaYamlService.loadMetaYamlAsync(projectRoot);
      expect(updatedMeta?.files.length).toBe(2); // root.txt と nometa subdirectory
      // root.txtとnometaが登録されていることを確認
      const rootTxtEntry = updatedMeta?.files.find((f) => f.name === 'root.txt');
      expect(rootTxtEntry).not.toBe(undefined);
      expect(rootTxtEntry?.type).toBe('content');

      const nometaDirEntry = updatedMeta?.files.find((f) => f.name === 'nometa');
      expect(nometaDirEntry).not.toBe(undefined);
      expect(nometaDirEntry?.type).toBe('subdirectory');
    });

    it('既に管理対象のファイルはスキップされる', async () => {
      const projectRoot = '/test/existing-files-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存のmeta.yamlを作成（一部ファイルが既に登録済み）
      const metaContent = `readme: README.md
files:
  - name: existing.txt
    type: content
    path: /test/existing-files-project/existing.txt
    hash: existingHash
    tags: []
    references: []
    comments: '.existing.txt.comments.yaml'
    isUntracked: false
    isMissing: false`;
      createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);

      // テスト用ファイルを作成
      createFileForTest(`${projectRoot}/existing.txt`, 'Existing content');
      createFileForTest(`${projectRoot}/new.txt`, 'New content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(1); // new.txtのみ登録
      expect(result.skippedFiles).toBe(3); // existing.txt + dialogoi.yaml + .dialogoi-meta.yaml

      // meta.yamlが更新されていることを確認
      const updatedMeta = await mockMetaYamlService.loadMetaYamlAsync(projectRoot);
      expect(updatedMeta?.files.length).toBe(2); // existing.txt + new.txt
    });

    it('READMEファイルが存在しない場合は自動作成される', async () => {
      const projectRoot = '/test/readme-creation-project';

      // テスト環境を準備
      createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // .dialogoi-meta.yamlを作成
      const metaContent = `files: []`;
      createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);

      // READMEファイルは作成しない（test.txtのみ作成）
      createFileForTest(`${projectRoot}/test.txt`, 'Test content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot, {
        createReadmeIfMissing: true,
      });

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(1); // test.txtのみ（README.mdは作成されるが除外される）
      // skippedFiles: dialogoi.yaml + .dialogoi-meta.yaml + README.md = 3ファイル
      expect(result.skippedFiles).toBe(3);

      // README.mdが自動作成されていることを確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      expect(await mockFileRepository.existsAsync(readmeUri)).toBe(true);

      // README.mdの内容を確認
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      expect(readmeContent.includes('readme-creation-project')).toBeTruthy();
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しないディレクトリでsetupProjectStructureを実行するとエラーを返す', async () => {
      const projectRoot = '/test/nonexistent';

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.processedDirectories).toBe(0);
      expect(result.createdFiles).toBe(0);
    });

    it('存在しないディレクトリでregisterAllFilesを実行するとエラーを返す', async () => {
      const projectRoot = '/test/nonexistent';

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.registeredFiles).toBe(0);
      expect(result.skippedFiles).toBe(0);
    });
  });
});
