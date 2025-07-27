import React, { useState, useEffect } from 'react';
import { useVSCodeApi } from '../../hooks/useVSCodeApi';
import { CommentItem } from './CommentItem';
import type {
  CommentItemData,
  VSCodeToWebViewMessage,
  WebViewToVSCodeMessage,
} from '../../types/Comments';

/**
 * コメント・TODOアプリコンポーネント
 */
export const CommentsApp: React.FC = () => {
  // useVSCodeApiフックでready messageを自動送信するように設定
  const { postMessage } = useVSCodeApi<WebViewToVSCodeMessage>({ type: 'ready' });
  const [fileName, setFileName] = useState<string>('');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItemData[]>([]);
  const [_isFileChanged, setIsFileChanged] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // コメント追加フォーム用state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newCommentLine, setNewCommentLine] = useState<string>('');
  const [newCommentContent, setNewCommentContent] = useState<string>('');

  // 編集中のコメントトラッキング用state
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);

  // VSCodeからのメッセージを監視
  useEffect((): (() => void) => {
    const handleMessage = (event: MessageEvent<VSCodeToWebViewMessage>): void => {
      const message = event.data;

      switch (message.type) {
        case 'updateComments':
          setFileName(message.data.fileName || '');
          setFilePath(message.data.filePath);
          setComments(message.data.comments || []);
          setIsFileChanged(message.data.isFileChanged || false);
          setError(null);
          break;
        case 'error':
          setError(message.message);
          break;
        case 'startEditingComment':
          // 指定されたコメントの編集を開始
          setEditingCommentIndex(message.data.commentIndex);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  /**
   * コメント追加フォームを表示
   */
  const handleShowAddForm = (): void => {
    setShowAddForm(true);
    setNewCommentLine('');
    setNewCommentContent('');
  };

  /**
   * コメント追加をキャンセル
   */
  const handleCancelAddComment = (): void => {
    setShowAddForm(false);
    setNewCommentLine('');
    setNewCommentContent('');
  };

  /**
   * コメント追加を実行
   */
  const handleSubmitAddComment = (): void => {
    const line = parseInt(newCommentLine);

    if (isNaN(line) || line <= 0) {
      setError('有効な行番号を入力してください');
      return;
    }

    if (!newCommentContent.trim()) {
      setError('コメント内容を入力してください');
      return;
    }

    postMessage({
      type: 'addComment',
      payload: { line, content: newCommentContent.trim() },
    });

    // フォームをリセット
    setShowAddForm(false);
    setNewCommentLine('');
    setNewCommentContent('');
    setError(null);
  };

  /**
   * 行ジャンプ
   */
  const handleJumpToLine = (line: number, endLine?: number): void => {
    postMessage({
      type: 'jumpToLine',
      payload: { line, endLine },
    });
  };

  /**
   * コメントステータス切り替え
   */
  const handleToggleStatus = (commentIndex: number): void => {
    postMessage({
      type: 'toggleCommentStatus',
      payload: { commentIndex },
    });
  };

  /**
   * コメント削除
   */
  const handleDeleteComment = (commentIndex: number): void => {
    postMessage({
      type: 'deleteComment',
      payload: { commentIndex },
    });
  };

  /**
   * コメント編集
   */
  const handleEditComment = (commentIndex: number, content: string): void => {
    postMessage({
      type: 'updateComment',
      payload: { commentIndex, content },
    });
  };

  return (
    <div className="comments-app">
      <div className="comments-header">
        <h3>コメント・TODO</h3>
        {fileName && <div className="current-file">{fileName}</div>}
      </div>

      {error && (
        <div className="error-message" style={{ color: 'var(--vscode-errorForeground)' }}>
          エラー: {error}
        </div>
      )}

      <div className="comments-content">
        {!filePath ? (
          <div className="no-file">ファイルを選択してください</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">コメントはありません</div>
        ) : (
          <div className="comments-list">
            {comments.map((comment, index) => (
              <CommentItem
                key={index}
                comment={comment}
                index={index}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDeleteComment}
                onEdit={handleEditComment}
                onJumpToLine={handleJumpToLine}
                shouldStartEditing={editingCommentIndex === index}
              />
            ))}
          </div>
        )}
      </div>

      {showAddForm ? (
        <div className="add-comment-form">
          <div className="form-group">
            <label htmlFor="comment-line">行番号</label>
            <input
              id="comment-line"
              type="number"
              value={newCommentLine}
              onChange={(e) => setNewCommentLine(e.target.value)}
              placeholder="例: 42"
              min="1"
            />
          </div>
          <div className="form-group">
            <label htmlFor="comment-content">コメント</label>
            <textarea
              id="comment-content"
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              placeholder="コメントを入力してください..."
              rows={3}
            />
          </div>
          <div className="actions">
            <button className="primary" onClick={handleSubmitAddComment}>
              追加
            </button>
            <button className="secondary" onClick={handleCancelAddComment}>
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button className="add-button" onClick={handleShowAddForm}>
          + コメントを追加
        </button>
      )}
    </div>
  );
};
