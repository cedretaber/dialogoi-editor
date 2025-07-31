import { Logger } from '../utils/Logger.js';
import { EventEmitterRepository, DisposableEvent } from '../repositories/EventEmitterRepository.js';

/**
 * ファイル変更の種類
 */
export enum FileChangeType {
  /** .dialogoi-meta.yamlが更新された */
  META_YAML_UPDATED = 'meta_yaml_updated',
  /** ファイルが移動された */
  FILE_MOVED = 'file_moved',
  /** ファイルが作成された */
  FILE_CREATED = 'file_created',
  /** ファイルが削除された */
  FILE_DELETED = 'file_deleted',
  /** 参照関係が変更された */
  REFERENCE_UPDATED = 'reference_updated',
  /** ドラッグ&ドロップでファイルが並び替えられた */
  FILE_REORDERED = 'file_reordered',
}

/**
 * ファイル変更イベントのデータ
 */
export interface FileChangeEvent {
  type: FileChangeType;
  /** 変更されたファイルのパス（絶対パス） */
  filePath: string;
  /** 変更前のパス（移動の場合） */
  oldPath?: string;
  /** 追加のメタデータ */
  metadata?: Record<string, unknown>;
}

/**
 * ファイル変更通知を管理するサービス
 *
 * このサービスは以下の責任を持つ：
 * 1. ファイル変更イベントの発行
 * 2. ファイル変更イベントの購読管理
 * 3. WebViewとTreeViewの更新タイミングの調整
 */
export class FileChangeNotificationService {
  private eventEmitterRepository: EventEmitterRepository<FileChangeEvent>;
  private logger = Logger.getInstance();

  constructor(eventEmitterRepository: EventEmitterRepository<FileChangeEvent>) {
    this.eventEmitterRepository = eventEmitterRepository;
  }

  /**
   * ファイル変更イベントのリスナーを登録
   */
  public onFileChanged(listener: (event: FileChangeEvent) => void): DisposableEvent {
    this.logger.debug('ファイル変更イベントリスナーが登録されました');
    return this.eventEmitterRepository.onEvent((event) => {
      this.logger.debug(`ファイル変更イベントリスナー実行: ${event.type} - ${event.filePath}`);
      listener(event);
    });
  }

  /**
   * ファイル変更イベントを発行
   */
  public notifyFileChanged(event: FileChangeEvent): void {
    this.logger.debug(`ファイル変更イベント発行: ${event.type} - ${event.filePath}`);
    this.eventEmitterRepository.fire(event);
  }

  /**
   * .dialogoi-meta.yamlの更新を通知
   */
  public notifyMetaYamlUpdated(metaYamlPath: string, metadata?: Record<string, unknown>): void {
    this.notifyFileChanged({
      type: FileChangeType.META_YAML_UPDATED,
      filePath: metaYamlPath,
      metadata,
    });
  }

  /**
   * ファイル移動を通知
   */
  public notifyFileMoved(
    oldPath: string,
    newPath: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.notifyFileChanged({
      type: FileChangeType.FILE_MOVED,
      filePath: newPath,
      oldPath,
      metadata,
    });
  }

  /**
   * ファイル作成を通知
   */
  public notifyFileCreated(filePath: string, metadata?: Record<string, unknown>): void {
    this.notifyFileChanged({
      type: FileChangeType.FILE_CREATED,
      filePath,
      metadata,
    });
  }

  /**
   * ファイル削除を通知
   */
  public notifyFileDeleted(filePath: string, metadata?: Record<string, unknown>): void {
    this.notifyFileChanged({
      type: FileChangeType.FILE_DELETED,
      filePath,
      metadata,
    });
  }

  /**
   * 参照関係の更新を通知
   */
  public notifyReferenceUpdated(filePath: string, metadata?: Record<string, unknown>): void {
    this.notifyFileChanged({
      type: FileChangeType.REFERENCE_UPDATED,
      filePath,
      metadata,
    });
  }

  /**
   * ファイル並び替えを通知
   */
  public notifyFileReordered(directoryPath: string, metadata?: Record<string, unknown>): void {
    this.notifyFileChanged({
      type: FileChangeType.FILE_REORDERED,
      filePath: directoryPath,
      metadata,
    });
  }

  /**
   * リソースのクリーンアップ
   */
  public dispose(): void {
    this.eventEmitterRepository.dispose();
  }
}
