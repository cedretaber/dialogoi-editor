/**
 * イベントエミッターの抽象リポジトリ
 */
export interface EventEmitterRepository<T> {
  /**
   * イベントリスナーを登録
   */
  onEvent(listener: (event: T) => void): DisposableEvent;

  /**
   * イベントを発行
   */
  fire(event: T): void;

  /**
   * リソースをクリーンアップ
   */
  dispose(): void;
}

/**
 * イベントリスナーの購読を管理するインターフェース
 */
export interface DisposableEvent {
  dispose(): void;
}
