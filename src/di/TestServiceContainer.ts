import { FileRepository } from '../repositories/FileRepository.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { HashService } from '../services/HashService.js';
import { CommentService } from '../services/CommentService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiTemplateService } from '../services/DialogoiTemplateService.js';
import { ProjectCreationService } from '../services/ProjectCreationService.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { FileOperationService } from '../services/FileOperationService.js';
import { FilePathMapService } from '../services/FilePathMapService.js';
import { HyperlinkExtractorService } from '../services/HyperlinkExtractorService.js';
import { ProjectPathNormalizationService } from '../services/ProjectPathNormalizationService.js';
import { DropHandlerService } from '../services/DropHandlerService.js';
import {
  FileChangeNotificationService,
  FileChangeEvent,
} from '../services/FileChangeNotificationService.js';
import { MockEventEmitterRepository } from '../repositories/MockEventEmitterRepository.js';
import { MockSettingsRepository } from '../repositories/MockSettingsRepository.js';
import { Uri } from '../interfaces/Uri.js';
import { IServiceContainer } from './ServiceContainer.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { DialogoiSettingsService } from '../services/DialogoiSettingsService.js';
import { ProjectSettingsService } from '../services/ProjectSettingsService.js';
import { Logger } from '../utils/Logger.js';

/**
 * テスト専用の依存関係注入コンテナ
 * VSCode依存を完全に排除し、すべてモックを使用
 */
export class TestServiceContainer implements IServiceContainer {
  private static instance: TestServiceContainer | null = null;
  private fileRepository: FileRepository;
  private characterService: CharacterService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private referenceManager: ReferenceManager | null = null;
  private hashService: HashService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private dialogoiTemplateService: DialogoiTemplateService | null = null;
  private projectCreationService: ProjectCreationService | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private fileOperationService: FileOperationService | null = null;
  private filePathMapService: FilePathMapService | null = null;
  private hyperlinkExtractorService: HyperlinkExtractorService | null = null;
  private projectPathNormalizationService: ProjectPathNormalizationService | null = null;
  private dropHandlerService: DropHandlerService | null = null;
  private settingsRepository: SettingsRepository | null = null;
  private dialogoiSettingsService: DialogoiSettingsService | null = null;
  private projectSettingsService: ProjectSettingsService | null = null;

  private constructor() {
    // テスト環境では常にMockFileRepositoryを使用
    this.fileRepository = new MockFileRepository();

    // テスト環境でFileChangeNotificationServiceを初期化
    const mockEventEmitterRepository = new MockEventEmitterRepository<FileChangeEvent>();
    FileChangeNotificationService.setInstance(mockEventEmitterRepository);

    // SettingsRepositoryの初期化
    const mockSettingsRepository = new MockSettingsRepository();
    this.setSettingsRepository(mockSettingsRepository);
  }

  static getInstance(): TestServiceContainer {
    if (!TestServiceContainer.instance) {
      TestServiceContainer.instance = new TestServiceContainer();
    }
    return TestServiceContainer.instance;
  }

  /**
   * FileRepositoryを取得
   */
  getFileRepository(): FileRepository {
    return this.fileRepository;
  }

  /**
   * CharacterServiceを取得
   */
  getCharacterService(): CharacterService {
    if (!this.characterService) {
      this.characterService = new CharacterService(this.fileRepository, this.getMetaYamlService());
    }
    return this.characterService;
  }

  /**
   * ForeshadowingServiceを取得
   */
  getForeshadowingService(): ForeshadowingService {
    if (!this.foreshadowingService) {
      this.foreshadowingService = new ForeshadowingService(
        this.fileRepository,
        this.getMetaYamlService(),
      );
    }
    return this.foreshadowingService;
  }

  /**
   * ReferenceManagerを取得
   */
  getReferenceManager(): ReferenceManager {
    if (!this.referenceManager) {
      this.referenceManager = ReferenceManager.getInstance();
    }
    return this.referenceManager;
  }

  /**
   * HashServiceを取得
   */
  getHashService(): HashService {
    if (!this.hashService) {
      this.hashService = new HashService(this.fileRepository);
    }
    return this.hashService;
  }


  /**
   * CommentServiceを取得
   */
  getCommentService(workspaceRoot: Uri): CommentService {
    return new CommentService(this.fileRepository, this.getHashService(), workspaceRoot);
  }

  /**
   * DialogoiYamlServiceを取得
   */
  getDialogoiYamlService(): DialogoiYamlService {
    if (!this.dialogoiYamlService) {
      this.dialogoiYamlService = new DialogoiYamlService(this.fileRepository);
    }
    return this.dialogoiYamlService;
  }

  /**
   * DialogoiTemplateServiceを取得
   */
  getDialogoiTemplateService(): DialogoiTemplateService {
    if (!this.dialogoiTemplateService) {
      this.dialogoiTemplateService = new DialogoiTemplateService(this.fileRepository);
    }
    return this.dialogoiTemplateService;
  }

  /**
   * ProjectCreationServiceを取得
   */
  getProjectCreationService(): ProjectCreationService {
    if (!this.projectCreationService) {
      this.projectCreationService = new ProjectCreationService(
        this.fileRepository,
        this.getDialogoiYamlService(),
        this.getDialogoiTemplateService(),
      );
    }
    return this.projectCreationService;
  }

  /**
   * MetaYamlServiceを取得
   */
  getMetaYamlService(): MetaYamlService {
    if (!this.metaYamlService) {
      this.metaYamlService = new MetaYamlService(this.fileRepository);
    }
    return this.metaYamlService;
  }

  /**
   * FileOperationServiceを取得
   */
  getFileOperationService(novelRootAbsolutePath?: string): FileOperationService {
    if (!this.fileOperationService) {
      this.fileOperationService = new FileOperationService(
        this.fileRepository,
        this.getMetaYamlService(),
        novelRootAbsolutePath,
      );
    }
    return this.fileOperationService;
  }

  /**
   * FilePathMapServiceを取得
   */
  getFilePathMapService(): FilePathMapService {
    if (!this.filePathMapService) {
      this.filePathMapService = new FilePathMapService(
        this.getMetaYamlService(),
        this.getFileOperationService(),
      );
    }
    return this.filePathMapService;
  }

  /**
   * HyperlinkExtractorServiceを取得
   */
  getHyperlinkExtractorService(): HyperlinkExtractorService {
    if (!this.hyperlinkExtractorService) {
      this.hyperlinkExtractorService = new HyperlinkExtractorService(
        this.fileRepository,
        this.getFilePathMapService(),
      );
    }
    return this.hyperlinkExtractorService;
  }

  /**
   * ProjectPathNormalizationServiceを取得
   */
  getProjectPathNormalizationService(): ProjectPathNormalizationService {
    if (!this.projectPathNormalizationService) {
      this.projectPathNormalizationService = new ProjectPathNormalizationService('/test');
    }
    return this.projectPathNormalizationService;
  }

  /**
   * DropHandlerServiceを取得
   */
  getDropHandlerService(): DropHandlerService {
    if (!this.dropHandlerService) {
      this.dropHandlerService = new DropHandlerService(
        this.getCharacterService(),
        this.getMetaYamlService(),
        this.getDialogoiYamlService(),
      );
    }
    return this.dropHandlerService;
  }

  /**
   * すべてのサービスをリセット（テスト用）
   */
  reset(): void {
    this.fileRepository = new MockFileRepository();
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceManager = null;
    this.hashService = null;
    this.dialogoiYamlService = null;
    this.dialogoiTemplateService = null;
    this.projectCreationService = null;
    this.metaYamlService = null;
    this.fileOperationService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.projectPathNormalizationService = null;
    this.dropHandlerService = null;
    this.settingsRepository = null;
    this.dialogoiSettingsService = null;
  }

  getSettingsRepository(): SettingsRepository {
    if (!this.settingsRepository) {
      throw new Error('SettingsRepository has not been set');
    }
    return this.settingsRepository;
  }

  setSettingsRepository(repository: SettingsRepository): void {
    this.settingsRepository = repository;
  }

  getDialogoiSettingsService(): DialogoiSettingsService {
    if (!this.dialogoiSettingsService) {
      const settingsRepository = this.getSettingsRepository();
      this.dialogoiSettingsService = new DialogoiSettingsService(settingsRepository);
    }
    return this.dialogoiSettingsService;
  }

  getProjectSettingsService(): ProjectSettingsService {
    if (!this.projectSettingsService) {
      const dialogoiYamlService = this.getDialogoiYamlService();
      const logger = Logger.getInstance();
      this.projectSettingsService = new ProjectSettingsService(dialogoiYamlService, logger);
    }
    return this.projectSettingsService;
  }

  /**
   * MockFileRepositoryを取得（テスト用）
   */
  getMockFileRepository(): MockFileRepository {
    return this.fileRepository as MockFileRepository;
  }

  /**
   * 新しいテストコンテナを作成（スタティックメソッド）
   */
  static create(): TestServiceContainer {
    return new TestServiceContainer();
  }

  /**
   * テストクリーンアップ
   */
  cleanup(): void {
    // MockFileRepositoryのリセット
    if (this.fileRepository instanceof MockFileRepository) {
      this.fileRepository.reset();
    }

    // ReferenceManagerのクリア
    if (this.referenceManager) {
      this.referenceManager.clear();
    }
  }
}
