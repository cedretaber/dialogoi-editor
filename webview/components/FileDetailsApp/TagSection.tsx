import React, { useState } from 'react';

interface TagSectionProps {
  tags?: string[];
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
}

export const TagSection: React.FC<TagSectionProps> = ({ tags = [], onTagAdd, onTagRemove }) => {
  const [newTag, setNewTag] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleTagSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    const tag = newTag.trim();
    if (!tag) {
      return;
    }

    // 重複チェック
    if (tags.includes(tag)) {
      // 重複している場合は入力フィールドにフィードバック
      setNewTag('');
      return;
    }

    onTagAdd(tag);
    setNewTag('');
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleTagSubmit(e);
    }
  };

  return (
    <div className="section">
      <button className="section-header" onClick={() => setIsExpanded(!isExpanded)} type="button">
        <span className={`section-chevron ${isExpanded ? '' : 'collapsed'}`}>▶</span>
        <span>タグ</span>
      </button>
      <div className={`section-content ${isExpanded ? '' : 'collapsed'}`}>
        <div className="tag-container">
          <div className="tag-list">
            {tags.length > 0 ? (
              tags.map((tag, index) => (
                <span key={index} className="tag">
                  #{tag}
                  <button
                    className="tag-remove"
                    onClick={() => onTagRemove(tag)}
                    title="タグを削除"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <div className="no-data">タグがありません</div>
            )}
          </div>
          <form onSubmit={handleTagSubmit}>
            <input
              className="tag-input"
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="新しいタグを入力してEnterキーを押してください..."
            />
          </form>
        </div>
      </div>
    </div>
  );
};
