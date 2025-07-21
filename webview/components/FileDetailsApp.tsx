import React, { useState, useEffect } from 'react';
import type { FileDetailsData, UpdateFileMessage, ForeshadowingPoint } from '../types/FileDetails';
import { TagSection } from './TagSection';
import { CharacterSection } from './CharacterSection';
import { ReferenceSection } from './ReferenceSection';
import { ReviewSection } from './ReviewSection';
import { BasicInfoSection } from './BasicInfoSection';
import { ForeshadowingSection } from './ForeshadowingSection';
import { useVSCodeApi } from '../hooks/useVSCodeApi';

import type { WebViewMessage } from '../types/FileDetails';

export const FileDetailsApp: React.FC = () => {
  const [fileData, setFileData] = useState<FileDetailsData | null>(null);
  const { postMessage, isVSCodeReady } = useVSCodeApi<WebViewMessage>({ type: 'ready' });

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

      {fileData.review_count && Object.keys(fileData.review_count).length > 0 && (
        <ReviewSection reviewCount={fileData.review_count} />
      )}

      <BasicInfoSection fileData={fileData} />
    </div>
  );
};
