import React, { useState, useEffect, useRef } from 'react';
import type {
  FileDetailsData,
  UpdateFileMessage,
  ForeshadowingPoint,
  RenameFileResponseMessage,
} from '../../types/FileDetails';
import { TagSection } from './TagSection';
import { CharacterSection } from './CharacterSection';
import { ReferenceSection } from './ReferenceSection';
import { BasicInfoSection } from './BasicInfoSection';
import { ForeshadowingSection } from './ForeshadowingSection';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';

import type { WebViewMessage } from '../../types/FileDetails';

export const FileDetailsApp: React.FC = () => {
  const [fileData, setFileData] = useState<FileDetailsData | null>(null);
  const { postMessage, isVSCodeReady } = useVSCodeApi<WebViewMessage>({ type: 'ready' });

  // インライン編集用状態
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [titleValidationError, setTitleValidationError] = useState<string | undefined>(undefined);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect((): (() => void) => {
    // Extension からのメッセージリスナー
    const handleMessage = (event: MessageEvent<UpdateFileMessage>): void => {
      const message = event.data;
      if (message.type === 'updateFile') {
        setFileData(message.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return (): void => window.removeEventListener('message', handleMessage);
  }, []);

  // ファイルデータが変更されたら編集状態をリセット
  useEffect(() => {
    setEditedTitle(fileData?.name || '');
    setIsEditingTitle(false);
    setTitleValidationError(undefined);
  }, [fileData?.name]);

  // ファイル名バリデーション関数
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

  // タイトル編集関数群
  const handleTitleStartEdit = (): void => {
    if (!fileData?.name) {
      return;
    }
    setEditedTitle(fileData.name);
    setIsEditingTitle(true);
    setTitleValidationError(undefined);
    // 次のtickでフォーカス
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleDisplayKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTitleStartEdit();
    }
  };

  const handleTitleNameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = e.target.value;
    setEditedTitle(newValue);

    // リアルタイムバリデーション
    const error = validateFileName(newValue);
    setTitleValidationError(error);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleTitleSaveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancelEdit();
    }
  };

  const handleTitleCancelEdit = (): void => {
    setEditedTitle(fileData?.name || '');
    setIsEditingTitle(false);
    setTitleValidationError(undefined);
  };

  const handleTitleSaveRename = async (): Promise<void> => {
    if (!fileData?.name) {
      return;
    }

    const trimmedName = editedTitle.trim();

    // 変更がない場合は編集モードを終了
    if (trimmedName === fileData.name) {
      setIsEditingTitle(false);
      return;
    }

    // バリデーションエラーがある場合は保存しない
    const error = validateFileName(trimmedName);
    if (error) {
      setTitleValidationError(error);
      return;
    }

    setIsSavingTitle(true);
    try {
      await handleFileRename(fileData.name, trimmedName);
      setIsEditingTitle(false);
      setTitleValidationError(undefined);
    } catch (err) {
      // エラーが発生した場合は編集状態を維持
      setTitleValidationError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleTagAdd = (tag: string): void => {
    postMessage({
      type: 'addTag',
      payload: { tag },
    });
  };

  const handleTagRemove = (tag: string): void => {
    postMessage({
      type: 'removeTag',
      payload: { tag },
    });
  };

  const handleReferenceOpen = (reference: string): void => {
    postMessage({
      type: 'openReference',
      payload: { reference },
    });
  };

  const handleReferenceRemove = (reference: string): void => {
    postMessage({
      type: 'removeReference',
      payload: { reference },
    });
  };

  const handleReverseReferenceRemove = (reference: string): void => {
    postMessage({
      type: 'removeReverseReference',
      payload: { reference },
    });
  };

  const handleCharacterRemove = (): void => {
    postMessage({
      type: 'removeCharacter',
    });
  };

  // 伏線関連のハンドラー
  const handleForeshadowingPlantAdd = (plant: ForeshadowingPoint): void => {
    postMessage({
      type: 'addForeshadowingPlant',
      payload: { plant },
    });
  };

  const handleForeshadowingPlantRemove = (index: number): void => {
    postMessage({
      type: 'removeForeshadowingPlant',
      payload: { plantIndex: index },
    });
  };

  const handleForeshadowingPlantUpdate = (index: number, plant: ForeshadowingPoint): void => {
    postMessage({
      type: 'updateForeshadowingPlant',
      payload: { plantIndex: index, plant },
    });
  };

  const handleForeshadowingPayoffSet = (payoff: ForeshadowingPoint): void => {
    postMessage({
      type: 'setForeshadowingPayoff',
      payload: { payoff },
    });
  };

  const handleForeshadowingPayoffRemove = (): void => {
    postMessage({
      type: 'removeForeshadowingPayoff',
    });
  };

  const handleFileRename = async (oldName: string, newName: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // レスポンス用の一意なID
      const responseId = `rename-${Date.now()}-${Math.random()}`;

      // レスポンスリスナー
      const handleResponse = (event: MessageEvent<RenameFileResponseMessage>): void => {
        const message = event.data;
        if (message.type === 'renameFileResponse' && message.responseId === responseId) {
          window.removeEventListener('message', handleResponse);
          if (message.success) {
            resolve();
          } else {
            reject(new Error(message.error || 'ファイル名の変更に失敗しました'));
          }
        }
      };

      window.addEventListener('message', handleResponse);

      // 名前変更リクエスト送信
      postMessage({
        type: 'renameFile',
        payload: { oldName, newName, responseId },
      });

      // 10秒後にタイムアウト
      setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        reject(new Error('操作がタイムアウトしました'));
      }, 10000);
    });
  };

  if (!fileData) {
    return (
      <div className="no-file-selected">
        <div>ファイルまたはディレクトリを選択してください</div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
          VSCode API: {isVSCodeReady ? '準備完了' : '初期化中...'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ファイルタイトル - インライン編集対応 */}
      <div className="file-title-container">
        {isEditingTitle ? (
          <div className="file-title-edit-container">
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={handleTitleNameChange}
              onBlur={(): void => {
                void handleTitleSaveRename();
              }}
              onKeyDown={handleTitleKeyDown}
              className={`file-title-input ${titleValidationError ? 'error' : ''}`}
              disabled={isSavingTitle}
            />
            {isSavingTitle && <span className="saving-indicator">保存中...</span>}
            {titleValidationError && (
              <div className="validation-error title-validation-error">{titleValidationError}</div>
            )}
          </div>
        ) : (
          <div
            className="file-title clickable"
            onClick={handleTitleStartEdit}
            onKeyDown={handleTitleDisplayKeyDown}
            role="button"
            tabIndex={0}
            aria-label="クリックして編集"
          >
            {fileData.name || 'Unknown File'}
          </div>
        )}
      </div>
      {!isVSCodeReady && (
        <div
          style={{
            backgroundColor: '#fff3cd',
            padding: '4px 8px',
            fontSize: '11px',
            marginBottom: '8px',
          }}
        >
          VSCode API初期化中...
        </div>
      )}

      <BasicInfoSection fileData={fileData} />

      <TagSection tags={fileData.tags} onTagAdd={handleTagAdd} onTagRemove={handleTagRemove} />

      {fileData.character && (
        <CharacterSection
          character={fileData.character}
          fileName={fileData.name}
          onCharacterRemove={handleCharacterRemove}
        />
      )}

      <ReferenceSection
        fileData={fileData}
        onReferenceOpen={handleReferenceOpen}
        onReferenceRemove={handleReferenceRemove}
        onReverseReferenceRemove={handleReverseReferenceRemove}
      />

      {fileData.type === 'setting' && fileData.foreshadowing && (
        <ForeshadowingSection
          foreshadowing={fileData.foreshadowing}
          onPlantAdd={handleForeshadowingPlantAdd}
          onPlantRemove={handleForeshadowingPlantRemove}
          onPlantUpdate={handleForeshadowingPlantUpdate}
          onPayoffSet={handleForeshadowingPayoffSet}
          onPayoffRemove={handleForeshadowingPayoffRemove}
        />
      )}

    </div>
  );
};
