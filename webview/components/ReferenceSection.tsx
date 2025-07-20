import React, { useState } from 'react';
import type { FileDetailsData, ReferenceEntry } from '../types/FileDetails';

interface ReferenceSectionProps {
  fileData: FileDetailsData;
  onReferenceAdd: () => void;
  onReferenceOpen: (reference: string) => void;
}

interface ReferenceItemProps {
  refEntry: ReferenceEntry;
  onReferenceOpen: (reference: string) => void;
}

const ReferenceItem: React.FC<ReferenceItemProps> = ({ refEntry, onReferenceOpen }) => {
  const linkIcon = refEntry.source === 'hyperlink' ? '🔗' : '';
  const linkClass =
    refEntry.source === 'hyperlink' ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';

  return (
    <a
      className={linkClass}
      onClick={() => onReferenceOpen(refEntry.path)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onReferenceOpen(refEntry.path)}
    >
      {linkIcon}
      {refEntry.path}
    </a>
  );
};

export const ReferenceSection: React.FC<ReferenceSectionProps> = ({
  fileData,
  onReferenceAdd,
  onReferenceOpen,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { referenceData, type } = fileData;

  if (!referenceData) {
    return null;
  }

  // 本文ファイルの場合は「登場人物」と「関連設定」に分けて表示
  if (type === 'content' && referenceData.allReferences.length > 0) {
    const characterRefs: ReferenceEntry[] = [];
    const settingRefs: ReferenceEntry[] = [];

    // 参照先をキャラクターと設定に分類
    for (const refEntry of referenceData.references) {
      // TODO: キャラクター判定の実装（現在はパス名での暫定判定）
      if (refEntry.path.includes('character')) {
        characterRefs.push(refEntry);
      } else {
        settingRefs.push(refEntry);
      }
    }

    return (
      <>
        {characterRefs.length > 0 && (
          <div className="section">
            <button
              className="section-header"
              onClick={() => setIsExpanded(!isExpanded)}
              type="button"
            >
              <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
              <span>登場人物 ({characterRefs.length})</span>
            </button>
            <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
              {characterRefs.map((refEntry, index) => (
                <ReferenceItem
                  key={`char-${index}`}
                  refEntry={refEntry}
                  onReferenceOpen={onReferenceOpen}
                />
              ))}
            </div>
          </div>
        )}

        {settingRefs.length > 0 && (
          <div className="section">
            <button
              className="section-header"
              onClick={() => setIsExpanded(!isExpanded)}
              type="button"
            >
              <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
              <span>関連設定 ({settingRefs.length})</span>
            </button>
            <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
              {settingRefs.map((refEntry, index) => (
                <ReferenceItem
                  key={`setting-${index}`}
                  refEntry={refEntry}
                  onReferenceOpen={onReferenceOpen}
                />
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <button className="button" onClick={onReferenceAdd} type="button">
            参照追加
          </button>
        </div>
      </>
    );
  }

  // それ以外のファイルは従来の参照関係表示
  return (
    <div className="section">
      <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
        <span>参照関係</span>
      </button>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        {referenceData.allReferences.length > 0 ? (
          <>
            <div style={{ marginBottom: '8px' }}>
              <strong>このファイルが参照:</strong>
            </div>
            {referenceData.references.map((refEntry, index) => (
              <ReferenceItem
                key={`ref-${index}`}
                refEntry={refEntry}
                onReferenceOpen={onReferenceOpen}
              />
            ))}

            {referenceData.referencedBy.length > 0 && (
              <>
                <div style={{ marginBottom: '8px', marginTop: '12px' }}>
                  <strong>このファイルを参照:</strong>
                </div>
                {referenceData.referencedBy.map((refEntry, index) => (
                  <ReferenceItem
                    key={`refby-${index}`}
                    refEntry={refEntry}
                    onReferenceOpen={onReferenceOpen}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <div className="no-data">参照関係がありません</div>
        )}

        <br />
        <button className="button" onClick={onReferenceAdd} type="button">
          参照追加
        </button>
      </div>
    </div>
  );
};
