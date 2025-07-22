import React, { useState } from 'react';
import type { FileDetailsData } from '../types/FileDetails';

interface BasicInfoSectionProps {
  fileData: FileDetailsData;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({ fileData }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="section">
      <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
        <span>基本情報</span>
      </button>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        {/* ファイル名表示 */}
        <div className="info-row">
          <span className="info-label">ファイル名:</span>
          <span className="info-value">{fileData.name || '名前なし'}</span>
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
