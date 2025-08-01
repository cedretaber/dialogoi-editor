import { DialogoiTreeItem, hasTagsProperty } from '../models/DialogoiTreeItem.js';
import { Logger } from '../utils/Logger.js';
import { ReferenceService } from './ReferenceService.js';

/**
 * フィルタリング状態の定義
 */
export interface FilterState {
  isActive: boolean;
  filterType: 'tag' | 'reference' | 'fileType' | null;
  filterValue: string;
}

/**
 * TreeView用のフィルタリングサービス
 * VSCode非依存でテスト可能
 */
export class TreeViewFilterService {
  private filterState: FilterState = {
    isActive: false,
    filterType: null,
    filterValue: '',
  };
  private logger = Logger.getInstance();

  constructor(private referenceService: ReferenceService) {}

  /**
   * タグでフィルタリングを設定
   */
  setTagFilter(tagValue: string): void {
    this.filterState = {
      isActive: true,
      filterType: 'tag',
      filterValue: tagValue.toLowerCase().trim(),
    };
  }

  /**
   * 参照関係でフィルタリングを設定
   */
  setReferenceFilter(referenceValue: string): void {
    this.filterState = {
      isActive: true,
      filterType: 'reference',
      filterValue: referenceValue.toLowerCase().trim(),
    };
  }

  /**
   * ファイル種別でフィルタリングを設定
   */
  setFileTypeFilter(fileTypeValue: string): void {
    this.filterState = {
      isActive: true,
      filterType: 'fileType',
      filterValue: fileTypeValue.toLowerCase().trim(),
    };
  }

  /**
   * フィルターを解除
   */
  clearFilter(): void {
    this.filterState = {
      isActive: false,
      filterType: null,
      filterValue: '',
    };
  }

  /**
   * 現在のフィルター状態を取得
   */
  getFilterState(): FilterState {
    return { ...this.filterState };
  }

  /**
   * フィルターが適用されているかチェック
   */
  isFilterActive(): boolean {
    return this.filterState.isActive;
  }

  /**
   * フィルターを適用してアイテムを絞り込む
   */
  applyFilter(items: DialogoiTreeItem[]): DialogoiTreeItem[] {
    if (!this.filterState.isActive || !this.filterState.filterValue) {
      return items;
    }

    switch (this.filterState.filterType) {
      case 'tag':
        return this.filterByTag(items, this.filterState.filterValue);
      case 'reference':
        return this.filterByReference(items, this.filterState.filterValue);
      case 'fileType':
        return this.filterByFileType(items, this.filterState.filterValue);
      default:
        return items;
    }
  }

  /**
   * タグでフィルタリング
   */
  private filterByTag(items: DialogoiTreeItem[], tagValue: string): DialogoiTreeItem[] {
    this.logger.info(
      `タグフィルタリング開始: "${tagValue}" で ${items.length} 個のアイテムをフィルタリング`,
    );

    const result = items.filter((item) => {
      if (!hasTagsProperty(item) || item.tags.length === 0) {
        this.logger.info(`  ${item.name}: タグなし → 除外`);
        return false;
      }

      // 部分一致・大文字小文字無視でフィルタリング
      const hasMatchingTag = item.tags.some((tag: string) => tag.toLowerCase().includes(tagValue));
      this.logger.info(
        `  ${item.name}: tags=${JSON.stringify(hasTagsProperty(item) ? item.tags : [])} → ${hasMatchingTag ? '含む' : '除外'}`,
      );
      return hasMatchingTag;
    });

    this.logger.info(`タグフィルタリング結果: ${result.length} 個のアイテムが一致`);
    return result;
  }

  /**
   * 参照関係でフィルタリング
   */
  private filterByReference(items: DialogoiTreeItem[], referenceValue: string): DialogoiTreeItem[] {
    const referenceService = this.referenceService;

    return items.filter((item) => {
      // ReferenceServiceから実際の参照関係を取得
      const allReferencePaths = referenceService.getAllReferencePaths(item.path);

      if (allReferencePaths.length === 0) {
        return false;
      }
      return allReferencePaths.some((ref) => ref.toLowerCase().includes(referenceValue));
    });
  }

  /**
   * ファイル種別でフィルタリング
   */
  private filterByFileType(items: DialogoiTreeItem[], fileTypeValue: string): DialogoiTreeItem[] {
    return items.filter((item) => {
      return item.type.toLowerCase().includes(fileTypeValue);
    });
  }
}
