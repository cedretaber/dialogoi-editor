import { DialogoiPathService } from './DialogoiPathService.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { mock, MockProxy } from 'jest-mock-extended';
import { Uri } from '../interfaces/Uri.js';

describe('DialogoiPathService テストスイート', () => {
  let service: DialogoiPathService;
  let mockFileRepository: MockProxy<FileRepository>;

  beforeEach(() => {
    mockFileRepository = mock<FileRepository>();
    service = new DialogoiPathService(mockFileRepository);
  });

  describe('resolveMetaPath メソッド', () => {
    test('プロジェクトルートの場合、dialogoi-meta.yamlパスを返す', () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveMetaPath(targetPath);

      expect(result).toBe('/home/user/project/.dialogoi/dialogoi-meta.yaml');
      expect(mockFileRepository.getProjectRoot).toHaveBeenCalledTimes(1);
    });

    test('サブディレクトリの場合、対応する.dialogoi/内のパスを返す', () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project/contents';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveMetaPath(targetPath);

      expect(result).toBe('/home/user/project/.dialogoi/contents/dialogoi-meta.yaml');
    });

    test('深い階層のディレクトリの場合、正しいパスを返す', () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project/settings/characters/main';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveMetaPath(targetPath);

      expect(result).toBe(
        '/home/user/project/.dialogoi/settings/characters/main/dialogoi-meta.yaml',
      );
    });

    test('プロジェクト外のパスの場合、エラーを投げる', () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/other-project';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      expect(() => service.resolveMetaPath(targetPath)).toThrow(
        '無効なパス: /home/user/other-project はプロジェクト内にありません',
      );
    });
  });

  describe('resolveCommentPath メソッド', () => {
    test('ルートディレクトリのファイルの場合、.dialogoi/直下にコメントファイルパスを返す', () => {
      const projectRoot = '/home/user/project';
      const filePath = '/home/user/project/README.md';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveCommentPath(filePath);

      expect(result).toBe('/home/user/project/.dialogoi/.README.md.comments.yaml');
    });

    test('サブディレクトリのファイルの場合、対応する.dialogoi/内のパスを返す', () => {
      const projectRoot = '/home/user/project';
      const filePath = '/home/user/project/contents/chapter1.txt';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveCommentPath(filePath);

      expect(result).toBe('/home/user/project/.dialogoi/contents/.chapter1.txt.comments.yaml');
    });

    test('深い階層のファイルの場合、正しいパスを返す', () => {
      const projectRoot = '/home/user/project';
      const filePath = '/home/user/project/settings/characters/protagonist.md';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveCommentPath(filePath);

      expect(result).toBe(
        '/home/user/project/.dialogoi/settings/characters/.protagonist.md.comments.yaml',
      );
    });

    test('プロジェクト外のファイルパスの場合、エラーを投げる', () => {
      const projectRoot = '/home/user/project';
      const filePath = '/home/user/other-project/file.txt';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      expect(() => service.resolveCommentPath(filePath)).toThrow(
        '無効なパス: /home/user/other-project/file.txt はプロジェクト内にありません',
      );
    });

    test('特殊文字を含むファイル名の場合、正しくエスケープしてパスを返す', () => {
      const projectRoot = '/home/user/project';
      const filePath = '/home/user/project/contents/第1章 - 始まり.txt';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);

      const result = service.resolveCommentPath(filePath);

      expect(result).toBe(
        '/home/user/project/.dialogoi/contents/.第1章 - 始まり.txt.comments.yaml',
      );
    });
  });

  describe('ensureDialogoiDirectory メソッド', () => {
    test('ディレクトリが存在しない場合、作成する', async () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project/contents';
      const expectedMetaDir = '/home/user/project/.dialogoi/contents';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);
      mockFileRepository.createDirectoryUri.mockReturnValue({} as Uri);
      mockFileRepository.existsAsync.mockResolvedValue(false);
      mockFileRepository.createDirectoryAsync.mockResolvedValue();

      await service.ensureDialogoiDirectory(targetPath);

      expect(mockFileRepository.createDirectoryUri).toHaveBeenCalledWith(expectedMetaDir);
      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(1);
      expect(mockFileRepository.createDirectoryAsync).toHaveBeenCalledTimes(1);
    });

    test('ディレクトリが既に存在する場合、作成しない', async () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project/contents';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);
      mockFileRepository.createDirectoryUri.mockReturnValue({} as Uri);
      mockFileRepository.existsAsync.mockResolvedValue(true);

      await service.ensureDialogoiDirectory(targetPath);

      expect(mockFileRepository.existsAsync).toHaveBeenCalledTimes(1);
      expect(mockFileRepository.createDirectoryAsync).not.toHaveBeenCalled();
    });

    test('ルートディレクトリの場合、.dialogoi/ディレクトリを作成する', async () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project';
      const expectedMetaDir = '/home/user/project/.dialogoi';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);
      mockFileRepository.createDirectoryUri.mockReturnValue({} as Uri);
      mockFileRepository.existsAsync.mockResolvedValue(false);
      mockFileRepository.createDirectoryAsync.mockResolvedValue();

      await service.ensureDialogoiDirectory(targetPath);

      expect(mockFileRepository.createDirectoryUri).toHaveBeenCalledWith(expectedMetaDir);
      expect(mockFileRepository.createDirectoryAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラーハンドリング', () => {
    test('FileRepository.getProjectRoot がエラーを投げる場合、そのエラーが伝播される', () => {
      const errorMessage = 'ワークスペースが開かれていません';
      mockFileRepository.getProjectRoot.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      expect(() => service.resolveMetaPath('/some/path')).toThrow(errorMessage);
      expect(() => service.resolveCommentPath('/some/file.txt')).toThrow(errorMessage);
    });

    test('ensureDialogoiDirectory でファイル操作エラーが発生した場合、エラーが伝播される', async () => {
      const projectRoot = '/home/user/project';
      const targetPath = '/home/user/project/contents';
      const errorMessage = 'ディレクトリ作成に失敗しました';

      mockFileRepository.getProjectRoot.mockReturnValue(projectRoot);
      mockFileRepository.createDirectoryUri.mockReturnValue({} as Uri);
      mockFileRepository.existsAsync.mockResolvedValue(false);
      mockFileRepository.createDirectoryAsync.mockRejectedValue(new Error(errorMessage));

      await expect(service.ensureDialogoiDirectory(targetPath)).rejects.toThrow(errorMessage);
    });
  });
});
