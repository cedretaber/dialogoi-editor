import * as path from 'path';
import { ProjectPathService } from './ProjectPathService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';

// DialogoiYamlServiceをJestで自動モック
jest.mock('./DialogoiYamlService.js');

describe('ProjectPathService テストスイート', () => {
  let projectPathService: ProjectPathService;
  let mockDialogoiYamlService: jest.Mocked<DialogoiYamlService>;
  let workspaceRootPath: string;
  let testProjectPath: string;

  beforeEach(() => {
    // Jestの自動モック機能でDialogoiYamlServiceをモック化
    mockDialogoiYamlService = {
      getDialogoiYamlPath: jest.fn(),
      isDialogoiProjectRootAsync: jest.fn(),
      loadDialogoiYamlAsync: jest.fn(),
      saveDialogoiYamlAsync: jest.fn(),
      getExcludePatternsAsync: jest.fn(),
      createDialogoiProjectAsync: jest.fn(),
      createDialogoiProjectWithAutoSetupAsync: jest.fn(),
      updateDialogoiYamlAsync: jest.fn(),
      findProjectRootAsync: jest.fn(),
    };

    // ProjectPathServiceを作成（依存関係注入）
    projectPathService = new ProjectPathService(mockDialogoiYamlService);

    // テスト用のワークスペースとプロジェクトを設定
    workspaceRootPath = '/workspace';
    testProjectPath = path.join(workspaceRootPath, 'novel');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRelativePathFromProject', () => {
    it('プロジェクト内ファイルの相対パス変換が正常に動作する', async () => {
      // プロジェクト内ファイルの絶対パス
      const absoluteFilePath = path.join(testProjectPath, 'chapter1.txt');

      // DialogoiYamlServiceのモック設定：プロジェクトルートを返す
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(testProjectPath);

      const result = await projectPathService.getRelativePathFromProject(absoluteFilePath);
      
      expect(mockDialogoiYamlService.findProjectRootAsync).toHaveBeenCalledWith(absoluteFilePath);
      expect(result).not.toBe(null);
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('chapter1.txt');
    });

    it('プロジェクト外ファイルの場合はnullが返される', async () => {
      const outsideFilePath = '/some/other/path/test.txt';

      // DialogoiYamlServiceのモック設定：プロジェクトルートが見つからない
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(null);

      const result = await projectPathService.getRelativePathFromProject(outsideFilePath);
      
      expect(mockDialogoiYamlService.findProjectRootAsync).toHaveBeenCalledWith(outsideFilePath);
      expect(result).toBe(null);
    });

    it('サブディレクトリ内のファイルも正しく相対パス変換される', async () => {
      const fileInSubDir = path.join(testProjectPath, 'contents', 'chapter3.txt');

      // DialogoiYamlServiceのモック設定：プロジェクトルートを返す
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(testProjectPath);

      const result = await projectPathService.getRelativePathFromProject(fileInSubDir);
      
      expect(mockDialogoiYamlService.findProjectRootAsync).toHaveBeenCalledWith(fileInSubDir);
      expect(result).not.toBe(null);
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('contents/chapter3.txt');
    });

    it('パス区切り文字の正規化が正しく動作する', async () => {
      const normalPath = path.join(testProjectPath, 'chapter1.txt');

      // DialogoiYamlServiceのモック設定：プロジェクトルートを返す  
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(testProjectPath);

      const result = await projectPathService.getRelativePathFromProject(normalPath);
      
      expect(result).not.toBe(null);
      expect(result?.projectRoot).toBe(testProjectPath);
      // 結果は常にスラッシュ区切りになることを確認
      expect(result?.relativePath).toBe('chapter1.txt');
      expect(result?.relativePath.includes('\\')).toBe(false);
    });

    it('プロジェクトルート自体のファイルも正しく処理される', async () => {
      const readmePath = path.join(testProjectPath, 'README.md');

      // DialogoiYamlServiceのモック設定：プロジェクトルートを返す
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(testProjectPath);

      const result = await projectPathService.getRelativePathFromProject(readmePath);
      
      expect(mockDialogoiYamlService.findProjectRootAsync).toHaveBeenCalledWith(readmePath);
      expect(result).not.toBe(null);
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('README.md');
    });

    it('深いネスト構造でも正しく動作する', async () => {
      const deepPath = path.join(testProjectPath, 'a', 'b', 'c', 'd', 'file.txt');

      // DialogoiYamlServiceのモック設定：プロジェクトルートを返す
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(testProjectPath);

      const result = await projectPathService.getRelativePathFromProject(deepPath);
      
      expect(mockDialogoiYamlService.findProjectRootAsync).toHaveBeenCalledWith(deepPath);
      expect(result).not.toBe(null);
      expect(result?.projectRoot).toBe(testProjectPath);
      expect(result?.relativePath).toBe('a/b/c/d/file.txt');
    });
  });
});
