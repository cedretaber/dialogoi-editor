import { mock, MockProxy } from 'jest-mock-extended';
import { DropHandlerService, DroppedFileInfo } from './DropHandlerService.js';
import { CharacterService } from './CharacterService.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiYamlService } from './DialogoiYamlService.js';
import { DialogoiTreeItem } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';
import { FileChangeNotificationService } from './FileChangeNotificationService.js';
import { ReferenceService } from './ReferenceService.js';

describe('DropHandlerService テストスイート', () => {
  let dropHandlerService: DropHandlerService;
  let mockCharacterService: MockProxy<CharacterService>;
  let mockMetaYamlService: MockProxy<MetaYamlService>;
  let mockDialogoiYamlService: MockProxy<DialogoiYamlService>;
  let mockFileChangeNotificationService: MockProxy<FileChangeNotificationService>;
  let mockReferenceService: MockProxy<ReferenceService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // シングルトンサービスのモック設定
    // jest-mock-extendedでモック作成
    mockCharacterService = mock<CharacterService>();
    mockMetaYamlService = mock<MetaYamlService>();
    mockDialogoiYamlService = mock<DialogoiYamlService>();
    mockFileChangeNotificationService = mock<FileChangeNotificationService>();
    mockReferenceService = mock<ReferenceService>();

    // サービスを作成
    dropHandlerService = new DropHandlerService(
      mockCharacterService,
      mockMetaYamlService,
      mockDialogoiYamlService,
      mockFileChangeNotificationService,
      mockReferenceService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleDrop - 本文ファイルへのドロップ', () => {
    it('本文ファイルに設定ファイルをドロップした場合、referencesに追加される', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';

      // モックの設定
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(projectRoot);

      const targetFileInfo: DialogoiTreeItem = {
        name: 'chapter1.txt',
        path: 'contents/chapter1.txt',
        type: 'content',
        hash: 'hash123',
        tags: [],
        references: [],
        isUntracked: false,
        isMissing: false,
      };
      mockCharacterService.getFileInfo.mockResolvedValue(targetFileInfo);

      const metaYaml: MetaYaml = {
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/project/contents/chapter1.txt',
            hash: 'hash123',
            tags: [],
            references: [],
            isUntracked: false,
            isMissing: false,
          },
        ],
      };
      mockMetaYamlService.loadMetaYamlAsync.mockResolvedValue(metaYaml);
      mockMetaYamlService.saveMetaYamlAsync.mockResolvedValue(true);

      // ドロップデータを準備（プロジェクト相対パス）
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md', // DropHandlerServiceはプロジェクト相対パスを期待
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe('参照 "character1.md" を追加しました。');
      expect(result.insertText).toBe(undefined);

      // saveMetaYamlAsyncが正しい引数で呼ばれたことを確認
      expect(mockMetaYamlService.saveMetaYamlAsync).toHaveBeenCalledWith(
        contentsDir,
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: 'chapter1.txt',
              references: ['settings/character1.md'],
            }),
          ]),
        }),
      );

      // ReferenceServiceが正しい引数で呼ばれたことを確認
      expect(mockReferenceService.updateFileReferences).toHaveBeenCalledWith(
        `${contentsDir}/chapter1.txt`,
        ['settings/character1.md'],
      );

      // ファイル変更通知が呼ばれたことを確認
      expect(mockFileChangeNotificationService.notifyReferenceUpdated).toHaveBeenCalledWith(
        `${contentsDir}/chapter1.txt`,
        {
          operation: 'add',
          reference: 'settings/character1.md',
          fileName: 'chapter1.txt',
          source: 'drag_and_drop',
        },
      );
    });

    it('既に存在する参照をドロップした場合、重複追加されない', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';

      // モックの設定
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(projectRoot);

      const targetFileInfo: DialogoiTreeItem = {
        name: 'chapter1.txt',
        path: 'contents/chapter1.txt',
        type: 'content',
        hash: 'hash789',
        tags: [],
        references: ['settings/character1.md'],
        isUntracked: false,
        isMissing: false,
      };
      mockCharacterService.getFileInfo.mockResolvedValue(targetFileInfo);

      // 既に参照が存在するメタデータ
      const metaYaml: MetaYaml = {
        files: [
          {
            name: 'chapter1.txt',
            type: 'content',
            path: '/test/project/contents/chapter1.txt',
            hash: 'hash789',
            tags: [],
            references: ['settings/character1.md'],
            isUntracked: false,
            isMissing: false,
          },
        ],
      };
      mockMetaYamlService.loadMetaYamlAsync.mockResolvedValue(metaYaml);

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe('参照 "settings/character1.md" は既に存在します。');

      // saveが呼ばれないことを確認（重複のため）
      expect(mockMetaYamlService.saveMetaYamlAsync).not.toHaveBeenCalled();

      // ReferenceServiceも呼ばれないことを確認（重複のため）
      expect(mockReferenceService.updateFileReferences).not.toHaveBeenCalled();
    });
  });

  describe('handleDrop - 設定ファイルへのドロップ', () => {
    it('設定ファイルにファイルをドロップした場合、マークダウンリンクが生成される', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';

      // モックの設定
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(projectRoot);

      const targetFileInfo: DialogoiTreeItem = {
        name: 'overview.md',
        path: 'settings/overview.md',
        type: 'setting',
        hash: 'hash_overview',
        tags: [],
        isUntracked: false,
        isMissing: false,
      };
      mockCharacterService.getFileInfo.mockResolvedValue(targetFileInfo);

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/characters/hero.md',
        name: 'hero.md',
        fileType: 'setting',
        absolutePath: 'settings/characters/hero.md',
      };

      // 設定ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        '/test/project/settings/overview.md',
        droppedData,
      );

      // 結果を検証
      expect(result.success).toBe(true);
      expect(result.message).toBe('マークダウンリンク "hero.md" を生成しました。');
      expect(result.insertText).toBe('[hero.md](settings/characters/hero.md)');
      expect(result.insertPosition).toEqual({ line: 0, character: 0 });

      // 設定ファイルへのドロップではReferenceServiceは呼ばれない
      expect(mockReferenceService.updateFileReferences).not.toHaveBeenCalled();
    });
  });

  describe('handleDrop - エラーケース', () => {
    it('Dialogoiプロジェクト外のファイルにドロップした場合、エラーになる', async () => {
      // プロジェクト外のファイル
      const outsideFile = '/outside/file.txt';

      // モックの設定（プロジェクトルートが見つからない）
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(null);

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // プロジェクト外のファイルにドロップ
      const result = await dropHandlerService.handleDrop(outsideFile, droppedData);

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'ドロップ先のファイルがDialogoiプロジェクトのファイルではありません。',
      );

      // エラーケースではReferenceServiceは呼ばれない
      expect(mockReferenceService.updateFileReferences).not.toHaveBeenCalled();
    });

    it('meta.yamlが存在しないディレクトリの本文ファイルにドロップした場合、エラーになる', async () => {
      // テスト用ファイル構造を準備
      const projectRoot = '/test/project';
      const contentsDir = '/test/project/contents';

      // モックの設定（ファイル情報が取得できない）
      mockDialogoiYamlService.findProjectRootAsync.mockResolvedValue(projectRoot);
      mockCharacterService.getFileInfo.mockResolvedValue(null);

      // ドロップデータを準備
      const droppedData: DroppedFileInfo = {
        type: 'dialogoi-file',
        path: 'settings/character1.md',
        name: 'character1.md',
        fileType: 'setting',
        absolutePath: 'settings/character1.md',
      };

      // 本文ファイルにドロップ
      const result = await dropHandlerService.handleDrop(
        `${contentsDir}/chapter1.txt`,
        droppedData,
      );

      // 結果を検証
      expect(result.success).toBe(false);
      expect(result.message).toBe(
        'ドロップ先のファイルがDialogoiプロジェクトのファイルではありません。',
      );

      // エラーケースではReferenceServiceは呼ばれない
      expect(mockReferenceService.updateFileReferences).not.toHaveBeenCalled();
    });
  });
});
