import { ProjectAutoSetupService } from './ProjectAutoSetupService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';

describe('ProjectAutoSetupService テストスイート', () => {
  let projectAutoSetupService: ProjectAutoSetupService;
  let mockFileRepository: MockFileRepository;
  let metaYamlService: MetaYamlService;
  let dialogoiYamlService: DialogoiYamlService;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    metaYamlService = container.getMetaYamlService();
    dialogoiYamlService = container.getDialogoiYamlService();
    projectAutoSetupService = new ProjectAutoSetupService(
      mockFileRepository,
      metaYamlService,
      dialogoiYamlService,
    );
  });

  describe('setupProjectStructure', () => {
    it('基本的なプロジェクト構造をセットアップできる', async () => {
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
      mockFileRepository.createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.setupProjectStructure(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.processedDirectories).toBe(0);
      expect(result.createdFiles).toBe(0);
    });

    it('既存ファイルを上書きしないオプションが動作する', async () => {
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
      mockFileRepository.createFileForTest(
        `${projectRoot}/.dialogoi-meta.yaml`,
        existingMetaContent,
      );

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

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(3); // chapter1.txt, setting.md, chapter2.txt (README.mdは除外)
      // skippedFiles: .gitignore, temp.tmp, .dialogoi-meta.yaml(2つ), dialogoi.yaml, README.md = 6ファイル
      expect(result.skippedFiles).toBe(6); // 管理ファイルと除外ファイル

      // meta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
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
      mockFileRepository.createDirectoryForTest(projectRoot);

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(false);
      expect(result.message.includes('Dialogoiプロジェクトではありません')).toBeTruthy();
      expect(result.registeredFiles).toBe(0);
      expect(result.skippedFiles).toBe(0);
    });

    it('meta.yamlが存在しないディレクトリは警告してスキップする', async () => {
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

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(1); // root.txtのみ登録される

      // プロジェクトルートのmeta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
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
      mockFileRepository.createFileForTest(`${projectRoot}/.dialogoi-meta.yaml`, metaContent);

      // テスト用ファイルを作成
      mockFileRepository.createFileForTest(`${projectRoot}/existing.txt`, 'Existing content');
      mockFileRepository.createFileForTest(`${projectRoot}/new.txt`, 'New content');

      const result = await projectAutoSetupService.registerAllFiles(projectRoot);

      expect(result.success).toBe(true);
      expect(result.registeredFiles).toBe(1); // new.txtのみ登録
      expect(result.skippedFiles).toBe(3); // existing.txt + dialogoi.yaml + .dialogoi-meta.yaml

      // meta.yamlが更新されていることを確認
      const updatedMeta = await metaYamlService.loadMetaYamlAsync(projectRoot);
      expect(updatedMeta?.files.length).toBe(2); // existing.txt + new.txt
    });

    it('READMEファイルが存在しない場合は自動作成される', async () => {
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
