# コントローラスペック用の認証ヘルパー
module ControllerSpecHelper
  # ログイン状態をシミュレート
  def login_as(user)
    if user.nil?
      # 非ログイン時: before_actionをバイパスしない（Deviseのリダイレクトを許可）
      # ただし、current_userをnilに設定
      @current_user = nil
    else
      # ログイン時: before_actionをバイパスしてcurrent_userをモック
      allow(controller).to receive(:current_user).and_return(user)
      allow(controller).to receive(:user_signed_in?).and_return(true)
      allow(controller).to receive(:authenticate_user!).and_return(true)
      @current_user = user
    end
  end

  # 非ログイン状態をシミュレート
  def logout
    @current_user = nil
    # before_actionをスタブしない（Deviseの実際の動作を許可）
  end

  # current_userを取得（テスト用）
  def current_user
    @current_user
  end
end
