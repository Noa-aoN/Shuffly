class Event < ApplicationRecord
  belongs_to :user, optional: true

  # バリデーション
  validates :title, length: { maximum: 255 }, allow_blank: true
  validates :memo, length: { maximum: 10000 }, allow_blank: true

  # フォーム用の仮属性
  attr_accessor :members_input, :group_count, :group_names, :roles, :enable_role_shuffle, :enable_order_shuffle

  # ==========================================================================
  # 正規化データアクセサー
  # ==========================================================================

  # メンバーデータを取得
  def members_list
    data = parse_jsonb_field(members_data)
    data.is_a?(Hash) ? (data['members'] || []) : []
  end

  # グループ履歴を取得
  def group_history
    data = parse_jsonb_field(group_rounds)
    data.is_a?(Array) ? data : []
  end

  # 順番履歴を取得
  def order_history
    data = parse_jsonb_field(order_rounds)
    data.is_a?(Array) ? data : []
  end

  # 役割履歴を取得
  def role_history
    data = parse_jsonb_field(role_rounds)
    data.is_a?(Array) ? data : []
  end

  # 被り回数キャッシュを取得
  def co_occurrence
    data = parse_jsonb_field(co_occurrence_cache)
    data.is_a?(Hash) ? data : {}
  end

  # ==========================================================================
  # ユーティリティメソッド
  # ==========================================================================

  # データが正規化形式かどうか
  def normalized?
    data_version >= 2
  end

  private

  # JSONBフィールドをパースする（文字列の場合）
  def parse_jsonb_field(field_value)
    return field_value unless field_value.is_a?(String)

    begin
      JSON.parse(field_value)
    rescue JSON::ParserError => e
      Rails.logger.error "Failed to parse JSONB field: #{e.message}"
      nil
    end
  end
end
