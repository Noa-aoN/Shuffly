class EventsLinkingController < ApplicationController
  before_action :authenticate_user!

  def show
    # ログイン後にLocalStorageのデータをサーバーに保存する確認画面を表示
    # セッションに一時保存されたデータがある場合のみ表示
    @pending_data = session[:pending_shuffly_event]
  end

  def create
    @event = current_user.events.build(normalized_event_params)

    if @event.save
      session[:pending_shuffly_event] = nil

      respond_to do |format|
        format.html { redirect_to @event, notice: "ログインしたのでイベントを保存しました" }
        format.json { render json: { success: true, redirect_url: event_path(@event), message: "イベントを保存しました" }, status: :ok }
      end
    else
      respond_to do |format|
        format.html { render :show, alert: "イベントの保存に失敗しました" }
        format.json { render json: { success: false, errors: @event.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  private

  def event_params
    params.require(:event).permit(
      :title, :memo, :data_version,
      :members_data, :group_rounds, :order_rounds, :role_rounds, :co_occurrence_cache
    )
  end

  def normalized_event_params
    params_hash = event_params.to_h

    # JSON文字列をパースしてHashまたはArrayに変換
    ['members_data', 'group_rounds', 'order_rounds', 'role_rounds', 'co_occurrence_cache'].each do |key|
      next unless params_hash.key?(key)

      if params_hash[key].is_a?(String) && params_hash[key].present?
        begin
          params_hash[key] = JSON.parse(params_hash[key])
        rescue JSON::ParserError => e
          Rails.logger.error "Failed to parse #{key}: #{e.message}"
          params_hash[key] = (key == 'members_data' || key == 'co_occurrence_cache') ? {} : []
        end
      elsif params_hash[key].blank?
        params_hash[key] = (key == 'members_data' || key == 'co_occurrence_cache') ? {} : []
      end
    end

    params_hash
  end
end
