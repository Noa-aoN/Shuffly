[![Ruby](https://img.shields.io/badge/Ruby-3.2.3-ruby.svg)](https://ruby-lang.org)
[![Rails](https://img.shields.io/badge/Rails-7.2.3-red.svg)](https://rubyonrails.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg)](https://www.docker.com)

## 概要
Shuffly は、参加者をシャッフルしてグループ分けや役割分担を行うためのWebアプリです。
懇親会・LT会・ミーティングなど、人数や目的に応じて柔軟に活用できます。

## アプリを作った理由
懇親会などで複数回のグループ分けを行う際、低被りでシャッフルできるツールが欲しいと考え開発しました。
また、LTの登壇順決めや会議での役割分担など、イベント運営全般で使える汎用ツールを目指しています。
未使用技術の実践と、期限付きで完成させる開発題材としても適していると判断しました。

## できること（機能一覧）
- 基本機能
  - メンバーの手軽な入力 / インポート
  - グループの自動振り分け（履歴を保持）
  - 順番の自動割り当て（履歴を保持）
  - 役割の自動割り当て（履歴を保持）
  - 結果のコピー・エクスポート
- 会員機能
  - ログイン/サインアップ機能
  - マイページ
    - イベント履歴一覧/詳細確認
    - メンバーリスト作成/確認/編集機能
    - アカウント設定機能（アカウント情報・スタイル設定）

## 技術スタック
- Ruby（3.2.3）
- Ruby on Rails（7.2.3）
- Docker / docker-compose
- PostgreSQL

## プロジェクト構造
```
app/
├── controllers/     # コントローラ（ApplicationController, EventsController, etc.）
├── models/          # モデル（Event, MemberList, User）
├── views/           # ビュー
├── javascript/      # JavaScript（Turbo/Stimulus）
└── helpers/         # ビューヘルパー
```

## データベース構造

### Event（シャッフルイベント）
| カラム | 型 | 用途 |
|--------|-----|------|
| id | bigint | 主キー |
| user_id | bigint | 外部キー（users） |
| title | string | イベント名 |
| memo | text | メモ |
| data_version | integer | データフォーマット版数（1=旧JSON, 2=正規化, 3=ハイブリッド） |
| members_data | jsonb | メンバーデータ [{id: 1, name: "John"}, ...] |
| group_rounds | jsonb | グループシャッフル履歴 [{round: 1, assignments: [...], settings: {...}}, ...] |
| order_rounds | jsonb | 順番シャッフル履歴 [{round: 1, order: [member_ids], ...}, ...] |
| role_rounds | jsonb | 役割割り当て履歴 [{round: 1, assignments: [...], ...}, ...] |
| co_occurrence_cache | jsonb | 共起回数キャッシュ {"1_2": 3, ...} |

### MemberList（メンバーリスト）
| カラム | 型 | 用途 |
|--------|-----|------|
| id | bigint | 主キー |
| user_id | bigint | 外部キー（users） |
| name | string | リスト名 |
| members_json | jsonb | メンバーJSON配列 |

### User（ユーザー）
| カラム | 型 | 用途 |
|--------|-----|------|
| id | bigint | 主キー |
| email | string | メールアドレス（ユニーク） |
| encrypted_password | string | 暗号化パスワード（Devise） |
| name | string | 表示名 |
| reset_password_token | string | パスワードリセットトークン |
| remember_created_at | datetime | ログイン状態保持 |

## 開発環境セットアップ

```bash
docker compose build
docker compose up
```

ブラウザで http://localhost:3000 にアクセス

## 主要なGem
| Gem | 用途 |
|-----|------|
| devise | 認証機能 |
| turbo-rails | ホットワイヤ（SPA風ページ遷移） |
| stimulus-rails | JavaScriptフレームワーク |
| meta-tags | メタタグ・OGP設定 |
| pg | PostgreSQLアダプタ |
| puma | Webサーバー |
| rubocop-rails-omakase | コードスタイルチェック |
| brakeman | セキュリティチェック |

## コーディング規約
- Rubocopを使用
- Brakemanでセキュリティチェック
- 日本語コメントを推奨

## 今後の改善ポイント
- ✅ ログイン/サインアップ機能
- ✅ マイページ（イベント履歴一覧・メンバーリスト登録）
- ✅ メンバーリスト機能
- トップページ（カードクリックのモーダル表示）
- 新規シャッフルイベントページ（順番/役割履歴のUI改善・オプション追加・使い方/説明）
- 画面共有ページ

## デプロイ
- Render で公開
- URL: https://shuffly.onrender.com/