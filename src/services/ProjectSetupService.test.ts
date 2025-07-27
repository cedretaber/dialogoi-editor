import * as assert from 'assert';
import { ProjectSetupService } from './ProjectSetupService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';

suite('ProjectSetupService テストスイート', () => {
  let projectSetupService: ProjectSetupService;
  let mockFileRepository: MockFileRepository;
  let dialogoiYamlService: DialogoiYamlService;
  let projectAutoSetupService: ProjectAutoSetupService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getMockFileRepository();
    dialogoiYamlService = container.getDialogoiYamlService();
    projectAutoSetupService = container.getProjectAutoSetupService();
    projectSetupService = new ProjectSetupService(dialogoiYamlService, projectAutoSetupService);
  });

  suite('createDialogoiProjectWithSetup', () => {
    test('新規プロジェクトを完全セットアップで作成する', async () => {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectRootPath, projectRoot);
      assert.strictEqual(result.processedDirectories, 3); // root + contents + settings
      assert.strictEqual(result.createdFiles, 6); // 各ディレクトリに.dialogoi-meta.yaml + README.md
      assert.strictEqual(result.registeredFiles, 5); // chapter1.txt + character.md + README.md(3つ)
      assert.strictEqual(result.skippedFiles, 4); // dialogoi.yaml + .dialogoi-meta.yaml(3つ)

      // dialogoi.yamlが作成されていることを確認
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(dialogoiYamlUri), true);

      // .dialogoi-meta.yamlが作成されていることを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), true);

      // README.mdが作成されていることを確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      assert.strictEqual(await mockFileRepository.existsAsync(readmeUri), true);
    });

    test('ディレクトリ構造セットアップなしでプロジェクトを作成する', async () => {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.processedDirectories, 0); // セットアップしない
      assert.strictEqual(result.createdFiles, 0); // セットアップしない
      assert.strictEqual(result.registeredFiles, 0); // 自動登録しない
      assert.strictEqual(result.skippedFiles, 0); // 自動登録しない

      // dialogoi.yamlは作成される
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(dialogoiYamlUri), true);

      // .dialogoi-meta.yamlは作成されない（ProjectAutoSetupServiceが呼ばれないため）
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), false);
    });

    test('ディレクトリ構造セットアップなしで自動ファイル登録を有効にするとエラーになる', async () => {
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

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('ディレクトリ構造セットアップが必要です'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('ファイル自動登録なしでプロジェクトを作成する', async () => {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.processedDirectories, 1); // rootディレクトリのみ
      assert.strictEqual(result.createdFiles, 2); // .dialogoi-meta.yaml + README.md
      assert.strictEqual(result.registeredFiles, 0); // 自動登録しない
      assert.strictEqual(result.skippedFiles, 0); // 自動登録しない

      // dialogoi.yamlは作成される
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectRoot}/dialogoi.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(dialogoiYamlUri), true);

      // .dialogoi-meta.yamlは作成される（空の状態）
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), true);
    });

    test('既存プロジェクトがある場合はエラーを返す', async () => {
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

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('dialogoi.yamlファイルの作成に失敗しました'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('詳細テンプレートでREADMEを作成する', async () => {
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

      assert.strictEqual(result.success, true);

      // README.mdの内容を確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      assert.ok(readmeContent.includes('## 概要'));
      assert.ok(readmeContent.includes('## ファイル一覧'));
      assert.ok(readmeContent.includes('## 関連情報'));
    });
  });

  suite('setupExistingProject', () => {
    test('既存プロジェクトのセットアップを実行する', async () => {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectRootPath, projectRoot);
      assert.strictEqual(result.processedDirectories, 2); // root + chapters
      assert.strictEqual(result.createdFiles, 4); // 各ディレクトリに.dialogoi-meta.yaml + README.md
      assert.strictEqual(result.registeredFiles, 4); // intro.txt + ch1.txt + README.md(2つ)
      assert.strictEqual(result.skippedFiles, 3); // dialogoi.yaml + .dialogoi-meta.yaml(2つ)

      // セットアップ後のファイルが存在することを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), true);

      const chaptersMetaYamlUri = mockFileRepository.createFileUri(
        `${projectRoot}/chapters/.dialogoi-meta.yaml`,
      );
      assert.strictEqual(await mockFileRepository.existsAsync(chaptersMetaYamlUri), true);
    });

    test('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-project';

      // 通常のディレクトリを作成（dialogoi.yamlなし）
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createFileForTest(`${projectRoot}/file.txt`, 'content');

      const result = await projectSetupService.setupExistingProject(projectRoot);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Dialogoiプロジェクトではありません'));
      assert.ok(result.errors && result.errors.length > 0);
    });

    test('ディレクトリ構造セットアップのみを実行する', async () => {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.processedDirectories, 1); // rootのみ
      assert.strictEqual(result.createdFiles, 2); // .dialogoi-meta.yaml + README.md
      assert.strictEqual(result.registeredFiles, 0); // 自動登録しない
      assert.strictEqual(result.skippedFiles, 0); // 自動登録しない

      // .dialogoi-meta.yamlは作成される
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), true);
    });
  });

  suite('エラーハンドリング', () => {
    test('不正なパラメータでプロジェクト作成を試行するとエラーになる', async () => {
      const projectRoot = '/test/error-test-directory';

      // 空のタイトルでバリデーションエラーを誘発
      const result = await projectSetupService.createDialogoiProjectWithSetup(
        projectRoot,
        '', // 空のタイトルでエラーを誘発
        'Test Author',
      );

      // エラーが適切に処理されることを確認
      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('dialogoi.yamlファイルの作成に失敗しました'));
      assert.ok(result.errors && result.errors.length > 0);
    });
  });
});
