class RemoveLegacyJsonColumns < ActiveRecord::Migration[7.2]
  def up
    # レガシーJSONカラムを削除（正規化形式に移行完了のため）
    remove_column :events, :members_json, :jsonb
    remove_column :events, :member_results_json, :jsonb
    remove_column :events, :member_order_json, :jsonb
    remove_column :events, :setting_json, :jsonb
    remove_column :events, :history_json, :jsonb
  end

  def down
    # ロールバック用：カラムを復元
    add_column :events, :members_json, :jsonb, default: []
    add_column :events, :member_results_json, :jsonb, default: {}
    add_column :events, :member_order_json, :jsonb, default: {}
    add_column :events, :setting_json, :jsonb, default: {}
    add_column :events, :history_json, :jsonb, default: []
  end
end
