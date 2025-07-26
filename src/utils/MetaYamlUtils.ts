import * as yaml from 'js-yaml';

export interface ForeshadowingPoint {
  location: string;
  comment: string;
}

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
}
