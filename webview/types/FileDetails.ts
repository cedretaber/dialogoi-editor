/**
 * WebView ↔ Extension 間のメッセージ型定義
 */
export interface WebViewMessage {
  type: 'addTag' | 'removeTag' | 'addReference' | 'openReference' | 'ready';
  payload?: {
    tag?: string;
    reference?: string;
  };
}

/**
 * Extension → WebView への更新メッセージ
 */
export interface UpdateFileMessage {
  type: 'updateFile';
  data: FileDetailsData | null;
}

/**
 * 参照エントリ（手動/ハイパーリンク）
 */
export interface ReferenceEntry {
  path: string;
  source: 'manual' | 'hyperlink';
}

/**
 * 参照関係データ
 */
export interface ReferenceData {
  allReferences: string[];
  references: ReferenceEntry[];
  referencedBy: ReferenceEntry[];
}

/**
 * キャラクター情報
 */
export interface CharacterInfo {
  importance?: 'main' | 'sub' | 'background';
  multiple_characters?: boolean;
  display_name?: string;
}

/**
 * レビュー件数
 */
export interface ReviewCount {
  open?: number;
  in_progress?: number;
  resolved?: number;
  dismissed?: number;
}

/**
 * ファイル詳細データ（WebViewに送信される全データ）
 */
export interface FileDetailsData {
  name?: string;
  type?: 'content' | 'setting' | 'subdirectory';
  path?: string;
  tags?: string[];
  character?: CharacterInfo;
  referenceData?: ReferenceData;
  review_count?: ReviewCount;
}

/**
 * VSCode WebView API（グローバル変数）
 */
export interface VSCodeApi {
  postMessage(message: WebViewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VSCodeApi;
}
