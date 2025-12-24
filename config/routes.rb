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

  # ---- 以下、システム関連 ----
  get "up" => "rails/health#show", as: :rails_health_check
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
end
