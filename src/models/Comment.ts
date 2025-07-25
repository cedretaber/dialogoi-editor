/**
 * コメントのステータス（シンプル化：2状態のみ）
 */
export type CommentStatus = 'open' | 'resolved';

/**
 * 行単位コメントアイテム（新データ構造）
 */
export interface CommentItem {
  id: number;
  target_file: string; // "contents/chapter1.txt#L42" 形式
  file_hash: string;
  content: string;
  posted_by: string;
  status: CommentStatus;
  created_at: string;
}

/**
 * コメントファイルの構造（新データ構造）
 */
export interface CommentFile {
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
 * コメント作成オプション（新データ構造）
 */
export interface CreateCommentOptions {
  line?: number;
  endLine?: number; // 複数行の場合
  content: string;
}

/**
 * コメント更新オプション（新データ構造）
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
