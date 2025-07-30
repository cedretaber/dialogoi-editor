import '@testing-library/jest-dom';

import { render, screen, fireEvent } from '../../test-utils';
import { BasicInfoSection } from './BasicInfoSection';
import type { FileDetailsData } from '../../types/FileDetails';

describe('BasicInfoSection コンポーネント', () => {
  let mockFileData: FileDetailsData;

  beforeEach(() => {
    // 各テスト前にモックデータをリセット
    mockFileData = {
      name: 'test-file.txt',
      type: 'content',
      path: 'contents/chapter1/test-file.txt',
      tags: ['テスト', '第1章'],
    };
  });

  describe('基本表示', () => {
    it('セクションヘッダーが表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      expect(screen.getByText('基本情報')).toBeInTheDocument();
    });

    it('種別が正しく表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      expect(screen.getByText('種別:')).toBeInTheDocument();
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('パスが存在する場合はパスが表示される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      expect(screen.getByText('パス:')).toBeInTheDocument();
      expect(screen.getByText('contents/chapter1/test-file.txt')).toBeInTheDocument();
    });

    it('パスが存在しない場合はパスが表示されない', () => {
      const fileDataWithoutPath = { ...mockFileData, path: undefined };
      render(<BasicInfoSection fileData={fileDataWithoutPath} />);

      expect(screen.queryByText('パス:')).toBeNull();
    });

    it('種別がundefinedの場合はunknownと表示される', () => {
      const fileDataWithoutType = { ...mockFileData, type: undefined };
      render(<BasicInfoSection fileData={fileDataWithoutType} />);

      expect(screen.getByText('種別:')).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });

  describe('展開・折りたたみ機能', () => {
    it('初期状態では展開されている', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      // 内容が見えている = 展開されている
      expect(screen.getByText('種別:')).toBeInTheDocument();
      expect(screen.getByText('content')).toBeInTheDocument();
    });

    it('ヘッダーをクリックすると折りたたまれる', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
      expect(header).not.toBeNull();

      if (header) {
        fireEvent.click(header);
      }

      // 折りたたみ状態の確認（classNameで判定）
      const content = screen
        .getByText('基本情報')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeTruthy();
    });

    it('折りたたみ状態でヘッダーをクリックすると展開される', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
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
        .getByText('基本情報')
        .closest('.section')
        ?.querySelector('.section-content');
      expect(content?.classList.contains('collapsed')).toBeFalsy();
    });

    it('シェブロンアイコンの状態が正しく切り替わる', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const chevron = screen
        .getByText('基本情報')
        .closest('button')
        ?.querySelector('.section-chevron');
      expect(chevron).not.toBeNull();

      // 初期状態（展開）
      expect(chevron?.classList.contains('collapsed')).toBeFalsy();

      const header = screen.getByText('基本情報').closest('button');
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

  describe('異なるファイル種別のテスト', () => {
    it('setting種別のファイルが正しく表示される', () => {
      const settingFileData = { ...mockFileData, type: 'setting' as const };
      render(<BasicInfoSection fileData={settingFileData} />);

      expect(screen.getByText('setting')).toBeInTheDocument();
    });

    it('subdirectory種別のファイルが正しく表示される', () => {
      const subdirectoryFileData = { ...mockFileData, type: 'subdirectory' as const };
      render(<BasicInfoSection fileData={subdirectoryFileData} />);

      expect(screen.getByText('subdirectory')).toBeInTheDocument();
    });
  });

  describe('エッジケース', () => {
    it('空のパス文字列の場合はパスが表示されない', () => {
      const fileDataWithEmptyPath = { ...mockFileData, path: '' };
      render(<BasicInfoSection fileData={fileDataWithEmptyPath} />);

      expect(screen.queryByText('パス:')).toBeNull();
    });

    it('ファイルデータが最小構成でも正常に動作する', () => {
      const minimalFileData: FileDetailsData = {};
      render(<BasicInfoSection fileData={minimalFileData} />);

      expect(screen.getByText('基本情報')).toBeInTheDocument();
      expect(screen.getByText('種別:')).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
      expect(screen.queryByText('パス:')).toBeNull();
    });

    it('name以外のプロパティがundefinedでも正常に動作する', () => {
      const partialFileData: FileDetailsData = { name: 'test.txt' };

      expect(() => {
        render(<BasicInfoSection fileData={partialFileData} />);
      }).not.toThrow();

      expect(screen.getByText('基本情報')).toBeInTheDocument();
      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('ヘッダーボタンがbutton要素として正しく実装されている', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      const header = screen.getByText('基本情報').closest('button');
      expect(header).not.toBeNull();
      expect(header?.tagName).toBe('BUTTON');
      expect(header?.getAttribute('type')).toBe('button');
    });

    it('情報行のラベルと値の構造が正しい', () => {
      render(<BasicInfoSection fileData={mockFileData} />);

      // ラベルと値のペアが正しく表示されている
      const typeRow = screen.getByText('種別:').closest('.info-row');
      expect(typeRow).not.toBeNull();
      expect(typeRow?.querySelector('.info-label')).toBeTruthy();
      expect(typeRow?.querySelector('.info-value')).toBeTruthy();
    });
  });
});
