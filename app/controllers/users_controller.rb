class UsersController < ApplicationController
  before_action :authenticate_user!  # ログイン必須
  include Pagy::Backend

  def mypage
    @user = current_user
    @active_tab = params[:tab].presence || "events"
    @events_count = @user.events.count
    @member_lists_count = @user.member_lists.count
    @events = []
    @member_lists = []

    case @active_tab
    when "member_lists"
      @pagy_member_lists, @member_lists = pagy(
        @user.member_lists.order(created_at: :desc),
        items: 10,
        page_param: "member_lists_page"
      )
    when "account"
      # 一覧の読み込みは行わない
    else
      @pagy_events, @events = pagy(
        @user.events.order(created_at: :desc),
        items: 10,
        page_param: "events_page"
      )
    end
  end

  def update_preferences
    @user = current_user

    if @user.update(user_preferences_params)
      redirect_to mypage_path(tab: "account"), notice: "設定を保存しました"
    else
      # エラー時もmypageをレンダリング（accountタブを表示）
      @active_tab = "account"
      @events_count = @user.events.count
      @member_lists_count = @user.member_lists.count
      @events = []
      @member_lists = []
      flash.now[:alert] = "設定の保存に失敗しました"
      render :mypage
    end
  end

  def timezone_settings
    @user = current_user
  end

  def update_timezone
    @user = current_user
    if @user.update(user_preferences_params)
      redirect_to timezone_settings_path, notice: "タイムゾーンを保存しました"
    else
      render :timezone_settings
    end
  end

  def style_settings
    @user = current_user
  end

  def update_style
    @user = current_user
    if @user.update(style_preferences_params)
      redirect_to style_settings_path, notice: "スタイルを保存しました"
    else
      render :style_settings
    end
  end

  private

  def user_preferences_params
    params.require(:user).permit(:timezone)
  end

  def style_preferences_params
    params.require(:user).permit(:theme_preference)
  end
end
