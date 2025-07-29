import { DialogoiYaml } from '../utils/DialogoiYamlUtils.js';

/**
 * DialogoiYamlService インターフェイス
 * dialogoi.yamlファイルの読み書きとプロジェクト管理を提供
 */
export interface DialogoiYamlService {
  /**
   * dialogoi.yamlファイルのパスを取得
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns dialogoi.yamlファイルの絶対パス
   */
  getDialogoiYamlPath(projectRootAbsolutePath: string): string;

  /**
   * 指定されたディレクトリがDialogoiプロジェクトのルートかどうかを判定（非同期版）
   * @param directoryAbsolutePath ディレクトリの絶対パス
   * @returns プロジェクトルートの場合true
   */
  isDialogoiProjectRootAsync(directoryAbsolutePath: string): Promise<boolean>;

  /**
   * プロジェクトのdialogoi.yamlファイルを読み込み（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns DialogoiYamlオブジェクト、存在しない場合やエラーの場合はnull
   */
  loadDialogoiYamlAsync(projectRootAbsolutePath: string): Promise<DialogoiYaml | null>;

  /**
   * プロジェクトのdialogoi.yamlファイルを保存（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param data DialogoiYamlオブジェクト
   * @returns 保存に成功した場合true
   */
  saveDialogoiYamlAsync(projectRootAbsolutePath: string, data: DialogoiYaml): Promise<boolean>;

  /**
   * プロジェクトの除外パターンを取得（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns 除外パターンの配列、取得できない場合は空配列
   */
  getExcludePatternsAsync(projectRootAbsolutePath: string): Promise<string[]>;

  /**
   * 新しいDialogoiプロジェクトを作成（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @returns 作成に成功した場合true
   */
  createDialogoiProjectAsync(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
  ): Promise<boolean>;

  /**
   * 新しいDialogoiプロジェクトを自動セットアップ付きで作成（非同期版）
   * 注意: このメソッドは循環依存を避けるため、ProjectSetupServiceから呼び出される想定です。
   * 直接的なプロジェクト作成にはProjectSetupService.createDialogoiProjectWithSetupを使用してください。
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @param withAutoSetup 自動セットアップを実行するかどうか（デフォルト: false）
   * @returns 作成成功時はtrue
   * @deprecated ProjectSetupService.createDialogoiProjectWithSetupの使用を推奨
   */
  createDialogoiProjectWithAutoSetupAsync(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
    withAutoSetup?: boolean,
  ): Promise<boolean>;

  /**
   * dialogoi.yamlファイルの更新（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param updates 更新するフィールド
   * @returns 更新に成功した場合true
   */
  updateDialogoiYamlAsync(
    projectRootAbsolutePath: string,
    updates: Partial<DialogoiYaml>,
  ): Promise<boolean>;

  /**
   * プロジェクトルートディレクトリの検索（非同期版）
   * @param startAbsolutePath 検索開始のディレクトリまたはファイル
   * @returns プロジェクトルートの絶対パス、見つからない場合はnull
   */
  findProjectRootAsync(startAbsolutePath: string): Promise<string | null>;
}
