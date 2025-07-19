import { FileRepository } from '../repositories/FileRepository.js';
import { MockFileRepository } from '../repositories/MockFileRepository.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { HashService } from '../services/HashService.js';
import { ReviewService } from '../services/ReviewService.js';
import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiTemplateService } from '../services/DialogoiTemplateService.js';
import { ProjectCreationService } from '../services/ProjectCreationService.js';
import { MetaYamlService } from '../services/MetaYamlService.js';
import { FileOperationService } from '../services/FileOperationService.js';
import { Uri } from '../interfaces/Uri.js';
import { IServiceContainer } from './ServiceContainer.js';

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
  private reviewService: ReviewService | null = null;
  private dialogoiYamlService: DialogoiYamlService | null = null;
  private dialogoiTemplateService: DialogoiTemplateService | null = null;
  private projectCreationService: ProjectCreationService | null = null;
  private metaYamlService: MetaYamlService | null = null;
  private fileOperationService: FileOperationService | null = null;

  private constructor() {
    // テスト環境では常にMockFileRepositoryを使用
    this.fileRepository = new MockFileRepository();
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
      this.characterService = new CharacterService(this.fileRepository);
    }
    return this.characterService;
  }

  /**
   * ForeshadowingServiceを取得
   */
  getForeshadowingService(): ForeshadowingService {
    if (!this.foreshadowingService) {
      this.foreshadowingService = new ForeshadowingService(this.fileRepository);
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
   * ReviewServiceを取得
   */
  getReviewService(workspaceRoot: Uri): ReviewService {
    if (!this.reviewService) {
      this.reviewService = new ReviewService(
        this.fileRepository,
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
  getFileOperationService(): FileOperationService {
    if (!this.fileOperationService) {
      this.fileOperationService = new FileOperationService(
        this.fileRepository,
        this.getMetaYamlService(),
      );
    }
    return this.fileOperationService;
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
    this.reviewService = null;
    this.dialogoiYamlService = null;
    this.dialogoiTemplateService = null;
    this.projectCreationService = null;
    this.metaYamlService = null;
    this.fileOperationService = null;
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
