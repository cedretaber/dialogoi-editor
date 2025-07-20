import { FileRepository } from '../repositories/FileRepository.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { HashService } from '../services/HashService.js';
import { ReviewService } from '../services/ReviewService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiTemplateService } from '../services/DialogoiTemplateService.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { FileOperationService } from '../services/FileOperationService.js';
import { FilePathMapService } from '../services/FilePathMapService.js';
import { HyperlinkExtractorService } from '../services/HyperlinkExtractorService.js';
import { ProjectPathNormalizationService } from '../services/ProjectPathNormalizationService.js';
import { DropHandlerService } from '../services/DropHandlerService.js';
import { Uri } from '../interfaces/Uri.js';

/**
 * サービスコンテナのインターフェース
 */
export interface IServiceContainer {
  getFileRepository(): FileRepository;
  getCharacterService(): CharacterService;
  getForeshadowingService(): ForeshadowingService;
  getReferenceManager(): ReferenceManager;
  getHashService(): HashService;
  getReviewService(workspaceRoot: Uri): ReviewService;
  getDialogoiYamlService(): DialogoiYamlService;
  getDialogoiTemplateService(): DialogoiTemplateService;
  getMetaYamlService(): MetaYamlService;
  getFileOperationService(novelRootAbsolutePath?: string): FileOperationService;
  getFilePathMapService(): FilePathMapService;
  getHyperlinkExtractorService(): HyperlinkExtractorService;
  getProjectPathNormalizationService(): ProjectPathNormalizationService;
  getDropHandlerService(): DropHandlerService;
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
  private hashService: HashService | null = null;
  private reviewService: ReviewService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private dialogoiTemplateService: DialogoiTemplateService | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private fileOperationService: FileOperationService | null = null;
  private filePathMapService: FilePathMapService | null = null;
  private hyperlinkExtractorService: HyperlinkExtractorService | null = null;
  private projectPathNormalizationService: ProjectPathNormalizationService | null = null;
  private dropHandlerService: DropHandlerService | null = null;

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
    this.hashService = null;
    this.reviewService = null;
    this.dialogoiYamlService = null;
    this.dialogoiTemplateService = null;
    this.metaYamlService = null;
    this.fileOperationService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.projectPathNormalizationService = null;
    this.dropHandlerService = null;
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
      this.foreshadowingService = new ForeshadowingService(this.getFileRepository());
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
      this.hashService = new HashService(this.getFileRepository());
    }
    return this.hashService;
  }

  /**
   * ReviewServiceを取得
   */
  getReviewService(workspaceRoot: Uri): ReviewService {
    if (!this.reviewService) {
      this.reviewService = new ReviewService(
        this.getFileRepository(),
        this.getHashService(),
        workspaceRoot,
      );
    }
    return this.reviewService;
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
   * DialogoiTemplateServiceを取得
   */
  getDialogoiTemplateService(): DialogoiTemplateService {
    if (!this.dialogoiTemplateService) {
      this.dialogoiTemplateService = new DialogoiTemplateService(this.getFileRepository());
    }
    return this.dialogoiTemplateService;
  }

  /**
   * MetaYamlServiceを取得
   */
  getMetaYamlService(): MetaYamlService {
    if (!this.metaYamlService) {
      this.metaYamlService = new MetaYamlService(this.getFileRepository());
    }
    return this.metaYamlService;
  }

  /**
   * FileOperationServiceを取得
   */
  getFileOperationService(novelRootAbsolutePath?: string): FileOperationService {
    if (!this.fileOperationService) {
      this.fileOperationService = new FileOperationService(
        this.getFileRepository(),
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
        this.getFileRepository(),
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
      // プロジェクトルートを取得（ここでは仮のパスを使用、実際の使用時に適切なパスが設定される）
      this.projectPathNormalizationService = new ProjectPathNormalizationService('');
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
    this.hashService = null;
    this.reviewService = null;
    this.dialogoiYamlService = null;
    this.dialogoiTemplateService = null;
    this.metaYamlService = null;
    this.fileOperationService = null;
    this.filePathMapService = null;
    this.hyperlinkExtractorService = null;
    this.projectPathNormalizationService = null;
    this.dropHandlerService = null;
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
