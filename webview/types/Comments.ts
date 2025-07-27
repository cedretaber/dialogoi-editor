/**
 * コメントシステム用の型定義
 */

/**
 * コメントアイテムの型定義（新データ構造対応）
 */
export interface CommentItemData {
  id: number;
  target_file: string; // "contents/chapter1.txt#L42" 形式
  file_hash: string;
  content: string;
  posted_by: string;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at?: string; // オプショナルフィールド
}

/**
 * VSCodeからのメッセージの型定義
 */
export interface UpdateCommentsMessage {
  type: 'updateComments';
  data: {
    fileName: string;
    filePath: string | null;
    comments: CommentItemData[];
    isFileChanged: boolean;
  };
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface StartEditingCommentMessage {
  type: 'startEditingComment';
  data: {
    commentIndex: number;
  };
}

/**
 * WebViewからVSCodeへのメッセージの型定義
 */
export interface AddCommentMessage {
  type: 'addComment';
  payload: {
    line: number;
    content: string;
  };
}

export interface JumpToLineMessage {
  type: 'jumpToLine';
  payload: {
    line: number;
    endLine?: number;
  };
}

export interface ToggleCommentStatusMessage {
  type: 'toggleCommentStatus';
  payload: {
    commentIndex: number;
  };
}

export interface DeleteCommentMessage {
  type: 'deleteComment';
  payload: {
    commentIndex: number;
  };
}

export interface UpdateCommentMessage {
  type: 'updateComment';
  payload: {
    commentIndex: number;
    content: string;
  };
}

export interface ReadyMessage {
  type: 'ready';
}

/**
 * VSCodeからWebViewへのメッセージ型の統合
 */
export type VSCodeToWebViewMessage =
  | UpdateCommentsMessage
  | ErrorMessage
  | StartEditingCommentMessage;

/**
 * WebViewからVSCodeへのメッセージ型の統合
 */
export type WebViewToVSCodeMessage =
  | AddCommentMessage
  | JumpToLineMessage
  | ToggleCommentStatusMessage
  | DeleteCommentMessage
  | UpdateCommentMessage
  | ReadyMessage;
