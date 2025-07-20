import { EventEmitterRepository, DisposableEvent } from './EventEmitterRepository.js';

/**
 * テスト用のMockEventEmitterRepository
 */
export class MockEventEmitterRepository<T> implements EventEmitterRepository<T> {
  private listeners: Array<(event: T) => void> = [];
  private firedEvents: T[] = [];

  /**
   * イベントリスナーを登録
   */
  onEvent(listener: (event: T) => void): DisposableEvent {
    this.listeners.push(listener);
    return {
      dispose: (): void => {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) {
          this.listeners.splice(index, 1);
        }
      },
    };
  }

  /**
   * イベントを発行
   */
  fire(event: T): void {
    this.firedEvents.push(event);
    this.listeners.forEach((listener) => listener(event));
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.listeners = [];
    this.firedEvents = [];
  }

  /**
   * テスト用：発行されたイベントを取得
   */
  getFiredEvents(): T[] {
    return [...this.firedEvents];
  }

  /**
   * テスト用：リスナー数を取得
   */
  getListenerCount(): number {
    return this.listeners.length;
  }
}
