# DialogoiTreeItem型定義リファクタリング計画書

## 概要

MetaYamlUtilsで定義されているDialogoiTreeItem型は、現在オプショナルフィールドが多すぎて型安全性に問題があります。
この計画書では、ユニオン型ベースの新しい型システムへのリファクタリングを段階的に実施します。

## 現在の問題点

### 現在の型定義（src/utils/MetaYamlUtils.ts）
```typescript
export interface DialogoiTreeItem {
  name: string;
  type: 'content' | 'setting' | 'subdirectory';
  path: string;
  hash?: string;
  tags?: string[];
  references?: string[];
  comments?: string; // コメントファイルのパス
  glossary?: boolean;
  character?: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name?: string;
  };
  foreshadowing?: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
  // ファイル状態フラグ（FileStatusServiceとの連携用）
  isUntracked?: boolean; // 未追跡ファイル
  isMissing?: boolean; // 欠損ファイル
}
```

### 問題
1. **型安全性の欠如**: オプショナルフィールドが多すぎて、実際に存在すべきフィールドがundefinedになる可能性
2. **意味的な混乱**: typeによって使用されるフィールドが異なるが、型システムでそれが表現されていない
3. **保守性の問題**: 新しいファイル種別を追加する際の複雑性

## 新しい型システム設計

### 基本設計方針
- **ユニオン型ベース**: ファイル種別ごとに専用の型を定義
- **必須フィールド重視**: オプショナルフィールドを最小限に抑制
- **階層的設計**: 共通フィールドはベース型で定義

### 新しい型定義
```typescript
export interface DialogoiTreeItemBase {
  name: string;
  type: 'subdirectory' | 'content' | 'setting';
  path: string;
  isUntracked: boolean;
  isMissing: boolean;
}

export interface SubdirectoryItem extends DialogoiTreeItemBase {
  type: 'subdirectory';
}

export interface ContentItem extends DialogoiTreeItemBase {
  type: 'content';
  hash: string;
  tags: string[];
  references: string[];
  comments: string; // コメントファイルのパス
}

export interface SettingItem extends DialogoiTreeItemBase {
  type: 'setting';
  hash: string;
  tags: string[];
  comments: string;
}

export interface CharacterItem extends SettingItem {
  character: {
    importance: 'main' | 'sub' | 'background';
    multiple_characters: boolean;
    display_name: string;
  };
}

export interface ForeshadowingItem extends SettingItem {
  foreshadowing: {
    plants: ForeshadowingPoint[];
    payoff: ForeshadowingPoint;
  };
}

export interface GlossaryItem extends SettingItem {
  glossary: true;
}

export type DialogoiTreeItem = 
  | SubdirectoryItem 
  | ContentItem 
  | SettingItem 
  | CharacterItem 
  | ForeshadowingItem 
  | GlossaryItem;

export interface MetaYaml {
  readme: string; // オプショナル → 必須
  files: DialogoiTreeItem[];
}
```

## リファクタリング実施計画

### Phase 1: 影響範囲分析と型定義準備 ✅ **準備完了**

**目的**: 現在のコードベースでの使用状況を把握し、リファクタリング戦略を確定

**作業項目**:
- [x] DialogoiTreeItemを使用している全ファイルの特定（23ファイル確認済み）
- [x] 各ファイルでの使用パターンの分析
- [x] 新しい型定義の詳細設計
- [x] 移行戦略の策定

**影響を受けるファイル（23ファイル）**:
```
/src/tree/DialogoiTreeDataProvider.ts
/src/services/MetadataService.ts
/src/commands/characterCommands.ts
/src/services/FilePathMapService.ts
/src/providers/FileDetailsViewProvider.ts
/src/services/CoreFileService.ts
/src/services/FileManagementService.ts
/src/services/ProjectAutoSetupService.ts
/src/services/MetaYamlService.ts
/src/services/FileStatusService.ts
/src/services/FileTypeConversionService.ts
/src/commands/fileTypeConversionCommands.ts
/src/commands/fileCommands.ts
/src/utils/MetaYamlUtils.test.ts
/src/services/TreeViewFilterService.test.ts
/src/commands/referenceCommands.ts
/src/commands/tagCommands.ts
/src/services/CharacterService.ts
/src/commands/foreshadowingCommands.ts
/src/services/TreeViewFilterService.ts
/src/services/FileStatusService.test.ts
/docs/file-operation-service-refactoring.md (ドキュメント)
```

### Phase 2: 新しい型定義の実装と基本ユーティリティ

**目的**: 新しい型システムを実装し、基本的なユーティリティ関数を準備

**作業項目**:
- [ ] MetaYamlUtils.tsに新しい型定義を追加（既存型は残したまま）
- [ ] 型ガード関数の実装（isContentItem, isSettingItem等）
- [ ] 変換ユーティリティ関数の実装（旧型→新型）
- [ ] 新しい型システムに対応したバリデーション関数の実装
- [ ] 新しい型システム用のテストケース作成

**推定時間**: 2-3時間

**完了基準**:
- 新しい型定義が正しく動作する
- 型ガード関数がすべてのケースをカバーする
- 変換関数が既存データを正しく新形式に変換する
- 新しいバリデーション関数が期待通りに動作する

### Phase 3: コアサービスの段階的移行

**目的**: 最も重要なサービスクラスを新しい型システムに移行

**作業項目**:
- [ ] MetaYamlService.tsの移行（型変換レイヤー追加）
- [ ] FileStatusService.tsの移行
- [ ] CoreFileService.tsの移行
- [ ] MetadataService.tsの移行
- [ ] 各サービスのテストケース更新

**推定時間**: 3-4時間

**移行戦略**:
1. サービス内部で新旧型変換を行う
2. 外部APIは当面既存型を維持
3. 内部処理を新しい型システムに移行

**完了基準**:
- 各サービスが新しい型システムで正常動作する
- 既存の外部API互換性が保たれる
- すべてのテストが通過する

### Phase 4: コマンド・プロバイダーレイヤーの移行

**目的**: コマンドとプロバイダーを新しい型システムに移行

**作業項目**:
- [ ] characterCommands.tsの移行
- [ ] fileCommands.tsの移行
- [ ] fileTypeConversionCommands.tsの移行
- [ ] referenceCommands.tsの移行
- [ ] tagCommands.tsの移行
- [ ] foreshadowingCommands.tsの移行
- [ ] FileDetailsViewProvider.tsの移行
- [ ] DialogoiTreeDataProvider.tsの移行

**推定時間**: 2-3時間

**完了基準**:
- 全コマンドが新しい型システムで動作する
- UIコンポーネントが正しく表示される
- VSCode拡張機能が正常に動作する

### Phase 5: フィルタリング・検索システムの移行

**目的**: TreeViewFilterServiceなどの高度な機能を移行

**作業項目**:
- [ ] TreeViewFilterService.tsの移行
- [ ] FilePathMapService.tsの移行
- [ ] CharacterService.tsの移行
- [ ] FileTypeConversionService.tsの移行
- [ ] ProjectAutoSetupService.tsの移行

**推定時間**: 2-3時間

**完了基準**:
- フィルタリング機能が正常動作する
- 検索機能が正常動作する
- ファイル種別変換が正常動作する

### Phase 6: 旧型システムの削除とクリーンアップ

**目的**: 旧型定義を削除し、コードベースをクリーンアップ

**作業項目**:
- [ ] 旧DialogoiTreeItem型定義の削除
- [ ] 変換ユーティリティ関数の削除
- [ ] 型ガード関数の最適化
- [ ] 不要なコメント・コードの削除
- [ ] ドキュメントの更新

**推定時間**: 1-2時間

**完了基準**:
- 旧型システムが完全に削除される
- コードベースがクリーンになる
- 全機能が新しい型システムで動作する

## リスク管理

### 高リスク項目
1. **型変換の複雑性**: 既存データの型変換で予期しないエラー
2. **テストカバレッジ**: 新しい型システムのエッジケースを見落とす可能性
3. **パフォーマンス**: 型変換処理によるパフォーマンス低下

### 対策
1. **段階的移行**: 一度にすべてを変更せず、段階的に移行
2. **後方互換性**: 移行期間中は旧型システムと併存
3. **包括的テスト**: 各フェーズで必ず全テストを実行
4. **ロールバック計画**: 問題が発生した場合の戻し方を明確化

## 品質基準

### 各フェーズ完了時の必須チェック項目
1. `npm run check-all` が成功すること
2. 全470テストが通過すること
3. TypeScript型チェックエラーが0であること
4. ESLint警告が0であること
5. Prettier フォーマットが適用されていること

### コミット戦略
- 各フェーズ完了時に必ずコミット
- 破壊的変更の場合は詳細なコミットメッセージを記載
- 必要に応じて複数の小さなコミットに分割

## 進捗追跡

### 現在のステータス
- **Phase 1**: ✅ **完了** - 2025-01-28
- **Phase 2**: ⏳ **次回実行予定**
- **Phase 3**: 📋 **待機中**
- **Phase 4**: 📋 **待機中**
- **Phase 5**: 📋 **待機中**
- **Phase 6**: 📋 **待機中**

### 次回セッション時の作業
1. Phase 2の実装を開始
2. MetaYamlUtils.tsに新しい型定義を追加
3. 型ガード関数の実装
4. 基本的なテストケースの作成

## 補足事項

### 注意点
- このリファクタリングは大規模な変更のため、慎重に進める必要があります
- 各フェーズ間で必ず動作確認を行い、問題があれば即座に修正します
- セッション跨ぎでの作業では、必ずこの計画書を参照して進捗を確認してください

### 期待される効果
1. **型安全性の大幅向上**: コンパイル時により多くのエラーを検出
2. **保守性の向上**: 新しいファイル種別の追加が容易に
3. **可読性の向上**: 意味的に明確な型定義
4. **バグの削減**: undefinedによる実行時エラーの防止