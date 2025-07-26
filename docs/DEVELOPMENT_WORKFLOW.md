# 開発ワークフロー

Dialogoi EditorがVSCode Marketplaceに公開されたため、以下のワークフローに従って開発を進めます。

## ブランチ戦略

- `master`: 常に安定した最新版（リリース可能な状態を維持）
- `feature/*`: 新機能開発用ブランチ
- `fix/*`: バグ修正用ブランチ

## 開発フロー

### 1. 新機能開発

```bash
# featureブランチを作成
git checkout -b feature/機能名

# 開発・テスト
npm run check-all

# コミット
git add .
git commit -m "feat: 機能の説明"

# masterにマージ
git checkout master
git merge feature/機能名

# ブランチ削除
git branch -d feature/機能名
```

### 2. バグ修正

```bash
# fixブランチを作成
git checkout -b fix/バグ名

# 修正・テスト
npm run check-all

# コミット
git add .
git commit -m "fix: バグの説明"

# masterにマージ
git checkout master
git merge fix/バグ名
```

### 3. リリース手順

```bash
# 1. package.jsonのバージョンを更新
# 2. CHANGELOG.mdを更新

# 3. 変更をコミット
git add package.json CHANGELOG.md
git commit -m "chore: v1.x.x リリース準備"

# 4. タグを作成
git tag -a v1.x.x -m "Release v1.x.x: 主な変更点"

# 5. タグをプッシュ
git push origin master
git push origin v1.x.x

# 6. VSCode Marketplaceに公開
npm run package
npx vsce publish
```

## バージョニング規則

[セマンティックバージョニング](https://semver.org/lang/ja/)に従います：

- **パッチ版 (1.0.x)**: バグ修正、ドキュメント更新
- **マイナー版 (1.x.0)**: 新機能追加（後方互換性維持）
- **メジャー版 (x.0.0)**: 破壊的変更

## コミットメッセージ規則

```
feat: 新機能
fix: バグ修正
docs: ドキュメントのみの変更
style: コードの意味に影響しない変更
refactor: バグ修正や機能追加を伴わないコード変更
test: テストの追加・修正
chore: ビルドプロセスやツールの変更
```

## 品質チェック

リリース前に必ず実行：

```bash
npm run check-all
```

- TypeScript型チェック
- ESLintチェック（警告0個必須）
- Prettierフォーマット
- 全テスト実行（615件以上）