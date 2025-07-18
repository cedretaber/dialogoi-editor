import { suite, test, beforeEach } from 'mocha';
import * as assert from 'assert';
import { ProjectCreationService, ProjectCreationOptions } from './ProjectCreationService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { DialogoiTemplateService } from './DialogoiTemplateService.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import * as path from 'path';

suite('ProjectCreationService テストスイート', () => {
  let service: ProjectCreationService;
  let mockFileRepository: MockFileRepository;
  let dialogoiYamlService: DialogoiYamlService;
  let templateService: DialogoiTemplateService;

  const testTemplate = `title: "テストテンプレート"
author: "テスト著者"
version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
tags: []

project_settings:
  readme_filename: "README.md"
  exclude_patterns:
    - ".*"
    - ".DS_Store"
    - "node_modules"
    - "*.tmp"`;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    dialogoiYamlService = container.getDialogoiYamlService();
    templateService = container.getDialogoiTemplateService();

    // テスト用テンプレートを設定
    mockFileRepository.setExtensionResource('templates/default-dialogoi.yaml', testTemplate);

    service = new ProjectCreationService(mockFileRepository, dialogoiYamlService, templateService);
  });

  suite('createProject', () => {
    test('新しいプロジェクトを正常に作成する', async () => {
      const projectPath = '/test/project';
      const options: ProjectCreationOptions = {
        title: '新しい小説',
        author: '著者名',
        tags: ['ファンタジー', '冒険'],
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.projectPath, projectPath);
      assert.ok(result.message.includes('正常に作成'));
      assert.ok(
        result.createdFiles !== undefined &&
          result.createdFiles.includes(path.join(projectPath, 'dialogoi.yaml')),
      );
      assert.ok(
        result.createdFiles !== undefined &&
          result.createdFiles.includes(path.join(projectPath, '.dialogoi-meta.yaml')),
      );

      // dialogoi.yamlが作成されているか確認
      const dialogoiYamlPath = path.join(projectPath, 'dialogoi.yaml');
      assert.ok(mockFileRepository.existsSync(mockFileRepository.createFileUri(dialogoiYamlPath)));
    });

    test('既存プロジェクトがある場合は上書きを拒否する', async () => {
      const projectPath = '/test/existing';

      // 既存プロジェクトを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      const dialogoiYamlPath = path.join(projectPath, 'dialogoi.yaml');
      mockFileRepository.createFileForTest(dialogoiYamlPath, testTemplate);

      const options: ProjectCreationOptions = {
        title: '新しい小説',
        author: '著者名',
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('既に存在'));
    });

    test('上書きオプションが有効な場合は既存プロジェクトを上書きする', async () => {
      const projectPath = '/test/overwrite';

      // 既存プロジェクトを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      const dialogoiYamlPath = path.join(projectPath, 'dialogoi.yaml');
      mockFileRepository.createFileForTest(dialogoiYamlPath, testTemplate);

      const options: ProjectCreationOptions = {
        title: '上書きプロジェクト',
        author: '新しい著者',
        overwriteDialogoiYaml: true,
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('正常に作成'));
    });

    test('既存ファイルを含むディレクトリでプロジェクトを作成する', async () => {
      const projectPath = '/test/with-files';

      // 既存ファイルを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      mockFileRepository.createFileForTest(
        path.join(projectPath, 'chapter1.txt'),
        'Chapter 1 content',
      );
      mockFileRepository.createFileForTest(path.join(projectPath, 'settings.md'), '# Settings');
      mockFileRepository.createFileForTest(path.join(projectPath, 'notes.txt'), 'Notes');

      // サブディレクトリも作成
      const charactersDir = path.join(projectPath, 'characters');
      mockFileRepository.createDirectoryForTest(charactersDir);
      mockFileRepository.createFileForTest(
        path.join(charactersDir, 'protagonist.md'),
        '# Protagonist',
      );
      mockFileRepository.createFileForTest(
        path.join(charactersDir, 'antagonist.md'),
        '# Antagonist',
      );

      const options: ProjectCreationOptions = {
        title: 'ファイル付きプロジェクト',
        author: '著者名',
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);

      // .dialogoi-meta.yamlが作成されているか確認
      const metaYamlPath = path.join(projectPath, '.dialogoi-meta.yaml');
      assert.ok(mockFileRepository.existsSync(mockFileRepository.createFileUri(metaYamlPath)));

      // characters/.dialogoi-meta.yamlも作成されているか確認
      const charactersMetaYamlPath = path.join(charactersDir, '.dialogoi-meta.yaml');
      assert.ok(
        mockFileRepository.existsSync(mockFileRepository.createFileUri(charactersMetaYamlPath)),
      );
    });

    test('除外パターンが正しく適用される', async () => {
      const projectPath = '/test/exclude-patterns';

      // 除外されるファイルを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      mockFileRepository.createFileForTest(path.join(projectPath, 'chapter1.txt'), 'Chapter 1');
      mockFileRepository.createFileForTest(path.join(projectPath, '.gitignore'), '# Git ignore');
      mockFileRepository.createFileForTest(path.join(projectPath, 'temp.tmp'), 'Temporary file');
      mockFileRepository.createFileForTest(path.join(projectPath, 'notes.md'), '# Notes');

      const options: ProjectCreationOptions = {
        title: '除外パターンテスト',
        author: '著者名',
        excludePatterns: ['.*', '*.tmp'],
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);

      // .gitignoreとtemp.tmpが除外されているか確認
      assert.ok(
        result.skippedFiles !== undefined &&
          result.skippedFiles.some((file) => file.includes('.gitignore')),
      );
      assert.ok(
        result.skippedFiles !== undefined &&
          result.skippedFiles.some((file) => file.includes('temp.tmp')),
      );
    });

    test('既存.dialogoi-meta.yamlファイルを尊重する', async () => {
      const projectPath = '/test/respect-meta';

      // 既存.dialogoi-meta.yamlを含むディレクトリを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      mockFileRepository.createFileForTest(path.join(projectPath, 'chapter1.txt'), 'Chapter 1');
      const existingMeta = `readme: "README.md"
files:
  - name: chapter1.txt
    type: content
    path: chapter1.txt
    tags: ["重要"]`;
      mockFileRepository.createFileForTest(
        path.join(projectPath, '.dialogoi-meta.yaml'),
        existingMeta,
      );

      const options: ProjectCreationOptions = {
        title: '.dialogoi-meta.yaml尊重テスト',
        author: '著者名',
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);

      // .dialogoi-meta.yamlがスキップされているか確認
      assert.ok(
        result.skippedFiles !== undefined &&
          result.skippedFiles.some((file) => file.includes('.dialogoi-meta.yaml')),
      );
    });

    test('.dialogoi-meta.yaml上書きオプションが有効な場合は既存.dialogoi-meta.yamlを上書きする', async () => {
      const projectPath = '/test/overwrite-meta';

      // 既存.dialogoi-meta.yamlを含むディレクトリを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      mockFileRepository.createFileForTest(path.join(projectPath, 'chapter1.txt'), 'Chapter 1');
      const existingMeta = `readme: "README.md"
files:
  - name: chapter1.txt
    type: content
    path: chapter1.txt
    tags: ["古いタグ"]`;
      mockFileRepository.createFileForTest(
        path.join(projectPath, '.dialogoi-meta.yaml'),
        existingMeta,
      );

      const options: ProjectCreationOptions = {
        title: '.dialogoi-meta.yaml上書きテスト',
        author: '著者名',
        overwriteMetaYaml: true,
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);

      // .dialogoi-meta.yamlが作成されているか確認
      const metaYamlPath = path.join(projectPath, '.dialogoi-meta.yaml');
      assert.ok(result.createdFiles !== undefined && result.createdFiles.includes(metaYamlPath));
    });

    test('ファイル種別の自動判定が正しく動作する', async () => {
      const projectPath = '/test/file-types';

      // 様々な拡張子のファイルを作成
      mockFileRepository.createDirectoryForTest(projectPath);
      mockFileRepository.createFileForTest(path.join(projectPath, 'story.txt'), 'Story content');
      mockFileRepository.createFileForTest(path.join(projectPath, 'setting.md'), '# Setting');
      mockFileRepository.createFileForTest(path.join(projectPath, 'data.json'), '{}');
      mockFileRepository.createFileForTest(path.join(projectPath, 'script.py'), 'print("hello")');

      const options: ProjectCreationOptions = {
        title: 'ファイル種別テスト',
        author: '著者名',
      };

      const result = await service.createProject(projectPath, options);

      assert.strictEqual(result.success, true);

      // .dialogoi-meta.yamlを読み込んで確認
      const metaYamlPath = path.join(projectPath, '.dialogoi-meta.yaml');
      const metaContent = mockFileRepository.readFileSync(
        mockFileRepository.createFileUri(metaYamlPath),
        'utf8',
      );

      assert.ok(metaContent.includes('story.txt'));
      assert.ok(metaContent.includes('type: content'));
      assert.ok(metaContent.includes('setting.md'));
      assert.ok(metaContent.includes('type: setting'));
    });
  });
});
