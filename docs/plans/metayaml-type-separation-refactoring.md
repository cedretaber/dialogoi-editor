# MetaYaml型定義分離リファクタリング計画書

## 概要

現在のMetaYamlUtils.tsでは、永続化データとシステム内部データが同じ型定義に混在している問題を解決するため、型定義を適切に分離するリファクタリングを実施する。

## 現状の問題

### 型定義の混在
```typescript
// 現在：永続化データとシステム内部データが混在
export interface DialogoiTreeItemBase {
  name: string;           // 永続化：YAML保存対象
  type: 'content' | 'setting' | 'subdirectory'; // 永続化
  path: string;           // 内部：実行時計算される絶対パス
  isUntracked: boolean;   // 内部：ファイル追跡状態
  isMissing: boolean;     // 内部：ファイル存在状態
}
```

### 問題点
1. **YAML serialization時の不要フィールド混入リスク**
   - `path`, `isUntracked`, `isMissing`がYAMLに保存される可能性
2. **責務の不明確性**
   - 永続化レイヤーと表示レイヤーの境界が曖昧
3. **テスト複雑性**
   - 内部状態を含むモックデータ作成が煩雑
4. **型安全性の不備**
   - 実行時にのみ存在するプロパティへの誤アクセス

## 目標アーキテクチャ

### 1. 永続化型（Pure YAML Types - MetaYamlUtils内部のみ）
```typescript
// YAMLファイルに保存される純粋なデータ構造（内部型 - exportしない）
interface MetaYamlFileItemBase {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
}

interface MetaYamlContentItem extends MetaYamlFileItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments?: string;
}

interface MetaYamlSettingItem extends MetaYamlFileItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments?: string;
}

interface MetaYamlSubdirectoryItem extends MetaYamlFileItemBase {
  type: 'subdirectory';
}

// ... 拡張型（Character, Foreshadowing, Glossary）も同様（内部型）

type MetaYamlFileItem = 
  | MetaYamlContentItem 
  | MetaYamlSettingItem 
  | MetaYamlSubdirectoryItem
  | MetaYamlCharacterItem
  | MetaYamlForeshadowingItem
  | MetaYamlGlossaryItem;

// MetaYaml自体は既存のinterfaceを維持（filesの型のみ内部で調整）
export interface MetaYaml {
  readme?: string;
  files: DialogoiTreeItem[];  // 外部APIは引き続きDialogoiTreeItem型
}
```

### 2. 実行時型（Runtime Types - 外部API）
```typescript
// システム全体で使用される実行時型（既存構造を維持）
export interface DialogoiTreeItemBase {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;           // 実行時に計算される絶対パス
  isUntracked: boolean;   // ファイル追跡状態
  isMissing: boolean;     // ファイル存在状態
}

export interface DialogoiContentItem extends DialogoiTreeItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments?: string;
}

export interface DialogoiSettingItem extends DialogoiTreeItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments?: string;
}

// ... 拡張型も同様

export type DialogoiTreeItem = 
  | DialogoiContentItem 
  | DialogoiSettingItem 
  | DialogoiSubdirectoryItem
  | DialogoiCharacterItem
  | DialogoiForeshadowingItem
  | DialogoiGlossaryItem;
```

### 3. 変換関数（MetaYamlUtils内部のみ）
```typescript
// MetaYaml → DialogoiTreeItem 変換（内部関数 - exportしない）
function enrichMetaYamlItem(
  metaItem: MetaYamlFileItem,
  absolutePath: string,
  isUntracked: boolean,
  isMissing: boolean
): DialogoiTreeItem {
  return {
    ...metaItem,
    path: absolutePath,
    isUntracked,
    isMissing,
  };
}

// DialogoiTreeItem → MetaYaml 変換（永続化用・内部関数 - exportしない）
function stripRuntimeProperties(item: DialogoiTreeItem): MetaYamlFileItem {
  const { path, isUntracked, isMissing, ...metaItem } = item;
  return metaItem;
}
```

## 実装アプローチ

### 一括変更戦略

**基本方針**: 段階的移行ではなく、一度に全ての型定義を変更して一貫性を保つ。作業中は一時的にコンパイルエラーやテスト失敗が発生するが、全体完了時に正常動作することを目指す。

### 実装手順（一括変更）

#### Step 1: 型定義の内部カプセル化
- [x] `MetaYamlUtils.ts` 内部に永続化型（`MetaYamlFileItem`系）を内部型として定義
- [x] 既存の `DialogoiTreeItem` 系型定義は維持（外部APIとして継続使用）
- [x] 内部変換関数 `enrichMetaYamlItem`, `stripRuntimeProperties` を実装
- [x] 型ガード関数は既存のまま維持（DialogoiTreeItem用）
- [x] `MetaYaml` インターフェースの内部実装を調整

#### Step 2: MetaYamlUtils内部実装の更新
- [x] `parseMetaYaml` メソッドで永続化型からDialogoiTreeItem型への変換処理を追加
- [x] `stringifyMetaYaml` メソッドでDialogoiTreeItem型から永続化型への変換処理を追加
- [x] その他のサービス層は変更不要（DialogoiTreeItem型のまま）

#### Step 3: プロバイダー・コマンド層の確認
- [x] `TreeDataProvider` は変更不要（DialogoiTreeItem型のまま）
- [x] 各種コマンドは変更不要（DialogoiTreeItem型のまま）
- [x] `FileStatusService` などは変更不要（DialogoiTreeItem型のまま）

#### Step 4: WebView・React コンポーネントの確認
- [x] `webview/types/` は変更不要（DialogoiTreeItem型のまま）
- [x] React コンポーネントは変更不要（DialogoiTreeItem型のまま）
- [x] WebView と Extension 間の通信インターフェースは変更不要

#### Step 5: テストの部分更新
- [x] `MetaYamlUtils.test.ts` の内部変換処理をテスト
- [x] 永続化時の実行時プロパティ除去をテスト
- [x] その他のテストは変更不要（DialogoiTreeItem型のまま）

#### Step 6: 最終調整・品質チェック
- [x] 未使用インポート・エクスポートの削除
- [x] TypeScript コンパイルエラーの全解決
- [x] `npm run check-all` の完全通過
- [x] サンプルプロジェクトでの動作確認

## 影響範囲

### 主な変更対象ファイル
- `src/utils/MetaYamlUtils.ts` - 内部型定義と変換処理の追加
- `src/utils/MetaYamlUtils.test.ts` - 内部変換処理のテスト追加

### 変更不要ファイル（DialogoiTreeItem型維持）
- `src/services/MetaYamlService*.ts` - 外部APIは変更なし
- `src/services/FileManagementService.ts` - DialogoiTreeItem型のまま
- `src/providers/TreeDataProvider.ts` - DialogoiTreeItem型のまま
- `webview/components/*.tsx` - DialogoiTreeItem型のまま
- その他のサービス・コマンド・テスト

### 内部カプセル化アプローチの利点
1. **最小影響**: 外部APIへの影響を最小限に抱える
2. **責務の明確化**: YAMLシリアライゼーションの詳細をMetaYamlUtils内部に隠蔽
3. **シンプルな実装**: 既存コードの大部分がそのまま使用可能
4. **メンテナンス性向上**: 永続化ロジックの一元管理

## 期待効果

### 1. 型安全性の向上
- 永続化データと内部データの明確な分離
- YAML serialization時の不要フィールド混入防止
- コンパイル時の型チェック強化

### 2. 保守性の向上
- 責務の明確化によるコードの理解しやすさ
- テストの作成・保守の簡素化
- デバッグ時の問題特定の高速化

### 3. 拡張性の向上
- 新しい永続化フィールドの追加が容易
- 新しい内部状態の管理が容易
- 将来的なスキーマバージョニング対応

## リスク管理

### 潜在的リスク（大幅軽減）
1. **内部実装変更のみ**
   - 対策: 外部APIは変更しないため、他の開発への影響は最小限
2. **変換処理のバグリスク**
   - 対策: 充実したテストで変換処理を検証
3. **YAMLフォーマット不整合**
   - 対策: 既存ファイルでの動作検証とサンプルデータのテスト
   - 対策: Step単位での部分コミット、詳細なエラーログ記録

### 品質保証
- 全Step完了後に `npm run check-all` で一括検証
- TypeScript strict mode での型チェック
- 単体テスト・統合テストの網羅的実行
- 実際のサンプルプロジェクトでの動作確認
- **重要**: Step途中でのテスト実行は期待しない（全完了後のみ）

## 完了判定基準

- [x] `MetaYamlUtils.ts` 内部で永続化型と実行時型の適切な変換が実装されている
- [x] YAML保存時に実行時プロパティ（path, isUntracked, isMissing）が除去される
- [x] YAML読み込み時に実行時プロパティが適切に追加される
- [x] `npm run check-all` が全て通過
- [x] 既存機能の動作に変更がない
- [x] テストカバレッジが維持される

## 備考

このリファクタリングは大規模な変更となるため、実施前に必ずユーザーの承認を得ること。一括変更方式のため、作業中は他の機能開発を避け、本リファクタリングに集中すること。

**重要事項（簡素化）**:
- 主な変更は`MetaYamlUtils.ts`内部のみのため、作業中も基本的に動作する
- Step完了時に `npm run check-all` で確認し、コミットする
- 念のためバックアップブランチを作成してから作業開始する

完了時期: 2-3日程度を想定（集中作業）