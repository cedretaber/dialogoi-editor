import * as path from 'path';
import { FileRepository } from '../repositories/FileRepository.js';
import { DialogoiYaml, DialogoiYamlUtils } from '../utils/DialogoiYamlUtils.js';

export class DialogoiYamlService {
  private static readonly DIALOGOI_YAML_FILENAME = 'dialogoi.yaml';

  constructor(private fileRepository: FileRepository) {}

  /**
   * dialogoi.yamlファイルのパスを取得
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns dialogoi.yamlファイルの絶対パス
   */
  getDialogoiYamlPath(projectRootAbsolutePath: string): string {
    return path.join(projectRootAbsolutePath, DialogoiYamlService.DIALOGOI_YAML_FILENAME);
  }

  // ===== 非同期版メソッド (vscode.workspace.fs対応) =====

  /**
   * 指定されたディレクトリがDialogoiプロジェクトのルートかどうかを判定（非同期版）
   * @param directoryAbsolutePath ディレクトリの絶対パス
   * @returns プロジェクトルートの場合true
   */
  async isDialogoiProjectRootAsync(directoryAbsolutePath: string): Promise<boolean> {
    const dialogoiYamlPath = path.join(
      directoryAbsolutePath,
      DialogoiYamlService.DIALOGOI_YAML_FILENAME,
    );
    const uri = this.fileRepository.createFileUri(dialogoiYamlPath);
    return await this.fileRepository.existsAsync(uri);
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを読み込み（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns DialogoiYamlオブジェクト、存在しない場合やエラーの場合はnull
   */
  async loadDialogoiYamlAsync(projectRootAbsolutePath: string): Promise<DialogoiYaml | null> {
    const dialogoiYamlPath = path.join(
      projectRootAbsolutePath,
      DialogoiYamlService.DIALOGOI_YAML_FILENAME,
    );
    const uri = this.fileRepository.createFileUri(dialogoiYamlPath);

    if (!(await this.fileRepository.existsAsync(uri))) {
      return null;
    }

    try {
      const content = await this.fileRepository.readFileAsync(uri, 'utf8');
      return DialogoiYamlUtils.parseDialogoiYaml(content);
    } catch (error) {
      console.error('dialogoi.yaml の読み込みエラー:', error);
      return null;
    }
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを保存（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param data DialogoiYamlオブジェクト
   * @returns 保存に成功した場合true
   */
  async saveDialogoiYamlAsync(
    projectRootAbsolutePath: string,
    data: DialogoiYaml,
  ): Promise<boolean> {
    // バリデーション
    const validation = DialogoiYamlUtils.validateDialogoiYaml(data);
    if (!validation.isValid) {
      console.error('dialogoi.yaml のバリデーションエラー:', validation.errors);
      return false;
    }

    const dialogoiYamlPath = path.join(
      projectRootAbsolutePath,
      DialogoiYamlService.DIALOGOI_YAML_FILENAME,
    );
    const uri = this.fileRepository.createFileUri(dialogoiYamlPath);

    try {
      // updated_atを現在時刻に更新
      const dataToSave = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const yamlContent = DialogoiYamlUtils.stringifyDialogoiYaml(dataToSave);
      await this.fileRepository.writeFileAsync(uri, yamlContent);
      return true;
    } catch (error) {
      console.error('dialogoi.yaml の保存エラー:', error);
      return false;
    }
  }

  /**
   * 新しいDialogoiプロジェクトを作成（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @returns 作成に成功した場合true
   */
  async createDialogoiProjectAsync(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
  ): Promise<boolean> {
    // 既にプロジェクトが存在する場合は作成しない
    if (await this.isDialogoiProjectRootAsync(projectRootAbsolutePath)) {
      console.error('既にDialogoiプロジェクトが存在します');
      return false;
    }

    // プロジェクトディレクトリが存在しない場合は作成
    const projectUri = this.fileRepository.createDirectoryUri(projectRootAbsolutePath);
    if (!(await this.fileRepository.existsAsync(projectUri))) {
      try {
        await this.fileRepository.createDirectoryAsync(projectUri);
      } catch (error) {
        console.error('プロジェクトディレクトリの作成エラー:', error);
        return false;
      }
    }

    // dialogoi.yamlファイルを作成
    const dialogoiYaml = DialogoiYamlUtils.createDialogoiYaml(title, author, tags);
    return await this.saveDialogoiYamlAsync(projectRootAbsolutePath, dialogoiYaml);
  }

  /**
   * dialogoi.yamlファイルの更新（非同期版）
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param updates 更新するフィールド
   * @returns 更新に成功した場合true
   */
  async updateDialogoiYamlAsync(
    projectRootAbsolutePath: string,
    updates: Partial<DialogoiYaml>,
  ): Promise<boolean> {
    const currentData = await this.loadDialogoiYamlAsync(projectRootAbsolutePath);
    if (!currentData) {
      console.error('dialogoi.yaml の読み込みに失敗しました');
      return false;
    }

    const updatedData = { ...currentData, ...updates };
    return await this.saveDialogoiYamlAsync(projectRootAbsolutePath, updatedData);
  }

  /**
   * プロジェクトルートディレクトリの検索（非同期版）
   * @param startAbsolutePath 検索開始のディレクトリまたはファイル
   * @returns プロジェクトルートの絶対パス、見つからない場合はnull
   */
  async findProjectRootAsync(startAbsolutePath: string): Promise<string | null> {
    // ファイルが渡された場合は、その親ディレクトリから開始
    let currentPath = startAbsolutePath;
    try {
      const stat = await this.fileRepository.statAsync(
        this.fileRepository.createFileUri(startAbsolutePath),
      );
      if (!stat.isDirectory()) {
        currentPath = path.dirname(startAbsolutePath);
      }
    } catch {
      // ファイルが存在しない場合も親ディレクトリから開始
      currentPath = path.dirname(startAbsolutePath);
    }

    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      if (await this.isDialogoiProjectRootAsync(currentPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    return null;
  }
}
