import {
  FileChangeNotificationService,
  FileChangeEvent,
  FileChangeType,
} from './FileChangeNotificationService.js';
import { MockEventEmitterRepository } from '../repositories/MockEventEmitterRepository.js';

describe('FileChangeNotificationService', () => {
  let service: FileChangeNotificationService;
  let mockEventEmitterRepository: MockEventEmitterRepository<FileChangeEvent>;

  beforeEach(() => {
    mockEventEmitterRepository = new MockEventEmitterRepository<FileChangeEvent>();
    FileChangeNotificationService.setInstance(mockEventEmitterRepository);
    service = FileChangeNotificationService.getInstance();
  });

  describe('notifyReferenceUpdated', () => {
    it('参照更新イベントが正しく発行される', () => {
      const testFilePath = '/test/file.txt';
      const testMetadata = { operation: 'add', reference: 'test-ref' };

      service.notifyReferenceUpdated(testFilePath, testMetadata);

      const firedEvents = mockEventEmitterRepository.getFiredEvents();
      expect(firedEvents.length).toBe(1);

      const event = firedEvents[0];
      expect(event).toBeTruthy();
      expect(event?.type).toBe(FileChangeType.REFERENCE_UPDATED);
      expect(event?.filePath).toBe(testFilePath);
      expect(event?.metadata).toEqual(testMetadata);
    });
  });

  describe('onFileChanged', () => {
    it('イベントリスナーが正しく登録され、イベントを受信する', () => {
      const receivedEvents: FileChangeEvent[] = [];

      // リスナーを登録
      const disposable = service.onFileChanged((event) => {
        receivedEvents.push(event);
      });

      // イベントを発行
      const testEvent: FileChangeEvent = {
        type: FileChangeType.REFERENCE_UPDATED,
        filePath: '/test/file.txt',
        metadata: { operation: 'test' },
      };

      service.notifyFileChanged(testEvent);

      // リスナーがイベントを受信したことを確認
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0]).toEqual(testEvent);

      // リソースクリーンアップ
      disposable.dispose();
    });

    it('dispose後はイベントを受信しない', () => {
      const receivedEvents: FileChangeEvent[] = [];

      // リスナーを登録
      const disposable = service.onFileChanged((event) => {
        receivedEvents.push(event);
      });

      // dispose
      disposable.dispose();

      // イベントを発行
      const testEvent: FileChangeEvent = {
        type: FileChangeType.REFERENCE_UPDATED,
        filePath: '/test/file.txt',
      };

      service.notifyFileChanged(testEvent);

      // リスナーがイベントを受信していないことを確認
      expect(receivedEvents.length).toBe(0);
    });
  });

  describe('notifyMetaYamlUpdated', () => {
    it('meta.yaml更新イベントが正しく発行される', () => {
      const testFilePath = '/test/.dialogoi-meta.yaml';
      const testMetadata = { operation: 'add_tag', tag: 'test-tag' };

      service.notifyMetaYamlUpdated(testFilePath, testMetadata);

      const firedEvents = mockEventEmitterRepository.getFiredEvents();
      expect(firedEvents.length).toBe(1);

      const event = firedEvents[0];
      expect(event).toBeTruthy();
      expect(event?.type).toBe(FileChangeType.META_YAML_UPDATED);
      expect(event?.filePath).toBe(testFilePath);
      expect(event?.metadata).toEqual(testMetadata);
    });
  });

  describe('getInstance', () => {
    it('setInstanceで設定されていない場合はエラーを投げる', () => {
      // インスタンスをクリア
      FileChangeNotificationService['instance'] = null;

      expect(() => {
        FileChangeNotificationService.getInstance();
      }).toThrow(/FileChangeNotificationServiceが初期化されていません/);
    });
  });
});
