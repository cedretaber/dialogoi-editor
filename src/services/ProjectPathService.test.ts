import * as path from 'path';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { MockDialogoiYamlService } from '../repositories/MockDialogoiYamlService.js';
import { ProjectPathService } from './ProjectPathService.js';

describe('ProjectPathService テストスイート', () => {
  let projectPathService: ProjectPathService;
  let mockFileRepository: MockFileRepository;
  let mockDialogoiYamlService: MockDialogoiYamlService;
  let workspaceRootPath: string;
  let testProjectPath: string;

  beforeEach(() => {
    // テスト用サービスコンテナを作成（getInstance非推奨のため）
    const container = TestServiceContainer.create();

    // モックサービスを取得
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    mockDialogoiYamlService = new MockDialogoiYamlService();

    // ProjectPathServiceを直接作成（DIパターン準拠）
    projectPathService = new ProjectPathService(mockDialogoiYamlService);

    // テスト用のワークスペースとプロジェクトを設定
    workspaceRootPath = '/workspace';
    testProjectPath = path.join(workspaceRootPath, 'novel');

    // テスト用プロジェクト構造を作成
    const dialogoiYamlData = {
      title: 'テスト小説',
      author: 'テスト著者',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      tags: [],
      project_settings: {
        readme_filename: 'README.md',
        exclude_patterns: [],
      },
    };

    // MockDialogoiYamlServiceにデータを設定
    mockDialogoiYamlService.setDialogoiYaml(testProjectPath, dialogoiYamlData);

    // ファイルシステム構造をMockFileRepositoryに設定
    mockFileRepository.createFileForTest(
      path.join(testProjectPath, 'dialogoi.yaml'),
      'yaml content',
    );
    mockFileRepository.createFileForTest(
      path.join(testProjectPath, 'chapter1.txt'),
      'これはテスト章です。\n2行目の内容。\n3行目の内容。',
    );
    mockFileRepository.createFileForTest(
      path.join(testProjectPath, 'chapter2.txt'),
      '別の章の内容です。',
    );
  });

  afterEach(() => {
    // モックサービスをクリア
    mockDialogoiYamlService.clear();
    mockFileRepository.reset();
  });

  describe('getRelativePathFromProject', () => {
    it('プロジェクト内ファイルの相対パス変換が正常に動作する', async () => {
      // プロジェクト内ファイルの絶対パス
      const absoluteFilePath = path.join(testProjectPath, 'chapter1.txt');

      const result = await projectPathService.getRelativePathFromProject(absoluteFilePath);
      expect(result !== null).toBeTruthy();
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('chapter1.txt');
    });

    it('プロジェクト外ファイルの場合はnullが返される', async () => {
      // プロジェクト外ディレクトリのファイルパス（存在するファイルを作成）
      const outsideFilePath = '/some/other/path/test.txt';
      mockFileRepository.addFile(outsideFilePath, 'test content');

      const result = await projectPathService.getRelativePathFromProject(outsideFilePath);
      expect(result).toBe(null);
    });

    it('上位ディレクトリを参照するパスは無効として扱われる', async () => {
      // プロジェクトルートの上位ディレクトリのファイル
      const upperFilePath = path.join(workspaceRootPath, 'outside.txt');
      mockFileRepository.addFile(upperFilePath, 'outside content');

      // 別のプロジェクトを作成してそこにdialogoi.yamlを置く
      const anotherProjectPath = path.join(workspaceRootPath, 'another-project');
      mockFileRepository.addFile(
        path.join(anotherProjectPath, 'dialogoi.yaml'),
        'title: Another Project',
      );

      // 上位ディレクトリのファイルはプロジェクト外として扱われる
      const result = await projectPathService.getRelativePathFromProject(upperFilePath);
      expect(result).toBe(null);
    });

    it('サブディレクトリ内のファイルも正しく相対パス変換される', async () => {
      // サブディレクトリ構造を作成
      const subDirPath = path.join(testProjectPath, 'contents');
      const fileInSubDir = path.join(subDirPath, 'chapter3.txt');
      mockFileRepository.addFile(fileInSubDir, 'サブディレクトリ内の章');

      const result = await projectPathService.getRelativePathFromProject(fileInSubDir);
      expect(result !== null).toBeTruthy();
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('contents/chapter3.txt');
    });

    it('パス区切り文字の正規化が正しく動作する', async () => {
      // 既存のファイル（chapter1.txt）を使用してパス区切り文字の正規化をテスト
      const normalPath = path.join(testProjectPath, 'chapter1.txt');

      const result = await projectPathService.getRelativePathFromProject(normalPath);
      expect(result !== null).toBeTruthy();
      expect(result?.projectRoot).toBe(testProjectPath);
      // 結果は常にスラッシュ区切りになることを確認
      expect(result?.relativePath).toBe('chapter1.txt');
      expect(result?.relativePath.includes('\\')).toBe(false);
    });

    it('プロジェクトルート自体のファイルも正しく処理される', async () => {
      // プロジェクトルート直下のREADME.md
      const readmePath = path.join(testProjectPath, 'README.md');
      mockFileRepository.addFile(readmePath, '# README');

      const result = await projectPathService.getRelativePathFromProject(readmePath);
      expect(result !== null).toBeTruthy();
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('README.md');
    });

    it('深いネスト構造でも正しく動作する', async () => {
      // 深いディレクトリ構造を作成
      const deepPath = path.join(testProjectPath, 'a', 'b', 'c', 'd', 'file.txt');
      mockFileRepository.addFile(deepPath, 'Deep nested file');

      const result = await projectPathService.getRelativePathFromProject(deepPath);
      expect(result !== null).toBeTruthy();
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('a/b/c/d/file.txt');
    });
  });
});
