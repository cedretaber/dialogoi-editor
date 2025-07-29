import { ProjectSetupService } from './ProjectSetupService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';

describe('ProjectSetupService テストスイート', () => {
  let projectSetupService: ProjectSetupService;
  let mockFileRepository: MockFileRepository;
  let dialogoiYamlService: DialogoiYamlService;
  let projectAutoSetupService: ProjectAutoSetupService;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    dialogoiYamlService = container.getDialogoiYamlService();
    projectAutoSetupService = container.getProjectAutoSetupService();
    projectSetupService = new ProjectSetupService(dialogoiYamlService, projectAutoSetupService);
  });

  describe('createDialogoiProjectWithSetup', () => {
    it('新規プロジェクトを完全セットアップで作成する', async () => {
      const projectRoot = '/test/new-project';

      // テスト環境を準備（空のディレクトリ）
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/contents`);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/settings`);

      // 既存ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/chapter1.txt`, 'Chapter 1 content');
      mockFileRepository.createFileForTest(`${projectRoot}/settings/character.md`, '# Characters');

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createFileForTest(`${projectRoot}/story.txt`, 'Story content');

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createFileForTest(`${projectRoot}/story.txt`, 'Story content');

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createFileForTest(`${projectRoot}/story.txt`, 'Story content');

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      const dialogoiContent = `
title: Existing Project
author: Existing Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

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
      mockFileRepository.createDirectoryForTest(projectRoot);

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/chapters`);

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
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/intro.txt`, 'Introduction');
      mockFileRepository.createFileForTest(`${projectRoot}/chapters/ch1.txt`, 'Chapter 1');

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
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createFileForTest(`${projectRoot}/file.txt`, 'content');

      const result = await projectSetupService.setupExistingProject(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.errors && result.errors.length > 0).toBeTruthy();
    });

    it('ディレクトリ構造セットアップのみを実行する', async () => {
      const projectRoot = '/test/structure-only-project';

      // 既存のDialogoiプロジェクトを作成
      mockFileRepository.createDirectoryForTest(projectRoot);
      const dialogoiContent = `
title: Structure Only Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);
      mockFileRepository.createFileForTest(`${projectRoot}/content.txt`, 'Content');

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
