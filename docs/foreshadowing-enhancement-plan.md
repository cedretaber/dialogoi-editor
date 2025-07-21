# 伏線機能エンハンス実装計画

## 📋 概要

伏線機能を現在の「1対1」関係から「複数対1」関係に拡張し、より実用的な小説執筆支援機能を実装する。

### 現在の仕様
```typescript
foreshadowing?: {
  start: string;  // 1つの埋蔵位置
  goal: string;   // 1つの回収位置
}
```

### 新しい仕様
```yaml
foreshadowing:
  plants:
    - location: contents/本文1.txt
      comment: "Any comment here."
    - location: contents/本文3.txt
      comment: "Short comment."
  payoff:
    location: contents/本文5.txt
    comment: "Final revelation"
```

### UI改善
- 現在のサイドバー（FileDetailsView）に伏線編集パネルを追加
- 折りたたみ可能な「伏線設置」「伏線回収」セクション
- 将来的にドラッグ&ドロップでの直感的編集

---

## 🚀 実装フェーズ

**現在の進捗: Phase 1 完了済み ✅ → Phase 2 開始可能**

### Phase 1: データ構造変更 ✅ **完了**

#### 1.1 型定義の更新
- [x] `MetaYamlUtils.ts` の `DialogoiTreeItem` 型を更新
- [x] `ForeshadowingService.ts` の型定義を更新
- [x] 新しい `ForeshadowingData` インターフェース作成

```typescript
interface ForeshadowingData {
  plants: ForeshadowingPoint[];
  payoff: ForeshadowingPoint;
}

interface ForeshadowingPoint {
  location: string;
  comment: string;
}
```

#### 1.2 バリデーション機能の更新
- [x] `ForeshadowingService.validateForeshadowing()` の複数位置対応
- [x] `ForeshadowingService.getForeshadowingStatus()` のロジック更新
- [x] ステータス計算の新しいルール実装

**ステータス計算ルール（案）:**
```typescript
// plants配列の存在チェック + payoffの存在チェック
- 'error': plantsが空 または payoffが無効
- 'planned': payoffのみ存在（plantsは未作成）
- 'partially_planted': plantsの一部が存在
- 'fully_planted': plantsが全て存在、payoff未作成
- 'resolved': plants全て + payoff存在
```

#### 1.3 CRUD操作の更新
- [x] `FileOperationService.setForeshadowing()` の更新
- [x] `FileOperationService.removeForeshadowing()` の更新
- [x] MetaYamlの保存・読み込みロジック対応

---

### Phase 2: サービス層の実装 ✅ **必須**

#### 2.1 ForeshadowingServiceの拡張
- [ ] `addPlant(dirPath, fileName, plant)` メソッド追加
- [ ] `removePlant(dirPath, fileName, index)` メソッド追加
- [ ] `updatePlant(dirPath, fileName, index, plant)` メソッド追加
- [ ] `setPayoff(dirPath, fileName, payoff)` メソッド追加
- [ ] `removePayoff(dirPath, fileName)` メソッド追加

#### 2.2 バックワード互換性処理（移行期間）
- [ ] 既存の `{start, goal}` 形式の自動変換機能
- [ ] データマイグレーション用のユーティリティ関数

```typescript
// 旧形式から新形式への変換
function migrateLegacyForeshadowing(legacy: {start: string, goal: string}): ForeshadowingData {
  return {
    plants: [{ location: legacy.start, comment: "" }],
    payoff: { location: legacy.goal, comment: "" }
  };
}
```

---

### Phase 3: UI実装（サイドバー拡張） ✅ **コア機能**

#### 3.1 FileDetailsViewProviderの拡張
- [ ] 伏線編集セクションをWebViewに追加
- [ ] 折りたたみ可能なUI実装
- [ ] React コンポーネント作成

**追加するUIセクション:**
```
📖 ファイル詳細
├── 🏷️ タグ
├── 🔗 参照関係
├── 🎭 キャラクター設定
└── 🔮 伏線管理          ← 新規追加
    ├── 📍 伏線設置 (折りたたみ可)
    │   ├── 位置1: contents/chapter1.txt "最初のヒント"
    │   ├── 位置2: contents/chapter3.txt "補強する情報"
    │   └── [+ 位置を追加]
    └── 🎯 伏線回収 (折りたたみ可)
        └── 位置: contents/chapter5.txt "真相の明示"
```

#### 3.2 基本CRUD操作のUI実装
- [ ] 植え込み地点の追加・削除・編集
- [ ] 回収地点の設定・編集・削除
- [ ] コメント入力フィールド
- [ ] ファイルパス選択（QuickPick使用）

#### 3.3 既存コマンドの置き換え
- [ ] `dialogoi.editForeshadowing` コマンドの新UI対応
- [ ] `dialogoi.removeForeshadowing` コマンドの新UI対応
- [ ] 既存の入力ダイアログベースUIの段階的廃止

---

### Phase 4: テスト更新 ✅ **品質保証**

#### 4.1 単体テスト更新
- [ ] `ForeshadowingService.test.ts` の全面書き換え
- [ ] 新しいデータ構造でのテストケース作成
- [ ] エラーハンドリングのテスト

#### 4.2 統合テスト追加
- [ ] UI操作のテストシナリオ作成
- [ ] ファイル操作との連携テスト
- [ ] データマイグレーションのテスト

---

### Phase 5: 高度なUI機能（将来的） 🚀 **Enhancement**

#### 5.1 ドラッグ&ドロップ機能
- [ ] TreeViewからWebViewへのD&D実装
- [ ] ファイルパス自動入力機能
- [ ] UI状態の即座反映

#### 5.2 可視化機能
- [ ] 伏線の状態アイコン表示
- [ ] 進捗バー（何個中何個設置済み等）
- [ ] 伏線設置タイムライン表示

#### 5.3 専用編集画面（検討）
- [ ] WebViewPanelによる専用伏線編集画面
- [ ] より広い画面を活用した高度なUI
- [ ] プロジェクト全体の伏線一覧表示

---

## 🔧 技術的実装詳細

### データマイグレーション戦略

**破壊的変更のアプローチ:**
1. 新しいスキーマに完全移行
2. 既存データの自動変換（一度限り）
3. 旧形式のサポート完全廃止

**移行手順:**
```typescript
// MetaYamlService.loadMetaYaml() 内で実行
if (fileData.foreshadowing && typeof fileData.foreshadowing.start === 'string') {
  // 旧形式検出 - 新形式に変換
  const legacy = fileData.foreshadowing as {start: string, goal: string};
  fileData.foreshadowing = migrateLegacyForeshadowing(legacy);
  // 即座に保存して移行完了
  this.saveMetaYaml(dirPath, metaData);
}
```

### UI状態管理

**WebViewでの状態管理:**
```typescript
interface ForeshadowingUIState {
  plantsExpanded: boolean;
  payoffExpanded: boolean;
  editingPlantIndex?: number;
  editingPayoff: boolean;
}
```

---

## ✅ 完了チェックリスト

### Phase 1 完了条件 ✅
- [x] 新しいTypeScript型定義が完成している
- [x] ForeshadowingServiceのテストが新しい構造で動作する
- [x] データバリデーションが複数位置に対応している  
- [x] `npm run check-all` と `npm test` が成功する（全339件のテスト通過）
- [x] ESLint・Prettierチェック通過
- [x] WebViewビルド成功

**Phase 1の範囲調整**:
Phase 1は**新しいデータ構造の基盤確立**に集中し、UI関連のエラーは一時的に無効化してPhase 3で対応する。

### Phase 2 完了条件
- [ ] 伏線のCRUD操作が全て動作する
- [ ] ステータス計算が正しく動作する
- [ ] エラーハンドリングが適切に機能する

### Phase 3 完了条件
- [ ] サイドバーに伏線編集UIが表示される
- [ ] 基本的な編集操作が可能
- [ ] 折りたたみ機能が動作する
- [ ] 既存のTree Viewとの連携が保たれている

### Phase 4 完了条件
- [ ] 新機能の全テストが成功する
- [ ] 回帰テストが全て成功する
- [ ] エッジケースの処理が確認済み

---

## 📝 実装ログ

### 2025-07-21
- [x] 計画書の作成
- [x] Phase 1: データ構造変更 **完了**

### Phase 1 実装完了 (2025-07-21)

**実装した機能:**
- 伏線データ構造を `{start: string, goal: string}` から `{plants: ForeshadowingPoint[], payoff: ForeshadowingPoint}` に変更
- 新しいステータス計算: error, planned, partially_planted, fully_planted, resolved
- 複数植込み位置対応のバリデーション機能
- 全テストファイルの新構造対応（17件の新テストを含む）

**技術的知見:**
- 破壊的変更でも開発段階のため後方互換性は考慮不要
- ESLint strict-boolean-expressions への対応が必要（`==` → `===`、明示的なboolean判定）
- 古いUIコマンドは一時的に無効化し、Phase 3で新UIに置き換え予定

**品質保証:**
- 全339件のテスト成功
- TypeScript型チェック、ESLint、Prettier全て通過
- WebViewビルド成功

---

## 🎯 次回作業開始時の手順（Phase 2向け）

**Phase 1完了済み** - 次はPhase 2: サービス層の実装

1. このドキュメントの確認
2. Phase 2の作業内容を確認:
   - `addPlant()`, `removePlant()`, `updatePlant()` メソッドの追加
   - `setPayoff()`, `removePayoff()` メソッドの追加 
   - 詳細なCRUD操作の実装
3. 実装完了後は必ず `npm run check-all` でテスト通過確認
4. 完了後はチェックリストを更新し、Phase 3へ

---

**注意:** この機能は破壊的変更を伴います。開発段階のため後方互換性は考慮しません。各フェーズ完了後は必ずテストの成功を確認してからcommitしてください。