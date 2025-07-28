import * as yaml from 'js-yaml';

export interface ForeshadowingPoint {
  location: string;
  comment: string;
}

// ===== 新しい型システム（Phase 2実装） =====

/**
 * DialogoiTreeItemの基底インターフェース
 */
export interface DialogoiTreeItemBase {
  name: string;
  type: 'subdirectory' | 'content' | 'setting';
  path: string;
  isUntracked: boolean;
  isMissing: boolean;
}

/**
 * サブディレクトリアイテム
 */
export interface SubdirectoryItem extends DialogoiTreeItemBase {
  type: 'subdirectory';
}

/**
 * 本文ファイルアイテム
 */
export interface ContentItem extends DialogoiTreeItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments: string; // コメントファイルのパス
}

/**
 * 基本設定ファイルアイテム
 */
export interface SettingItem extends DialogoiTreeItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments: string; // コメントファイルのパス
}

/**
 * キャラクター設定ファイル
 */
export interface CharacterItem extends SettingItem {
  character: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name: string;
  };
}

/**
 * 伏線設定ファイル
 */
export interface ForeshadowingItem extends SettingItem {
  foreshadowing: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
}

/**
 * 用語集ファイル
 */
export interface GlossaryItem extends SettingItem {
  glossary: true;
}

/**
 * 新しいDialogoiTreeItemのユニオン型
 */
export type NewDialogoiTreeItem = 
  | SubdirectoryItem 
  | ContentItem 
  | SettingItem 
  | CharacterItem 
  | ForeshadowingItem 
  | GlossaryItem;

/**
 * 新しいMetaYaml型定義
 */
export interface NewMetaYaml {
  readme: string;
  files: NewDialogoiTreeItem[];
}

// ===== 既存の型システム（後方互換性のため保持） =====

export interface DialogoiTreeItem {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;
  hash?: string;
  tags?: string[];
  references?: string[];
  comments?: string; // コメントファイルのパス
  glossary?: boolean;
  character?: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name?: string;
  };
  foreshadowing?: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
  // ファイル状態フラグ（FileStatusServiceとの連携用）
  isUntracked?: boolean; // 未追跡ファイル
  isMissing?: boolean; // 欠損ファイル
}

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

    if (item.tags && !Array.isArray(item.tags)) {
      errors.push('tags フィールドは配列である必要があります');
    }

    if (item.references && !Array.isArray(item.references)) {
      errors.push('references フィールドは配列である必要があります');
    }

    if (item.character) {
      if (!['main', 'sub', 'background'].includes(item.character.importance)) {
        errors.push('character.importance は main, sub, background のいずれかである必要があります');
      }
      if (typeof item.character.multiple_characters !== 'boolean') {
        errors.push('character.multiple_characters は boolean である必要があります');
      }
      if (
        item.character.display_name !== undefined &&
        typeof item.character.display_name !== 'string'
      ) {
        errors.push('character.display_name は string である必要があります');
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
    return {
      readme: readmeFilename,
      files: [],
    };
  }

  // ===== 新しい型システム用ユーティリティ（Phase 2実装） =====

  /**
   * 新しい型システム用のMetaYamlオブジェクトを作成
   */
  static createNewMetaYaml(readmeFilename: string): NewMetaYaml {
    return {
      readme: readmeFilename,
      files: [],
    };
  }

  /**
   * 新しい型システム用のYAML文字列変換
   */
  static stringifyNewMetaYaml(meta: NewMetaYaml): string {
    return yaml.dump(meta, {
      flowLevel: -1,
      lineWidth: -1,
      indent: 2,
    });
  }

  /**
   * 新しい型システム用の検証
   */
  static validateNewDialogoiTreeItem(item: NewDialogoiTreeItem): string[] {
    const errors: string[] = [];

    if (!item.name) {
      errors.push('name フィールドは必須です');
    }

    if (!['content', 'setting', 'subdirectory'].includes(item.type)) {
      errors.push(
        'type フィールドは content, setting, subdirectory のいずれかである必要があります',
      );
    }

    if (!item.path) {
      errors.push('path フィールドは必須です');
    }

    if (typeof item.isUntracked !== 'boolean') {
      errors.push('isUntracked フィールドは boolean である必要があります');
    }

    if (typeof item.isMissing !== 'boolean') {
      errors.push('isMissing フィールドは boolean である必要があります');
    }

    // 型固有の検証
    if (item.type === 'content') {
      const contentItem = item as ContentItem;
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
      const settingItem = item as SettingItem;
      if (!settingItem.hash) {
        errors.push('setting アイテムには hash フィールドが必須です');
      }
      if (!Array.isArray(settingItem.tags)) {
        errors.push('setting アイテムの tags フィールドは配列である必要があります');
      }
      if (!settingItem.comments) {
        errors.push('setting アイテムには comments フィールドが必須です');
      }

      // 拡張型の検証
      if ('character' in settingItem) {
        const characterItem = settingItem as CharacterItem;
        if (!['main', 'sub', 'background'].includes(characterItem.character.importance)) {
          errors.push('character.importance は main, sub, background のいずれかである必要があります');
        }
        if (typeof characterItem.character.multiple_characters !== 'boolean') {
          errors.push('character.multiple_characters は boolean である必要があります');
        }
        if (!characterItem.character.display_name) {
          errors.push('character.display_name は必須です');
        }
      }

      if ('foreshadowing' in settingItem) {
        const foreshadowingItem = settingItem as ForeshadowingItem;
        if (!Array.isArray(foreshadowingItem.foreshadowing.plants)) {
          errors.push('foreshadowing.plants は配列である必要があります');
        }
        if (!foreshadowingItem.foreshadowing.payoff) {
          errors.push('foreshadowing.payoff は必須です');
        }
      }

      if ('glossary' in settingItem) {
        const glossaryItem = settingItem as GlossaryItem;
        if (glossaryItem.glossary !== true) {
          errors.push('glossary フィールドは true である必要があります');
        }
      }
    }

    return errors;
  }

  /**
   * 新しい型システム用のMetaYaml検証
   */
  static validateNewMetaYaml(meta: NewMetaYaml): string[] {
    const errors: string[] = [];

    if (!meta.readme) {
      errors.push('readme フィールドは必須です');
    }

    if (!Array.isArray(meta.files)) {
      errors.push('files フィールドは配列である必要があります');
      return errors;
    }

    for (let i = 0; i < meta.files.length; i++) {
      const file = meta.files[i];
      if (file !== undefined) {
        const itemErrors = this.validateNewDialogoiTreeItem(file);
        itemErrors.forEach((error) => {
          errors.push(`files[${i}]: ${error}`);
        });
      }
    }

    return errors;
  }
}

// ===== 型ガード関数（Phase 2実装） =====

/**
 * サブディレクトリアイテムかどうかを判定
 */
export function isSubdirectoryItem(item: NewDialogoiTreeItem): item is SubdirectoryItem {
  return item.type === 'subdirectory';
}

/**
 * コンテンツアイテムかどうかを判定
 */
export function isContentItem(item: NewDialogoiTreeItem): item is ContentItem {
  return item.type === 'content';
}

/**
 * 設定アイテムかどうかを判定
 */
export function isSettingItem(item: NewDialogoiTreeItem): item is SettingItem {
  return item.type === 'setting' && !('character' in item) && !('foreshadowing' in item) && !('glossary' in item);
}

/**
 * キャラクターアイテムかどうかを判定
 */
export function isCharacterItem(item: NewDialogoiTreeItem): item is CharacterItem {
  return item.type === 'setting' && 'character' in item;
}

/**
 * 伏線アイテムかどうかを判定
 */
export function isForeshadowingItem(item: NewDialogoiTreeItem): item is ForeshadowingItem {
  return item.type === 'setting' && 'foreshadowing' in item;
}

/**
 * 用語集アイテムかどうかを判定
 */
export function isGlossaryItem(item: NewDialogoiTreeItem): item is GlossaryItem {
  return item.type === 'setting' && 'glossary' in item;
}

// ===== 変換ユーティリティ関数（Phase 2実装） =====

/**
 * 旧DialogoiTreeItemから新DialogoiTreeItemへの変換
 */
export function convertToNewDialogoiTreeItem(oldItem: DialogoiTreeItem): NewDialogoiTreeItem {
  const base: DialogoiTreeItemBase = {
    name: oldItem.name,
    type: oldItem.type,
    path: oldItem.path,
    isUntracked: oldItem.isUntracked ?? false,
    isMissing: oldItem.isMissing ?? false,
  };

  switch (oldItem.type) {
    case 'subdirectory':
      return base as SubdirectoryItem;

    case 'content':
      return {
        ...base,
        type: 'content',
        hash: oldItem.hash ?? '',
        tags: oldItem.tags ?? [],
        references: oldItem.references ?? [],
        comments: oldItem.comments ?? '',
      } as ContentItem;

    case 'setting':
      const settingBase = {
        ...base,
        type: 'setting' as const,
        hash: oldItem.hash ?? '',
        tags: oldItem.tags ?? [],
        comments: oldItem.comments ?? '',
      };

      // 拡張型の判定と変換
      if (oldItem.character) {
        return {
          ...settingBase,
          character: {
            importance: oldItem.character.importance,
            multiple_characters: oldItem.character.multiple_characters,
            display_name: oldItem.character.display_name ?? '',
          },
        } as CharacterItem;
      }

      if (oldItem.foreshadowing) {
        return {
          ...settingBase,
          foreshadowing: {
            plants: oldItem.foreshadowing.plants,
            payoff: oldItem.foreshadowing.payoff,
          },
        } as ForeshadowingItem;
      }

      if (oldItem.glossary) {
        return {
          ...settingBase,
          glossary: true,
        } as GlossaryItem;
      }

      return settingBase as SettingItem;

    default:
      throw new Error(`Unknown item type: ${(oldItem as any).type}`);
  }
}

/**
 * 新DialogoiTreeItemから旧DialogoiTreeItemへの変換（後方互換性用）
 */
export function convertToLegacyDialogoiTreeItem(newItem: NewDialogoiTreeItem): DialogoiTreeItem {
  const base: DialogoiTreeItem = {
    name: newItem.name,
    type: newItem.type,
    path: newItem.path,
    isUntracked: newItem.isUntracked || undefined,
    isMissing: newItem.isMissing || undefined,
  };

  switch (newItem.type) {
    case 'subdirectory':
      return base;

    case 'content':
      const contentItem = newItem as ContentItem;
      return {
        ...base,
        hash: contentItem.hash || undefined,
        tags: contentItem.tags.length > 0 ? contentItem.tags : undefined,
        references: contentItem.references.length > 0 ? contentItem.references : undefined,
        comments: contentItem.comments || undefined,
      };

    case 'setting':
      const settingItem = newItem as SettingItem;
      const result: DialogoiTreeItem = {
        ...base,
        hash: settingItem.hash || undefined,
        tags: settingItem.tags.length > 0 ? settingItem.tags : undefined,
        comments: settingItem.comments || undefined,
      };

      // 拡張型の変換
      if (isCharacterItem(newItem)) {
        result.character = {
          importance: newItem.character.importance,
          multiple_characters: newItem.character.multiple_characters,
          display_name: newItem.character.display_name || undefined,
        };
      }

      if (isForeshadowingItem(newItem)) {
        result.foreshadowing = {
          plants: newItem.foreshadowing.plants,
          payoff: newItem.foreshadowing.payoff,
        };
      }

      if (isGlossaryItem(newItem)) {
        result.glossary = true;
      }

      return result;

    default:
      throw new Error(`Unknown item type: ${(newItem as any).type}`);
  }
}

/**
 * 旧MetaYamlから新MetaYamlへの変換
 */
export function convertToNewMetaYaml(oldMeta: MetaYaml): NewMetaYaml {
  return {
    readme: oldMeta.readme ?? 'README.md',
    files: oldMeta.files.map(convertToNewDialogoiTreeItem),
  };
}

/**
 * 新MetaYamlから旧MetaYamlへの変換（後方互換性用）
 */
export function convertToLegacyMetaYaml(newMeta: NewMetaYaml): MetaYaml {
  return {
    readme: newMeta.readme || undefined,
    files: newMeta.files.map(convertToLegacyDialogoiTreeItem),
  };
}
