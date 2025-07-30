import '@testing-library/jest-dom';

import React from 'react';
import { render, screen, fireEvent } from '../../test-utils';
import { ReferenceSection } from './ReferenceSection';
import type { FileDetailsData } from '../../types/FileDetails';

describe('ReferenceSection コンポーネント', () => {
  let mockOnReferenceOpen: (reference: string) => void;
  let mockOnReferenceRemove: (reference: string) => void;
  let mockOnReverseReferenceRemove: (reference: string) => void;
  let openedReferences: string[];
  let removedReferences: string[];
  let removedReverseReferences: string[];

  beforeEach(() => {
    // 各テスト前にモック関数をリセット
    openedReferences = [];
    removedReferences = [];
    removedReverseReferences = [];

    mockOnReferenceOpen = (reference: string): void => {
      openedReferences.push(reference);
    };

    mockOnReferenceRemove = (reference: string): void => {
      removedReferences.push(reference);
    };

    mockOnReverseReferenceRemove = (reference: string): void => {
      removedReverseReferences.push(reference);
    };
  });

  describe('参照データが存在しない場合', () => {
    it('referenceDataがundefinedの場合は何も表示されない', () => {
      const fileDataWithoutRef: FileDetailsData = {
        type: 'content',
        referenceData: undefined,
      };

      const { container } = render(
        <ReferenceSection
          fileData={fileDataWithoutRef}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // コンポーネントが何も描画されない
      expect(container.firstChild).toBe(null);
    });

    it('referenceDataがnullの場合は何も表示されない', () => {
      const fileDataWithNullRef: FileDetailsData = {
        type: 'content',
        referenceData: null as unknown as undefined,
      };

      const { container } = render(
        <ReferenceSection
          fileData={fileDataWithNullRef}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(container.firstChild).toBe(null);
    });
  });

  describe('本文ファイル（content）の場合', () => {
    it('キャラクター参照のみがある場合', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['characters/hero.md'],
          references: [{ path: 'characters/hero.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.getByText('登場人物 (1)')).toBeInTheDocument();
      expect(screen.getByText('hero.md')).toBeInTheDocument();
      expect(screen.queryByText('関連設定')).toBeNull();
    });

    it('設定参照のみがある場合', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['settings/world.md'],
          references: [{ path: 'settings/world.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.queryByText('登場人物')).toBeNull();
      expect(screen.getByText('関連設定 (1)')).toBeInTheDocument();
      expect(screen.getByText('world.md')).toBeInTheDocument();
    });

    it('キャラクターと設定両方の参照がある場合', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['characters/hero.md', 'settings/world.md'],
          references: [
            { path: 'characters/hero.md', source: 'manual' },
            { path: 'settings/world.md', source: 'hyperlink' },
          ],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.getByText('登場人物 (1)')).toBeInTheDocument();
      expect(screen.getByText('関連設定 (1)')).toBeInTheDocument();
      expect(screen.getByText('hero.md')).toBeInTheDocument();
      // ハイパーリンクアイコン付きのテキストを検索
      expect(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('world.md');
        }),
      ).toBeInTheDocument();
    });

    it('参照が空の場合は何も表示されない', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: [],
          references: [],
          referencedBy: [],
        },
      };

      const { container } = render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(container.firstChild).toBe(null);
    });

    it('展開・折りたたみ機能が正しく動作する（登場人物）', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['characters/hero.md'],
          references: [{ path: 'characters/hero.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // 初期状態では展開されている
      const initialContent = screen
        .getByText('登場人物 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(initialContent?.classList.contains('collapsed')).toBeFalsy();

      const header = screen.getByText('登場人物 (1)').closest('button');
      expect(header).toBeTruthy();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認
      const content = screen
        .getByText('登場人物 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });

    it('展開・折りたたみ機能が正しく動作する（関連設定）', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['settings/world.md'],
          references: [{ path: 'settings/world.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // 初期状態では展開されている
      const initialContent = screen
        .getByText('関連設定 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(initialContent?.classList.contains('collapsed')).toBeFalsy();

      const header = screen.getByText('関連設定 (1)').closest('button');
      expect(header).toBeTruthy();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認
      const content = screen
        .getByText('関連設定 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });
  });

  describe('その他ファイル（setting/subdirectory）の場合', () => {
    it('参照関係がある場合の基本表示', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [{ path: 'contents/chapter2.md', source: 'hyperlink' }],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.getByText('参照関係')).toBeInTheDocument();
      expect(screen.getByText('このファイルが参照:')).toBeInTheDocument();
      expect(screen.getByText('このファイルを参照:')).toBeInTheDocument();
      expect(screen.getByText('chapter1.md')).toBeInTheDocument();
      // ハイパーリンクアイコン付きのテキストを検索
      expect(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('chapter2.md');
        }),
      ).toBeInTheDocument();
    });

    it('参照関係がない場合', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: [],
          references: [],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.getByText('参照関係')).toBeInTheDocument();
      expect(screen.getByText('参照関係がありません')).toBeInTheDocument();
    });

    it('このファイルが参照のみの場合', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.getByText('このファイルが参照:')).toBeInTheDocument();
      expect(screen.queryByText('このファイルを参照:')).toBeNull();
      expect(screen.getByText('chapter1.md')).toBeInTheDocument();
    });

    it('このファイルを参照のみの場合', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: [],
          references: [],
          referencedBy: [{ path: 'contents/chapter1.md', source: 'hyperlink' }],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      expect(screen.queryByText('このファイルが参照:')).toBeNull();
      expect(screen.getByText('このファイルを参照:')).toBeInTheDocument();
      // ハイパーリンクアイコン付きのテキストを検索
      expect(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('chapter1.md');
        }),
      ).toBeInTheDocument();
    });

    it('展開・折りたたみ機能が正しく動作する', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const header = screen.getByText('参照関係').closest('button');
      expect(header).toBeTruthy();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認
      const content = screen
        .getByText('参照関係')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });
  });

  describe('ReferenceItem個別テスト', () => {
    it('手動参照アイテムの表示と削除ボタン', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const referenceLink = screen.getByText('chapter1.md');
      expect(referenceLink).toBeTruthy();
      expect(referenceLink.classList.contains('manual-ref')).toBeTruthy();

      // 削除ボタンが存在する（手動参照なので）
      const deleteButton = screen.getByTitle('手動参照を削除');
      expect(deleteButton).toBeTruthy();
    });

    it('ハイパーリンク参照アイテムの表示（削除ボタンなし）', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'hyperlink' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // hyperlink-ref クラスを持つ要素を検索
      const hyperlinkRef = screen.getByRole('button', { name: /chapter1.md/ });
      expect(hyperlinkRef).toBeTruthy();
      expect(hyperlinkRef.classList.contains('hyperlink-ref')).toBeTruthy();

      // 削除ボタンが存在しない（ハイパーリンク参照なので）
      expect(screen.queryByTitle('手動参照を削除')).toBeFalsy();
    });

    it('参照アイテムクリック時にonReferenceOpenが呼ばれる', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const referenceLink = screen.getByText('chapter1.md');
      fireEvent.click(referenceLink);

      expect(openedReferences.length).toBe(1);
      expect(openedReferences[0]).toBe('contents/chapter1.md');
    });

    it('Enterキーでも参照が開ける', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const referenceLink = screen.getByText('chapter1.md');
      fireEvent.keyDown(referenceLink, { key: 'Enter' });

      expect(openedReferences.length).toBe(1);
      expect(openedReferences[0]).toBe('contents/chapter1.md');
    });

    it('削除ボタンクリック時にonReferenceRemoveが呼ばれる', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const deleteButton = screen.getByTitle('手動参照を削除');
      fireEvent.click(deleteButton);

      expect(removedReferences.length).toBe(1);
      expect(removedReferences[0]).toBe('contents/chapter1.md');
    });

    it('逆参照の削除時にonReverseReferenceRemoveが呼ばれる', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: [],
          references: [],
          referencedBy: [{ path: 'contents/chapter1.md', source: 'manual' }],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const deleteButton = screen.getByTitle('手動参照を削除');
      fireEvent.click(deleteButton);

      expect(removedReverseReferences.length).toBe(1);
      expect(removedReverseReferences[0]).toBe('contents/chapter1.md');
    });

    it('ファイル名の抽出が正しく動作する', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['path/to/deep/file.md'],
          references: [{ path: 'path/to/deep/file.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // フルパスではなくファイル名のみが表示される
      expect(screen.getByText('file.md')).toBeInTheDocument();

      // title属性にはフルパスが設定される
      const referenceLink = screen.getByText('file.md');
      expect(referenceLink.getAttribute('title')).toBe('path/to/deep/file.md');
    });
  });

  describe('アクセシビリティ', () => {
    it('参照リンクが適切にマークアップされている', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const referenceLink = screen.getByText('chapter1.md');
      expect(referenceLink.getAttribute('role')).toBe('button');
      expect(referenceLink.getAttribute('tabIndex')).toBe('0');
      expect(referenceLink.getAttribute('title')).toBe('contents/chapter1.md');
    });

    it('削除ボタンが適切にマークアップされている', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: ['contents/chapter1.md'],
          references: [{ path: 'contents/chapter1.md', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      const deleteButton = screen.getByTitle('手動参照を削除');
      expect(deleteButton.tagName).toBe('BUTTON');
      expect(deleteButton.getAttribute('type')).toBe('button');
      expect(deleteButton.getAttribute('title')).toBe('手動参照を削除');
    });
  });

  describe('エッジケース', () => {
    it('キャラクター判定が正しく機能する', () => {
      const contentFileData: FileDetailsData = {
        type: 'content',
        referenceData: {
          allReferences: ['characters/hero.md', 'settings/world.md'],
          references: [
            { path: 'characters/hero.md', source: 'manual' },
            { path: 'settings/world.md', source: 'manual' },
          ],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={contentFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // characterを含むパスは登場人物に分類
      expect(screen.getByText('登場人物 (1)')).toBeInTheDocument();
      // それ以外は関連設定に分類
      expect(screen.getByText('関連設定 (1)')).toBeInTheDocument();
    });

    it('参照パスが空文字の場合も正常に処理される', () => {
      const settingFileData: FileDetailsData = {
        type: 'setting',
        referenceData: {
          allReferences: [''],
          references: [{ path: '', source: 'manual' }],
          referencedBy: [],
        },
      };

      render(
        <ReferenceSection
          fileData={settingFileData}
          onReferenceOpen={mockOnReferenceOpen}
          onReferenceRemove={mockOnReferenceRemove}
          onReverseReferenceRemove={mockOnReverseReferenceRemove}
        />,
      );

      // 空文字の場合もファイル名として扱われる（split('/').pop()の結果）
      // 複数の空要素がある可能性があるため、getAllByTextを使用
      const referenceLinks = screen.getAllByText('');
      expect(referenceLinks.length > 0).toBeTruthy();
      // 少なくとも1つのrole="button"要素があることを確認
      const buttonLinks = referenceLinks.filter((link) => link.getAttribute('role') === 'button');
      expect(buttonLinks.length > 0).toBeTruthy();
    });
  });
});
