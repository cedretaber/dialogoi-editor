import { suite, test } from 'mocha';
import * as assert from 'assert';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import {
  ProjectCreationService,
  ProjectCreationOptions,
} from '../services/ProjectCreationService.js';

suite('ProjectCommands テストスイート', () => {
  let mockFileRepository: MockFileRepository;
  let projectCreationService: ProjectCreationService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    const dialogoiYamlService = container.getDialogoiYamlService();
    const templateService = container.getDialogoiTemplateService();
    projectCreationService = new ProjectCreationService(
      mockFileRepository,
      dialogoiYamlService,
      templateService,
    );
  });

  suite('プロジェクト作成機能', () => {
    test('新規プロジェクトを正常に作成できる', async () => {
      // Arrange
      const projectPath = '/test/new-novel';
      const options: ProjectCreationOptions = {
        title: 'テスト小説',
        author: 'テスト著者',
        tags: ['ファンタジー', '冒険'],
      };

      // テンプレートファイルを準備
      mockFileRepository.setExtensionResource(
        'templates/default-dialogoi.yaml',
        `title: "デフォルト小説"
author: "著者名"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const result = await projectCreationService.createProject(projectPath, options);

      // Assert
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message.includes('作成しました'), true);
      assert.strictEqual(result.projectPath, projectPath);

      // dialogoi.yamlが作成されているかチェック
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectPath}/dialogoi.yaml`);
      assert.strictEqual(mockFileRepository.existsSync(dialogoiYamlUri), true);

      // 作成されたファイルの内容をチェック
      const content = mockFileRepository.readFileSync(dialogoiYamlUri);
      assert.strictEqual(content.includes('テスト小説'), true);
      assert.strictEqual(content.includes('テスト著者'), true);
      assert.strictEqual(content.includes('ファンタジー'), true);
    });

    test('既存プロジェクトがある場合は作成を拒否する', async () => {
      // Arrange
      const projectPath = '/test/existing-novel';
      const options: ProjectCreationOptions = {
        title: 'テスト小説',
        author: 'テスト著者',
      };

      // 既存のプロジェクトを準備
      mockFileRepository.createFileForTest(
        `${projectPath}/dialogoi.yaml`,
        `title: "既存の小説"
author: "既存の著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const result = await projectCreationService.createProject(projectPath, options);

      // Assert
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('既に存在'), true);
    });

    test('空のタイトルでプロジェクト作成は失敗する', async () => {
      // Arrange
      const projectPath = '/test/empty-title';
      const options: ProjectCreationOptions = {
        title: '',
        author: 'テスト著者',
      };

      // テンプレートファイルを準備
      mockFileRepository.setExtensionResource(
        'templates/default-dialogoi.yaml',
        `title: "デフォルト小説"
author: "著者名"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const result = await projectCreationService.createProject(projectPath, options);

      // Assert
      // 空のタイトルはバリデーションエラーで失敗する
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.message.includes('dialogoi.yamlの保存に失敗'), true);
    });

    test('上書きオプションが有効な場合は既存プロジェクトを上書きできる', async () => {
      // Arrange
      const projectPath = '/test/overwrite-novel';
      const options: ProjectCreationOptions = {
        title: '新しいテスト小説',
        author: '新しいテスト著者',
        overwriteDialogoiYaml: true,
      };

      // 既存のプロジェクトを準備
      mockFileRepository.createFileForTest(
        `${projectPath}/dialogoi.yaml`,
        `title: "古い小説"
author: "古い著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // テンプレートファイルを準備
      mockFileRepository.setExtensionResource(
        'templates/default-dialogoi.yaml',
        `title: "デフォルト小説"
author: "著者名"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const result = await projectCreationService.createProject(projectPath, options);

      // Assert
      assert.strictEqual(result.success, true);

      // 更新されたファイルの内容をチェック
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectPath}/dialogoi.yaml`);
      const content = mockFileRepository.readFileSync(dialogoiYamlUri);
      assert.strictEqual(content.includes('新しいテスト小説'), true);
      assert.strictEqual(content.includes('新しいテスト著者'), true);
    });

    test('タグなしでプロジェクトを作成できる', async () => {
      // Arrange
      const projectPath = '/test/no-tags-novel';
      const options: ProjectCreationOptions = {
        title: 'タグなし小説',
        author: 'タグなし著者',
      };

      // テンプレートファイルを準備
      mockFileRepository.setExtensionResource(
        'templates/default-dialogoi.yaml',
        `title: "デフォルト小説"
author: "著者名"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const result = await projectCreationService.createProject(projectPath, options);

      // Assert
      assert.strictEqual(result.success, true);

      // dialogoi.yamlが作成されているかチェック
      const dialogoiYamlUri = mockFileRepository.createFileUri(`${projectPath}/dialogoi.yaml`);
      const content = mockFileRepository.readFileSync(dialogoiYamlUri);
      assert.strictEqual(content.includes('タグなし小説'), true);
      assert.strictEqual(content.includes('タグなし著者'), true);
    });
  });

  suite('プロジェクト設定編集機能', () => {
    test('dialogoi.yamlファイルパスを正しく取得できる', () => {
      // Arrange
      const projectPath = '/test/settings-novel';

      // 既存のプロジェクトを準備
      mockFileRepository.createFileForTest(
        `${projectPath}/dialogoi.yaml`,
        `title: "設定テスト小説"
author: "設定テスト著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00.000Z"
updated_at: "2024-01-01T00:00:00.000Z"
`,
      );

      // Act
      const container = TestServiceContainer.create();
      const dialogoiYamlService = container.getDialogoiYamlService();
      const yamlPath = dialogoiYamlService.getDialogoiYamlPath(projectPath);

      // Assert
      assert.strictEqual(yamlPath, `${projectPath}/dialogoi.yaml`);
    });
  });
});
