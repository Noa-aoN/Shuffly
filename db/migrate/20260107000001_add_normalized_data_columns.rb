class AddNormalizedDataColumns < ActiveRecord::Migration[7.2]
  def change
    # データバージョン管理（1=レガシー, 2=正規化, 3=ハイブリッド）
    add_column :events, :data_version, :integer, default: 1, null: false

    # 正規化されたデータ構造用カラム
    add_column :events, :members_data, :jsonb, default: {}
    add_column :events, :group_rounds, :jsonb, default: []
    add_column :events, :order_rounds, :jsonb, default: []
    add_column :events, :role_rounds, :jsonb, default: []
    add_column :events, :co_occurrence_cache, :jsonb, default: {}

    # パフォーマンスのためのインデックス
    add_index :events, :data_version

    # ドキュメンテーション用コメント
    execute <<-SQL
      COMMENT ON COLUMN events.data_version IS '1=legacy JSON format, 2=normalized format, 3=hybrid (both formats present)';
      COMMENT ON COLUMN events.members_data IS 'Normalized members data with unique IDs: [{id: 1, name: "John"}, ...]';
      COMMENT ON COLUMN events.group_rounds IS 'Group shuffle history: [{round: 1, assignments: [...], settings: {...}}, ...]';
      COMMENT ON COLUMN events.order_rounds IS 'Order shuffle history: [{round: 1, order: [member_ids], ...}, ...]';
      COMMENT ON COLUMN events.role_rounds IS 'Role assignment history: [{round: 1, assignments: [...], ...}, ...]';
      COMMENT ON COLUMN events.co_occurrence_cache IS 'Pre-calculated co-occurrence counts: {"1_2": 3, ...}';
    SQL
  end
end
