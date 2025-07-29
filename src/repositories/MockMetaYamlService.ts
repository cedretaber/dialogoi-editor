import { MetaYamlService } from '../services/MetaYamlService.js';
import { MetaYaml, DialogoiTreeItem } from '../utils/MetaYamlUtils.js';

/**
 * MetaYamlServiceのモック実装
 * テスト環境でメタデータ操作をモック化
 */
export class MockMetaYamlService implements MetaYamlService {
  private metaYamlData: Map<string, MetaYaml> = new Map();
  private methodCalls: Array<{ method: string; args: unknown[] }> = [];

  /**
   * .dialogoi-meta.yaml を読み込む（モック版）
   */
  loadMetaYamlAsync(dirAbsolutePath: string): Promise<MetaYaml | null> {
    this.methodCalls.push({ method: 'loadMetaYamlAsync', args: [dirAbsolutePath] });
    return Promise.resolve(this.metaYamlData.get(dirAbsolutePath) || null);
  }

  /**
   * READMEファイルのパスを取得（モック版）
   */
  getReadmeFilePathAsync(dirAbsolutePath: string): Promise<string | null> {
    this.methodCalls.push({ method: 'getReadmeFilePathAsync', args: [dirAbsolutePath] });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined && meta.readme !== undefined && meta.readme !== '') {
      return Promise.resolve(`${dirAbsolutePath}/${meta.readme}`);
    }
    return Promise.resolve(null);
  }

  /**
   * 小説ルートディレクトリを探す（モック版）
   */
  findNovelRootAsync(workspaceRootAbsolutePath: string): Promise<string | null> {
    this.methodCalls.push({ method: 'findNovelRootAsync', args: [workspaceRootAbsolutePath] });
    // モックでは単純に引数をそのまま返す
    return Promise.resolve(workspaceRootAbsolutePath);
  }

  /**
   * .dialogoi-meta.yamlファイルを保存（モック版）
   */
  saveMetaYamlAsync(dirAbsolutePath: string, meta: MetaYaml): Promise<boolean> {
    this.methodCalls.push({ method: 'saveMetaYamlAsync', args: [dirAbsolutePath, meta] });
    this.metaYamlData.set(dirAbsolutePath, meta);
    return Promise.resolve(true);
  }

  /**
   * ファイルのタグを更新（モック版）
   */
  updateFileTags(dirAbsolutePath: string, fileName: string, tags: string[]): Promise<boolean> {
    this.methodCalls.push({ method: 'updateFileTags', args: [dirAbsolutePath, fileName, tags] });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined) {
      const fileItem = meta.files.find((item) => item.name === fileName);
      if (fileItem !== undefined && 'tags' in fileItem) {
        (fileItem as { tags: string[] }).tags = tags;
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  /**
   * ファイルにタグを追加（モック版）
   */
  addFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean> {
    this.methodCalls.push({ method: 'addFileTag', args: [dirAbsolutePath, fileName, tag] });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined) {
      const fileItem = meta.files.find((item) => item.name === fileName);
      if (fileItem !== undefined && fileItem.type !== 'subdirectory') {
        const itemWithTags = fileItem as { tags: string[] };
        const tags = itemWithTags.tags ?? [];
        if (!tags.includes(tag)) {
          tags.push(tag);
          itemWithTags.tags = tags;
        }
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  /**
   * ファイルからタグを削除（モック版）
   */
  removeFileTag(dirAbsolutePath: string, fileName: string, tag: string): Promise<boolean> {
    this.methodCalls.push({ method: 'removeFileTag', args: [dirAbsolutePath, fileName, tag] });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined) {
      const fileItem = meta.files.find((item) => item.name === fileName);
      if (fileItem !== undefined && fileItem.type !== 'subdirectory') {
        const itemWithTags = fileItem as { tags: string[] };
        const tags = itemWithTags.tags ?? [];
        itemWithTags.tags = tags.filter((t) => t !== tag);
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(true); // タグがない場合も成功とする
  }

  /**
   * ディレクトリをメタデータ内で移動する（モック版）
   */
  moveDirectoryInMetadata(
    sourceParentDir: string,
    targetParentDir: string,
    dirName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }> {
    this.methodCalls.push({
      method: 'moveDirectoryInMetadata',
      args: [sourceParentDir, targetParentDir, dirName, newIndex],
    });
    return Promise.resolve({
      success: true,
      message: `Mock: Moved directory ${dirName} from ${sourceParentDir} to ${targetParentDir}`,
      updatedItems: [],
    });
  }

  /**
   * ファイルをメタデータ内で移動する（モック版）
   */
  moveFileInMetadata(
    sourceDir: string,
    targetDir: string,
    fileName: string,
    newIndex?: number,
  ): Promise<{ success: boolean; message: string; updatedItems?: DialogoiTreeItem[] }> {
    this.methodCalls.push({
      method: 'moveFileInMetadata',
      args: [sourceDir, targetDir, fileName, newIndex],
    });
    return Promise.resolve({
      success: true,
      message: `Mock: Moved file ${fileName} from ${sourceDir} to ${targetDir}`,
      updatedItems: [],
    });
  }

  /**
   * ファイルの参照関係を削除（モック版）
   */
  removeFileReference(
    dirAbsolutePath: string,
    fileName: string,
    reference: string,
  ): Promise<boolean> {
    this.methodCalls.push({
      method: 'removeFileReference',
      args: [dirAbsolutePath, fileName, reference],
    });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined) {
      const fileItem = meta.files.find((item) => item.name === fileName);
      if (fileItem !== undefined && fileItem.type === 'content') {
        const contentItem = fileItem as { references: string[] };
        const references = contentItem.references ?? [];
        contentItem.references = references.filter((ref) => ref !== reference);
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(true); // 参照がない場合も成功とする
  }

  /**
   * ファイルのキャラクター情報を削除（モック版）
   */
  removeFileCharacter(dirAbsolutePath: string, fileName: string): Promise<boolean> {
    this.methodCalls.push({ method: 'removeFileCharacter', args: [dirAbsolutePath, fileName] });
    const meta = this.metaYamlData.get(dirAbsolutePath);
    if (meta !== undefined) {
      const fileIndex = meta.files.findIndex((item) => item.name === fileName);
      if (fileIndex !== -1) {
        const fileItem = meta.files[fileIndex];
        if (fileItem !== undefined && fileItem.type === 'setting') {
          // ファイルタイプが設定ファイルの場合は何もせずに成功を返す（既に変換済み）
          return Promise.resolve(true);
        }
      }
    }
    return Promise.resolve(false);
  }

  // テスト用ヘルパーメソッド

  /**
   * モックにメタデータを設定（テスト用）
   */
  setMetaYaml(dirAbsolutePath: string, meta: MetaYaml): void {
    this.metaYamlData.set(dirAbsolutePath, meta);
  }

  /**
   * モックのメタデータを取得（テスト用）
   */
  getMetaYaml(dirAbsolutePath: string): MetaYaml | null {
    return this.metaYamlData.get(dirAbsolutePath) || null;
  }

  /**
   * メソッド呼び出し履歴を取得（テスト用）
   */
  getMethodCalls(): Array<{ method: string; args: unknown[] }> {
    return [...this.methodCalls];
  }

  /**
   * メソッド呼び出し履歴をクリア（テスト用）
   */
  clearMethodCalls(): void {
    this.methodCalls = [];
  }

  /**
   * 全データをクリア（テスト用）
   */
  clear(): void {
    this.metaYamlData.clear();
    this.methodCalls = [];
  }

  /**
   * 特定のメソッドが呼ばれたかチェック（テスト用）
   */
  wasMethodCalled(methodName: string): boolean {
    return this.methodCalls.some((call) => call.method === methodName);
  }

  /**
   * 特定の引数でメソッドが呼ばれたかチェック（テスト用）
   */
  wasMethodCalledWith(methodName: string, ...args: unknown[]): boolean {
    return this.methodCalls.some(
      (call) => call.method === methodName && JSON.stringify(call.args) === JSON.stringify(args),
    );
  }
}
