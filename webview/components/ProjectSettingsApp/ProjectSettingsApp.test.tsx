import '@testing-library/jest-dom';

import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProjectSettingsApp } from './ProjectSettingsApp';
import { resetGlobalReadyMessageSent } from '../../hooks/useVSCodeApi';
import type {
  ProjectSettingsData,
  ProjectSettingsWebViewMessage,
  ProjectSettingsMessage,
  UpdateProjectSettingsMessage,
  SaveResultMessage,
} from '../../types/ProjectSettings';

describe('ProjectSettingsApp コンポーネント', () => {
  let mockPostMessage: (message: ProjectSettingsMessage) => void;
  let messageCallbacks: ((event: MessageEvent<ProjectSettingsWebViewMessage>) => void)[];
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;

  beforeEach((): void => {
    // グローバルReadyメッセージフラグをリセット
    resetGlobalReadyMessageSent();

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
    // React Testing Libraryのクリーンアップ
    cleanup();

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
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    tags: ['ファンタジー', 'アクション'],
    project_settings: {
      readme_filename: 'README.md',
      exclude_patterns: ['*.tmp', 'node_modules/'],
    },
  };

  describe('初期状態', () => {
    it('Dialogoiプロジェクトが見つからない場合のメッセージ', () => {
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

      expect(screen.getByText('Dialogoiプロジェクトが見つかりません。')).toBeInTheDocument();
      expect(
        screen.getByText(
          '新しいプロジェクトを作成するか、既存のDialogoiプロジェクトを開いてください。',
        ),
      ).toBeInTheDocument();
    });

    it('設定読み込みエラーの表示', async () => {
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

      await waitFor(() => {
        expect(screen.getByText('プロジェクト設定の読み込みに失敗しました。')).toBeInTheDocument();
        expect(screen.getByText('📝 YAML直接編集')).toBeInTheDocument();
      });
    });

    it('readyメッセージが送信される', async () => {
      const spy = createPostMessageSpy();
      render(<ProjectSettingsApp />);

      await waitFor(() => {
        expect(spy.wasCalledWith({ command: 'ready' })).toBe(true);
      });
    });

    it('メッセージリスナーが登録される', () => {
      render(<ProjectSettingsApp />);
      expect(messageCallbacks.length).toBe(1);
    });

    it('コンポーネントのクリーンアップ時にリスナーが削除される', () => {
      const { unmount } = render(<ProjectSettingsApp />);
      const initialCallbackCount = messageCallbacks.length;
      unmount();
      expect(messageCallbacks.length).toBe(initialCallbackCount - 1);
    });
  });

  describe('既存プロジェクトの表示', () => {
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
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('基本情報が正しく表示される', async () => {
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
        expect(screen.getByDisplayValue('テスト作者')).toBeInTheDocument();
      });
    });

    it('タグが正しく表示される', () => {
      expect(screen.getByText('ファンタジー')).toBeInTheDocument();
      expect(screen.getByText('アクション')).toBeInTheDocument();
    });

    it('プロジェクト設定が正しく表示される', async () => {
      await waitFor(() => {
        expect(screen.getByDisplayValue('README.md')).toBeInTheDocument();
        // テキストエリアの値は改行で分かれている
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const textareaElement = screen.getByLabelText('除外パターン') as HTMLTextAreaElement;
        expect(textareaElement.value).toBe('*.tmp\nnode_modules/');
      });
    });

    it('メタデータが表示される', () => {
      expect(screen.getByText(/作成日:/)).toBeInTheDocument();
      expect(screen.getByText(/更新日:/)).toBeInTheDocument();
    });

    it('YAML直接編集ボタンが表示される', () => {
      expect(screen.getByText('📝 YAML直接編集')).toBeInTheDocument();
    });
  });

  describe('新規プロジェクトの作成', () => {
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
      await waitFor(() => {
        expect(screen.getByText('🆕 新しい小説プロジェクトの作成')).toBeInTheDocument();
      });
    });

    it('新規プロジェクトのタイトルが表示される', () => {
      expect(screen.getByText('🆕 新しい小説プロジェクトの作成')).toBeInTheDocument();
    });

    it('作成ボタンが表示される', () => {
      expect(screen.getByText('✨ プロジェクトを作成')).toBeInTheDocument();
    });

    it('必須フィールドのバリデーション', () => {
      const createButton = screen.getByText('✨ プロジェクトを作成');

      // 最初はボタンがdisabledになっている
      expect((createButton as HTMLButtonElement).disabled).toBe(true);

      // タイトルフィールドをフォーカスアウトしてバリデーションをトリガー
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.focus(titleInput);
      fireEvent.blur(titleInput);

      // 著者フィールドをフォーカスアウトしてバリデーションをトリガー
      const authorInput = screen.getByLabelText('著者 *');
      fireEvent.focus(authorInput);
      fireEvent.blur(authorInput);

      // エラーメッセージが表示されることを確認
      expect(screen.getByText('タイトルは必須です')).toBeInTheDocument();
      expect(screen.getByText('著者は必須です')).toBeInTheDocument();
    });

    it('正しいデータでプロジェクトが作成される', async () => {
      const spy = createPostMessageSpy();

      // フォームに入力
      const titleInput = screen.getByLabelText('タイトル *');
      const authorInput = screen.getByLabelText('著者 *');

      fireEvent.change(titleInput, { target: { value: '新しい小説' } });
      fireEvent.change(authorInput, { target: { value: '新しい作者' } });

      // 入力値が正しく設定されていることを事前確認
      expect((titleInput as HTMLInputElement).value).toBe('新しい小説');
      expect((authorInput as HTMLInputElement).value).toBe('新しい作者');

      // 作成ボタンをクリック
      const createButton = screen.getByText('✨ プロジェクトを作成');
      fireEvent.click(createButton);

      // メッセージ送信を確認
      await waitFor(() => {
        const calls = spy.getCalls();
        const saveSettingsCall = calls.find((call) => call.command === 'saveSettings');

        expect(saveSettingsCall).toBeDefined();
        expect(saveSettingsCall?.data).toBeDefined();

        // 型ガードとしてdataの構造を確認
        const data = saveSettingsCall?.data;
        expect(data).toBeDefined();
        expect(data).toHaveProperty('title');
        expect(data).toHaveProperty('author');

        const typedData = data as ProjectSettingsData;
        expect(typedData.title).toBe('新しい小説');
        expect(typedData.author).toBe('新しい作者');

        // 新規プロジェクト作成時はデフォルトのproject_settingsが含まれることを確認
        expect(data).toHaveProperty('project_settings');
        expect(typedData.project_settings).toBeDefined();
        expect(typedData.project_settings?.readme_filename).toBe('README.md');
        expect(Array.isArray(typedData.project_settings?.exclude_patterns)).toBe(true);
        expect(typedData.project_settings?.exclude_patterns?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('フィールド編集と自動保存', () => {
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
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('タイトル変更時の自動保存', () => {
      const spy = createPostMessageSpy();
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: '更新された小説' } });
      fireEvent.blur(titleInput);

      expect(
        spy.wasCalledWith({
          command: 'saveSettings',
          data: {
            title: '更新された小説',
            author: 'テスト作者',
            tags: ['ファンタジー', 'アクション'],
            project_settings: {
              readme_filename: 'README.md',
              exclude_patterns: ['*.tmp', 'node_modules/'],
            },
          },
        }),
      ).toBe(true);
    });

    it('バリデーションエラー時は自動保存されない', () => {
      const spy = createPostMessageSpy();
      const titleInput = screen.getByLabelText('タイトル *');
      fireEvent.change(titleInput, { target: { value: '' } });
      fireEvent.blur(titleInput);

      expect(screen.getByText('タイトルは必須です')).toBeInTheDocument();

      // saveSettingsコマンドが呼ばれていないことを確認
      const savesCalls = spy.getCalls().filter((call) => call.command === 'saveSettings');
      expect(savesCalls.length).toBe(0);
    });
  });

  describe('タグ管理', () => {
    let spy: ReturnType<typeof createPostMessageSpy>;

    beforeEach(async () => {
      spy = createPostMessageSpy();
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
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('タグの追加', async () => {
      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'ロマンス' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      await waitFor(() => {
        expect(
          spy.wasCalledWith({
            command: 'saveSettings',
            data: {
              title: 'テスト小説',
              author: 'テスト作者',
              tags: ['ファンタジー', 'アクション', 'ロマンス'],
              project_settings: {
                readme_filename: 'README.md',
                exclude_patterns: ['*.tmp', 'node_modules/'],
              },
            },
          }),
        ).toBe(true);
      });
    });

    it('重複タグは追加されない', async () => {
      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'ファンタジー' } });
      fireEvent.keyDown(tagInput, { key: 'Enter' });

      // 少し待ってから確認（重複タグは追加されないことを確認）
      await new Promise((resolve) => setTimeout(resolve, 100));

      const calls = spy.getCalls();
      // 重複タグの場合、saveSettingsが呼ばれないことを確認
      const saveCall = calls.find((call) => call.command === 'saveSettings');
      expect(saveCall).toBeUndefined(); // 重複タグのため保存されない

      // 入力フィールドはクリアされず、重複タグ名が残る（ユーザが修正できるように）
      expect((tagInput as HTMLInputElement).value).toBe('ファンタジー');
    });

    it('タグの削除', async () => {
      // タグセクション内の削除ボタンのみを取得
      const tagRemoveButtons = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));

      fireEvent.click(tagRemoveButtons[0]); // ファンタジーを削除

      // saveSettingsコマンドの呼び出しを待つ
      await waitFor(() => {
        const calls = spy.getCalls();
        const saveCall = calls.find((call) => call.command === 'saveSettings');
        expect(saveCall).toBeDefined();
        expect(saveCall?.data).toBeDefined();
        expect(saveCall?.data).toHaveProperty('tags');
        const typedData = saveCall?.data as ProjectSettingsData;
        expect(typedData.tags).toEqual(['アクション']);
      });
    });

    it('全タグ削除時はundefinedになる', async () => {
      // 最初のタグを削除
      const tagRemoveButtons1 = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));
      fireEvent.click(tagRemoveButtons1[0]);

      // 最初のタグが削除されるまで待つ
      await waitFor(() => {
        const calls = spy.getCalls();
        const saveCall = calls.find((call) => call.command === 'saveSettings');
        expect(saveCall).toBeDefined();
        expect(saveCall?.data).toBeDefined();
        expect(saveCall?.data).toHaveProperty('tags');
        const typedData = saveCall?.data as ProjectSettingsData;
        expect(Array.isArray(typedData.tags)).toBe(true);
        expect(typedData.tags?.length).toBe(1);
      });

      // 2番目（最後）のタグを削除
      const tagRemoveButtons2 = screen
        .getAllByRole('button')
        .filter((button) => button.classList.contains('tag-remove'));
      fireEvent.click(tagRemoveButtons2[0]);

      // 全タグが削除されてundefinedになることを確認
      await waitFor(() => {
        const calls = spy.getCalls();
        const finalSaveCall = calls.filter((call) => call.command === 'saveSettings')[1]; // 2回目の呼び出し
        expect(finalSaveCall).toBeDefined();
        expect(finalSaveCall?.data).toBeDefined();
        expect(finalSaveCall?.data).toHaveProperty('tags');
        const typedData = finalSaveCall?.data as ProjectSettingsData;
        expect(typedData.tags).toBe(undefined);
      });
    });
  });

  describe('除外パターン管理', () => {
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
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('除外パターンのテキストエリア編集', () => {
      const spy = createPostMessageSpy();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const textarea = screen.getByLabelText('除外パターン') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: '*.log\n*.cache\nbuild/' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings?.exclude_patterns).toEqual(['*.log', '*.cache', 'build/']);
    });

    it('空行と空白は除去される', () => {
      const spy = createPostMessageSpy();
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '*.log\n\n  \n*.cache\n  build/  ' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings?.exclude_patterns).toEqual(['*.log', '*.cache', 'build/']);
    });

    it('重複パターンのバリデーション', () => {
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '*.log\n*.cache\n*.log' } });
      fireEvent.blur(textarea);

      expect(screen.getByText('重複する除外パターンがあります: *.log')).toBeInTheDocument();
    });

    it('全パターン削除時はundefinedになる', () => {
      const spy = createPostMessageSpy();
      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings?.exclude_patterns).toBe(undefined);
    });
  });

  describe('READMEファイル名設定', () => {
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
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('READMEファイル名の変更', () => {
      const spy = createPostMessageSpy();
      const input = screen.getByLabelText('READMEファイル名');
      fireEvent.change(input, { target: { value: 'index.md' } });
      fireEvent.blur(input);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings?.readme_filename).toBe('index.md');
    });

    it('空のREADMEファイル名はundefinedになる', () => {
      const spy = createPostMessageSpy();
      const input = screen.getByLabelText('READMEファイル名');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings?.readme_filename).toBe(undefined);
    });
  });

  describe('YAML直接編集', () => {
    it('YAML直接編集ボタンのクリック', async () => {
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
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });

      const yamlButton = screen.getByText('📝 YAML直接編集');
      fireEvent.click(yamlButton);

      expect(spy.wasCalledWith({ command: 'openYamlEditor' })).toBeTruthy();
    });

    it('エラー時もYAML直接編集ボタンは表示される', async () => {
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
      await waitFor(() => {
        expect(screen.getByText('❌ エラー')).toBeInTheDocument();
      });

      const yamlButton = screen.getByText('📝 YAML直接編集');
      fireEvent.click(yamlButton);

      expect(spy.wasCalledWith({ command: 'openYamlEditor' })).toBeTruthy();
    });
  });

  describe('保存状態の管理', () => {
    it('保存完了メッセージの処理', async () => {
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
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });

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
      expect(titleInputElement.value).toBe('更新後');
    });

    it('新規プロジェクト作成成功後の処理', async () => {
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
      await waitFor(() => {
        expect(screen.getByText('🆕 新しい小説プロジェクトの作成')).toBeInTheDocument();
      });

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
      await waitFor(() => {
        expect(screen.queryByText('✨ プロジェクトを作成')).toBeNull();
        expect(screen.getByText('📝 YAML直接編集')).toBeInTheDocument();
      });
    });
  });

  describe('エッジケース', () => {
    it('不正なメッセージタイプは無視される', async () => {
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
      await waitFor(() => {
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });
    });

    it('project_settingsが空の場合はundefinedになる', async () => {
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
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });

      // READMEファイル名と除外パターンを空にする
      const readmeInput = screen.getByLabelText('READMEファイル名');
      fireEvent.change(readmeInput, { target: { value: '' } });

      const textarea = screen.getByLabelText('除外パターン');
      fireEvent.change(textarea, { target: { value: '' } });
      fireEvent.blur(textarea);

      const lastCall = spy.getLastCall();
      expect(lastCall).toBeDefined();
      expect(lastCall?.command).toBe('saveSettings');
      expect(lastCall?.data).toBeDefined();
      expect(lastCall?.data).toHaveProperty('project_settings');
      const typedData = lastCall?.data as ProjectSettingsData;
      expect(typedData.project_settings).toBe(undefined);
    });

    it('Enterキー以外ではタグが追加されない', async () => {
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
        expect(screen.getByDisplayValue('テスト小説')).toBeInTheDocument();
      });

      const tagInput = screen.getByPlaceholderText('新しいタグを入力してEnterキーを押してください');
      fireEvent.change(tagInput, { target: { value: 'テストタグ' } });
      fireEvent.keyDown(tagInput, { key: 'Tab' });

      // タグは追加されていない
      expect(screen.queryByText('テストタグ')).toBeNull();
    });
  });
});
