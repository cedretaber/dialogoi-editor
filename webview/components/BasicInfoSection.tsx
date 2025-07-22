import React, { useState, useRef, useEffect } from 'react';
import type { FileDetailsData } from '../types/FileDetails';

interface BasicInfoSectionProps {
  fileData: FileDetailsData;
  onFileRename?: (oldName: string, newName: string) => Promise<void>;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ fileData, onFileRename }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(fileData.name || '');
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ファイルデータが変わったら編集状態をリセット
  useEffect(() => {
    setEditedName(fileData.name || '');
    setIsEditing(false);
    setValidationError(undefined);
  }, [fileData.name]);

  const handleStartEdit = (): void => {
    if (!fileData.name) {
      return;
    }
    setEditedName(fileData.name);
    setIsEditing(true);
    setValidationError(undefined);
    // 次のtickでフォーカス
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleDisplayKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleStartEdit();
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setEditedName(newValue);

    // リアルタイムバリデーション
    const error = validateFileName(newValue);
    setValidationError(error);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleCancelEdit = (): void => {
    setEditedName(fileData.name || '');
    setIsEditing(false);
    setValidationError(undefined);
  };

  const handleSaveRename = async (): Promise<void> => {
    if (!fileData.name || !onFileRename) {
      return;
    }

    const trimmedName = editedName.trim();

    // 変更がない場合は編集モードを終了
    if (trimmedName === fileData.name) {
      setIsEditing(false);
      return;
    }

    // バリデーションエラーがある場合は保存しない
    const error = validateFileName(trimmedName);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSaving(true);
    try {
      await onFileRename(fileData.name, trimmedName);
      setIsEditing(false);
      setValidationError(undefined);
    } catch (err) {
      // エラーが発生した場合は編集状態を維持
      setValidationError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const validateFileName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'ファイル名を入力してください';
    }

    // 不正文字チェック
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(name)) {
      return 'ファイル名に使用できない文字が含まれています: < > : " / \\ | ? *';
    }

    return undefined;
  };

  return (
    <div className="section">
      <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
        <span>基本情報</span>
      </button>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        {/* ファイル名表示・編集 */}
        <div className="info-row">
          <span className="info-label">ファイル名:</span>
          <div className="file-name-container">
            {isEditing ? (
              <div className="file-name-edit-container">
                <input
                  ref={inputRef}
                  type="text"
                  value={editedName}
                  onChange={handleNameChange}
                  onBlur={(): void => {
                    void handleSaveRename();
                  }}
                  onKeyDown={handleKeyDown}
                  className={`file-name-input ${validationError ? 'error' : ''}`}
                  disabled={isSaving}
                />
                {validationError && <div className="validation-error">{validationError}</div>}
                {isSaving && <div className="saving-indicator">保存中...</div>}
              </div>
            ) : (
              <span
                className="file-name-display clickable"
                onClick={handleStartEdit}
                onKeyDown={handleDisplayKeyDown}
                tabIndex={0}
                role="button"
                aria-label="クリックして編集"
              >
                {fileData.name || '名前なし'}
              </span>
            )}
          </div>
        </div>

        <div className="info-row">
          <span className="info-label">種別:</span>
          <span className="info-value">{fileData.type || 'unknown'}</span>
        </div>

        {fileData.path && (
          <div className="info-row">
            <span className="info-label">パス:</span>
            <span className="info-value">{fileData.path}</span>
          </div>
        )}

        {/* TODO: ファイルサイズ、更新日時などの情報を追加 */}
      </div>
    </div>
  );
};
