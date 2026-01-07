class EventsLinkingController < ApplicationController
  before_action :authenticate_user!

  def show
    # ログイン後にLocalStorageのデータをサーバーに保存する確認画面を表示
    # トークンがセッションにある場合のみ表示
    @pending_token = session[:pending_event_token]
    @just_signed_up = session.delete(:just_signed_up)  # サインアップ後かどうかのフラグ（使用後すぐに削除）

    unless @pending_token
      redirect_to root_path, alert: "無効なリンクです"
    end
  end

  def create
    @event = current_user.events.build(normalized_event_params)

    Rails.logger.debug "=== EventsLinkingController#create ==="
    Rails.logger.debug "current_user: #{current_user.id}"
    Rails.logger.debug "event params: #{normalized_event_params.inspect}"
    Rails.logger.debug "@event valid?: #{@event.valid?}"
    Rails.logger.debug "@event errors: #{@event.errors.full_messages.inspect}" if @event.invalid?

    if @event.save
      Rails.logger.debug "Event saved successfully: #{@event.id}"
      Rails.logger.debug "Redirect URL: #{event_path(@event)}"
      Rails.logger.debug "Event attributes: #{@event.attributes.except('members_data', 'group_rounds', 'order_rounds', 'role_rounds', 'co_occurrence_cache').inspect}"
      # トークンをクリア
      session[:pending_event_token] = nil

      respond_to do |format|
        format.html { redirect_to @event, notice: "ログインしたのでイベントを保存しました" }
        format.json do
          redirect_url = "/events/#{@event.id}"
          Rails.logger.debug "Generated redirect_url: #{redirect_url}"
          render json: { success: true, redirect_url: redirect_url, message: "イベントを保存しました" }, status: :ok
        end
      end
    else
      Rails.logger.debug "Event save FAILED!"
      Rails.logger.debug "@event errors: #{@event.errors.full_messages.inspect}"

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
