// 抽象クラスと型をエクスポート
export { FileOperationService } from '../interfaces/FileOperationService.js';
export type { FileOperationResult, FileStats, DirectoryEntry } from '../interfaces/FileOperationService.js';

// VSCodeFileOperationServiceは動的インポートでのみ使用するため、ここではエクスポートしない