import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent } from '../../test-utils';
import { BasicInfoSection } from './BasicInfoSection';
import assert from 'assert';
import type { FileDetailsData } from '../../types/FileDetails';

suite('BasicInfoSection コンポーネント', () => {
  let mockFileData: FileDetailsData;

  setup(() => {
    // 各テスト前にモックデータをリセット
    mockFileData = {
      name: 'test-file.txt',
      type: 'content',
      path: 'contents/chapter1/test-file.txt',
      tags: ['テスト', '第1章'],
    };
  });

  suite('基本表示', () => {
    test('セクションヘッダーが表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      assert(screen.getByText('基本情報'));
    });

    test('種別が正しく表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      assert(screen.getByText('種別:'));
      assert(screen.getByText('content'));
    });

    test('パスが存在する場合はパスが表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      assert(screen.getByText('パス:'));
      assert(screen.getByText('contents/chapter1/test-file.txt'));
    });

    test('パスが存在しない場合はパスが表示されない', () => {
      const fileDataWithoutPath = { ...mockFileData, path: undefined };
      render(<BasicInfoSection fileData={fileDataWithoutPath} />);

      assert(!screen.queryByText('パス:'));
    });

    test('種別がundefinedの場合はunknownと表示される', () => {
      const fileDataWithoutType = { ...mockFileData, type: undefined };
      render(<BasicInfoSection fileData={fileDataWithoutType} />);

      assert(screen.getByText('種別:'));
      assert(screen.getByText('unknown'));
    });
  });

  suite('展開・折りたたみ機能', () => {
    test('初期状態では展開されている', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      // 内容が見えている = 展開されている
      assert(screen.getByText('種別:'));
      assert(screen.getByText('content'));
    });

    test('ヘッダーをクリックすると折りたたまれる', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('基本情報')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });

    test('折りたたみ状態でヘッダーをクリックすると展開される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
      assert(header);

      // 一度折りたたむ
      fireEvent.click(header);

      // 再度クリックして展開
      fireEvent.click(header);

      // 展開状態の確認
      const content = screen
        .getByText('基本情報')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(!content?.classList.contains('collapsed'));
    });

    test('シェブロンアイコンの状態が正しく切り替わる', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const chevron = screen
        .getByText('基本情報')
        .closest('button')
        ?.querySelector('.section-chevron');
      assert(chevron);

      // 初期状態（展開）
      assert(!chevron.classList.contains('collapsed'));

      const header = screen.getByText('基本情報').closest('button');
      assert(header);

      // 折りたたみ
      fireEvent.click(header);
      assert(chevron.classList.contains('collapsed'));

      // 再展開
      fireEvent.click(header);
      assert(!chevron.classList.contains('collapsed'));
    });
  });

  suite('異なるファイル種別のテスト', () => {
    test('setting種別のファイルが正しく表示される', () => {
      const settingFileData = { ...mockFileData, type: 'setting' as const };
      render(<BasicInfoSection fileData={settingFileData} />);

      assert(screen.getByText('setting'));
    });

    test('subdirectory種別のファイルが正しく表示される', () => {
      const subdirectoryFileData = { ...mockFileData, type: 'subdirectory' as const };
      render(<BasicInfoSection fileData={subdirectoryFileData} />);

      assert(screen.getByText('subdirectory'));
    });
  });

  suite('エッジケース', () => {
    test('空のパス文字列の場合はパスが表示されない', () => {
      const fileDataWithEmptyPath = { ...mockFileData, path: '' };
      render(<BasicInfoSection fileData={fileDataWithEmptyPath} />);

      assert(!screen.queryByText('パス:'));
    });

    test('ファイルデータが最小構成でも正常に動作する', () => {
      const minimalFileData: FileDetailsData = {};
      render(<BasicInfoSection fileData={minimalFileData} />);

      assert(screen.getByText('基本情報'));
      assert(screen.getByText('種別:'));
      assert(screen.getByText('unknown'));
      assert(!screen.queryByText('パス:'));
    });

    test('name以外のプロパティがundefinedでも正常に動作する', () => {
      const partialFileData: FileDetailsData = { name: 'test.txt' };

      assert.doesNotThrow(() => {
        render(<BasicInfoSection fileData={partialFileData} />);
      });

      assert(screen.getByText('基本情報'));
      assert(screen.getByText('unknown'));
    });
  });

  suite('アクセシビリティ', () => {
    test('ヘッダーボタンがbutton要素として正しく実装されている', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
      assert(header);
      assert.strictEqual(header.tagName, 'BUTTON');
      assert.strictEqual(header.getAttribute('type'), 'button');
    });

    test('情報行のラベルと値の構造が正しい', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      // ラベルと値のペアが正しく表示されている
      const typeRow = screen.getByText('種別:').closest('.info-row');
      assert(typeRow);
      assert(typeRow.querySelector('.info-label'));
      assert(typeRow.querySelector('.info-value'));
    });
  });
});
