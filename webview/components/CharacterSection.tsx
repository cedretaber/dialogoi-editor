import React, { useState } from 'react';
import type { CharacterInfo } from '../types/FileDetails';

interface CharacterSectionProps {
  character: CharacterInfo;
  fileName?: string;
  onCharacterRemove: () => void;
}

export const CharacterSection: React.FC<CharacterSectionProps> = ({
  character,
  fileName,
  onCharacterRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="section">
      <div className="section-header-container">
        <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
          <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
          <span>キャラクター情報</span>
        </button>
        <button
          className="delete-button"
          onClick={onCharacterRemove}
          title="キャラクター情報を削除"
          type="button"
        >
          ×
        </button>
      </div>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        <div className="character-info">
          <div className="character-field">
            <strong>重要度:</strong> {character.importance || '未設定'}
          </div>
          <div className="character-field">
            <strong>複数キャラ:</strong> {character.multiple_characters ? 'はい' : 'いいえ'}
          </div>
          <div className="character-field">
            <strong>表示名:</strong> {character.display_name || fileName || ''}
          </div>
        </div>
      </div>
    </div>
  );
};
