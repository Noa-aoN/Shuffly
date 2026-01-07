class EventsController < ApplicationController
  before_action :set_event, only: [:show, :edit, :update, :destroy]

  def index
    @events = current_user ? current_user.events : Event.none
  end

  def new
    @event = Event.new
    @update_mode = false

    # 「続きからシャッフル」機能：既存イベントのデータをロード
    if params[:load_event_id].present?
      @load_event = Event.find_by(id: params[:load_event_id])
      if @load_event
        @event = @load_event
        @update_mode = true

        # JavaScriptで使用するためのデータ（正規化形式のみ）
        @load_event_data = {
          title: @load_event.title,
          memo: @load_event.memo,
          original_id: @load_event.id,
          created_at: @load_event.created_at.strftime("%Y/%m/%d %H:%M"),
          # 正規化フィールド
          data_version: @load_event.data_version,
          members_data: @load_event.members_data,
          group_rounds: @load_event.group_rounds,
          order_rounds: @load_event.order_rounds,
          role_rounds: @load_event.role_rounds,
          co_occurrence_cache: @load_event.co_occurrence_cache
        }
      end
    end
  end

  def create
    # 更新モードの場合はupdateアクションに処理を委譲
    if params[:update_mode] == "true"
      update
      return
    end

    @event = current_user ? current_user.events.build(normalized_event_params) : Event.new(normalized_event_params)

    if @event.save
      redirect_to @event, notice: "イベントを保存しました"
    else
      render :new
    end
  end

  def show
    # 正規化データのみを使用
    @members = @event.members_list
    @group_history = @event.group_history
    @order_history = @event.order_history
    @role_history = @event.role_history
    @co_occurrence = @event.co_occurrence

    # データ形式情報
    @data_version = @event.data_version
    @normalized = @event.normalized?

    # 正規化データ
    @members_data = @event.members_data
    @group_rounds = @event.group_rounds
    @order_rounds = @event.order_rounds
    @role_rounds = @event.role_rounds
    @co_occurrence_cache = @event.co_occurrence_cache
  end

  def edit; end

  def update
    if @event.update(normalized_event_params)
      respond_to do |format|
        format.html { redirect_to @event, notice: "イベントを更新しました" }
        format.json { render json: { success: true, message: "イベントを更新しました" }, status: :ok }
      end
    else
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
    redirect_to mypage_path(tab: "events"), notice: "イベントを削除しました"
  end

  private

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
    # 正規化フィールドのみを許可
    params.require(:event).permit(
      :title,
      :memo,
      :data_version,
      :members_data,
      :group_rounds,
      :order_rounds,
      :role_rounds,
      :co_occurrence_cache
    )
  end

  def normalized_event_params
    params_hash = event_params.to_h

    # JSON文字列をパースしてHashまたはArrayに変換
    # パラメータが存在する場合のみ正規化を行う
    ['members_data', 'group_rounds', 'order_rounds', 'role_rounds', 'co_occurrence_cache'].each do |key|
      # キーが存在しない場合はスキップ（既存値を保持）
      next unless params_hash.key?(key)

      if params_hash[key].is_a?(String) && params_hash[key].present?
        begin
          params_hash[key] = JSON.parse(params_hash[key])
        rescue JSON::ParserError => e
          Rails.logger.error "Failed to parse #{key}: #{e.message}"
          # パースに失敗した場合はデフォルト値を設定
          params_hash[key] = (key == 'members_data' || key == 'co_occurrence_cache') ? {} : []
        end
      elsif params_hash[key].blank?
        # 空文字列が明示的に送信された場合のみデフォルト値を設定
        params_hash[key] = (key == 'members_data' || key == 'co_occurrence_cache') ? {} : []
      end
    end

    params_hash
  end
end
