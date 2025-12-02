class EventsController < ApplicationController
  before_action :set_event, only: [:show, :edit, :update]

  def index
    @events = current_user ? current_user.events : Event.none
  end

  def new
    @event = Event.new
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
    @members = JSON.parse(@event.members_json || '[]')
    @results = JSON.parse(@event.member_results_json || '{}')
    @order = JSON.parse(@event.member_order_json || '{}')
    @settings = JSON.parse(@event.setting_json || '{}')
    @history = JSON.parse(@event.history_json || '[]')
  end

  def edit; end

  def update
    if @event.update(event_params)
      redirect_to @event, notice: "イベントを更新しました"
    else
      render :edit
    end
  end


  private

  def set_event
    @event = Event.find(params[:id])
  end

  def event_params
    params.require(:event).permit(:title, :members_json, :member_results_json, :member_order_json, :setting_json, :history_json)
  end
end