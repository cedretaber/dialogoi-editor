import * as path from 'path';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { DialogoiYamlServiceImpl } from './DialogoiYamlServiceImpl.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';

describe('DialogoiYamlServiceImpl テストスイート', () => {
  let service: DialogoiYamlService;
  let mockFileRepository: MockFileRepository;

  beforeEach(() => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    service = new DialogoiYamlServiceImpl(mockFileRepository);
  });

  describe('getDialogoiYamlPath', () => {
    it('dialogoi.yamlファイルのパスを取得する', () => {
      const projectRoot = '/test/project';
      const expectedPath = path.join(projectRoot, 'dialogoi.yaml');

      const result = service.getDialogoiYamlPath(projectRoot);
      expect(result).toBe(expectedPath);
    });
  });

  // ===== 非同期版メソッドのテスト =====

  describe('isDialogoiProjectRootAsync', () => {
    it('dialogoi.yamlが存在する場合trueを返す', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.isDialogoiProjectRootAsync(projectRoot);
      expect(result).toBe(true);
    });

    it('dialogoi.yamlが存在しない場合falseを返す', async () => {
      const projectRoot = '/test/project';

      const result = await service.isDialogoiProjectRootAsync(projectRoot);
      expect(result).toBe(false);
    });
  });

  describe('loadDialogoiYamlAsync', () => {
    it('正常なdialogoi.yamlを読み込む', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const yamlContent = `title: "テスト小説"
author: "テスト著者"
created_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー"]`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, yamlContent);

      const result = await service.loadDialogoiYamlAsync(projectRoot);

      expect(result).not.toBe(null);
      expect(result?.title).toBe('テスト小説');
      expect(result?.author).toBe('テスト著者');
      expect(result?.created_at).toBe('2024-01-01T00:00:00Z');
      expect(result?.tags).toEqual(['ファンタジー']);
    });

    it('ファイルが存在しない場合nullを返す', async () => {
      const projectRoot = '/test/project';

      const result = await service.loadDialogoiYamlAsync(projectRoot);
      expect(result).toBe(null);
    });

    it('不正なYAMLの場合nullを返す', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(
        dialogoiYamlPath,
        'title: "テスト"\nauthor: "著者"\ninvalid: yaml: [unclosed',
      );

      const result = await service.loadDialogoiYamlAsync(projectRoot);
      expect(result).toBe(null);
    });
  });

  describe('saveDialogoiYamlAsync', () => {
    it('正常なデータを保存する', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: ['ファンタジー'],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = await service.saveDialogoiYamlAsync(projectRoot, data);

      expect(result).toBe(true);
      expect(
        await mockFileRepository.existsAsync(mockFileRepository.createFileUri(dialogoiYamlPath)),
      ).toBeTruthy();

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      expect(savedContent.includes('title: テスト小説')).toBeTruthy();
      expect(savedContent.includes('author: テスト著者')).toBeTruthy();
      expect(savedContent.includes('updated_at:')).toBeTruthy();
    });

    it('不正なデータの場合falseを返す', async () => {
      const projectRoot = '/test/project';
      const data = {
        title: '',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const result = await service.saveDialogoiYamlAsync(projectRoot, data);
      expect(result).toBe(false);
    });

    it('updated_atが自動で追加される', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const data = {
        title: 'テスト小説',
        author: 'テスト著者',
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
        updated_at: '2024-01-01T00:00:00Z',
        project_settings: {
          readme_filename: 'README.md',
          exclude_patterns: [],
        },
      };

      const before = new Date().toISOString();
      const result = await service.saveDialogoiYamlAsync(projectRoot, data);
      const after = new Date().toISOString();

      expect(result).toBe(true);

      const savedContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri(dialogoiYamlPath),
        'utf8',
      );
      expect(savedContent.includes('updated_at:')).toBeTruthy();

      // 保存されたファイルから updated_at を読み取って確認
      const savedData = await service.loadDialogoiYamlAsync(projectRoot);
      expect(savedData?.updated_at !== undefined).toBeTruthy();
      if (savedData?.updated_at !== undefined) {
        expect(savedData.updated_at >= before).toBeTruthy();
        expect(savedData.updated_at <= after).toBeTruthy();
      }
    });
  });

  describe('createDialogoiProjectAsync', () => {
    it('新しいプロジェクトを作成する', async () => {
      const projectRoot = '/test/new-project';

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
        ['ファンタジー'],
      );

      expect(result).toBe(true);
      expect(await service.isDialogoiProjectRootAsync(projectRoot)).toBeTruthy();

      const data = await service.loadDialogoiYamlAsync(projectRoot);
      expect(data).not.toBe(null);
      expect(data?.title).toBe('新しい小説');
      expect(data?.author).toBe('新しい著者');
      expect(data?.tags).toEqual(['ファンタジー']);
    });

    it('既にプロジェクトが存在する場合は作成しない', async () => {
      const projectRoot = '/test/existing-project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'existing content');

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
      );
      expect(result).toBe(false);
    });

    it('プロジェクトディレクトリが存在しない場合は作成する', async () => {
      const projectRoot = '/test/non-existing-dir';

      const result = await service.createDialogoiProjectAsync(
        projectRoot,
        '新しい小説',
        '新しい著者',
      );

      expect(result).toBe(true);
      expect(
        await mockFileRepository.existsAsync(mockFileRepository.createDirectoryUri(projectRoot)),
      ).toBeTruthy();
      expect(await service.isDialogoiProjectRootAsync(projectRoot)).toBeTruthy();
    });
  });

  describe('updateDialogoiYamlAsync', () => {
    it('既存のプロジェクトを更新する', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');
      const originalContent = `title: "元のタイトル"
author: "元の著者"
created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-01T00:00:00Z"
tags: []
project_settings:
  readme_filename: "README.md"
  exclude_patterns: []`;

      mockFileRepository.createFileForTest(dialogoiYamlPath, originalContent);

      const result = await service.updateDialogoiYamlAsync(projectRoot, {
        title: '新しいタイトル',
        tags: ['新しいタグ'],
      });

      expect(result).toBe(true);

      const updatedData = await service.loadDialogoiYamlAsync(projectRoot);
      expect(updatedData?.title).toBe('新しいタイトル');
      expect(updatedData?.author).toBe('元の著者');
      expect(updatedData?.tags).toEqual(['新しいタグ']);
    });

    it('プロジェクトが存在しない場合はfalseを返す', async () => {
      const projectRoot = '/test/non-existing-project';

      const result = await service.updateDialogoiYamlAsync(projectRoot, {
        title: '新しいタイトル',
      });

      expect(result).toBe(false);
    });
  });

  describe('findProjectRootAsync', () => {
    it('プロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const subDir = '/test/project/contents';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(subDir);
      expect(result).toBe(projectRoot);
    });

    it('プロジェクトルート自体から開始する場合', async () => {
      const projectRoot = '/test/project';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(projectRoot);
      expect(result).toBe(projectRoot);
    });

    it('プロジェクトルートが見つからない場合nullを返す', async () => {
      const someDir = '/test/no-project';

      const result = await service.findProjectRootAsync(someDir);
      expect(result).toBe(null);
    });

    it('深い階層からプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const deepDir = '/test/project/contents/chapter1/subsection';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(deepDir);
      expect(result).toBe(projectRoot);
    });

    it('ファイルパスを渡してもプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const filePath = '/test/project/settings/characters/hero.md';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      // プロジェクトルートにdialogoi.yamlを作成
      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');
      // ファイルも実際に作成
      mockFileRepository.createFileForTest(filePath, '# ヒーロー');

      const result = await service.findProjectRootAsync(filePath);
      expect(result).toBe(projectRoot);
    });

    it('存在しないファイルパスでもプロジェクトルートを見つける', async () => {
      const projectRoot = '/test/project';
      const nonExistentFilePath = '/test/project/settings/characters/villain.md';
      const dialogoiYamlPath = path.join(projectRoot, 'dialogoi.yaml');

      // プロジェクトルートにdialogoi.yamlを作成（ファイルは作成しない）
      mockFileRepository.createFileForTest(dialogoiYamlPath, 'test content');

      const result = await service.findProjectRootAsync(nonExistentFilePath);
      expect(result).toBe(projectRoot);
    });
  });
});
