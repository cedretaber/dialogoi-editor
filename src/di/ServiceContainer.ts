import { FileRepository } from '../repositories/FileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceService } from '../services/ReferenceService.js';
import { CommentService } from '../services/CommentService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiYamlServiceImpl } from '../services/DialogoiYamlServiceImpl.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { MetaYamlServiceImpl } from '../services/MetaYamlServiceImpl.js';
import { MetadataService } from '../services/MetadataService.js';
import { FilePathMapService } from '../services/FilePathMapService.js';
import { HyperlinkExtractorService } from '../services/HyperlinkExtractorService.js';
import { DropHandlerService } from '../services/DropHandlerService.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { DialogoiSettingsService } from '../services/DialogoiSettingsService.js';
import { DialogoiPathService } from '../services/DialogoiPathService.js';
import { ProjectSettingsService } from '../services/ProjectSettingsService.js';
import { FileStatusService } from '../services/FileStatusService.js';
import { FileManagementService } from '../services/FileManagementService.js';
import { FileTypeConversionService } from '../services/FileTypeConversionService.js';
import { ProjectPathService } from '../services/ProjectPathService.js';
import { ProjectAutoSetupService } from '../services/ProjectAutoSetupService.js';
import { ProjectSetupService } from '../services/ProjectSetupService.js';
import { CoreFileService } from '../services/CoreFileService.js';
import { CoreFileServiceImpl } from '../services/CoreFileServiceImpl.js';
import { ProjectLinkUpdateServiceImpl } from '../services/ProjectLinkUpdateServiceImpl.js';
import { Logger } from '../utils/Logger.js';
import { Uri } from '../interfaces/Uri.js';
import { EventEmitterRepository } from '../repositories/EventEmitterRepository.js';
import {
  FileChangeEvent,
  FileChangeNotificationService,
} from '../services/FileChangeNotificationService.js';

/**
 * サービスコンテナのインターフェース
 */
export interface IServiceContainer {
  getFileRepository(): FileRepository;
  getCharacterService(): CharacterService;
  getForeshadowingService(): ForeshadowingService;
  getReferenceService(): ReferenceService;
  getCommentService(workspaceRoot: Uri): CommentService;
  getDialogoiYamlService(): DialogoiYamlService;
  getMetaYamlService(): MetaYamlService;
  getMetadataService(): MetadataService;
  getFilePathMapService(): FilePathMapService;
  getHyperlinkExtractorService(): HyperlinkExtractorService;
  getDropHandlerService(): DropHandlerService;
  getSettingsRepository(): SettingsRepository;
  getEventEmitterRepository(): EventEmitterRepository<FileChangeEvent>;
  getFileChangeNotificationService(): FileChangeNotificationService;
  getDialogoiSettingsService(): DialogoiSettingsService;
  getDialogoiPathService(): DialogoiPathService;
  getProjectSettingsService(): ProjectSettingsService;
  getFileStatusService(): FileStatusService;
  getFileManagementService(): FileManagementService;
  getFileTypeConversionService(): FileTypeConversionService;
  getProjectAutoSetupService(): ProjectAutoSetupService;
  getProjectSetupService(): ProjectSetupService;
  getProjectPathService(): ProjectPathService;
  getCoreFileService(novelRootAbsolutePath?: string): CoreFileService;
  reset(): void;
}

/**
 * 本番環境用の依存関係注入コンテナ
 * VSCode環境でのみ使用される
 */
export class ServiceContainer implements IServiceContainer {
  private static instance: ServiceContainer | null = null;
  protected fileRepository: FileRepository;
  protected settingsRepository: SettingsRepository;
  protected eventEmitterRepository: EventEmitterRepository<FileChangeEvent>;
  private characterService: CharacterService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private referenceService: ReferenceService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private metadataService: MetadataService | null = null;
  private filePathMapService: FilePathMapService | null = null;
  private hyperlinkExtractorService: HyperlinkExtractorService | null = null;
  private dropHandlerService: DropHandlerService | null = null;
  private dialogoiSettingsService: DialogoiSettingsService | null = null;
  private dialogoiPathService: DialogoiPathService | null = null;
  private projectSettingsService: ProjectSettingsService | null = null;
  private fileStatusService: FileStatusService | null = null;
  private fileManagementService: FileManagementService | null = null;
  private fileTypeConversionService: FileTypeConversionService | null = null;
  private projectAutoSetupService: ProjectAutoSetupService | null = null;
  private projectSetupService: ProjectSetupService | null = null;
  private projectPathService: ProjectPathService | null = null;
  private coreFileService: CoreFileService | null = null;
  private fileChangeNotificationService: FileChangeNotificationService | null = null;

  private constructor(
    fileRepository: FileRepository,
    settingsRepository: SettingsRepository,
    eventEmitterRepository: EventEmitterRepository<FileChangeEvent>,
  ) {
    this.fileRepository = fileRepository;
    this.settingsRepository = settingsRepository;
    this.eventEmitterRepository = eventEmitterRepository;
  }

  /**
   * レポジトリを注入してServiceContainerインスタンスを作成
   */
  static createInstance(
    fileRepository: FileRepository,
    settingsRepository: SettingsRepository,
    eventEmitterRepository: EventEmitterRepository<FileChangeEvent>,
  ): void {
    ServiceContainer.instance = new ServiceContainer(
      fileRepository,
      settingsRepository,
      eventEmitterRepository,
    );
  }

  /**
   * ServiceContainerのインスタンスを取得
   */
  static getInstance(): IServiceContainer {
    if (!ServiceContainer.instance) {
      throw new Error(
        'ServiceContainer is not initialized. Call createInstance() first or use VSCodeServiceContainer.initialize().',
      );
    }
    return ServiceContainer.instance;
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
      this.characterService = new CharacterService(
        this.getFileRepository(),
        this.getMetaYamlService(),
      );
    }
    return this.characterService;
  }

  /**
   * ForeshadowingServiceを取得
   */
  getForeshadowingService(): ForeshadowingService {
    if (!this.foreshadowingService) {
      this.foreshadowingService = new ForeshadowingService(
        this.getFileRepository(),
        this.getMetaYamlService(),
      );
    }
    return this.foreshadowingService;
  }

  /**
   * ReferenceServiceを取得
   */
  getReferenceService(): ReferenceService {
    if (!this.referenceService) {
      this.referenceService = new ReferenceService(
        this.getFileRepository(),
        this.getMetaYamlService(),
        this.getHyperlinkExtractorService(),
        this.getFilePathMapService(),
      );
    }
    return this.referenceService;
  }

  /**
   * CommentServiceを取得
   */
  getCommentService(workspaceRoot: Uri): CommentService {
    return new CommentService(
      this.getFileRepository(),
      this.getDialogoiYamlService(),
      this.getDialogoiPathService(),
      workspaceRoot,
    );
  }

  /**
   * DialogoiYamlServiceを取得
   */
  getDialogoiYamlService(): DialogoiYamlService {
    if (!this.dialogoiYamlService) {
      this.dialogoiYamlService = new DialogoiYamlServiceImpl(this.getFileRepository());
    }
    return this.dialogoiYamlService;
  }

  /**
   * MetaYamlServiceを取得
   */
  getMetaYamlService(): MetaYamlService {
    if (!this.metaYamlService) {
      this.metaYamlService = new MetaYamlServiceImpl(
        this.getFileRepository(),
        this.getDialogoiPathService(),
      );
    }
    return this.metaYamlService;
  }

  /**
   * MetadataServiceを取得
   */
  getMetadataService(): MetadataService {
    if (!this.metadataService) {
      this.metadataService = new MetadataService(this.getMetaYamlService());
    }
    return this.metadataService;
  }

  /**
   * FilePathMapServiceを取得
   */
  getFilePathMapService(): FilePathMapService {
    if (!this.filePathMapService) {
      this.filePathMapService = new FilePathMapService(
        this.getMetaYamlService(),
        this.getCoreFileService(),
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
        this.getFileRepository(),
        this.getFilePathMapService(),
      );
    }
    return this.hyperlinkExtractorService;
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
        this.getFileChangeNotificationService(),
        this.getReferenceService(),
      );
    }
    return this.dropHandlerService;
  }

  /**
   * サービスをリセット（テスト用）
   */
  reset(): void {
    ServiceContainer.instance = null;
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceService = null;
    this.dialogoiYamlService = null;
    this.metaYamlService = null;
    this.metadataService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.dropHandlerService = null;
    this.dialogoiSettingsService = null;
    this.dialogoiPathService = null;
    this.fileStatusService = null;
    this.fileManagementService = null;
    this.fileTypeConversionService = null;
    this.projectAutoSetupService = null;
    this.projectSetupService = null;
    this.projectPathService = null;
    this.coreFileService = null;
    this.fileChangeNotificationService = null;
  }

  getSettingsRepository(): SettingsRepository {
    return this.settingsRepository;
  }

  /**
   * EventEmitterRepositoryを取得
   */
  getEventEmitterRepository(): EventEmitterRepository<FileChangeEvent> {
    return this.eventEmitterRepository;
  }

  /**
   * FileChangeNotificationServiceを取得
   */
  getFileChangeNotificationService(): FileChangeNotificationService {
    if (!this.fileChangeNotificationService) {
      this.fileChangeNotificationService = new FileChangeNotificationService(
        this.eventEmitterRepository,
      );
    }
    return this.fileChangeNotificationService;
  }

  getDialogoiSettingsService(): DialogoiSettingsService {
    if (!this.dialogoiSettingsService) {
      const settingsRepository = this.getSettingsRepository();
      this.dialogoiSettingsService = new DialogoiSettingsService(settingsRepository);
    }
    return this.dialogoiSettingsService;
  }

  getDialogoiPathService(): DialogoiPathService {
    if (!this.dialogoiPathService) {
      const fileRepository = this.getFileRepository();
      this.dialogoiPathService = new DialogoiPathService(fileRepository);
    }
    return this.dialogoiPathService;
  }

  getProjectSettingsService(): ProjectSettingsService {
    if (!this.projectSettingsService) {
      const dialogoiYamlService = this.getDialogoiYamlService();
      const projectSetupService = this.getProjectSetupService();
      const logger = Logger.getInstance();
      this.projectSettingsService = new ProjectSettingsService(
        dialogoiYamlService,
        projectSetupService,
        logger,
      );
    }
    return this.projectSettingsService;
  }

  getFileStatusService(): FileStatusService {
    if (!this.fileStatusService) {
      const fileRepository = this.getFileRepository();
      const metaYamlService = this.getMetaYamlService();
      this.fileStatusService = new FileStatusService(fileRepository, metaYamlService);
    }
    return this.fileStatusService;
  }

  getFileManagementService(): FileManagementService {
    if (!this.fileManagementService) {
      const fileRepository = this.getFileRepository();
      const metaYamlService = this.getMetaYamlService();
      this.fileManagementService = new FileManagementService(fileRepository, metaYamlService);
    }
    return this.fileManagementService;
  }

  getFileTypeConversionService(): FileTypeConversionService {
    if (!this.fileTypeConversionService) {
      const fileRepository = this.getFileRepository();
      const metaYamlService = this.getMetaYamlService();
      const fileChangeNotificationService = this.getFileChangeNotificationService();
      this.fileTypeConversionService = new FileTypeConversionService(
        fileRepository,
        metaYamlService,
        fileChangeNotificationService,
      );
    }
    return this.fileTypeConversionService;
  }

  getProjectAutoSetupService(): ProjectAutoSetupService {
    if (!this.projectAutoSetupService) {
      const fileRepository = this.getFileRepository();
      const metaYamlService = this.getMetaYamlService();
      const dialogoiYamlService = this.getDialogoiYamlService();
      this.projectAutoSetupService = new ProjectAutoSetupService(
        fileRepository,
        metaYamlService,
        dialogoiYamlService,
      );
    }
    return this.projectAutoSetupService;
  }

  getProjectSetupService(): ProjectSetupService {
    if (!this.projectSetupService) {
      const dialogoiYamlService = this.getDialogoiYamlService();
      const projectAutoSetupService = this.getProjectAutoSetupService();
      this.projectSetupService = new ProjectSetupService(
        dialogoiYamlService,
        projectAutoSetupService,
      );
    }
    return this.projectSetupService;
  }

  getProjectPathService(): ProjectPathService {
    if (!this.projectPathService) {
      const dialogoiYamlService = this.getDialogoiYamlService();
      this.projectPathService = new ProjectPathService(dialogoiYamlService);
    }
    return this.projectPathService;
  }

  getCoreFileService(novelRootAbsolutePath?: string): CoreFileService {
    // novelRootAbsolutePathが指定された場合は、常に新しいインスタンスを作成
    if (
      novelRootAbsolutePath !== undefined &&
      novelRootAbsolutePath !== null &&
      novelRootAbsolutePath !== ''
    ) {
      const linkUpdateService = new ProjectLinkUpdateServiceImpl(
        this.getFileRepository(),
        this.getMetaYamlService(),
        novelRootAbsolutePath,
      );
      return new CoreFileServiceImpl(
        this.getFileRepository(),
        this.getMetaYamlService(),
        linkUpdateService,
        novelRootAbsolutePath,
      );
    }

    // novelRootAbsolutePathが指定されていない場合は、キャッシュされたインスタンスを使用
    if (!this.coreFileService) {
      this.coreFileService = new CoreFileServiceImpl(
        this.getFileRepository(),
        this.getMetaYamlService(),
        undefined,
        undefined,
      );
    }
    return this.coreFileService;
  }
}
