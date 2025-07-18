import * as path from 'path';
import { FileOperationService } from '../interfaces/FileOperationService.js';
import { DialogoiYaml, DialogoiYamlUtils } from '../utils/DialogoiYamlUtils.js';

export class DialogoiYamlService {
  private static readonly DIALOGOI_YAML_FILENAME = 'dialogoi.yaml';

  constructor(private fileOperationService: FileOperationService) {}

  /**
   * 指定されたディレクトリがDialogoiプロジェクトのルートかどうかを判定
   * @param directoryAbsolutePath ディレクトリの絶対パス
   * @returns プロジェクトルートの場合true
   */
  isDialogoiProjectRoot(directoryAbsolutePath: string): boolean {
    const dialogoiYamlPath = path.join(
      directoryAbsolutePath,
      DialogoiYamlService.DIALOGOI_YAML_FILENAME,
    );
    const uri = this.fileOperationService.createFileUri(dialogoiYamlPath);
    return this.fileOperationService.existsSync(uri);
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを読み込み
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns DialogoiYamlオブジェクト、存在しない場合やエラーの場合はnull
   */
  loadDialogoiYaml(projectRootAbsolutePath: string): DialogoiYaml | null {
    const dialogoiYamlPath = path.join(
      projectRootAbsolutePath,
      DialogoiYamlService.DIALOGOI_YAML_FILENAME,
    );
    const uri = this.fileOperationService.createFileUri(dialogoiYamlPath);

    if (!this.fileOperationService.existsSync(uri)) {
      return null;
    }

    try {
      const content = this.fileOperationService.readFileSync(uri, 'utf8');
      return DialogoiYamlUtils.parseDialogoiYaml(content);
    } catch (error) {
      console.error('dialogoi.yaml の読み込みエラー:', error);
      return null;
    }
  }

  /**
   * プロジェクトのdialogoi.yamlファイルを保存
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param data DialogoiYamlオブジェクト
   * @returns 保存に成功した場合true
   */
  saveDialogoiYaml(projectRootAbsolutePath: string, data: DialogoiYaml): boolean {
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
    const uri = this.fileOperationService.createFileUri(dialogoiYamlPath);

    try {
      // updated_atを現在時刻に更新
      const dataToSave = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      const yamlContent = DialogoiYamlUtils.stringifyDialogoiYaml(dataToSave);
      this.fileOperationService.writeFileSync(uri, yamlContent, 'utf8');
      return true;
    } catch (error) {
      console.error('dialogoi.yaml の保存エラー:', error);
      return false;
    }
  }

  /**
   * 新しいDialogoiプロジェクトを作成
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param title 作品タイトル
   * @param author 著者名
   * @param tags タグ（オプション）
   * @returns 作成に成功した場合true
   */
  createDialogoiProject(
    projectRootAbsolutePath: string,
    title: string,
    author: string,
    tags?: string[],
  ): boolean {
    // 既にプロジェクトが存在する場合は作成しない
    if (this.isDialogoiProjectRoot(projectRootAbsolutePath)) {
      console.error('既にDialogoiプロジェクトが存在します');
      return false;
    }

    // プロジェクトディレクトリが存在しない場合は作成
    const projectUri = this.fileOperationService.createDirectoryUri(projectRootAbsolutePath);
    if (!this.fileOperationService.existsSync(projectUri)) {
      try {
        this.fileOperationService.createDirectorySync(projectUri);
      } catch (error) {
        console.error('プロジェクトディレクトリの作成エラー:', error);
        return false;
      }
    }

    // dialogoi.yamlファイルを作成
    const dialogoiYaml = DialogoiYamlUtils.createDialogoiYaml(title, author, tags);
    return this.saveDialogoiYaml(projectRootAbsolutePath, dialogoiYaml);
  }

  /**
   * dialogoi.yamlファイルの更新
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @param updates 更新するフィールド
   * @returns 更新に成功した場合true
   */
  updateDialogoiYaml(projectRootAbsolutePath: string, updates: Partial<DialogoiYaml>): boolean {
    const currentData = this.loadDialogoiYaml(projectRootAbsolutePath);
    if (!currentData) {
      console.error('dialogoi.yaml の読み込みに失敗しました');
      return false;
    }

    const updatedData = { ...currentData, ...updates };
    return this.saveDialogoiYaml(projectRootAbsolutePath, updatedData);
  }

  /**
   * プロジェクトルートディレクトリの検索
   * @param startAbsolutePath 検索開始のディレクトリ
   * @returns プロジェクトルートの絶対パス、見つからない場合はnull
   */
  findProjectRoot(startAbsolutePath: string): string | null {
    let currentPath = startAbsolutePath;
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      if (this.isDialogoiProjectRoot(currentPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }

    return null;
  }

  /**
   * dialogoi.yamlファイルのパスを取得
   * @param projectRootAbsolutePath プロジェクトルートの絶対パス
   * @returns dialogoi.yamlファイルの絶対パス
   */
  getDialogoiYamlPath(projectRootAbsolutePath: string): string {
    return path.join(projectRootAbsolutePath, DialogoiYamlService.DIALOGOI_YAML_FILENAME);
  }
}
