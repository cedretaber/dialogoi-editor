import {
  parseFileLineUrl,
  formatFileLineUrl,
  parseTargetFile,
  formatTargetFile,
} from './FileLineUrlParser.js';

describe('FileLineUrlParser テストスイート', () => {
  describe('parseFileLineUrl', () => {
    it('ファイルパスのみをパースできる', () => {
      const result = parseTargetFile('contents/chapter1.txt');
      expect(result.filePath).toBe('contents/chapter1.txt');
      expect(result.startLine).toBe(undefined);
      expect(result.endLine).toBe(undefined);
    });

    it('単一行指定をパースできる', () => {
      const result = parseTargetFile('contents/chapter1.txt#L42');
      expect(result.filePath).toBe('contents/chapter1.txt');
      expect(result.startLine).toBe(42);
      expect(result.endLine).toBe(undefined);
    });

    it('複数行指定をパースできる', () => {
      const result = parseTargetFile('contents/chapter1.txt#L4-L7');
      expect(result.filePath).toBe('contents/chapter1.txt');
      expect(result.startLine).toBe(4);
      expect(result.endLine).toBe(7);
    });

    it('複数行指定（省略形）をパースできる', () => {
      const result = parseTargetFile('contents/chapter1.txt#L4-7');
      expect(result.filePath).toBe('contents/chapter1.txt');
      expect(result.startLine).toBe(4);
      expect(result.endLine).toBe(7);
    });

    it('深いディレクトリパスもパースできる', () => {
      const result = parseTargetFile('contents/part1/chapter1.txt#L42');
      expect(result.filePath).toBe('contents/part1/chapter1.txt');
      expect(result.startLine).toBe(42);
      expect(result.endLine).toBe(undefined);
    });

    it('不正な形式でエラーを投げる', () => {
      expect(() => {
        parseTargetFile('');
      }).toThrow(/Invalid file line URL format/);

      expect(() => {
        parseTargetFile('contents/chapter1.txt#Linvalid');
      }).toThrow(/Invalid file line URL format/);

      expect(() => {
        parseTargetFile('contents/chapter1.txt#L');
      }).toThrow(/Invalid file line URL format/);
    });

    it('0で開始するファイル名も正しくパースできる', () => {
      const result = parseTargetFile('contents/01_prologue.txt#L1');
      expect(result.filePath).toBe('contents/01_prologue.txt');
      expect(result.startLine).toBe(1);
    });
  });

  describe('formatTargetFile', () => {
    it('ファイルパスのみをフォーマットできる', () => {
      const result = formatTargetFile('contents/chapter1.txt');
      expect(result).toBe('contents/chapter1.txt');
    });

    it('単一行指定をフォーマットできる', () => {
      const result = formatTargetFile('contents/chapter1.txt', 42);
      expect(result).toBe('contents/chapter1.txt#L42');
    });

    it('複数行指定をフォーマットできる', () => {
      const result = formatTargetFile('contents/chapter1.txt', 4, 7);
      expect(result).toBe('contents/chapter1.txt#L4-L7');
    });

    it('同じ行番号の場合は単一行形式になる', () => {
      const result = formatTargetFile('contents/chapter1.txt', 5, 5);
      expect(result).toBe('contents/chapter1.txt#L5');
    });

    it('深いディレクトリパスもフォーマットできる', () => {
      const result = formatTargetFile('contents/part1/chapter1.txt', 42);
      expect(result).toBe('contents/part1/chapter1.txt#L42');
    });

    it('0で開始するファイル名も正しくフォーマットできる', () => {
      const result = formatTargetFile('contents/01_prologue.txt', 1);
      expect(result).toBe('contents/01_prologue.txt#L1');
    });
  });

  describe('往復変換テスト', () => {
    it('parseとformatの往復変換が正しく動作する', () => {
      const originalTargets = [
        'contents/chapter1.txt',
        'contents/chapter1.txt#L42',
        'contents/chapter1.txt#L4-L7',
        'contents/part1/chapter1.txt#L100',
        'contents/01_prologue.txt#L1-L3',
      ];

      for (const original of originalTargets) {
        const parsed = parseTargetFile(original);
        const formatted = formatTargetFile(parsed.filePath, parsed.startLine, parsed.endLine);
        expect(formatted).toBe(original);
      }
    });

    it('新関数でも往復変換が正しく動作する', () => {
      const originalUrls = [
        'contents/chapter1.txt',
        'contents/chapter1.txt#L42',
        'contents/chapter1.txt#L4-L7',
        'contents/part1/chapter1.txt#L100',
        'contents/01_prologue.txt#L1-L3',
      ];

      for (const original of originalUrls) {
        const parsed = parseFileLineUrl(original);
        const formatted = formatFileLineUrl(parsed.filePath, parsed.startLine, parsed.endLine);
        expect(formatted).toBe(original);
      }
    });
  });
});
