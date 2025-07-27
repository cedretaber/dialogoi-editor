import * as yaml from 'js-yaml';

export interface DialogoiYaml {
  title: string;
  author: string;
  created_at: string;
  tags?: string[];
  updated_at?: string;
  project_settings?: {
    readme_filename?: string;
    exclude_patterns?: string[];
  };
}

export class DialogoiYamlUtils {
  /**
   * dialogoi.yaml の内容を解析してDialogoiYamlオブジェクトを返す
   * @param content YAMLファイルの内容
   * @returns DialogoiYamlオブジェクト。解析エラーの場合はnull
   */
  static parseDialogoiYaml(content: string): DialogoiYaml | null {
    try {
      const parsed = yaml.load(content) as DialogoiYaml;
      if (parsed === null || parsed === undefined) {
        return null;
      }

      // 必須フィールドの検証
      if (!parsed.title || !parsed.author || !parsed.created_at) {
        console.error('dialogoi.yaml: 必須フィールドが不足しています');
        return null;
      }

      return parsed;
    } catch (error) {
      console.error('dialogoi.yaml の解析エラー:', error);
      return null;
    }
  }

  /**
   * DialogoiYamlオブジェクトをYAML文字列に変換
   * @param data DialogoiYamlオブジェクト
   * @returns YAML文字列
   */
  static stringifyDialogoiYaml(data: DialogoiYaml): string {
    return yaml.dump(data, {
      indent: 2,
      noRefs: true,
      sortKeys: false,
      lineWidth: -1,
    });
  }

  /**
   * 基本的なバリデーション
   * @param data DialogoiYamlオブジェクト
   * @returns バリデーション結果
   */
  static validateDialogoiYaml(data: DialogoiYaml): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 必須フィールドのチェック
    if (!data.title || data.title.trim() === '') {
      errors.push('title は必須フィールドです');
    }
    if (!data.author || data.author.trim() === '') {
      errors.push('author は必須フィールドです');
    }
    if (!data.created_at || data.created_at.trim() === '') {
      errors.push('created_at は必須フィールドです');
    }

    // 日付形式のチェック（ISO 8601）
    if (data.created_at !== undefined && !this.isValidISODate(data.created_at)) {
      errors.push('created_at はISO 8601形式である必要があります（例: 2024-01-01T00:00:00Z）');
    }
    if (data.updated_at !== undefined && !this.isValidISODate(data.updated_at)) {
      errors.push('updated_at はISO 8601形式である必要があります（例: 2024-01-01T00:00:00Z）');
    }

    // タグの配列チェック
    if (data.tags !== undefined && !Array.isArray(data.tags)) {
      errors.push('tags は配列である必要があります');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * ISO 8601形式の日付文字列の検証
   * @param dateString 日付文字列
   * @returns 有効かどうか
   */
  private static isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return false;
    }

    // ISO 8601形式の基本的な正規表現チェック
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
    return iso8601Regex.test(dateString);
  }

  /**
   * 新しいDialogoiYamlオブジェクトの作成
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @returns 新しいDialogoiYamlオブジェクト
   */
  static createDialogoiYaml(title: string, author: string, tags?: string[]): DialogoiYaml {
    const now = new Date().toISOString();
    return {
      title,
      author,
      created_at: now,
      tags: tags || [],
      updated_at: now,
      project_settings: {
        readme_filename: 'README.md',
        exclude_patterns: [
          '.*', // 隠しファイル・ディレクトリ
          '.DS_Store', // macOS
          'Thumbs.db', // Windows
          'desktop.ini', // Windows
          '$RECYCLE.BIN', // Windows
          '.Trash', // macOS
          '.git', // Git管理ファイル
          '.gitignore', // Git設定ファイル
          '.hg', // Mercurial
          '.svn', // Subversion
          '*.tmp', // 一時ファイル
          '*.temp',
          '*.log', // ログファイル
          '*.bak', // バックアップファイル
          '*.old',
          'node_modules', // Node.js依存関係
          'dist', // ビルド出力
          'build', // ビルド出力
        ],
      },
    };
  }
}
