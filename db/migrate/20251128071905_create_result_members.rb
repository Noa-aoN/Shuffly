class CreateResultMembers < ActiveRecord::Migration[7.2]
  def change
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
