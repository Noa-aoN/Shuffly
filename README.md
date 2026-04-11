# Shuffly

Shuffly は、グループ分け・順番決め・役割分担をその場で素早く決めるための Rails アプリケーションです。  
懇親会、勉強会、ワークショップ、社内イベント、授業運営などで、繰り返し使っても偏りが出にくいランダム化体験を目指しています。

[![Shuffly OGP](app/assets/images/ogp.png)](https://shuffly.onrender.com/)

**公開 URL:** https://shuffly.onrender.com/

- 登録なしでもすぐ使える
- ログイン後はイベント保存と続きからの再開に対応
- メンバーリストの保存と再利用ができる

## 主な機能

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

## 想定ユースケース

- 懇親会や交流会のグループ分け
- 勉強会やワークショップの発表順決め
- 授業、研修、社内イベントでの役割分担
- 保存したイベントを後日再開して進行を続ける運用

## クイックスタート

もっとも簡単なのは Docker 起動です。依存関係をローカルにそろえなくても、そのまま動作確認できます。

```bash
docker compose build
docker compose up
```

起動後、`http://localhost:3002` を開きます。

## 開発

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

## 開発フロー

1. `docker compose up` でアプリを起動
2. 変更後に `bundle exec rspec` または `docker compose exec web bundle exec rspec` を実行
3. 必要に応じて `rubocop` と `brakeman` で静的確認
4. ブランチ運用は [docs/decisons/git-workflow.md](docs/decisons/git-workflow.md) に従う

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
