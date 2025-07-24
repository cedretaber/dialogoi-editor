import React, { useState, useRef, useEffect } from 'react';

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
 * TODO進捗情報の型定義
 */
interface TodoProgress {
  total: number;
  completed: number;
  percentage: number;
}

/**
 * マークダウンを高度なHTMLに変換する関数
 * Phase 2.2で本格的なマークダウンレンダリングに拡張
 */
const renderAdvancedMarkdown = (text: string): string => {
  let html = text;

  // コードブロックを一時的に保護
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `__CODEBLOCK_${codeBlocks.length - 1}__`;
  });

  // インラインコードを保護
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_match, code: string) => {
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `__INLINECODE_${inlineCodes.length - 1}__`;
  });

  // リスト処理
  // 番号付きリスト
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ordered">$1</li>');
  html = html.replace(/(<li class="ordered">.*<\/li>\n?)+/g, (match) => {
    return `<ol>${match}</ol>`;
  });

  // 箇条書きリスト（チェックボックス以外）
  html = html.replace(/^[-*]\s+(?!\[[ x]\])(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>(?!.*checkbox).*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // 太字（先に処理）
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 斜体（後に処理）
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 改行をbrタグに変換（リスト内以外）
  html = html.replace(/\n/g, '<br>');

  // 保護したコードブロックとインラインコードを戻す
  codeBlocks.forEach((code, index) => {
    html = html.replace(`__CODEBLOCK_${index}__`, code);
  });
  inlineCodes.forEach((code, index) => {
    html = html.replace(`__INLINECODE_${index}__`, code);
  });

  return html;
};

/**
 * HTMLエスケープ関数
 */
const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * チェックボックスを含むマークダウンを処理する関数
 * Phase 2.2でTODO機能統合実装
 */
const renderMarkdownWithCheckboxes = (text: string): { html: string; progress: TodoProgress } => {
  let todoCount = 0;
  let completedCount = 0;
  let lineIndex = 0;

  // チェックボックスを含む行を処理
  const lines = text.split('\n');
  const processedLines = lines.map((line, index) => {
    // チェックボックス（未完了）
    if (line.match(/^[-*]\s+\[ \]\s+/)) {
      todoCount++;
      const checkboxId = `checkbox-${Date.now()}-${lineIndex++}`;
      const processedLine = line.replace(
        /^([-*])\s+\[ \]\s+(.*)$/,
        `<li class="todo-item"><input type="checkbox" id="${checkboxId}" data-line="${index}"> <label for="${checkboxId}">$2</label></li>`,
      );
      return processedLine;
    }
    // チェックボックス（完了）
    else if (line.match(/^[-*]\s+\[x\]\s+/i)) {
      todoCount++;
      completedCount++;
      const checkboxId = `checkbox-${Date.now()}-${lineIndex++}`;
      const processedLine = line.replace(
        /^([-*])\s+\[x\]\s+(.*)$/i,
        `<li class="todo-item completed"><input type="checkbox" id="${checkboxId}" data-line="${index}" checked> <label for="${checkboxId}">$2</label></li>`,
      );
      return processedLine;
    }
    return line;
  });

  // 処理済みの行を結合
  let html = processedLines.join('\n');

  // TODOリストをulタグで囲む
  html = html.replace(/(<li class="todo-item[^"]*">.*<\/li>\n?)+/g, (match) => {
    return `<ul class="todo-list">${match}</ul>`;
  });

  // 通常のマークダウンレンダリング
  html = renderAdvancedMarkdown(html);

  const progress: TodoProgress = {
    total: todoCount,
    completed: completedCount,
    percentage: todoCount > 0 ? Math.round((completedCount / todoCount) * 100) : 0,
  };

  return { html, progress };
};

/**
 * 個別コメントアイテムコンポーネント
 */
export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  index,
  onToggleStatus,
  onDelete,
  onEdit,
  onJumpToLine,
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>(comment.content);
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [todoProgress, setTodoProgress] = useState<TodoProgress>({
    total: 0,
    completed: 0,
    percentage: 0,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 編集モードに切り替わった時にテキストエリアにフォーカス
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // カーソルを末尾に移動
      textareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing, editContent.length]);

  // チェックボックスのクリックイベントを設定
  useEffect(() => {
    if (!isEditing && showPreview && contentRef.current) {
      const checkboxes = contentRef.current.querySelectorAll('input[type="checkbox"]');

      const handleCheckboxChange = (e: Event): void => {
        const checkbox = e.target as HTMLInputElement;
        const lineIndex = parseInt(checkbox.getAttribute('data-line') || '0', 10);
        const checked = checkbox.checked;

        // コンテンツを更新
        const lines = comment.content.split('\n');
        if (lines[lineIndex]) {
          if (checked) {
            lines[lineIndex] = lines[lineIndex].replace(/\[ \]/, '[x]');
          } else {
            lines[lineIndex] = lines[lineIndex].replace(/\[x\]/i, '[ ]');
          }
          const newContent = lines.join('\n');
          onEdit(index, newContent);

          // TODO進捗を更新
          updateTodoProgress(newContent);
        }
      };

      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', handleCheckboxChange);
      });

      // クリーンアップ
      return (): void => {
        checkboxes.forEach((checkbox) => {
          checkbox.removeEventListener('change', handleCheckboxChange);
        });
      };
    }
  }, [comment.content, index, isEditing, showPreview, onEdit]);

  // TODO進捗を計算
  const updateTodoProgress = (content: string): void => {
    const { progress } = renderMarkdownWithCheckboxes(content);
    setTodoProgress(progress);
  };

  // 初回とコンテンツ変更時にTODO進捗を更新
  useEffect(() => {
    updateTodoProgress(comment.content);
  }, [comment.content]);

  /**
   * 編集モードを開始
   */
  const handleStartEdit = (): void => {
    setEditContent(comment.content);
    setIsEditing(true);
    setShowPreview(false);
  };

  /**
   * 編集をキャンセル
   */
  const handleCancelEdit = (): void => {
    setEditContent(comment.content);
    setIsEditing(false);
    setShowPreview(true);
  };

  /**
   * 編集を保存
   */
  const handleSaveEdit = (): void => {
    if (editContent.trim() === '') {
      return; // 空の内容は保存しない
    }
    onEdit(index, editContent.trim());
    setIsEditing(false);
    setShowPreview(true);
  };

  /**
   * キーボードショートカット処理
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.ctrlKey && e.key === 'Enter') {
      // Ctrl+Enter で保存
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      // Escape でキャンセル
      e.preventDefault();
      handleCancelEdit();
    }
  };

  /**
   * 削除確認とコールバック実行
   */
  const handleDeleteWithConfirm = (): void => {
    // WebView環境でのwindow.confirmの問題を回避するため、直接削除を実行
    // TODO: 将来的により良い確認UI（モーダル等）を実装
    onDelete(index);
  };

  /**
   * 行番号の表示テキストを生成
   */
  const getLineText = (): string => {
    return comment.endLine ? `行${comment.line}-${comment.endLine}` : `行${comment.line}`;
  };

  /**
   * 日付フォーマット
   */
  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={`comment-item ${comment.status === 'resolved' ? 'resolved' : 'open'}`}>
      {/* コメントヘッダー */}
      <div className="comment-header">
        <button
          className="line-link"
          onClick={() => onJumpToLine(comment.line, comment.endLine)}
          title="この行にジャンプ"
        >
          {getLineText()}
        </button>
        <div className="comment-status">
          <span className="status-icon">{comment.status === 'resolved' ? '✅' : '📝'}</span>
          <span className="status-text">{comment.status === 'resolved' ? '完了' : '未完了'}</span>
        </div>
        {/* TODO進捗表示 */}
        {todoProgress.total > 0 && (
          <div
            className="todo-progress"
            title={`完了: ${todoProgress.completed}/${todoProgress.total}`}
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
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="edit-textarea"
              rows={Math.max(3, editContent.split('\n').length)}
              placeholder="コメント内容を入力..."
            />
            <div className="edit-actions">
              <button
                className="save-button"
                onClick={handleSaveEdit}
                disabled={editContent.trim() === ''}
              >
                保存
              </button>
              <button className="cancel-button" onClick={handleCancelEdit}>
                キャンセル
              </button>
              <small className="keyboard-hint">Ctrl+Enter: 保存 | Escape: キャンセル</small>
            </div>
          </div>
        ) : (
          // プレビューモード
          <div className="preview-mode" ref={contentRef}>
            {showPreview ? (
              ((): React.ReactElement => {
                const { html } = renderMarkdownWithCheckboxes(comment.content);
                return (
                  <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{
                      __html: html,
                    }}
                  />
                );
              })()
            ) : (
              <pre className="raw-content">{comment.content}</pre>
            )}
          </div>
        )}
      </div>

      {/* コメントアクション */}
      <div className="comment-actions">
        {!isEditing && (
          <>
            <button className="edit-button" onClick={handleStartEdit} title="コメントを編集">
              編集
            </button>
            <button
              className="preview-toggle"
              onClick={() => setShowPreview(!showPreview)}
              title={showPreview ? 'ソースを表示' : 'プレビューを表示'}
            >
              {showPreview ? 'ソース' : 'プレビュー'}
            </button>
          </>
        )}
        <button
          className="status-toggle"
          onClick={() => onToggleStatus(index)}
          title={comment.status === 'resolved' ? '未完了に戻す' : '完了にする'}
        >
          {comment.status === 'resolved' ? '未完了に戻す' : '完了にする'}
        </button>
        <button className="delete-button" onClick={handleDeleteWithConfirm} title="コメントを削除">
          削除
        </button>
      </div>

      {/* コメントメタ情報 */}
      <div className="comment-meta">
        <span className="created-at">作成: {formatDate(comment.created_at)}</span>
        {comment.updated_at && comment.updated_at !== comment.created_at && (
          <span className="updated-at">更新: {formatDate(comment.updated_at)}</span>
        )}
      </div>
    </div>
  );
};
