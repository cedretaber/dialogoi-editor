import * as vscode from 'vscode';
import { EventEmitterRepository, DisposableEvent } from './EventEmitterRepository.js';

/**
 * VSCode EventEmitterを使用した実装
 */
export class VSCodeEventEmitterRepository<T> implements EventEmitterRepository<T> {
  private readonly eventEmitter = new vscode.EventEmitter<T>();

  /**
   * イベントリスナーを登録
   */
  onEvent(listener: (event: T) => void): DisposableEvent {
    return this.eventEmitter.event(listener);
  }

  /**
   * イベントを発行
   */
  fire(event: T): void {
    this.eventEmitter.fire(event);
  }

  /**
   * リソースをクリーンアップ
   */
  dispose(): void {
    this.eventEmitter.dispose();
  }
}
