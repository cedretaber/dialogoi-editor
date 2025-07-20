import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FileDetailsData, VSCodeApi, UpdateFileMessage } from '../types/FileDetails';
import { TagSection } from './TagSection';
import { CharacterSection } from './CharacterSection';
import { ReferenceSection } from './ReferenceSection';
import { ReviewSection } from './ReviewSection';
import { BasicInfoSection } from './BasicInfoSection';

import type { WebViewMessage } from '../types/FileDetails';

// VSCode API の遅延初期化用フック
const useVSCodeApi = (): {
  postMessage: (message: WebViewMessage) => boolean;
  isVSCodeReady: boolean;
  getVSCodeApi: () => VSCodeApi | null;
} => {
  const vsCodeRef = useRef<VSCodeApi | null>(null);
  const [isVSCodeReady, setIsVSCodeReady] = useState(false);

  const getVSCodeApi = useCallback((): VSCodeApi | null => {
    if (!vsCodeRef.current) {
      try {
        if (typeof acquireVsCodeApi !== 'undefined') {
          vsCodeRef.current = acquireVsCodeApi();
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }
    return vsCodeRef.current;
  }, []);

  const postMessage = useCallback(
    (message: WebViewMessage): boolean => {
      const api = getVSCodeApi();
      if (api) {
        try {
          api.postMessage(message);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [getVSCodeApi],
  );

  useEffect((): (() => void) => {
    // WebViewが初期化された後にVSCode APIを取得
    const timer = setTimeout(() => {
      const api = getVSCodeApi();
      if (api) {
        setIsVSCodeReady(true);
        // 準備完了を通知
        postMessage({ type: 'ready' });
      }
    }, 100); // 短い遅延でWebViewの初期化を待つ

    return (): void => clearTimeout(timer);
  }, [getVSCodeApi, postMessage]);

  return { postMessage, isVSCodeReady, getVSCodeApi };
};

export const FileDetailsApp: React.FC = () => {
  const [fileData, setFileData] = useState<FileDetailsData | null>(null);
  const { postMessage, isVSCodeReady } = useVSCodeApi();

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
      <div className="file-title">{fileData.name || 'Unknown File'}</div>
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

      {fileData.review_count && Object.keys(fileData.review_count).length > 0 && (
        <ReviewSection reviewCount={fileData.review_count} />
      )}

      <BasicInfoSection fileData={fileData} />
    </div>
  );
};
