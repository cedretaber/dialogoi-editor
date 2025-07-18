import { FileRepository } from '../repositories/FileRepository.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { HashService } from '../services/HashService.js';
import { ReviewService } from '../services/ReviewService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiTemplateService } from '../services/DialogoiTemplateService.js';
import { Uri } from '../interfaces/Uri.js';

/**
 * 本番環境用の依存関係注入コンテナ
 * VSCode環境でのみ使用される
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  private fileRepository: FileRepository | null = null;
  private characterService: CharacterService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private referenceManager: ReferenceManager | null = null;
  private hashService: HashService | null = null;
  private reviewService: ReviewService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private dialogoiTemplateService: DialogoiTemplateService | null = null;

  private constructor() {}

  static getInstance(): ServiceContainer {
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
      this.characterService = new CharacterService(this.getFileRepository());
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
  getDialogiTemplateService(): DialogoiTemplateService {
    if (!this.dialogoiTemplateService) {
      this.dialogoiTemplateService = new DialogoiTemplateService(this.getFileRepository());
    }
    return this.dialogoiTemplateService;
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
  }
}
