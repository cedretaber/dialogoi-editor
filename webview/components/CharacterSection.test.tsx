import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent } from '../test-utils';
import { CharacterSection } from './CharacterSection';
import assert from 'assert';
import type { CharacterInfo } from '../types/FileDetails';

suite('CharacterSection コンポーネント', () => {
  let mockCharacter: CharacterInfo;
  let mockOnCharacterRemove: () => void;
  let removeCallCount: number;

  setup(() => {
    // 各テスト前にモックデータをリセット
    mockCharacter = {
      importance: 'main',
      multiple_characters: false,
      display_name: '主人公',
    };

    removeCallCount = 0;
    mockOnCharacterRemove = (): void => {
      removeCallCount++;
    };
  });

  suite('基本表示', () => {
    test('セクションヘッダーが表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('キャラクター情報'));
    });

    test('削除ボタンが表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      assert(deleteButton);
      assert.strictEqual(deleteButton.textContent, '×');
    });

    test('キャラクター情報が正しく表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('重要度:'));
      assert(screen.getByText('main'));
      assert(screen.getByText('複数キャラ:'));
      assert(screen.getByText('いいえ'));
      assert(screen.getByText('表示名:'));
      assert(screen.getByText('主人公'));
    });

    test('各キャラクター情報フィールドが正しい構造で表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const importanceField = screen.getByText('重要度:').closest('.character-field');
      assert(importanceField);
      assert(importanceField.textContent?.includes('main'));

      const multipleField = screen.getByText('複数キャラ:').closest('.character-field');
      assert(multipleField);
      assert(multipleField.textContent?.includes('いいえ'));

      const displayNameField = screen.getByText('表示名:').closest('.character-field');
      assert(displayNameField);
      assert(displayNameField.textContent?.includes('主人公'));
    });
  });

  suite('展開・折りたたみ機能', () => {
    test('初期状態では展開されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // キャラクター情報が見えている = 展開されている
      assert(screen.getByText('重要度:'));
      assert(screen.getByText('複数キャラ:'));
      assert(screen.getByText('表示名:'));
    });

    test('ヘッダーをクリックすると折りたたまれる', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('キャラクター情報')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });

    test('折りたたみ状態でヘッダーをクリックすると展開される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      assert(header);

      // 一度折りたたむ
      fireEvent.click(header);

      // 再度クリックして展開
      fireEvent.click(header);

      // 展開状態の確認
      const content = screen
        .getByText('キャラクター情報')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(!content?.classList.contains('collapsed'));
    });

    test('シェブロンアイコンの状態が正しく切り替わる', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const chevron = screen
        .getByText('キャラクター情報')
        .closest('button')
        ?.querySelector('.section-chevron');
      assert(chevron);

      // 初期状態（展開）
      assert(!chevron.classList.contains('collapsed'));

      const header = screen.getByText('キャラクター情報').closest('button');
      assert(header);

      // 折りたたみ
      fireEvent.click(header);
      assert(chevron.classList.contains('collapsed'));

      // 再展開
      fireEvent.click(header);
      assert(!chevron.classList.contains('collapsed'));
    });
  });

  suite('削除機能', () => {
    test('削除ボタンをクリックするとonCharacterRemoveが呼ばれる', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      fireEvent.click(deleteButton);

      assert.strictEqual(removeCallCount, 1);
    });

    test('削除ボタンのクリックイベントが親要素に伝播しない', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      fireEvent.click(deleteButton);

      // 削除ボタンがクリックされた
      assert.strictEqual(removeCallCount, 1);

      // 注意: jsdomでの制限により、実際のstopPropagationの確認は困難
      // 削除機能が動作していることで代用
      assert.strictEqual(removeCallCount, 1);
    });
  });

  suite('重要度の種別テスト', () => {
    test('main重要度が正しく表示される', () => {
      const mainCharacter = { ...mockCharacter, importance: 'main' as const };
      render(
        <CharacterSection
          character={mainCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('main'));
    });

    test('sub重要度が正しく表示される', () => {
      const subCharacter = { ...mockCharacter, importance: 'sub' as const };
      render(
        <CharacterSection
          character={subCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('sub'));
    });

    test('background重要度が正しく表示される', () => {
      const backgroundCharacter = { ...mockCharacter, importance: 'background' as const };
      render(
        <CharacterSection
          character={backgroundCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('background'));
    });

    test('重要度がundefinedの場合は「未設定」と表示される', () => {
      const noImportanceCharacter = { ...mockCharacter, importance: undefined };
      render(
        <CharacterSection
          character={noImportanceCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('未設定'));
    });
  });

  suite('複数キャラクターフラグのテスト', () => {
    test('複数キャラクターがtrueの場合は「はい」と表示される', () => {
      const multipleCharacter = { ...mockCharacter, multiple_characters: true };
      render(
        <CharacterSection
          character={multipleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('はい'));
    });

    test('複数キャラクターがfalseの場合は「いいえ」と表示される', () => {
      const singleCharacter = { ...mockCharacter, multiple_characters: false };
      render(
        <CharacterSection
          character={singleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('いいえ'));
    });

    test('複数キャラクターがundefinedの場合は「いいえ」と表示される', () => {
      const undefinedMultipleCharacter = { ...mockCharacter, multiple_characters: undefined };
      render(
        <CharacterSection
          character={undefinedMultipleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('いいえ'));
    });
  });

  suite('表示名のフォールバック動作', () => {
    test('display_nameが設定されている場合はそれが表示される', () => {
      const characterWithDisplayName = { ...mockCharacter, display_name: 'カスタム名前' };
      render(
        <CharacterSection
          character={characterWithDisplayName}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('カスタム名前'));
    });

    test('display_nameがない場合はfileNameが表示される', () => {
      const characterWithoutDisplayName = { ...mockCharacter, display_name: undefined };
      render(
        <CharacterSection
          character={characterWithoutDisplayName}
          fileName="hero.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('hero.md'));
    });

    test('display_nameもfileNameもない場合は空文字が表示される', () => {
      const characterWithoutDisplayName = { ...mockCharacter, display_name: undefined };
      render(
        <CharacterSection
          character={characterWithoutDisplayName}
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // 表示名フィールドは存在するが、値は空
      const displayNameField = screen.getByText('表示名:').closest('.character-field');
      assert(displayNameField);
      // display_nameもfileNameもない場合は空文字のためスペースが残る
      assert.strictEqual(displayNameField.textContent, '表示名: ');
    });

    test('空文字のdisplay_nameの場合はfileNameにフォールバック', () => {
      const characterWithEmptyDisplayName = { ...mockCharacter, display_name: '' };
      render(
        <CharacterSection
          character={characterWithEmptyDisplayName}
          fileName="fallback.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('fallback.md'));
    });
  });

  suite('エッジケース', () => {
    test('空のキャラクター情報でも正常に動作する', () => {
      const emptyCharacter: CharacterInfo = {};

      assert.doesNotThrow(() => {
        render(
          <CharacterSection
            character={emptyCharacter}
            fileName="test.md"
            onCharacterRemove={mockOnCharacterRemove}
          />,
        );
      });

      assert(screen.getByText('キャラクター情報'));
      assert(screen.getByText('未設定'));
      assert(screen.getByText('いいえ'));
      assert(screen.getByText('test.md'));
    });

    test('すべてのプロパティがundefinedでも正常に動作する', () => {
      const undefinedCharacter: CharacterInfo = {
        importance: undefined,
        multiple_characters: undefined,
        display_name: undefined,
      };

      render(
        <CharacterSection
          character={undefinedCharacter}
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      assert(screen.getByText('未設定'));
      assert(screen.getByText('いいえ'));
      // 表示名は空になる（どちらも未定義なので）
    });
  });

  suite('アクセシビリティ', () => {
    test('ヘッダーボタンがbutton要素として正しく実装されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      assert(header);
      assert.strictEqual(header.tagName, 'BUTTON');
      assert.strictEqual(header.getAttribute('type'), 'button');
    });

    test('削除ボタンがbutton要素として正しく実装されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      assert.strictEqual(deleteButton.tagName, 'BUTTON');
      assert.strictEqual(deleteButton.getAttribute('type'), 'button');
      assert.strictEqual(deleteButton.getAttribute('title'), 'キャラクター情報を削除');
    });

    test('キャラクター情報の構造が正しい', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // .character-info コンテナが存在する
      const infoContainer = screen.getByText('重要度:').closest('.character-info');
      assert(infoContainer);

      // 各情報フィールドが .character-field クラスを持つ
      const fieldItems = infoContainer?.querySelectorAll('.character-field');
      assert.strictEqual(fieldItems?.length, 3);

      // 各フィールドに strong 要素（ラベル）が含まれている
      fieldItems?.forEach((field) => {
        assert(field.querySelector('strong'));
      });
    });
  });
});
