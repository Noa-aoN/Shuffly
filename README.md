[![Ruby](https://img.shields.io/badge/Ruby-3.2.3-ruby.svg)](https://ruby-lang.org)
[![Rails](https://img.shields.io/badge/Rails-7.2.3-red.svg)](https://rubyonrails.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://www.docker.com)

# Shuffly

Shuffly は、参加者のグループ分け、順番決め、役割決めを行うための
Rails アプリケーションです。懇親会、勉強会、ワークショップ、社内イベントなどで、
繰り返し使っても偏りが出にくいランダム化体験を目指しています。

## 主な機能

- メンバーの直接入力
- メンバーリストの保存と再利用
- グループ分け履歴の保持
- 順番決め履歴の保持
- 役割決め履歴の保持
- 結果のコピーとテキスト出力
- ユーザー登録、イベント履歴、設定機能

## 技術スタック

- Ruby 3.2.3
- Rails 7.2.3
- PostgreSQL
- Docker Compose
- Turbo / Stimulus
- esbuild
- Tailwind CSS

## ドメインモデル

### Event

イベントの作業状態と結果履歴を保持します。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `user_id` | bigint | 所有ユーザー |
| `title` | string | イベント名 |
| `memo` | text | メモ |
| `data_version` | integer | データ形式バージョン |
| `members_data` | jsonb | メンバー情報 |
| `group_rounds` | jsonb | グループ分け履歴 |
| `order_rounds` | jsonb | 順番決め履歴 |
| `role_rounds` | jsonb | 役割決め履歴 |
| `co_occurrence_cache` | jsonb | 組み合わせキャッシュ |

### MemberList

ログインユーザーが再利用するメンバーリストです。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `user_id` | bigint | 所有ユーザー |
| `name` | string | リスト名 |
| `members_json` | jsonb | メンバー配列 |

### User

Devise で管理する認証ユーザーです。

| カラム | 型 | 用途 |
| --- | --- | --- |
| `email` | string | ログイン用メールアドレス |
| `encrypted_password` | string | パスワードハッシュ |
| `name` | string | 表示名 |
| `timezone` | string | IANA タイムゾーン |
| `theme_preference` | string | UI テーマ |

## ローカルセットアップ

### Docker で起動

```bash
docker compose build
docker compose up
```

起動後、`http://localhost:3000` を開きます。

### よく使うコマンド

```bash
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
docker compose exec web bundle exec brakeman
```

## ディレクトリ構成

```text
app/
  controllers/   リクエスト処理
  models/        ドメインルールと永続化
  views/         サーバー描画UI
  javascript/    クライアント側の挙動
config/
db/
spec/
```

## 現在の技術的な重点

- デプロイとローカル起動の安定化
- イベント所有権まわりの認可強化
- イベント保存・更新処理の責務整理
- フロントエンドの大きなロジック分割

## 改善アイデア

### 機能

- イベント履歴の要約表示強化
- メンバーリストの検索、複製、整理
- 既存イベントの続きから編集導線の改善
- 発表画面、共有画面の強化

### UX / UI

- 保存成功 / 失敗フィードバックの改善
- モバイルでの編集体験の改善
- 更新モードの視覚的な明確化
- 出力 / 共有 / 保存エリアの情報整理

### 実装改善

- イベントパラメータ正規化処理の共通化
- `events_new.js` の責務分割
- リクエスト spec と model spec の拡充
- 開発者向け運用ドキュメントの整備

## デプロイ

- 本番環境: Render
- URL: `https://shuffly.onrender.com/`
