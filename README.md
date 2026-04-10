[![Ruby](https://img.shields.io/badge/Ruby-3.3.11-ruby.svg)](https://ruby-lang.org)
[![Rails](https://img.shields.io/badge/Rails-7.2.3-red.svg)](https://rubyonrails.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://www.docker.com)

# Shuffly

Shuffly は、グループ分け・順番決め・役割分担をその場で素早く決めるための Rails アプリケーションです。  
懇親会、勉強会、ワークショップ、社内イベント、授業運営などで、繰り返し使っても偏りが出にくいランダム化体験を目指しています。

- 登録なしでもすぐ使える
- ログイン後はイベント保存と続きからの再開に対応
- メンバーリストの保存と再利用ができる

## できること

### メンバー入力

- メンバーを直接入力
- テキスト / CSV から入力
- 保存済みメンバーリストを呼び出し

### シャッフル実行

- グループ分け
- 順番決め
- 役割決め

### 保存と再開

- イベントの保存
- イベント履歴の確認
- 保存済みイベントの続きから編集

### 出力と共有

- 結果のコピー
- テキスト出力

## クイックスタート

もっとも簡単なのは Docker 起動です。

```bash
docker compose build
docker compose up
```

起動後、`http://localhost:3002` を開きます。

## ローカルセットアップ

### Docker で起動

```bash
docker compose build
docker compose up
```

### Docker での確認コマンド

```bash
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
docker compose exec web bundle exec brakeman
```

### ローカル実行で起動

ローカルで `bin/dev` を使う場合は、少なくとも以下が必要です。

- Ruby `3.3.11`
- Bundler `2.7.2`
- Node.js / Yarn
- PostgreSQL

Homebrew の `ruby@3.3` を使う場合は、先に PATH を通しておくと確実です。

```bash
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"
```

Docker の Postgres を流用してローカル Rails を起動する場合は、`DB_HOST=localhost` を付けます。

```bash
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"
bundle install
yarn install
DB_HOST=localhost bin/rails db:prepare
DB_HOST=localhost bin/dev
```

起動後、`http://localhost:3002` を開きます。

ホスト側の Ruby が要件を満たしていない場合は、Docker 起動を優先してください。

## 開発コマンド

### ローカル実行時

```bash
bundle exec rspec
bundle exec rubocop
bundle exec brakeman
```

### Docker 実行時

```bash
docker compose exec web bundle exec rspec
docker compose exec web bundle exec rubocop
docker compose exec web bundle exec brakeman
```

## 技術スタック

- Ruby 3.3.11
- Rails 7.2.3
- PostgreSQL 16
- Docker Compose
- Turbo / Stimulus
- esbuild
- Tailwind CSS

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

## 開発運用メモ

- Git 運用は [docs/decisions/git-workflow.md](docs/decisions/git-workflow.md) を参照
- 個人開発中は `develop` を実質的な開発ブランチとして扱い、PR は `main` 向けに作成
- コミットメッセージには prefix を必須化（`.githooks/commit-msg` で自動チェック）
  - 使用可能な prefix: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `perf:`, `style:`, `build:`
  - セットアップ: `git config core.hooksPath .githooks`

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
