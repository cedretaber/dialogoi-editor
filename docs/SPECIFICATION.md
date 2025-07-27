# Dialogoi Editor 仕様書

## 概要

Dialogoi Editor は小説執筆支援ツールとして、小説作品の設定管理、登場人物管理、用語管理、伏線管理などを統合的に扱うシステムです。

## ファイルシステム構造

### 基本構造

- 1つのディレクトリ = 1つの小説作品（小説のルートディレクトリ）
- 各ディレクトリには `README.md` と `.dialogoi-meta.yaml` を配置
- 小説のルートディレクトリには追加で `dialogoi.yaml` を配置

### ファイルの種類

#### 1. 本文ファイル
- 1話 = 1ファイル
- プレーンテキスト（青空文庫形式対応）
- タグ付与可能

#### 2. 設定ファイル
- 1設定 = 1ファイル
- プレーンテキストまたはマークダウン形式
- タグ付与可能
- 関連する話を紐付け可能（ディレクトリ単位での指定も可）

### 設定ファイルの種別

1. **一般設定**
   - 通常の設定情報
   - プレーンテキストまたはマークダウン形式

2. **用語集** (`glossary: true`)
   - マークダウンのテーブル形式を想定
   - 将来的な辞書ファイル生成に活用

3. **キャラクター** (`character:`)
   - 重要度 (`importance: main/sub/background`)
   - 複数キャラクター記述フラグ (`multiple_characters: true/false`)
   - 表示名（マークダウンから自動取得）(`display_name: string`)
   - 将来的に一人称、呼び方などのメタデータ拡張予定

4. **伏線** (`foreshadowing:`)
   - 植込み位置 (`plants:` 配列)
     - `location`: ファイルパス
     - `comment`: コメント（オプション）
   - 回収位置 (`payoff:` オブジェクト)
     - `location`: ファイルパス
     - `comment`: コメント（オプション）
   - 専用UIでの可視化を想定

## ディレクトリ構造例

```
novel/
├── README.md
├── .dialogoi-meta.yaml
├── dialogoi.yaml
├── contents/
│   ├── README.md
│   ├── .dialogoi-meta.yaml
│   ├── content1.txt
│   ├── content2.txt
│   ├── content3.txt
│   ├── otherstories/
│   │   ├── README.md
│   │   ├── .dialogoi-meta.yaml
│   │   ├── a.txt
│   │   └── b.txt
│   └── memo.md
└── settings/
    ├── README.md
    ├── .dialogoi-meta.yaml
    ├── setting1.md
    ├── setting2.md
    ├── characters/
    │   ├── README.md
    │   ├── .dialogoi-meta.yaml
    │   ├── character1.md
    │   ├── character2.md
    │   └── characters.md
    ├── glossary.md
    └── foreshadowings/
        ├── README.md
        ├── .dialogoi-meta.yaml
        ├── foreshadowing1.md
        └── foreshadowing2.md
```

## .dialogoi-meta.yaml 仕様

### 基本構造

```yaml
readme: README.md  # ディレクトリ選択時の表示内容
files:            # ファイル・サブディレクトリのリスト（順序を保持）
  - name: ファイル名またはディレクトリ名
    type: content | setting | subdirectory
    # 以下はオプション
    tags: ["タグ1", "タグ2"]
    references: ["パス1", "パス2"]  # 小説ルートからの相対パス
    comments: ".ファイル名.comments.yaml"  # コメントファイルへの参照
    glossary: true                   # 用語集の場合
    character:                       # キャラクター設定の場合
      importance: main/sub/background
      multiple_characters: true/false
      display_name: "田中太郎"       # マークダウンから自動取得
    foreshadowing:                   # 伏線の場合
      plants:                        # 植込み位置（配列）
        - location: "contents/chapter1.txt"
          comment: "伏線の説明"
      payoff:                        # 回収位置（オブジェクト）
        location: "contents/chapter5.txt"
        comment: "回収の説明"
```

### ファイルタイプ

- `content`: 本文ファイル
- `setting`: 設定ファイル
- `subdirectory`: サブディレクトリ

### パス指定

- すべてのパスは小説のルートディレクトリからの相対パス
- ディレクトリ指定の場合は末尾に `/` を付ける

### 並び順

- `files` 配列の順序がUI上の表示順序
- 本文、設定、サブディレクトリの混在可能

## dialogoi.yaml 仕様

小説プロジェクトのルートディレクトリに配置される設定ファイル。このファイルの存在により、そのディレクトリがDialogoi Editorで管理される小説プロジェクトであることが識別されます。

### 基本構造

```yaml
title: "作品タイトル"
author: "著者名"
created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-01T00:00:00Z"
tags: ["ファンタジー", "青春", "学園"]
project_settings:
  readme_filename: "README.md"
  exclude_patterns:
    - ".*"
    - ".DS_Store"
    - "*.tmp"
```

### 必須フィールド

- `title` (string): 作品タイトル
- `author` (string): 著者名
- `created_at` (string): 作品作成日時（ISO 8601形式）
- `updated_at` (string): 最終更新日時（ISO 8601形式、自動更新）
- `project_settings` (object): プロジェクト固有の設定（必須）
  - `readme_filename` (string): READMEファイル名（デフォルト: "README.md"）
  - `exclude_patterns` (array): 除外パターン（glob形式）

### オプションフィールド

- `tags` (array): 作品のタグ（ジャンル、テーマなど）

### 例（完全仕様）

```yaml
title: "新しい小説"
author: "著者名"
created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-15T14:30:00Z"
tags: ["ファンタジー", "青春"]
project_settings:
  readme_filename: "README.md"
  exclude_patterns:
    - ".*"                    # 隠しファイル・ディレクトリ
    - ".DS_Store"             # macOS システムファイル
    - "Thumbs.db"             # Windows システムファイル
    - "desktop.ini"           # Windows システムファイル
    - "*.tmp"                 # 一時ファイル
    - "*.temp"                # 一時ファイル
    - "*.bak"                 # バックアップファイル
    - "*.log"                 # ログファイル
    - "node_modules"          # Node.js 依存関係
    - "dist"                  # ビルド成果物
    - "build"                 # ビルド成果物
    - ".git"                  # Git リポジトリ
    - ".gitignore"            # Git設定ファイル
    - ".svn"                  # Subversion
    - ".hg"                   # Mercurial
    - ".vscode"               # VSCode 設定
    - ".idea"                 # IntelliJ IDEA 設定
    - ".dialogoi-cache"       # Dialogoi キャッシュ
```

## ファイル管理ルール

1. **管理対象の判定**
   - `.dialogoi-meta.yaml` に記載されているファイル = 管理対象
   - 記載のないファイル = 管理対象外（UIで薄く表示）

2. **存在しないファイルの扱い**
   - `.dialogoi-meta.yaml` に記載があるが存在しない = エラー表示（赤色、取り消し線）
   - UIから設定削除または新規作成が可能

3. **ファイル種別の変更**
   - 種別変更は可能
   - ただし、変更前の種別固有のメタデータは失われる

## UI仕様

### 表示

#### TreeView（左サイドバー）
- VSCode左側ペインにツリービュー表示
- `.dialogoi-meta.yaml` の順序に従って表示
- アイコンで種別を視覚的に区別
  - 📄 本文
  - ⚙️ 一般設定
  - 📚 用語集
  - 👤 キャラクター
  - 🔮 伏線

#### WebView詳細画面（React実装・完全テスト済み）
- ファイル選択時にTreeView下部に詳細情報を表示
- 折りたたみ可能なセクション構成：
  - 📖 基本情報（ファイル名、種別、パス）
  - 🏷️ タグ管理（追加・削除・Enterキー対応）
  - 👥 登場人物（キャラクター数表示・詳細情報）
  - 📝 コメント（専用パネル・GitHub風行番号形式）
  - 🔗 参照関係（手動・ハイパーリンク参照の統合表示）
  - 🔮 伏線管理（植込み・回収位置のCRUD操作・設定ファイルのみ）

### 操作

- ドラッグ&ドロップで並び順変更（`.dialogoi-meta.yaml` 自動更新）
- ファイルクリックで内容表示・編集
- ディレクトリクリックで `README.md` 表示
- コンテキストメニューから各種操作
  - タグの追加・削除
  - 参照先の追加・削除
  - ファイル種別の変更
  - 管理対象への追加・除外

### 情報表示

- 自分を参照しているファイル一覧
- 関連する伏線一覧
- タグによるフィルタリング・検索

## コメント機能仕様

### 概要

執筆中のメモ・TODO・レビューコメントを本文・設定ファイルと紐付けて管理する機能。シンプルな行単位コメントとして統一管理され、専用のYAMLファイルで管理される。

### コメントファイル形式

```yaml
# novel/contents/.content1.txt.comments.yaml
comments:
  - id: 1
    target_file: "contents/content1.txt#L42"  # GitHub風行番号形式
    file_hash: "sha256:abcd1234..."
    content: "この表現は別の言い回しの方が..."
    posted_by: "author"                       # dialogoi.yamlから自動取得
    status: "open"                            # open / resolved
    created_at: "2024-01-15T10:30:00Z"
  - id: 2
    target_file: "contents/content1.txt#L4-L7"  # 複数行対応
    file_hash: "sha256:abcd1234..."
    content: "この段落全体を見直し"
    posted_by: "author"
    status: "resolved"
    created_at: "2024-01-16T10:30:00Z"
```

### ファイル配置規則

- コメントファイルは対象ファイルと同じディレクトリに配置
- ファイル名は `.{対象ファイル名}.comments.yaml` 形式（隠しファイル）
- 例: `contents/chapter1.txt` → `contents/.chapter1.txt.comments.yaml`

### コメントのステータス

- `open`: 未対応・TODO
- `resolved`: 解決済み・完了

### 行番号指定形式

- **単一行**: `ファイルパス#L42` (42行目)
- **複数行**: `ファイルパス#L4-L7` (4行目から7行目)
- GitHub準拠の形式で将来的な拡張性を確保

### 変更検知

- `file_hash` と現在のファイルハッシュが異なる場合、UIで警告表示
- 「対象ファイルが変更されています。コメント位置を確認してください」

### UI表示

- **専用コメントパネル**: サイドバー内の独立パネル
- **マークダウン対応**: リアルタイムプレビューとソース編集
- **TODO機能統合**: `- [ ]` / `- [x]` チェックボックス対応
- **インライン編集**: クリック→編集→自動保存
- **行ジャンプ機能**: 行番号クリックで該当位置に移動

## プロジェクト新規作成機能

### 概要

既存のディレクトリを Dialogoi Editor で管理する小説プロジェクトに変換する機能。

### 機能

1. **`dialogoi.yaml` 作成**: プロジェクトメタデータファイルを生成
2. **再帰的スキャン**: 指定ディレクトリ以下のすべてのファイルを検索
3. **自動 `.dialogoi-meta.yaml` 生成**: 各ディレクトリに適切な `.dialogoi-meta.yaml` を作成
4. **ファイル種別自動判定**: 
   - `.txt` → `content` (本文)
   - `.md` → `setting` (設定)
   - その他 → `setting` (設定)
5. **既存ファイル尊重**: 既存の `.dialogoi-meta.yaml` や `dialogoi.yaml` は変更しない
6. **除外パターン**: 不要なファイルを自動的に除外

### 除外パターン

デフォルトで以下のパターンが除外されます：

- `.*` - 隠しファイル
- `.DS_Store` - macOS システムファイル
- `Thumbs.db` - Windows システムファイル
- `*.tmp`, `*.bak` - 一時・バックアップファイル
- `node_modules/`, `.git/`, `.vscode/` - 開発関連ディレクトリ
- `*.log` - ログファイル
- `.dialogoi-cache/` - Dialogoi キャッシュ

### 処理フロー

1. ユーザーが「新規プロジェクト作成」を選択
2. プロジェクトメタデータ（タイトル、著者、タグ）を入力
3. 指定ディレクトリの再帰的スキャン
4. 除外パターンに基づいてファイルをフィルタリング
5. 各ディレクトリに対して `.dialogoi-meta.yaml` を作成（既存があれば保持）
6. プロジェクトルートに `dialogoi.yaml` を作成

## 今後の拡張予定

- メタデータのスキーマバリデーション
- インポート/エクスポート機能
- 複数作品間の連携
- Dialogoi MCP サーバとの統合
- コメント・TODOの一括処理機能