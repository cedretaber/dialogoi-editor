import React, { useState, useEffect } from 'react';
import type { FileDetailsData, VSCodeApi, UpdateFileMessage } from '../types/FileDetails';
import { TagSection } from './TagSection';
import { CharacterSection } from './CharacterSection';
import { ReferenceSection } from './ReferenceSection';
import { ReviewSection } from './ReviewSection';
import { BasicInfoSection } from './BasicInfoSection';

const vscode: VSCodeApi = acquireVsCodeApi();

export const FileDetailsApp: React.FC = () => {
  const [fileData, setFileData] = useState<FileDetailsData | null>(null);

  useEffect((): (() => void) => {
    // VSCode拡張機能にWebViewの準備完了を通知
    vscode.postMessage({ type: 'ready' });

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
    vscode.postMessage({
      type: 'addTag',
      payload: { tag },
    });
  };

  const handleTagRemove = (tag: string): void => {
    vscode.postMessage({
      type: 'removeTag',
      payload: { tag },
    });
  };

  const handleReferenceAdd = (): void => {
    const reference = prompt('参照するファイルのパスを入力してください:');
    if (reference && reference.trim()) {
      vscode.postMessage({
        type: 'addReference',
        payload: { reference: reference.trim() },
      });
    }
  };

  const handleReferenceOpen = (reference: string): void => {
    vscode.postMessage({
      type: 'openReference',
      payload: { reference },
    });
  };

  if (!fileData) {
    return <div className="no-file-selected">ファイルまたはディレクトリを選択してください</div>;
  }

  return (
    <div>
      <div className="file-title">{fileData.name || 'Unknown File'}</div>

      <TagSection tags={fileData.tags} onTagAdd={handleTagAdd} onTagRemove={handleTagRemove} />

      {fileData.character && (
        <CharacterSection character={fileData.character} fileName={fileData.name} />
      )}

      <ReferenceSection
        fileData={fileData}
        onReferenceAdd={handleReferenceAdd}
        onReferenceOpen={handleReferenceOpen}
      />

      {fileData.review_count && Object.keys(fileData.review_count).length > 0 && (
        <ReviewSection reviewCount={fileData.review_count} />
      )}

      <BasicInfoSection fileData={fileData} />
    </div>
  );
};
