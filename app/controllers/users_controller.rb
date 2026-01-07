class UsersController < ApplicationController
  before_action :authenticate_user!  # ログイン必須
  include Pagy::Backend

  def mypage
    @user = current_user
    # イベントとメンバーリストで異なるページパラメータを使用
    @pagy_events, @events = pagy(@user.events.order(created_at: :desc), items: 10, page_param: 'events_page')
    @pagy_member_lists, @member_lists = pagy(@user.member_lists.order(created_at: :desc), items: 10, page_param: 'member_lists_page')
  end

  def update_preferences
    @user = current_user

    if @user.update(user_preferences_params)
      redirect_to mypage_path(tab: 'account'), notice: '設定を保存しました'
    else
      # エラー時もmypageをレンダリング（accountタブを表示）
      @pagy_events, @events = pagy(@user.events.order(created_at: :desc), items: 10, page_param: 'events_page')
      @pagy_member_lists, @member_lists = pagy(@user.member_lists.order(created_at: :desc), items: 10, page_param: 'member_lists_page')
      flash.now[:alert] = '設定の保存に失敗しました'
      render :mypage
    end
  end

  private

  def user_preferences_params
    params.require(:user).permit(:timezone)
  end
end
