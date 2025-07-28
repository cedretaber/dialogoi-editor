import { suite, test } from 'mocha';
import * as assert from 'assert';
import { HashCalculator } from './HashCalculator.js';

suite('HashCalculator テストスイート', () => {
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

  suite('calculateBinaryHash', () => {
    test('バイナリデータからハッシュを計算する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const hash = HashCalculator.calculateBinaryHash(data);

      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(hash.length, 71); // 'sha256:' + 64文字のハッシュ
    });

    test('空のバイナリデータからハッシュを計算する', () => {
      const data = Buffer.alloc(0);
      const hash = HashCalculator.calculateBinaryHash(data);

      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(
        hash,
        'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    });

    test('同じバイナリデータからは同じハッシュが生成される', () => {
      const data = Buffer.from('Test content', 'utf8');
      const hash1 = HashCalculator.calculateBinaryHash(data);
      const hash2 = HashCalculator.calculateBinaryHash(data);

      assert.strictEqual(hash1, hash2);
    });
  });

  suite('verifyContentHash', () => {
    test('正しいハッシュで検証が成功する', () => {
      const content = 'Hello, World!';
      const expectedHash = HashCalculator.calculateContentHash(content);
      const isValid = HashCalculator.verifyContentHash(content, expectedHash);

      assert.strictEqual(isValid, true);
    });

    test('間違ったハッシュで検証が失敗する', () => {
      const content = 'Hello, World!';
      const wrongHash = 'sha256:wronghash123456789abcdef';
      const isValid = HashCalculator.verifyContentHash(content, wrongHash);

      assert.strictEqual(isValid, false);
    });
  });

  suite('verifyBinaryHash', () => {
    test('正しいハッシュで検証が成功する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const expectedHash = HashCalculator.calculateBinaryHash(data);
      const isValid = HashCalculator.verifyBinaryHash(data, expectedHash);

      assert.strictEqual(isValid, true);
    });

    test('間違ったハッシュで検証が失敗する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const wrongHash = 'sha256:wronghash123456789abcdef';
      const isValid = HashCalculator.verifyBinaryHash(data, wrongHash);

      assert.strictEqual(isValid, false);
    });
  });
});
