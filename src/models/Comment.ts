/**
 * コメントのステータス（シンプル化：2状態のみ）
 */
export type CommentStatus = 'open' | 'resolved';

/**
 * 行単位コメントアイテム
 */
export interface CommentItem {
  line: number;
  endLine?: number; // 複数行対応
  content: string;
  status: CommentStatus;
  created_at: string;
  updated_at?: string;
  // reviewer: 'user' (固定値として内部処理)
  // type: 'user' (固定値として内部処理)
}

/**
 * コメントファイルの構造
 */
export interface CommentFile {
  target_file: string;
  file_hash: string;
  comments: CommentItem[];
}

/**
 * .dialogoi-meta.yaml でのコメント数サマリー
 */
export interface CommentSummary {
  open: number;
  resolved?: number;
}

/**
 * コメント作成オプション
 */
export interface CreateCommentOptions {
  line: number;
  endLine?: number; // 複数行の場合
  content: string;
}

/**
 * コメント更新オプション
 */
export interface UpdateCommentOptions {
  status?: CommentStatus;
  content?: string;
}

/**
 * Review.tsからの互換性変換ヘルパー
 */
export interface ReviewToCommentMigration {
  /** 既存のReviewStatusをCommentStatusに変換 */
  convertStatus(reviewStatus: string): CommentStatus;
  /** 既存のReviewItemをCommentItemに変換 */
  convertReviewItem(reviewItem: unknown): CommentItem;
}
