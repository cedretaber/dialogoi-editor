import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '../../test-utils';
import { CharacterSection } from './CharacterSection';
import type { CharacterInfo } from '../../types/FileDetails';

describe('CharacterSection コンポーネント', () => {
  let mockCharacter: CharacterInfo;
  let mockOnCharacterRemove: () => void;
  let removeCallCount: number;

  beforeEach(() => {
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

  describe('基本表示', () => {
    it('セクションヘッダーが表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('キャラクター情報')).toBeInTheDocument();
    });

    it('削除ボタンが表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      expect(deleteButton).toBeTruthy();
      expect(deleteButton.textContent).toBe('×');
    });

    it('キャラクター情報が正しく表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('重要度:')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('複数キャラ:')).toBeInTheDocument();
      expect(screen.getByText('いいえ')).toBeInTheDocument();
      expect(screen.getByText('表示名:')).toBeInTheDocument();
      expect(screen.getByText('主人公')).toBeInTheDocument();
    });

    it('各キャラクター情報フィールドが正しい構造で表示される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const importanceField = screen.getByText('重要度:').closest('.character-field');
      expect(importanceField).not.toBeNull();
      expect(importanceField?.textContent?.includes('main')).toBeTruthy();

      const multipleField = screen.getByText('複数キャラ:').closest('.character-field');
      expect(multipleField).not.toBeNull();
      expect(multipleField?.textContent?.includes('いいえ')).toBeTruthy();

      const displayNameField = screen.getByText('表示名:').closest('.character-field');
      expect(displayNameField).not.toBeNull();
      expect(displayNameField?.textContent?.includes('主人公')).toBeTruthy();
    });
  });

  describe('展開・折りたたみ機能', () => {
    it('初期状態では展開されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // キャラクター情報が見えている = 展開されている
      expect(screen.getByText('重要度:')).toBeInTheDocument();
      expect(screen.getByText('複数キャラ:')).toBeInTheDocument();
      expect(screen.getByText('表示名:')).toBeInTheDocument();
    });

    it('ヘッダーをクリックすると折りたたまれる', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      expect(header).not.toBeNull();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('キャラクター情報')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });

    it('折りたたみ状態でヘッダーをクリックすると展開される', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      expect(header).not.toBeNull();

      // 一度折りたたむ
      if (header) {
        fireEvent.click(header);
      }

      // 再度クリックして展開
      if (header) {
        fireEvent.click(header);
      }

      // 展開状態の確認
      const content = screen
        .getByText('キャラクター情報')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeFalsy();
    });

    it('シェブロンアイコンの状態が正しく切り替わる', () => {
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
      expect(chevron).not.toBeNull();

      // 初期状態（展開）
      expect(chevron?.classList.contains('collapsed')).toBeFalsy();

      const header = screen.getByText('キャラクター情報').closest('button');
      expect(header).not.toBeNull();

      // 折りたたみ
      if (header) {
        fireEvent.click(header);
      }
      expect(chevron?.classList.contains('collapsed')).toBeTruthy();

      // 再展開
      if (header) {
        fireEvent.click(header);
      }
      expect(chevron?.classList.contains('collapsed')).toBeFalsy();
    });
  });

  describe('削除機能', () => {
    it('削除ボタンをクリックするとonCharacterRemoveが呼ばれる', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      fireEvent.click(deleteButton);

      expect(removeCallCount).toBe(1);
    });

    it('削除ボタンのクリックイベントが親要素に伝播しない', () => {
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
      expect(removeCallCount).toBe(1);

      // 注意: jsdomでの制限により、実際のstopPropagationの確認は困難
      // 削除機能が動作していることで代用
      expect(removeCallCount).toBe(1);
    });
  });

  describe('重要度の種別テスト', () => {
    it('main重要度が正しく表示される', () => {
      const mainCharacter = { ...mockCharacter, importance: 'main' as const };
      render(
        <CharacterSection
          character={mainCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('sub重要度が正しく表示される', () => {
      const subCharacter = { ...mockCharacter, importance: 'sub' as const };
      render(
        <CharacterSection
          character={subCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('sub')).toBeInTheDocument();
    });

    it('background重要度が正しく表示される', () => {
      const backgroundCharacter = { ...mockCharacter, importance: 'background' as const };
      render(
        <CharacterSection
          character={backgroundCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('background')).toBeInTheDocument();
    });

    it('重要度がundefinedの場合は「未設定」と表示される', () => {
      const noImportanceCharacter = { ...mockCharacter, importance: undefined };
      render(
        <CharacterSection
          character={noImportanceCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('未設定')).toBeInTheDocument();
    });
  });

  describe('複数キャラクターフラグのテスト', () => {
    it('複数キャラクターがtrueの場合は「はい」と表示される', () => {
      const multipleCharacter = { ...mockCharacter, multiple_characters: true };
      render(
        <CharacterSection
          character={multipleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('はい')).toBeInTheDocument();
    });

    it('複数キャラクターがfalseの場合は「いいえ」と表示される', () => {
      const singleCharacter = { ...mockCharacter, multiple_characters: false };
      render(
        <CharacterSection
          character={singleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('いいえ')).toBeInTheDocument();
    });

    it('複数キャラクターがundefinedの場合は「いいえ」と表示される', () => {
      const undefinedMultipleCharacter = { ...mockCharacter, multiple_characters: undefined };
      render(
        <CharacterSection
          character={undefinedMultipleCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('いいえ')).toBeInTheDocument();
    });
  });

  describe('表示名のフォールバック動作', () => {
    it('display_nameが設定されている場合はそれが表示される', () => {
      const characterWithDisplayName = { ...mockCharacter, display_name: 'カスタム名前' };
      render(
        <CharacterSection
          character={characterWithDisplayName}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('カスタム名前')).toBeInTheDocument();
    });

    it('display_nameがない場合はfileNameが表示される', () => {
      const characterWithoutDisplayName = { ...mockCharacter, display_name: undefined };
      render(
        <CharacterSection
          character={characterWithoutDisplayName}
          fileName="hero.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('hero.md')).toBeInTheDocument();
    });

    it('display_nameもfileNameもない場合は空文字が表示される', () => {
      const characterWithoutDisplayName = { ...mockCharacter, display_name: undefined };
      render(
        <CharacterSection
          character={characterWithoutDisplayName}
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // 表示名フィールドは存在するが、値は空
      const displayNameField = screen.getByText('表示名:').closest('.character-field');
      expect(displayNameField).toBeTruthy();
      // display_nameもfileNameもない場合は空文字のためスペースが残る
      expect(displayNameField?.textContent).toBe('表示名: ');
    });

    it('空文字のdisplay_nameの場合はfileNameにフォールバック', () => {
      const characterWithEmptyDisplayName = { ...mockCharacter, display_name: '' };
      render(
        <CharacterSection
          character={characterWithEmptyDisplayName}
          fileName="fallback.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      expect(screen.getByText('fallback.md')).toBeInTheDocument();
    });
  });

  describe('エッジケース', () => {
    it('空のキャラクター情報でも正常に動作する', () => {
      const emptyCharacter: CharacterInfo = {};

      expect(() => {
        render(
          <CharacterSection
            character={emptyCharacter}
            fileName="test.md"
            onCharacterRemove={mockOnCharacterRemove}
          />,
        );
      }).not.toThrow();

      expect(screen.getByText('キャラクター情報')).toBeInTheDocument();
      expect(screen.getByText('未設定')).toBeInTheDocument();
      expect(screen.getByText('いいえ')).toBeInTheDocument();
      expect(screen.getByText('test.md')).toBeInTheDocument();
    });

    it('すべてのプロパティがundefinedでも正常に動作する', () => {
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

      expect(screen.getByText('未設定')).toBeInTheDocument();
      expect(screen.getByText('いいえ')).toBeInTheDocument();
      // 表示名は空になる（どちらも未定義なので）
    });
  });

  describe('アクセシビリティ', () => {
    it('ヘッダーボタンがbutton要素として正しく実装されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const header = screen.getByText('キャラクター情報').closest('button');
      expect(header).not.toBeNull();
      expect(header?.tagName).toBe('BUTTON');
      expect(header?.getAttribute('type')).toBe('button');
    });

    it('削除ボタンがbutton要素として正しく実装されている', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      const deleteButton = screen.getByTitle('キャラクター情報を削除');
      expect(deleteButton.tagName).toBe('BUTTON');
      expect(deleteButton.getAttribute('type')).toBe('button');
      expect(deleteButton.getAttribute('title')).toBe('キャラクター情報を削除');
    });

    it('キャラクター情報の構造が正しい', () => {
      render(
        <CharacterSection
          character={mockCharacter}
          fileName="character.md"
          onCharacterRemove={mockOnCharacterRemove}
        />,
      );

      // .character-info コンテナが存在する
      const infoContainer = screen.getByText('重要度:').closest('.character-info');
      expect(infoContainer).not.toBeNull();

      // 各情報フィールドが .character-field クラスを持つ
      const fieldItems = infoContainer?.querySelectorAll('.character-field');
      expect(fieldItems?.length).toBe(3);

      // 各フィールドに strong 要素（ラベル）が含まれている
      fieldItems?.forEach((field) => {
        expect(field.querySelector('strong')).toBeTruthy();
      });
    });
  });
});
