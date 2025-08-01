import * as yaml from 'js-yaml';
import { DialogoiTreeItem, ForeshadowingPoint } from '../models/DialogoiTreeItem.js';
import { MetaYaml } from '../models/MetaYaml.js';

// ===== 内部永続化型定義（YAML保存用 - exportしない） =====

interface MetaYamlFileItemBase {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
}

interface MetaYamlSubdirectoryItem extends MetaYamlFileItemBase {
  type: 'subdirectory';
}

interface MetaYamlContentItem extends MetaYamlFileItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments?: string;
}

interface MetaYamlSettingItem extends MetaYamlFileItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments?: string;
}

interface MetaYamlCharacterItem extends MetaYamlSettingItem {
  character: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name: string;
  };
}

interface MetaYamlForeshadowingItem extends MetaYamlSettingItem {
  foreshadowing: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
}

interface MetaYamlGlossaryItem extends MetaYamlSettingItem {
  glossary: true;
}

type MetaYamlFileItem =
  | MetaYamlSubdirectoryItem
  | MetaYamlContentItem
  | MetaYamlSettingItem
  | MetaYamlCharacterItem
  | MetaYamlForeshadowingItem
  | MetaYamlGlossaryItem;

// ===== 内部変換関数（永続化型 ⇔ 実行時型） =====

/**
 * MetaYamlFileItem → DialogoiTreeItem 変換（内部関数）
 * 永続化データに実行時プロパティを追加
 */
function enrichMetaYamlItem(
  metaItem: MetaYamlFileItem,
  absolutePath: string,
  isUntracked: boolean,
  isMissing: boolean,
): DialogoiTreeItem {
  return {
    ...metaItem,
    path: absolutePath,
    isUntracked,
    isMissing,
  } as DialogoiTreeItem;
}

/**
 * DialogoiTreeItem → MetaYamlFileItem 変換（内部関数）
 * 実行時プロパティを除去して永続化用データを生成
 */
function stripRuntimeProperties(item: DialogoiTreeItem): MetaYamlFileItem {
  const { path, isUntracked, isMissing, ...metaItem } = item;
  return metaItem as MetaYamlFileItem;
}

/**
 * メタデータファイルの純粋なYAML処理を行うユーティリティクラス
 * ファイル操作を含まない純粋なYAMLテキスト処理のみを提供
 */
export class MetaYamlUtils {
  /**
   * YAML文字列をMetaYamlオブジェクトに変換
   * 永続化型から実行時型への変換を内部で実行
   */
  static parseMetaYaml(content: string): MetaYaml | null {
    try {
      // まず永続化型として解析
      const rawMeta = yaml.load(content) as { readme?: string; files: MetaYamlFileItem[] };
      if (rawMeta === null || rawMeta === undefined || rawMeta.files === undefined) {
        return null;
      }

      // 実行時型に変換（ダミーの実行時プロパティを設定）
      const enrichedFiles: DialogoiTreeItem[] = rawMeta.files.map((metaItem) =>
        enrichMetaYamlItem(metaItem, '', false, false),
      );

      return {
        readme: rawMeta.readme,
        files: enrichedFiles,
      };
    } catch (error) {
      console.error('メタデータファイルの解析エラー:', error);
      return null;
    }
  }

  /**
   * MetaYamlオブジェクトをYAML文字列に変換
   * 実行時型から永続化型への変換を内部で実行
   */
  static stringifyMetaYaml(meta: MetaYaml): string {
    // 実行時プロパティを除去して永続化型に変換
    const persistentFiles: MetaYamlFileItem[] = meta.files.map((item) =>
      stripRuntimeProperties(item),
    );

    const persistentMeta = {
      readme: meta.readme,
      files: persistentFiles,
    };

    return yaml.dump(persistentMeta, {
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
      // comments フィールドはオプショナルになったため、必須チェックを削除
    } else if (item.type === 'setting') {
      const settingItem = item;
      if ('hash' in settingItem && !settingItem.hash) {
        errors.push('setting アイテムには hash フィールドが必須です');
      }
      if ('tags' in settingItem && !Array.isArray(settingItem.tags)) {
        errors.push('setting アイテムの tags フィールドは配列である必要があります');
      }
      // comments フィールドはオプショナルになったため、必須チェックを削除

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
        // display_name はオプショナルフィールドなので、必須チェックを削除
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
