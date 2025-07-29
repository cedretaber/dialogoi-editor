import { FileRepository } from '../repositories/FileRepository.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { CommentService } from '../services/CommentService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { MetaYamlServiceImpl } from '../services/MetaYamlServiceImpl.js';
import { MetadataService } from '../services/MetadataService.js';
import { FilePathMapService } from '../services/FilePathMapService.js';
import { HyperlinkExtractorService } from '../services/HyperlinkExtractorService.js';
import { DropHandlerService } from '../services/DropHandlerService.js';
import { SettingsRepository } from '../repositories/SettingsRepository.js';
import { DialogoiSettingsService } from '../services/DialogoiSettingsService.js';
import { ProjectSettingsService } from '../services/ProjectSettingsService.js';
import { FileStatusService } from '../services/FileStatusService.js';
import { FileManagementService } from '../services/FileManagementService.js';
import { FileTypeConversionService } from '../services/FileTypeConversionService.js';
import { ProjectPathService } from '../services/ProjectPathService.js';
import { ProjectAutoSetupService } from '../services/ProjectAutoSetupService.js';
import { ProjectSetupService } from '../services/ProjectSetupService.js';
import { CoreFileService } from '../services/CoreFileService.js';
import { ProjectLinkUpdateServiceImpl } from '../services/ProjectLinkUpdateServiceImpl.js';
import { Logger } from '../utils/Logger.js';
import { Uri } from '../interfaces/Uri.js';

/**
 * サービスコンテナのインターフェース
 */
export interface IServiceContainer {
  getFileRepository(): FileRepository;
  getCharacterService(): CharacterService;
  getForeshadowingService(): ForeshadowingService;
  getReferenceManager(): ReferenceManager;
  getCommentService(workspaceRoot: Uri): CommentService;
  getDialogoiYamlService(): DialogoiYamlService;
  getMetaYamlService(): MetaYamlService;
  getMetadataService(): MetadataService;
  getFilePathMapService(): FilePathMapService;
  getHyperlinkExtractorService(): HyperlinkExtractorService;
  getDropHandlerService(): DropHandlerService;
  getSettingsRepository(): SettingsRepository;
  setSettingsRepository(repository: SettingsRepository): void;
  getDialogoiSettingsService(): DialogoiSettingsService;
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
  private static testInstance: IServiceContainer | null = null;
  protected fileRepository: FileRepository | null = null;
  private characterService: CharacterService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private referenceManager: ReferenceManager | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private metadataService: MetadataService | null = null;
  private filePathMapService: FilePathMapService | null = null;
  private hyperlinkExtractorService: HyperlinkExtractorService | null = null;
  private dropHandlerService: DropHandlerService | null = null;
  private settingsRepository: SettingsRepository | null = null;
  private dialogoiSettingsService: DialogoiSettingsService | null = null;
  private projectSettingsService: ProjectSettingsService | null = null;
  private fileStatusService: FileStatusService | null = null;
  private fileManagementService: FileManagementService | null = null;
  private fileTypeConversionService: FileTypeConversionService | null = null;
  private projectAutoSetupService: ProjectAutoSetupService | null = null;
  private projectSetupService: ProjectSetupService | null = null;
  private projectPathService: ProjectPathService | null = null;
  private coreFileService: CoreFileService | null = null;

  protected constructor() {}

  static getInstance(): IServiceContainer {
    // テスト用のインスタンスが設定されている場合はそれを返す
    if (ServiceContainer.testInstance !== null) {
      return ServiceContainer.testInstance;
    }

    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * FileRepositoryを設定（テスト用）
   */
  setFileRepository(repository: FileRepository): void {
    this.fileRepository = repository;
    // 依存サービスをリセット
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceManager = null;
    this.dialogoiYamlService = null;
    this.metaYamlService = null;
    this.metadataService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.dropHandlerService = null;
    this.projectSettingsService = null;
    this.fileStatusService = null;
  }

  /**
   * FileRepositoryを取得
   */
  getFileRepository(): FileRepository {
    if (!this.fileRepository) {
      throw new Error(
        'FileRepositoryが初期化されていません。VSCodeServiceContainer.initialize()を使用してください。',
      );
    }
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
   * ReferenceManagerを取得
   */
  getReferenceManager(): ReferenceManager {
    if (!this.referenceManager) {
      this.referenceManager = ReferenceManager.getInstance();
    }
    return this.referenceManager;
  }

  /**
   * CommentServiceを取得
   */
  getCommentService(workspaceRoot: Uri): CommentService {
    return new CommentService(
      this.getFileRepository(),
      this.getDialogoiYamlService(),
      workspaceRoot,
    );
  }

  /**
   * DialogoiYamlServiceを取得
   */
  getDialogoiYamlService(): DialogoiYamlService {
    if (!this.dialogoiYamlService) {
      this.dialogoiYamlService = new DialogoiYamlService(this.getFileRepository());
    }
    return this.dialogoiYamlService;
  }

  /**
   * MetaYamlServiceを取得
   */
  getMetaYamlService(): MetaYamlService {
    if (!this.metaYamlService) {
      this.metaYamlService = new MetaYamlServiceImpl(this.getFileRepository());
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
      );
    }
    return this.dropHandlerService;
  }

  /**
   * テスト用のモックサービスでコンテナを初期化
   * @deprecated テスト環境ではTestServiceContainerを使用してください
   */
  initializeForTesting(): void {
    this.setFileRepository(new MockFileRepository());
  }

  /**
   * サービスをリセット（テスト用）
   */
  reset(): void {
    this.fileRepository = null;
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceManager = null;
    this.dialogoiYamlService = null;
    this.metaYamlService = null;
    this.metadataService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.dropHandlerService = null;
    this.settingsRepository = null;
    this.dialogoiSettingsService = null;
    this.fileStatusService = null;
    this.fileManagementService = null;
    this.fileTypeConversionService = null;
    this.projectAutoSetupService = null;
    this.projectSetupService = null;
    this.projectPathService = null;
    this.coreFileService = null;
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
      this.fileTypeConversionService = new FileTypeConversionService(
        fileRepository,
        metaYamlService,
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
      return new CoreFileService(
        this.getFileRepository(),
        this.getMetaYamlService(),
        linkUpdateService,
        novelRootAbsolutePath,
      );
    }

    // novelRootAbsolutePathが指定されていない場合は、キャッシュされたインスタンスを使用
    if (!this.coreFileService) {
      this.coreFileService = new CoreFileService(
        this.getFileRepository(),
        this.getMetaYamlService(),
        undefined,
        undefined,
      );
    }
    return this.coreFileService;
  }

  /**
   * テスト用のインスタンスを設定
   */
  static setTestInstance(instance: IServiceContainer): void {
    ServiceContainer.testInstance = instance;
  }

  /**
   * テスト用のインスタンスをクリア
   */
  static clearTestInstance(): void {
    ServiceContainer.testInstance = null;
  }
}
