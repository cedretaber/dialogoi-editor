import { describe, it } from 'mocha';
import { assert } from 'chai';
import { HashService } from './HashService.js';

describe('HashService テストスイート', () => {
  describe('calculateContentHash', () => {
    it('文字列からハッシュを計算する', () => {
      const content = 'Hello, World!';
      const hash = HashService.calculateContentHash(content);
      
      assert.isString(hash);
      assert.isTrue(hash.startsWith('sha256:'));
      assert.equal(hash.length, 71); // 'sha256:' + 64文字のハッシュ
    });

    it('空の文字列からハッシュを計算する', () => {
      const content = '';
      const hash = HashService.calculateContentHash(content);
      
      assert.isString(hash);
      assert.isTrue(hash.startsWith('sha256:'));
      assert.equal(hash, 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('同じ内容からは同じハッシュが生成される', () => {
      const content = 'Test content';
      const hash1 = HashService.calculateContentHash(content);
      const hash2 = HashService.calculateContentHash(content);
      
      assert.equal(hash1, hash2);
    });

    it('異なる内容からは異なるハッシュが生成される', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const hash1 = HashService.calculateContentHash(content1);
      const hash2 = HashService.calculateContentHash(content2);
      
      assert.notEqual(hash1, hash2);
    });
  });

  describe('getHashAlgorithm', () => {
    it('sha256 アルゴリズムを正しく取得する', () => {
      const hash = 'sha256:abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.equal(algorithm, 'sha256');
    });

    it('コロンがない場合は unknown を返す', () => {
      const hash = 'abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.equal(algorithm, 'unknown');
    });

    it('他のアルゴリズムも正しく取得する', () => {
      const hash = 'md5:abcd1234';
      const algorithm = HashService.getHashAlgorithm(hash);
      
      assert.equal(algorithm, 'md5');
    });
  });

  describe('getHashValue', () => {
    it('ハッシュ値を正しく取得する', () => {
      const hash = 'sha256:abcd1234efgh5678';
      const value = HashService.getHashValue(hash);
      
      assert.equal(value, 'abcd1234efgh5678');
    });

    it('コロンがない場合は元の文字列を返す', () => {
      const hash = 'abcd1234';
      const value = HashService.getHashValue(hash);
      
      assert.equal(value, 'abcd1234');
    });

    it('複数のコロンがある場合は最初のコロン以降を返す', () => {
      const hash = 'sha256:abc:def:123';
      const value = HashService.getHashValue(hash);
      
      assert.equal(value, 'abc:def:123');
    });
  });
});