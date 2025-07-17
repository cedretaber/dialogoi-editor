/**
 * レビューのステータス
 */
export type ReviewStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

/**
 * レビューの重要度
 */
export type ReviewSeverity = 'error' | 'warning' | 'suggestion' | 'info';

/**
 * レビューのタイプ
 */
export type ReviewType = 'human' | 'ai' | 'system';

/**
 * レビューの行内文字位置
 */
export interface ReviewPosition {
  start: number;
  end: number;
}

/**
 * レビュースレッドのコメント
 */
export interface ReviewComment {
  author: string;
  content: string;
  created_at: string;
}

/**
 * レビューアイテム
 */
export interface ReviewItem {
  line: number;
  position?: ReviewPosition;
  reviewer: string;
  type: ReviewType;
  severity: ReviewSeverity;
  content: string;
  created_at: string;
  status: ReviewStatus;
  thread?: ReviewComment[];
}

/**
 * レビューファイルの構造
 */
export interface ReviewFile {
  target_file: string;
  file_hash: string;
  reviews: ReviewItem[];
}

/**
 * meta.yaml でのレビュー数サマリー
 */
export interface ReviewSummary {
  open: number;
  in_progress?: number;
  resolved?: number;
  dismissed?: number;
}

/**
 * レビューファイルの作成オプション
 */
export interface CreateReviewOptions {
  line: number;
  position?: ReviewPosition;
  reviewer: string;
  type: ReviewType;
  severity: ReviewSeverity;
  content: string;
}

/**
 * レビューの更新オプション
 */
export interface UpdateReviewOptions {
  status?: ReviewStatus;
  content?: string;
  severity?: ReviewSeverity;
}

/**
 * レビュー追加のコメント
 */
export interface AddCommentOptions {
  author: string;
  content: string;
}