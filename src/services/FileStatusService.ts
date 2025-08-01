import { FileRepository } from '../repositories/FileRepository.js';
import { MetaYamlService } from './MetaYamlService.js';
import { DialogoiTreeItem } from '../models/DialogoiTreeItem.js';
import * as path from 'path';

/**
 * ファイルの管理状態
 */
export enum FileStatus {
  /** .dialogoi-meta.yamlに記載 + 実際に存在 */
  Managed = 'managed',
  /** .dialogoi-meta.yamlに未記載 + 実際に存在 */
  Untracked = 'untracked',
  /** .dialogoi-meta.yamlに記載 + 実際には不存在 */
  Missing = 'missing',
}

/**
 * ファイル状態の詳細情報
 */
export interface FileStatusInfo {
  /** ファイル名 */
  name: string;
  /** 絶対パス */
  absolutePath: string;
  /** 管理状態 */
  status: FileStatus;
  /** .dialogoi-meta.yamlのエントリ（管理対象・欠損の場合） */
  metaEntry?: DialogoiTreeItem;
  /** 実際のファイル統計情報（存在する場合） */
  isDirectory?: boolean;
}

/**
 * ファイル状態を管理し、3つの状態のファイルを統合して提供するサービス
 */
export class FileStatusService {
  constructor(
    private fileRepository: FileRepository,
    private metaYamlService: MetaYamlService,
  ) {}

  /**
   * 指定されたディレクトリの全ファイル状態を取得
   * @param directoryPath ディレクトリの絶対パス
   * @returns ファイル状態情報の配列
   */
  async getFileStatusList(directoryPath: string): Promise<FileStatusInfo[]> {
    const statusMap = new Map<string, FileStatusInfo>();

    // 1. .dialogoi-meta.yamlから管理対象ファイル一覧を取得
    const metaYaml = await this.metaYamlService.loadMetaYamlAsync(directoryPath);
    const managedFilenames = new Set<string>();

    if (metaYaml) {
      // 通常のファイルエントリ
      for (const fileEntry of metaYaml.files) {
        const absolutePath = path.join(directoryPath, fileEntry.name);
        statusMap.set(fileEntry.name, {
          name: fileEntry.name,
          absolutePath,
          status: FileStatus.Managed, // 後で実際の存在確認で調整
          metaEntry: fileEntry,
        });
        managedFilenames.add(fileEntry.name);
      }

      // READMEファイルも管理対象として登録
      if (metaYaml.readme !== undefined && metaYaml.readme !== '') {
        managedFilenames.add(metaYaml.readme);
      }

      // コメントファイルは新しい仕様では別途管理されるため、
      // ここでの登録は不要になりました
    }

    // 2. 実際のファイルシステムからファイル一覧を取得
    const directoryUri = this.fileRepository.createDirectoryUri(directoryPath);
    try {
      if (await this.fileRepository.existsAsync(directoryUri)) {
        const entries = await this.fileRepository.readdirAsync(directoryUri);

        for (const entry of entries) {
          const entryName = typeof entry === 'string' ? entry : entry.name;

          // 管理ファイル(.dialogoi-meta.yaml, dialogoi.yaml)はスキップ
          if (entryName === '.dialogoi-meta.yaml' || entryName === 'dialogoi.yaml') {
            continue;
          }

          const absolutePath = path.join(directoryPath, entryName);
          const entryUri = this.fileRepository.createFileUri(absolutePath);

          try {
            const stat = await this.fileRepository.statAsync(entryUri);
            const isDirectory = stat.isDirectory();

            const existing = statusMap.get(entryName);
            if (existing) {
              // 管理対象として登録済み + 実際に存在 = Managed
              existing.status = FileStatus.Managed;
              existing.isDirectory = isDirectory;
            } else if (managedFilenames.has(entryName)) {
              // READMEやコメントファイルとして管理されている + 実際に存在 = Managed
              // ただし、statusMapには追加しない（TreeViewに表示しない）
              continue;
            } else {
              // 未登録 + 実際に存在 = Untracked
              statusMap.set(entryName, {
                name: entryName,
                absolutePath,
                status: FileStatus.Untracked,
                isDirectory,
              });
            }
          } catch {
            // stat取得失敗は無視
          }
        }
      }
    } catch (error) {
      console.warn(`ディレクトリ読み込みエラー: ${directoryPath}`, error);
    }

    // 3. 管理対象だが実際には存在しないファイルをMissingに設定
    for (const info of statusMap.values()) {
      if (info.status === FileStatus.Managed && info.isDirectory === undefined) {
        info.status = FileStatus.Missing;
      }
    }

    // 4. meta.yamlの順序を保持してソート（ディレクトリを先頭、ファイルはmeta.yaml順）
    const result = Array.from(statusMap.values());

    // meta.yamlのファイル順序インデックスマップを作成
    const metaOrderMap = new Map<string, number>();
    if (metaYaml) {
      metaYaml.files.forEach((fileEntry, index) => {
        metaOrderMap.set(fileEntry.name, index);
      });
    }

    return result.sort((a, b) => {
      // ディレクトリを先頭に
      if (a.isDirectory !== b.isDirectory) {
        if (a.isDirectory === true) {
          return -1;
        }
        if (b.isDirectory === true) {
          return 1;
        }
      }

      // 両方ともファイルの場合、meta.yamlの順序に従う
      if (a.isDirectory === false && b.isDirectory === false) {
        const aIndex = metaOrderMap.get(a.name) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = metaOrderMap.get(b.name) ?? Number.MAX_SAFE_INTEGER;

        if (aIndex !== bIndex) {
          return aIndex - bIndex;
        }
      }

      // meta.yamlに含まれていないファイル、または両方ともディレクトリの場合は名前順
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * DialogoiTreeItemをFileStatusInfoに変換
   * （TreeDataProviderとの互換性のため）
   */
  statusInfoToTreeItem(statusInfo: FileStatusInfo): DialogoiTreeItem {
    if (statusInfo.metaEntry) {
      // 管理対象または欠損ファイルの場合は既存のエントリを使用
      const treeItem = {
        ...statusInfo.metaEntry,
        path: statusInfo.absolutePath,
      };

      // 欠損ファイルの場合はフラグを設定
      if (statusInfo.status === FileStatus.Missing) {
        treeItem.isMissing = true;
      }

      return treeItem;
    } else {
      // 未追跡ファイルの場合は基本的なTreeItemを作成
      const itemType = statusInfo.isDirectory === true ? 'subdirectory' : 'setting'; // デフォルトはsetting

      if (itemType === 'subdirectory') {
        return {
          name: statusInfo.name,
          type: 'subdirectory',
          path: statusInfo.absolutePath,
          isUntracked: true,
          isMissing: false,
        };
      } else {
        return {
          name: statusInfo.name,
          type: 'setting',
          path: statusInfo.absolutePath,
          hash: '',
          tags: [],
          isUntracked: true,
          isMissing: false,
        };
      }
    }
  }

  /**
   * 除外パターンにマッチするかチェック
   */
  isExcluded(fileName: string, excludePatterns: string[]): boolean {
    for (const pattern of excludePatterns) {
      if (this.matchesPattern(fileName, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 単純なパターンマッチング
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // ドットで始まるファイル/ディレクトリ（特別パターン）
    if (pattern === '.*') {
      return text.startsWith('.');
    }

    // 完全一致
    if (text === pattern) {
      return true;
    }

    // ワイルドカードマッチング
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(text);
    }

    return false;
  }
}
