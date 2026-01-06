class CreateMemberLists < ActiveRecord::Migration[7.2]
  def change
    create_table :member_lists do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.jsonb :members_json, default: []

      t.timestamps
    end

    add_index :member_lists, [ :user_id, :name ]
  end
end
