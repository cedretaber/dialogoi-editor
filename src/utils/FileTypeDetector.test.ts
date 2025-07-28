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

  suite('detectByDirectory', () => {
    test('contents ディレクトリは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('chapter ディレクトリは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/chapter/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('episode ディレクトリは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/episode/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('scene ディレクトリは content 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/scene/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('setting ディレクトリは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/setting/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('character ディレクトリは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/character/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('world ディレクトリは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/world/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('glossary ディレクトリは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/glossary/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('reference ディレクトリは setting 種別として判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/reference/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('その他のディレクトリは拡張子ベースにフォールバックする', () => {
      const txtResult = FileTypeDetector.detectByDirectory('/project/other/file.txt');
      assert.strictEqual(txtResult, 'content'); // .txt なので content

      const mdResult = FileTypeDetector.detectByDirectory('/project/other/file.md');
      assert.strictEqual(mdResult, 'setting'); // .md なので setting
    });

    test('ネストしたパスでcontent系ディレクトリがある場合', () => {
      const result = FileTypeDetector.detectByDirectory('/project/deep/nested/contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('ネストしたパスでsetting系ディレクトリがある場合', () => {
      const result = FileTypeDetector.detectByDirectory('/project/deep/nested/character/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('ディレクトリ名が部分一致でも判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/my-contents-dir/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('Windows パス区切り文字でも正しく判定される', () => {
      const result = FileTypeDetector.detectByDirectory('C:\\project\\contents\\file.txt');
      assert.strictEqual(result, 'content');
    });

    test('相対パスでも正しく判定される', () => {
      const result = FileTypeDetector.detectByDirectory('./contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('大文字小文字混合でも正しく判定される', () => {
      const result = FileTypeDetector.detectByDirectory('/project/Contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('日本語ディレクトリ名は拡張子ベースにフォールバックする', () => {
      const result = FileTypeDetector.detectByDirectory('/project/本文/file.txt');
      assert.strictEqual(result, 'content'); // .txt なので content
    });
  });

  suite('detectFileType', () => {
    test('拡張子ベース判定（デフォルト）が正しく動作する', () => {
      const txtResult = FileTypeDetector.detectFileType('/project/anywhere/chapter.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = FileTypeDetector.detectFileType('/project/anywhere/setting.md');
      assert.strictEqual(mdResult, 'setting');
    });

    test('ディレクトリベース判定を指定した場合が正しく動作する', () => {
      const contentResult = FileTypeDetector.detectFileType(
        '/project/contents/file.unknown',
        'directory',
      );
      assert.strictEqual(contentResult, 'content');

      const settingResult = FileTypeDetector.detectFileType(
        '/project/character/file.unknown',
        'directory',
      );
      assert.strictEqual(settingResult, 'setting');
    });

    test('拡張子ベース判定を明示的に指定した場合が正しく動作する', () => {
      const result = FileTypeDetector.detectFileType('/project/contents/chapter.txt', 'extension');
      assert.strictEqual(result, 'content');
    });

    test('手動選択を指定した場合はsettingが返される', () => {
      const result = FileTypeDetector.detectFileType('/project/chapter.txt', 'manual');
      assert.strictEqual(result, 'setting');
    });

    test('ファイルパスとディレクトリパスで結果が異なるケース', () => {
      // contents ディレクトリの .md ファイル
      const extensionResult = FileTypeDetector.detectFileType(
        '/project/contents/setting.md',
        'extension',
      );
      assert.strictEqual(extensionResult, 'setting'); // .md なので setting

      const directoryResult = FileTypeDetector.detectFileType(
        '/project/contents/setting.md',
        'directory',
      );
      assert.strictEqual(directoryResult, 'content'); // contents ディレクトリなので content
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
