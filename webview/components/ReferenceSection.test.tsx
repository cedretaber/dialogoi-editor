import React from 'react';
import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent } from '../test-utils';
import { ReferenceSection } from './ReferenceSection';
import assert from 'assert';
import type { FileDetailsData } from '../types/FileDetails';

suite('ReferenceSection コンポーネント', () => {
  let mockOnReferenceOpen: (reference: string) => void;
  let mockOnReferenceRemove: (reference: string) => void;
  let mockOnReverseReferenceRemove: (reference: string) => void;
  let openedReferences: string[];
  let removedReferences: string[];
  let removedReverseReferences: string[];

  setup(() => {
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

  suite('参照データが存在しない場合', () => {
    test('referenceDataがundefinedの場合は何も表示されない', () => {
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
      assert.strictEqual(container.firstChild, null);
    });

    test('referenceDataがnullの場合は何も表示されない', () => {
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

      assert.strictEqual(container.firstChild, null);
    });
  });

  suite('本文ファイル（content）の場合', () => {
    test('キャラクター参照のみがある場合', () => {
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

      assert(screen.getByText('登場人物 (1)'));
      assert(screen.getByText('hero.md'));
      assert(!screen.queryByText('関連設定'));
    });

    test('設定参照のみがある場合', () => {
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

      assert(!screen.queryByText('登場人物'));
      assert(screen.getByText('関連設定 (1)'));
      assert(screen.getByText('world.md'));
    });

    test('キャラクターと設定両方の参照がある場合', () => {
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

      assert(screen.getByText('登場人物 (1)'));
      assert(screen.getByText('関連設定 (1)'));
      assert(screen.getByText('hero.md'));
      // ハイパーリンクアイコン付きのテキストを検索
      assert(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('world.md');
        }),
      );
    });

    test('参照が空の場合は何も表示されない', () => {
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

      assert.strictEqual(container.firstChild, null);
    });

    test('展開・折りたたみ機能が正しく動作する（登場人物）', () => {
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
      assert(!initialContent?.classList.contains('collapsed'));

      const header = screen.getByText('登場人物 (1)').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認
      const content = screen
        .getByText('登場人物 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });

    test('展開・折りたたみ機能が正しく動作する（関連設定）', () => {
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
      assert(!initialContent?.classList.contains('collapsed'));

      const header = screen.getByText('関連設定 (1)').closest('button');
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認
      const content = screen
        .getByText('関連設定 (1)')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });
  });

  suite('その他ファイル（setting/subdirectory）の場合', () => {
    test('参照関係がある場合の基本表示', () => {
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

      assert(screen.getByText('参照関係'));
      assert(screen.getByText('このファイルが参照:'));
      assert(screen.getByText('このファイルを参照:'));
      assert(screen.getByText('chapter1.md'));
      // ハイパーリンクアイコン付きのテキストを検索
      assert(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('chapter2.md');
        }),
      );
    });

    test('参照関係がない場合', () => {
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

      assert(screen.getByText('参照関係'));
      assert(screen.getByText('参照関係がありません'));
    });

    test('このファイルが参照のみの場合', () => {
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

      assert(screen.getByText('このファイルが参照:'));
      assert(!screen.queryByText('このファイルを参照:'));
      assert(screen.getByText('chapter1.md'));
    });

    test('このファイルを参照のみの場合', () => {
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

      assert(!screen.queryByText('このファイルが参照:'));
      assert(screen.getByText('このファイルを参照:'));
      // ハイパーリンクアイコン付きのテキストを検索
      assert(
        screen.getByText((content, element) => {
          return element?.tagName.toLowerCase() === 'a' && content.includes('chapter1.md');
        }),
      );
    });

    test('展開・折りたたみ機能が正しく動作する', () => {
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
      assert(header);

      fireEvent.click(header);

      // 折りたたみ状態の確認
      const content = screen
        .getByText('参照関係')
        .closest('.section')
        ?.querySelector('.section-content');
      assert(content?.classList.contains('collapsed'));
    });
  });

  suite('ReferenceItem個別テスト', () => {
    test('手動参照アイテムの表示と削除ボタン', () => {
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
      assert(referenceLink);
      assert(referenceLink.classList.contains('manual-ref'));

      // 削除ボタンが存在する（手動参照なので）
      const deleteButton = screen.getByTitle('手動参照を削除');
      assert(deleteButton);
    });

    test('ハイパーリンク参照アイテムの表示（削除ボタンなし）', () => {
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
      assert(hyperlinkRef);
      assert(hyperlinkRef.classList.contains('hyperlink-ref'));

      // 削除ボタンが存在しない（ハイパーリンク参照なので）
      assert(!screen.queryByTitle('手動参照を削除'));
    });

    test('参照アイテムクリック時にonReferenceOpenが呼ばれる', () => {
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

      assert.strictEqual(openedReferences.length, 1);
      assert.strictEqual(openedReferences[0], 'contents/chapter1.md');
    });

    test('Enterキーでも参照が開ける', () => {
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

      assert.strictEqual(openedReferences.length, 1);
      assert.strictEqual(openedReferences[0], 'contents/chapter1.md');
    });

    test('削除ボタンクリック時にonReferenceRemoveが呼ばれる', () => {
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

      assert.strictEqual(removedReferences.length, 1);
      assert.strictEqual(removedReferences[0], 'contents/chapter1.md');
    });

    test('逆参照の削除時にonReverseReferenceRemoveが呼ばれる', () => {
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

      assert.strictEqual(removedReverseReferences.length, 1);
      assert.strictEqual(removedReverseReferences[0], 'contents/chapter1.md');
    });

    test('ファイル名の抽出が正しく動作する', () => {
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
      assert(screen.getByText('file.md'));

      // title属性にはフルパスが設定される
      const referenceLink = screen.getByText('file.md');
      assert.strictEqual(referenceLink.getAttribute('title'), 'path/to/deep/file.md');
    });
  });

  suite('アクセシビリティ', () => {
    test('参照リンクが適切にマークアップされている', () => {
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
      assert.strictEqual(referenceLink.getAttribute('role'), 'button');
      assert.strictEqual(referenceLink.getAttribute('tabIndex'), '0');
      assert.strictEqual(referenceLink.getAttribute('title'), 'contents/chapter1.md');
    });

    test('削除ボタンが適切にマークアップされている', () => {
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
      assert.strictEqual(deleteButton.tagName, 'BUTTON');
      assert.strictEqual(deleteButton.getAttribute('type'), 'button');
      assert.strictEqual(deleteButton.getAttribute('title'), '手動参照を削除');
    });
  });

  suite('エッジケース', () => {
    test('キャラクター判定が正しく機能する', () => {
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
      assert(screen.getByText('登場人物 (1)'));
      // それ以外は関連設定に分類
      assert(screen.getByText('関連設定 (1)'));
    });

    test('参照パスが空文字の場合も正常に処理される', () => {
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
      assert(referenceLinks.length > 0, '空文字のリンクが見つからない');
      // 少なくとも1つのrole="button"要素があることを確認
      const buttonLinks = referenceLinks.filter((link) => link.getAttribute('role') === 'button');
      assert(buttonLinks.length > 0, 'role="button"を持つ空文字のリンクが見つからない');
    });
  });
});
