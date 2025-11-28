class EventsController < ApplicationController
  before_action :set_event, only: [:show]

  # GET /events/new
  def new
    @event = Event.new
  end

  # POST /events
  def create
    # ゲストでも動くように user_id は nil でOK
    @event = current_user ? current_user.events.build(event_params) : Event.new(event_params)

    # 入力されたメンバーを配列化して JSON に保存
    members_input = params.dig(:event, :members_input).to_s
    members_array = members_input.split(/[\r\n,]+/).map(&:strip).reject(&:blank?)
    @event.members_json = members_array.map { |name| { "name" => name } }.to_json

    if @event.save
      # グループ名の取得、なければ group_count で生成（デフォルト1）
      group_names = if params.dig(:event, :group_names).present?
                      params[:event][:group_names].split(/[\r\n,]+/).map(&:strip).reject(&:blank?)
                    else
                      count = params.dig(:event, :group_count).to_i
                      count = 1 if count <= 0
                      (1..count).map { |i| "Group #{i}" }
                    end

      # メンバーをグループ分け（重複なし）
      grouped = group_names.map { |g| [g, []] }.to_h
      members_array.shuffle.each_with_index do |name, i|
        grouped[group_names[i % group_names.size]] << { "name" => name }
      end

      # 役割抽選
      if params.dig(:event, :roles).present? && params.dig(:event, :enable_role_shuffle) == "1"
        roles = params[:event][:roles].split(/[\r\n,]+/).map(&:strip).reject(&:blank?)
        grouped.each do |_, members|
          members.shuffle!
          members.each_with_index { |m, idx| m["role"] = roles[idx % roles.size] }
        end
      end

      # 順番決め
      if params.dig(:event, :enable_order_shuffle) == "1"
        grouped.each do |_, members|
          members.shuffle!
          members.each_with_index { |m, idx| m["order_index"] = idx + 1 }
        end
      end

      # 結果保存（seed を 64ビット整数に収める）
      seed = Random.new_seed % (2**63 - 1)
      @result = @event.results.create!(
        result_json: grouped.to_json,
        seed: seed
      )

      redirect_to @event
    else
      render :new
    end
  end

  # GET /events/:id
  def show
    @result = @event.results.last
  end

  private

  def set_event
    @event = Event.find(params[:id])
  end

  def event_params
    # 仮想属性 members_input を許可
    params.require(:event).permit(:title, :members_input, :group_count, :group_names, :roles, :enable_role_shuffle, :enable_order_shuffle)
  end
end