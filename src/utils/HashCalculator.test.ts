import { suite, test, setup } from 'mocha';
import * as assert from 'assert';
import { HashCalculator } from './HashCalculator.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';

suite('HashCalculator テストスイート', () => {
  let mockFileRepository: MockFileRepository;

  setup(() => {
    mockFileRepository = new MockFileRepository();
  });

  suite('calculateContentHash', () => {
    test('文字列からハッシュを計算する', () => {
      const content = 'Hello, World!';
      const hash = HashCalculator.calculateContentHash(content);

      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(hash.length, 71); // 'sha256:' + 64文字のハッシュ
    });

    test('空の文字列からハッシュを計算する', () => {
      const content = '';
      const hash = HashCalculator.calculateContentHash(content);

      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(
        hash,
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    test('同じ内容からは同じハッシュが生成される', () => {
      const content = 'Test content';
      const hash1 = HashCalculator.calculateContentHash(content);
      const hash2 = HashCalculator.calculateContentHash(content);

      assert.strictEqual(hash1, hash2);
    });

    test('異なる内容からは異なるハッシュが生成される', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const hash1 = HashCalculator.calculateContentHash(content1);
      const hash2 = HashCalculator.calculateContentHash(content2);

      assert.notStrictEqual(hash1, hash2);
    });
  });

  suite('getHashAlgorithm', () => {
    test('sha256 アルゴリズムを正しく取得する', () => {
      const hash = 'sha256:abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      assert.strictEqual(algorithm, 'sha256');
    });

    test('コロンがない場合は unknown を返す', () => {
      const hash = 'abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      assert.strictEqual(algorithm, 'unknown');
    });

    test('他のアルゴリズムも正しく取得する', () => {
      const hash = 'md5:abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      assert.strictEqual(algorithm, 'md5');
    });
  });

  suite('getHashValue', () => {
    test('ハッシュ値を正しく取得する', () => {
      const hash = 'sha256:abcd1234efgh5678';
      const value = HashCalculator.getHashValue(hash);

      assert.strictEqual(value, 'abcd1234efgh5678');
    });

    test('コロンがない場合は元の文字列を返す', () => {
      const hash = 'abcd1234';
      const value = HashCalculator.getHashValue(hash);

      assert.strictEqual(value, 'abcd1234');
    });

    test('複数のコロンがある場合は最初のコロン以降を返す', () => {
      const hash = 'sha256:abc:def:123';
      const value = HashCalculator.getHashValue(hash);

      assert.strictEqual(value, 'abc:def:123');
    });
  });

  suite('非同期メソッドテスト', () => {
    test('calculateFileHashAsync でファイルハッシュを計算できる', async () => {
      const testFilePath = '/test/sample.txt';
      const testContent = 'Hello, World!';

      mockFileRepository.createFileForTest(testFilePath, testContent);
      const fileUri = mockFileRepository.createFileUri(testFilePath);

      const hash = await HashCalculator.calculateFileHashAsync(mockFileRepository, fileUri);

      assert.strictEqual(hash.startsWith('sha256:'), true);
      assert.strictEqual(hash.length, 71); // "sha256:" + 64文字のハッシュ
    });

    test('calculateFileHashAsync で存在しないファイルのハッシュ計算でエラーが発生する', async () => {
      const nonExistentPath = '/test/non-existent.txt';
      const fileUri = mockFileRepository.createFileUri(nonExistentPath);

      try {
        await HashCalculator.calculateFileHashAsync(mockFileRepository, fileUri);
        assert.fail('エラーが発生するはず');
      } catch (error) {
        assert.strictEqual(error instanceof Error, true);
        if (error instanceof Error) {
          assert.strictEqual(error.message.includes('ファイルハッシュの計算に失敗しました'), true);
        }
      }
    });

    test('verifyFileHashAsync で正しいハッシュの検証ができる', async () => {
      const testFilePath = '/test/sample.txt';
      const testContent = 'Hello, World!';

      mockFileRepository.createFileForTest(testFilePath, testContent);
      const fileUri = mockFileRepository.createFileUri(testFilePath);

      // まずハッシュを計算
      const expectedHash = await HashCalculator.calculateFileHashAsync(mockFileRepository, fileUri);

      // ハッシュを検証
      const isValid = await HashCalculator.verifyFileHashAsync(
        mockFileRepository,
        fileUri,
        expectedHash,
      );

      assert.strictEqual(isValid, true);
    });

    test('verifyFileHashAsync で間違ったハッシュの検証ができる', async () => {
      const testFilePath = '/test/sample.txt';
      const testContent = 'Hello, World!';

      mockFileRepository.createFileForTest(testFilePath, testContent);
      const fileUri = mockFileRepository.createFileUri(testFilePath);

      const wrongHash = 'sha256:wronghash123456789';

      const isValid = await HashCalculator.verifyFileHashAsync(
        mockFileRepository,
        fileUri,
        wrongHash,
      );

      assert.strictEqual(isValid, false);
    });

    test('verifyFileHashAsync で存在しないファイルの検証は false を返す', async () => {
      const nonExistentPath = '/test/non-existent.txt';
      const fileUri = mockFileRepository.createFileUri(nonExistentPath);
      const anyHash = 'sha256:anyhash123456789';

      const isValid = await HashCalculator.verifyFileHashAsync(
        mockFileRepository,
        fileUri,
        anyHash,
      );

      assert.strictEqual(isValid, false);
    });
  });
});
