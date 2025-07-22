import React, { useState } from 'react';
import type { FileDetailsData, ReferenceEntry } from '../types/FileDetails';

interface ReferenceSectionProps {
  fileData: FileDetailsData;
  onReferenceOpen: (reference: string) => void;
  onReferenceRemove: (reference: string) => void;
  onReverseReferenceRemove: (reference: string) => void;
}

interface ReferenceItemProps {
  refEntry: ReferenceEntry;
  onReferenceOpen: (reference: string) => void;
  onReferenceRemove: (reference: string) => void;
}

const ReferenceItem: React.FC<ReferenceItemProps> = ({
  refEntry,
  onReferenceOpen,
  onReferenceRemove,
}) => {
  const linkIcon = refEntry.source === 'hyperlink' ? '🔗' : '';
  const linkClass =
    refEntry.source === 'hyperlink' ? 'reference-item hyperlink-ref' : 'reference-item manual-ref';

  // ハイパーリンク由来の参照は削除不可（本文編集が必要なため）
  const canDelete = refEntry.source === 'manual';

  // ファイル名のみを表示（パスから抽出）
  const fileName = refEntry.path.split('/').pop() || refEntry.path;

  return (
    <div className="reference-item-container">
      <a
        className={linkClass}
        onClick={() => onReferenceOpen(refEntry.path)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onReferenceOpen(refEntry.path)}
        title={refEntry.path} // ホバー時にフルパスを表示
      >
        {linkIcon}
        {fileName}
      </a>
      {canDelete && (
        <button
          className="delete-button small"
          onClick={() => onReferenceRemove(refEntry.path)}
          title="手動参照を削除"
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
};

export const ReferenceSection: React.FC<ReferenceSectionProps> = ({
  fileData,
  onReferenceOpen,
  onReferenceRemove,
  onReverseReferenceRemove,
}) => {
  const [isExpandedCharacters, setIsExpandedCharacters] = useState(true);
  const [isExpandedSettings, setIsExpandedSettings] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const { referenceData, type } = fileData;

  if (!referenceData) {
    return null;
  }

  // 本文ファイルの場合は「登場人物」と「関連設定」に分けて表示
  if (type === 'content') {
    // 参照が全くない場合は何も表示しない
    if (referenceData.allReferences.length === 0 && referenceData.referencedBy.length === 0) {
      return null;
    }
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
              onClick={() => setIsExpandedCharacters(!isExpandedCharacters)}
              type="button"
            >
              <span className={`section-chevron ${isExpandedCharacters ? '' : 'collapsed'}`}>
                ▶
              </span>
              <span>登場人物 ({characterRefs.length})</span>
            </button>
            <div className={`section-content ${isExpandedCharacters ? '' : 'collapsed'}`}>
              {characterRefs.map((refEntry, index) => (
                <ReferenceItem
                  key={`char-${index}`}
                  refEntry={refEntry}
                  onReferenceOpen={onReferenceOpen}
                  onReferenceRemove={onReferenceRemove}
                />
              ))}
            </div>
          </div>
        )}

        {settingRefs.length > 0 && (
          <div className="section">
            <button
              className="section-header"
              onClick={() => setIsExpandedSettings(!isExpandedSettings)}
              type="button"
            >
              <span className={`section-chevron ${isExpandedSettings ? '' : 'collapsed'}`}>▶</span>
              <span>関連設定 ({settingRefs.length})</span>
            </button>
            <div className={`section-content ${isExpandedSettings ? '' : 'collapsed'}`}>
              {settingRefs.map((refEntry, index) => (
                <ReferenceItem
                  key={`setting-${index}`}
                  refEntry={refEntry}
                  onReferenceOpen={onReferenceOpen}
                  onReferenceRemove={onReferenceRemove}
                />
              ))}
            </div>
          </div>
        )}
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
        {referenceData.allReferences.length > 0 || referenceData.referencedBy.length > 0 ? (
          <>
            {referenceData.references.length > 0 && (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <strong>このファイルが参照:</strong>
                </div>
                {referenceData.references.map((refEntry, index) => (
                  <ReferenceItem
                    key={`ref-${index}`}
                    refEntry={refEntry}
                    onReferenceOpen={onReferenceOpen}
                    onReferenceRemove={onReferenceRemove}
                  />
                ))}
              </>
            )}

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
                    onReferenceRemove={onReverseReferenceRemove}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <div className="no-data">参照関係がありません</div>
        )}
      </div>
    </div>
  );
};
