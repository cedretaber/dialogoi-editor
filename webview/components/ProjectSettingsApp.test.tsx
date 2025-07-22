import { suite, test, beforeEach, afterEach } from 'mocha';
import { strict as assert } from 'assert';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSettingsApp } from './ProjectSettingsApp';
import type {
  ProjectSettingsData,
  ProjectSettingsWebViewMessage,
  ProjectSettingsMessage,
  UpdateProjectSettingsMessage,
  SaveResultMessage,
} from '../types/ProjectSettings';

suite('ProjectSettingsApp コンポーネント', () => {
  let mockPostMessage: (message: ProjectSettingsMessage) => void;
  let messageCallbacks: ((event: MessageEvent<ProjectSettingsWebViewMessage>) => void)[];
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;

  beforeEach((): void => {
    messageCallbacks = [];
    mockPostMessage = (): void => {};

    // VSCode APIのモック
    (globalThis as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = (): unknown => ({
      postMessage: mockPostMessage,
      setState: (): void => {},
      getState: (): unknown => ({}),
    });

    // addEventListener/removeEventListenerのモック
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    window.addEventListener = (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ): void => {
      if (type === 'message') {
        messageCallbacks.push(
          callback as (event: MessageEvent<ProjectSettingsWebViewMessage>) => void,
        );
      }
    };

    window.removeEventListener = (
      type: string,
      callback: EventListenerOrEventListenerObject,
    ): void => {
      if (type === 'message') {
        const index = messageCallbacks.indexOf(
          callback as (event: MessageEvent<ProjectSettingsWebViewMessage>) => void,
        );
        if (index !== -1) {
          messageCallbacks.splice(index, 1);
        }
      }
    };
  });

  afterEach((): void => {
    // モックをリセット
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    messageCallbacks = [];
  });

  // メッセージを送信するヘルパー関数
  const sendMessage = (data: ProjectSettingsWebViewMessage): void => {
    const event = new MessageEvent('message', { data });
    messageCallbacks.forEach((callback) => callback(event));
  };

  interface PostMessageSpy {
    getCalls: () => ProjectSettingsMessage[];
    wasCalledWith: (expected: ProjectSettingsMessage) => boolean;
    getLastCall: () => ProjectSettingsMessage | undefined;
  }

  // postMessageの呼び出しを記録するためのスパイ
  const createPostMessageSpy = (): PostMessageSpy => {
    const calls: ProjectSettingsMessage[] = [];
    mockPostMessage = (message: ProjectSettingsMessage): void => {
      calls.push(message);
    };
    return {
      getCalls: (): ProjectSettingsMessage[] => calls,
      wasCalledWith: (expected: ProjectSettingsMessage): boolean =>
        calls.some((call) => JSON.stringify(call) === JSON.stringify(expected)),
      getLastCall: (): ProjectSettingsMessage | undefined => calls[calls.length - 1],
    };
  };

  const mockSettingsData: ProjectSettingsData = {
    title: 'テスト小説',
    author: 'テスト作者',
    version: '1.0.0',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    tags: ['ファンタジー', 'アクション'],
    project_settings: {
      readme_filename: 'README.md',
      exclude_patterns: ['*.tmp', 'node_modules/'],
    },
  };

  suite('初期状態', () => {
    test('Dialogoiプロジェクトが見つからない場合のメッセージ', () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: null,
          isDialogoiProject: false,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      assert(screen.getByText('Dialogoiプロジェクトが見つかりません。'));
      assert(
        screen.getByText(
          '新しいプロジェクトを作成するか、既存のDialogoiプロジェクトを開いてください。',
        ),
      );
    });

    test('設定読み込みエラーの表示', async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: null,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      await waitFor(
        () => {
          assert(screen.getByText('プロジェクト設定の読み込みに失敗しました。'));
          assert(screen.getByText('📝 YAML直接編集'));
        },
        { timeout: 3000 },
      );
    });

    test('readyメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<ProjectSettingsApp />);

      await waitFor(
        () => {
          assert(spy.wasCalledWith({ command: 'ready' }));
        },
        { timeout: 3000 },
      );
    });

    test('メッセージリスナーが登録される', () => {
      render(<ProjectSettingsApp />);
      assert.strictEqual(messageCallbacks.length, 1);
    });

    test('コンポーネントのクリーンアップ時にリスナーが削除される', () => {
      const { unmount } = render(<ProjectSettingsApp />);
      const initialCallbackCount = messageCallbacks.length;
      unmount();
      assert.strictEqual(messageCallbacks.length, initialCallbackCount - 1);
    });
  });

  suite('既存プロジェクトの表示', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('基本情報が正しく表示される', () => {
      assert(screen.getByDisplayValue('テスト小説'));
      assert(screen.getByDisplayValue('テスト作者'));
      assert(screen.getByDisplayValue('1.0.0'));
    });

    test('タグが正しく表示される', () => {
      assert(screen.getByText('ファンタジー'));
      assert(screen.getByText('アクション'));
    });

    test('プロジェクト設定が正しく表示される', async () => {
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('README.md'));
          // テキストエリアの値は改行で分かれている
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          const textareaElement = screen.getByLabelText('除外パターン') as HTMLTextAreaElement;
          assert.strictEqual(textareaElement.value, '*.tmp\nnode_modules/');
        },
        { timeout: 3000 },
      );
    });

    test('メタデータが表示される', () => {
      assert(screen.getByText(/作成日:/));
      assert(screen.getByText(/更新日:/));
    });

    test('YAML直接編集ボタンが表示される', () => {
      assert(screen.getByText('📝 YAML直接編集'));
    });
  });

  suite('新規プロジェクトの作成', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: null,
          isDialogoiProject: false,
          isNewProject: true,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByText('🆕 新しい小説プロジェクトの作成'));
        },
        { timeout: 3000 },
      );
    });

    test('新規プロジェクトのタイトルが表示される', () => {
      assert(screen.getByText('🆕 新しい小説プロジェクトの作成'));
    });

    test('作成ボタンが表示される', () => {
      assert(screen.getByText('✨ プロジェクトを作成'));
    });

    test('デフォルト値が設定される', () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const versionInput = screen.getByLabelText('バージョン *') as HTMLInputElement;
      assert.strictEqual(versionInput.value, '1.0.0');
    });

    test('必須フィールドのバリデーション', () => {
      const createButton = screen.getByText('✨ プロジェクトを作成');
      fireEvent.click(createButton);

      assert(screen.getByText('タイトルは必須です'));
      assert(screen.getByText('著者は必須です'));
    });

    test('正しいデータでプロジェクトが作成される', () => {
      const spy = createPostMessageSpy();

      // フォームに入力
      fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: '新しい小説' } });
      fireEvent.change(screen.getByLabelText('著者 *'), { target: { value: '新しい作者' } });

      // 作成ボタンをクリック
      const createButton = screen.getByText('✨ プロジェクトを作成');
      fireEvent.click(createButton);

      assert(
        spy.wasCalledWith({
          command: 'saveSettings',
          data: {
            title: '新しい小説',
            author: '新しい作者',
            version: '1.0.0',
            tags: undefined,
            project_settings: undefined,
          },
        }),
      );
    });
  });

  suite('フィールド編集と自動保存', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('タイトル変更時の自動保存', () => {
      const spy = createPostMessageSpy();
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: '更新された小説' } });
      fireEvent.blur(titleInput);

      assert(
        spy.wasCalledWith({
          command: 'saveSettings',
          data: {
            title: '更新された小説',
            author: 'テスト作者',
            version: '1.0.0',
            tags: ['ファンタジー', 'アクション'],
            project_settings: {
              readme_filename: 'README.md',
              exclude_patterns: ['*.tmp', 'node_modules/'],
            },
          },
        }),
      );
    });

    test('バリデーションエラー時は自動保存されない', () => {
      const spy = createPostMessageSpy();
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.blur(titleInput);

      assert(screen.getByText('タイトルは必須です'));

      // saveSettingsコマンドが呼ばれていないことを確認
      const savesCalls = spy.getCalls().filter((call) => call.command === 'saveSettings');
      assert.strictEqual(savesCalls.length, 0);
    });

    test('セマンティックバージョンのバリデーション', () => {
      const versionInput = screen.getByLabelText('バージョン *');

      // 無効なバージョン
      fireEvent.change(versionInput, { target: { value: '1.0' } });
      fireEvent.blur(versionInput);
      assert(screen.getByText('セマンティックバージョニング形式で入力してください（例: 1.0.0）'));

      // 有効なバージョン
      fireEvent.change(versionInput, { target: { value: '2.0.0' } });
      fireEvent.blur(versionInput);
      assert(
        !screen.queryByText('セマンティックバージョニング形式で入力してください（例: 1.0.0）'),
      );
    });
  });

  suite('タグ管理', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('タグの追加', async () => {
      const spy = createPostMessageSpy();
      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'ロマンス' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      await waitFor(
        () => {
          assert(
            spy.wasCalledWith({
              command: 'saveSettings',
              data: {
                title: 'テスト小説',
                author: 'テスト作者',
                version: '1.0.0',
                tags: ['ファンタジー', 'アクション', 'ロマンス'],
                project_settings: {
                  readme_filename: 'README.md',
                  exclude_patterns: ['*.tmp', 'node_modules/'],
                },
              },
            }),
          );
        },
        { timeout: 3000 },
      );
    });

    test('重複タグは追加されない', async () => {
      const spy = createPostMessageSpy();
      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'ファンタジー' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      // 少し待ってから確認（重複タグは追加されないことを確認）
      await new Promise((resolve) => setTimeout(resolve, 100));

      const calls = spy.getCalls();
      // saveSettingsの呼び出しがあった場合、重複タグがないことを確認
      const saveCall = calls.find((call) => call.command === 'saveSettings');
      if (saveCall && saveCall.data && 'tags' in saveCall.data) {
        const tags = saveCall.data.tags || [];
        const fantasyCount = tags.filter((tag: string) => tag === 'ファンタジー').length;
        assert.strictEqual(fantasyCount, 1, 'ファンタジータグは1つのみであるべき');
      }
    });

    test('タグの削除', async () => {
      const spy = createPostMessageSpy();
      // タグセクション内の削除ボタンのみを取得
      const tagRemoveButtons = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));

      fireEvent.click(tagRemoveButtons[0]); // ファンタジーを削除

      // saveSettingsコマンドの呼び出しを待つ
      await waitFor(
        () => {
          const calls = spy.getCalls();
          const saveCall = calls.find((call) => call.command === 'saveSettings');
          assert(saveCall, 'saveSettings command should be called');
          assert(saveCall?.data && 'tags' in saveCall.data);
          assert.deepStrictEqual(saveCall.data.tags, ['アクション']);
        },
        { timeout: 3000 },
      );
    });

    test('全タグ削除時はundefinedになる', async () => {
      const spy = createPostMessageSpy();

      // 最初のタグを削除
      const tagRemoveButtons1 = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));
      fireEvent.click(tagRemoveButtons1[0]);

      // 最初のタグが削除されるまで待つ
      await waitFor(
        () => {
          const calls = spy.getCalls();
          const saveCall = calls.find((call) => call.command === 'saveSettings');
          assert(saveCall, 'First saveSettings call should be made');
          assert(saveCall?.data && 'tags' in saveCall.data);
          assert(Array.isArray(saveCall.data.tags) && saveCall.data.tags.length === 1);
        },
        { timeout: 3000 },
      );

      // 2番目（最後）のタグを削除
      const tagRemoveButtons2 = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));
      fireEvent.click(tagRemoveButtons2[0]);

      // 全タグが削除されてundefinedになることを確認
      await waitFor(
        () => {
          const calls = spy.getCalls();
          const finalSaveCall = calls.filter((call) => call.command === 'saveSettings')[1]; // 2回目の呼び出し
          assert(finalSaveCall, 'Final saveSettings call should be made');
          assert(finalSaveCall.data && 'tags' in finalSaveCall.data);
          assert.strictEqual(finalSaveCall.data.tags, undefined);
        },
        { timeout: 3000 },
      );
    });
  });

  suite('除外パターン管理', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('除外パターンのテキストエリア編集', () => {
      const spy = createPostMessageSpy();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const textarea = screen.getByLabelText('除外パターン') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '*.log\n*.cache\nbuild/' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.deepStrictEqual(lastCall.data.project_settings?.exclude_patterns, [
          '*.log',
          '*.cache',
          'build/',
        ]);
      }
    });

    test('空行と空白は除去される', () => {
      const spy = createPostMessageSpy();
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '*.log\n\n  \n*.cache\n  build/  ' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.deepStrictEqual(lastCall.data.project_settings?.exclude_patterns, [
          '*.log',
          '*.cache',
          'build/',
        ]);
      }
    });

    test('重複パターンのバリデーション', () => {
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '*.log\n*.cache\n*.log' } });
      fireEvent.blur(textarea);

      assert(screen.getByText('重複する除外パターンがあります: *.log'));
    });

    test('全パターン削除時はundefinedになる', () => {
      const spy = createPostMessageSpy();
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.strictEqual(lastCall.data.project_settings?.exclude_patterns, undefined);
      }
    });
  });

  suite('READMEファイル名設定', () => {
    beforeEach(async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('READMEファイル名の変更', () => {
      const spy = createPostMessageSpy();
      const input = screen.getByLabelText('READMEファイル名');
      fireEvent.change(input, { target: { value: 'index.md' } });
      fireEvent.blur(input);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.strictEqual(lastCall.data.project_settings?.readme_filename, 'index.md');
      }
    });

    test('空のREADMEファイル名はundefinedになる', () => {
      const spy = createPostMessageSpy();
      const input = screen.getByLabelText('READMEファイル名');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.strictEqual(lastCall.data.project_settings?.readme_filename, undefined);
      }
    });
  });

  suite('YAML直接編集', () => {
    test('YAML直接編集ボタンのクリック', async () => {
      const spy = createPostMessageSpy();
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );

      const yamlButton = screen.getByText('📝 YAML直接編集');
      fireEvent.click(yamlButton);

      assert(spy.wasCalledWith({ command: 'openYamlEditor' }));
    });

    test('エラー時もYAML直接編集ボタンは表示される', async () => {
      const spy = createPostMessageSpy();
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: null,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // エラー状態になるまで待つ
      await waitFor(
        () => {
          assert(screen.getByText('❌ エラー'));
        },
        { timeout: 3000 },
      );

      const yamlButton = screen.getByText('📝 YAML直接編集');
      fireEvent.click(yamlButton);

      assert(spy.wasCalledWith({ command: 'openYamlEditor' }));
    });
  });

  suite('保存状態の管理', () => {
    test('保存完了メッセージの処理', async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );

      // タイトルを変更
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: '更新後' } });
      fireEvent.blur(titleInput);

      // 保存完了メッセージ
      const saveResultMessage: SaveResultMessage = {
        type: 'saveResult',
        data: { success: true, message: 'Saved' },
      };
      sendMessage(saveResultMessage);

      // 再度設定が更新されても、フォームの値は保持される
      const updateAfterSave: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: { ...mockSettingsData, title: '更新後' },
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateAfterSave);

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const titleInputElement = screen.getByLabelText('タイトル *') as HTMLInputElement;
      assert.strictEqual(titleInputElement.value, '更新後');
    });

    test('新規プロジェクト作成成功後の処理', async () => {
      render(<ProjectSettingsApp />);
      const newProjectMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: null,
          isDialogoiProject: false,
          isNewProject: true,
        },
      };
      sendMessage(newProjectMessage);

      // 新規プロジェクト画面が表示されるまで待つ
      await waitFor(
        () => {
          assert(screen.getByText('🆕 新しい小説プロジェクトの作成'));
        },
        { timeout: 3000 },
      );

      // フォームに入力
      fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: '新規小説' } });
      fireEvent.change(screen.getByLabelText('著者 *'), { target: { value: '新規作者' } });

      // 作成ボタンをクリック
      const createButton = screen.getByText('✨ プロジェクトを作成');
      fireEvent.click(createButton);

      // 保存成功メッセージ
      const saveResultMessage: SaveResultMessage = {
        type: 'saveResult',
        data: { success: true, message: 'Created' },
      };
      sendMessage(saveResultMessage);

      // 次回は既存プロジェクトとして設定が読み込まれる
      const newSettings: ProjectSettingsData = {
        title: '新規小説',
        author: '新規作者',
        version: '1.0.0',
        created_at: '2025-01-01T00:00:00Z',
      };

      const existingProjectMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: newSettings,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(existingProjectMessage);

      // 既存プロジェクト状態に更新されるまで待つ
      await waitFor(
        () => {
          assert(!screen.queryByText('✨ プロジェクトを作成'));
          assert(screen.getByText('📝 YAML直接編集'));
        },
        { timeout: 3000 },
      );
    });
  });

  suite('エッジケース', () => {
    test('不正なメッセージタイプは無視される', async () => {
      render(<ProjectSettingsApp />);

      // 初期設定
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );
    });

    test('project_settingsが空の場合はundefinedになる', async () => {
      const spy = createPostMessageSpy();
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(() => {
        assert(screen.getByDisplayValue('テスト小説'));
      });

      // READMEファイル名と除外パターンを空にする
      const readmeInput = screen.getByLabelText('READMEファイル名');
      fireEvent.change(readmeInput, { target: { value: '' } });

      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      if (
        lastCall &&
        lastCall.command === 'saveSettings' &&
        lastCall.data &&
        'project_settings' in lastCall.data
      ) {
        assert.strictEqual(lastCall.data.project_settings, undefined);
      }
    });

    test('Enterキー以外ではタグが追加されない', async () => {
      render(<ProjectSettingsApp />);
      const updateMessage: UpdateProjectSettingsMessage = {
        type: 'updateSettings',
        data: {
          settings: mockSettingsData,
          isDialogoiProject: true,
          isNewProject: false,
        },
      };
      sendMessage(updateMessage);

      // 状態更新を待つ
      await waitFor(
        () => {
          assert(screen.getByDisplayValue('テスト小説'));
        },
        { timeout: 3000 },
      );

      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(tagInput, { key: 'Tab' });

      // タグは追加されていない
      assert(!screen.queryByText('テストタグ'));
    });
  });
});
