import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface DialogoiTreeItem {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;
  hash?: string;
  tags?: string[];
  referenced?: string[];
  reviews?: string;
  review_count?: {
    open: number;
    resolved: number;
  };
  glossary?: boolean;
  character?: {
    main: boolean;
    multi: boolean;
  };
  foreshadowing?: {
    start: string;
    goal: string;
  };
}

export interface MetaYaml {
  readme?: string;
  files: DialogoiTreeItem[];
}

export class MetaYamlUtils {
  static parseMetaYaml(content: string): MetaYaml | null {
    try {
      const meta = yaml.load(content) as MetaYaml;
      if (meta === null || meta === undefined || meta.files === undefined) {
        return null;
      }
      return meta;
    } catch (error) {
      console.error('meta.yaml の解析エラー:', error);
      return null;
    }
  }

  static loadMetaYaml(dirPath: string): MetaYaml | null {
    const metaPath = path.join(dirPath, 'meta.yaml');

    try {
      if (!fs.existsSync(metaPath)) {
        return null;
      }

      const metaContent = fs.readFileSync(metaPath, 'utf8');
      return this.parseMetaYaml(metaContent);
    } catch (error) {
      console.error('meta.yaml の読み込みエラー:', error);
      return null;
    }
  }

  static getReadmeFilePath(dirPath: string): string | null {
    const meta = this.loadMetaYaml(dirPath);

    if (meta === null || meta.readme === undefined) {
      return null;
    }

    const readmeFilePath = path.join(dirPath, meta.readme);
    if (fs.existsSync(readmeFilePath)) {
      return readmeFilePath;
    }

    return null;
  }

  static findNovelRoot(workspaceRoot: string): string | null {
    const findDialogoiYaml = (dir: string): string | null => {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isFile() && item.name === 'dialogoi.yaml') {
          return dir;
        } else if (item.isDirectory()) {
          const result = findDialogoiYaml(fullPath);
          if (result !== null) {
            return result;
          }
        }
      }
      return null;
    };

    return findDialogoiYaml(workspaceRoot);
  }

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

    if (item.referenced && !Array.isArray(item.referenced)) {
      errors.push('referenced フィールドは配列である必要があります');
    }

    if (
      item.character &&
      (typeof item.character.main !== 'boolean' || typeof item.character.multi !== 'boolean')
    ) {
      errors.push('character.main と character.multi は boolean である必要があります');
    }

    return errors;
  }

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
}
