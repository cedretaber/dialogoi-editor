import React from 'react';
import { suite, test, setup } from 'mocha';
import { render, screen, fireEvent } from '../test-utils';
import { ForeshadowingSection } from './ForeshadowingSection';
import assert from 'assert';
import type { ForeshadowingData, ForeshadowingPoint } from '../types/FileDetails';

suite('ForeshadowingSection コンポーネント', () => {
  let mockOnPlantAdd: (plant: ForeshadowingPoint) => void;
  let mockOnPlantRemove: (index: number) => void;
  let mockOnPlantUpdate: (index: number, plant: ForeshadowingPoint) => void;
  let mockOnPayoffSet: (payoff: ForeshadowingPoint) => void;
  let mockOnPayoffRemove: () => void;

  // 呼び出し履歴を記録するための変数
  let addedPlants: ForeshadowingPoint[];
  let removedPlantIndices: number[];
  let updatedPlants: { index: number; plant: ForeshadowingPoint }[];
  let setPayoffs: ForeshadowingPoint[];
  let payoffRemoveCount: number;

  setup(() => {
    // 各テスト前にモック関数と履歴をリセット
    addedPlants = [];
    removedPlantIndices = [];
    updatedPlants = [];
    setPayoffs = [];
    payoffRemoveCount = 0;

    mockOnPlantAdd = (plant: ForeshadowingPoint): void => {
      addedPlants.push(plant);
    };

    mockOnPlantRemove = (index: number): void => {
      removedPlantIndices.push(index);
    };

    mockOnPlantUpdate = (index: number, plant: ForeshadowingPoint): void => {
      updatedPlants.push({ index, plant });
    };

    mockOnPayoffSet = (payoff: ForeshadowingPoint): void => {
      setPayoffs.push(payoff);
    };

    mockOnPayoffRemove = (): void => {
      payoffRemoveCount++;
    };
  });

  suite('基本表示', () => {
    test('セクションヘッダーが正しく表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('🔮 伏線管理'));
    });

    test('植込み位置セクションが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('📍 伏線設置 (0件)'));
    });

    test('回収位置セクションが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('🎯 伏線回収 (未設定)'));
    });

    test('初期状態では追加ボタンが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('+ 位置を追加'));
      assert(screen.getByText('+ 回収位置を設定'));
    });
  });

  suite('植込み位置の表示', () => {
    test('植込み位置がある場合は件数が表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [
          { location: 'chapter1.txt', comment: 'テスト伏線1' },
          { location: 'chapter2.txt', comment: 'テスト伏線2' },
        ],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('📍 伏線設置 (2件)'));
    });

    test('植込み位置の詳細が表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: 'テスト伏線の説明' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('chapter1.txt'));
      assert(screen.getByText('テスト伏線の説明'));
    });

    test('植込み位置の編集・削除ボタンが表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: 'テスト伏線' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButtons = screen.getAllByText('編集');
      const deleteButtons = screen.getAllByText('削除');

      // 植込み位置の編集・削除ボタン
      assert(editButtons.length >= 1);
      assert(deleteButtons.length >= 1);
    });
  });

  suite('回収位置の表示', () => {
    test('回収位置が設定されている場合は「設定済み」と表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: '伏線の回収' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('🎯 伏線回収 (設定済み)'));
    });

    test('回収位置の詳細が表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: '伏線の回収説明' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('chapter5.txt'));
      assert(screen.getByText('伏線の回収説明'));
    });

    test('回収位置の編集・削除ボタンが表示される', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: '伏線の回収' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButtons = screen.getAllByText('編集');
      const deleteButtons = screen.getAllByText('削除');

      // 回収位置の編集・削除ボタン
      assert(editButtons.length >= 1);
      assert(deleteButtons.length >= 1);
    });

    test('回収位置が未設定の場合は設定ボタンが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('+ 回収位置を設定'));
    });
  });

  suite('展開・折りたたみ機能', () => {
    test('植込み位置セクションの展開・折りたたみ', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: 'テスト' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const plantsHeader = screen.getByText('📍 伏線設置 (1件)').closest('.subsection-header');
      assert(plantsHeader);

      // 初期状態では展開されている（▼アイコン）
      const initialIcon = plantsHeader.querySelector('.collapse-icon');
      assert(initialIcon);
      assert.strictEqual(initialIcon.textContent, '▼');

      fireEvent.click(plantsHeader);

      // 折りたたまれた状態（▶アイコン）
      const collapsedIcon = plantsHeader.querySelector('.collapse-icon');
      assert(collapsedIcon);
      assert.strictEqual(collapsedIcon.textContent, '▶');
    });

    test('回収位置セクションの展開・折りたたみ', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: 'テスト回収' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const payoffHeader = screen.getByText('🎯 伏線回収 (設定済み)').closest('.subsection-header');
      assert(payoffHeader);

      // 初期状態では展開されている（▼アイコン）
      const initialIcon = payoffHeader.querySelector('.collapse-icon');
      assert(initialIcon);
      assert.strictEqual(initialIcon.textContent, '▼');

      fireEvent.click(payoffHeader);

      // 折りたたまれた状態（▶アイコン）
      const collapsedIcon = payoffHeader.querySelector('.collapse-icon');
      assert(collapsedIcon);
      assert.strictEqual(collapsedIcon.textContent, '▶');
    });
  });

  suite('植込み位置の追加', () => {
    test('追加ボタンをクリックするとフォームが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      assert(screen.getByPlaceholderText('例: contents/chapter1.txt'));
      assert(screen.getByPlaceholderText('伏線の内容や目的を説明'));
      assert(screen.getByText('追加'));
      assert(screen.getByText('キャンセル'));
    });

    test('正常なデータで植込み位置を追加する', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      const commentTextarea = screen.getByPlaceholderText('伏線の内容や目的を説明');

      fireEvent.change(locationInput, { target: { value: 'chapter1.txt' } });
      fireEvent.change(commentTextarea, { target: { value: 'テスト伏線' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert.strictEqual(addedPlants.length, 1);
      assert.strictEqual(addedPlants[0].location, 'chapter1.txt');
      assert.strictEqual(addedPlants[0].comment, 'テスト伏線');
    });

    test('位置が空の場合は追加できない', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert.strictEqual(addedPlants.length, 0);
    });

    test('コメントが空でも位置があれば追加できる', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      fireEvent.change(locationInput, { target: { value: 'chapter1.txt' } });
      // コメントは入力しない

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert.strictEqual(addedPlants.length, 1);
      assert.strictEqual(addedPlants[0].location, 'chapter1.txt');
      assert.strictEqual(addedPlants[0].comment, '');
    });

    test('キャンセルボタンでフォームを閉じる', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      fireEvent.change(locationInput, { target: { value: 'test' } });

      const cancelButton = screen.getByText('キャンセル');
      fireEvent.click(cancelButton);

      // フォームが閉じられ、追加ボタンが再表示される
      assert(screen.getByText('+ 位置を追加'));
      assert(!screen.queryByPlaceholderText('例: contents/chapter1.txt'));
    });
  });

  suite('植込み位置の編集・削除', () => {
    test('編集ボタンでフォームが開く', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: '既存の伏線' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButton = screen.getAllByText('編集')[0]; // 植込み位置の編集ボタン
      fireEvent.click(editButton);

      // フォームが開き、既存データが入力されている
      const locationInput = screen.getByDisplayValue('chapter1.txt');
      const commentTextarea = screen.getByDisplayValue('既存の伏線');
      assert(locationInput);
      assert(commentTextarea);
      assert(screen.getByText('更新'));
    });

    test('植込み位置を正常に更新する', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: '既存の伏線' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButton = screen.getAllByText('編集')[0];
      fireEvent.click(editButton);

      const locationInput = screen.getByDisplayValue('chapter1.txt');
      const commentTextarea = screen.getByDisplayValue('既存の伏線');

      fireEvent.change(locationInput, { target: { value: 'chapter2.txt' } });
      fireEvent.change(commentTextarea, { target: { value: '更新された伏線' } });

      const updateButton = screen.getByText('更新');
      fireEvent.click(updateButton);

      assert.strictEqual(updatedPlants.length, 1);
      assert.strictEqual(updatedPlants[0].index, 0);
      assert.strictEqual(updatedPlants[0].plant.location, 'chapter2.txt');
      assert.strictEqual(updatedPlants[0].plant.comment, '更新された伏線');
    });

    test('削除ボタンで植込み位置を削除する', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: '削除対象の伏線' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const deleteButton = screen.getAllByText('削除')[0]; // 植込み位置の削除ボタン
      fireEvent.click(deleteButton);

      assert.strictEqual(removedPlantIndices.length, 1);
      assert.strictEqual(removedPlantIndices[0], 0);
    });
  });

  suite('回収位置の設定・編集・削除', () => {
    test('回収位置設定ボタンでフォームが開く', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      assert(screen.getByPlaceholderText('例: contents/chapter5.txt'));
      assert(screen.getByPlaceholderText('伏線の回収方法や結果を説明'));
      assert(screen.getByText('設定'));
      assert(screen.getByText('キャンセル'));
    });

    test('正常なデータで回収位置を設定する', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter5.txt');
      const commentTextarea = screen.getByPlaceholderText('伏線の回収方法や結果を説明');

      fireEvent.change(locationInput, { target: { value: 'chapter5.txt' } });
      fireEvent.change(commentTextarea, { target: { value: '伏線の回収' } });

      const submitButton = screen.getByText('設定');
      fireEvent.click(submitButton);

      assert.strictEqual(setPayoffs.length, 1);
      assert.strictEqual(setPayoffs[0].location, 'chapter5.txt');
      assert.strictEqual(setPayoffs[0].comment, '伏線の回収');
    });

    test('コメントが空でも位置があれば回収位置を設定できる', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter5.txt');
      fireEvent.change(locationInput, { target: { value: 'chapter5.txt' } });
      // コメントは入力しない

      const submitButton = screen.getByText('設定');
      fireEvent.click(submitButton);

      assert.strictEqual(setPayoffs.length, 1);
      assert.strictEqual(setPayoffs[0].location, 'chapter5.txt');
      assert.strictEqual(setPayoffs[0].comment, '');
    });

    test('回収位置の編集', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: '既存の回収' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButton = screen
        .getAllByText('編集')
        .find((button) => button.closest('.subsection')?.textContent?.includes('伏線回収'));
      assert(editButton);
      fireEvent.click(editButton);

      // フォームが開き、既存データが入力されている
      const locationInput = screen.getByDisplayValue('chapter5.txt');
      const commentTextarea = screen.getByDisplayValue('既存の回収');
      assert(locationInput);
      assert(commentTextarea);
    });

    test('回収位置の削除', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: 'chapter5.txt', comment: '削除対象の回収' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const deleteButton = screen
        .getAllByText('削除')
        .find((button) => button.closest('.subsection')?.textContent?.includes('伏線回収'));
      assert(deleteButton);
      fireEvent.click(deleteButton);

      assert.strictEqual(payoffRemoveCount, 1);
    });
  });

  suite('エッジケース', () => {
    test('foreshadowingがundefinedの場合も正常に動作する', () => {
      render(
        <ForeshadowingSection
          foreshadowing={undefined}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('📍 伏線設置 (0件)'));
      assert(screen.getByText('🎯 伏線回収 (未設定)'));
    });

    test('plants配列が空の場合', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('📍 伏線設置 (0件)'));
      assert(screen.getByText('+ 位置を追加'));
    });

    test('payoffのlocationが空文字の場合は未設定として扱われる', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: '', comment: 'コメントあり' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('🎯 伏線回収 (未設定)'));
      assert(screen.getByText('+ 回収位置を設定'));
    });

    test('payoffのlocationが空白のみの場合は未設定として扱われる', () => {
      const foreshadowingData: ForeshadowingData = {
        payoff: { location: '   ', comment: 'コメントあり' },
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      assert(screen.getByText('🎯 伏線回収 (未設定)'));
    });

    test('植込み位置の追加で位置が空白のみの場合は追加されない', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      fireEvent.change(locationInput, { target: { value: '   ' } });
      // コメントは入力済みでも位置が空白なら追加されない

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      assert.strictEqual(addedPlants.length, 0);
    });

    test('回収位置の設定で位置が空白のみの場合は設定されない', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter5.txt');
      fireEvent.change(locationInput, { target: { value: '   ' } });
      // コメントは入力済みでも位置が空白なら設定されない

      const submitButton = screen.getByText('設定');
      fireEvent.click(submitButton);

      assert.strictEqual(setPayoffs.length, 0);
    });
  });

  suite('フォーム状態管理', () => {
    test('植込み位置追加後にフォーム状態がリセットされる', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const addButton = screen.getByText('+ 位置を追加');
      fireEvent.click(addButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter1.txt');
      const commentTextarea = screen.getByPlaceholderText('伏線の内容や目的を説明');

      fireEvent.change(locationInput, { target: { value: 'chapter1.txt' } });
      fireEvent.change(commentTextarea, { target: { value: 'テスト伏線' } });

      const submitButton = screen.getByText('追加');
      fireEvent.click(submitButton);

      // フォームが閉じられ、追加ボタンが再表示される
      assert(screen.getByText('+ 位置を追加'));
      assert(!screen.queryByDisplayValue('chapter1.txt'));
    });

    test('回収位置設定後にフォーム状態がリセットされる', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const setButton = screen.getByText('+ 回収位置を設定');
      fireEvent.click(setButton);

      const locationInput = screen.getByPlaceholderText('例: contents/chapter5.txt');
      const commentTextarea = screen.getByPlaceholderText('伏線の回収方法や結果を説明');

      fireEvent.change(locationInput, { target: { value: 'chapter5.txt' } });
      fireEvent.change(commentTextarea, { target: { value: '伏線の回収' } });

      const submitButton = screen.getByText('設定');
      fireEvent.click(submitButton);

      // フォームが閉じられる
      assert(!screen.queryByDisplayValue('chapter5.txt'));
      assert(!screen.queryByPlaceholderText('例: contents/chapter5.txt'));
    });

    test('植込み位置更新後にフォーム状態がリセットされる', () => {
      const foreshadowingData: ForeshadowingData = {
        plants: [{ location: 'chapter1.txt', comment: '既存の伏線' }],
      };

      render(
        <ForeshadowingSection
          foreshadowing={foreshadowingData}
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      const editButton = screen.getAllByText('編集')[0];
      fireEvent.click(editButton);

      const updateButton = screen.getByText('更新');
      fireEvent.click(updateButton);

      // フォームが閉じられ、追加ボタンが再表示される
      assert(screen.getByText('+ 位置を追加'));
    });
  });
});
