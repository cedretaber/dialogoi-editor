import * as assert from 'assert';
import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { FileTypeDetectionService } from './FileTypeDetectionService.js';

suite('ProjectAutoSetupService テストスイート', () => {
  let projectAutoSetupService: ProjectAutoSetupService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let dialogoiYamlService: DialogoiYamlService;
  let fileTypeDetectionService: FileTypeDetectionService;

  setup(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getMockFileRepository();
    metaYamlService = container.getMetaYamlService();
    dialogoiYamlService = container.getDialogoiYamlService();
    fileTypeDetectionService = container.getFileTypeDetectionService();
    projectAutoSetupService = new ProjectAutoSetupService(
      mockFileRepository,
      metaYamlService,
      dialogoiYamlService,
      fileTypeDetectionService,
    );
  });

  suite('setupProjectStructure', () => {
    test('基本的なプロジェクト構造をセットアップできる', async () => {
      const projectRoot = '/test/project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/contents`);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/settings`);

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
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.processedDirectories, 3); // プロジェクトルート + 2つのサブディレクトリ
      assert.strictEqual(result.createdFiles, 6); // 各ディレクトリに.dialogoi-meta.yaml + README.md

      // .dialogoi-meta.yamlが作成されていることを確認
      const metaYamlPath = `${projectRoot}/.dialogoi-meta.yaml`;
      const metaYamlUri = mockFileRepository.createFileUri(metaYamlPath);
      assert.strictEqual(await mockFileRepository.existsAsync(metaYamlUri), true);

      // README.mdが作成されていることを確認
      const readmePath = `${projectRoot}/README.md`;
      const readmeUri = mockFileRepository.createFileUri(readmePath);
      assert.strictEqual(await mockFileRepository.existsAsync(readmeUri), true);
    });

    test('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-project';
      mockFileRepository.createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Dialogoiプロジェクトではありません'));
      assert.strictEqual(result.processedDirectories, 0);
      assert.strictEqual(result.createdFiles, 0);
    });

    test('既存ファイルを上書きしないオプションが動作する', async () => {
      const projectRoot = '/test/existing-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存の.dialogoi-meta.yamlを作成
      const existingMetaContent = `files:
  - name: existing.txt
    type: content
    path: /test/existing-project/existing.txt`;
      mockFileRepository.createFileForTest(
        `${projectRoot}/.dialogoi-meta.yaml`,
        existingMetaContent,
      );

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot, {
        overwriteExisting: false,
      });

      assert.strictEqual(result.success, true);

      // 既存のmeta.yamlが変更されていないことを確認
      const metaYamlUri = mockFileRepository.createFileUri(`${projectRoot}/.dialogoi-meta.yaml`);
      const content = await mockFileRepository.readFileAsync(metaYamlUri, 'utf8');
      assert.ok(content.includes('existing.txt'));
    });

    test('最小テンプレートと詳細テンプレートが正しく生成される', async () => {
      const projectRoot = '/test/template-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 詳細テンプレートで実行
      const result = await projectAutoSetupService.setupProjectStructure(projectRoot, {
        readmeTemplate: 'detailed',
      });

      assert.strictEqual(result.success, true);

      // README.mdの内容を確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      assert.ok(readmeContent.includes('## 概要'));
      assert.ok(readmeContent.includes('## ファイル一覧'));
      assert.ok(readmeContent.includes('## 関連情報'));
    });
  });

  suite('registerAllFiles', () => {
    test('全ファイルを正常に登録する', async () => {
      const projectRoot = '/test/register-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/contents`);

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
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // .dialogoi-meta.yamlを作成
      const metaContent = `files: []`;
      mockFileRepository.createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);
      mockFileRepository.createFileForTest(
        `${projectRoot}/contents/.dialogoi-meta.yaml`,
        metaContent,
      );

      // テスト用ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/chapter1.txt`, 'Chapter 1 content');
      mockFileRepository.createFileForTest(`${projectRoot}/setting.md`, '# Setting');
      mockFileRepository.createFileForTest(
        `${projectRoot}/contents/chapter2.txt`,
        'Chapter 2 content',
      );

      // 除外対象ファイルも作成
      mockFileRepository.createFileForTest(`${projectRoot}/.gitignore`, '# Git ignore');
      mockFileRepository.createFileForTest(`${projectRoot}/temp.tmp`, 'temporary');
      mockFileRepository.createFileForTest(`${projectRoot}/README.md`, '# Project README');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.registeredFiles, 3); // chapter1.txt, setting.md, chapter2.txt (README.mdは除外)
      // skippedFiles: .gitignore, temp.tmp, .dialogoi-meta.yaml(2つ), dialogoi.yaml, README.md = 6ファイル
      assert.strictEqual(result.skippedFiles, 6); // 管理ファイルと除外ファイル

      // meta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
      assert.notStrictEqual(updatedMeta, null);
      assert.strictEqual(updatedMeta?.files.length, 3); // chapter1.txt, setting.md, subdirectory'contents'

      const chapter1Entry = updatedMeta?.files.find((f) => f.name === 'chapter1.txt');
      assert.notStrictEqual(chapter1Entry, undefined);
      assert.strictEqual(chapter1Entry?.type, 'content');

      const settingEntry = updatedMeta?.files.find((f) => f.name === 'setting.md');
      assert.notStrictEqual(settingEntry, undefined);
      assert.strictEqual(settingEntry?.type, 'setting');
    });

    test('Dialogoiプロジェクトでない場合はエラーを返す', async () => {
      const projectRoot = '/test/non-dialogoi-register';
      mockFileRepository.createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Dialogoiプロジェクトではありません'));
      assert.strictEqual(result.registeredFiles, 0);
      assert.strictEqual(result.skippedFiles, 0);
    });

    test('meta.yamlが存在しないディレクトリは警告してスキップする', async () => {
      const projectRoot = '/test/no-meta-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);
      mockFileRepository.createDirectoryForTest(`${projectRoot}/nometa`);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // プロジェクトルートにのみmeta.yamlを作成
      const metaContent = `files: []`;
      mockFileRepository.createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);
      // サブディレクトリにはmeta.yamlを作成しない

      // テスト用ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/root.txt`, 'Root content');
      mockFileRepository.createFileForTest(`${projectRoot}/nometa/orphan.txt`, 'Orphan content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.registeredFiles, 1); // root.txtのみ登録される

      // プロジェクトルートのmeta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
      assert.strictEqual(updatedMeta?.files.length, 2); // root.txt と nometa subdirectory
      // root.txtとnometaが登録されていることを確認
      const rootTxtEntry = updatedMeta?.files.find((f) => f.name === 'root.txt');
      assert.notStrictEqual(rootTxtEntry, undefined);
      assert.strictEqual(rootTxtEntry?.type, 'content');

      const nometaDirEntry = updatedMeta?.files.find((f) => f.name === 'nometa');
      assert.notStrictEqual(nometaDirEntry, undefined);
      assert.strictEqual(nometaDirEntry?.type, 'subdirectory');
    });

    test('既に管理対象のファイルはスキップされる', async () => {
      const projectRoot = '/test/existing-files-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // 既存のmeta.yamlを作成（一部ファイルが既に登録済み）
      const metaContent = `files:
  - name: existing.txt
    type: content
    path: /test/existing-files-project/existing.txt`;
      mockFileRepository.createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);

      // テスト用ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/existing.txt`, 'Existing content');
      mockFileRepository.createFileForTest(`${projectRoot}/new.txt`, 'New content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.registeredFiles, 1); // new.txtのみ登録
      assert.strictEqual(result.skippedFiles, 3); // existing.txt + dialogoi.yaml + .dialogoi-meta.yaml

      // meta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
      assert.strictEqual(updatedMeta?.files.length, 2); // existing.txt + new.txt
    });

    test('READMEファイルが存在しない場合は自動作成される', async () => {
      const projectRoot = '/test/readme-creation-project';

      // テスト環境を準備
      mockFileRepository.createDirectoryForTest(projectRoot);

      // dialogoi.yamlを作成
      const dialogoiContent = `
title: Test Project
author: Test Author
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
`;
      mockFileRepository.createFileForTest(`${projectRoot}/dialogoi.yaml`, dialogoiContent);

      // .dialogoi-meta.yamlを作成
      const metaContent = `files: []`;
      mockFileRepository.createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);

      // READMEファイルは作成しない（test.txtのみ作成）
      mockFileRepository.createFileForTest(`${projectRoot}/test.txt`, 'Test content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot, {
        createReadmeIfMissing: true,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.registeredFiles, 1); // test.txtのみ（README.mdは作成されるが除外される）
      // skippedFiles: dialogoi.yaml + .dialogoi-meta.yaml + README.md = 3ファイル
      assert.strictEqual(result.skippedFiles, 3);

      // README.mdが自動作成されていることを確認
      const readmeUri = mockFileRepository.createFileUri(`${projectRoot}/README.md`);
      assert.strictEqual(await mockFileRepository.existsAsync(readmeUri), true);

      // README.mdの内容を確認
      const readmeContent = await mockFileRepository.readFileAsync(readmeUri, 'utf8');
      assert.ok(readmeContent.includes('readme-creation-project'));
    });
  });

  suite('エラーハンドリング', () => {
    test('存在しないディレクトリでsetupProjectStructureを実行するとエラーを返す', async () => {
      const projectRoot = '/test/nonexistent';

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Dialogoiプロジェクトではありません'));
      assert.strictEqual(result.processedDirectories, 0);
      assert.strictEqual(result.createdFiles, 0);
    });

    test('存在しないディレクトリでregisterAllFilesを実行するとエラーを返す', async () => {
      const projectRoot = '/test/nonexistent';

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      assert.strictEqual(result.success, false);
      assert.ok(result.message.includes('Dialogoiプロジェクトではありません'));
      assert.strictEqual(result.registeredFiles, 0);
      assert.strictEqual(result.skippedFiles, 0);
    });
  });
});
