/**
 * MetaYaml関連の型定義
 *
 * MetaYamlUtils.tsから移動されたメタデータファイルの型定義を提供
 */

import { DialogoiTreeItem } from './DialogoiTreeItem.js';

export interface MetaYaml {
  readme?: string;
  files: DialogoiTreeItem[];
}
