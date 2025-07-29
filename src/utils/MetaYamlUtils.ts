import * as yaml from 'js-yaml';

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
  comments: string;
}

export interface SettingItem extends DialogoiTreeItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments: string;
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

export interface MetaYaml {
  readme?: string;
  files: DialogoiTreeItem[];
}

/**
 * .dialogoi-meta.yamlファイルの純粋なYAML処理を行うユーティリティクラス
 * ファイル操作を含まない純粋なYAMLテキスト処理のみを提供
 */
export class MetaYamlUtils {
  /**
   * YAML文字列をMetaYamlオブジェクトに変換
   */
  static parseMetaYaml(content: string): MetaYaml | null {
    try {
      const meta = yaml.load(content) as MetaYaml;
      if (meta === null || meta === undefined || meta.files === undefined) {
        return null;
      }
      return meta;
    } catch (error) {
      console.error('.dialogoi-meta.yaml の解析エラー:', error);
      return null;
    }
  }

  /**
   * MetaYamlオブジェクトをYAML文字列に変換
   */
  static stringifyMetaYaml(meta: MetaYaml): string {
    return yaml.dump(meta, {
      flowLevel: -1,
      lineWidth: -1,
      indent: 2,
    });
  }

  /**
   * DialogoiTreeItemの検証
   */
  static validateDialogoiTreeItem(item: DialogoiTreeItem): string[] {
    const errors: string[] = [];

    if (!item.name) {
      errors.push('name フィールドは必須です');
    }

    if (!['content', 'setting', 'subdirectory'].includes(item.type)) {
      errors.push(
        'type フィールドは content, setting, subdirectory のいずれかである必要があります',
      );
    }

    // 型固有の検証
    if (item.type === 'content') {
      const contentItem = item;
      if (!contentItem.hash) {
        errors.push('content アイテムには hash フィールドが必須です');
      }
      if (!Array.isArray(contentItem.tags)) {
        errors.push('content アイテムの tags フィールドは配列である必要があります');
      }
      if (!Array.isArray(contentItem.references)) {
        errors.push('content アイテムの references フィールドは配列である必要があります');
      }
      if (!contentItem.comments) {
        errors.push('content アイテムには comments フィールドが必須です');
      }
    } else if (item.type === 'setting') {
      const settingItem = item;
      if ('hash' in settingItem && !settingItem.hash) {
        errors.push('setting アイテムには hash フィールドが必須です');
      }
      if ('tags' in settingItem && !Array.isArray(settingItem.tags)) {
        errors.push('setting アイテムの tags フィールドは配列である必要があります');
      }
      if ('comments' in settingItem && !settingItem.comments) {
        errors.push('setting アイテムには comments フィールドが必須です');
      }

      // 拡張型の検証
      if ('character' in settingItem) {
        const characterItem = settingItem;
        if (!['main', 'sub', 'background'].includes(characterItem.character.importance)) {
          errors.push(
            'character.importance は main, sub, background のいずれかである必要があります',
          );
        }
        if (typeof characterItem.character.multiple_characters !== 'boolean') {
          errors.push('character.multiple_characters は boolean である必要があります');
        }
        if (!characterItem.character.display_name) {
          errors.push('character.display_name は必須です');
        }
      }

      if ('foreshadowing' in settingItem) {
        const foreshadowingItem = settingItem;
        if (!Array.isArray(foreshadowingItem.foreshadowing.plants)) {
          errors.push('foreshadowing.plants は配列である必要があります');
        }
        if (
          foreshadowingItem.foreshadowing.payoff === null ||
          foreshadowingItem.foreshadowing.payoff === undefined
        ) {
          errors.push('foreshadowing.payoff は必須です');
        }
      }

      if ('glossary' in settingItem) {
        const glossaryItem = settingItem;
        if (glossaryItem.glossary !== true) {
          errors.push('glossary フィールドは true である必要があります');
        }
      }
    }

    return errors;
  }

  /**
   * MetaYamlオブジェクトの検証
   */
  static validateMetaYaml(meta: MetaYaml): string[] {
    const errors: string[] = [];

    if (!Array.isArray(meta.files)) {
      errors.push('files フィールドは配列である必要があります');
      return errors;
    }

    for (let i = 0; i < meta.files.length; i++) {
      const file = meta.files[i];
      if (file !== undefined) {
        const itemErrors = this.validateDialogoiTreeItem(file);
        itemErrors.forEach((error) => {
          errors.push(`files[${i}]: ${error}`);
        });
      }
    }

    return errors;
  }

  /**
   * 新しいMetaYamlオブジェクトを作成
   */
  static createMetaYaml(readmeFilename?: string): MetaYaml {
    const meta: MetaYaml = {
      files: [],
    };

    if (readmeFilename !== undefined && readmeFilename !== '') {
      meta.readme = readmeFilename;
    }

    return meta;
  }
}

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
