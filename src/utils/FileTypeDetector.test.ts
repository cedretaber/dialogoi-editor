import { FileTypeDetector } from './FileTypeDetector.js';

describe('FileTypeDetector テストスイート', () => {
  describe('detectByExtension', () => {
    it('.txt ファイルは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('chapter1.txt');
      expect(result).toBe('content');
    });

    it('.TXT ファイル（大文字）も content 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('chapter1.TXT');
      expect(result).toBe('content');
    });

    it('.md ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('character.md');
      expect(result).toBe('setting');
    });

    it('.MD ファイル（大文字）も setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('character.MD');
      expect(result).toBe('setting');
    });

    it('.json ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('config.json');
      expect(result).toBe('setting');
    });

    it('.yaml ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('metadata.yaml');
      expect(result).toBe('setting');
    });

    it('.yml ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('config.yml');
      expect(result).toBe('setting');
    });

    it('拡張子がない場合は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('README');
      expect(result).toBe('setting');
    });

    it('未知の拡張子は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('script.py');
      expect(result).toBe('setting');
    });

    it('複数のドットを含むファイル名でも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('file.backup.txt');
      expect(result).toBe('content');
    });

    it('パス付きファイル名でも正しく判定される', () => {
      const txtResult = FileTypeDetector.detectByExtension('/path/to/chapter.txt');
      expect(txtResult).toBe('content');

      const mdResult = FileTypeDetector.detectByExtension('/path/to/character.md');
      expect(mdResult).toBe('setting');
    });

    it('Windows パス区切り文字でも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('C:\\Users\\Documents\\chapter.txt');
      expect(result).toBe('content');
    });

    it('相対パスでも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('./contents/chapter1.txt');
      expect(result).toBe('content');
    });

    it('空文字列の場合は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('');
      expect(result).toBe('setting');
    });

    it('日本語ファイル名でも正しく判定される', () => {
      const txtResult = FileTypeDetector.detectByExtension('第一章.txt');
      expect(txtResult).toBe('content');

      const mdResult = FileTypeDetector.detectByExtension('キャラクター設定.md');
      expect(mdResult).toBe('setting');
    });
  });

  describe('detectFileType', () => {
    it('拡張子ベース判定（デフォルト）が正しく動作する', () => {
      const txtResult = FileTypeDetector.detectFileType('/project/anywhere/chapter.txt');
      expect(txtResult).toBe('content');

      const mdResult = FileTypeDetector.detectFileType('/project/anywhere/setting.md');
      expect(mdResult).toBe('setting');
    });

    it('拡張子ベース判定を明示的に指定した場合が正しく動作する', () => {
      const result = FileTypeDetector.detectFileType('/project/contents/chapter.txt', 'extension');
      expect(result).toBe('content');
    });

    it('手動選択を指定した場合はsettingが返される', () => {
      const result = FileTypeDetector.detectFileType('/project/chapter.txt', 'manual');
      expect(result).toBe('setting');
    });
  });

  describe('isExcluded', () => {
    it('完全一致パターンで除外される', () => {
      const result = FileTypeDetector.isExcluded('file.txt', ['file.txt']);
      expect(result).toBe(true);
    });

    it('ドットファイル専用パターン（.*）でマッチする', () => {
      const result = FileTypeDetector.isExcluded('.gitignore', ['.*']);
      expect(result).toBe(true);
    });

    it('ワイルドカードパターンでマッチする', () => {
      const result = FileTypeDetector.isExcluded('test.tmp', ['*.tmp']);
      expect(result).toBe(true);
    });

    it('完全一致のパスでマッチする', () => {
      // ファイル名または相対パス全体がパターンと完全一致する場合
      const result1 = FileTypeDetector.isExcluded('node_modules', ['node_modules']);
      expect(result1).toBe(true);

      // パスの一部だけではマッチしない（完全一致のみ）
      const result2 = FileTypeDetector.isExcluded('path/node_modules/package.json', [
        'node_modules',
      ]);
      expect(result2).toBe(false);
    });

    it('除外パターンにマッチしない場合はfalse', () => {
      const result = FileTypeDetector.isExcluded('chapter1.txt', ['*.tmp', '.gitignore']);
      expect(result).toBe(false);
    });

    it('空の除外パターンでは何もマッチしない', () => {
      const result = FileTypeDetector.isExcluded('file.txt', []);
      expect(result).toBe(false);
    });

    it('複数のパターンでいずれかがマッチすれば除外される', () => {
      const patterns = ['*.tmp', '.*', 'node_modules'];

      expect(FileTypeDetector.isExcluded('test.tmp', patterns)).toBe(true);
      expect(FileTypeDetector.isExcluded('.gitignore', patterns)).toBe(true);
      expect(FileTypeDetector.isExcluded('node_modules', patterns)).toBe(true);
      expect(FileTypeDetector.isExcluded('chapter1.txt', patterns)).toBe(false);
    });
  });
});
