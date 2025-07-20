# Phase 6: ドラッグ&ドロップ機能 実装計画

## 概要

TreeViewからエディタへのドラッグ&ドロップ機能を実装し、参照機能のエンハンスを完了する。

## 機能仕様

### 基本動作
- **ドラッグ元**: DialogoiTreeView内のファイルアイテム
- **ドロップ先**: 開いているエディタファイル
- **制約**: 同一プロジェクト内のファイルのみ対象

### ドロップ先別の動作

#### 1. 本文ファイル（content）へのドロップ
- **処理**: meta.yamlの`references`配列にパスを追加
- **パス形式**: プロジェクトルート相対パス
- **重複チェック**: 既存参照との重複を回避
- **更新**: TreeViewとWebViewの自動更新

#### 2. 設定ファイル（setting）へのドロップ
- **処理**: カーソル位置にマークダウンリンクを挿入
- **リンク形式**: `[ファイル名](相対パス)`
- **パス形式**: 現在ファイルからの相対パス
- **カーソル**: リンク挿入後、リンクテキスト部分を選択状態

## 実装段階

### Phase 6.1: 基盤実装（優先度：高）
**目標**: ドラッグ&ドロップの基本機能を実装

#### 実装項目
1. **TreeViewDragAndDropController実装**
   - `vscode.TreeDragAndDropController`インターフェース実装
   - ドラッグ可能アイテムの判定（ファイルのみ）
   - データ転送形式の定義

2. **DialogoiTreeDataProvider拡張**
   - `dragAndDropController`プロパティ追加
   - ドラッグ開始時のデータ準備

3. **基本的なドロップハンドリング**
   - アクティブエディタの取得
   - ドロップされたアイテムの解析
   - エラーハンドリング（無効なドロップの処理）

#### 期待される成果
- TreeViewからのドラッグが開始される
- エディタへのドロップが検知される
- 基本的なログ出力とエラーハンドリング

### Phase 6.2: 本文ファイル対応（優先度：高） ✅ **完了**
**目標**: 本文ファイルへのドロップでreferences更新を実装

#### 実装完了項目
1. **ファイル種別判定サービス** ✅
   - ドロップ先ファイルの種別判定（content/setting/他）
   - 既存CharacterServiceとの統合

2. **参照追加処理** ✅
   - MetaYamlServiceを使用した参照追加
   - パス正規化（ProjectPathNormalizationService活用）
   - 重複チェックと確認ダイアログ

3. **UI更新** ✅
   - ReferenceManagerの更新
   - TreeViewとWebViewの同期更新（FileChangeNotificationService経由）

#### 期待される成果
- 本文ファイルにドロップすると参照が追加される
- 既存参照との重複が適切に処理される
- UI上で変更が即座に反映される

### Phase 6.3: 設定ファイル対応（優先度：高） ✅ **完了**
**目標**: 設定ファイルへのドロップでマークダウンリンク挿入を実装

#### 実装完了項目
1. **エディタ操作サービス** ✅
   - カーソル位置の取得
   - テキスト挿入とカーソル移動
   - テキスト選択状態の制御

2. **リンク生成処理** ✅
   - 相対パス計算（現在ファイル → ドロップファイル）
   - マークダウンリンク形式の生成
   - ファイル名の表示名対応（CharacterService活用）

3. **エディタ統合** ✅
   - VSCode TextEditorとの連携
   - 元に戻す(Undo)操作への対応

#### 期待される成果
- 設定ファイルにドロップするとマークダウンリンクが挿入される
- 相対パスが正しく計算される
- 挿入後のユーザビリティが良好

### Phase 6.4: UI/UX改善（優先度：中）
**目標**: ユーザー体験の向上と操作性改善

#### 実装項目
1. **視覚的フィードバック**
   - ドラッグ中のカーソル表示
   - ドロップ可能領域のハイライト
   - 操作完了時の通知メッセージ

2. **操作性向上**
   - キーボードショートカットとの併用
   - 複数ファイル選択への対応検討
   - ドラッグキャンセル操作

3. **エラー対応強化**
   - 詳細なエラーメッセージ
   - 操作ガイダンスの表示
   - ログ出力の充実

#### 期待される成果
- 直感的で使いやすいドラッグ&ドロップ操作
- 明確なフィードバックとガイダンス
- 堅牢なエラーハンドリング

## アーキテクチャ設計

### 依存関係分離パターン

プロジェクトのアーキテクチャに従い、VSCode依存とビジネスロジックを明確に分離します：

#### サービス層（VSCode非依存）
- **場所**: `/src/services/`
- **責務**: 純粋なビジネスロジック
- **特徴**: 
  - VSCode APIへの直接アクセス禁止
  - 単体テスト可能
  - 依存関係注入パターン使用

#### コマンド層（VSCode依存）
- **場所**: `/src/commands/`
- **責務**: VSCodeとの連携・UI操作
- **特徴**:
  - VSCode API使用可能
  - サービス層のビジネスロジックを利用
  - ユーザーインターフェース制御

#### 実装例

```typescript
// services/DropHandlerService.ts（VSCode非依存）
export class DropHandlerService {
  // 純粋なビジネスロジック
  async handleDrop(targetPath: string, droppedData: DroppedFileInfo): Promise<DropResult> {
    // ファイル種別判定、参照追加、リンク生成など
  }
}

// commands/dropCommands.ts（VSCode依存）
export function registerDropCommands(context: vscode.ExtensionContext) {
  // VSCode DocumentDropEditProvider実装
  // DropHandlerServiceを呼び出してビジネスロジック実行
  // 結果をVSCode UIに反映
}
```

### 技術的検討事項

#### VSCode API使用箇所（commands層のみ）
- `vscode.TreeDragAndDropController`: ドラッグ&ドロップ制御
- `vscode.DocumentDropEditProvider`: エディタドロップ処理
- `vscode.window.activeTextEditor`: アクティブエディタ取得
- `vscode.Position`, `vscode.Range`: カーソル位置・テキスト範囲
- `vscode.WorkspaceEdit`: テキスト編集操作

#### 既存サービスとの連携（services層）
- **DropHandlerService**: ドロップ処理のビジネスロジック
- **MetaYamlService**: 参照追加・更新
- **CharacterService**: ファイル種別判定・表示名取得
- **ProjectPathNormalizationService**: パス正規化
- **ReferenceManager**: 参照関係管理
- **FilePathMapService**: ファイル存在チェック

### データ転送形式
```typescript
interface DraggedTreeItem {
  type: 'dialogoi-file';
  path: string;           // プロジェクトルート相対パス
  name: string;           // ファイル名
  fileType: 'content' | 'setting' | 'subdirectory';
  absolutePath: string;   // 絶対パス
}
```

### パフォーマンス考慮
- ドラッグ開始時の軽量化（重い処理は遅延実行）
- ファイル種別判定のキャッシュ化
- 大量ファイルプロジェクトでの応答性確保

## テスト戦略

### Phase 6.1 テスト
- ドラッグ開始・終了の検証
- 無効なドロップの拒否
- エラーハンドリング

### Phase 6.2 テスト
- 参照追加の動作確認
- 重複参照の処理
- パス正規化の検証

### Phase 6.3 テスト
- マークダウンリンク挿入
- 相対パス計算の正確性
- エディタ操作の整合性

### Phase 6.4 テスト
- UI操作の快適性
- エラーメッセージの妥当性
- 複雑なシナリオでの動作

## 完了条件

### 機能要件 ✅ **全て完了**
- [x] TreeViewからのドラッグが可能
- [x] 本文ファイルへのドロップで参照追加
- [x] 設定ファイルへのドロップでリンク挿入
- [x] 適切なエラーハンドリング
- [x] WebViewの即座更新（FileChangeNotificationService実装）

### 品質要件 ✅ **全て完了**
- [x] 既存テストが全て通過
- [x] 新機能のテストカバレッジ80%以上
- [x] TypeScript型エラー0個
- [x] ESLint警告0個

### UX要件 ✅ **全て完了**
- [x] 直感的な操作感
- [x] 明確な視覚的フィードバック
- [x] 適切なエラーメッセージ
- [x] パフォーマンスの問題なし

## 追加実装項目

### FileChangeNotificationService
- ファイル変更イベントの中央集権管理
- EventEmitterRepositoryパターンによるVSCode非依存化
- WebViewとTreeViewの自動同期更新

### ドラッグ&ドロップ時の即座UI更新
- DropHandlerServiceからFileChangeNotificationServiceへの通知
- ReferenceManagerの更新処理
- FileDetailsViewProviderのgetUpdatedCurrentItem()実装

## 実装優先順位

1. **Phase 6.1**: 基盤実装 → 即座に開始可能
2. **Phase 6.2**: 本文ファイル対応 → 高い価値提供
3. **Phase 6.3**: 設定ファイル対応 → 機能完成に必須
4. **Phase 6.4**: UI/UX改善 → 時間があれば実施

各Phaseは独立性が高く、段階的な実装・テスト・リリースが可能です。