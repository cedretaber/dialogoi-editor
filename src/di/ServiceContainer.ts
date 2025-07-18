import { FileOperationService } from '../interfaces/FileOperationService.js';
import { MockFileOperationService } from '../services/MockFileOperationService.js';
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
  private fileOperationService: FileOperationService | null = null;
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
   * FileOperationServiceを設定（テスト用）
   */
  setFileOperationService(service: FileOperationService): void {
    this.fileOperationService = service;
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
   * FileOperationServiceを取得
   */
  getFileOperationService(): FileOperationService {
    if (!this.fileOperationService) {
      throw new Error(
        'FileOperationServiceが初期化されていません。VSCodeServiceContainer.initialize()を使用してください。',
      );
    }
    return this.fileOperationService;
  }

  /**
   * CharacterServiceを取得
   */
  getCharacterService(): CharacterService {
    if (!this.characterService) {
      this.characterService = new CharacterService(this.getFileOperationService());
    }
    return this.characterService;
  }

  /**
   * ForeshadowingServiceを取得
   */
  getForeshadowingService(): ForeshadowingService {
    if (!this.foreshadowingService) {
      this.foreshadowingService = new ForeshadowingService(this.getFileOperationService());
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
      this.hashService = new HashService(this.getFileOperationService());
    }
    return this.hashService;
  }

  /**
   * ReviewServiceを取得
   */
  getReviewService(workspaceRoot: Uri): ReviewService {
    if (!this.reviewService) {
      this.reviewService = new ReviewService(
        this.getFileOperationService(),
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
      this.dialogoiYamlService = new DialogoiYamlService(this.getFileOperationService());
    }
    return this.dialogoiYamlService;
  }

  /**
   * DialogoiTemplateServiceを取得
   */
  getDialogiTemplateService(): DialogoiTemplateService {
    if (!this.dialogoiTemplateService) {
      this.dialogoiTemplateService = new DialogoiTemplateService(this.getFileOperationService());
    }
    return this.dialogoiTemplateService;
  }

  /**
   * テスト用のモックサービスでコンテナを初期化
   * @deprecated テスト環境ではTestServiceContainerを使用してください
   */
  initializeForTesting(): void {
    this.setFileOperationService(new MockFileOperationService());
  }

  /**
   * サービスをリセット（テスト用）
   */
  reset(): void {
    this.fileOperationService = null;
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceManager = null;
    this.hashService = null;
    this.reviewService = null;
    this.dialogoiYamlService = null;
    this.dialogoiTemplateService = null;
  }
}
