/**
 * DialogoiTreeItem関連の型定義・型ガード・補助関数
 *
 * MetaYamlUtils.tsから移動された統合データ構造の型定義を提供
 * UI層・サービス層・データ層すべてで使用される中核的な型
 */

export interface ForeshadowingPoint {
  location: string;
  comment: string;
}

export interface DialogoiTreeItemBase {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;
  isUntracked: boolean;
  isMissing: boolean;
}

export interface SubdirectoryItem extends DialogoiTreeItemBase {
  type: 'subdirectory';
}

export interface ContentItem extends DialogoiTreeItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments?: string;
}

export interface SettingItem extends DialogoiTreeItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments?: string;
}

export interface CharacterItem extends SettingItem {
  character: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name: string;
  };
}

export interface ForeshadowingItem extends SettingItem {
  foreshadowing: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
}

export interface GlossaryItem extends SettingItem {
  glossary: true;
}

export type DialogoiTreeItem =
  | SubdirectoryItem
  | ContentItem
  | SettingItem
  | CharacterItem
  | ForeshadowingItem
  | GlossaryItem;

// ===== 型ガード関数 =====

/**
 * サブディレクトリアイテムかどうかを判定
 */
export function isSubdirectoryItem(item: DialogoiTreeItem): item is SubdirectoryItem {
  return item.type === 'subdirectory';
}

/**
 * コンテンツアイテムかどうかを判定
 */
export function isContentItem(item: DialogoiTreeItem): item is ContentItem {
  return item.type === 'content';
}

/**
 * 設定アイテムかどうかを判定
 */
export function isSettingItem(item: DialogoiTreeItem): item is SettingItem {
  return (
    item.type === 'setting' &&
    !('character' in item) &&
    !('foreshadowing' in item) &&
    !('glossary' in item)
  );
}

/**
 * キャラクターアイテムかどうかを判定
 */
export function isCharacterItem(item: DialogoiTreeItem): item is CharacterItem {
  return item.type === 'setting' && 'character' in item;
}

/**
 * 伏線アイテムかどうかを判定
 */
export function isForeshadowingItem(item: DialogoiTreeItem): item is ForeshadowingItem {
  return item.type === 'setting' && 'foreshadowing' in item;
}

/**
 * 用語集アイテムかどうかを判定
 */
export function isGlossaryItem(item: DialogoiTreeItem): item is GlossaryItem {
  return item.type === 'setting' && 'glossary' in item;
}

// ===== 補助関数（プロパティ安全アクセス用） =====

/**
 * アイテムがタグを持つことができるかどうかを判定
 */
export function hasTagsProperty(
  item: DialogoiTreeItem,
): item is ContentItem | SettingItem | CharacterItem | ForeshadowingItem | GlossaryItem {
  return item.type === 'content' || item.type === 'setting';
}

/**
 * アイテムが参照を持つことができるかどうかを判定
 */
export function hasReferencesProperty(item: DialogoiTreeItem): item is ContentItem {
  return item.type === 'content';
}

/**
 * アイテムがハッシュを持つことができるかどうかを判定
 */
export function hasHashProperty(
  item: DialogoiTreeItem,
): item is ContentItem | SettingItem | CharacterItem | ForeshadowingItem | GlossaryItem {
  return item.type === 'content' || item.type === 'setting';
}

/**
 * アイテムがコメントを持つことができるかどうかを判定
 */
export function hasCommentsProperty(
  item: DialogoiTreeItem,
): item is ContentItem | SettingItem | CharacterItem | ForeshadowingItem | GlossaryItem {
  return item.type === 'content' || item.type === 'setting';
}

/**
 * アイテムが有効なコメントフィールドを持つかどうかを判定
 */
export function hasValidComments(
  item: DialogoiTreeItem,
): item is (ContentItem | SettingItem) & { comments: string } {
  return (
    (item.type === 'content' || item.type === 'setting') &&
    'comments' in item &&
    typeof item.comments === 'string' &&
    item.comments.length > 0
  );
}

/**
 * アイテムがキャラクター情報を持つことができるかどうかを判定
 */
export function hasCharacterProperty(item: DialogoiTreeItem): item is CharacterItem {
  return isCharacterItem(item);
}

/**
 * アイテムが伏線情報を持つことができるかどうかを判定
 */
export function hasForeshadowingProperty(item: DialogoiTreeItem): item is ForeshadowingItem {
  return isForeshadowingItem(item);
}
