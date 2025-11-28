Rails.application.routes.draw do
  # Devise でユーザー認証
  devise_for :users

  # ホーム
  root "home#index"

  # イベント関連
  resources :events do
    post :save_result, on: :member
    get  :export_result, on: :member
  end

  # マイページ
  get "mypage", to: "users#mypage", as: :mypage

  # 設定ページ（オプション）
  resource :settings, only: [:edit, :update]

  # 健康チェック・PWA関連
  get "up" => "rails/health#show", as: :rails_health_check
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
end