class Event < ApplicationRecord
  belongs_to :user, optional: true
  has_many :members
  has_many :results

  # フォーム用の仮属性
  attr_accessor :members_input, :group_count, :group_names, :roles, :enable_role_shuffle, :enable_order_shuffle
end
