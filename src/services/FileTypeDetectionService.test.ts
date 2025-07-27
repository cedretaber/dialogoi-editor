import { suite, test } from 'mocha';
import * as assert from 'assert';
import { FileTypeDetectionService } from './FileTypeDetectionService.js';

suite('FileTypeDetectionService テストスイート', () => {
  let service: FileTypeDetectionService;

  setup(() => {
    service = new FileTypeDetectionService();
  });

  suite('detectByExtension', () => {
    test('.txt ファイルは content 種別として判定される', () => {
      const result = service.detectByExtension('chapter1.txt');
      assert.strictEqual(result, 'content');
    });

    test('.TXT ファイル（大文字）も content 種別として判定される', () => {
      const result = service.detectByExtension('chapter1.TXT');
      assert.strictEqual(result, 'content');
    });

    test('.md ファイルは setting 種別として判定される', () => {
      const result = service.detectByExtension('character.md');
      assert.strictEqual(result, 'setting');
    });

    test('.MD ファイル（大文字）も setting 種別として判定される', () => {
      const result = service.detectByExtension('character.MD');
      assert.strictEqual(result, 'setting');
    });

    test('.json ファイルは setting 種別として判定される', () => {
      const result = service.detectByExtension('config.json');
      assert.strictEqual(result, 'setting');
    });

    test('.yaml ファイルは setting 種別として判定される', () => {
      const result = service.detectByExtension('metadata.yaml');
      assert.strictEqual(result, 'setting');
    });

    test('.yml ファイルは setting 種別として判定される', () => {
      const result = service.detectByExtension('config.yml');
      assert.strictEqual(result, 'setting');
    });

    test('拡張子がない場合は setting 種別として判定される', () => {
      const result = service.detectByExtension('README');
      assert.strictEqual(result, 'setting');
    });

    test('未知の拡張子は setting 種別として判定される', () => {
      const result = service.detectByExtension('script.py');
      assert.strictEqual(result, 'setting');
    });

    test('複数のドットを含むファイル名でも正しく判定される', () => {
      const result = service.detectByExtension('file.backup.txt');
      assert.strictEqual(result, 'content');
    });

    test('パス付きファイル名でも正しく判定される', () => {
      const txtResult = service.detectByExtension('/path/to/chapter.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = service.detectByExtension('/path/to/character.md');
      assert.strictEqual(mdResult, 'setting');
    });

    test('Windows パス区切り文字でも正しく判定される', () => {
      const result = service.detectByExtension('C:\\Users\\Documents\\chapter.txt');
      assert.strictEqual(result, 'content');
    });

    test('相対パスでも正しく判定される', () => {
      const result = service.detectByExtension('./contents/chapter1.txt');
      assert.strictEqual(result, 'content');
    });

    test('空文字列の場合は setting 種別として判定される', () => {
      const result = service.detectByExtension('');
      assert.strictEqual(result, 'setting');
    });

    test('日本語ファイル名でも正しく判定される', () => {
      const txtResult = service.detectByExtension('第一章.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = service.detectByExtension('キャラクター設定.md');
      assert.strictEqual(mdResult, 'setting');
    });
  });

  suite('detectByDirectory', () => {
    test('contents ディレクトリは content 種別として判定される', () => {
      const result = service.detectByDirectory('/project/contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('chapter ディレクトリは content 種別として判定される', () => {
      const result = service.detectByDirectory('/project/chapter/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('episode ディレクトリは content 種別として判定される', () => {
      const result = service.detectByDirectory('/project/episode/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('scene ディレクトリは content 種別として判定される', () => {
      const result = service.detectByDirectory('/project/scene/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('setting ディレクトリは setting 種別として判定される', () => {
      const result = service.detectByDirectory('/project/setting/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('character ディレクトリは setting 種別として判定される', () => {
      const result = service.detectByDirectory('/project/character/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('world ディレクトリは setting 種別として判定される', () => {
      const result = service.detectByDirectory('/project/world/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('glossary ディレクトリは setting 種別として判定される', () => {
      const result = service.detectByDirectory('/project/glossary/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('reference ディレクトリは setting 種別として判定される', () => {
      const result = service.detectByDirectory('/project/reference/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('その他のディレクトリは拡張子ベースにフォールバックする', () => {
      const txtResult = service.detectByDirectory('/project/other/file.txt');
      assert.strictEqual(txtResult, 'content'); // .txt なので content

      const mdResult = service.detectByDirectory('/project/other/file.md');
      assert.strictEqual(mdResult, 'setting'); // .md なので setting
    });

    test('ネストしたパスでcontent系ディレクトリがある場合', () => {
      const result = service.detectByDirectory('/project/deep/nested/contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('ネストしたパスでsetting系ディレクトリがある場合', () => {
      const result = service.detectByDirectory('/project/deep/nested/character/file.txt');
      assert.strictEqual(result, 'setting');
    });

    test('ディレクトリ名が部分一致でも判定される', () => {
      const result = service.detectByDirectory('/project/my-contents-dir/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('Windows パス区切り文字でも正しく判定される', () => {
      const result = service.detectByDirectory('C:\\project\\contents\\file.txt');
      assert.strictEqual(result, 'content');
    });

    test('相対パスでも正しく判定される', () => {
      const result = service.detectByDirectory('./contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('大文字小文字混合でも正しく判定される', () => {
      const result = service.detectByDirectory('/project/Contents/file.txt');
      assert.strictEqual(result, 'content');
    });

    test('日本語ディレクトリ名は拡張子ベースにフォールバックする', () => {
      const result = service.detectByDirectory('/project/本文/file.txt');
      assert.strictEqual(result, 'content'); // .txt なので content
    });
  });

  suite('detectFileType', () => {
    test('拡張子ベース判定（デフォルト）が正しく動作する', () => {
      const txtResult = service.detectFileType('/project/anywhere/chapter.txt');
      assert.strictEqual(txtResult, 'content');

      const mdResult = service.detectFileType('/project/anywhere/setting.md');
      assert.strictEqual(mdResult, 'setting');
    });

    test('ディレクトリベース判定を指定した場合が正しく動作する', () => {
      const contentResult = service.detectFileType('/project/contents/file.unknown', 'directory');
      assert.strictEqual(contentResult, 'content');

      const settingResult = service.detectFileType('/project/character/file.unknown', 'directory');
      assert.strictEqual(settingResult, 'setting');
    });

    test('拡張子ベース判定を明示的に指定した場合が正しく動作する', () => {
      const result = service.detectFileType('/project/contents/chapter.txt', 'extension');
      assert.strictEqual(result, 'content');
    });

    test('手動選択を指定した場合はsettingが返される', () => {
      const result = service.detectFileType('/project/chapter.txt', 'manual');
      assert.strictEqual(result, 'setting');
    });

    test('ファイルパスとディレクトリパスで結果が異なるケース', () => {
      // contents ディレクトリの .md ファイル
      const extensionResult = service.detectFileType('/project/contents/setting.md', 'extension');
      assert.strictEqual(extensionResult, 'setting'); // .md なので setting

      const directoryResult = service.detectFileType('/project/contents/setting.md', 'directory');
      assert.strictEqual(directoryResult, 'content'); // contents ディレクトリなので content
    });
  });

  suite('isExcluded', () => {
    test('完全一致パターンで除外される', () => {
      const result = service.isExcluded('file.txt', ['file.txt']);
      assert.strictEqual(result, true);
    });

    test('ドットファイル専用パターン（.*）でマッチする', () => {
      const result = service.isExcluded('.gitignore', ['.*']);
      assert.strictEqual(result, true);
    });

    test('ワイルドカードパターンでマッチする', () => {
      const result = service.isExcluded('test.tmp', ['*.tmp']);
      assert.strictEqual(result, true);
    });

    test('完全一致のパスでマッチする', () => {
      // ファイル名または相対パス全体がパターンと完全一致する場合
      const result1 = service.isExcluded('node_modules', ['node_modules']);
      assert.strictEqual(result1, true);

      // パスの一部だけではマッチしない（完全一致のみ）
      const result2 = service.isExcluded('path/node_modules/package.json', ['node_modules']);
      assert.strictEqual(result2, false);
    });

    test('除外パターンにマッチしない場合はfalse', () => {
      const result = service.isExcluded('chapter1.txt', ['*.tmp', '.gitignore']);
      assert.strictEqual(result, false);
    });

    test('空の除外パターンでは何もマッチしない', () => {
      const result = service.isExcluded('file.txt', []);
      assert.strictEqual(result, false);
    });

    test('複数のパターンでいずれかがマッチすれば除外される', () => {
      const patterns = ['*.tmp', '.*', 'node_modules'];

      assert.strictEqual(service.isExcluded('test.tmp', patterns), true);
      assert.strictEqual(service.isExcluded('.gitignore', patterns), true);
      assert.strictEqual(service.isExcluded('node_modules', patterns), true);
      assert.strictEqual(service.isExcluded('chapter1.txt', patterns), false);
    });
  });
});
