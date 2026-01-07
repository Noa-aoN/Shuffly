Rails.application.routes.draw do
  # Devise 認証
  devise_for :users

  # メイン画面をイベントページに統一 (SPA)
  root "events#index"

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

  # 非ログイン時のイベント紐付け
  get "events/link_pending", to: "events_linking#show", as: :link_pending_event
  post "events/link_pending", to: "events_linking#create"

  # メンバーリスト管理
  resources :member_lists

  # ---- 以下、システム関連 ----
  get "privacy", to: "pages#privacy", as: :privacy
  get "terms", to: "pages#terms", as: :terms
  get "up" => "rails/health#show", as: :rails_health_check

  # PWA対応
  get "service_worker.js", to: "pwa#service_worker", as: :pwa_service_worker
  get "manifest.json", to: "pwa#manifest", as: :pwa_manifest
end
