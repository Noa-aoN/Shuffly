class MemberListsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_member_list, only: [:edit, :update, :destroy]

  def index
    @member_lists = current_user.member_lists.order(created_at: :desc)
  end

  def new
    @member_list = current_user.member_lists.new
  end

  def create
    @member_list = current_user.member_lists.new(member_list_params)

    if @member_list.save
      redirect_to mypage_path(tab: 'member_lists'), notice: "メンバーリストを作成しました"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @member_list.update(member_list_params)
      redirect_to mypage_path(tab: 'member_lists'), notice: "メンバーリストを更新しました"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @member_list.destroy
    redirect_to mypage_path(tab: 'member_lists'), notice: "メンバーリストを削除しました"
  end

  private

  def set_member_list
    @member_list = current_user.member_lists.find_by(id: params[:id])
    redirect_to mypage_path(tab: 'member_lists'), alert: "メンバーリストが見つかりません" unless @member_list
  end

  def member_list_params
    params.require(:member_list).permit(:name, :members_text)
  end
end
