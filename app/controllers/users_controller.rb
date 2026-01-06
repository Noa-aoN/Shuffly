class UsersController < ApplicationController
  before_action :authenticate_user!  # ログイン必須
  include Pagy::Backend

  def mypage
    @user = current_user
    # イベントとメンバーリストで異なるページパラメータを使用
    @pagy_events, @events = pagy(@user.events.order(created_at: :desc), items: 10, page_param: 'events_page')
    @pagy_member_lists, @member_lists = pagy(@user.member_lists.order(created_at: :desc), items: 10, page_param: 'member_lists_page')
  end
end
