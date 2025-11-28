class ChangeUserIdNullOnEvents < ActiveRecord::Migration[7.0]
  def change
    change_column_null :events, :user_id, true
  end
end
