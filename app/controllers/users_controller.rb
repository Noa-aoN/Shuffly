class UsersController < ApplicationController
  before_action :authenticate_user!  # ログイン必須

  def mypage
    @user = current_user
    @events = @user.events.order(created_at: :desc)
    @member_lists = @user.member_lists.order(created_at: :desc)
  end
end
