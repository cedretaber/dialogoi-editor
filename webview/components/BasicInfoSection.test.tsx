import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { BasicInfoSection } from './BasicInfoSection';
import assert from 'assert';
import type { FileDetailsData } from '../types/FileDetails';
import userEvent from '@testing-library/user-event';

suite('BasicInfoSection コンポーネント', () => {
  let mockFileData: FileDetailsData;
  let mockOnFileRename: (oldName: string, newName: string) => Promise<void>;
  let renameHistory: Array<{ oldName: string; newName: string }>;
  let shouldReject: boolean;

  setup(() => {
    // 各テスト前にモックデータをリセット
    mockFileData = {
      name: 'test-file.txt',
      type: 'content',
      path: 'contents/chapter1/test-file.txt',
      tags: ['テスト', '第1章'],
    };

    // ファイル名変更のモック関数をリセット
    renameHistory = [];
    shouldReject = false;

    mockOnFileRename = (oldName: string, newName: string): Promise<void> => {
      renameHistory.push({ oldName, newName });
      if (shouldReject) {
        return Promise.reject(new Error('テスト用エラー'));
      }
      return Promise.resolve();
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

  suite('インライン編集機能', () => {
    test('ファイル名がクリック可能で表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      assert(screen.getByText('ファイル名:'));
      assert(screen.getByText('test-file.txt'));

      const fileName = screen.getByText('test-file.txt');
      assert(fileName.classList.contains('clickable'));
    });

    test('ファイル名をクリックすると編集モードに切り替わる', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} />);

      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      await waitFor(
        () => {
          const input = screen.getByDisplayValue('test-file.txt');
          assert(input);
          assert.strictEqual(input.tagName, 'INPUT');
        },
        { timeout: 3000 },
      );
    });

    test('編集モード中にEnterキーで保存される', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} onFileRename={mockOnFileRename} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      const input = await waitFor(() => screen.getByDisplayValue('test-file.txt'), {
        timeout: 3000,
      });

      // ファイル名を変更してEnterキー
      await user.clear(input);
      await user.type(input, 'new-name.txt');
      await user.keyboard('{Enter}');

      await waitFor(
        () => {
          assert.strictEqual(renameHistory.length, 1);
          assert.strictEqual(renameHistory[0].oldName, 'test-file.txt');
          assert.strictEqual(renameHistory[0].newName, 'new-name.txt');
        },
        { timeout: 3000 },
      );
    });

    test('編集モード中にEscapeキーでキャンセルされる', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} onFileRename={mockOnFileRename} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      const input = await waitFor(() => screen.getByDisplayValue('test-file.txt'), {
        timeout: 3000,
      });

      // ファイル名を変更してEscapeキー
      await user.clear(input);
      await user.type(input, 'changed-name.txt');
      await user.keyboard('{Escape}');

      // 編集がキャンセルされて元の名前に戻る
      await waitFor(
        () => {
          assert(screen.getByText('test-file.txt'));
          assert.strictEqual(renameHistory.length, 0);
        },
        { timeout: 3000 },
      );
    });

    test('フォーカスアウトで自動保存される', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} onFileRename={mockOnFileRename} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      const input = await waitFor(() => screen.getByDisplayValue('test-file.txt'), {
        timeout: 3000,
      });

      // ファイル名を変更してフォーカスアウト
      await user.clear(input);
      await user.type(input, 'auto-save.txt');
      input.blur();

      await waitFor(
        () => {
          assert.strictEqual(renameHistory.length, 1);
          assert.strictEqual(renameHistory[0].oldName, 'test-file.txt');
          assert.strictEqual(renameHistory[0].newName, 'auto-save.txt');
        },
        { timeout: 3000 },
      );
    });

    test('バリデーションエラーが表示される', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      const input = await waitFor(() => screen.getByDisplayValue('test-file.txt'), {
        timeout: 3000,
      });

      // 不正な文字を入力
      await user.clear(input);
      await user.type(input, 'invalid<name.txt');

      await waitFor(
        () => {
          assert(
            screen.getByText('ファイル名に使用できない文字が含まれています: < > : " / \\ | ? *'),
          );
        },
        { timeout: 3000 },
      );
    });

    test('保存中インジケーターが表示される', async () => {
      const user = userEvent.setup();
      let resolvePromise: (() => void) | undefined;

      // 遅延付きモック関数
      mockOnFileRename = (): Promise<void> => {
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      };

      render(<BasicInfoSection fileData={mockFileData} onFileRename={mockOnFileRename} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      const input = await waitFor(() => screen.getByDisplayValue('test-file.txt'), {
        timeout: 3000,
      });

      // ファイル名を変更してEnter（保存開始）
      await user.clear(input);
      await user.type(input, 'saving.txt');
      await user.keyboard('{Enter}');

      // 保存中インジケーターが表示される
      await waitFor(
        () => {
          assert(screen.getByText('保存中...'));
        },
        { timeout: 3000 },
      );

      // 保存完了
      resolvePromise?.();

      await waitFor(
        () => {
          assert(!screen.queryByText('保存中...'));
        },
        { timeout: 3000 },
      );
    });

    test('同じ名前の場合は保存処理を実行しない', async () => {
      const user = userEvent.setup();
      render(<BasicInfoSection fileData={mockFileData} onFileRename={mockOnFileRename} />);

      // 編集モードに切り替え
      const fileName = screen.getByText('test-file.txt');
      await user.click(fileName);

      await waitFor(() => screen.getByDisplayValue('test-file.txt'), { timeout: 3000 });

      // 同じ名前のままEnterキー
      await user.keyboard('{Enter}');

      // 保存処理は呼ばれない
      await waitFor(
        () => {
          assert.strictEqual(renameHistory.length, 0);
          assert(screen.getByText('test-file.txt')); // 編集モードが終了
        },
        { timeout: 3000 },
      );
    });
  });
});
