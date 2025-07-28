import { suite, test } from 'mocha';
import * as assert from 'assert';
import { FileTypeDetector } from './FileTypeDetector.js';

suite('FileTypeDetector テストスイート', () => {
  suite('detectByExtension', () => {
    test('.txt ファイルは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('chapter1.txt');
      assert.strictEqual(result, 'content');
    });

    test('.TXT ファイル（大文字）も content 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('chapter1.TXT');
      assert.strictEqual(result, 'content');
    });

    test('.md ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('character.md');
      assert.strictEqual(result, 'setting');
    });

    test('.MD ファイル（大文字）も setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('character.MD');
      assert.strictEqual(result, 'setting');
    });

    test('.json ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('config.json');
      assert.strictEqual(result, 'setting');
    });

    test('.yaml ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('metadata.yaml');
      assert.strictEqual(result, 'setting');
    });

    test('.yml ファイルは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('config.yml');
      assert.strictEqual(result, 'setting');
    });

    test('拡張子がない場合は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('README');
      assert.strictEqual(result, 'setting');
    });

    test('未知の拡張子は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('script.py');
      assert.strictEqual(result, 'setting');
    });

    test('複数のドットを含むファイル名でも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('file.backup.txt');
      assert.strictEqual(result, 'content');
    });

    test('パス付きファイル名でも正しく判定される', () => {
      const txtResult = FileTypeDetector.detectByExtension('/path/to/chapter.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = FileTypeDetector.detectByExtension('/path/to/character.md');
      assert.strictEqual(mdResult, 'setting');
    });

    test('Windows パス区切り文字でも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('C:\\Users\\Documents\\chapter.txt');
      assert.strictEqual(result, 'content');
    });

    test('相対パスでも正しく判定される', () => {
      const result = FileTypeDetector.detectByExtension('./contents/chapter1.txt');
      assert.strictEqual(result, 'content');
    });

    test('空文字列の場合は setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByExtension('');
      assert.strictEqual(result, 'setting');
    });

    test('日本語ファイル名でも正しく判定される', () => {
      const txtResult = FileTypeDetector.detectByExtension('第一章.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = FileTypeDetector.detectByExtension('キャラクター設定.md');
      assert.strictEqual(mdResult, 'setting');
    });
  });

  suite('detectFileType', () => {
    test('拡張子ベース判定（デフォルト）が正しく動作する', () => {
      const txtResult = FileTypeDetector.detectFileType('/project/anywhere/chapter.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = FileTypeDetector.detectFileType('/project/anywhere/setting.md');
      assert.strictEqual(mdResult, 'setting');
    });

    test('拡張子ベース判定を明示的に指定した場合が正しく動作する', () => {
      const result = FileTypeDetector.detectFileType('/project/contents/chapter.txt', 'extension');
      assert.strictEqual(result, 'content');
    });

    test('手動選択を指定した場合はsettingが返される', () => {
      const result = FileTypeDetector.detectFileType('/project/chapter.txt', 'manual');
      assert.strictEqual(result, 'setting');
    });
  });

  suite('isExcluded', () => {
    test('完全一致パターンで除外される', () => {
      const result = FileTypeDetector.isExcluded('file.txt', ['file.txt']);
      assert.strictEqual(result, true);
    });

    test('ドットファイル専用パターン（.*）でマッチする', () => {
      const result = FileTypeDetector.isExcluded('.gitignore', ['.*']);
      assert.strictEqual(result, true);
    });

    test('ワイルドカードパターンでマッチする', () => {
      const result = FileTypeDetector.isExcluded('test.tmp', ['*.tmp']);
      assert.strictEqual(result, true);
    });

    test('完全一致のパスでマッチする', () => {
      // ファイル名または相対パス全体がパターンと完全一致する場合
      const result1 = FileTypeDetector.isExcluded('node_modules', ['node_modules']);
      assert.strictEqual(result1, true);

      // パスの一部だけではマッチしない（完全一致のみ）
      const result2 = FileTypeDetector.isExcluded('path/node_modules/package.json', [
        'node_modules',
      ]);
      assert.strictEqual(result2, false);
    });

    test('除外パターンにマッチしない場合はfalse', () => {
      const result = FileTypeDetector.isExcluded('chapter1.txt', ['*.tmp', '.gitignore']);
      assert.strictEqual(result, false);
    });

    test('空の除外パターンでは何もマッチしない', () => {
      const result = FileTypeDetector.isExcluded('file.txt', []);
      assert.strictEqual(result, false);
    });

    test('複数のパターンでいずれかがマッチすれば除外される', () => {
      const patterns = ['*.tmp', '.*', 'node_modules'];

      assert.strictEqual(FileTypeDetector.isExcluded('test.tmp', patterns), true);
      assert.strictEqual(FileTypeDetector.isExcluded('.gitignore', patterns), true);
      assert.strictEqual(FileTypeDetector.isExcluded('node_modules', patterns), true);
      assert.strictEqual(FileTypeDetector.isExcluded('chapter1.txt', patterns), false);
    });
  });
});
