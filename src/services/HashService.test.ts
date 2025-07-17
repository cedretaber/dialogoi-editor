import { describe, it } from 'mocha';
import * as assert from 'assert';
import { HashService } from './HashService.js';

describe('HashService テストスイート', () => {
  describe('calculateContentHash', () => {
    it('文字列からハッシュを計算する', () => {
      const content = 'Hello, World!';
      const hash = HashService.calculateContentHash(content);
      
      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(hash.length, 71); // 'sha256:' + 64文字のハッシュ
    });

    it('空の文字列からハッシュを計算する', () => {
      const content = '';
      const hash = HashService.calculateContentHash(content);
      
      assert.strictEqual(typeof hash, 'string');
      assert.ok(hash.startsWith('sha256:'));
      assert.strictEqual(hash, 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('同じ内容からは同じハッシュが生成される', () => {
      const content = 'Test content';
      const hash1 = HashService.calculateContentHash(content);
      const hash2 = HashService.calculateContentHash(content);
      
      assert.strictEqual(hash1, hash2);
    });

    it('異なる内容からは異なるハッシュが生成される', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const hash1 = HashService.calculateContentHash(content1);
      const hash2 = HashService.calculateContentHash(content2);
      
      assert.notStrictEqual(hash1, hash2);
    });
  });

  describe('getHashAlgorithm', () => {
    it('sha256 アルゴリズムを正しく取得する', () => {
      const hash = 'sha256:abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.strictEqual(algorithm, 'sha256');
    });

    it('コロンがない場合は unknown を返す', () => {
      const hash = 'abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.strictEqual(algorithm, 'unknown');
    });

    it('他のアルゴリズムも正しく取得する', () => {
      const hash = 'md5:abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.strictEqual(algorithm, 'md5');
    });
  });

  describe('getHashValue', () => {
    it('ハッシュ値を正しく取得する', () => {
      const hash = 'sha256:abcd1234efgh5678';
      const value = HashService.getHashValue(hash);
      
      assert.strictEqual(value, 'abcd1234efgh5678');
    });

    it('コロンがない場合は元の文字列を返す', () => {
      const hash = 'abcd1234';
      const value = HashService.getHashValue(hash);
      
      assert.strictEqual(value, 'abcd1234');
    });

    it('複数のコロンがある場合は最初のコロン以降を返す', () => {
      const hash = 'sha256:abc:def:123';
      const value = HashService.getHashValue(hash);
      
      assert.strictEqual(value, 'abc:def:123');
    });
  });
});