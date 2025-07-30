import { HashCalculator } from './HashCalculator.js';

describe('HashCalculator テストスイート', () => {
  describe('calculateContentHash', () => {
    it('文字列からハッシュを計算する', () => {
      const content = 'Hello, World!';
      const hash = HashCalculator.calculateContentHash(content);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('sha256:')).toBeTruthy();
      expect(hash.length).toBe(71); // 'sha256:' + 64文字のハッシュ
    });

    it('空の文字列からハッシュを計算する', () => {
      const content = '';
      const hash = HashCalculator.calculateContentHash(content);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('sha256:')).toBeTruthy();
      expect(hash).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('同じ内容からは同じハッシュが生成される', () => {
      const content = 'Test content';
      const hash1 = HashCalculator.calculateContentHash(content);
      const hash2 = HashCalculator.calculateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('異なる内容からは異なるハッシュが生成される', () => {
      const content1 = 'Test content 1';
      const content2 = 'Test content 2';
      const hash1 = HashCalculator.calculateContentHash(content1);
      const hash2 = HashCalculator.calculateContentHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getHashAlgorithm', () => {
    it('sha256 アルゴリズムを正しく取得する', () => {
      const hash = 'sha256:abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      expect(algorithm).toBe('sha256');
    });

    it('コロンがない場合は unknown を返す', () => {
      const hash = 'abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      expect(algorithm).toBe('unknown');
    });

    it('他のアルゴリズムも正しく取得する', () => {
      const hash = 'md5:abcd1234';
      const algorithm = HashCalculator.getHashAlgorithm(hash);

      expect(algorithm).toBe('md5');
    });
  });

  describe('getHashValue', () => {
    it('ハッシュ値を正しく取得する', () => {
      const hash = 'sha256:abcd1234efgh5678';
      const value = HashCalculator.getHashValue(hash);

      expect(value).toBe('abcd1234efgh5678');
    });

    it('コロンがない場合は元の文字列を返す', () => {
      const hash = 'abcd1234';
      const value = HashCalculator.getHashValue(hash);

      expect(value).toBe('abcd1234');
    });

    it('複数のコロンがある場合は最初のコロン以降を返す', () => {
      const hash = 'sha256:abc:def:123';
      const value = HashCalculator.getHashValue(hash);

      expect(value).toBe('abc:def:123');
    });
  });

  describe('calculateBinaryHash', () => {
    it('バイナリデータからハッシュを計算する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const hash = HashCalculator.calculateBinaryHash(data);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('sha256:')).toBeTruthy();
      expect(hash.length).toBe(71); // 'sha256:' + 64文字のハッシュ
    });

    it('空のバイナリデータからハッシュを計算する', () => {
      const data = Buffer.alloc(0);
      const hash = HashCalculator.calculateBinaryHash(data);

      expect(typeof hash).toBe('string');
      expect(hash.startsWith('sha256:')).toBeTruthy();
      expect(hash).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('同じバイナリデータからは同じハッシュが生成される', () => {
      const data = Buffer.from('Test content', 'utf8');
      const hash1 = HashCalculator.calculateBinaryHash(data);
      const hash2 = HashCalculator.calculateBinaryHash(data);

      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyContentHash', () => {
    it('正しいハッシュで検証が成功する', () => {
      const content = 'Hello, World!';
      const expectedHash = HashCalculator.calculateContentHash(content);
      const isValid = HashCalculator.verifyContentHash(content, expectedHash);

      expect(isValid).toBe(true);
    });

    it('間違ったハッシュで検証が失敗する', () => {
      const content = 'Hello, World!';
      const wrongHash = 'sha256:wronghash123456789abcdef';
      const isValid = HashCalculator.verifyContentHash(content, wrongHash);

      expect(isValid).toBe(false);
    });
  });

  describe('verifyBinaryHash', () => {
    it('正しいハッシュで検証が成功する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const expectedHash = HashCalculator.calculateBinaryHash(data);
      const isValid = HashCalculator.verifyBinaryHash(data, expectedHash);

      expect(isValid).toBe(true);
    });

    it('間違ったハッシュで検証が失敗する', () => {
      const data = Buffer.from('Hello, World!', 'utf8');
      const wrongHash = 'sha256:wronghash123456789abcdef';
      const isValid = HashCalculator.verifyBinaryHash(data, wrongHash);

      expect(isValid).toBe(false);
    });
  });
});
