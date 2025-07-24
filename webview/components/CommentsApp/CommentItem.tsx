import React, { useState, useRef, useEffect } from 'react';
import { MarkdownRenderer, TodoProgress, calculateTodoProgress } from './MarkdownRenderer';

/**
 * コメントアイテムの型定義
 */
interface CommentItemData {
  line: number;
  endLine?: number;
  content: string;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at?: string;
}

/**
 * CommentItemコンポーネントのProps
 */
interface CommentItemProps {
  comment: CommentItemData;
  index: number;
  onToggleStatus: (index: number) => void;
  onDelete: (index: number) => void;
  onEdit: (index: number, content: string) => void;
  onJumpToLine: (line: number, endLine?: number) => void;
}

/**
 * コメントアイテムコンポーネント
 *
 * Phase 2.2でマークダウンレンダリングとTODO機能を統合
 * react-markdownベースの安全な実装に変更
 */
export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  index,
  onToggleStatus,
  onDelete,
  onEdit,
  onJumpToLine,
}) => {
  // 編集状態の管理
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(comment.content);
  const [todoProgress, setTodoProgress] = useState<TodoProgress>({
    total: 0,
    completed: 0,
    percentage: 0,
  });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // 初回とコンテンツ変更時にTODO進捗を更新
  useEffect(() => {
    const progress = calculateTodoProgress(comment.content);
    setTodoProgress(progress);
  }, [comment.content]);

  /**
   * プレビュークリックで編集モードを開始
   */
  const handlePreviewClick = (): void => {
    setEditContent(comment.content);
    setIsEditing(true);
  };

  /**
   * フォーカスが外れた時の自動保存
   */
  const handleBlur = (): void => {
    const trimmedContent = editContent.trim();
    if (trimmedContent && trimmedContent !== comment.content) {
      onEdit(index, trimmedContent);
    }
    setIsEditing(false);
  };

  /**
   * 編集をキャンセル（Escapeキー用）
   */
  const handleCancelEdit = (): void => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  /**
   * キーボードショートカットの処理
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  /**
   * 行番号リンクのクリック処理
   */
  const handleLineClick = (): void => {
    onJumpToLine(comment.line, comment.endLine);
  };

  /**
   * ステータス切り替えの処理
   */
  const handleToggleStatus = (): void => {
    onToggleStatus(index);
  };

  /**
   * 削除処理
   */
  const handleDelete = (): void => {
    onDelete(index);
  };

  // 編集モード時のフォーカス処理
  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isEditing]);

  // 行番号表示のテキストを生成
  const lineText = comment.endLine ? `行${comment.line}-${comment.endLine}` : `行${comment.line}`;

  // ステータスアイコンとテキスト
  const statusIcon = comment.status === 'resolved' ? '✅' : '📝';
  const statusText = comment.status === 'resolved' ? '完了' : '未完了';
  const statusButtonText = comment.status === 'resolved' ? '未完了に戻す' : '完了にする';

  // 日付フォーマット
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  return (
    <div className={`comment-item ${comment.status}`}>
      {/* コメントヘッダー */}
      <div className="comment-header">
        <button className="line-link" onClick={handleLineClick} type="button">
          {lineText}
        </button>

        <div className="comment-status">
          <span className="status-icon">{statusIcon}</span>
          <span className="status-text">{statusText}</span>
        </div>

        {/* TODO進捗表示 */}
        {todoProgress.total > 0 && (
          <div
            className="todo-progress"
            title={`${todoProgress.completed}/${todoProgress.total} 完了`}
          >
            <span className="progress-text">{todoProgress.percentage}%</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${todoProgress.percentage}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* コメント内容 */}
      <div className="comment-content">
        {isEditing ? (
          // 編集モード
          <div className="edit-mode">
            <textarea
              ref={textAreaRef}
              className="edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              rows={Math.max(3, editContent.split('\n').length)}
            />
          </div>
        ) : (
          // 表示モード（クリックで編集モード）
          <div className="preview-mode" onClick={handlePreviewClick}>
            <MarkdownRenderer content={comment.content} className="markdown-content" />
          </div>
        )}
      </div>

      {/* コメントアクション */}
      <div className="comment-actions">
        <button className="status-toggle" onClick={handleToggleStatus} type="button">
          {statusButtonText}
        </button>

        <button className="delete-button" onClick={handleDelete} type="button">
          削除
        </button>
      </div>

      {/* コメントメタ情報 */}
      <div className="comment-meta">
        <span>作成: {formatDate(comment.created_at)}</span>
        {comment.updated_at && <span>更新: {formatDate(comment.updated_at)}</span>}
      </div>
    </div>
  );
};
