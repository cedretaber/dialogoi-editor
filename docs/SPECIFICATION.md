# Dialogoi Editor 仕様書

## 概要

Dialogoi Editor は小説執筆支援ツールとして、小説作品の設定管理、登場人物管理、用語管理、伏線管理などを統合的に扱うシステムです。

## ファイルシステム構造

### 基本構造

- 1つのディレクトリ = 1つの小説作品（小説のルートディレクトリ）
- 各ディレクトリには `README.md` と `meta.yaml` を配置
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
   - メインキャラクターフラグ (`main: true/false`)
   - 複数キャラクター記述フラグ (`multi: true/false`)
   - 将来的に一人称、呼び方などのメタデータ拡張予定

4. **伏線** (`foreshadowing:`)
   - 埋蔵位置 (`start:`)
   - 回収位置 (`goal:`)
   - 専用UIでの可視化を想定

## ディレクトリ構造例

```
novel/
├── README.md
├── meta.yaml
├── dialogoi.yaml
├── contents/
│   ├── README.md
│   ├── meta.yaml
│   ├── content1.txt
│   ├── content2.txt
│   ├── content3.txt
│   ├── otherstories/
│   │   ├── README.md
│   │   ├── meta.yaml
│   │   ├── a.txt
│   │   └── b.txt
│   └── memo.md
└── settings/
    ├── README.md
    ├── meta.yaml
    ├── setting1.md
    ├── setting2.md
    ├── characters/
    │   ├── README.md
    │   ├── meta.yaml
    │   ├── character1.md
    │   ├── character2.md
    │   └── characters.md
    ├── glossary.md
    └── foreshadowings/
        ├── README.md
        ├── meta.yaml
        ├── foreshadowing1.md
        └── foreshadowing2.md
```

## meta.yaml 仕様

### 基本構造

```yaml
readme: README.md  # ディレクトリ選択時の表示内容
files:            # ファイル・サブディレクトリのリスト（順序を保持）
  - name: ファイル名またはディレクトリ名
    type: content | setting | subdirectory
    hash: "sha256:abcd1234..."  # ファイルのSHA-256ハッシュ（変更検知用）
    # 以下はオプション
    tags: ["タグ1", "タグ2"]
    references: ["パス1", "パス2"]  # 小説ルートからの相対パス
    reviews: "ファイル名_reviews.yaml"  # レビューファイルへの参照
    review_count:                    # レビュー数のサマリー
      open: 3
      resolved: 5
    glossary: true                   # 用語集の場合
    character:                       # キャラクター設定の場合
      main: true/false
      multi: true/false
    foreshadowing:                   # 伏線の場合
      start: "開始位置のパス"
      goal: "回収位置のパス"
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

（仕様策定中）

小説作品全体のメタデータを記述：
- 作品タイトル
- 著者情報
- ジャンル
- 作成日時
- バージョン情報
- その他作品全体に関わる設定

## ファイル管理ルール

1. **管理対象の判定**
   - `meta.yaml` に記載されているファイル = 管理対象
   - 記載のないファイル = 管理対象外（UIで薄く表示）

2. **存在しないファイルの扱い**
   - `meta.yaml` に記載があるが存在しない = エラー表示（赤色、取り消し線）
   - UIから設定削除または新規作成が可能

3. **ファイル種別の変更**
   - 種別変更は可能
   - ただし、変更前の種別固有のメタデータは失われる

## UI仕様

### 表示

- VSCode左側ペインにツリービュー表示
- `meta.yaml` の順序に従って表示
- アイコンで種別を視覚的に区別
  - 📄 本文
  - ⚙️ 一般設定
  - 📚 用語集
  - 👤 キャラクター
  - 🔮 伏線

### 操作

- ドラッグ&ドロップで並び順変更（`meta.yaml` 自動更新）
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

## レビュー機能仕様

### 概要

編集者やAIからのフィードバックを本文・設定ファイルと紐付けて管理する機能。レビューは専用のYAMLファイルで管理される。

### レビューファイル形式

```yaml
# novel/contents/content1.txt_reviews.yaml
target_file: "contents/content1.txt"
file_hash: "sha256:abcd1234..."  # 対象ファイルのハッシュ（変更検知用）
reviews:
  - line: 42                      # 行番号
    position: { start: 10, end: 25 }  # 行内の文字位置
    reviewer: "編集者A"
    type: "human"                 # human / ai / system
    severity: "suggestion"        # error / warning / suggestion / info
    content: "この表現は別の言い回しの方が..."
    created_at: "2024-01-15T10:30:00Z"
    status: "open"                # open / in_progress / resolved / dismissed
    thread:                       # コメントスレッド（オプション）
      - author: "執筆者"
        content: "確認しました。修正します"
        created_at: "2024-01-15T11:00:00Z"
      - author: "編集者A"
        content: "ありがとうございます"
        created_at: "2024-01-15T11:30:00Z"
```

### ファイル配置規則

- レビューファイルは対象ファイルと同じディレクトリに配置
- ファイル名は `対象ファイル名_reviews.yaml` 形式
- 例: `contents/chapter1/content1.txt` → `contents/chapter1/content1.txt_reviews.yaml`

### レビューのステータス

- `open`: 未対応
- `in_progress`: 対応中
- `resolved`: 解決済み
- `dismissed`: 却下

### 変更検知

- `file_hash` と現在のファイルハッシュが異なる場合、UIで警告表示
- 「対象ファイルが変更されています。レビュー位置を確認してください」

### UI表示

- 本文エディタ内でレビュー位置をマーカー表示
- サイドパネルでレビュー一覧表示
- フィルタリング機能（ステータス、レビュアー、重要度）
- スレッド形式での議論が可能

## 今後の拡張予定

- メタデータのスキーマバリデーション
- インポート/エクスポート機能
- 複数作品間の連携
- Dialogoi MCP サーバとの統合
- レビューの一括処理機能