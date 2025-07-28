import assert from 'assert';
import { FileManagementService } from './FileManagementService.js';
import { ForeshadowingData } from './ForeshadowingService.js';
import { TestServiceContainer } from '../di/TestServiceContainer.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('FileManagementService テストスイート', () => {
  let fileManagementService: FileManagementService;
  let mockFileRepository: MockFileRepository;

  setup(async () => {
    const container = TestServiceContainer.create();
    mockFileRepository = container.getFileRepository() as MockFileRepository;
    fileManagementService = container.getFileManagementService();

    // テスト用ディレクトリ構造の準備
    mockFileRepository.createDirectoryForTest('/test');
    await mockFileRepository.writeFileAsync(
      mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
      `files:
  - name: character.txt
    type: content
    subtype: character
  - name: foreshadow.txt
    type: content
    subtype: foreshadowing
  - name: plain.txt
    type: content
`,
    );
  });

  suite('既存機能テスト', () => {
    test('管理対象外ファイルを管理対象に追加できる', async () => {
      // 新しいファイルを作成
      await mockFileRepository.writeFileAsync(
        mockFileRepository.createFileUri('/test/new-file.txt'),
        'New content',
      );

      const result = await fileManagementService.addFileToManagement(
        '/test/new-file.txt',
        'content',
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('管理対象に追加しました'));

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('new-file.txt'));
    });

    test('存在しないファイルの追加はエラー', async () => {
      const result = await fileManagementService.addFileToManagement(
        '/test/nonexistent.txt',
        'content',
      );

      assert.strictEqual(result.success, false);
      assert(result.message.includes('ファイルが存在しません'));
    });

    test('管理対象からファイルを削除できる', async () => {
      const result = await fileManagementService.removeFileFromManagement('/test/plain.txt');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('管理対象から削除しました'));

      // メタデータから削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('plain.txt'));
    });

    test('欠損ファイルを作成できる', async () => {
      const result = await fileManagementService.createMissingFile(
        '/test/missing.txt',
        'Test content',
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('ファイルを作成しました'));

      // ファイルが作成されているか確認
      const fileContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/missing.txt'),
        'utf8',
      );
      assert.strictEqual(fileContent, 'Test content');
    });
  });

  suite('キャラクター操作', () => {
    test('キャラクター重要度を設定できる', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'character.txt',
        'main',
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('キャラクター重要度を "main" に設定しました'));
      assert(result.updatedItems);

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('importance: main'));
    });

    test('存在しないファイルにキャラクター重要度を設定するとエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'nonexistent.txt',
        'main',
      );

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });

    test('複数キャラクターフラグを設定できる', async () => {
      const result = await fileManagementService.setMultipleCharacters(
        '/test',
        'character.txt',
        true,
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('複数キャラクターフラグを "有効" に設定しました'));
      assert(result.updatedItems);

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('multiple_characters: true'));
    });

    test('新規ファイルに複数キャラクターフラグを設定できる', async () => {
      const result = await fileManagementService.setMultipleCharacters('/test', 'plain.txt', false);

      assert.strictEqual(result.success, true);
      assert(result.message.includes('複数キャラクターフラグを "無効" に設定しました'));

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('importance: sub'));
      assert(metaContent.includes('multiple_characters: false'));
    });

    test('キャラクター設定を削除できる', async () => {
      // まずキャラクター設定を追加
      await fileManagementService.setCharacterImportance('/test', 'character.txt', 'main');

      // 削除
      const result = await fileManagementService.removeCharacter('/test', 'character.txt');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('キャラクター設定を削除しました'));
      assert(result.updatedItems);

      // メタデータからキャラクター設定が削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('character:'));
    });
  });

  suite('伏線操作', () => {
    test('伏線設定を設定できる', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          {
            location: 'Chapter 1:10',
            comment: 'Plant 1',
          },
        ],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };

      const result = await fileManagementService.setForeshadowing(
        '/test',
        'foreshadow.txt',
        foreshadowingData,
      );

      assert.strictEqual(result.success, true);
      assert(result.message.includes('伏線設定を更新しました'));
      assert(result.updatedItems);

      // メタデータが更新されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(metaContent.includes('foreshadowing:'));
      assert(metaContent.includes('Plant 1'));
      assert(metaContent.includes('Payoff'));
    });

    test('存在しないファイルに伏線設定を設定するとエラー', async () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };

      const result = await fileManagementService.setForeshadowing(
        '/test',
        'nonexistent.txt',
        foreshadowingData,
      );

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });

    test('伏線設定を削除できる', async () => {
      // まず伏線設定を追加
      const foreshadowingData: ForeshadowingData = {
        plants: [],
        payoff: {
          location: 'Chapter 5:100',
          comment: 'Payoff',
        },
      };
      await fileManagementService.setForeshadowing('/test', 'foreshadow.txt', foreshadowingData);

      // 削除
      const result = await fileManagementService.removeForeshadowing('/test', 'foreshadow.txt');

      assert.strictEqual(result.success, true);
      assert(result.message.includes('伏線設定を削除しました'));
      assert(result.updatedItems);

      // メタデータから伏線設定が削除されているか確認
      const metaContent = await mockFileRepository.readFileAsync(
        mockFileRepository.createFileUri('/test/.dialogoi-meta.yaml'),
        'utf8',
      );
      assert(!metaContent.includes('foreshadowing:'));
    });
  });

  suite('エラーハンドリング', () => {
    test('メタデータファイルが存在しない場合のエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/nonexistent',
        'file.txt',
        'main',
      );

      assert.strictEqual(result.success, false);
      assert(result.message.includes('.dialogoi-meta.yamlが見つから'));
    });

    test('存在しないファイルに対する操作はエラー', async () => {
      const result = await fileManagementService.setCharacterImportance(
        '/test',
        'nonexistent.txt',
        'main',
      );

      assert.strictEqual(result.success, false);
      assert(result.message.includes('見つかりません'));
    });
  });
});
