import { mock, MockProxy } from 'jest-mock-extended';
import { ProjectSetupService } from './ProjectSetupService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';
import { Uri } from '../interfaces/Uri.js';

describe('ProjectSetupService テストスイート', () => {
  let projectSetupService: ProjectSetupService;
  let mockFileRepository: MockProxy<FileRepository>;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let mockProjectAutoSetupService: MockProxy<ProjectAutoSetupService>;
  let fileSystem: Map<string, string>;
  let directories: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystem = new Map<string, string>();
    directories = new Set<string>();
    
    // jest-mock-extendedでモック作成
    mockFileRepository = mock<FileRepository>();
    mockDialogoiYamlService = mock<DialogoiYamlService>();
    mockProjectAutoSetupService = mock<ProjectAutoSetupService>();
    
    // ファイルシステムモックの設定
    setupFileSystemMocks();
    
    // DialogoiYamlServiceのモック設定
    mockDialogoiYamlService.createDialogoiProjectAsync.mockImplementation(async (projectRoot: string, title: string, author: string, _tags?: string[]) => {
      // 不正なパラメータチェック
      if (!projectRoot || !title || !author) {
        return false;
      }
      // 既存プロジェクトチェック
      if (fileSystem.has(`${projectRoot}/dialogoi.yaml`)) {
        return false;
      }
      // dialogoi.yamlの作成をシミュレート
      const dialogoiYaml = `title: "${title}"\nauthor: "${author}"\ncreated_at: "2024-01-01T00:00:00Z"\n`;
      fileSystem.set(`${projectRoot}/dialogoi.yaml`, dialogoiYaml);
      return true;
    });
    
    mockDialogoiYamlService.isDialogoiProjectRootAsync.mockImplementation(async (projectRoot: string) => {
      return fileSystem.has(`${projectRoot}/dialogoi.yaml`);
    });
    
    // ProjectAutoSetupServiceのモック設定
    mockProjectAutoSetupService.setupProjectStructure.mockImplementation(async (projectRoot: string, options?: any) => {
      // オプションに応じてディレクトリとファイルの作成をシミュレート
      let processedDirectories = 0;
      let createdFiles = 0;
      
      const createReadme = options?.createReadme !== false;
      const createMetaYaml = options?.createMetaYaml !== false;
      const readmeTemplate = options?.readmeTemplate || 'minimal';
      
      // ルートディレクトリ処理
      if (createMetaYaml) {
        fileSystem.set(`${projectRoot}/.dialogoi-meta.yaml`, 'readme: README.md\nfiles: []\n');
        createdFiles++;
      }
      if (createReadme) {
        let readmeContent = '# Test Project\n';
        if (readmeTemplate === 'detailed') {
          readmeContent = '# Test Project\n\n## 概要\n\n## ファイル一覧\n\n## 関連情報\n';
        }
        fileSystem.set(`${projectRoot}/README.md`, readmeContent);
        createdFiles++;
      }
      processedDirectories++;
      
      // ディレクトリ構造作成（createDirectoryStructureがtrueの場合のみ）
      if (options?.createDirectoryStructure === true) {
        const dirs = ['contents', 'settings'];
        for (const dir of dirs) {
          directories.add(`${projectRoot}/${dir}`);
          if (createMetaYaml) {
            fileSystem.set(`${projectRoot}/${dir}/.dialogoi-meta.yaml`, 'readme: README.md\nfiles: []\n');
            createdFiles++;
          }
          if (createReadme) {
            fileSystem.set(`${projectRoot}/${dir}/README.md`, `# ${dir.charAt(0).toUpperCase() + dir.slice(1)}\n`);
            createdFiles++;
          }
          processedDirectories++;
        }
      }
      
      return {
        success: true,
        message: 'Project structure created',
        processedDirectories,
        createdFiles,
        errors: []
      };
    });
    
    mockProjectAutoSetupService.registerAllFiles.mockImplementation(async (projectRoot: string) => {
      // 既存ファイルの登録をシミュレート
      let registeredFiles = 0;
      let skippedFiles = 0;
      
      // 全ファイルと全ディレクトリの数をカウント
      const allEntries = [...fileSystem.keys()].filter(path => path.startsWith(projectRoot));
      
      for (const filePath of allEntries) {
        // ディレクトリはスキップ
        if (directories.has(filePath)) {
          continue;
        }
        
        const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
        if (fileName === '.dialogoi-meta.yaml' || fileName === 'README.md' || fileName === 'dialogoi.yaml') {
          skippedFiles++;
        } else {
          registeredFiles++;
        }
      }
      
      return {
        success: true,
        message: 'Files registered',
        registeredFiles,
        skippedFiles,
        errors: []
      };
    });
    
    projectSetupService = new ProjectSetupService(mockDialogoiYamlService, mockProjectAutoSetupService);
  });
  
  function setupFileSystemMocks(): void {
    mockFileRepository.createFileUri.mockImplementation((filePath: string) => {
      return { path: filePath, fsPath: filePath } as Uri;
    });
    
    mockFileRepository.createDirectoryUri.mockImplementation((dirPath: string) => {
      return { path: dirPath, fsPath: dirPath } as Uri;
    });
    
    mockFileRepository.existsAsync.mockImplementation(async (uri: Uri) => {
      return fileSystem.has(uri.path) || directories.has(uri.path);
    });
    
    mockFileRepository.createDirectoryAsync.mockImplementation(async (uri: Uri) => {
      directories.add(uri.path);
    });
    
    mockFileRepository.writeFileAsync.mockImplementation(async (uri: Uri, content: string) => {
      fileSystem.set(uri.path, content);
    });
    
    (mockFileRepository.readFileAsync as jest.MockedFunction<typeof mockFileRepository.readFileAsync>).mockImplementation(
      async (uri: Uri, _encoding?: BufferEncoding) => {
        const content = fileSystem.get(uri.path);
        if (!content) {
          throw new Error(`File not found: ${uri.path}`);
        }
        return content;
      }
    );
  }

  describe('createDialogoiProjectWithSetup', () => {
    it('新規プロジェクトを完全セットアップで作成する', async () => {
      const projectRoot = '/test/new-project';

      // テスト環境を準備（空のディレクトリ）
      directories.add(projectRoot);
      directories.add(`${projectRoot}/contents`);
      directories.add(`${projectRoot}/settings`);

      // 既存ファイルを作成
      fileSystem.set(`${projectRoot}/chapter1.txt`, 'Chapter 1 content');
      fileSystem.set(`${projectRoot}/settings/character.md`, '# Characters');

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'Test Novel',
        'Test Author',
        ['fantasy', 'adventure'],
      );

      expect(result.success).toBe(true);
      expect(result.projectRootPath).toBe(projectRoot);
      expect(result.processedDirectories).toBe(3); // root + contents + settings
      expect(result.createdFiles).toBe(6); // 各ディレクトリに.dialogoi-meta.yaml + README.md
      expect(result.registeredFiles).toBe(2); // chapter1.txt + character.md (READMEは除外)
      expect(result.skippedFiles).toBe(7); // dialogoi.yaml + .dialogoi-meta.yaml(3つ) + README.md(3つ)

      // dialogoi.yamlが作成されていることを確認
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      expect(await mockFileRepository.existsAsync(dialogoiYamlUri)).toBe(true);

      // .dialogoi-meta.yamlが作成されていることを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(true);

      // README.mdが作成されていることを確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      expect(await mockFileRepository.existsAsync(readmeUri)).toBe(true);
    });

    it('ディレクトリ構造セットアップなしでプロジェクトを作成する', async () => {
      const projectRoot = '/test/minimal-project';

      // テスト環境を準備
      directories.add(projectRoot);
      fileSystem.set(`${projectRoot}/story.txt`, 'Story content');

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'Minimal Novel',
        'Test Author',
        undefined,
        { createDirectoryStructure: false, autoRegisterFiles: false },
      );

      expect(result.success).toBe(true);
      expect(result.processedDirectories).toBe(0); // セットアップしない
      expect(result.createdFiles).toBe(0); // セットアップしない
      expect(result.registeredFiles).toBe(0); // 自動登録しない
      expect(result.skippedFiles).toBe(0); // 自動登録しない

      // dialogoi.yamlは作成される
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      expect(await mockFileRepository.existsAsync(dialogoiYamlUri)).toBe(true);

      // .dialogoi-meta.yamlは作成されない（ProjectAutoSetupServiceが呼ばれないため）
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(false);
    });

    it('ディレクトリ構造セットアップなしで自動ファイル登録を有効にするとエラーになる', async () => {
      const projectRoot = '/test/incompatible-options-project';

      // テスト環境を準備
      directories.add(projectRoot);
      fileSystem.set(`${projectRoot}/story.txt`, 'Story content');

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'Incompatible Options Novel',
        'Test Author',
        undefined,
        { createDirectoryStructure: false, autoRegisterFiles: true },
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('ディレクトリ構造セットアップが必要です')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('ファイル自動登録なしでプロジェクトを作成する', async () => {
      const projectRoot = '/test/no-auto-register-project';

      // テスト環境を準備
      directories.add(projectRoot);
      fileSystem.set(`${projectRoot}/story.txt`, 'Story content');

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'No Auto Register Novel',
        'Test Author',
        undefined,
        { autoRegisterFiles: false },
      );

      expect(result.success).toBe(true);
      expect(result.processedDirectories).toBe(1); // rootディレクトリのみ
      expect(result.createdFiles).toBe(2); // .dialogoi-meta.yaml + README.md
      expect(result.registeredFiles).toBe(0); // 自動登録しない
      expect(result.skippedFiles).toBe(0); // 自動登録しない

      // dialogoi.yamlは作成される
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      expect(await mockFileRepository.existsAsync(dialogoiYamlUri)).toBe(true);

      // .dialogoi-meta.yamlは作成される（空の状態）
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(true);
    });

    it('既存プロジェクトがある場合はエラーを返す', async () => {
      const projectRoot = '/test/existing-project';

      // 既存のdialogoi.yamlを作成
      directories.add(projectRoot);
      const dialogoiContent = `
title: Existing Project
author: Existing Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      fileSystem.set(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'New Novel',
        'Test Author',
      );

      expect(result.success).toBe(false);
      expect(result.message.includes('dialogoi.yamlファイルの作成に失敗しました')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('詳細テンプレートでREADMEを作成する', async () => {
      const projectRoot = '/test/detailed-template-project';

      // テスト環境を準備
      directories.add(projectRoot);

      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        'Detailed Novel',
        'Test Author',
        undefined,
        { readmeTemplate: 'detailed' },
      );

      expect(result.success).toBe(true);

      // README.mdの内容を確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      expect(readmeContent.includes('## 概要')).toBeTruthy();
      expect(readmeContent.includes('## ファイル一覧')).toBeTruthy();
      expect(readmeContent.includes('## 関連情報')).toBeTruthy();
    });
  });

  describe('setupExistingProject', () => {
    it('既存プロジェクトのセットアップを実行する', async () => {
      const projectRoot = '/test/existing-setup-project';

      // 既存のDialogoiプロジェクトを作成
      directories.add(projectRoot);
      directories.add(`${projectRoot}/chapters`);

      const dialogoiContent = `
title: Existing Project
author: Existing Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
project_settings:
  exclude_patterns:
    - ".*"
    - "*.tmp"
`;
      fileSystem.set(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存ファイルを作成
      fileSystem.set(`${projectRoot}/intro.txt`, 'Introduction');
      fileSystem.set(`${projectRoot}/chapters/ch1.txt`, 'Chapter 1');

      const result = await projectSetupService.setupExistingProject(projectRoot);

      expect(result.success).toBe(true);
      expect(result.projectRootPath).toBe(projectRoot);
      expect(result.processedDirectories).toBe(2); // root + chapters
      expect(result.createdFiles).toBe(4); // 各ディレクトリに.dialogoi-meta.yaml + README.md
      expect(result.registeredFiles).toBe(2); // intro.txt + ch1.txt (READMEは除外)
      expect(result.skippedFiles).toBe(5); // dialogoi.yaml + .dialogoi-meta.yaml(2つ) + README.md(2つ)

      // セットアップ後のファイルが存在することを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(true);

      const chaptersMetaYamlUri = mockFileRepository.createFileUri(
        `${projectRoot}/chapters/.dialogoi-meta.yaml`,
      );
      expect(await mockFileRepository.existsAsync(chaptersMetaYamlUri)).toBe(true);
    });

    it('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-project';

      // 通常のディレクトリを作成（dialogoi.yamlなし）
      directories.add(projectRoot);
      fileSystem.set(`${projectRoot}/file.txt`, 'content');

      const result = await projectSetupService.setupExistingProject(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('ディレクトリ構造セットアップのみを実行する', async () => {
      const projectRoot = '/test/structure-only-project';

      // 既存のDialogoiプロジェクトを作成
      directories.add(projectRoot);
      const dialogoiContent = `
title: Structure Only Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      fileSystem.set(`${projectRoot}/dialogoi.yaml`, dialogoiContent);
      fileSystem.set(`${projectRoot}/content.txt`, 'Content');

      const result = await projectSetupService.setupExistingProject(projectRoot, {
        autoRegisterFiles: false,
      });

      expect(result.success).toBe(true);
      expect(result.processedDirectories).toBe(1); // rootのみ
      expect(result.createdFiles).toBe(2); // .dialogoi-meta.yaml + README.md
      expect(result.registeredFiles).toBe(0); // 自動登録しない
      expect(result.skippedFiles).toBe(0); // 自動登録しない

      // .dialogoi-meta.yamlは作成される
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      expect(await mockFileRepository.existsAsync(metaYamlUri)).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    it('不正なパラメータでプロジェクト作成を試行するとエラーになる', async () => {
      const projectRoot = '/test/error-test-directory';

      // 空のタイトルでバリデーションエラーを誘発
      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        '', // 空のタイトルでエラーを誘発
        'Test Author',
      );

      // エラーが適切に処理されることを確認
      expect(result.success).toBe(false);
      expect(result.message.includes('dialogoi.yamlファイルの作成に失敗しました')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });
  });
});
