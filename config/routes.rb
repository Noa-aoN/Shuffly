Rails.application.routes.draw do
  # Devise 認証
  devise_for :users

  # メイン画面をイベントページに統一 (SPA)
  root "events#index"

  # 非ログイン時のイベント紐付け（resources :events の前に定義）
  get "events/link_pending", to: "events_linking#show", as: :link_pending_event
  post "events/link_pending", to: "events_linking#create"

  # イベント管理（JSON保存やSPA向け更新含む）
  resources :events do
    collection do
      get :presentation
    end

    member do
      patch :save  # SPA向け保存API
      get :export_result
    end
  end

  # マイページ
  get "mypage", to: "users#mypage", as: :mypage

  # ユーザー設定
  resources :users, only: [] do
    patch :update_preferences, on: :collection
  end

  # 設定ページ
  get 'settings/timezone', to: 'users#timezone_settings', as: :timezone_settings
  patch 'settings/timezone', to: 'users#update_timezone'
  get 'settings/style', to: 'users#style_settings', as: :style_settings
  patch 'settings/style', to: 'users#update_style'

  # メンバーリスト管理
  resources :member_lists

  # ---- 以下、システム関連 ----
  get "privacy", to: "pages#privacy", as: :privacy
  get "terms", to: "pages#terms", as: :terms
  get "up" => "rails/health#show", as: :rails_health_check

  # PWA対応 - 静的ファイルとして配信（publicディレクトリ）
  # サービスを再起動した後、以下のルートは不要になります
  # get "service_worker.js", to: "pwa#service_worker", as: :pwa_service_worker
  # get "manifest.json", to: "pwa#manifest", as: :pwa_manifest
end
