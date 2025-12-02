class AddJsonColumnsToEvents < ActiveRecord::Migration[7.2]
  def change
    add_column :events, :member_results_json, :jsonb
    add_column :events, :member_order_json, :jsonb
    add_column :events, :setting_json, :jsonb
    add_column :events, :history_json, :jsonb
  end
end
