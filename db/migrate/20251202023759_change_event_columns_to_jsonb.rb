class ChangeEventColumnsToJsonb < ActiveRecord::Migration[7.2]
  def change
    change_column :events, :members_json, :jsonb, default: [], using: 'members_json::jsonb'
    change_column :events, :config_json, :jsonb, default: {}, using: 'config_json::jsonb'

    # 他のカラムはすでに jsonb なので default を設定
    change_column_default :events, :member_results_json, []
    change_column_default :events, :member_order_json, []
    change_column_default :events, :setting_json, {}
    change_column_default :events, :history_json, []
  end
end