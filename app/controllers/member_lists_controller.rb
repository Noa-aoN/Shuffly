class MemberListsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_member_list, only: [:edit, :update, :destroy, :show]

  def index
    @member_lists = current_user.member_lists.order(created_at: :desc)

    respond_to do |format|
      format.html
      format.json do
        render json: @member_lists.map { |ml|
          {
            id: ml.id,
            name: ml.name,
            members: ml.members,
            members_count: ml.members.count,
            created_at: ml.created_at.strftime('%Y年%m月%d日')
          }
        }
      end
    end
  end

  def show
    respond_to do |format|
      format.json do
        render json: {
          id: @member_list.id,
          name: @member_list.name,
          members: @member_list.members,
          members_count: @member_list.members.count
        }
      end
    end
  end

  def new
    @member_list = current_user.member_lists.new
  end

  def create
    @member_list = current_user.member_lists.new(member_list_params)

    if @member_list.save
      redirect_to mypage_path(tab: "member_lists"), notice: "メンバーリストを作成しました"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @member_list.update(member_list_params)
      redirect_to mypage_path(tab: "member_lists"), notice: "メンバーリストを更新しました"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @member_list.destroy
    redirect_to mypage_path(tab: "member_lists"), notice: "メンバーリストを削除しました"
  end

  private

  def set_member_list
    @member_list = current_user.member_lists.find_by(id: params[:id])
    redirect_to mypage_path(tab: "member_lists"), alert: "メンバーリストが見つかりません" unless @member_list
  end

  def member_list_params
    params.require(:member_list).permit(:name, :members_text)
  end
end
