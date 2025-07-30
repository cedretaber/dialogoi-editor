import '@testing-library/jest-dom';

import React from 'react';
import { render, screen, fireEvent } from '../../test-utils';
import { ForeshadowingSection } from './ForeshadowingSection';
import type { ForeshadowingData, ForeshadowingPoint } from '../../types/FileDetails';

describe('ForeshadowingSection コンポーネント', () => {
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

  beforeEach(() => {
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

  describe('基本表示', () => {
    it('セクションヘッダーが正しく表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      expect(screen.getByText('🔮 伏線管理')).toBeInTheDocument();
    });

    it('植込み位置セクションが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      expect(screen.getByText('📍 伏線設置 (0件)')).toBeInTheDocument();
    });

    it('回収位置セクションが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      expect(screen.getByText('🎯 伏線回収 (未設定)')).toBeInTheDocument();
    });

    it('初期状態では追加ボタンが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      expect(screen.getByText('+ 位置を追加')).toBeInTheDocument();
      expect(screen.getByText('+ 回収位置を設定')).toBeInTheDocument();
    });
  });

  describe('植込み位置の表示', () => {
    it('植込み位置がある場合は件数が表示される', () => {
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

      expect(screen.getByText('📍 伏線設置 (2件)')).toBeInTheDocument();
    });

    it('植込み位置の詳細が表示される', () => {
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

      expect(screen.getByText('chapter1.txt')).toBeInTheDocument();
      expect(screen.getByText('テスト伏線の説明')).toBeInTheDocument();
    });

    it('植込み位置の編集・削除ボタンが表示される', () => {
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
      expect(editButtons.length >= 1).toBeTruthy();
      expect(deleteButtons.length >= 1).toBeTruthy();
    });
  });

  describe('回収位置の表示', () => {
    it('回収位置が設定されている場合は「設定済み」と表示される', () => {
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

      expect(screen.getByText('🎯 伏線回収 (設定済み)')).toBeInTheDocument();
    });

    it('回収位置の詳細が表示される', () => {
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

      expect(screen.getByText('chapter5.txt')).toBeInTheDocument();
      expect(screen.getByText('伏線の回収説明')).toBeInTheDocument();
    });

    it('回収位置の編集・削除ボタンが表示される', () => {
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
      expect(editButtons.length >= 1).toBeTruthy();
      expect(deleteButtons.length >= 1).toBeTruthy();
    });

    it('回収位置が未設定の場合は設定ボタンが表示される', () => {
      render(
        <ForeshadowingSection
          onPlantAdd={mockOnPlantAdd}
          onPlantRemove={mockOnPlantRemove}
          onPlantUpdate={mockOnPlantUpdate}
          onPayoffSet={mockOnPayoffSet}
          onPayoffRemove={mockOnPayoffRemove}
        />,
      );

      expect(screen.getByText('+ 回収位置を設定')).toBeInTheDocument();
    });
  });

  describe('展開・折りたたみ機能', () => {
    it('植込み位置セクションの展開・折りたたみ', () => {
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
      expect(plantsHeader).not.toBeNull();

      // 初期状態では展開されている（▼アイコン）
      const initialIcon = plantsHeader?.querySelector('.collapse-icon');
      expect(initialIcon).not.toBeNull();
      expect(initialIcon?.textContent).toBe('▼');

      if (plantsHeader) {
        fireEvent.click(plantsHeader);
      }

      // 折りたたまれた状態（▶アイコン）
      const collapsedIcon = plantsHeader?.querySelector('.collapse-icon');
      expect(collapsedIcon).not.toBeNull();
      expect(collapsedIcon?.textContent).toBe('▶');
    });

    it('回収位置セクションの展開・折りたたみ', () => {
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
      expect(payoffHeader).not.toBeNull();

      // 初期状態では展開されている（▼アイコン）
      const initialIcon = payoffHeader?.querySelector('.collapse-icon');
      expect(initialIcon).not.toBeNull();
      expect(initialIcon?.textContent).toBe('▼');

      if (payoffHeader) {
        fireEvent.click(payoffHeader);
      }

      // 折りたたまれた状態（▶アイコン）
      const collapsedIcon = payoffHeader?.querySelector('.collapse-icon');
      expect(collapsedIcon).not.toBeNull();
      expect(collapsedIcon?.textContent).toBe('▶');
    });
  });

  describe('植込み位置の追加', () => {
    it('追加ボタンをクリックするとフォームが表示される', () => {
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

      expect(screen.getByPlaceholderText('例: contents/chapter1.txt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('伏線の内容や目的を説明')).toBeInTheDocument();
      expect(screen.getByText('追加')).toBeInTheDocument();
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    it('正常なデータで植込み位置を追加する', () => {
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

      expect(addedPlants).toHaveLength(1);
      expect(addedPlants[0].location).toBe('chapter1.txt');
      expect(addedPlants[0].comment).toBe('テスト伏線');
    });

    it('位置が空の場合は追加できない', () => {
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

      expect(addedPlants).toHaveLength(0);
    });

    it('コメントが空でも位置があれば追加できる', () => {
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

      expect(addedPlants).toHaveLength(1);
      expect(addedPlants[0].location).toBe('chapter1.txt');
      expect(addedPlants[0].comment).toBe('');
    });

    it('キャンセルボタンでフォームを閉じる', () => {
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
      expect(screen.getByText('+ 位置を追加')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('例: contents/chapter1.txt')).toBeNull();
    });
  });

  describe('植込み位置の編集・削除', () => {
    it('編集ボタンでフォームが開く', () => {
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
      expect(locationInput).toBeInTheDocument();
      expect(commentTextarea).toBeInTheDocument();
      expect(screen.getByText('更新')).toBeInTheDocument();
    });

    it('植込み位置を正常に更新する', () => {
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

      expect(updatedPlants).toHaveLength(1);
      expect(updatedPlants[0].index).toBe(0);
      expect(updatedPlants[0].plant.location).toBe('chapter2.txt');
      expect(updatedPlants[0].plant.comment).toBe('更新された伏線');
    });

    it('削除ボタンで植込み位置を削除する', () => {
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

      expect(removedPlantIndices).toHaveLength(1);
      expect(removedPlantIndices[0]).toBe(0);
    });
  });

  describe('回収位置の設定・編集・削除', () => {
    it('回収位置設定ボタンでフォームが開く', () => {
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

      expect(screen.getByPlaceholderText('例: contents/chapter5.txt')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('伏線の回収方法や結果を説明')).toBeInTheDocument();
      expect(screen.getByText('設定')).toBeInTheDocument();
      expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    it('正常なデータで回収位置を設定する', () => {
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

      expect(setPayoffs).toHaveLength(1);
      expect(setPayoffs[0].location).toBe('chapter5.txt');
      expect(setPayoffs[0].comment).toBe('伏線の回収');
    });

    it('コメントが空でも位置があれば回収位置を設定できる', () => {
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

      expect(setPayoffs).toHaveLength(1);
      expect(setPayoffs[0].location).toBe('chapter5.txt');
      expect(setPayoffs[0].comment).toBe('');
    });

    it('回収位置の編集', () => {
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
      expect(editButton).not.toBeNull();
      if (editButton) {
        fireEvent.click(editButton);
      }

      // フォームが開き、既存データが入力されている
      const locationInput = screen.getByDisplayValue('chapter5.txt');
      const commentTextarea = screen.getByDisplayValue('既存の回収');
      expect(locationInput).toBeInTheDocument();
      expect(commentTextarea).toBeInTheDocument();
    });

    it('回収位置の削除', () => {
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
      expect(deleteButton).not.toBeNull();
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(payoffRemoveCount).toBe(1);
    });
  });

  describe('エッジケース', () => {
    it('foreshadowingがundefinedの場合も正常に動作する', () => {
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

      expect(screen.getByText('📍 伏線設置 (0件)')).toBeInTheDocument();
      expect(screen.getByText('🎯 伏線回収 (未設定)')).toBeInTheDocument();
    });

    it('plants配列が空の場合', () => {
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

      expect(screen.getByText('📍 伏線設置 (0件)')).toBeInTheDocument();
      expect(screen.getByText('+ 位置を追加')).toBeInTheDocument();
    });

    it('payoffのlocationが空文字の場合は未設定として扱われる', () => {
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

      expect(screen.getByText('🎯 伏線回収 (未設定)')).toBeInTheDocument();
      expect(screen.getByText('+ 回収位置を設定')).toBeInTheDocument();
    });

    it('payoffのlocationが空白のみの場合は未設定として扱われる', () => {
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

      expect(screen.getByText('🎯 伏線回収 (未設定)')).toBeInTheDocument();
    });

    it('植込み位置の追加で位置が空白のみの場合は追加されない', () => {
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

      expect(addedPlants).toHaveLength(0);
    });

    it('回収位置の設定で位置が空白のみの場合は設定されない', () => {
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

      expect(setPayoffs).toHaveLength(0);
    });
  });

  describe('フォーム状態管理', () => {
    it('植込み位置追加後にフォーム状態がリセットされる', () => {
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
      expect(screen.getByText('+ 位置を追加')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('chapter1.txt')).toBeNull();
    });

    it('回収位置設定後にフォーム状態がリセットされる', () => {
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
      expect(screen.queryByDisplayValue('chapter5.txt')).toBeNull();
      expect(screen.queryByPlaceholderText('例: contents/chapter5.txt')).toBeNull();
    });

    it('植込み位置更新後にフォーム状態がリセットされる', () => {
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
      expect(screen.getByText('+ 位置を追加')).toBeInTheDocument();
    });
  });
});
