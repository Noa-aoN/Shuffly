class EventsController < ApplicationController
  before_action :set_event, only: [ :show, :edit, :update, :destroy ]
  skip_before_action :set_event, only: [ :presentation ]

  def index
    @events = current_user ? current_user.events : Event.none
  end

  def new
    @event = Event.new

    # 「続きからシャッフル」機能：既存イベントのデータをロード
    if params[:load_event_id].present?
      @load_event = Event.find_by(id: params[:load_event_id])
      if @load_event
        @event.title = @load_event.title
        # JavaScriptで使用するためのデータ
        @load_event_data = {
          members_json: @load_event.members_json,
          member_results_json: @load_event.member_results_json,
          member_order_json: @load_event.member_order_json,
          setting_json: @load_event.setting_json,
          history_json: @load_event.history_json,
          title: @load_event.title
        }
      end
    end
  end

  def create
    @event = current_user ? current_user.events.build(event_params) : Event.new(event_params)

    if @event.save
      redirect_to @event, notice: "イベントを保存しました"
    else
      render :new
    end
  end

  def show
    # 保存済み JSON をロード
    @members = JSON.parse(@event.members_json || "[]")
    @results = JSON.parse(@event.member_results_json || "{}")
    @order = JSON.parse(@event.member_order_json || "{}")
    @settings = JSON.parse(@event.setting_json || "{}")
    @history = JSON.parse(@event.history_json || "[]")
  end

  def edit; end

  def update
    # デバッグログ
    Rails.logger.info "=== DEBUG: event_params = #{event_params.inspect}"
    Rails.logger.info "=== DEBUG: @event.memo before = #{@event.memo.inspect}"

    if @event.update(event_params)
      Rails.logger.info "=== DEBUG: @event.memo after = #{@event.memo.inspect}"
      Rails.logger.info "=== DEBUG: update success"

      respond_to do |format|
        format.html { redirect_to @event, notice: "イベントを更新しました" }
        format.json { render json: { success: true, message: "イベントを更新しました" }, status: :ok }
      end
    else
      Rails.logger.info "=== DEBUG: errors = #{@event.errors.full_messages.inspect}"

      respond_to do |format|
        format.html { render :edit }
        format.json { render json: { success: false, errors: @event.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  def presentation
    render :presentation
  end

  def destroy
    @event.destroy
    redirect_to mypage_path(tab: 'events'), notice: "イベントを削除しました"
  end

  private

  # set_event を厳密化して、誤って "show" 等が id として渡された場合に
  # ActiveRecord::RecordNotFound を発生させないようにする。
  def set_event
    id = params[:id].to_s

    # common mistaken paths like /events/show -> redirect to presentation
    if id == "show" || id == "presentation"
      redirect_to presentation_events_path and return
    end

    # require a numeric id to avoid treating non-id segments as record ids
    unless id =~ /\A\d+\z/
      redirect_to root_path, alert: "無効なイベントIDです" and return
    end

    @event = Event.find_by(id: id)
    unless @event
      redirect_to root_path, alert: "指定のイベントが見つかりません" and return
    end
  end

  def event_params
    params.require(:event).permit(:title, :members_json, :member_results_json, :member_order_json, :setting_json, :history_json, :memo)
  end
end
