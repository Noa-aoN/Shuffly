class DropMembersResultsTables < ActiveRecord::Migration[7.2]
  def up
    drop_table :result_members if ActiveRecord::Base.connection.table_exists?(:result_members)
    drop_table :results if ActiveRecord::Base.connection.table_exists?(:results)
    drop_table :members if ActiveRecord::Base.connection.table_exists?(:members)
  end

  def down
    # 必要なら復元用にテーブル定義を書く
    create_table :members do |t|
      t.references :event, null: false, foreign_key: true
      t.string :name
      t.timestamps
    end

    create_table :results do |t|
      t.references :event, null: false, foreign_key: true
      t.text :result_json
      t.bigint :seed
      t.timestamps
    end

    create_table :result_members do |t|
      t.references :result, null: false, foreign_key: true
      t.references :member, null: false, foreign_key: true
      t.string :group_name
      t.string :role
      t.integer :order_index
      t.timestamps
    end
  end
end