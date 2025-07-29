import { DialogoiYamlService } from '../services/DialogoiYamlService.js';
import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';

/**
 * DialogoiYamlServiceのモック実装
 * テスト環境でdialogoi.yaml操作をモック化
 */
export class MockDialogoiYamlService implements DialogoiYamlService {
  private dialogoiYamlData: Map<string, DialogoiYaml> = new Map();
  private methodCalls: Array<{ method: string; args: unknown[] }> = [];

  /**
   * dialogoi.yamlファイルのパスを取得（モック版）
   */
  getDialogoiYamlPath(projectRootAbsolutePath: string): string {
    this.methodCalls.push({ method: 'getDialogoiYamlPath', args: [projectRootAbsolutePath] });
    return `${projectRootAbsolutePath}/dialogoi.yaml`;
  }

  /**
   * 指定されたディレクトリがDialogoiプロジェクトのルートかどうかを判定（モック版）
   */
  isDialogoiProjectRootAsync(directoryAbsolutePath: string): Promise<boolean> {
    this.methodCalls.push({ method: 'isDialogoiProjectRootAsync', args: [directoryAbsolutePath] });
    return Promise.resolve(this.dialogoiYamlData.has(directoryAbsolutePath));
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを読み込み（モック版）
   */
  loadDialogoiYamlAsync(projectRootAbsolutePath: string): Promise<DialogoiYaml | null> {
    this.methodCalls.push({ method: 'loadDialogoiYamlAsync', args: [projectRootAbsolutePath] });
    return Promise.resolve(this.dialogoiYamlData.get(projectRootAbsolutePath) || null);
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを保存（モック版）
   */
  saveDialogoiYamlAsync(projectRootAbsolutePath: string, data: DialogoiYaml): Promise<boolean> {
    this.methodCalls.push({
      method: 'saveDialogoiYamlAsync',
      args: [projectRootAbsolutePath, data],
    });
    this.dialogoiYamlData.set(projectRootAbsolutePath, data);
    return Promise.resolve(true);
  }

  /**
   * プロジェクトの除外パターンを取得（モック版）
   */
  getExcludePatternsAsync(projectRootAbsolutePath: string): Promise<string[]> {
    this.methodCalls.push({ method: 'getExcludePatternsAsync', args: [projectRootAbsolutePath] });
    const data = this.dialogoiYamlData.get(projectRootAbsolutePath);
    return Promise.resolve(data?.project_settings?.exclude_patterns || []);
  }

  /**
   * 新しいDialogoiプロジェクトを作成（モック版）
   */
  createDialogoiProjectAsync(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
  ): Promise<boolean> {
    this.methodCalls.push({
      method: 'createDialogoiProjectAsync',
      args: [projectRootAbsolutePath, title, author, tags],
    });

    if (this.dialogoiYamlData.has(projectRootAbsolutePath)) {
      return Promise.resolve(false); // 既にプロジェクトが存在
    }

    const dialogoiYaml: DialogoiYaml = {
      title,
      author,
      tags: tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_settings: {
        readme_filename: 'README.md',
        exclude_patterns: [],
      },
    };

    this.dialogoiYamlData.set(projectRootAbsolutePath, dialogoiYaml);
    return Promise.resolve(true);
  }

  /**
   * 新しいDialogoiプロジェクトを自動セットアップ付きで作成（モック版）
   */
  createDialogoiProjectWithAutoSetupAsync(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
    withAutoSetup: boolean = false,
  ): Promise<boolean> {
    this.methodCalls.push({
      method: 'createDialogoiProjectWithAutoSetupAsync',
      args: [projectRootAbsolutePath, title, author, tags, withAutoSetup],
    });

    // モックでは基本的なプロジェクト作成のみ実行
    return this.createDialogoiProjectAsync(projectRootAbsolutePath, title, author, tags);
  }

  /**
   * dialogoi.yamlファイルの更新（モック版）
   */
  updateDialogoiYamlAsync(
    projectRootAbsolutePath: string,
    updates: Partial<DialogoiYaml>,
  ): Promise<boolean> {
    this.methodCalls.push({
      method: 'updateDialogoiYamlAsync',
      args: [projectRootAbsolutePath, updates],
    });

    const currentData = this.dialogoiYamlData.get(projectRootAbsolutePath);
    if (!currentData) {
      return Promise.resolve(false);
    }

    const updatedData = { ...currentData, ...updates };
    this.dialogoiYamlData.set(projectRootAbsolutePath, updatedData);
    return Promise.resolve(true);
  }

  /**
   * プロジェクトルートディレクトリの検索（モック版）
   */
  findProjectRootAsync(startAbsolutePath: string): Promise<string | null> {
    this.methodCalls.push({ method: 'findProjectRootAsync', args: [startAbsolutePath] });

    // 登録されているプロジェクトルートの中で、startAbsolutePathを含むものを検索
    for (const [projectRoot] of this.dialogoiYamlData) {
      if (startAbsolutePath.startsWith(projectRoot)) {
        return Promise.resolve(projectRoot);
      }
    }

    return Promise.resolve(null);
  }

  // テスト用ヘルパーメソッド

  /**
   * モックにDialogoiYamlデータを設定（テスト用）
   */
  setDialogoiYaml(projectRootAbsolutePath: string, data: DialogoiYaml): void {
    this.dialogoiYamlData.set(projectRootAbsolutePath, data);
  }

  /**
   * モックのDialogoiYamlデータを取得（テスト用）
   */
  getDialogoiYaml(projectRootAbsolutePath: string): DialogoiYaml | null {
    return this.dialogoiYamlData.get(projectRootAbsolutePath) || null;
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
    this.dialogoiYamlData.clear();
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
