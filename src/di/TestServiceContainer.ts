import { FileOperationService } from '../interfaces/FileOperationService.js';
import { MockFileOperationService } from '../services/MockFileOperationService.js';
import { CharacterService } from '../services/CharacterService.js';
import { ForeshadowingService } from '../services/ForeshadowingService.js';
import { ReferenceManager } from '../services/ReferenceManager.js';
import { HashService } from '../services/HashService.js';
import { ReviewService } from '../services/ReviewService.js';
import { Uri } from '../interfaces/Uri.js';

/**
 * テスト専用の依存関係注入コンテナ
 * VSCode依存を完全に排除し、すべてモックを使用
 */
export class TestServiceContainer {
  private static instance: TestServiceContainer | null = null;
  private fileOperationService: FileOperationService;
  private characterService: CharacterService | null = null;
  private foreshadowingService: ForeshadowingService | null = null;
  private referenceManager: ReferenceManager | null = null;
  private hashService: HashService | null = null;
  private reviewService: ReviewService | null = null;

  private constructor() {
    // テスト環境では常にMockFileOperationServiceを使用
    this.fileOperationService = new MockFileOperationService();
  }

  static getInstance(): TestServiceContainer {
    if (!TestServiceContainer.instance) {
      TestServiceContainer.instance = new TestServiceContainer();
    }
    return TestServiceContainer.instance;
  }

  /**
   * FileOperationServiceを取得
   */
  getFileOperationService(): FileOperationService {
    return this.fileOperationService;
  }

  /**
   * CharacterServiceを取得
   */
  getCharacterService(): CharacterService {
    if (!this.characterService) {
      this.characterService = new CharacterService(this.fileOperationService);
    }
    return this.characterService;
  }

  /**
   * ForeshadowingServiceを取得
   */
  getForeshadowingService(): ForeshadowingService {
    if (!this.foreshadowingService) {
      this.foreshadowingService = new ForeshadowingService(this.fileOperationService);
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
      this.hashService = new HashService(this.fileOperationService);
    }
    return this.hashService;
  }

  /**
   * ReviewServiceを取得
   */
  getReviewService(workspaceRoot: Uri): ReviewService {
    if (!this.reviewService) {
      this.reviewService = new ReviewService(
        this.fileOperationService,
        this.getHashService(),
        workspaceRoot,
      );
    }
    return this.reviewService;
  }

  /**
   * すべてのサービスをリセット（テスト用）
   */
  reset(): void {
    this.fileOperationService = new MockFileOperationService();
    this.characterService = null;
    this.foreshadowingService = null;
    this.referenceManager = null;
    this.hashService = null;
    this.reviewService = null;
  }

  /**
   * MockFileOperationServiceを取得（テスト用）
   */
  getMockFileOperationService(): MockFileOperationService {
    return this.fileOperationService as MockFileOperationService;
  }
}
