class Event < ApplicationRecord
  belongs_to :user, optional: true

  # フォーム用の仮属性
  attr_accessor :members_input, :group_count, :group_names, :roles, :enable_role_shuffle, :enable_order_shuffle

  # members_jsonを配列として返す
  def members
    JSON.parse(members_json || "[]")
  rescue JSON::ParserError
    []
  end
end
